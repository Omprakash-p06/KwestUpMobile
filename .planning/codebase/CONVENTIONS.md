# Coding Conventions

**Analysis Date:** 2026-10-11

## Naming Patterns

**Files:**
- Use `camelCase.js` for utilities, components, screens, and contexts: `src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/components/ErrorBoundary.js`, `src/screens/BillingScreen.js`, `src/context/TaskContext.js`
- Use `camelCase.ts` for behavior engines and typed services: `src/behavior/eventBus.ts`, `src/behavior/habitEngine.ts`, `src/behavior/cueEngine.ts`, `src/services/notificationService.ts`
- Type declaration files are always colocated `types.ts`: `src/behavior/types.ts`, `src/services/types.ts`, `src/commands/types.ts`
- Test files mirror the source module name plus `.test.js`/`.test.ts`: `__tests__/unit/logger.test.js` ↔ `src/utils/logger.js`, `__tests__/unit/eventBus.test.ts` ↔ `src/behavior/eventBus.ts`
- Shared UI primitives use a `Custom*` prefix: `src/components/CustomButton.js`, `src/components/CustomCard.js`, `src/components/CustomTextInput.js`, `src/components/CustomDateTimePicker.js`

**Functions:**
- Use `camelCase` verb-first names for all functions: `getLocalDateString`, `parseLocalDate`, `toggleTask`, `calculateNextRecurrence`, `saveTask`, `scheduleDueDateReminder`, `migrateUserDataIfNeeded`
- Use `handle*` for component event handlers: `handleRetry`, `handleCopyReport`, `handleRestartPrompt`, `handlePress` (`src/components/ErrorBoundary.js`, `src/components/CustomButton.js`)
- Use `validate*` for synchronous validators that throw on invalid input: `validateSyncConfig`, `validateSyncPayload` (`src/utils/syncService.js`)
- Use `is*`/`has*`/`get*` for predicates and accessors: `isUserDataKey`, `isSameLocalDay`, `isDevelopment`, `getRecentLogs`, `getVaults`
- Async storage/service functions are `async` verbs returning promises: `clearAllCaches`, `getAllNotesFromFilesystem`, `packVaults`, `exportArchive`

**Variables:**
- Use `camelCase` for locals, state, and props: `updatedTasks`, `toggledTask`, `spawnedTask`, `taskLists`, `modalVisible`, `copiedToast`
- Use `UPPER_SNAKE_CASE` for module constants: `MAX_LOG_BUFFER_SIZE` (`src/utils/logger.js`), `MAX_EVENT_BUFFER_SIZE` (`src/behavior/eventBus.ts`), `APP_VERSION`, `STORAGE_VERSION` (`src/utils/storage.js`), `DEFAULT_TASKS`, `DEFAULT_TASK_LISTS` (`src/context/TaskContext.js`), `MAX_REPORT_CHARS` (local cap in `src/components/ErrorBoundary.js`)
- Destructure context values and props with the same `camelCase` names: `const { tasks, toggleTaskComplete } = useTasks()`
- Prefix intentionally-unused function args with `_` (enforced by lint `argsIgnorePattern: '^_'` in `eslint.config.js`)

**Types:**
- Use `PascalCase` for interfaces, types, and classes: `Habit`, `Cue`, `Identity`, `DomainEvent`, `DomainEventBus`, `EventBus`, `ErrorBoundary` (`src/behavior/types.ts`, `src/behavior/eventBus.ts`, `src/components/ErrorBoundary.js`)
- Use `PascalCase` string-union literals for domain enums: `HabitFrequency = 'daily' | 'weekdays' | ...`, `HabitStatus = 'active' | 'paused' | 'archived' | 'recovery'` (`src/behavior/types.ts`)
- Use `UPPER_SNAKE_CASE` string literals for domain event types: `'TASK_CREATED'`, `'TASK_COMPLETED'`, `'BILL_PAID'`, `'HABIT_COMPLETED'` (emitted via `eventBus.emit` in `src/context/TaskContext.js`, asserted in `__tests__/unit/eventBus.test.ts`)

## Code Style

**Formatting:**
- No Prettier config in repo (no `.prettierrc*` / `prettier*` key in `package.json`) — ESLint is the single style authority
- 2-space indentation, semicolons required, ES modules only (`import`/`export` — no `require` except inside `jest.setup.js` mocks and test-only `require('../../babel.config')`)
- Double quotes are the dominant convention in `.js` source (`src/context/*.js`, `src/components/*.js`, `App.js`); single quotes dominate `.ts` behavior files (`src/behavior/*.ts`) — match the surrounding file when editing
- `StyleSheet.create({...})` object declared at the bottom of every component file: `src/components/ErrorBoundary.js:301`, `src/components/CustomButton.js:68`, `src/components/TaskCard.js:243`
- Keep line length reasonable; multi-line JSX props one-per-line for readability (see `src/components/ErrorBoundary.js:181-186`)

**Linting:**
- Flat config `eslint.config.js` is authoritative (legacy `.eslintrc.js` retained for older tooling — keep both in sync when changing rules)
- Ignored paths: `node_modules/**`, `.expo/**`, `dist/**`, `web-build/**`, `android/**`, `ios/**`, `assets/**`, `KwestUpPC/**`, `coverage/**` (`eslint.config.js:8`)
- Key rules to obey:
  - `'react-hooks/rules-of-hooks': 'error'` — never call hooks conditionally or outside components/hooks
  - `'react-hooks/exhaustive-deps': 'warn'` — list all reactive deps in `useEffect`/`useCallback`
  - `'no-console': 'warn'` — never commit raw `console.*`; use `src/utils/logger.js`
  - `'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]` — prefix unused params with `_`
  - `'react-native/no-unused-styles': 'warn'`, `'react-native/no-inline-styles': 'warn'` — prefer `StyleSheet.create`, avoid inline style objects in render
  - `'react-native/no-color-literals': 'warn'` — prefer theme tokens from `src/theme/colors.js`
  - `'react/prop-types': 'off'`, `'react/react-in-jsx-scope': 'off'` — no propTypes, no `React` import required for JSX scope
- Run `npm run lint` before every commit (also enforced by `check.bat`); `npm run lint:report` writes `eslint-report.json`

## Import Organization

**Order:**
1. `react` and framework imports first: `import React, { ... } from "react"`
2. `react-native` core second: `import { View, Text, StyleSheet } from "react-native"`
3. Third-party / Expo packages third, grouped: `@react-navigation/*`, `@expo/vector-icons`, `expo-haptics`, `@react-native-async-storage/async-storage`, `react-native-modal`
4. Internal relative imports last, ordered parent-to-sibling: `../utils/*`, `../services/*`, `../behavior/*`, `../components/*`, `./types`

```javascript
// Pattern from src/context/TaskContext.js:1-22
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { toggleTask, completeTask, saveTask, /* ... */ } from "../utils/taskMutations";
import { scheduleDueDateReminder, /* ... */ } from "../services/notificationService";
import { STORAGE_VERSION } from "../utils/storage";
import { logger } from "../utils/logger";
import { eventBus } from "../behavior/eventBus";
```

**Path Aliases:**
- None. There are no `tsconfig.json` `paths` or babel module-resolver aliases — always use explicit relative imports (`../utils/logger`, `./types`, `../../src/utils/dateUtils` in tests)
- Never use absolute `src/...` imports; tests import via `../../src/...` relative paths

## Error Handling

**Patterns:**
- Wrap every `async` storage/filesystem/network boundary in `try/catch`, log with `logger.error`, and return a safe fallback — never let the rejection propagate to the UI unhandled:
```javascript
// Pattern from src/utils/storage.js:30-71
export const clearAllCaches = async () => {
  logger.info("🧹 STARTING COMPREHENSIVE CACHE CLEAR...");
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    // ... mutation ...
    return true;
  } catch (error) {
    logger.error("❌ CACHE CLEAR FAILED:", error);
    return false;
  }
};
```
- Synchronous validators throw `new Error(...)` with a namespaced message prefix so callers and tests can match on substrings. Use this pattern for all new validators:
```javascript
// Pattern from src/utils/syncService.js:34-60
export const validateSyncConfig = (config) => {
  if (!config || typeof config !== "object") {
    throw new Error("Invalid sync configuration: config must be an object.");
  }
  if (!isValid) {
    throw new Error(`Invalid sync configuration: IP address or hostname "${ip}" is malformed.`);
  }
  // ...
};
```
- Pure parsers return sentinel values instead of throwing: `parseLocalDate` returns `new Date(NaN)` for invalid input, `getLocalDateString` returns `''` (`src/utils/dateUtils.js`); `pingSyncServer` returns `false` when fetch throws (`src/utils/syncService.js`); `deleteTaskList` refuses `default_inbox` by returning `{ updatedTaskLists, deletedList: null }` (`src/utils/taskMutations.js:286-293`)
- Isolate listener/subscriber failures so one bad consumer never breaks the bus: `try/catch` sync listeners and `.catch()` async rejections, logging via `logger.error('EventBus listener error:', ...)` (`src/behavior/eventBus.ts:178-220`)
- Use `ErrorBoundary` (`src/components/ErrorBoundary.js`) at screen-tree roots; `componentDidCatch` must call `logger.error("Unhandled React Error:", ...)` and offer Try-Again + Copy-Error-Report recovery actions
- Provide degraded fallbacks in nested `try/catch`: `deepClone` falls back from `structuredClone` to JSON clone (`src/behavior/eventBus.ts:28-38`); clipboard copy falls back to `Share.share` (`src/components/ErrorBoundary.js:99-117`)
- Use bare `catch {` (no binding) when the error value is unused; bind `catch (error)` / `catch (err)` only when logging or rethrowing it

## Logging

**Framework:** `src/utils/logger.js` — the only approved logging surface. Never call raw `console.*` in `src/` or `App.js` (ESLint `no-console: warn`, plus `babel.config.js` strips `console.log/info/debug` from production bundles via `transform-remove-console`, keeping only `warn`/`error`).

**Patterns:**
- Import once per module: `import { logger } from "../utils/logger";` (or named `debug/info/warn/error`)
- `logger.debug` / `logger.info` for dev-only diagnostics (silenced AND unbuffered in production); `logger.warn` / `logger.error` for operational signal (always buffered + passthrough):
```javascript
// Pattern from src/utils/storage.js and src/utils/syncService.js
logger.info("✅ Cleared KwestUp storage keys:", kwestupKeys);
logger.debug("📋 Found AsyncStorage keys:", allKeys);
logger.error("❌ CACHE CLEAR FAILED:", error);
```
- Prefix operational messages with an emoji status marker (`🧹`, `✅`, `❌`, `🔍`, `📦`, `🌐`, `ℹ️`) so device logs stay greppable — follow the existing vocabulary in `src/utils/storage.js` and `src/utils/syncService.js`
- Pass `Error` instances (not just `.message`) as detail args — the logger serializes `name/message/stack/cause` with cycle guards, depth caps, length caps, and key-based PII redaction (`src/utils/logger.js:37-81`)
- The only file allowed `/* eslint-disable no-console */` is `src/utils/logger.js:1` itself
- For crash forensics, attach breadcrumbs with `logger.warn/error` and read them back with `logger.getRecentLogs()` / reset with `logger.clearLogs()` (consumed by `src/components/ErrorBoundary.js:70-97`)

## Comments

**When to Comment:**
- Every module opens with a banner header: title + `===` underline + 2-4 lines of purpose, sharing, and invariants:
```javascript
/**
 * Pure Task Mutation Engine
 * ==========================
 * Framework-agnostic, pure functions for all task transformations, recurrence
 * calculations, subtask mutations, and list management.
 *
 * Shared across:
 *  - Headless Android widget task handler (widgets/widget-task-handler.tsx)
 *  - Interactive application state (TaskContext.js / App.js)
 */
```
- Explain *why*, not *what*, inline — especially threading/debounce hazards, StrictMode double-invoke guards, and residual risks (see the `W-01/W-02` block in `src/context/TaskContext.js:64-72`)
- Tag traceability IDs inline when implementing review/spec items so audits stay greppable: `WR-02`, `WR-04`, `CR-01`, `CR-02`, `OBS-01`, `TC-EVT-01` (examples in `src/utils/logger.js`, `src/behavior/eventBus.ts`, `src/components/ErrorBoundary.js`)

**JSDoc/TSDoc:**
- Document every exported util/service function with JSDoc `@param`, `@returns`, and `@throws` where applicable. This is mandatory, not optional — all of `src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/utils/syncService.js`, `src/utils/exportService.js`, `src/utils/vaultImport.js`, `src/utils/fileStorage.js` follow it:
```javascript
/**
 * Toggles a task's completion status.
 * If the task is recurring and transitioning from incomplete to complete,
 * it replaces the task with the newly spawned recurrence occurrence.
 *
 * @param {Array<Object>} tasks - List of tasks
 * @param {string} taskId - ID of task to toggle
 * @param {Object} [options={}] - Optional overrides { now, todayDate }
 * @returns {{ updatedTasks: Array<Object>, toggledTask: Object|null, spawnedTask: Object|null }}
 */
export const toggleTask = (tasks = [], taskId, options = {}) => { /* ... */ };
```
- TypeScript behavior files use TSDoc on exported functions plus inline interface docs (`src/behavior/eventBus.ts:14-17`, `src/behavior/habitEngine.ts:1-9`)

## Function Design

**Size:** Keep functions small and single-purpose. Pure transforms live in `src/utils/` (`taskMutations.js` averages ~20 lines per function); side-effectful orchestration lives in contexts/services. Extract a helper rather than growing a function past ~60 lines.

**Parameters:** Use an trailing `options = {}` bag for test-injectable overrides (`now`, `todayDate`) instead of calling `Date.now()` / `new Date()` deep inside logic — this is what makes time-dependent code unit-testable without fake timers:
```javascript
// Pattern from src/utils/taskMutations.js:21,76,119
export const calculateNextRecurrence = (task, now = new Date().toISOString()) => { /* ... */ };
export const toggleTask = (tasks = [], taskId, options = {}) => {
  const now = options.now || new Date().toISOString();
  const todayDate = options.todayDate || getLocalDateString();
```
- Default collection params to empty arrays (`tasks = []`, `taskLists = []`) so callers can omit them safely

**Return Values:** Pure mutations return a result object naming each output — never mutate inputs, always spread-copy:
```javascript
// Pattern from src/utils/taskMutations.js:108,138,181,193
return { updatedTasks, toggledTask, spawnedTask };
return { updatedTasks, completedTask };
return { updatedTasks, savedTask };
return { updatedTasks, deletedTask };
```
- Async services return `true`/`false` (or `null` on failure) rather than throwing for expected failure modes (`clearAllCaches`, `pingSyncServer` in `src/utils/storage.js`, `src/utils/syncService.js`)

## Module Design

**Exports:** Use named `export const` / `export function` for every public symbol; add a `default` export only for the primary component, singleton, or convenience namespace:
- Utils: named function exports + default namespace object (`src/utils/dateUtils.js:166-174`)
- Singletons: named helpers + default instance (`export const eventBus = new EventBus(); export default eventBus;` in `src/behavior/eventBus.ts:272-299`; same shape for `logger` in `src/utils/logger.js:183-194`)
- Components: `export class ErrorBoundary` + `export default ErrorBoundary` (`src/components/ErrorBoundary.js`); `export const CustomButton` for leaf primitives (`src/components/CustomButton.js:6`)
- Constants that other modules need (keys, versions, limits) must be exported, never duplicated: `APP_VERSION`, `STORAGE_VERSION` (`src/utils/storage.js:4-5`), `MAX_LOG_BUFFER_SIZE`, `MAX_EVENT_BUFFER_SIZE`
- Keep state immutable at module boundaries: deep-clone inputs and deep-freeze outputs for shared event/log buffers (`deepClone`/`deepFreeze` in `src/behavior/eventBus.ts:28-55`, `src/utils/logger.js:116-134`)

**Barrel Files:** None detected — there are no `index.js` re-export barrels in `src/`. Import directly from the owning module (`../utils/taskMutations`, `../behavior/eventBus`, `../../src/services/notificationService`). Do not introduce barrels without updating `STRUCTURE.md`.

---

*Convention analysis: 2026-10-11*
