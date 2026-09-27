# Conventions

**Analysis Date:** 2026-09-28

## Code Style (lint, formatting, TS strictness)

- **Linter:** ESLint 9 (`eslint@^9.39.4`) with dual config files kept in sync: `.eslintrc.js` (legacy `eslintrc` format, `root: true`) and `eslint.config.js` (flat config). Both target `**/*.{js,jsx}` with `@babel/eslint-parser` (ECMAScript 2021, `sourceType: module`, JSX on, `babelOptions.configFile: ./babel.config.js`).
- **Plugins / extends:** `eslint:recommended` + `plugin:react/recommended`, plugins `react`, `react-native`, `react-hooks`. `settings.react.version: 'detect'`.
- **Key rules (identical in both configs):**
  - `react/react-in-jsx-scope: off` (flat config only; new JSX transform, React 19) — `App.js`, `src/components/*.js`, `src/screens/*.js` import `React` anyway for hooks/context.
  - `react/prop-types: off` — no propTypes anywhere; components use destructured props with inline defaults (e.g. `TaskListScreen({ tasks = [], ... })` in `src/screens/TaskListScreen.js`).
  - `react-native/no-unused-styles: warn`, `react-native/no-inline-styles: warn`, `react-native/no-color-literals: warn` (flat config only), `react-native/no-raw-text: off`, `react-native/sort-styles: off`.
  - `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn`.
  - `no-unused-vars: ['warn', { argsIgnorePattern: '^_' }]` — `_`-prefixed args intentionally ignored.
  - `no-console: warn` — `console.log`/`console.error` with emoji prefixes are the logging pattern; lint warns but `npm run lint` and `check.bat` gate on zero errors.
- **Ignore patterns:** `node_modules/`, `.expo/`, `dist/`, `web-build/`, `android/`, `ios/`, `KwestUpPC/` (+ `assets/**` in flat config).
- **Test override:** `eslint.config.js` declares Jest globals (`describe`, `it`, `test`, `expect`, `beforeEach/afterEach`, `beforeAll/afterAll`, `jest`) as `readonly` for `__tests__/**/*.{js,jsx}` and `*.test.{js,jsx}`.
- **Formatting:** Enforced by convention: double quotes, semicolons, 2-space indent, trailing commas — see `src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/components/TaskCard.js`.
- **Babel:** `babel.config.js` uses `presets: ['babel-preset-expo']` + `plugins: ['react-native-reanimated/plugin']` (Reanimated plugin must stay last).
- **TypeScript strictness:** Incremental / opt-in. Codebase is primarily JavaScript (`src/**/*.js`), with TypeScript used in `widgets/*.tsx`. JSDoc `@param`/`@returns` blocks are the primary typing standard across `src/utils/`.

## Naming (files, components, services, tests)

- **Files:** `PascalCase.js` for components, screens, contexts, navigators (`src/components/TaskCard.js`, `src/screens/TaskListScreen.js`, `src/context/TaskContext.js`, `src/navigation/AppNavigator.js`); `camelCase.js` for utilities/services (`src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/utils/aiService.js`, `src/utils/syncService.js`, `src/utils/exportService.js`). Theme files lowercase (`src/theme/colors.js`, `src/theme/styles.js`).
- **Components:** PascalCase named exports (`export const TaskCard = ...`). Shared primitives use `Custom*` prefix (`CustomButton`, `CustomTextInput`). Glassmorphic components use `LiquidGlass*`.
- **Contexts:** `*Context.js` + `*Provider` + `use*` hook in `src/context/` (`TaskContext.js` → `TaskProvider`/`useTasks`, `VaultContext.js` → `VaultProvider`/`useVaults`, `BillingContext.js` → `BillingProvider`/`useBilling`, `BirthdayContext.js` → `BirthdayProvider`/`useBirthdays`).
- **Services / utils:** camelCase named exports, verb-first (`getLocalDateString`, `parseLocalDate` in `dateUtils.js`; `toggleTask`, `completeTask` in `taskMutations.js`; `verifyModelIntegrity`, `loadModel`, `unloadModel` in `aiService.js`).
- **Storage keys:** `kwestup_<domain>_<version>` (`kwestup_data_v7.0`, `kwestup_userName_v7.0`; constants `APP_VERSION = "v3.5.0"`, `STORAGE_VERSION = "v7.0"` in `src/utils/storage.js`).
- **Tests:** Mirror source name + `.test.js` under `__tests__/unit/`: `aiService.test.js`, `dateUtils.test.js`, `taskMutations.test.js`, `taskContext.test.js`, `syncService.test.js`, `exportImportService.test.js`, `storageMigration.test.js`, `vaultAndFileStorage.test.js`.

## Architectural Conventions

- **Local Date Authority:** Always use `src/utils/dateUtils.js` (`getLocalDateString`, `parseLocalDate`, `getTomorrowLocalDateString`, etc.). Direct UTC slicing (`new Date().toISOString().slice(0, 10)`) is strictly forbidden to prevent negative timezone shifts.
- **Pure Mutation Layer:** Core domain transformations (task completion, recurrence calculation, list creation) are implemented as pure, framework-agnostic functions in `src/utils/taskMutations.js`. Handlers return new immutable objects without directly touching React state or AsyncStorage.
- **Deterministic Time Injection:** Pure functions accept optional `{ now, todayDate }` injection so that unit tests can verify behavior with exact timestamps without mocking system clocks.
- **Memory Lifecycle & Timer Unref:** In services managing timeouts or active native handles (like `aiService.js`), always provide an unloader (`unloadModel()`), attach `AppState` background listeners, and call `.unref()` on `setTimeout` handles in Node/Jest environments to prevent hanging open handles.
- **Defensive Fallback Pipelines:** If an on-device native service (such as `llama.rn`) encounters an initialization error or OOM, callers catch the failure, clean up stale handles, and seamlessly fall back to rule-based heuristics (`extractTasksFromNoteHeuristic`, `summarizeNoteHeuristic`).

## Error Handling & Validation Patterns

- **Pure validators throw descriptive `Error`s:** `validateSyncConfig` and `validateSyncPayload` in `src/utils/syncService.js` validate network inputs and throw actionable error messages with specific guidance.
- **Non-throwing date contract:** `src/utils/dateUtils.js` returns empty string `''` or `Invalid Date` rather than throwing, preventing unhandled exceptions in UI render loops.
- **Async boundaries with safe defaults:** Storage operations catch errors, log diagnostics, and return safe default values or false rather than crashing the application.
- **Destructive action guards:** List deletion preserves `default_inbox`; storage wipe requires confirmation; sync requires presence of array keys in payload before replacing local state.
