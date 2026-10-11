# Coding Conventions

**Analysis Date:** 2026-10-12

## Naming Patterns

**Files:**
- Use PascalCase for components, screens, and navigation: `src/components/CustomButton.js`, `src/components/ErrorBoundary.js`, `src/screens/TaskListScreen.js`, `src/navigation/AppNavigator.js`
- Use camelCase for utilities, services internals, and hooks: `src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/utils/syncService.js`, `src/utils/logger.js`
- Use camelCase for TypeScript engine modules: `src/behavior/eventBus.ts`, `src/services/notificationService.ts`, `src/ai/weeklyReviewEngine.ts`, `src/commands/useCommandGateway.ts`
- Use kebab/camel test mirror naming: `__tests__/unit/<module>.test.js` mirrors `src/utils/<module>.js` (e.g. `__tests__/unit/dateUtils.test.js` → `src/utils/dateUtils.js`, `__tests__/unit/taskMutations.test.js` → `src/utils/taskMutations.js`)
- Use lowercase hyphenated keys for storage constants, SCREAMING_SNAKE for exported constants: `MAX_LOG_BUFFER_SIZE` in `src/utils/logger.js`, `MAX_EVENT_BUFFER_SIZE` in `src/behavior/eventBus.ts`, `STORAGE_VERSION` / `APP_VERSION` in `src/utils/storage.js`

**Functions:**
- Use camelCase verb-first names: `getLocalDateString`, `parseLocalDate`, `toggleTask`, `saveTask`, `pingSyncServer`, `performSync`, `validateSyncConfig` (`src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/utils/syncService.js`)
- Use `handle*` prefix for context/component event handlers: `handleSaveTask`, `handleCompleteTask`, `handleCopyReport`, `handleRetry`, `handleRestartPrompt` (`src/context/TaskContext.js`, `src/components/ErrorBoundary.js`)
- Use `get*` / `set*` / `ensure*` for storage and filesystem accessors: `getVaults`, `setActiveVaultId`, `ensureVaultsDir`, `getAllNotesFromFilesystem`, `getRecentLogs`, `clearLogs` (`src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/logger.js`)

**Variables:**
- Use camelCase for locals and state: `updatedTasks`, `spawnedTask`, `snapshotJson`, `storageWriteTimerRef`, `tasksHydratedRef` (`src/utils/taskMutations.js`, `src/context/TaskContext.js`)
- Use `*_ref`-style `useRef` names for mutable refs: `storageWriteTimerRef`, `lastPersistedJsonRef`, `tasksHydratedRef` (`src/context/TaskContext.js`)
- Prefix intentionally-unused function args with underscore (enforced by lint): `argsIgnorePattern: '^_'` in `eslint.config.js`; example `catch {` / empty `() => {}` callbacks in `src/context/TaskContext.js`

**Types:**
- Use PascalCase for interfaces and type names in `.ts` files: `DomainEvent`, `DomainEventBus`, `DomainEventInput`, `Habit`, `BehaviorEvent` (`src/behavior/types.ts`, `src/behavior/eventBus.ts`, `src/ai/types.ts`)
- Use SCREAMING_SNAKE regex constants for validation: `SENSITIVE_KEYS`, `MAX_STRING_CHARS`, `MAX_ARRAY_ITEMS` (`src/utils/logger.js`)

## Code Style

**Formatting:**
- No Prettier, Biome, or EditorConfig in repo (verified 2026-10-12) — follow existing file style manually
- `.js` sources use double quotes, semicolons, 2-space indent, trailing commas in multiline literals: see `src/utils/syncService.js`, `src/context/TaskContext.js`, `src/components/CustomButton.js`
- `.ts` sources use single quotes, semicolons, 2-space indent: see `src/behavior/eventBus.ts`, `src/services/notificationService.ts`
- Keep line length reasonable; break long JSX props one-per-line as in `src/components/ErrorBoundary.js`

**Linting:**
- Primary config is flat config `eslint.config.js` (ESLint 9); legacy `.eslintrc.js` is kept in parallel — keep both in sync when adding rules
- Ignored paths: `node_modules/**`, `.expo/**`, `dist/**`, `web-build/**`, `android/**`, `ios/**`, `assets/**`, `coverage/**` (`eslint.config.js`)
- Key rules to obey:
  - `react-hooks/rules-of-hooks: error` — never call hooks conditionally (`eslint.config.js:39`)
  - `react-hooks/exhaustive-deps: warn` — include all deps or document why not
  - `no-unused-vars: warn` with `argsIgnorePattern: '^_'` — prefix unused args with `_`
  - `no-console: warn` — never call `console.*` in product code; use `src/utils/logger.js` instead (only `src/utils/logger.js` carries `/* eslint-disable no-console */`)
  - `react-native/no-inline-styles: warn`, `react-native/no-unused-styles: warn`, `react-native/no-color-literals: warn` — define all styles via `StyleSheet.create`, remove dead styles, hoist colors
  - `react/prop-types: off`, `react/react-in-jsx-scope: off` — props are untyped JS, no React import needed for JSX scope
- Run `npm run lint` (plain `eslint .`) and `npm run typecheck` (`tsc --noEmit`, `checkJs: false`) before committing

## Import Organization

**Order:**
1. `react` / React hooks first: `import React, { ... } from "react"` (`src/components/CustomButton.js:1`, `src/context/TaskContext.js:1`)
2. `react-native` primitives second: `import { View, Text, ... } from "react-native"`
3. Third-party Expo / community / navigation packages: `@expo/vector-icons`, `expo-haptics`, `@react-navigation/*`, `@react-native-async-storage/async-storage`
4. Internal relative modules grouped by layer: `../utils/*`, `../context/*`, `../behavior/*`, `../services/*`, `./CustomButton` — logger import comes before domain imports, e.g.:
```javascript
import { STORAGE_VERSION } from "../utils/storage";
import { logger } from "../utils/logger";
import { eventBus } from "../behavior/eventBus";
```
(`src/context/TaskContext.js:20-22`)
5. Type-only imports at top of `.ts` files: `import { Habit, BehaviorEvent } from '../behavior/types'` (`src/ai/weeklyReviewEngine.ts:12`)

**Path Aliases:**
- None configured (`tsconfig.json` extends `expo/tsconfig.base` with no `paths`). Always use relative imports (`../utils/logger`, `../../src/utils/dateUtils`). Do not introduce `@/` aliases without updating `tsconfig.json`, `babel.config.js`, and `jest.config.js` together.

## Error Handling

**Patterns:**
- Validate-then-throw in pure validators; throw `Error` with a namespaced prefix so tests can match substrings:
```javascript
throw new Error(`Invalid sync configuration: port "${port}" is out of bounds (1-65535).`);
throw new Error("Sync API error: Server response missing required 'notes' array.");
```
(`src/utils/syncService.js:34-102`)
- Return safe fallbacks instead of throwing for parse/format utilities: return `''` for bad date input (`src/utils/dateUtils.js:14-48`), return `new Date(NaN)` — never today — for unparseable dates (`src/utils/dateUtils.js:63-86`), return `''` for missing note content (`src/utils/fileStorage.js` via `readNoteFile`)
- Catch async boundaries, log, and either return a safe default or rethrow a user-facing message:
```javascript
export const pingSyncServer = async (config) => {
  try {
    // ... fetch ...
    return data && data.status === "online";
  } catch (error) {
    logger.error("❌ Sync Server Ping Failed:", error);
    return false;
  }
};
```
(`src/utils/syncService.js:107-129`)
- Special-case `AbortError` on timeout fetches and rethrow a friendly timeout message; rethrow all other errors unchanged (`src/utils/syncService.js:188-194`)
- Guard persistence with try/catch + `logger.error`, never let storage failure crash UI: `writeTaskSnapshot` and `refreshTasksFromStorage` in `src/context/TaskContext.js:77-172`
- Swallow only provably-harmless errors with an explicit `// ignore` comment (haptics only):
```javascript
try {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
} catch {
  // ignore
}
```
(`src/context/TaskContext.js:243-247`)
- Use `ErrorBoundary` (`src/components/ErrorBoundary.js`) as the last-resort UI catch: `getDerivedStateFromError` sets `hasError`, `componentDidCatch` calls `logger.error("Unhandled React Error:", ...)`, recovery UI offers Try Again / Copy Error Report / Restart hint

## Logging

**Framework:** Centralized `src/utils/logger.js` — never use raw `console.*` outside that file.

**Patterns:**
- Import and call level methods: `import { logger } from "../utils/logger"` then `logger.info(...)`, `logger.warn(...)`, `logger.error(...)` (`src/context/TaskContext.js:21`, `src/utils/syncService.js:1`)
- `debug`/`info` are dev-only (gated on `__DEV__`, neither emit nor buffer in production); `warn`/`error` always buffer + passthrough (`src/utils/logger.js:142-162`)
- Prefix operational messages with an emoji for greppability: `logger.error("❌ ...")`, `logger.info("✅ ...")`, `logger.info("🌐 ...")`, `logger.info("🔄 ...")` (`src/utils/syncService.js`, `src/context/TaskContext.js`)
- Pass the `Error` object itself as a detail arg — the serializer extracts `name/message/stack/cause`: `logger.error("❌ Sync Server Ping Failed:", error)` (`src/utils/syncService.js:126`)
- Never log PII under raw keys — the serializer redacts `content|body|note|title|text|message|passphrase|token|key|secret|password|habitTitle|cueText` to `[Redacted]` before buffering (`src/utils/logger.js:37-81`); keep using those key names so redaction keeps working
- Babel strips `console.log/info/debug` from production bundles but preserves `error`/`warn` (`babel.config.js:15-17`); `react-native-reanimated/plugin` must stay last in the plugins array (`babel.config.js:20`)

## Comments

**When to Comment:**
- Every exported util function gets a JSDoc block with `@param`/`@returns` describing contract and edge cases:
```javascript
/**
 * Parses a `YYYY-MM-DD` string into a local Date instance set to midnight local time (00:00:00.000).
 * Prevents negative UTC timezone shifts caused by standard ECMAScript UTC midnight parsing.
 *
 * Strict contract: only `YYYY-MM-DD` (validated by regex + component round-trip),
 * ...
 * @param {string|Date|number} dateStr
 * @returns {Date} Local-midnight Date, or Invalid Date if input is not a valid calendar date
 */
```
(`src/utils/dateUtils.js:51-62`, also `src/utils/taskMutations.js:12-20`, `src/utils/syncService.js:26-33`)
- Every file that owns a subsystem gets a banner header comment (`/** ... === ... */`): `src/utils/logger.js:1-11`, `src/utils/dateUtils.js:1-6`, `src/utils/taskMutations.js:1-10`
- Tag non-obvious decisions with review/test-traceability IDs so future agents can find the originating finding: `// WR-01:`, `// WR-02:`, `// CR-01:`, `// CR-02:`, `// OBS-01:` (`src/utils/logger.js`, `src/context/TaskContext.js:195-201`), `// TC-OBS-06:` in tests (`__tests__/unit/errorBoundary.test.js:38`)
- Explain workarounds and residual risk inline where the code cannot be self-evident (boot-guard, debounce, hydration notes in `src/context/TaskContext.js:64-75,102-103`)

**JSDoc/TSDoc:**
- JSDoc is required on all exported functions in `src/utils/*.js` (params, return, throws where applicable). TSDoc-style typed signatures serve the same role in `.ts` files (`src/behavior/eventBus.ts:13-23`). Keep JSDoc in sync with behavior — tests encode the documented contract (e.g. `parseLocalDate` "never today" rule asserted in `__tests__/unit/dateUtils.test.js:89-95`).

## Function Design

**Size:** Keep functions small and single-purpose. Pure engines (`calculateNextRecurrence`, `toggleTask`, `saveTask` in `src/utils/taskMutations.js`) do one transformation each; context handlers (`toggleTaskComplete`, `handleSaveTask` in `src/context/TaskContext.js`) orchestrate exactly one mutation + persistence + telemetry emission.

**Parameters:** Accept an options bag as the last parameter for injectable seams (time, ids) so tests stay deterministic without mocking globals:
```javascript
export const toggleTask = (tasks = [], taskId, options = {}) => {
  const now = options.now || new Date().toISOString();
  const todayDate = options.todayDate || getLocalDateString();
```
(`src/utils/taskMutations.js:76-78`; exercised with `{ now: fixedNow, todayDate: fixedToday }` in `__tests__/unit/taskMutations.test.js:24-27`)
- Default collection params to empty arrays (`tasks = []`, `taskLists = []`) so callers can pass undefined safely (`src/utils/taskMutations.js`)

**Return Values:** Pure mutation functions never mutate inputs — return a result object with the updated collection plus the affected item:
```javascript
return { updatedTasks, toggledTask, spawnedTask };   // toggleTask
return { updatedTasks, savedTask };                   // saveTask
return { updatedTasks, deletedTask };                 // deleteTask
return { updatedTaskLists, createdList };             // createTaskList
```
(`src/utils/taskMutations.js:108,138,181,193`) — callers destructure what they need; contexts call `setTasks(updatedTasks)` outside any updater to stay StrictMode-safe (`src/context/TaskContext.js:205-206,317-322`).

## Module Design

**Exports:** Provide both named exports (for tree-shaking and test imports) and a default aggregate object for utils:
```javascript
export function getLocalDateString(...) {...}
export default { getLocalDateString, parseLocalDate, ... };
```
(`src/utils/dateUtils.js:14,166-174`); logger does the same: named `debug/info/warn/error/getRecentLogs/clearLogs` + default `logger` object (`src/utils/logger.js:142-194`)
- Context modules export three things: the `Provider` component, a `useX` hook, and the raw context as default: `TaskProvider`, `useTasks`, default `TaskContext` (`src/context/TaskContext.js:30,419,424`). Always consume via the hook (`const contextValue = useTasks()`), never via `useContext(TaskContext)` directly.

**Barrel Files:** Barrels are rare — only `src/ai/index.ts` and `src/commands/index.ts` re-export. Do not add new barrel files; import directly from the defining module (`../utils/taskMutations`, `../behavior/eventBus`). Screens must import contexts directly (`src/navigation/AppNavigator.js:24-27`), not through an index.

---

*Convention analysis: 2026-10-12*
