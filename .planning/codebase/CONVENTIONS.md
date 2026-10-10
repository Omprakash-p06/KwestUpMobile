# Coding Conventions

**Analysis Date:** 2026-10-11

## Naming Patterns

**Files:**
- Components use PascalCase matching the export: `src/components/CustomButton.js` exports `CustomButton`, `src/components/ErrorBoundary.js` exports `ErrorBoundary`, `src/components/TaskCard.js`, `src/components/TaskEditModal.js`.
- Utilities/services use camelCase: `src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/utils/fileStorage.js`, `src/utils/billingStorage.js`, `src/utils/syncService.js`, `src/utils/vaultService.js`, `src/services/notificationService.ts`.
- Context providers use `*Context.js`: `src/context/TaskContext.js`, `src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`.
- Behavior layer uses camelCase TS: `src/behavior/eventBus.ts`, `src/behavior/types.ts`.
- Theme modules are lowercase: `src/theme/colors.js`, `src/theme/styles.js`.
- Tests mirror the unit under test with `.test.js` / `.test.ts` suffix: `__tests__/unit/dateUtils.test.js` → `src/utils/dateUtils.js`, `__tests__/unit/taskMutations.test.js` → `src/utils/taskMutations.js`.

**Functions:**
- Use camelCase verbs for utilities: `getLocalDateString`, `parseLocalDate`, `isSameLocalDay` (`src/utils/dateUtils.js`), `toggleTask`, `completeTask`, `saveTask`, `deleteTask`, `toggleSubtask`, `createTaskList` (`src/utils/taskMutations.js`).
- Use `handle*` prefix for component event handlers: `handleRetry`, `handleRestartPrompt`, `handleCopyReport` (`src/components/ErrorBoundary.js`), `handlePress` (`src/components/CustomButton.js`).
- Use `validate*` prefix for throwing validators: `validateSyncConfig`, `validateSyncPayload` (`src/utils/syncService.js`).
- Use `init*/get*/clear*` for storage lifecycle: `initNotesFolder`, `getAllNotesFromFilesystem`, `wipeNotesFilesystem` (`src/utils/fileStorage.js`), `getRecentLogs`, `clearLogs` (`src/utils/logger.js`).
- Async functions use `Async` suffix when wrapping native promises: `getInfoAsync`, `writeAsStringAsync`, `scheduleNotificationAsync` (see `__tests__/setup/jest.setup.js` mocks and `src/services/notificationService.ts`).

**Variables:**
- Use camelCase for locals and state: `updatedTasks`, `toggledTask`, `spawnedTask` (`src/utils/taskMutations.js`), `hasError`, `showDetails`, `copiedToast` (`src/components/ErrorBoundary.js`).
- Use SCREAMING_SNAKE_CASE for exported constants: `APP_VERSION`, `STORAGE_VERSION` (`src/utils/storage.js`), `MAX_LOG_BUFFER_SIZE` (`src/utils/logger.js`), `MAX_EVENT_BUFFER_SIZE` (`src/behavior/eventBus.ts`), `NOTIFICATION_HISTORY_KEY`, `ANDROID_NOTIFICATION_CHANNELS` (`src/services/notificationService.ts`).
- Prefix throwaway/unused args with underscore (enforced by lint `argsIgnorePattern: '^_'` in `eslint.config.js`).

**Types:**
- TypeScript is used only at boundaries: `src/services/notificationService.ts`, `src/services/types.ts`, `src/behavior/eventBus.ts`, `src/behavior/types.ts`. The bulk of `src/` is JSDoc-typed JS.
- Use PascalCase interfaces/types: `AndroidNotificationChannel`, `BehavioralNotificationPolicy`, `NotificationDispatchRequest`, `NotificationHistoryEntry`, `DomainEvent` (see `src/services/types.ts`, `src/behavior/types.ts`).
- JSDoc `@param {Object}`, `@param {Array<Object>}`, `@param {string}`, `@returns {{ updatedTasks: ... }}` is the required contract style for JS utils — follow `src/utils/taskMutations.js` and `src/utils/dateUtils.js` exactly.

## Code Style

**Formatting:**
- No Prettier, Biome, or `.editorconfig` in repo (verified — none present). Style is enforced by ESLint + review, not a formatter.
- Use double quotes for strings, semicolons, 2-space indentation — match `src/components/CustomButton.js`, `src/utils/dateUtils.js`.
- Keep `StyleSheet.create()` at the bottom of component files after the component definition, with a module-local `const styles` (see `src/components/ErrorBoundary.js:301`, `src/components/CustomButton.js:68`). Do not export component styles.
- Inline comments reference review IDs where applicable (`CR-01`, `WR-02`, `OBS-01`, `TC-EVT-04`) — preserve these tags when editing those lines. Examples: `src/utils/logger.js:31-40`, `src/components/ErrorBoundary.js:60-65`.

**Linting:**
- Tool: ESLint 9 flat config in `eslint.config.js` (legacy `.eslintrc.js` retained for tooling compat — treat `eslint.config.js` as authoritative).
- `npm run lint` → `eslint .`. `npm run lint:report` writes `eslint-report.json` (git-ignored).
- Key rules to obey:
  - `react/react-in-jsx-scope: off` — do NOT add `import React` just for JSX scope in new components (legacy files still import React; both pass).
  - `react/prop-types: off` — do not add PropTypes; use JSDoc/TS types instead.
  - `react-hooks/rules-of-hooks: error` — hooks only at top level; `react-hooks/exhaustive-deps: warn`.
  - `react-native/no-inline-styles: warn`, `react-native/no-unused-styles: warn`, `react-native/no-color-literals: warn` — always extract styles to `StyleSheet.create()`, delete dead style keys, hoist hex colors to theme (`src/theme/colors.js`) or named constants.
  - `no-unused-vars: warn (argsIgnorePattern ^_)` — prefix intentionally unused params with `_`.
  - `no-console: warn` — never add raw `console.*` in `src/`; use `logger` from `src/utils/logger.js`. The only legitimate `console.*` call sites are inside `src/utils/logger.js` itself (file carries `/* eslint-disable no-console */` on line 1).

## Import Organization

**Order:**
1. `react` / `react-native` core (`import React ...`, `import { View, Text, ... } from "react-native"`)
2. Third-party / Expo packages (`@expo/vector-icons`, `expo-haptics`, `expo-clipboard`, `@react-native-async-storage/async-storage`)
3. Internal relative imports, `./`-sibling first then `../` parents: components → `../utils/logger`, screens → `../context/*`
4. Follow the existing grouping with blank lines between groups — see `src/components/ErrorBoundary.js:1-16`, `src/services/notificationService.ts:19-31`, `src/context/TaskContext.js:1-19`.

**Path Aliases:**
- None. `tsconfig.json` extends `expo/tsconfig.base` with no `paths` mapping, and `babel.config.js` defines no module-resolver. Always use relative imports (`../../src/utils/dateUtils`, `../behavior/eventBus`). Do not introduce `@/` or `~/` aliases.

## Error Handling

**Patterns:**
- Pure utilities return sentinel values, never throw, for bad input: return `''` (`getLocalDateString` in `src/utils/dateUtils.js:14-49`), return `new Date(NaN)` (`parseLocalDate` in `src/utils/dateUtils.js:63-86`), return `false` (`isSameLocalDay`). Tests assert these sentinels — see `__tests__/unit/dateUtils.test.js:44-58,89-95`.
- Boundary validators throw descriptive `Error`s: `validateSyncConfig` / `validateSyncPayload` in `src/utils/syncService.js` throw messages containing `is malformed`, `out of bounds`, `missing or insufficiently long`, `Malformed server response`. Use `expect(() => ...).toThrow('<fragment>')` when testing these.
- Async storage/IO layers use `try/catch` + `logger.error` + graceful fallback (null/empty), never a bare rethrow to UI. Example: vault loading in `src/context/VaultContext.js:48`, import failure in `src/screens/NotesScreen.js:743`.
- React tree crashes are caught by the class `ErrorBoundary` in `src/components/ErrorBoundary.js` (uses `static getDerivedStateFromError` + `componentDidCatch` → `logger.error`). Never build ad-hoc try/catch around render; wrap new top-level surfaces with `<ErrorBoundary>` instead. Copy the retry / copy-report / restart-prompt action pattern when building new fallbacks.
- EventBus listener isolation: `src/behavior/eventBus.ts` wraps each listener so one throw/rejection never breaks dispatch — sync throws route to `logger.error('EventBus listener error:', ...)` and async rejections to `logger.error('EventBus async listener error:', ...)`. Do not add your own try/catch inside `emit`; rely on this and assert via `logger` spies in tests.
- Missing context guards use `console.warn` + early return, not throw: `src/navigation/AppNavigator.js:125,387`. Replicate this for optional-context callbacks.

## Logging

**Framework:** Custom `logger` in `src/utils/logger.js` (re-exported as `logger` object + named `debug/info/warn/error/getRecentLogs/clearLogs/isDevelopment`). Do not use `console.*` directly in `src/`.

**Patterns:**
- Import: `import { logger } from "../utils/logger";` (see `src/components/ErrorBoundary.js:14`, `src/context/TaskContext.js:18`).
- Levels: `logger.debug/info` for dev-only diagnostics (gated on `__DEV__`, silenced AND unbuffered in production per CR-02); `logger.warn/error` for operational signal (always buffered + always console passthrough). Match call sites: `logger.info("🧹 STARTING ...")` in `src/utils/storage.js`, `logger.error("Unhandled React Error:", ...)` in `src/components/ErrorBoundary.js:39`.
- Sensitive data: the logger redacts keys matching `/(content|body|note|title|text|message|passphrase|token|key|secret|password|habitTitle|cueText)/i` and truncates strings to 1000 chars / arrays to 50 items before buffering (`src/utils/logger.js:37-81`). Never pre-redact at the call site — pass raw objects and let the logger handle it.
- Forensics: every `warn/error` (and dev `debug/info`) lands in a 50-entry FIFO deep-frozen ring buffer retrievable via `logger.getRecentLogs()` and reset via `logger.clearLogs()`. The `ErrorBoundary` crash report serializes this buffer (capped at 8000 chars) — see `src/components/ErrorBoundary.js:70-98`.
- Production builds strip `console.log/info/debug` via `babel-plugin-transform-remove-console` (keeps `error`/`warn`) — configured in `babel.config.js:15-17`. This is a backstop, not a license to use `console.*`.

## Comments

**When to Comment:**
- Every `src/utils/*.js` module opens with a banner block (`/** ... === ... */`) stating ownership and purpose — e.g. `src/utils/dateUtils.js:1-6`, `src/utils/taskMutations.js:1-10`. Replicate this header on new utility modules.
- Explain *why*, not *what*: decision records cite review IDs (`CR-01`, `CR-02`, `WR-02`, `WR-04/05/06`, `OBS-01`) inline — e.g. `src/utils/logger.js:28-36`, `src/services/notificationService.ts:1-18`. Preserve and extend these tags; do not delete them.
- Inline emoji prefixes (`🧹`, `📋`, `✅`, `❌`) are the established convention for lifecycle logs in `src/utils/storage.js` and `src/context/VaultContext.js` — keep them for boot/migration/cache-clear logs.
- Do not leave `TODO/FIXME/HACK` without a tracking reference; the repo has no standing TODO convention and stray tags will be flagged in review.

**JSDoc/TSDoc:**
- All exported utility functions carry full JSDoc with `@param` types, `@returns`, and contract notes — copy `src/utils/dateUtils.js:8-13,51-62` and `src/utils/taskMutations.js:13-20,66-75` verbatim as templates.
- TS files use TSDoc sparingly (architecture decision records at file top, e.g. `src/services/notificationService.ts:1-18`). Type contracts live in `src/services/types.ts` and `src/behavior/types.ts`.

## Function Design

**Size:** Keep pure functions small and single-purpose (one transform per export). `src/utils/taskMutations.js` is the model: 9 focused exports (`toggleTask`, `completeTask`, `saveTask`, `deleteTask`, `toggleSubtask`, `createTaskList`, `renameTaskList`, `deleteTaskList`, `calculateNextRecurrence`), each <40 lines.

**Parameters:** Use `(collection = [], id, options = {})` for list mutations — array-first, identifier-second, injectable-clock/override-last. The `options` bag carries `{ now, todayDate }` so tests can inject `fixedNow`/`fixedToday` deterministically (see `__tests__/unit/taskMutations.test.js:13-14` and every `toggleTask(tasks, id, { now, todayDate })` call). New time-dependent functions MUST accept `now`/`todayDate` overrides the same way and MUST use `getLocalDateString()` (never `toISOString().slice(0,10)`) for calendar-day values.

**Return Values:** Return result objects, never bare mutated arrays: `{ updatedTasks, toggledTask, spawnedTask }`, `{ updatedTasks, completedTask }`, `{ updatedTaskLists, createdList }` (`src/utils/taskMutations.js:76-109,119-139,243-254`). Callers destructure what they need; contexts then persist + emit events. Preserve immutability — always build new arrays/objects via spread/`map`/`filter`, never mutate inputs in place (EventBus deep-freezes payloads, so mutation would throw downstream).

## Module Design

**Exports:** Use named exports for everything testable (`export const toggleTask`, `export function getLocalDateString`, `export const eventBus`), plus a default-export object aggregating the module for convenience consumers (`export default { getLocalDateString, ... }` in `src/utils/dateUtils.js:166-174`, `export default logger` + `export const logger` in `src/utils/logger.js:183-194`, `export default ErrorBoundary` + `export class ErrorBoundary` in `src/components/ErrorBoundary.js`). Tests import the named form (`import { ... } from '../../src/utils/logger'`).

**Barrel Files:** None — there are no `index.js` re-export barrels in `src/`. Import directly from the defining file (`../utils/taskMutations`, `../behavior/eventBus`, `./CustomButton`). Do not create barrels; deep relative imports are the convention.

---

*Convention analysis: 2026-10-11*
