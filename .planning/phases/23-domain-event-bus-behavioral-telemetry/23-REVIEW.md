---
status: issues-found
files_reviewed: 13
findings:
  critical: 1
  warning: 10
  info: 3
  total: 14
phase: "23"
depth: standard
---

# Phase 23: Code Review Report — Domain Event Bus + Behavioral Telemetry

**Reviewed:** 2026-10-10
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues-found

## Summary

Reviewed the Phase 23 domain event bus (`src/behavior/eventBus.ts`, `src/behavior/types.ts`), all instrumented mutation paths (`TaskContext`, `BillingContext`, `BirthdayContext`, `BillingScreen`, `DailyTasksScreen`, `FocusTimerScreen`, `App.js` timer completion, `widgets/widget-task-handler.tsx`), and three unit test files.

The bus core (typed + wildcard subscriptions, snapshot iteration, sync/async error isolation, 100-event FIFO, idempotent unsubscribes) is sound and well-tested. Instrumentation is correctly placed *outside* `setState` updaters in most paths (StrictMode-safe) and `logger.debug` correctly omits payloads.

However, several real defects remain: one silent-persistence data-loss risk (CR), systematic StrictMode-impure updaters with side effects inside `setState`, a `useDomainEvent` wrapper that defeats the bus's own async error isolation, shallow-only freeze/clone that contradicts the claimed deep-freeze guarantee, phantom telemetry events for unknown entity IDs, incomplete billing coverage, stale-state guards that block reset propagation, and a headless-widget architecture gap where widget emissions may never reach the app's in-memory bus. PII (names, birthdates, amounts, task titles) is retained in the ring buffer by design — currently safe because it is never persisted/logged, but worth documenting.

No hardcoded secrets, injection, or XSS vectors found in scope.

## Critical Issues

### CR-01: Async persistence side-effect inside `setState` updater with unhandled rejection — silent billing data loss

**File:** `src/context/BillingContext.js:132-138`
**Issue:** `updateBillingDataState` calls the async `saveBillingData(next)` *inside* the `setBillingData` updater function, without `await` or `.catch()`:

```js
setBillingData((prev) => {
  const next = typeof updater === "function" ? updater(prev) : updater;
  saveBillingData(next); // promise ignored
  return next;
});
```

Updaters must be pure — React StrictMode double-invokes them, so this performs duplicate writes. Worse, if `saveBillingData` rejects (disk full, corrupt JSON, AsyncStorage failure), the rejection is unhandled and the UI already shows the updated billing state. The user believes the edit persisted; on restart it is gone.
**Impact:** Silent data loss; possible unhandled promise rejection warning/crash in dev; StrictMode double-write.
**Fix:**
```js
const updateBillingDataState = useCallback(async (updater) => {
  let next;
  setBillingData((prev) => {
    next = typeof updater === "function" ? updater(prev) : updater;
    return next;
  });
  try {
    await saveBillingData(next);
  } catch (err) {
    logger.error("❌ Failed to persist billing data:", err);
  }
}, []);
```
Compute `next` from a current snapshot outside the updater where possible, persist after `setBillingData`, and always attach error handling.

## Warnings

### WR-01: Notification scheduling side-effect inside `setState` updater — StrictMode double-schedule

**File:** `src/context/TaskContext.js:204-216`
**Issue:** `toggleTaskComplete` calls `scheduleDueDateReminder(spawnedTask).then(...)` *inside* the `setTasks` updater. Updaters must be pure; StrictMode double-invocation schedules the reminder twice and the chained `setTasks` inside `.then()` compounds the impurity. The file's own comment (lines 64-69) states writes must never happen inside an updater — this path violates it.
**Impact:** Duplicate scheduled notifications for spawned recurring tasks; flaky double-write behavior in dev StrictMode.
**Fix:** Compute `toggleTask(currentTasksSnapshot, id)` outside the updater from the current `tasks` snapshot, schedule the reminder outside, then `setTasks(updatedTasks)` with a plain value:
```js
const { updatedTasks, spawnedTask } = toggleTask(tasks, id);
setTasks(updatedTasks);
if (spawnedTask?.dueDate) {
  scheduleDueDateReminder(spawnedTask).then((nid) => {
    if (nid) setTasks((prev) => prev.map((t) => t.id === spawnedTask.id ? { ...t, notificationId: nid } : t));
  }).catch((e) => logger.warn("Reminder schedule failed:", e));
}
```

### WR-02: `handleSaveTask` reads updater-assigned variable synchronously — fragile telemetry + stale `isUpdate`

**File:** `src/context/TaskContext.js:293-338`
**Issue:** `finalSavedTask` is assigned *inside* the `setTasks` updater and read immediately after `setTasks(...)` returns. React queues updaters; the assignment has not necessarily run when the `if (finalSavedTask)` check executes, so the `TASK_CREATED`/`TASK_UPDATED` emit is timing-dependent. The updater is also impure (outer-variable assignment). Additionally `isUpdate` is derived from the stale `tasks` closure, so two rapid saves can emit the wrong event type.
**Impact:** Missed or mis-typed task telemetry events; StrictMode impurity.
**Fix:** Compute outside the updater:
```js
const { updatedTasks, savedTask } = saveTask(tasks, { ...taskToSave, notificationId });
setTasks(updatedTasks);
if (savedTask) eventBus.emit({ type: isUpdate ? "TASK_UPDATED" : "TASK_CREATED", entityId: savedTask.id, source: "app", payload: {...} });
```

### WR-03: `useDomainEvent` wrapper drops listener return value — defeats async error isolation

**File:** `src/behavior/eventBus.ts:247-257`
**Issue:** The hook subscribes with `(event) => { listenerRef.current(event); }` — no `return`. When the user listener is async and rejects, the bus's `result.catch(...)` isolation (lines 143-152, 166-174) sees `result === undefined` and never attaches a handler, producing an unhandled promise rejection despite the bus's documented guarantee.
**Impact:** Unhandled rejections from hook consumers; contradicts TC-EVT-05 guarantee.
**Fix:**
```ts
const unsubscribe = eventBus.subscribe(type, (event) => {
  return listenerRef.current ? listenerRef.current(event) : undefined;
});
```

### WR-04: Shallow freeze/clone only — nested payload mutation leaks across listeners and buffer

**File:** `src/behavior/eventBus.ts:118-124`
**Issue:** The event is `Object.freeze({...})` with `payload: {...payload}` / `metadata: {...metadata}` — one level only. Nested objects are shared by reference with the caller's input and across all listeners plus the ring buffer. The TC-EVT-07 test name claims "deep-freezes" but only top-level is frozen. Any listener mutating `event.payload.nested.field` corrupts the buffered event and subsequently dispatched listeners.
**Impact:** Cross-listener state corruption; buffered telemetry no longer reflects what was emitted.
**Fix:** Deep-clone inputs at emit time and deep-freeze, or document flat-payload-only contract and enforce it:
```ts
const deepFreeze = (o: any): any => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
};
// structuredClone payload/metadata, then deepFreeze(event)
```
Current flat payloads (title, amount, dates) are unaffected today, but the guarantee is false for future nested payloads.

### WR-05: `BirthdayContext` blocks empty-state sync; scheduling failure drops user data

**File:** `src/context/BirthdayContext.js:19-23`, `src/context/BirthdayContext.js:25-64`
**Issue:** (a) The sync guard `initialBirthdays !== DEFAULT_BIRTHDAYS && initialBirthdays.length > 0` means a legitimate reset-to-empty never propagates — stale birthdays remain in context after `handleResetData`, unlike `TaskContext`'s unconditional sync. (b) `handleSaveBirthday` awaits `scheduleBirthdayReminders` with no `try/catch` and no fallback — if scheduling throws, the birthday is never saved and the error propagates to an unprepared caller. `DailyTasksScreen` already implements the correct degrade-to-unscheduled fallback (WR-04 comment pattern); this path does not.
**Impact:** Stale birthdays after reset; user-entered birthday lost on notification failure.
**Fix:** Sync unconditionally when `Array.isArray(initialBirthdays)`; wrap scheduling:
```js
let notificationIds = [];
try {
  notificationIds = await scheduleBirthdayReminders(bdayToSchedule);
} catch (e) {
  logger.warn("Birthday reminder scheduling failed; saving without reminder:", e?.message);
}
```

### WR-06: Incomplete billing instrumentation + untraceable fallback entity IDs

**File:** `src/context/BillingContext.js:47-95`
**Issue:** `addTransactionAction` emits `BILL_PAID` and `addRecurringBillAction` emits `BILL_CREATED`, but `deleteTransactionAction`, `upsertBudgetAction`, and `deleteBudgetAction` emit nothing — `BILL_UPDATED`/`BILL_DELETED` coverage has gaps, so telemetry undercounts deletes and budget changes. Separately, `String(tx.id || Date.now())` / `String(bill.id || Date.now())` fabricates an entityId when the caller omits `id`, but `addTransaction`/`addRecurringBill` in storage may assign a different canonical id — the emitted `entityId` then matches no persisted entity.
**Impact:** Incomplete billing telemetry; uncorrelated entity IDs break start→paid→deleted tracing.
**Fix:** Emit `BILL_DELETED` on both delete paths and `BILL_UPDATED`/`BILL_CREATED` on budget upsert as appropriate; capture the id from the *returned* `updated` record (or require callers to pass ids) instead of `Date.now()` fallback.

### WR-07: Headless widget emissions may never reach the app bus; fire-and-forget updates; blocking sleep

**File:** `widgets/widget-task-handler.tsx:129-135`, `widgets/widget-task-handler.tsx:147-202`
**Issue:** (a) `eventBus` is a process-local in-memory singleton. The headless widget handler frequently runs in a separate JS context from the foreground app — its `WIDGET_ACTION`/`TASK_COMPLETED` emits land in an isolated bus instance no app subscriber or `getRecentEvents` caller ever sees. Telemetry tests pass because tests run in one context, masking the production gap. (b) Four `requestWidgetUpdate(...)` calls are fire-and-forget with no `await`/`catch` — failures are silent unhandled rejections. (c) `await new Promise(r => setTimeout(r, 600))` blocks the handler for the ticking animation *before* the storage write, widening the documented <500ms lost-update micro-window against concurrent in-app mutations.
**Impact:** Widget telemetry silently lost in production; silent widget-refresh failures; elevated risk of widget write clobbering app edits.
**Fix:** Document that widget bus events are best-effort unless a bridge persists/forwards them; add `.catch()` logging to each `requestWidgetUpdate`; move the 600ms animation delay *after* the `AsyncStorage.setItem`, or write storage first then animate.

### WR-08: `App.js` focus-completion emit can double-fire under StrictMode; timer can go negative; billing load rejection unhandled

**File:** `App.js:682-717`, `App.js:490`, `App.js:684-688`
**Issue:** (a) `FOCUS_COMPLETED` is emitted inside the timer `useEffect` with `entityId: focus_${Date.now()}` and no dedup guard. StrictMode double-mounts effects in dev, and the `timerRemaining === 0 && isTimerRunning` edge can re-evaluate across renders, emitting two completion events with different ids for one session. (b) The tick `setTimerRemaining((prev) => prev - 1)` never clamps — a delayed cleanup can drive `timerRemaining` to `-1` (`formatTime` renders `-1:-1`). (c) `loadBillingData().then(setBillingData)` has no `.catch()` — a storage failure is an unhandled rejection.
**Impact:** Duplicate completion telemetry; negative timer display; unhandled rejection.
**Fix:** Guard completion with a `ref` (e.g., `focusCompletedRef`) reset on start; clamp `Math.max(0, prev - 1)`; add `.catch((e) => logger.warn(...))` to the billing load.

### WR-09: `DailyTasksScreen` stale-closure updates + phantom delete event + unhandled Haptics promises

**File:** `src/screens/DailyTasksScreen.js:86-143`, `src/screens/DailyTasksScreen.js:145-166`
**Issue:** (a) `toggleDailyTaskComplete` and the toggle branch use the stale `dailyTasks` prop with `setDailyTasks(dailyTasks.map(...))` instead of a functional updater — rapid toggles lose updates. (b) `deleteDailyTask` emits `TASK_DELETED` unconditionally inside the confirm callback without checking the id exists — deleting an already-removed id still records telemetry. (`toggleDailyTaskComplete` correctly guards with `if (target)`; delete does not.) (c) Bare `Haptics.notificationAsync` / `impactAsync` calls (lines 36, 87, 149) return promises with no `catch` — haptics failures surface as unhandled rejections.
**Impact:** Lost toggle updates under rapid taps; phantom delete events; noisy unhandled rejections on devices without haptics.
**Fix:** Use `setDailyTasks((prev) => prev.map(...))` with existence check before emit; guard delete with `if (!dailyTasks.some((t) => t.id === id)) return;`; append `.catch(() => {})` or wrap Haptics in try/catch.

### WR-10: `FocusTimerScreen` unbounded duration input; `FOCUS_STARTED` sessions uncorrelated

**File:** `src/screens/FocusTimerScreen.js:86-100`, `src/screens/FocusTimerScreen.js:52-66`
**Issue:** (a) `handleDurationChange` accepts any `parsedMinutes > 0` with no upper bound — `9999` minutes yields a ~7-day timer with no validation message. (b) Each `startTimer` mints `focus_${Date.now()}` independently; pause/resume cycles emit multiple `FOCUS_STARTED` events with no shared session id, so `FOCUS_STARTED` → `FOCUS_COMPLETED` (emitted in `App.js`) cannot be correlated.
**Impact:** Absurd timer states; unjoinable focus telemetry.
**Fix:** Clamp to a sane max (e.g., 180 min) with user feedback; generate one session id on first start, reuse across resume, and include it in both `FOCUS_STARTED` and `FOCUS_COMPLETED` payloads.

## Info

### IN-01: `Math.random` for event-ID entropy

**File:** `src/behavior/eventBus.ts:18-23`
**Issue:** `generateEventId` uses `Math.random().toString(36)` plus a monotonic counter. Adequate for local telemetry correlation, but not cryptographically unpredictable. No current exploit path (ids are not auth tokens), so informational only.
**Fix:** No change required unless ids ever become security-relevant; if so, switch to `expo-crypto` / `Crypto.getRandomValues`.

### IN-02: PII retained in the in-memory ring buffer by design — keep it out of logs and persistence

**File:** `src/context/BirthdayContext.js:53-61`, `src/context/BillingContext.js:51-60`, `src/context/TaskContext.js:218-232`, `src/behavior/eventBus.ts:126-133`
**Issue:** Payloads carry PII/financial data (birthday `name`+`date`, transaction `amount`+`category`+`date`, task `title`). The 100-event buffer retains these in memory until eviction. Current code is safe: `logger.debug` logs only `type`/`entityId`/`source`, and the buffer is never persisted. Flagged so future contributors do not `console.log(event)`, persist `getRecentEvents()`, or attach a network-forwarding subscriber without redaction.
**Fix:** Add a code comment at `recordEvent` / `emit` stating payloads may contain PII and must never be persisted or transmitted without explicit consent and redaction.

### IN-03: `as any` casts, `Date.now()` ids, and a potentially flaky async-rejection test

**File:** `widgets/widget-task-handler.tsx:110-115`, `widgets/widget-task-handler.tsx:198`, `src/screens/DailyTasksScreen.js:38`, `src/screens/BillingScreen.js:150`, `__tests__/unit/eventBus.test.ts:203-224`
**Issue:** (a) `activeTab as any`, `parsed.tasks as any` discard the `TaskItemType` safety the handler otherwise defines. (b) `Date.now()`-based ids (`DailyTasksScreen` daily tasks, `BillingScreen` transactions/bills) collide under same-millisecond creation — prefer the bus's `generateEventId()` pattern. (c) The TC-EVT-05 test awaits a single `Promise.resolve()` microtask before asserting the async-error log — timing-fragile; use `await new Promise(setImmediate)` / flush-promises helper.
**Fix:** Tighten widget types (`activeTab: 'all' | 'persistent'` narrowing without cast); use counter+entropy ids; harden the test flush.

---

_Reviewed: 2026-10-10_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
