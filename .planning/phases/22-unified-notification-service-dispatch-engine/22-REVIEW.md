---
status: issues-found
files_reviewed: 16
findings:
  critical: 1
  warning: 12
  info: 5
  total: 18
phase: "22"
depth: standard
files_reviewed_list:
  - App.js
  - __tests__/setup/jest.setup.js
  - __tests__/unit/logger.test.js
  - __tests__/unit/notificationService.test.ts
  - src/context/BirthdayContext.js
  - src/context/TaskContext.js
  - src/navigation/AppNavigator.js
  - src/screens/BillingScreen.js
  - src/screens/BirthdaysScreen.js
  - src/screens/DailyTasksScreen.js
  - src/services/notificationService.ts
  - src/services/types.ts
  - src/utils/billingNotifications.js
  - src/utils/exportService.js
  - src/utils/logger.js
  - src/utils/notifications.js
---

# Phase 22: Code Review Report

**Reviewed:** 2026-10-10
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues-found

## Summary

Reviewed the Phase 22 unified notification service (`src/services/notificationService.ts`, `src/services/types.ts`), its legacy adapters, all migrated callers (contexts, screens, `App.js`), the PII-redacting logger, and the engine test suites. The new engine itself (`evaluateNotificationPolicy`, quiet-hours deferral, history pruning, birthday rollback of native handles) is sound and well-tested. However, the migration left one crash-grade defect in `App.js` — three call sites invoke birthday helpers that are no longer imported — plus a cluster of real correctness gaps: a context that drops empty-state syncs, duplicate/orphaned native notifications on task edit, side effects inside React state updaters, a throwing cancel API used as if it were infallible, PII bypassing the key-based log redaction, and unsanitized backup-archive content used to build filesystem paths. Details below.

## Critical Issues

### CR-01: App.js calls birthday schedulers that are not imported — ReferenceError on launch-reschedule, sync, and reset paths

**File:** `App.js:376,378` / `App.js:751,760` / `App.js:813`
**Issue:** `loadData` (birthday reschedule), `handleExecuteSync`, and `handleResetData` all call `cancelCustomBirthdayReminders(...)` / `scheduleCustomBirthdayReminders(...)`, but `App.js` imports only `scheduleNotification` from `./src/services/notificationService` (line 52) and nothing from `./src/utils/notifications`. The names are unbound, so every invocation throws `ReferenceError`. Verified: the functions are defined only in `src/utils/notifications.js:118,127`, and no `src/` file imports that module anymore.
**Impact:**
- Cold start with any birthdays: the `setTimeout` reschedule block throws (caught by the local `catch` and mislogged as a scheduling error), so birthday triggers are never refreshed — stale/expired native triggers silently persist and future birthdays can be missed.
- Sync: the throw aborts `handleExecuteSync` *after* `wipeNotesFilesystem` (step 2) but *before* notes are written back (step 3) and billing is restored — user sees a spurious failure dialog and the filesystem is left wiped; next `loadData` reads back empty notes (data-loss path).
- Reset: the throw inside `forEach` aborts the reset midway (daily tasks cleared, birthdays/notes/timer left intact) — partial, unreported reset.
**Fix:**
```js
// App.js — either restore the adapter import …
import {
  scheduleCustomBirthdayReminders,
  cancelCustomBirthdayReminders,
} from "./src/utils/notifications";
// … or finish the Phase 22 migration and call the service API directly:
import {
  scheduleNotification,
  scheduleBirthdayReminders,
  cancelNotifications,
} from "./src/services/notificationService";
// then replace scheduleCustomBirthdayReminders(b) → scheduleBirthdayReminders(b)
// and cancelCustomBirthdayReminders(ids) → cancelNotifications(ids)
```

## Warnings

### WR-01: BirthdayContext drops empty-state syncs — reset/sync-to-empty never propagates

**File:** `src/context/BirthdayContext.js:18-22`
**Issue:** The prop-sync effect only applies when `initialBirthdays.length > 0`. An empty array (reset-to-empty, sync result with zero birthdays) is ignored, so context keeps stale birthdays. `AppNavigator` prefers `birthdayCtx.birthdays` over the `birthdays` prop (`AppNavigator.js:96`), so screens keep rendering deleted birthdays after a reset. `TaskContext.js:45-49` already syncs unconditionally for exactly this reason — the two contexts disagree.
**Fix:**
```js
useEffect(() => {
  if (Array.isArray(initialBirthdays)) {
    setBirthdays(initialBirthdays);
  }
}, [initialBirthdays]);
```

### WR-02: Task edit without a due-date change schedules a duplicate native notification and orphans the old one

**File:** `src/context/TaskContext.js:262-274`
**Issue:** The old notification is cancelled only when `existing.dueDate !== taskToSave.dueDate`, but a new notification is scheduled whenever *any* due date is present. Editing a task's title/notes without touching the due date therefore leaves the original native trigger armed, schedules a second one, and overwrites `notificationId` — the first ID is lost and can never be cancelled (fires a duplicate alert). Conversely, if the re-schedule returns `null` (past date, native failure) after a due-date change, the already-cancelled old ID is retained — a stale pointer, and completion/delete paths will try to cancel a dead ID.
**Fix:**
```js
if (taskToSave.id) {
  const existing = tasks.find((t) => t.id === taskToSave.id);
  if (existing?.notificationId) {
    await cancelNotification(existing.notificationId);
    taskToSave.notificationId = null;
  }
}
let notificationId = null;
if (taskToSave.dueDate) {
  notificationId = await scheduleDueDateReminder(taskToSave);
}
```

### WR-03: Native scheduling/cancellation side effects run inside React state updaters

**File:** `src/context/TaskContext.js:194-208,232-241,314-323` / `src/screens/DailyTasksScreen.js:118-124`
**Issue:** `toggleTaskComplete` calls `scheduleDueDateReminder(...).then(...)` (including a nested `setTasks`) inside a `setTasks` updater; `deleteTask` and `handleDeleteList` call `cancelNotification` inside updaters; `deleteDailyTask` cancels inside a `setDailyTasks` updater. Updaters must be pure — React may double-invoke them (StrictMode/Concurrent), which double-schedules native notifications for a single toggle and issues duplicate cancels. (A prior phase already hit the stale-closure variant of this in the same function.)
**Fix:** Compute the mutation result from current state *outside* the updater, run the native side effect, then set state:
```js
const toggleTaskComplete = useCallback((id) => {
  setTasks((currentTasks) => toggleTask(currentTasks, id).updatedTasks);
  // schedule follow-up from a snapshot read, not inside the updater
}, []);
```

### WR-04: `cancelNotifications` throws on partial failure but every caller treats it as infallible

**File:** `src/services/notificationService.ts:724-743` callers → `src/utils/exportService.js:373`, `src/screens/BillingScreen.js:223,232`
**Issue:** The batch cancel aggregates failures and throws. `importArchive` awaits it mid-pipeline with no `try/catch`: one stale-ID failure aborts the loop before `saveBillingData`, so billing restore is silently skipped for an imported archive. `handleDeleteBill`/`handleMarkBillPaid` likewise abort before the storage write, leaving the bill neither deleted nor marked paid with no user feedback (the confirmation dialog just closes).
**Fix:** Either make cleanup call sites resilient:
```js
try {
  await cancelNotifications(bill.notificationIds || []);
} catch (e) {
  logger.warn('Partial bill-reminder cancel failure; continuing', { billId: bill.id });
}
```
or add a non-throwing `tryCancelNotifications` helper for fire-and-forget cleanup and keep the throwing variant for flows that need the report.

### WR-05: PII reaches the production-persisted forensic buffer via positional string args — key-based redaction does not cover it

**File:** `src/utils/logger.js:86-107` / `App.js:763`
**Issue:** `serializeItem` redacts only object *keys* matching `SENSITIVE_KEYS`. Bare string details pass through with only truncation. `App.js:763` does `logger.error("reschedule custom birthdays failed:", bday.name, err)` — the contact's name is buffered verbatim, and unlike `debug`/`info`, `error` buffers *and* emits in production (CR-02 design), so PII lands in the 50-entry ring-buffer that feeds copy-pasteable crash reports. Any current or future `logger.warn/error` call with a positional name/title/note string has the same hole; the `habitTitle`/`cueText` key redaction added this phase gives false confidence.
**Fix:** Never pass raw user content positionally — wrap it under a redacted key or drop it:
```js
logger.error("reschedule custom birthdays failed:", { birthdayId: bday.id, err });
```
and consider redacting bare-string details that match name-like patterns, or documenting that positional args must be PII-free.

### WR-06: Crafted backup archive yields path traversal and arbitrary AsyncStorage writes on import

**File:** `src/utils/exportService.js:343-358` / `src/utils/exportService.js:320-322`
**Issue:** `importArchive` interpolates `vault.id`, `note.folder`, and `note.title` from the archive directly into filesystem paths (`${vaultPath}${folder}/${title}.md`) with no sanitization — a malicious `.kwestup` file (received via share sheet, the documented import vector) with `title: "../../x"` or absolute segments writes outside the vault directory, clobbering sibling vaults or app files within the sandbox. Separately, `payload.storage` entries are `multiSet` without key validation, so a crafted archive can inject/overwrite any AsyncStorage key (telemetry opt-in, version markers, notification history).
**Fix:**
```js
const safeSegment = (s, fallback) =>
  typeof s === 'string' && /^[^./\\][^/\\]*$/.test(s) ? s : fallback;
// apply to vault.id, folder, title; skip-and-count entries that fail validation
const storageEntries = Object.entries(payload.storage).filter(([k]) => isUserDataKey(k));
```

### WR-07: `scheduleDailyTaskReminder` bypasses the policy engine entirely despite the module's recurring-request guarantee

**File:** `src/services/notificationService.ts:397-449` (vs. header contract lines 8-11)
**Issue:** The module docblock promises recurring requests "still receive quiet-hours shifting at schedule time," and `scheduleDueDateReminder`/`scheduleBirthdayReminders`/`scheduleBillReminder` all route through policy/history. `scheduleDailyTaskReminder` schedules directly via `expo-notifications` with no quiet-hours handling and no history record marked `exempt` — a daily 06:00 reminder fires inside quiet hours forever, and the history log has a gap for an entire scheduler family.
**Fix:** Either run the request through `evaluateNotificationPolicy`/`recordNotificationDispatch` like the other schedulers, or narrow the docblock to name the calendar-trigger exemption explicitly so the bypass is a documented decision, not drift.

### WR-08: `BehavioralNotificationPolicy` fields are accepted but never enforced

**File:** `src/services/types.ts:79-80` / `src/services/notificationService.ts:232-320`
**Issue:** `maximumRepeatedReminderCount` ("suppress after N ignores") and `priorityRules` ("ordered surface/priority arbitration rules (Phase 22)") are part of the policy surface, but `evaluateNotificationPolicy` never reads either. Callers supplying these get silent no-ops — configuration theater for suppression/arbitration behavior the engine does not implement.
**Fix:** Implement consumption in the evaluator, or remove/deprecate the fields until the intervention-planner phase lands.

### WR-09: Notification history uses unguarded read-modify-write — concurrent dispatches lose entries

**File:** `src/services/notificationService.ts:174-187`
**Issue:** `recordNotificationDispatch` reads the full array, pushes, and writes back with no serialization. Fire-and-forget callers exist (`TaskContext.handleCompleteTask`, `toggleTaskComplete`'s `.then`, `App.js` focus-timer completion), so two overlapping dispatches both read the same snapshot and the second write drops the first entry. Lost entries under-count toward the 3/day cap and weaken min-gap/dedup enforcement.
**Fix:** Serialize writes with a promise-chain mutex around the read-modify-write, e.g. `let writeQueue = Promise.resolve(); … writeQueue = writeQueue.then(() => doWrite(entry));`.

### WR-10: Daily-task toggle uses a stale-closure state snapshot — rapid interaction can drop updates

**File:** `src/screens/DailyTasksScreen.js:73-111`
**Issue:** `toggleDailyTaskComplete` maps over the `dailyTasks` value closed over at render time instead of using the functional form. A toggle raced with an in-flight `addDailyTask` `.then` append (or a second toggle before re-render) overwrites the newer array and silently drops the added task or the first toggle. `deleteDailyTask` in the same file already uses the functional form.
**Fix:** `setDailyTasks((prev) => prev.map((task) => …))`.

### WR-11: `scheduleBillReminder` does not validate `notifyDaysBefore`

**File:** `src/services/notificationService.ts:659-665`
**Issue:** `amount` and `dueDay` are strictly validated, but `notifyDaysBefore` flows straight into `notifyDate.setDate(dueDate.getDate() - (bill.notifyDaysBefore || 0))`. A negative value pushes the trigger *past* the due date (user is reminded after the bill is due); a non-integer shifts the fire time by a fractional day. The UI only offers 0/1/3/7, but this is a public service API also called from import/sync paths.
**Fix:**
```js
const notifyDays = Number.isInteger(bill.notifyDaysBefore) && bill.notifyDaysBefore >= 0
  ? bill.notifyDaysBefore : 0;
```

### WR-12: `encryptBackup` accepts an empty passphrase — encrypted archive with no real key

**File:** `src/utils/exportService.js:21-47`
**Issue:** No validation on `passphrase`: `encryptBackup(payload, "")` succeeds, producing a v2 envelope whose PBKDF2 key derives from an empty password — trivially brute-forced while presenting as AES-256-encrypted. Users who skip/blank the passphrase field get a false sense of protection on a file designed to leave the device via the share sheet.
**Fix:**
```js
if (typeof passphrase !== 'string' || passphrase.length < 8) {
  throw new Error('Passphrase must be at least 8 characters.');
}
```

## Info

### IN-01: Legacy adapters are fully migrated but retained — dead code with drifting policy constants

**File:** `src/utils/notifications.js:34-68` / `src/utils/billingNotifications.js:23-59`
**Issue:** Grep confirms zero importers under `src/` for either adapter; all callers use `src/services/notificationService.ts`. The retained `canDispatchBehavioralNotification` restates quiet-hours/cap/gap/dedup semantics that already disagree with the engine at the boundary (adapter treats 08:00 as allowed, engine as quiet) and `getNextDueDate` duplicates the service's clamping logic — future edits will fix one copy and miss the other.
**Fix:** If retention is intentional (test/compat harness), re-export or delegate constants to `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` instead of restating `3/90/30`; otherwise delete the modules.

### IN-02: Birthday countdown rendering is fragile on malformed dates and disagrees with the scheduler on Feb 29

**File:** `src/screens/BirthdaysScreen.js:103-109,112-155`
**Issue:** (a) A malformed `birthDate` (possible via sync/import) yields `month = NaN`, `Invalid Date` math, and `daysRemaining = NaN`, rendered as `IN_NaN_DAYS` with unstable sort order. (b) Non-leap Feb 29 birthdays display as March 2 (`day + 1` overflow) while `scheduleBirthdayReminders` observes Feb 28 — the badge and the actual alert disagree by two days. (c) `celebrateBirthday` dereferences `birthdays.find(...)` without a guard — a stale `id` throws inside the confirmation callback.
**Fix:** Validate parts before constructing dates (skip/sentinel invalid entries), share one Feb-29 helper between display and scheduler, and guard the `find`.

### IN-03: Unhandled-rejection hazards on floating promises

**File:** `src/navigation/AppNavigator.js:74-77` / `App.js:227-231,486-491`
**Issue:** `initNotificationChannels()` floats in `useEffect` (`setNotificationHandler` can throw synchronously, becoming an unhandled rejection); `AsyncStorage.setItem` floats in three effects; `loadBillingData().then(setBillingData)` has no rejection handler, leaving billing silently at defaults on storage failure. (`scheduleNotification` itself is safe to float — all its paths are caught.)
**Fix:** Add `.catch` logging or `void`-with-handler wrappers; surface a fallback for billing-load failure.

### IN-04: Birthday rollback cancels natives but leaves orphaned history entries

**File:** `src/services/notificationService.ts:585-595`
**Issue:** The mid-batch rollback cancels scheduled native IDs but does not remove the `recordNotificationDispatch` entries already written for them. Harmless today (cap/gap/dedup filter on `category === 'behavior'`), but the history now references notification IDs that no longer exist, which will confuse any future audit/reconciliation tooling.
**Fix:** Capture history length (or entry IDs) before the batch and truncate/compensate on rollback.

### IN-05: Test-harness hygiene — shared in-memory FS has no automatic reset

**File:** `__tests__/setup/jest.setup.js:15-27,112-116`
**Issue:** `mockInMemoryFS` persists across test files in a worker; `__resetFS` exists but nothing invokes it automatically. Any suite that writes vault files without resetting leaks state into later suites — order-dependent green/red. (No current failure observed; preventive.)
**Fix:** Call `__resetFS()` (and `AsyncStorage.clear()`) in a global `beforeEach` in this setup file.

---

_Reviewed: 2026-10-10_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
