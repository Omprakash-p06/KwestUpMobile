# Testing

**Analysis Date:** 2026-09-28

## Framework & Config (Jest + Babel, presets, mocks)

- **Runner:** Jest `^29.7.0` via `jest-expo@~53.0.0`, preset `jest-expo/android` (`jest.config.js:4`), pulling the Android preset's `setupFiles` plus `<rootDir>/__tests__/setup/jest.setup.js` (`jest.config.js:5-8`).
- **Transform:** `babel-jest` through `babel.config.js` (`babel-preset-expo` + `react-native-reanimated/plugin`). `transformIgnorePatterns` (`jest.config.js:9-11`) whitelists RN/Expo/navigation/Reanimated/Paper/SVG/modal/confetti-cannon/`llama.rn`/`react-native-android-widget` for transformation — required for headless Android-preset runs.
- **Module resolution:** `moduleFileExtensions` prioritizes `android.js/jsx/ts/tsx` before plain `js/jsx/ts/tsx` (`jest.config.js:12-23`), matching the Android widget + `widgets/widget-task-handler.tsx` target.
- **Discovery:** `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` (`jest.config.js:24`) — only files inside `__tests__/` run. `collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.styles.js']` (`jest.config.js:25-29`).
- **Global mocks (`__tests__/setup/jest.setup.js`, 178 lines):** official `AsyncStorage` in-memory mock; `expo-file-system` virtual FS (`Map` + `mockNormalizePath`, seeded `/mock-docs/`, `/mock-cache/`, helpers `__inMemoryFS`/`__resetFS`); `llama.rn` (`initLlama` → mock context with `completion`/`release`/`tokenize`); `react-native-android-widget` (`requestWidgetUpdate`, `registerWidgetTaskHandler`, `FlexWidget`/`TextWidget`/`IconWidget` stubs); `expo-notifications`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-camera`; `react-native-reanimated` (`require('react-native-reanimated/mock')`). Verified by `__tests__/setup/jest.setup.test.js` (5 smoke tests).
- **Test conventions:** `import` source relatively (`../../src/utils/...`); `beforeEach` clears `AsyncStorage` (+ `FileSystem.__resetFS()` where FS is touched) and `jest.clearAllMocks()`; deterministic time via injected `now`/`todayDate` options (`taskMutations` functions accept `{ now, todayDate }`) instead of fake timers; provider tests use `react-test-renderer` + `await act(async () => …)`.

## Test Suites (table: suite | path | count | what it covers)

| Suite | Path | Count | What it covers |
|---|---|---:|---|
| Date utils (hardened, expanded) | `__tests__/unit/dateUtils.test.js` | 28 | `getLocalDateString` (default-today, local fields, pass-through, epoch ms, `''` on null/empty/invalid/leap-invalid, leap acceptance), `parseLocalDate` (local midnight, leap day, Date/number cloning, `Invalid Date`-never-today incl. epoch `0`), yesterday/tomorrow (regular, month/year boundaries, leap vs non-leap Feb/Mar), `getLocalMonthString`/`getLocalMonthDayString` slicing, `isSameLocalDay` (identical, cross-hour same day, adjacent-day false, null/invalid false) |
| Task mutations (NEW pure engine) | `__tests__/unit/taskMutations.test.js` | 15 | `toggleTask` non-recurring complete/incomplete with `completedDate`/`completedAt` clearing, daily/weekly/monthly recurrence date math + parent replacement + `notificationId` reset, progressive title increment (`Day 1→2`, `99→100`, no-number `→ - 2`), invalid-`dueDate` fallback; `completeTask`, `saveTask` (create with generated id + `default_inbox`, update preserving `createdAt`), `deleteTask`, `toggleSubtask`, list create/rename/delete incl. `default_inbox` protection |
| Task context provider (NEW) | `__tests__/unit/taskContext.test.js` | 5 | `TaskProvider` initial-tasks render, `toggleTaskComplete`, `handleSaveTask` (defaults `listId`), `deleteTask`, `refreshTasksFromStorage` widget-parity sync (`kwestup_data_${STORAGE_VERSION}` external write → in-memory state) via `react-test-renderer` + consumer hook |
| Export/import + crypto envelope | `__tests__/unit/exportImportService.test.js` | 10 | `encryptBackup`/`decryptBackup` round-trip, v2 envelope (`v:2`, PBKDF2-SHA256, 100k iters, 32-char hex salt/iv), random salt/IV uniqueness, legacy v1 static-salt fallback, tampered-envelope/wrong-passphrase/corrupt-input errors; `exportArchive` (progress + `Sharing.shareAsync` `.kwestup` + temp cleanup), `importArchive` (decrypt → restore `AsyncStorage` + vault `.md` files, wrong-passphrase rejection) |
| Sync service validation + handshake | `__tests__/unit/syncService.test.js` | 16 | `validateSyncConfig` (IPv4/hostname/localhost accept, path/fragment/octet rejection, port 1–65535, token ≥6 chars), `validateSyncPayload` (defaults `taskLists`, rejects null/non-object/missing arrays), `pingSyncServer` (online/false/network-throw), `performSync` (no-fetch on bad config, offline error, POST `/sync` Bearer + merged result, malformed-payload and 401/403 auth errors) with `global.fetch` mocked per-test |
| Storage migration + vault fallback | `__tests__/unit/storageMigration.test.js` | 9 | `isUserDataKey` protected vs transient classification, `clearAllCaches` preserving user data/telemetry/AI-model keys while clearing UI/version/sidebar/temp caches + stamping `kwestup_last_version`/`kwestup_last_clear`, `migrateUserDataIfNeeded` skip/no-legacy/highest-legacy-wins (data, settings, vaults, billing), legacy `v5.0` vault/active-id auto-migration |
| Vault + file storage | `__tests__/unit/vaultAndFileStorage.test.js` | 11 | `getVaultPath` layout, `ensureVaultsDir`, vault create/active/rename/delete (+FS dir lifecycle), note save with title sanitization (`Sprint: Planning / Architecture?` → `Sprint__Planning___Architecture_.md`), read/missing-returns-`''`, note delete, folder delete, `getAllNotesFromFilesystem` scan |
| Widget logic (Phase 12) | `__tests__/phase12-widget-logic.test.js` | 10 | Local pure-function equivalents tagged `[12-P1]`–`[12-P10]`: toggle complete/uncomplete/unknown-id/empty-list/null-raw, tab guard (`tasks`/`daily`/`timer` valid), uncompleted-first sort, 8-task slice cap, important-only filter capped at 5 |
| Mock harness smoke | `__tests__/setup/jest.setup.test.js` | 5 | `AsyncStorage` set/get/remove/`getAllKeys`, virtual FS mkdir/write/read/ls/delete, `llama.rn` init/completion/release, `requestWidgetUpdate` passthrough |
| **Total** | 9 suites | **109** | |

Counts verified by reading each `*.test.js` (`it(` blocks). `dateUtils` count is 28 as specified.

## Coverage & CI Gates

- **CI (`.github/workflows/ci.yml`, 30 lines):** `CI Pipeline (Lint & Test)` on `push`/`pull_request` to `main`/`development`; job `lint-and-test` on `ubuntu-latest` with Node 20 + npm cache: `npm install` → `npm run lint` (`eslint .`) → `npm test -- --ci --maxWorkers=2 --coverage`. No coverage-threshold flags (`--coverage` reports only; `jest.config.js` sets no `coverageThreshold`), and no `--max-warnings 0` on lint — gates are pass/fail of suites + ESLint errors, not numeric thresholds.
- **Local gate (`check.bat:43-60`):** verifies `node`/`npm`/`git`/`expo`, then `npm run lint` and `npm test`, aborting (`exit /b 1`) on the first failure.
- **Coverage artifacts:** `coverage/` is committed (`clover.xml`, `coverage-final.json`, `lcov.info`, `lcov-report/`); `collectCoverageFrom` covers `src/**/*.{js,jsx,ts,tsx}` except `*.styles.js`. No enforced minimum detected in `jest.config.js` or CI.

## How to Run (commands from package.json / check.bat)

```bat
npm test              REM Jest all suites, headless Android preset (--passWithNoTests)
npm run test:watch    REM jest --watch
npm run test:coverage REM jest --coverage
npm run lint          REM eslint .  (same gate CI + check.bat run first)
npm run lint:report   REM eslint . --format json --output-file eslint-report.json
check.bat             REM full local gate: toolchain check -> lint -> tests
```

Notes: `npm test` maps to `jest --passWithNoTests` (`package.json:12`); CI appends `--ci --maxWorkers=2 --coverage`. No per-suite script exists — target a file with `npx jest __tests__/unit/dateUtils.test.js` (works: matches `testMatch`). `postinstall` runs `node patch-llama-gradle.js` (native build patch, unrelated to tests).

## Gaps / Notes

- **No component/screen/E2E tests:** all 109 tests are logic/service/provider-level; nothing renders `src/components/*` (e.g. `TaskCard.js`, `TaskEditModal.js`), `src/screens/*` (9 screens), `src/navigation/*`, or `App.js` boot flow; no Detox/Maestro/Playwright/Cypress detected in `package.json`.
- **Provider coverage is thin:** only `TaskContext` has a suite (5 tests); `VaultContext`, `BillingContext`, `BirthdayContext` have none despite `App.js` composing all four.
- **Untested utils:** `aiService.js`, `notifications.js` (scheduling/cancellation side effects), `billingStorage.js`, `billingNotifications.js`, `diagnostics.js`, `vaultImport.js`, `theme/*` have no dedicated suites; `fileStorage`/`vaultService`/`storage`/`exportService`/`syncService`/`dateUtils`/`taskMutations` are the covered core.
- **Widget handler untested directly:** `phase12-widget-logic` tests local re-implementations, not `widgets/widget-task-handler.tsx` itself; `taskMutations`/`taskContext` suites are the parity bridge (shared pure engine + storage-sync test).
- **No thresholds, no snapshots:** no `coverageThreshold`, no snapshot files, no `--max-warnings 0`; `coverage/` output is committed but not gated. `jest.setup.js` mocks (`expo-notifications`, `expo-haptics`, `llama.rn`, widget) mean notification/haptic/LLM side effects are asserted as calls or skipped, never executed.
