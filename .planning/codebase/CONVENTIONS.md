# Conventions

**Analysis Date:** 2026-09-28

## Code Style (lint, formatting, TS strictness)

**Linters (dual config, keep in sync):**
- Legacy flat-compat config: `.eslintrc.js` (root, `@babel/eslint-parser`, `ecmaVersion: 2021`, `babelOptions.configFile: './babel.config.js'`).
- Flat config (ESLint 9, authoritative): `eslint.config.js` — `files: ['**/*.{js,jsx}']`, same parser/options; test override block grants `describe/it/test/expect/beforeEach/afterEach/beforeAll/afterAll/jest` as readonly globals for `__tests__/**/*.{js,jsx}` and `*.test.{js,jsx}`.
- Plugins: `react`, `react-native`, `react-hooks` in both configs.
- Key rules (identical in both unless noted):
  - `react-native/no-unused-styles: warn`, `react-native/no-inline-styles: warn` — StyleSheet discipline is warned, not errored; inline styles still appear in older screens.
  - `react-native/no-raw-text: off`, `react/prop-types: off` — no propTypes enforcement.
  - `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn`.
  - `no-unused-vars: ['warn', { argsIgnorePattern: '^_' }]` — prefix intentionally unused args with `_`.
  - `no-console: warn` — console use is a warning, not an error (see Logging Conventions for the split).
  - Flat config additionally: `react-native/no-color-literals: warn`, `react-native/sort-styles: off`, `react/react-in-jsx-scope: off`.
- Ignored everywhere: `node_modules/`, `.expo/`, `dist/`, `web-build/`, `android/`, `ios/`, `KwestUpPC/` (flat config also ignores `assets/**`).
- Run: `npm run lint` (`eslint .`) and `npm run lint:report` (`eslint . --format json --output-file eslint-report.json`) from `package.json`.

**Formatting:**
- No Prettier config in repo (verified: no `.prettierrc*` / `prettier.config.*`). Formatting is by convention, not tooling.
- Observed style: double quotes in `src/` components/screens (`import React from "react"` in `src/components/ErrorBoundary.js`), single quotes in `__tests__/` (`import ... from 'expo-file-system'` in `__tests__/unit/aiService.test.js`); 2-space indent; semicolons; `StyleSheet.create` for all RN styles.

**TypeScript strictness:**
- `tsconfig.json` is only `{ "compilerOptions": {}, "extends": "expo/tsconfig.base" }` — inherits Expo base, no `strict: true` override. Codebase is effectively JS: `src/**/*.js`, no `src/**/*.ts(x)` detected. Types are expressed via JSDoc (`@param {Object} task`, `@returns {Object}` in `src/utils/taskMutations.js`), not `tsc` gates. CI does not run `tsc`.

**Production console stripping:**
- `babel.config.js`: when `NODE_ENV === 'production'`, pushes `['transform-remove-console', { exclude: ['error', 'warn'] }]` — `console.log/info/debug` are stripped from prod bundles, `console.error/warn` survive. `react-native-reanimated/plugin` is always last. Cache key is `process.env.NODE_ENV` via `api.cache.using(...)` (comment tags `WR-01`/`OBS-01`).

## Logging Conventions (logger usage, prod gating, PII redaction)

**Single canonical logger:** `src/utils/logger.js` — import as `import { logger } from "../utils/logger"` (or `"./logger"` within `src/utils/`). Never add a second logging abstraction. `logger.js` opens with `/* eslint-disable no-console */` — it is the only file allowed raw `console.*`.

**Level contract (verified in `src/utils/logger.js:142-162`):**
- `logger.debug(msg, ...details)` → `console.log`, dev-only (gated on `isDevelopment()`, returns early in prod — neither emits nor buffers).
- `logger.info(msg, ...details)` → `console.info`, dev-only (same gating).
- `logger.warn(msg, ...details)` → `console.warn`, always (buffers + passthrough in prod).
- `logger.error(msg, ...details)` → `console.error`, always (buffers + passthrough in prod).
- `isDevelopment()` returns `__DEV__` when defined, else `process.env.NODE_ENV !== 'production'`.

**Forensics buffer:** 50-entry FIFO ring-buffer (`MAX_LOG_BUFFER_SIZE = 50`, `src/utils/logger.js:13`); entries deep-frozen at record time (`deepFreeze`, `src/utils/logger.js:116-123`); consumers use `logger.getRecentLogs()` (returns fresh outer array, shared frozen entries) and `logger.clearLogs()` (used in test `beforeEach`). `ErrorBoundary` builds its copy-pasteable crash report from `logger.getRecentLogs()` and caps the report at 8000 chars (`src/components/ErrorBoundary.js:70-97`).

**PII redaction:** `serializeItem` redacts any key matching `/(content|body|note|title|text|message|passphrase|token|key|secret|password)/i` to `[Redacted]` *before* buffering (`src/utils/logger.js:37-38,47-81`); strings capped at 1000 chars, arrays at 50 items, depth cap 4, `WeakSet` cycle guard → `[Circular]`, `Error` serialized to `{name, message, stack, cause}`.

**Emoji-prefixed messages:** operational logs use emoji prefixes (`❌` failures, `✅` success, `⚠️` warnings, `📂`/`💾`/`🗑️` fs ops, `🤖` AI) — e.g. `logger.error("❌ Failed to save vaults to AsyncStorage:", error)` in `src/utils/vaultService.js:66`, `logger.debug("💾 Saved note file to:", filePath)` in `src/utils/fileStorage.js:55`.

**Known inconsistency (do not propagate):** newer/leaf modules (`src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/utils/billingStorage.js`, `src/utils/billingNotifications.js`, `src/utils/vaultImport.js`, `src/utils/notifications.js`, `src/screens/BirthdaysScreen.js`, `src/navigation/AppNavigator.js:118,380`) still call raw `console.*` directly (37 matches). These survive prod-strip partially (`warn/error` kept) and bypass PII redaction. New code must use `logger.*`; migrate old call sites opportunistically.

## Naming (files, components, services, tests)

- **Source files:** camelCase `*.js`, one module per file: `src/utils/aiService.js`, `src/utils/taskMutations.js`, `src/utils/dateUtils.js`, `src/utils/syncService.js`, `src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/exportService.js`, `src/utils/storage.js`, `src/utils/logger.js`, `src/utils/diagnostics.js`.
- **Components:** PascalCase matching default export: `src/components/ErrorBoundary.js` (`export class ErrorBoundary`), `src/components/TaskCard.js`, `src/components/AIAssistant.js`, `src/components/CustomButton.js`, `src/components/CustomCard.js`, `src/components/CustomTextInput.js`, etc.
- **Contexts:** `*Context.js` with named `*Provider` export + `createContext(null)`: `src/context/TaskContext.js` (`TaskProvider`), `src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`.
- **Screens:** `*Screen.js`: `src/screens/DashboardScreen.js`, `src/screens/TaskListScreen.js`, `src/screens/FocusTimerScreen.js`, `src/screens/NotesScreen.js`, `src/screens/SettingsScreen.js`, `src/screens/BillingScreen.js`, `src/screens/BirthdaysScreen.js`, `src/screens/SearchScreen.js`, `src/screens/DailyTasksScreen.js`.
- **Services/utils exports:** named function exports, verb-first: `saveNoteFile`, `readNoteFile`, `deleteNoteFile` (`src/utils/fileStorage.js`); `calculateNextRecurrence`, `toggleTask`, `completeTask`, `saveTask`, `deleteTask`, `toggleSubtask`, `createTaskList` (`src/utils/taskMutations.js`); `verifyModelIntegrity`, `isModelDownloaded`, `loadModel`, `unloadModel`, `resetIdleTimer` (`src/utils/aiService.js`).
- **Constants:** SCREAMING_SNAKE for exported config: `MODEL_FILENAME`, `MODEL_PINNED_COMMIT`, `MODEL_EXPECTED_SHA256`, `MODEL_EXPECTED_SIZE`, `MODEL_DOWNLOAD_URL`, `IDLE_UNLOAD_TIMEOUT_MS`, `MAX_LOG_BUFFER_SIZE`, `APP_VERSION`, `STORAGE_VERSION`.
- **Tests:** mirror source basename + `.test.js` under `__tests__/`: `__tests__/unit/logger.test.js` ↔ `src/utils/logger.js`, `__tests__/unit/aiService.test.js` ↔ `src/utils/aiService.js`, etc. Top-level `describe` names the unit under test (`describe('src/utils/logger', ...)` in `__tests__/unit/logger.test.js:12`; `describe('src/components/ErrorBoundary', ...)` in `__tests__/unit/errorBoundary.test.js`). Nested `describe` per function/area, `test(...)`/`it(...)` per case — both verbs in use (`test(` in `logger.test.js`, `it(` in `aiService.test.js`); prefer `it(` for new AI-service tests to match that file.
- **Widget handler:** `widgets/widget-task-handler.tsx` is the only `.tsx` entry; shares pure logic from `src/utils/taskMutations.js` (see `taskMutations.js:1-10` header).

## File Organization

- `src/components/` — reusable UI (`ErrorBoundary.js`, `TaskCard.js`, `TaskEditModal.js`, `AIAssistant.js`, `Custom*.js`, `LiquidGlass*.js`).
- `src/screens/` — one `*Screen.js` per route.
- `src/context/` — React contexts, sole state owners per domain (`TaskContext.js` is sole writer of `tasks/taskLists/dailyTasks` keys — see `TaskContext.js:63-74` comment).
- `src/utils/` — framework-agnostic services: `aiService.js` (1064 lines, LLM lifecycle), `taskMutations.js` (pure, shared with widget), `dateUtils.js`, `syncService.js`, `vaultService.js`, `fileStorage.js`, `exportService.js`, `storage.js`, `logger.js`, `diagnostics.js`, `notifications.js`, `billingStorage.js`, `billingNotifications.js`, `vaultImport.js`.
- `src/navigation/` — `AppNavigator.js`, `CustomDrawerContent.js`.
- `src/theme/` — `colors.js`, `styles.js`.
- `__tests__/unit/` — 11 suites mirroring `src/`; `__tests__/phase12-widget-logic.test.js` — widget pure-logic equivalents; `__tests__/setup/jest.setup.js` — global mocks; `__tests__/setup/jest.setup.test.js` — smoke test for the mocks themselves.
- Root entries: `App.js`, `index.js`, `app.json`, `eas.json`; native: `android/`; widget: `widgets/`.
- **Import order convention** (observed, e.g. `src/utils/aiService.js:9-20`, `src/context/TaskContext.js:1-21`): `react`/`react-native` → third-party (`expo-*`, `llama.rn`, `crypto-js`) → relative utils (`./dateUtils`, `./logger`). No path aliases — always relative (`../utils/logger`, `./vaultService`).

## Error Handling & Validation Patterns

- **Service pattern (canonical):** `try { ... } catch (error) { logger.error("❌ <what failed>:", error); }` with safe fallback return — e.g. `initNotesFolder` in `src/utils/fileStorage.js:11-22` swallows to `logger.error` and returns `undefined`; `saveNoteFile`/`readNoteFile`/`deleteNoteFile` follow the same shape. Use this for all fs/storage/IO helpers.
- **Pure-logic pattern:** defensive coercion, no throw — e.g. `calculateNextRecurrence(task, now = new Date().toISOString())` in `src/utils/taskMutations.js:21-26` falls back to `now`/`Date.now()` on invalid dates; never throws on bad input.
- **UI boundary pattern:** `ErrorBoundary` (`src/components/ErrorBoundary.js`) — `getDerivedStateFromError` + `componentDidCatch` logging via `logger.error(...)`, retry (`handleRetry`), copyable capped crash report (`handleCopyReport`), manual-restart hint (no `expo-updates`), collapsible diagnostics. Wrap every new top-level subtree; `App.js` is the host.
- **Validation helpers:** `validateSyncConfig` / `validateSyncPayload` in `src/utils/syncService.js` (covered in `__tests__/unit/syncService.test.js`); `isUserDataKey` key-protection filter in storage migration (`__tests__/unit/storageMigration.test.js`).
- **Async cleanup:** timers/subscriptions cleared in unmount paths (`ErrorBoundary.componentWillUnmount` clears `toastTimeout`; `aiService.js` `unloadModel` + `_loadGeneration` guard, `resetIdleTimer` with `unref`).

## Git / Commit Patterns (if detectable)

- No husky hooks, no commitlint (verified: no `.husky/`; `.git/hooks/` are stock samples only). `check.bat` (`lint` + `test`) is the manual pre-commit gate.
- Observed history (`git log --oneline`, latest 15): conventional-ish prefixes — `feat(obs):`, `feat(ai):`, `feat(arch):`, `fix(phase-19):`, `fix(phase-18):`, `docs(plan):`, `docs:`. Scope is phase or domain (`phase-19`, `obs`, `ai`, `arch`). Example: `b9bae16 fix(phase-19): address code review — PII redaction, prod log gating, migration completion, boundary hardening`.
- Follow: `<type>(<scope>): <imperative summary>` with `feat|fix|docs` types; reference the phase/plan ID being executed.

---

*Convention analysis: 2026-09-28*
