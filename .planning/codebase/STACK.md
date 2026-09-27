# Technology Stack

**Analysis Date:** 2026-09-28

## Languages & Runtimes

**Primary:**
- JavaScript (ES2021 per `eslint.config.js` `ecmaVersion: 2021`) — entire `src/` tree (`src/utils/`, `src/context/`, `src/screens/`, `src/components/`, `src/navigation/`, `src/theme/`), `App.js`, `index.js`
- TypeScript (incremental, widgets only) — `widgets/*.tsx` (`widgets/widget-task-handler.tsx`, `widgets/TasksListWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/FocusTimerWidget.tsx`)

**Runtimes:**
- Node.js 20 — CI runtime (`.github/workflows/ci.yml` `setup-node@v4`, `node-version: 20`); local dev via Expo CLI
- Hermes (React Native Android runtime) — implied by `react-native@0.79.5` + Expo SDK 53 Android target
- Java/Kotlin + C++ (native layer) — `android/` (Expo prebuild output), `llama.rn` native C++ bindings for on-device inference

## Frameworks

**Core:**
- Expo SDK 53 (`expo@~53.0.20`, `sdkVersion: 53.0.0` in `app.json`) — managed workflow + prebuild (`expo run:android`), entry via `index.js` → `registerRootComponent(App)`
- React 19.0.0 (`react@19.0.0`) — UI + context providers (`src/context/TaskContext.js`, `src/context/VaultContext.js`, `src/context/BirthdayContext.js`, `src/context/BillingContext.js`)
- React Native 0.79.5 (`react-native@0.79.5`) — Android-first target (`android.package: com.omprakashp06.kwestupmobile`)
- React Navigation 6 (`@react-navigation/native@^6.1.9`, `@react-navigation/drawer@^6.6.6`) — drawer navigation (`src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`)
- React Native Paper 5 (`react-native-paper@^5.10.5`) + custom theme (`src/theme/colors.js`, `src/theme/styles.js`) — component library alongside bespoke `src/components/Custom*.js` wrappers
- Reanimated 3 (`react-native-reanimated@~3.17.4`, `react-native-reanimated/plugin` in `babel.config.js`) — animations

**State:**
- React Context + `useState`/`useCallback`, no Redux/Zustand — domain stores in `src/context/` (`TaskContext.js` delegates all mutations to `src/utils/taskMutations.js`)

## Data & Storage

**On-device persistence (no cloud database):**
- `@react-native-async-storage/async-storage@2.1.2` — structured state (tasks, task lists, vault registry, billing, telemetry consent, AI download resume state). Keys namespaced `kwestup_*` (see `src/utils/storage.js`)
- `expo-file-system@~18.1.11` — markdown vault files at `<documentDirectory>Notes/Vaults/<vaultId>/` (`src/utils/vaultService.js`, `src/utils/fileStorage.js`); AI GGUF model at `<documentDirectory>models/qwen2.5-0.5b-instruct-q4_k_m.gguf` (`src/utils/aiService.js`); temp backup at `<cacheDirectory>kwestup-backup.kwestup` (`src/utils/exportService.js`)

**Storage versioning:**
- `STORAGE_VERSION = "v7.0"` in `src/utils/storage.js` — all versioned keys built dynamically (`kwestup_data_${STORAGE_VERSION}`, `kwestup_vaults_${STORAGE_VERSION}`, `kwestup_billing_${STORAGE_VERSION}`, `kwestup_timer_state_${STORAGE_VERSION}`). Legacy `kwestup_vaults_v5.0` / `kwestup_activeVault_v5.0` fallback retained in `src/utils/vaultService.js`
- `migrateUserDataIfNeeded()` in `src/utils/storage.js` migrates highest-versioned `kwestup_data_v*` payload plus vault/billing keys forward; `isUserDataKey()` allowlist (`kwestup_data_`, `kwestup_userName_`, `kwestup_theme_*`, `kwestup_timer_state_`, `kwestup_activeVault_`, `kwestup_vaults_`, `kwestup_billing_`, `kwestup_widget_`, `kwestup_telemetry_`, `kwestup_ai_model_`) protects user data across `clearAllCaches()`

**Encryption:**
- `crypto-js@^4.2.0` — AES-256 backup envelopes in `src/utils/exportService.js`: v2 = per-archive 128-bit random salt + IV, PBKDF2-HMAC-SHA256 100,000 iterations; v1 fallback = static salt `4b77657374557053616c745f7632`, 1,000 iterations, salt-as-IV. `decryptBackup()` auto-detects v2 envelope, falls back to v1

## On-Device AI & LLM Runtime

**Native LLM Engine (`llama.rn@^0.12.4`):**
- Native bindings executing quantized GGUF models on device CPU.
- Model: `qwen2.5-0.5b-instruct-q4_k_m.gguf` pinned to Hugging Face commit `9217f5db79a29953eb74d5343926648285ec7e67`, exact size `491400032` bytes, SHA-256 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`.
- Pre-load integrity verification (`verifyModelIntegrity`) with automatic deletion of corrupted/partial downloads.
- Coalescing Promise lock mutex (`_initPromise`) preventing concurrent initialization races.
- Active memory lifecycle: `handleAppStateChange` auto-unloads context on `background`/`inactive`; 5-minute idle timeout with timer unref support for Node/Jest; component unmount cleanup in `src/components/AIAssistant.js`.
- Rule-based heuristic fallback engine: `extractTasksFromNoteHeuristic` (markdown checkboxes, `TODO:`, action verbs), `summarizeNoteHeuristic` (headings, bold points, paragraph leads), and keyword-based regex command parser.

## Testing

**Framework:**
- Jest 29 (`jest@^29.7.0`) with `jest-expo/android` preset (`preset: 'jest-expo/android'` in `jest.config.js`)
- `babel-jest@^29.7.0` + `babel-preset-expo` transform (`babel.config.js`); `transformIgnorePatterns` whitelists RN/Expo/llama/widget libs for Node execution
- Setup harness `__tests__/setup/jest.setup.js` — in-memory mocks for `AsyncStorage`, `expo-file-system` (virtual FS map), `llama.rn`, `react-native-android-widget`, `expo-notifications`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-camera`, `react-native-reanimated`
- Test match `**/__tests__/**/*.test.[jt]s?(x)`; 10 suites covering `dateUtils`, `taskMutations`, `TaskContext`, `aiService`, `syncService`, storage migration, export/import, vault/file storage, widget logic (`__tests__/unit/`, `__tests__/phase12-widget-logic.test.js`). 138 total unit/integration tests passing.

**Commands (`package.json` scripts):**
```bash
npm test               # jest --passWithNoTests
npm run test:coverage  # jest --coverage (collects from src/**, excludes *.styles.js)
npm run test:watch     # jest --watch
```

## Tooling & CI/CD

**Lint/format:**
- ESLint 9 flat config (`eslint.config.js`, `eslint@^9.39.4`) with `@babel/eslint-parser`, `eslint-plugin-react`, `eslint-plugin-react-native`, `eslint-plugin-react-hooks`; `no-console: warn`, `react/prop-types: off`. `npm run lint` / `npm run lint:report`
- Legacy `.eslintrc.js` maintained in parallel for IDE compatibility

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`) on `push`/`pull_request` against `main` and `development`: runs `npm run lint` followed by `npm test -- --ci --maxWorkers=2 --coverage` on Node 20.
