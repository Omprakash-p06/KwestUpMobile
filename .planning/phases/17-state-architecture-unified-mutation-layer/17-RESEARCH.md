# Phase 17: State Architecture & Unified Mutation Layer - Research

**Date:** 2026-09-27  
**Target:** React Native 0.79.5 / Expo 53 / React 19 / TypeScript 5.8 / Node 20  
**Requirements:** ARCH-01, ARCH-02  

---

## 1. Executive Summary

Phase 17 addresses the primary structural bottleneck of KwestUp Mobile:
1. **The `App.js` Monolith:** `App.js` currently spans 1,269 lines, housing 20+ `useState` variables, direct notification lifecycle management, persistence orchestration, dialogs, and recurrence logic. Over 50 context variables are prop-drilled through `AppNavigator.js` into 9 screens.
2. **Duplicated Mutation Logic in Headless Widgets:** Android home-screen widgets (`widgets/widget-task-handler.tsx`) execute in a headless background service. The recurrence calculation, title incrementation, and completion logic are duplicated inline with slight behavioral variances from `App.js`.
3. **App-Widget Storage Desynchronization:** When tasks are toggled via home-screen widgets, `AsyncStorage` is updated directly. Because `App.js` never subscribed to `AppState` foreground events, the running app maintained stale in-memory state until restarted.

---

## 2. Headless Widget Execution & Pure Mutation Architecture (ARCH-02)

### The Headless Constraint
`widgets/widget-task-handler.tsx` is registered via `registerWidgetTaskHandler` in `index.js`. When a user clicks a checkbox on the Android home-screen widget, Android invokes the handler inside a headless React Native environment without mounting UI components.
- **Rules:**
  - Cannot use React Hooks (`useState`, `useEffect`, `useContext`).
  - Cannot access React Context providers.
  - Must remain fast and lightweight to prevent Android Application Not Responding (ANR) timeouts.

### Pure Function Solution
By creating `src/utils/taskMutations.js` as a pure, dependency-free JavaScript module, both the headless background widget and interactive React Context can import and execute identical logic.

```
┌────────────────────────────────────────────────────────┐
│               src/utils/taskMutations.js               │
│  - toggleTask(tasks, taskId, options)                  │
│  - calculateNextRecurrence(task, now)                  │
│  - completeTask(tasks, taskId, options)                │
│  - saveTask(tasks, taskData)                           │
│  - deleteTask(tasks, taskId)                           │
│  - toggleSubtask(tasks, taskId, subtaskIdx, options)   │
│  - createTaskList(taskLists, name)                     │
│  - renameTaskList(taskLists, listId, newName)          │
│  - deleteTaskList(taskLists, listId)                   │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
       calls pure functions     calls pure functions
                │                        │
┌───────────────┴────────┐      ┌────────┴───────────────┐
│ widgets/               │      │ src/context/           │
│ widget-task-handler    │      │ TaskContext.js         │
│ (Headless Background)  │      │ (Interactive UI State) │
└────────────────────────┘      └────────────────────────┘
```

### Recurrence Computation Specification
- **Daily:** `date.setDate(date.getDate() + 1)`
- **Weekly:** `date.setDate(date.getDate() + 7)`
- **Monthly:** `date.setMonth(date.getMonth() + 1)`
- **Progressive:** `date.setDate(date.getDate() + 1)` and increments the last number in the title:
  - If title is `"Sprint 1"`, next title becomes `"Sprint 2"`.
  - If title is `"Day 99"`, next title becomes `"Day 100"`.
  - If title has no number (e.g. `"Workout"`), next title becomes `"Workout - 2"`.
- When a recurring task is completed:
  - The parent completed task is removed from active tasks (as implemented in `App.js` and `widget-task-handler.tsx`).
  - A new uncompleted task is spawned with `id: Date.now().toString() + Math.random().toString(36).slice(2)`, `completed: false`, `completedDate: null`, `completedAt: null`, `notificationId: null`, and the newly calculated `dueDate` and `title`.

---

## 3. Domain State Decomposition (ARCH-01)

### Decomposition Map

| Domain Context | Managed State | Encapsulated Logic & Side Effects | Extracted from `App.js` |
| :--- | :--- | :--- | :--- |
| **`TaskContext`** | `tasks`, `taskLists`, `dailyTasks`, `selectedTask`, `modalVisible` | Task toggle, recurrence, complete, delete, save, notification schedule/cancel, subtasks, task list CRUD, foreground sync | ~350 lines |
| **`VaultContext`** | `vaults`, `activeVaultId`, `notes`, `activeNote` | Vault switching, vault CRUD, note filesystem reads/writes (`fileStorage.js`, `vaultService.js`) | ~180 lines |
| **`BillingContext`**| `billingData` | Transactions, budgets, recurring bills, bill reminders (`billingStorage.js`, `billingNotifications.js`) | ~120 lines |
| **`BirthdayContext`**| `birthdays` | Birthday CRUD, custom reminder notification scheduling (`notifications.js`) | ~90 lines |

### App-Widget Synchronization via AppState
In `TaskContext`:
```javascript
useEffect(() => {
  const subscription = AppState.addEventListener("change", async (nextAppState) => {
    if (nextAppState === "active") {
      await refreshTasksFromStorage();
    }
  });
  return () => subscription.remove();
}, [refreshTasksFromStorage]);
```
`refreshTasksFromStorage` reads `kwestup_data_${STORAGE_VERSION}`. If the stored task array differs from in-memory state (comparing task lengths and last modified/completed timestamps), it updates `tasks` and `taskLists`, instantly reflecting widget updates in the UI.

---

## 4. Migration Strategy & Zero Regressions

To maintain zero regressions during refactoring:
1. **Incremental Providers:** Create the four context providers with custom hooks (`useTasks`, `useVaults`, `useBilling`, `useBirthdays`).
2. **Hybrid Screen Consumption:**
   Screens can consume domain hooks (`useTasks()`) while preserving prop fallbacks (`tasks = propTasks || contextTasks`).
3. **Streamlined `AppNavigator`:**
   Remove the 52 prop declarations from `AppNavigator.js` that are now served by Context, keeping only theme and navigation controls (`currentTheme`, `themeMode`, `setThemeMode`, etc.).
4. **App.js Shrinkage:**
   `App.js` reduces from 1,269 lines to a clean root orchestrator (~450 lines) focused on boot initialization, theme management, and top-level modals.

---

## 5. Verification Plan

1. **Unit Testing (`taskMutations.test.js`):**
   - 10+ unit tests testing `toggleTask`, `calculateNextRecurrence`, `completeTask`, `saveTask`, `deleteTask`, `toggleSubtask`, and `createTaskList`.
2. **Context Testing (`taskContext.test.js`):**
   - Test `TaskProvider` rendering, actions, and `refreshTasksFromStorage` synchronization.
3. **Full Suite & Lint Verification:**
   - Run `npm test` (all 8 test suites passing).
   - Run `npm run lint` (0 errors).
