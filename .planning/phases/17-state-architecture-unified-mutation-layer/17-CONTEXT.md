# Phase 17: State Architecture & Unified Mutation Layer - Context

**Gathered:** 2026-09-27  
**Status:** Ready for planning  

<domain>
## Phase Boundary

Decouple the monolithic state in `App.js` into modular domain contexts and unify task recurrence and completion mutations between the React Native app and Android home-screen widgets.
1. Build a pure, framework-agnostic task mutation engine (`src/utils/taskMutations.js`) containing authoritative logic for task toggling, completion, progressive/standard recurrence, and list management.
2. Integrate the shared mutation engine into `widgets/widget-task-handler.tsx`, eliminating duplicate mutation logic between headless background widget execution and the interactive UI.
3. Establish domain React Context providers (`TaskContext`, `VaultContext`, `BillingContext`, `BirthdayContext`) to decompose `App.js`, eliminating ~50 prop-drilled arguments from `AppNavigator.js`.
4. Implement automatic foreground synchronization via `AppState` so widget-driven `AsyncStorage` updates instantly reflect in the running app when brought to the foreground.

</domain>

<decisions>
## Implementation Decisions

### Shared Pure Mutation Engine (ARCH-02)
- **D-01:** Implement `src/utils/taskMutations.js` as pure functions with zero React or native dependencies. Functions accept data arrays and options (`now`, `todayDate`), and return immutable updated structures:
  - `toggleTask(tasks, taskId, options)`
  - `calculateNextRecurrence(task, now)`
  - `completeTask(tasks, taskId, options)`
  - `saveTask(tasks, taskData, options)`
  - `deleteTask(tasks, taskId)`
  - `toggleSubtask(tasks, taskId, subtaskIdx, options)`
  - `createTaskList(taskLists, name)`
  - `renameTaskList(taskLists, listId, newName)`
  - `deleteTaskList(taskLists, listId)`
- **D-02:** Support all recurrence patterns with behavioral parity:
  - `daily`: +1 day
  - `weekly`: +7 days
  - `monthly`: +1 month
  - `progressive`: +1 day with auto-incremented trailing numeric title (e.g., `"Day 1"` -> `"Day 2"`, `"Workout"` -> `"Workout - 2"`).
- **D-03:** Refactor `widgets/widget-task-handler.tsx` to import and call `toggleTask` from `src/utils/taskMutations.js` directly, guaranteeing identical recurrence behavior between app and home-screen widgets.

### Domain Context Providers & App.js Decoupling (ARCH-01)
- **D-04:** Create `src/context/TaskContext.js`:
  - Owns `tasks`, `taskLists`, `dailyTasks`, `selectedTask`, `modalVisible`.
  - Wraps `taskMutations.js` and coordinates side effects (notification scheduling via `notifications.js` and storage persistence via `storage.js`).
  - Implements `refreshTasksFromStorage()` to re-hydrate state from `AsyncStorage`.
  - Exposes `useTasks()` hook for consumer components and screens.
- **D-05:** Create `src/context/VaultContext.js`:
  - Owns `vaults`, `activeVaultId`, `notes`, `activeNote`.
  - Manages vault CRUD and note filesystem operations (`fileStorage.js`, `vaultService.js`).
  - Exposes `useVaults()` hook.
- **D-06:** Create `src/context/BillingContext.js`:
  - Owns `billingData`.
  - Coordinates transactions, budgets, and recurring bills via `billingStorage.js` and `billingNotifications.js`.
  - Exposes `useBilling()` hook.
- **D-07:** Create `src/context/BirthdayContext.js`:
  - Owns `birthdays`.
  - Coordinates birthday storage and reminder scheduling via `notifications.js`.
  - Exposes `useBirthdays()` hook.
- **D-08:** Wrap `AppNavigator` with `<TaskProvider>`, `<VaultProvider>`, `<BillingProvider>`, `<BirthdayProvider>` in `App.js`.
- **D-09:** Add `AppState.addEventListener('change', ...)` in `TaskContext` (or `App.js`) to automatically trigger `refreshTasksFromStorage()` when the app transitions to `active`, eliminating stale task views after widget interactions.

</decisions>

<canonical_refs>
## Canonical References

### Requirements
- `ARCH-01`: Decouple monolithic state and callbacks from `App.js` into dedicated domain stores/context providers.
- `ARCH-02`: Unify task recurrence and completion mutations into a single authoritative data mutation layer shared between app and home-screen widgets.

### Codebase Audits
- `.planning/codebase/ARCHITECTURE.md` § Pattern Overview — Details monolithic `App.js` and ~50 prop-drilled context variables.
- `.planning/codebase/CONCERNS.md` § Tech Debt — "Root App.js is a state monolith" and "Recurrence / toggle logic is duplicated across app and widget".
- `.planning/debug/remaining-phases-codemap-audit.md` § Phase 17 — Details headless widget background execution constraint and pure function requirement.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dateUtils.js`: `getLocalDateString()`, `getYesterdayLocalDateString()` for local timezone compliance.
- `notifications.js`: `scheduleDueDateNotification`, `cancelDueDateNotification`.
- `storage.js`: `STORAGE_VERSION = "v7.0"`, storage persistence keys.
- Jest test environment configured with native mocks (`npm test`).

### Target Modules
- `src/utils/taskMutations.js` (NEW)
- `widgets/widget-task-handler.tsx`
- `src/context/TaskContext.js` (NEW)
- `src/context/VaultContext.js` (NEW)
- `src/context/BillingContext.js` (NEW)
- `src/context/BirthdayContext.js` (NEW)
- `src/navigation/AppNavigator.js`
- `App.js`

</code_context>

---

*Phase: 17-state-architecture-unified-mutation-layer*  
*Context gathered: 2026-09-27*
