# Phase 17 Code Review: State Architecture & Unified Mutation Layer

**Phase:** 17
**Depth:** standard
**Scope:** Commit `0786531` (feat(arch): complete phase 17) — files from 17-01/17-02 SUMMARYs cross-checked against git
**Reviewed:** 2026-09-28
**Files in scope:**
`src/utils/taskMutations.js`, `src/context/TaskContext.js`, `src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`, `src/navigation/AppNavigator.js`, `App.js`, `widgets/widget-task-handler.tsx`, `src/utils/dateUtils.js` (supporting), tests

---

## Verdict

⚠️ **Solid architecture, but two functional regressions and one data-loss risk need fixes before Phase 18.**

The pure mutation engine (`taskMutations.js`) and widget parity are genuinely good work — well tested, well documented, and behaviorally equivalent to the old widget handler. However, the "decoupling" stopped at the provider layer: App.js still owns duplicated task logic, and the split-brain between context state and App state produces two real bugs (silent dead modal, potential stale-save data loss).

**Counts: 2 Critical · 3 Warning · 5 Info**

---

## Critical Findings

### C-01 — TaskEditModal is bound to App.js state, but screens set it via context → edit modal can never open

**Severity:** Critical (silent functional regression)
**Files:** `App.js:1247-1254`, `src/navigation/AppNavigator.js:95-96`, `src/screens/TaskListScreen.js:242,393`, `src/screens/DashboardScreen.js:174`, `src/screens/SearchScreen.js:100`

Screens receive `setSelectedTask`/`setModalVisible` from the **TaskContext** (`effectiveSetSelectedTask = taskCtx?.setSelectedTask ?? …` — context always wins since `taskCtx` is non-null inside `TaskProvider`). But the actual `<TaskEditModal visible={modalVisible} …>` lives in **App.js**, bound to App's **local** `modalVisible`/`selectedTask` state — not the context's.

App.js does not consume `useTasks()` (it can't — it's the component that *renders* `TaskProvider`), so context `modalVisible` changes are invisible to the modal.

**Repro:** Tap any task's pencil icon (TaskListScreen, Dashboard, Search) → `setSelectedTask(task); setModalVisible(true)` updates context state only → App's local `modalVisible` stays `false` → **modal never opens**. Same for the FAB "+" button (`TaskListScreen.js:393`).

**Fix options (either):**
1. Hoist the modal into `AppNavigator` (it already has both context values and `currentTheme`/`taskLists` via `effectiveTaskLists`), or
2. Keep the modal in App.js but change App's `showConfirmation`-style props: pass App's local setters into `TaskProvider` as props it *stores and re-exposes* (e.g. `modalController={{ visible, show, hide }}`).

Option 1 is cleaner and finishes the decoupling ARCH-01 intended.

---

### C-02 — Dual task mutation paths resurrect the exact recurrence/completion divergence ARCH-02 was meant to kill

**Severity:** Critical (architecture regression / correctness drift risk)
**Files:** `App.js:704-770` (`toggleTaskComplete`), `App.js:809-827` (`handleCompleteTask`), `App.js:829-865` (`handleSaveTask`), `App.js:867-890` (`handleToggleSubtask`), `App.js:892-925` (`handleCreateList/Rename/Delete`)

Phase 17's headline deliverable was a **single** mutation module shared by app and widget. But App.js still contains its own hand-rolled copies of every task mutation (~220 lines) with subtle behavioral differences from `taskMutations.js`:

| Behavior | App.js copy | taskMutations.js (authoritative) |
|---|---|---|
| Recurring toggle `updatedAt` | **not set** | set to `now` |
| Non-recurring toggle `updatedAt` | **not set** | set to `now` |
| Subtask toggle | no `updatedAt` on parent | sets `updatedAt` on parent |
| Recurrence spawn title `task.name` fallback | `task.title \|\| task.name` (can yield `undefined` → NaN regex on `undefined.match` crashes? No — regex on undefined throws) | `task.title \|\| task.name \|\| ""` (safe) |

The navigator consumes the **context** versions (`taskCtx?.toggleTaskComplete ?? toggleTaskComplete`), so App.js's copies are currently dead code — but they are still passed as props, still maintained, and any future "prop fallback" consumer (e.g. modular testing harness, or removing a context) silently reactivates the divergent logic. This is precisely the bug class Phase 17 was chartered to eliminate (success criterion 2).

**Fix:** Delete the duplicated handlers from App.js and the corresponding `AppNavigator` prop-fallbacks (`effective… ?? props`), making context the only path. Keep the props only for theme/timer/sync concerns that have no context yet.

---

## Warning Findings

### W-01 — Stale-save race: context refresh can be overwritten by App.js's 15s throttled save

**Severity:** Warning (data loss window)
**Files:** `App.js:414-456` (`saveData`), `App.js:470-484` (AppState reload), `App.js:504-520` (save trigger), `src/context/TaskContext.js:61-115` (`refreshTasksFromStorage`)

The app has **two competing state owners** for tasks:

1. `TaskContext.refreshTasksFromStorage()` — pulls widget-mutated storage into memory on foreground (success criterion 3 ✅ in isolation).
2. App.js `loadData()` on foreground — re-reads storage and `setTasks(parsedData.tasks)` locally; App's local `tasks` are then saved back by the throttled `saveData()` effect whenever they (or any co-dependent dep) change.

Since App.js's local `tasks` state is what `saveData()` persists, and the context's refreshed tasks never flow back into App's state, the very next periodic save (theme change, timer tick flush, any dep change after 15s) writes the **stale pre-widget** task array back to AsyncStorage — silently reverting the widget's toggle/recurrence spawn.

Sequence: background → widget toggles task → foreground: context refreshes (UI looks right), App.loadData also refreshes its local copy (currently masks the bug) → user changes theme → `saveData` fires with `tasks` from App closure — which is correct *today* only because App.loadData also ran. But `loadData` is skipped when `isInitialized` is false and the two refreshes are not atomic against each other; a slow `loadData` (note: `await getAllNotesFromFilesystem` sits between read and `setTasks`) racing a fast context refresh + save effect can interleave. The design leaves no single owner of the write path.

**Fix:** After `TaskProvider` refreshes from storage, App should not independently re-persist its own snapshot. Longer term: make storage the single source of truth with the context as sole writer (App.js's save effect should serialize context state, or context should own persistence).

---

### W-02 — `refreshTasksFromStorage` clobbers in-memory-only mutations with whole-array replace

**Severity:** Warning (edge-case data loss)
**Files:** `src/context/TaskContext.js:66-90`

The refresh does a `JSON.stringify` equality check and, if different, **replaces** the entire tasks array from storage. Any in-memory state not yet persisted is lost. App.js throttles `saveData` up to 15s (`App.js:496-520`), so a user who toggles a task and backgrounds the app within that 15s window **loses the toggle** the moment they return: the in-memory change was never written, storage has the old value, JSON differs, and the refresh overwrites memory with stale storage.

**Fix:** Persist task mutations eagerly (debounce ≤1s) or, better, have `toggleTaskComplete`/`handleSaveTask` write through to storage immediately and let `refreshTasksFromStorage` be a no-op for already-synced keys. Alternatively merge by `updatedAt` per task id instead of whole-array replace.

---

### W-03 — `BillingContext.setBillingData` breaks function-form `setState` contract for existing callers

**Severity:** Warning (API regression)
**Files:** `src/context/BillingContext.js:105-116`

`setBillingData` is wrapped as `updateBillingDataState`, which persists via `saveBillingData(next)` — good. But it calls `setBillingData(prev => …)` internally and then `saveBillingData(next)` **outside** React's state queue semantics while exposing a raw `useState`-compatible name. Two issues:

1. It is **not referentially stable against `prev` races**: `typeof updater === "function" ? updater(prev) : updater` recomputes from the closure's `prev` — fine — but the exposed signature accepts both object and function, so existing screens doing `setBillingData({...billingData, x})` with a stale closure still silently drop the other domain's concurrent changes.
2. Side effect (`saveBillingData`) now runs **inside** the state updater execution path; React may invoke updaters twice in StrictMode/dev double-render, causing double writes (harmless but noisy), and the returned promise isn't awaited anywhere.

Most importantly: `App.js:508-511` still runs its own `saveBillingData(billingData)` effect, so billing is persisted twice per change through two different state snapshots — a stale-write race between App's effect (App's local `billingData`) and the context (context billing state). App's local `billingData` is boot-loaded and passed in, but BillingScreen writes through context only; App's effect then persists the old object.

**Fix:** Remove App.js's `saveBillingData` effect (context owns persistence) and let `updateBillingDataState` be the only writer.

---

## Info Findings

### I-01 — Initial-state props use "only if non-empty" sync, so clearing all data never propagates
`src/context/TaskContext.js:42-54`, `src/context/VaultContext.js:22-35`, `src/context/BirthdayContext.js:17-24`

`if (initialTasks.length > 0) setTasks(initialTasks)` — a legitimate empty array (e.g. after `handleResetData` clears App state) never reaches the context; providers keep stale data. Consider syncing unconditionally or exposing explicit `reset()` actions on the contexts (App's `handleResetData` currently does not touch any context — another split-brain path).

### I-02 — `handleSaveTask` closes over `tasks`, staleness + re-subscription churn
`src/context/TaskContext.js:213-244` — `useCallback([tasks])` recreates the callback on every task change, invalidating memoized consumers and racing with concurrent saves. Read current state via the functional `setTasks` updater (find existing by id inside the updater) instead.

### I-03 — `saveTask` id generation can collide; `createTaskList` uses `Date.now()` alone
`src/utils/taskMutations.js:166,245` — `Date.now().toString()` for task ids vs widget spawn ids (`Date.now() + random`). Two tasks saved in the same millisecond (AI extraction loop `onTasksExtracted` creates N tasks in one batch via `handleSaveTask`) can collide since `handleSaveTask` doesn't generate ids — `Date.now().toString()` default applies per call in the same tick. Use the same `Date.now() + Math.random()` scheme everywhere (extract a `generateId()` helper).

### I-04 — `deleteTaskList` deletes tasks' parent list but leaves tasks orphaned; App.js's version cancelled their notifications
`src/utils/taskMutations.js:257-266` vs `App.js:907-922` — App.js's (dead) copy cancels `notificationId`s for tasks in the deleted list; the shared mutation (and the context path actually used by the app) does not delete those tasks at all — they remain in the tasks array pointing at a nonexistent `listId`. Verify intended behavior; at minimum document that task cleanup happens elsewhere, or move notification cancellation into TaskContext's `handleDeleteList`.

### I-05 — Console logging of user content and noisy emoji logs in new code
`src/context/TaskContext.js:79`, `src/context/VaultContext.js:57,71`, `src/utils/taskMutations.js` none — but TaskContext logs on every sync. Phase 19 will strip these; until then, avoid logging parsed content (currently only logs counts/messages — fine, keep it that way). Minor: `console.log("🔄 Synchronized tasks from storage update")` fires on every foreground with changes.

---

## Positive Observations

- **`taskMutations.js` is exemplary**: pure, framework-agnostic, exhaustive JSDoc, covered by 15 focused unit tests including the tricky progressive-recurrence title increment and invalid-date fallbacks.
- **Widget parity is real**: `widget-task-handler.tsx` now delegates to the same `toggleTask` with explicit `now`/`todayDate`, and the ticking-animation pre-render + 600ms wait is preserved. The `isTicking` flag cleanly doesn't leak into persistence (spread before mutation, then replaced).
- **Context fallback pattern** (`taskCtx?.x ?? prop`) in `AppNavigator` is a pragmatic migration bridge — the right call for incremental extraction, provided the fallbacks get deleted once App.js stops passing dead handlers (see C-02).
- **Date engine reuse** (`getLocalDateString`) in both context and widget keeps Phase 15's timezone guarantees intact across the new paths.

---

## Recommended Action Order

1. **C-01** — hoist `TaskEditModal` into AppNavigator (finishes ARCH-01).
2. **C-02** — delete App.js duplicate task handlers + navigator prop fallbacks (finishes ARCH-02).
3. **W-01/W-02** — pick single persistence owner; eager-write task mutations.
4. **W-03** — remove App.js billing save effect.
5. **I-01..I-05** — opportunistically, or defer to Phase 18/19 planning.

Estimated fix effort: C-01 (~30 min), C-02 (~1 h, mostly deletion + test re-run), W-01/W-02 (~2 h with care around AppState timing), W-03 (~15 min).

---

## Test Coverage Gaps Observed

- No test exercises the navigator's context-vs-prop precedence (would have caught C-01/C-02 immediately).
- No test for `refreshTasksFromStorage` **overwriting unsaved in-memory mutations** (W-02's lossy path).
- No test that a recurring task spawned by the widget is picked up by app foreground sync with its new `notificationId` scheduling (integration seam between TaskContext, notifications, and widget handler).
