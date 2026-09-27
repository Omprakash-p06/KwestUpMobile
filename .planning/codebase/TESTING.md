# Testing

**Analysis Date:** 2026-09-27

## Framework & Config (Jest + Babel, presets, mocks)

- **Runner:** Jest `^29.7.0` + `babel-jest` `^29.7.0`, Babel via `babel-preset-expo` (`babel.config.js:2`) plus `react-native-reanimated/plugin` (`babel.config.js:4`).
- **Preset:** `jest-expo/android` (`jest.config.js:4`) with Android-first `moduleFileExtensions` (`android.js/jsx/ts/tsx` before `js/jsx/ts/tsx/json/node`, `jest.config.js:12-23`).
- **Setup:** `setupFiles: [...expoAndroidPreset.setupFiles, '<rootDir>/__tests__/setup/jest.setup.js']` (`jest.config.js:4-8`). The harness `__tests__/setup/jest.setup.js` (178 lines) mocks every native/Expo boundary:
  1. `@react-native-async-storage/async-storage` → official `async-storage-mock`.
  2. `expo-file-system` → in-memory `Map` FS (`file:///mock-docs/`, `file:///mock-cache/`) implementing `getInfoAsync/makeDirectoryAsync/writeAsStringAsync/readAsStringAsync/deleteAsync/readDirectoryAsync/copyAsync/moveAsync` + `__resetFS()` helper.
  3. `llama.rn` → `initLlama` resolving `{ completion/tokenize/detokenize/release }`; `releaseAllLlama` → `true`.
  4. `react-native-android-widget` → `requestWidgetUpdate` → `true`, string stubs for `FlexWidget/TextWidget/IconWidget`.
  5. `expo-notifications` / `expo-haptics` / `expo-sharing` / `expo-document-picker` / `expo-camera` → resolved-promise stubs (permissions `granted`).
  6. `react-native-reanimated` → `require('react-native-reanimated/mock')`.
- **Discovery:** `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` (`jest.config.js:24`) — only files under `__tests__/` run. `transformIgnorePatterns` whitelists RN/Expo/nav/reanimated/paper/svg/widgets/`llama.rn` for transform (`jest.config.js:9-11`).
- **Coverage collection:** `collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.styles.js', '!**/node_modules/**']` (`jest.config.js:25-29`). No thresholds configured.
- **Types:** `@types/jest ^29.5.14` present though tests are JS; `@types/react ~19.0.10`.

## Test Suites (table: suite | path | count | what it covers)

Counts = `it(` occurrences per file; total **88 tests across 7 suites**, all passing (verified `npx jest --coverage --ci`: `Test Suites: 7 passed, 7 total / Tests: 88 passed, 88 total`).

| Suite | Path | Count | What it covers |
|---|---|---|---|
| Date utils | `__tests__/unit/dateUtils.test.js` | 27 | `src/utils/dateUtils.js`: local `YYYY-MM-DD` formatting, `parseLocalDate` local-midnight, yesterday/tomorrow rollovers (month/year/leap), `YYYY-MM`/`MM-DD` slices, `isSameLocalDay` incl. invalid-input guards |
| Sync service | `__tests__/unit/syncService.test.js` | 16 | `src/utils/syncService.js`: `validateSyncConfig` (IPv4/hostname, path-injection, port bounds, token length), `validateSyncPayload` (missing `notes/tasks/birthdays`), `pingSyncServer` (online/offline/throw), `performSync` (pre-flight validation, offline error, `POST /sync` bearer flow, malformed-payload and 401/403 paths); `global.fetch` mocked per-test, restored in `afterAll` |
| Export/import | `__tests__/unit/exportImportService.test.js` | 10 | `src/utils/exportService.js` + `src/utils/vaultImport.js`: export/import round-trips against mocked FS/AsyncStorage |
| Storage migration | `__tests__/unit/storageMigration.test.js` | 9 | `src/utils/storage.js`: `migrateUserDataIfNeeded` version-key migration, `clearAllCaches` user-data preservation |
| Vault + file storage | `__tests__/unit/vaultAndFileStorage.test.js` | 11 | `src/utils/vaultService.js` + `src/utils/fileStorage.js`: vault CRUD and file read/write/delete on the in-memory FS mock |
| Widget logic (Phase 12) | `__tests__/phase12-widget-logic.test.js` | 10 | Pure-function equivalents of widget handlers (`[12-P1]`–`[12-P10]`): task toggle set/clear metadata, no-op guards, tab allowlist, sort-incomplete-first + 8-cap slice, important-only 5-cap filter |
| Mock-harness smoke | `__tests__/setup/jest.setup.test.js` | 5 | Verifies the harness itself: AsyncStorage set/get/remove/`getAllKeys`, FS mkdir→write→read→readdir→delete, `llama.rn` completion, `requestWidgetUpdate`; resets state via `AsyncStorage.clear()` + `FileSystem.__resetFS()` in `beforeEach` |

**Common patterns:** `describe` per module → nested `describe` per function (`__tests__/unit/dateUtils.test.js:17-18`); `jest.clearAllMocks()` in `beforeEach`, `global.fetch = jest.fn()` reassignment per network case (`__tests__/unit/syncService.test.js:6-11`); error paths asserted with `.rejects.toThrow('<message fragment>')`.

## Coverage & CI Gates

- **Latest full run** (`npx jest --coverage --ci`, 2026-09-27): high in tested services, zero in UI:
  - `dateUtils.js` 95% stmts / 73% branch; `syncService.js` 95% / 81%; `storage.js` 92% / 70%; `exportService.js` 67% / 51%; `fileStorage.js` 67% / 43%; `vaultService.js` 64% / 62%; `billingStorage.js` 21%; `billingNotifications.js` 10%.
  - `0%` — all 9 `src/screens/*.js`, all 14 `src/components/*.js` (except theme re-export), `src/theme/styles.js`, `src/utils/aiService.js`, `src/utils/diagnostics.js`, `src/utils/notifications.js`, `src/utils/vaultImport.js`, `src/navigation/*`.
  - Committed artifacts in `coverage/` (`lcov.info`, `lcov-report/`, `coverage-final.json`, `clover.xml`) — generated output is checked in.
- **CI gates** (`.github/workflows/ci.yml`, `CI Pipeline (Lint & Test)`): on push/PR to `main`/`development` → Node 20 → `npm install` → `npm run lint` (hard fail on ESLint errors) → `npm test -- --ci --maxWorkers=2 --coverage` (hard fail on any test failure; coverage is *reported*, no threshold enforced). Companion `.github/workflows/semgrep.yml` runs `semgrep/semgrep-action@v1` with `config: auto` (security scan, non-blocking for Jest).

## How to Run (commands from package.json / check.bat)

```bat
npm test                REM jest --passWithNoTests — full suite (package.json:12)
npm run test:watch      REM jest --watch — dev loop (package.json:13)
npm run test:coverage   REM jest --coverage — with coverage table (package.json:14)
npm run lint            REM eslint . — must pass before tests in gate order (package.json:10)
check.bat               REM end-to-end local gate: env checks → npm run lint → npm test, aborts on first failure
```

Single-suite runs (Jest `testMatch`-compatible, from repo root):

```bat
npx jest __tests__/unit/dateUtils.test.js
npx jest __tests__/unit/syncService.test.js --coverage --collectCoverageFrom="src/utils/syncService.js"
```

## Gaps / Notes

1. **No UI/component tests** — zero suites render any screen or component (`TaskCard`, `TaskEditModal`, `AIAssistant`, `DashboardScreen`, navigation all at 0%). Risk: regressions in birthday countdown math duplicated in `TaskCard.js`/`DashboardScreen.js` (which intentionally bypass `dateUtils` with raw `new Date`) are invisible to Jest. Add `@testing-library/react-native` render tests starting with `TaskCard` birthday branch.
2. **Untested services with real failure modes** — `aiService.js` (model download/resume/parse fallback, 634 lines), `notifications.js`, `diagnostics.js`, `vaultImport.js`, `billingNotifications.js` (10%) have no or thin coverage; `llama.rn` mock exists but no suite exercises `aiService` through it.
3. **Widget suite tests copies, not code** — `phase12-widget-logic.test.js` re-implements `toggleTaskInList/sortAndSliceTasks/filterImportantTasks` locally instead of importing the widget source, so it can pass while production drifts. Refactor to import from `widgets/` or the real handler module.
4. **Coverage dir committed** — `coverage/` output is checked into git; consider `.gitignore`-ing it and uploading via `actions/upload-artifact` instead to avoid stale diffs.
5. **No thresholds, warns don't fail** — `jest.config.js` sets no `coverageThreshold`, and `npm run lint` passes with warnings (`no-console`, inline-style warns are pervasive by design). Tightening either gate is a conscious choice, not an omission — see `CONVENTIONS.md` § Code Style.
6. **Preset skew** — suite runs on `jest-expo/android` only; iOS-specific paths (`.ios.js` extensions aren't in `moduleFileExtensions`) and native widget code under `android/` + `widgets/` are untested by construction.

---

*Testing analysis: 2026-09-27*
