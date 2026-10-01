# Coding Conventions

**Analysis Date:** 2026-10-01

## Naming Patterns

**Files:**
- Components use PascalCase matching the export: `src/components/ErrorBoundary.js` exports `ErrorBoundary`, `src/components/CustomButton.js` exports `CustomButton`, `src/components/TaskCard.js`, `src/components/TaskEditModal.js`.
- Utilities use camelCase: `src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/utils/fileStorage.js`, `src/utils/syncService.js`, `src/utils/vaultService.js`, `src/utils/billingStorage.js`, `src/utils/aiService.js`.
- Contexts use PascalCase + `Context` suffix: `src/context/TaskContext.js`, `src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`.
- Screens use PascalCase + `Screen` suffix: `src/screens/DashboardScreen.js`, `src/screens/TaskListScreen.js`, `src/screens/NotesScreen.js`, `src/screens/SettingsScreen.js`.
- New TypeScript domain contracts use `types.ts` per directory: `src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts`.
- Tests mirror the unit under test with `.test.js` suffix under `__tests__/`: `__tests__/unit/logger.test.js` → `src/utils/logger.js`, `__tests__/unit/taskMutations.test.js` → `src/utils/taskMutations.js`, `__tests__/unit/syncService.test.js` → `src/utils/syncService.js`.

**Functions:**
- Use camelCase verbs for exported utilities: `getLocalDateString`, `parseLocalDate`, `isSameLocalDay` (`src/utils/dateUtils.js`), `toggleTask`, `calculateNextRecurrence`, `saveTask`, `deleteTask` (`src/utils/taskMutations.js`), `validateSyncConfig`, `validateSyncPayload`, `performSync` (`src/utils/syncService.js`).
- Async functions use async/await and verb-first names: `runNetworkDiagnostics`, `runDeviceDiagnostics`, `sendTelemetryEvent` (`src/utils/diagnostics.js`), `scheduleDueDateNotification` (`src/utils/notifications.js`).
- Event handlers use `handle` / `on` prefix: `handleRetry`, `handleCopyReport`, `handleRestartPrompt`, `toggleDetails` (`src/components/ErrorBoundary.js`), `handlePress` (`src/components/CustomButton.js`).
- Boolean predicates use `is` prefix: `isDevelopment` (`src/utils/logger.js`), `isSameLocalDay` (`src/utils/dateUtils.js`), `isUserDataKey` (`src/utils/storage.js`), `isModelDownloaded` (`src/utils/aiService.js`), `isLightColor` (`src/components/CustomButton.js`).

**Variables:**
- Use camelCase for locals and module state: `logBuffer`, `fixedNow`, `mockInMemoryFS`, `updatedTasks`, `toggledTask`, `spawnedTask`.
- Use SCREAMING_SNAKE_CASE for exported constants: `MAX_LOG_BUFFER_SIZE` (`src/utils/logger.js`), `STORAGE_VERSION`, `APP_VERSION` (`src/utils/storage.js`), `MODEL_FILENAME`, `MODEL_PINNED_COMMIT`, `MODEL_EXPECTED_SHA256` (`src/utils/aiService.js`), `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` (`src/services/types.ts`).
- Prefix intentionally unused args with underscore (enforced by lint): `argsIgnorePattern: '^_'` in `eslint.config.js` and `.eslintrc.js`.
- Jest mock-only variables inside `jest.mock()` factories must be prefixed with `mock` (e.g. `mockInMemoryFS`, `mockNormalizePath` in `__tests__/setup/jest.setup.js`) — this is a Jest allowlist requirement, not style.

**Types:**
- Use PascalCase `interface` / `type` with domain nouns: `Habit`, `Cue`, `HabitStack`, `Intervention`, `BehaviorEvent`, `FrictionDiagnosis`, `FactualReward`, `HabitFrequency`, `HabitStatus`, `CueType` (`src/behavior/types.ts`); `CommandAction`, `CommandPayload`, `DispatchedCommand`, `CommandValidationResult` (`src/commands/types.ts`); `ScheduledNotificationDescriptor`, `BehavioralNotificationPolicy` (`src/services/types.ts`).
- String-literal unions for closed vocabularies, never bare `string`: `HabitFrequency = 'daily' | 'weekdays' | ...`, `CommandAction = 'CREATE_HABIT' | 'UPDATE_HABIT' | ...`, `InterventionStatus = 'scheduled' | 'dispatched' | ...`.
- Timestamps are ISO-8601 `string` fields (`createdAt`, `updatedAt`, `completedAt`, `triggerDate`); document the clock (device-local wall-clock vs UTC) in a comment, as in `src/services/types.ts`.

## Code Style

**Formatting:**
- No Prettier config in repo. Follow the de facto style: double quotes, semicolons, 2-space indent, trailing commas in multiline literals (see `src/utils/logger.js`, `src/utils/dateUtils.js`, `src/components/ErrorBoundary.js`).
- Keep line length reasonable (~100 chars); break long JSX props one-per-line as in `src/components/ErrorBoundary.js`.
- `StyleSheet.create` + camelCase keys for all React Native styles, co-located at the bottom of the component file (see `src/components/ErrorBoundary.js`, `src/components/CustomButton.js`, every file in `src/screens/`).

**Linting:**
- Primary config is `eslint.config.js` (flat config, ESLint 9). Legacy `.eslintrc.js` is retained for editor fallback — keep both in sync when adding rules.
- Parser: `@babel/eslint-parser` with `./babel.config.js`; React version auto-detected (`settings.react.version: 'detect'`).
- Key rules (`eslint.config.js`):
  - `react/react-in-jsx-scope: off` (new JSX transform, React 19) — do not import React just for JSX.
  - `react/prop-types: off` — props are untyped JS; do not add propTypes.
  - `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn` — hooks rules are mandatory.
  - `react-native/no-inline-styles: warn`, `react-native/no-unused-styles: warn`, `react-native/no-color-literals: warn` — extract styles to `StyleSheet.create`, delete dead styles, hoist colors to `src/theme/colors.js`.
  - `no-unused-vars: warn` with `argsIgnorePattern: '^_'`.
  - `no-console: warn` — see Logging section; new code must use `src/utils/logger.js`, never raw `console`.
- Ignored paths: `node_modules/`, `.expo/`, `dist/`, `android/`, `ios/`, `assets/`, `coverage/`, `KwestUpPC/` (`eslint.config.js`).
- Quality gates run in CI (`.github/workflows/ci.yml`): `npm run lint` (plain, no `--max-warnings=0` until ~849 pre-existing warnings are triaged), `npm run typecheck` (`tsc --noEmit`), then `npx jest --ci --maxWorkers=2 --coverage`. Mirror with `check.bat` (`npm run lint` then `npm test`) before committing on Windows.

**TypeScript:**
- `tsconfig.json` extends `expo/tsconfig.base` with `strict: true`, `allowJs: true`, `checkJs: false`, `noEmit: true`.
- New code in `src/behavior/`, `src/commands/`, `src/services/` is strict TypeScript: explicit `interface`/`type` exports, no `any` without justification, `Record<string, unknown>` for open maps (see `src/commands/types.ts`, `src/services/types.ts`).
- `checkJs: false` is intentional until the ~1152 pre-existing JS errors are triaged — do not enable it casually. `App.js`/`index.js` and `widgets/` are excluded from the program for the same reason; keep exclusions intact.

## Import Organization

**Order:**
1. Framework: `react`, `react-native` (`View`, `Text`, `StyleSheet`, `Platform`, `Share`, `SafeAreaView`), `expo-*`.
2. Third-party: `@react-navigation/*`, `@react-native-async-storage/async-storage`, `@expo/vector-icons`, `crypto-js`, `llama.rn`.
3. Internal absolute-then-relative: `../utils/*`, `../components/*`, `../theme/*`, `./logger`, `./dateUtils`.
4. Example canonical header: `src/context/TaskContext.js` (React → `react-native` → AsyncStorage → `expo-haptics` → `../utils/taskMutations` → `../utils/notifications` → `../utils/storage` → `../utils/logger`).

**Path Aliases:**
- None. Always use relative imports (`../../src/utils/logger`, `../theme/styles`). Do not introduce `@/` aliases without updating `tsconfig.json`, `babel.config.js`, and `jest.config.js` together.

**Conventions:**
- Import the shared logger as `import { logger } from "../utils/logger"` and call `logger.warn` / `logger.error` (`src/context/TaskContext.js`, `src/utils/syncService.js`, `src/utils/storage.js`, `src/components/ErrorBoundary.js`).
- Import pure helpers directly by name: `import { getLocalDateString } from "./dateUtils"` (`src/utils/taskMutations.js`), `import { toggleTask, saveTask } from "../utils/taskMutations"` (`src/context/TaskContext.js`).
- Never import across `src/domains/*` subdomains; cross-domain calls go through events (`src/domains/README.md`).

## Error Handling

**Patterns:**
- Use `ErrorBoundary` (`src/components/ErrorBoundary.js`) at the app root. Report crashes via `logger.error("Unhandled React Error:", error?.message, errorInfo?.componentStack)` in `componentDidCatch`. Recovery UI copy is a contract: title `Something Went Wrong`, reassurance `Your notes, tasks, and data remain safe on your device.`, actions `Try Again` / `Copy Error Report` / `Restart Application`.
- Validate-then-throw with descriptive messages in services. Throw `new Error("Invalid sync configuration: ...")` for bad config and `new Error("Malformed server response ...")` for bad payloads (`src/utils/syncService.js`). Callers assert with `expect(() => ...).toThrow('...')` (`__tests__/unit/syncService.test.js`).
- Wrap every `fetch` in `fetchWithTimeout` with `AbortController` + `clearTimeout` in both paths (`src/utils/syncService.js`). Always clear timers/handles in `finally`-equivalent branches.
- Wrap fallible I/O in try/catch with graceful degradation: clipboard → `Share.share` fallback with explicit `copied`/`copyFailed` states, never a false success toast (`src/components/ErrorBoundary.js` `handleCopyReport`).
- Use safe fallbacks for bad dates, never throw: return `''` from `getLocalDateString` and `Invalid Date` from `parseLocalDate` for null/garbage/non-existent dates (`src/utils/dateUtils.js`); fall back to `now` timestamp on unparseable `dueDate` (`src/utils/taskMutations.js`).
- Catch serialization hazards: `[Circular]`, `[Max Depth]`, `[Unserializable]` guards in `src/utils/logger.js`; cap clipboard reports at 8000 chars with a truncation marker (`src/components/ErrorBoundary.js`).
- Never swallow errors silently: log with `logger.error` carrying the message and stack, then degrade (retry UI, fallback share path, default value).

## Logging

**Framework:** `src/utils/logger.js` — the only approved logging surface. Raw `console.*` is `warn`-gated by ESLint and stripped from production bundles (`babel.config.js` `transform-remove-console` excludes only `error`/`warn`).

**Patterns:**
- Use `logger.debug` for verbose flow, `logger.info` for lifecycle events, `logger.warn` for operational signals, `logger.error` for failures. `debug`/`info` are fully gated on `isDevelopment()` — they neither emit nor buffer in production. `warn`/`error` always buffer and pass through (`src/utils/logger.js`, verified in `__tests__/unit/logger.test.js`).
- Never log user content under raw keys. Key-based PII redaction (`content|body|note|title|text|message|passphrase|token|key|secret|password` → `[Redacted]`) runs before buffering; strings cap at 1000 chars, arrays at 50 items, depth at 4 (`src/utils/logger.js` `serializeItem`).
- `logger.js` itself carries `/* eslint-disable no-console */` at the top — that exemption applies only to that file. Do not copy it elsewhere.
- Pre-existing raw `console.error`/`console.log` in `src/context/BillingContext.js`, `src/context/VaultContext.js`, `src/screens/SettingsScreen.js`, `src/utils/billingNotifications.js` are tech debt tracked for migration to `logger` — do not imitate; write new code with `logger`.
- For forensics, read `logger.getRecentLogs()` (frozen 50-entry FIFO snapshot) and `logger.clearLogs()` in tests; never mutate the returned entries (`__tests__/unit/logger.test.js`, `__tests__/unit/errorBoundary.test.js`).

## Comments

**When to Comment:**
- Every `src/utils/*.js` module opens with a block header stating ownership and scope (see `src/utils/dateUtils.js` `Centralized Local Date Utility Engine`, `src/utils/taskMutations.js` `Pure Task Mutation Engine`).
- Document non-obvious contracts inline: timezone semantics (`src/utils/dateUtils.js`), quiet-hours window `[22:00, 08:00)` (`src/services/types.ts`), idempotency echo (`src/commands/types.ts`), review-tagged decisions (`CR-01`, `CR-02`, `WR-02`, `WR-04`, `WR-05`, `WR-06`, `OBS-01` tags in `src/utils/logger.js` and `src/components/ErrorBoundary.js`).
- Reference the governing spec when behavior implements one: `rulebook/rules/reminders.md`, `19-UI-SPEC.md`, `KwestUp_4.0_Master_Plan.md`.

**JSDoc/TSDoc:**
- All exported utility functions carry `@param` / `@returns` JSDoc with types and edge-case contracts: `src/utils/dateUtils.js` (`getLocalDateString`, `parseLocalDate`), `src/utils/taskMutations.js` (`calculateNextRecurrence`, `toggleTask`), `src/utils/syncService.js` (`validateSyncConfig`), `src/utils/aiService.js`, `src/utils/fileStorage.js`, `src/utils/vaultImport.js`, `src/utils/exportService.js`, `src/utils/notifications.js`.
- New `.ts` contracts use TSDoc `/** ... */` above each interface plus inline `//` notes for enum semantics (see `src/behavior/types.ts`, `src/commands/types.ts`).

## Function Design

**Size:** Keep utilities small and single-purpose. Pure transforms (`src/utils/taskMutations.js`, `src/utils/dateUtils.js`) stay under ~60 lines per function; screen components may be large but delegate logic to utils/contexts.

**Parameters:** Use an `options` bag with defaults for injectable context: `toggleTask(tasks, taskId, options = {})` with `options.now` / `options.todayDate` (`src/utils/taskMutations.js`); `fetchWithTimeout(url, options, timeoutMs = 4000)` (`src/utils/syncService.js`); `sendTelemetryEvent(event, payload = {})` (`src/utils/diagnostics.js`). Default timestamps to `new Date().toISOString()` so tests can pin time via `fixedNow`.

**Return Values:** Return new objects, never mutate inputs. Mutation helpers return `{ updatedTasks, toggledTask / spawnedTask / savedTask / deletedTask }` tuples (`src/utils/taskMutations.js`). Validators return the normalized object on success and throw `Error` on failure (`src/utils/syncService.js`). Date parsers return `''` / `Invalid Date` sentinels for bad input, never today (`src/utils/dateUtils.js`).

## Module Design

**Exports:** Prefer named exports for utils (`export const debug/info/warn/error`, `export const getLocalDateString`, `export const validateSyncConfig`) with an additional default aggregate where convenient (`export default logger` in `src/utils/logger.js`, `export default ErrorBoundary` in `src/components/ErrorBoundary.js`). Context modules export both the provider and hook plus a default context (`export const TaskProvider`, `export const useTasks`, `export default TaskContext` in `src/context/TaskContext.js`).

**Barrel Files:** None. Import directly from the defining module (`../utils/taskMutations`, `../utils/logger`). Do not add index.js barrels.

**Component pattern:** Class for `ErrorBoundary` (lifecycle `getDerivedStateFromError`/`componentDidCatch` in `src/components/ErrorBoundary.js`); function components + hooks elsewhere. Shared presentational pieces (`src/components/CustomButton.js`, `src/components/CustomCard.js`, `src/components/CustomTextInput.js`) take `title/onPress/icon/style/outline/disabled/color` props and compute contrast internally.

**State pattern:** Context provider per domain (`TaskProvider` in `src/context/TaskContext.js`) owning AsyncStorage persistence, versioned keys (`STORAGE_VERSION`), and mutation delegation to pure utils. New 4.0 domains live under `src/domains/*` and communicate via events only (`src/domains/README.md`).

---

*Convention analysis: 2026-10-01*
