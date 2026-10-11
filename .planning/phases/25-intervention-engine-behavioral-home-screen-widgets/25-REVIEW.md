---
status: issues-found
files_reviewed: 11
findings:
  critical: 0
  warning: 10
  info: 7
  total: 17
phase: "25"
depth: standard
---

# Phase 25: Code Review Report — Intervention Engine & Behavioral Home-Screen Widgets

**Reviewed:** 2026-10-11
**Depth:** standard (per-file analysis with language-specific checks)
**Files Reviewed:** 11 (App.js, __tests__/unit/behavioralWidget.test.ts, __tests__/unit/interventionEngine.test.ts, app.json, src/behavior/interventionEngine.ts, src/behavior/types.ts, src/context/HabitContext.js, tsconfig.json, widgets/HabitWidget.tsx, widgets/TasksListWidget.tsx, widgets/widget-task-handler.tsx)
**Status:** issues-found

## Summary

Reviewed all 11 Phase 25 files plus cross-referenced `rulebook/machine/interventionRules.json`, `src/behavior/habitEngine.ts` (`completeHabit`), `src/behavior/ruleEngine.ts` (`loadMachineRules`), and `src/utils/dateUtils.js` (`getLocalDateString`). The arbitration logic (anti-spam ≥3 → widget, quiet-hours defer to 08:15, 90-min gap throttle, priority ordering 100 > 95 > 90) matches the rulebook, and the widget touchpoint hierarchy (recovery > today-due > next-action > standby) is correctly implemented. No critical (ship-blocking) defects found. However, there are 10 warnings worth fixing: an off-by-one quiet-hours boundary that contradicts the stated `[22:00,08:00)` contract, a headless double-tap path that fabricates duplicate `HABIT_COMPLETED` events, headless completions that silently skip the rewards pipeline, a dead ticking-animation sequence, AsyncStorage lost-update races between the headless handler and the foreground contexts, an un-awaited widget update, a dropped audit trail, over-counting of malformed history, untruncated user PII rendered to the lock-screen widget surface, and unvalidated tab input. Seven info-level items cover ID generation, preview assets, dead code, and test-reality gaps.

## Warnings

### WR-01: `isInQuietHours` treats 08:00:00 as quiet, contradicting the `[22:00,08:00)` half-open contract

**File:** `src/behavior/interventionEngine.ts:32-42`
**Issue:** The spec (and phase requirements) define quiet hours as `[22:00,08:00)` — 08:00 is daytime. The implementation uses `totalMinutes <= endMinutes` (480), so exactly 08:00:00 (and 08:00:59, since seconds are ignored) is classified as quiet. A notification targeted at exactly 08:00 gets needlessly deferred to 08:15. The JSDoc ("22:00 through 07:59:59 (and 08:00:00) is quiet") bakes the contradiction into documentation, and `__tests__/unit/interventionEngine.test.ts:33-39` asserts `isInQuietHours(08:00:00) === true`, cementing the off-by-one into the test suite.
**Fix:**
```ts
// Window: [22:00, 24:00) U [00:00, 08:00)
return totalMinutes >= startMinutes || totalMinutes < endMinutes;
```
And update the test at `interventionEngine.test.ts:33-39` to expect `false` for `08:00:00`, plus the JSDoc to state `[22:00,08:00)`.

### WR-02: Headless `COMPLETE_HABIT` ignores idempotent `completedToday === false`, fabricating duplicate completion events on double-tap

**File:** `widgets/widget-task-handler.tsx:262-274`
**Issue:** `completeHabit()` (habitEngine) returns `{ completedToday: false }` when the habit's `lastCompletedDate` is already today, with the habit unchanged. The handler never checks this flag: it still rewrites storage, appends a `HABIT_COMPLETED` event with `completedToday: false` buried in the payload, and emits `HABIT_COMPLETED` telemetry. A rapid double-tap on the widget button therefore logs two completions for one real completion, inflating streak-adjacent analytics and the 500-item FIFO with phantom events.
**Fix:**
```tsx
const completionResult = completeHabit(targetHabit, { now, todayDate });
if (!completionResult.completedToday) {
  logger.debug('[WidgetTaskHandler] Habit already completed today, ignoring:', habitId);
  const nextTouchpoint = selectWidgetTouchpoint(parsedHabits);
  await safeRequestWidgetUpdate({
    widgetName: 'HabitWidget',
    renderWidget: () => <HabitWidget touchpoint={nextTouchpoint} />,
  });
  return;
}
```

### WR-03: Headless habit completion skips the rewards pipeline — widget completions never award factual rewards

**File:** `widgets/widget-task-handler.tsx:248-333` (vs `src/context/HabitContext.js:410-424`)
**Issue:** Foreground `HabitContext.completeHabit` runs `evaluateRewards`, persists new rewards, merges recovery `rulesApplied`, and forces the `HABIT_MISSED` previous-event override for recovery completions. The headless path calls only the pure `completeHabit` engine and persists habits + a `HABIT_COMPLETED` event — no `evaluateRewards`, no rewards write, no `RECOVERY_STARTED` context. Two completion paths for the same domain action produce systematically different outcomes depending on which surface the user taps. Tests (`behavioralWidget.test.ts:267-297`) assert streak/status but never rewards, so the divergence is unguarded.
**Fix:** Import `evaluateRewards` in the handler and mirror the context logic (reward evaluation + rewards-key persistence), or extract a shared `completeHabitWithRewards` helper used by both `HabitContext.js` and `widget-task-handler.tsx`.

### WR-04: Ticking-animation render is dead — immediately overwritten by the non-ticking updates that follow it

**File:** `widgets/widget-task-handler.tsx:189-233, 337-344`
**Issue:** On toggle-to-complete, the handler renders a temporary `isTicking` TasksList, waits 600ms, then renders ImportantTasks → DailyTasks → TasksList (non-ticking `parsed.tasks`), and finally the generic `WIDGET_CLICK` re-render block (lines 337-344) renders TasksList *again*. The ticking frame is therefore visible for 0ms — it is overwritten twice in the same tick sequence. The 600ms headless block only delays the real updates and risks the OS killing the headless task mid-sequence, leaving sibling widgets desynced.
**Fix:** Either remove the ticking intermediate render (and the 600ms sleep) and issue a single TasksList update, or move the final TasksList render before the sleep and drop the duplicate generic-block render for the already-handled widget.

### WR-05: AsyncStorage lost-update races between headless widget writes and foreground debounced/re-hydrate writes

**File:** `src/context/HabitContext.js:118-158, 205-226`; `widgets/widget-task-handler.tsx:273`
**Issue:** Two interleavings lose data: (a) `HabitContext` debounced persistence (400ms) writes the full in-memory habits snapshot; if a headless widget completion lands in storage during that window, the next debounced flush overwrites it with stale in-memory state, silently reverting the streak increment. (b) Foreground re-hydrate on `AppState === 'active'` blindly overwrites in-memory state from storage, discarding in-memory mutations whose debounced persist hasn't fired yet. The re-hydrate was added to converge headless writes, but without a pending-write guard it creates the symmetric race. `App.js` `saveData` merge no longer covers habits/tasks, so nothing else reconciles.
**Fix:** Before re-hydrating, flush-or-cancel the pending debounce (`clearTimeout` + immediate `persistState` of current snapshot), and after re-hydrate compare `lastCompletedDate`/`updatedAt` per habit, keeping the newer record rather than wholesale replacement. At minimum, skip re-hydrate while `storageWriteTimerRef.current` is pending.

### WR-06: `HabitWidgetSync` fires `requestWidgetUpdate` without await/catch — failures become unhandled promise rejections

**File:** `App.js:84-94`
**Issue:** `requestWidgetUpdate(...)` inside the `setTimeout` is neither awaited nor `.catch()`-chained; the surrounding `try/catch` only catches synchronous throws. If the native bridge rejects (e.g., widget not yet installed, Binder failure), it surfaces as an unhandled promise rejection. The headless handler correctly wraps this in `safeRequestWidgetUpdate` — the foreground path should do the same.
**Fix:**
```js
import { requestWidgetUpdate } from 'react-native-android-widget';
// reuse safeRequestWidgetUpdate pattern or:
requestWidgetUpdate({ widgetName: 'HabitWidget', renderWidget: () => <HabitWidget touchpoint={touchpoint} /> })
  .catch((err) => logger.warn('Failed to update HabitWidget from app:', err));
```

### WR-07: Approved-decision branch discards the evaluated `rulesApplied` audit trail

**File:** `src/behavior/interventionEngine.ts:220-226`
**Issue:** All three blocking branches return the evaluated `rulesApplied`, but the default approved branch returns `rulesApplied: []`, claiming no rules were evaluated. Any consumer auditing "which rules considered this candidate" gets a false empty trail on the happiest path.
**Fix:** Return `rulesApplied` (the evaluation result) instead of `[]` in the default branch.

### WR-08: Malformed history inflates the behavior count — missing category defaults to behavior, missing timestamps default to today

**File:** `src/behavior/interventionEngine.ts:124-129`
**Issue:** (a) `if (entry.category && entry.category !== 'behavior') return false` counts entries with *no* `category` field as behavioral notifications, so non-behavioral history lacking the field trips `REMINDER_ANTI_SPAM_001` early. (b) `entry.triggerDate || entry.dispatchedAt` may be `undefined`; `getLocalDateString(undefined)` falls back to its `new Date()` default and returns *today*, so a malformed entry with neither timestamp is counted as dispatched today. Both push users to the widget fallback spuriously.
**Fix:**
```ts
const behavioralToday = history.filter((entry) => {
  if (entry.category !== 'behavior') return false;
  const entryDateStr = entry.triggerDate || entry.dispatchedAt;
  if (!entryDateStr) return false;
  return getLocalDateString(entryDateStr) === todayDate;
});
```
(Apply the same strictness to the min-gap filter at lines 138-140 if uncategorized entries should not throttle.)

### WR-09: Raw user-controlled titles rendered untruncated to the lock-screen-visible widget surface (PII + Binder bloat)

**File:** `widgets/HabitWidget.tsx:137-144`; `widgets/TasksListWidget.tsx:243-252`; `src/behavior/interventionEngine.ts:263, 282, 300`
**Issue:** Habit titles and task titles (free-form user input, potentially sensitive — e.g., health, addiction, relationship topics) are interpolated verbatim into widget subtitles and pushed to the Android home screen, which is visible without unlocking the device. There is no truncation, so a long title also inflates the Binder transaction that `react-native-android-widget` already guards elsewhere with 5-/8-item slicing. Note `App.js` slices task lists but never truncates title strings.
**Fix:** Truncate at the touchpoint construction site (single choke point), e.g. `const subtitle = (title + ': ' + target).slice(0, 80)`, so headless, foreground, and test paths all inherit the bound; consider a user-facing "private habits hidden from widget" setting for sensitive titles.

### WR-10: `SWITCH_TAB` persists unvalidated tab strings; renderer silently collapses legacy values

**File:** `widgets/widget-task-handler.tsx:94-101, 364-371`
**Issue:** `props.clickActionData.tab` is cast to a union (`as 'tasks' | 'daily' | ...`) without an allowlist check, then persisted to `kwestup_widget_tab_${widgetId}` and the global `kwestup_widget_active_tab`, and echoed into `WIDGET_ACTION` telemetry. A foreign/malformed intent value persists junk state. Meanwhile both render sites collapse anything non-`persistent` to `all`, so stored legacy values (`tasks`/`daily`/`timer`) are write-only noise that never renders distinctly.
**Fix:** Validate before persisting (`if (!['all','persistent'].includes(targetTab)) return;`) and migrate/clear legacy per-widget tab keys holding `tasks`/`daily`/`timer`.

## Info

### IN-01: Behavior event IDs use `Math.random()` instead of the canonical `generateEntityId`

**File:** `widgets/widget-task-handler.tsx:287-288`
**Issue:** `bevt_${Date.now()}_${Math.random().toString(36)...}` is collision-prone under rapid successive taps (same ms + weak entropy) and inconsistent with `HabitContext.js`, which uses `generateEntityId('bevt')`. Duplicate IDs would corrupt event-identity assumptions downstream.
**Fix:** Import and use `generateEntityId('bevt')` from `../src/behavior/habitEngine`.

### IN-02: HabitWidget and TasksListWidget reuse other widgets' preview images in app.json

**File:** `app.json:98, 110`
**Issue:** `TasksList` points at `important-tasks-preview.png` and `HabitWidget` at `daily-tasks-preview.png`. Copy-paste placeholders ship the wrong widget preview to the Android widget picker.
**Fix:** Add dedicated `tasks-list-preview.png` and `habit-widget-preview.png` assets and reference them.

### IN-03: Unused `completeHabit` import in widget behavioral tests

**File:** `__tests__/unit/behavioralWidget.test.ts:20`
**Issue:** `import { completeHabit } from '../../src/behavior/habitEngine'` is never referenced in the file. Dead import adds confusion about what the suite covers.
**Fix:** Remove the import (or use it to add a direct engine-vs-handler parity test, which would also guard WR-03).

### IN-04: TasksList header `ACTIVE` count disagrees with the tab-filtered rows shown below it

**File:** `widgets/TasksListWidget.tsx:29-36`
**Issue:** `activeCount` counts all uncompleted tasks, but `activeTasks` is tab-filtered (one-time vs persistent). In the persistent tab the header can read `ACTIVE: 7` while 2 rows are visible.
**Fix:** Compute `activeCount` from the same filtered set, or label the header `ACTIVE (ALL)` vs per-tab counts.

### IN-05: `selectWidgetTouchpoint` rulesApplied else-branch is dead code

**File:** `src/behavior/interventionEngine.ts:250-254`
**Issue:** With `surface: 'widget'` + `event: 'RENDER_WIDGET'`, `evaluateRules` against the shipped `interventionRules.json` always matches `WIDGET_PRIORITY_001`, so the `...evaluationResult.rulesApplied` spread branch never executes. Harmless but misleading.
**Fix:** Simplify to `const rulesApplied = ['WIDGET_PRIORITY_001'];` with a comment, or assert-and-fallback if the rule is ever removed from the JSON.

### IN-06: Widget telemetry tests assert same-process `eventBus` delivery, but production headless runs in a separate JS environment

**File:** `__tests__/unit/behavioralWidget.test.ts:303-362`
**Issue:** The `WIDGET_ACTION` / `HABIT_COMPLETED` emission assertions pass in Jest (shared `eventBus` singleton) but in production the headless handler's in-memory emits only reach headless-local listeners (as the WR-07 code comment itself notes); foreground convergence happens via AsyncStorage re-hydrate. A green test therefore overstates production telemetry wiring.
**Fix:** Add a test asserting the storage-persisted `HABIT_COMPLETED` event (source `widget`) survives a simulated foreground re-hydrate read, rather than relying solely on `subscribeAll` capture.

### IN-07: Foreground re-hydrate effect lacks an `isMounted` guard

**File:** `src/context/HabitContext.js:118-158`
**Issue:** Unlike the initial hydration effect (which tracks `isMounted`), the `AppState` re-hydrate awaits four `AsyncStorage` reads then calls `setState` unconditionally — a post-unmount resolution triggers the React "state update on unmounted component" warning.
**Fix:** Add the same `isMounted` flag pattern with cleanup, or check a mounted ref before the `setHabits`/`setIdentities`/etc. calls.

---

_Reviewed: 2026-10-11_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
