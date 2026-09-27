# Testing

**Analysis Date:** 2026-09-28

## Framework & Config (Jest + Babel, presets, mocks)

- **Runner:** Jest `^29.7.0` via `jest-expo@~53.0.0`, preset `jest-expo/android` (`jest.config.js:4`), pulling the Android preset's `setupFiles` plus `<rootDir>/__tests__/setup/jest.setup.js` (`jest.config.js:5-8`).
- **Transform:** `babel-jest` through `babel.config.js` (`babel-preset-expo` + `react-native-reanimated/plugin`). `transformIgnorePatterns` (`jest.config.js:9-11`) whitelists RN/Expo/navigation/Reanimated/Paper/SVG/modal/confetti-cannon/`llama.rn`/`react-native-android-widget` for transformation — required for headless Android-preset runs.
- **Module resolution:** `moduleFileExtensions` prioritizes `android.js/jsx/ts/tsx` before plain `js/jsx/ts/tsx` (`jest.config.js:12-23`), matching the Android widget + `widgets/widget-task-handler.tsx` target.
- **Discovery:** `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` (`jest.config.js:24`) — only files inside `__tests__/` run. `collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.styles.js']` (`jest.config.js:25-29`).
- **Global mocks (`__tests__/setup/jest.setup.js`):** official `AsyncStorage` in-memory mock; `expo-file-system` virtual FS (`Map` + `mockNormalizePath`, seeded `/mock-docs/`, `/mock-cache/`, helpers `__inMemoryFS`/`__resetFS`); `llama.rn` (`initLlama` → mock context with `completion`/`release`/`tokenize`); `react-native-android-widget` (`requestWidgetUpdate`, `registerWidgetTaskHandler`, `FlexWidget`/`TextWidget`/`IconWidget` stubs); `expo-notifications`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-camera`; `react-native-reanimated`.
- **Test conventions:** `import` source relatively (`../../src/utils/...`); `beforeEach` clears `AsyncStorage` (+ `FileSystem.__resetFS()` where FS is touched) and `jest.clearAllMocks()`; deterministic time via injected `now`/`todayDate` options (`taskMutations` functions accept `{ now, todayDate }`); provider tests use `react-test-renderer` + `await act(async () => …)`.

## Test Suites

| Suite | Path | Count | What it covers |
|---|---|---:|---|
| On-device AI service (Phase 18) | `__tests__/unit/aiService.test.js` | 29 | Upstream model commit pinning, SHA-256 verification, size integrity, corruption deletion, coalescing Promise mutex, `getModelContextStatus`, `handleAppStateChange` background unloader, idle timeout unloader, heuristic task extraction, heuristic summarization, inference fallbacks |
| Date utils (Phase 15) | `__tests__/unit/dateUtils.test.js` | 28 | `getLocalDateString` (default-today, local fields, epoch ms, `''` on invalid, leap years), `parseLocalDate` (local midnight, leap day, Date/number cloning, invalid inputs), yesterday/tomorrow boundaries, month/day formatting, `isSameLocalDay` |
| Sync service validation + handshake (Phase 16) | `__tests__/unit/syncService.test.js` | 16 | `validateSyncConfig` (IPv4/hostname/localhost accept, octet rejection, port 1–65535, token ≥6 chars), `validateSyncPayload` (defaults `taskLists`, rejects null/missing arrays), `pingSyncServer`, `performSync` (offline error, Bearer auth, merged result) |
| Task mutations (Phase 17) | `__tests__/unit/taskMutations.test.js` | 15 | `toggleTask` non-recurring complete/incomplete, daily/weekly/monthly recurrence date math + parent replacement, progressive title increment (`Day 1→2`), invalid-`dueDate` fallback; `completeTask`, `saveTask`, `deleteTask`, `toggleSubtask`, list create/rename/delete |
| Vault + file storage | `__tests__/unit/vaultAndFileStorage.test.js` | 11 | `getVaultPath` layout, `ensureVaultsDir`, vault create/active/rename/delete (+FS dir lifecycle), note save with title sanitization, note read/delete, folder delete, `getAllNotesFromFilesystem` scan |
| Export/import + crypto envelope (Phase 16) | `__tests__/unit/exportImportService.test.js` | 10 | `encryptBackup`/`decryptBackup` round-trip, v2 envelope (`v:2`, PBKDF2-SHA256, 100k iters, 32-char hex salt/iv), random salt/IV uniqueness, legacy v1 static-salt fallback; `exportArchive` share sheet, `importArchive` restore |
| Widget logic (Phase 12) | `__tests__/phase12-widget-logic.test.js` | 10 | Local pure-function equivalents tagged `[12-P1]`–`[12-P10]`: toggle complete/uncomplete, tab guard, uncompleted-first sort, 8-task slice cap, important-only filter capped at 5 |
| Storage migration + vault fallback (Phase 16) | `__tests__/unit/storageMigration.test.js` | 9 | `isUserDataKey` classification, `clearAllCaches` preserving user data/telemetry/AI-model keys, `migrateUserDataIfNeeded` highest-legacy-wins, legacy `v5.0` vault/active-id auto-migration |
| Task context provider (Phase 17) | `__tests__/unit/taskContext.test.js` | 5 | `TaskProvider` initial-tasks render, `toggleTaskComplete`, `handleSaveTask`, `deleteTask`, `refreshTasksFromStorage` widget-parity sync via `react-test-renderer` + consumer hook |
| Mock harness smoke | `__tests__/setup/jest.setup.test.js` | 5 | `AsyncStorage` set/get/remove/`getAllKeys`, virtual FS mkdir/write/read/ls/delete, `llama.rn` init/completion/release, `requestWidgetUpdate` passthrough |
| **Total** | 10 suites | **138** | |

## Coverage & CI Gates

- **CI (`.github/workflows/ci.yml`):** Runs on `push`/`pull_request` against `main` and `development`. Executes `npm run lint` followed by `npm test -- --ci --maxWorkers=2 --coverage` on Node 20.
- **Local gate (`check.bat`):** Runs `npm run lint` and `npm test`, aborting (`exit /b 1`) on any failure.

## How to Run

```bash
npm test               # Jest all 10 suites, headless Android preset (--passWithNoTests)
npm run test:watch     # Jest in interactive watch mode
npm run test:coverage  # Jest with coverage collection
npm run lint           # ESLint across codebase
check.bat              # Full local toolchain check -> lint -> test validation
```
