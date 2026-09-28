# Testing

**Analysis Date:** 2026-09-28

## Framework & Config (Jest + Babel, presets, mocks)

- **Runner:** Jest 29 (`jest: ^29.7.0`, `babel-jest: ^29.7.0`, `@types/jest: ^29.5.14` in `package.json` devDependencies) with `jest-expo ~53.0.0`.
- **Preset:** `jest-expo/android` — `jest.config.js:1-4` imports `jest-expo/android/jest-preset.js` and spreads its `setupFiles`, then appends `<rootDir>/__tests__/setup/jest.setup.js`.
- **Babel:** `babel-preset-expo` (`babel.config.js`); production strips `console.log/info/debug` via `babel-plugin-transform-remove-console` (keeps `error/warn`).
- **Test discovery:** `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` (`jest.config.js:24`) — only files under `__tests__/` run. `testPathIgnorePatterns` is not customized.
- **Module resolution:** `moduleFileExtensions` prioritizes `android.js/android.jsx/android.ts/android.tsx` before `js/jsx/ts/tsx/json/node` (`jest.config.js:12-23`).
- **Transform:** `transformIgnorePatterns` whitelists RN/Expo/Llama/Widget packages so they transform under Jest (`jest.config.js:9-11`).
- **Coverage collection:** `collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.styles.js', '!**/node_modules/**']` (`jest.config.js:25-29`); styles files excluded.
- **Global mocks — `__tests__/setup/jest.setup.js` (208 lines):**
  1. `@react-native-async-storage/async-storage` → official in-memory mock.
  2. `expo-file-system` → in-memory virtual FS (`Map` + `mockNormalizePath`, seeded `/mock-docs/`, `/mock-cache/`; exposes `__inMemoryFS`/`__resetFS`; implements `getInfoAsync/makeDirectoryAsync/writeAsStringAsync/readAsStringAsync/deleteAsync/readDirectoryAsync/copyAsync/moveAsync`).
  3. `llama.rn` → `initLlama` resolves `{completion, release, tokenize, detokenize}`; `releaseAllLlama` resolves `true`.
  4. `react-native-android-widget` → `requestWidgetUpdate` resolves `true`, `registerWidgetTaskHandler` noop, string component stubs.
  5. `expo-notifications` / `expo-haptics` / `expo-sharing` / `expo-document-picker` / `expo-camera` / `expo-clipboard` / `@expo/vector-icons` (React `Text`-based `MockIcon`) / `react-native-reanimated` (official `react-native-reanimated/mock`).
- **Mock hygiene convention:** suites reset state in `beforeEach` — `AsyncStorage.clear()` + `FileSystem.__resetFS()` (see `__tests__/setup/jest.setup.test.js:7-12`); AI suites `jest.useRealTimers(); await unloadModel(); jest.clearAllMocks(); initLlama.mockReset(); releaseAllLlama.mockReset()` (see `__tests__/unit/aiService.test.js:33-41`). Console fns stubbed/restored per-test in logger-adjacent suites (`__tests__/unit/logger.test.js:20-42`).

## Test Suites (table: suite | path | count | what it covers)

Counts are `it(`/`test(` occurrences per file (headers verified; total ≈ 174–179).

| Suite | Path | Count | What it covers |
|---|---|---|---|
| aiService (pipeline hardening + memory lifecycle) | `__tests__/unit/aiService.test.js` | 40 | Model pinning constants, `verifyModelIntegrity`/`isModelDownloaded`, `loadModel` mutex, idle-unload/AppState lifecycle, heuristic extractors/summarizers, inference-fallback resilience, SHA-256 default path, unload-while-inflight race, native-release on inference error, numbered-list precision, AppState subscription lifecycle |
| dateUtils | `__tests__/unit/dateUtils.test.js` | 28 | `getLocalDateString`, `parseLocalDate` (strict), yesterday/tomorrow helpers, month/month-day strings, `isSameLocalDay` |
| logger | `__tests__/unit/logger.test.js` | 19 | Dev-mode emission per level, prod suppression of debug/info, ring-buffer FIFO eviction at 50, `babel.config.js` strip-config verification |
| syncService | `__tests__/unit/syncService.test.js` | 16 | `validateSyncConfig`, `validateSyncPayload`, `pingSyncServer`, `performSync` |
| taskMutations | `__tests__/unit/taskMutations.test.js` | 15 | `toggleTask` + `calculateNextRecurrence`, `completeTask`, `saveTask`, `deleteTask`, `toggleSubtask`, task-list CRUD |
| vault + fileStorage | `__tests__/unit/vaultAndFileStorage.test.js` | 11 | `vaultService` path/dir init, vault CRUD + active-vault state, `fileStorage` note persistence + filename sanitization |
| export/import | `__tests__/unit/exportImportService.test.js` | 10 | `encryptBackup`/`decryptBackup` round-trip, `exportArchive` pipeline, `importArchive` pipeline |
| ErrorBoundary | `__tests__/unit/errorBoundary.test.js` | 10 | Crash fallback render, retry reset, copy-report path, details toggle, themed variants |
| widget logic (Phase 12) | `__tests__/phase12-widget-logic.test.js` | 10 | Pure-function equivalents of widget handler: toggle-in-list, tab validation, sort/slice (limit 8) |
| storage migration | `__tests__/unit/storageMigration.test.js` | 9 | `isUserDataKey` filter, `clearAllCaches`, `migrateUserDataIfNeeded`, vault version-migration + key fallback |
| TaskContext provider | `__tests__/unit/taskContext.test.js` | 5 | Provider state sync, mutation write-through paths |
| AIAssistant smoke | `__tests__/unit/aiAssistant-smoke.test.js` | 1 | Component import/render smoke (`C-2`) |
| jest.setup harness self-test | `__tests__/setup/jest.setup.test.js` | ~5 | AsyncStorage mock, virtual FS, llama/widget/notification mocks sanity (file is 87 lines; also matched by `testMatch` so it runs as a suite) |

## Coverage & CI Gates

- **CI — `.github/workflows/ci.yml` (`CI Pipeline (Lint & Test)`):** triggers on `push`/`pull_request` to `main` + `development`; `ubuntu-latest`, Node 20 with npm cache; steps: `npm install` → `npm run lint` → `npm test -- --ci --maxWorkers=2 --coverage`. There is no coverage-threshold gate (`--coverage` reports only) and no `tsc` step.
- **Security scan — `.github/workflows/semgrep.yml`:** Semgrep `config: auto` on the same branch triggers; repo-local suppressions in `.semgrepignore`.
- **Coverage artifacts:** `coverage/` is present locally (`clover.xml`, `coverage-final.json`, `lcov.info`, `lcov-report/`); `collectCoverageFrom` covers `src/**` except `*.styles.js`.
- **Local gate — `check.bat`:** verifies `node`/`npm`/`git`/`expo` exist, then `npm run lint` (fail → exit 1), then `npm test` (fail → exit 1). Run before pushing; mirrors CI without `--coverage`.

## How to Run (commands from package.json / check.bat)

```bat
npm test                  REM all suites headless (jest --passWithNoTests)
npm run test:watch        REM watch mode (jest --watch)
npm run test:coverage     REM with coverage (jest --coverage)
npm run lint              REM ESLint over repo (dual .eslintrc.js + eslint.config.js)
check.bat                 REM env checks + lint + full test suite (pre-push gate)
```

Single-suite runs (not in scripts, standard Jest):

```bat
npx jest __tests__/unit/aiService.test.js
npx jest __tests__/unit/logger.test.js --coverage --collectCoverageFrom="src/utils/logger.js"
```

## Gaps / Notes

- **No E2E / component coverage beyond smoke:** only `aiAssistant-smoke.test.js` (1 test) and `errorBoundary.test.js` touch components; no Detox/Maestro/Expo E2E harness. Screens (`src/screens/*`), navigation (`src/navigation/AppNavigator.js`), and most `src/components/*` are untested.
- **Thin provider coverage:** `taskContext.test.js` has 5 tests vs 366 lines of `src/context/TaskContext.js` (debounced write-through, hydration races untested); `VaultContext`/`BillingContext`/`BirthdayContext` have no dedicated suites (they still use raw `console.*` — see CONVENTIONS.md).
- **Untested services:** `diagnostics.js`, `notifications.js`, `billingStorage.js`, `billingNotifications.js`, `vaultImport.js` have no suites; `storage.js` only via migration tests.
- **Widget tests are duplicates, not imports:** `phase12-widget-logic.test.js` re-implements handler pure functions locally instead of importing `widgets/widget-task-handler.tsx` — logic drift will not be caught. `taskMutations.js` (shared engine) *is* imported and tested — prefer that pattern.
- **Timers are real by default:** AI suites explicitly call `jest.useRealTimers()`; no fake-timer discipline for debounce/idle-timeout paths (`IDLE_UNLOAD_TIMEOUT_MS` 5 min never exercised under fake timers).
- **`jest.setup.test.js` runs as a suite** (matches `testMatch`) — intentional harness self-test, not stray config; keep it green when editing `jest.setup.js`.
- **Line-count reference (largest suites):** `aiService.test.js` 659 lines, `errorBoundary.test.js` 304, `taskMutations.test.js` 307, `logger.test.js` 257, `syncService.test.js` 217.

---

*Testing analysis: 2026-09-28*
