# Technology Stack

**Analysis Date:** 2026-09-27

## Languages & Runtimes

- **JavaScript (ES2021)** — Primary app language. All of `src/` (screens, components, navigation, `src/utils/`) is `.js` with JSX. Parser target confirmed by `eslint.config.js` (`ecmaVersion: 2021`, `babelOptions: ./babel.config.js`).
- **TypeScript (TS ~5.8.3, `expo/tsconfig.base`)** — Widgets layer only: `widgets/*.tsx` (`widget-task-handler.tsx`, `FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx`) plus type annotations (`WidgetTaskHandlerProps`, `TaskItemType`, `AppData`). Full conversion explicitly out of scope per `.planning/PROJECT.md`.
- **Java / Gradle (Android native)** — `android/` (`app/`, `build.gradle`, `settings.gradle`, `gradle.properties`). Touched only via `patch-llama-gradle.js` patching `node_modules/llama.rn/android/build.gradle` and `node_modules/react-native-android-widget/.../RNWidgetUtil.java`.
- **Node.js** — CI pins Node 20 (`.github/workflows/ci.yml` via `actions/setup-node@v4`); local dev observed at `v22.19.0`. Package manager is **npm** with `package-lock.json` committed.
- **Hermes (React Native 0.79 default)** — No explicit `jsEngine` override; standard RN 0.79.5 / Expo SDK 53 Hermes runtime on Android. `expo-dev-client ~5.2.4` for development builds.
- **Expo SDK 53.0.0** (`app.json` `sdkVersion`, `expo ~53.0.20`) — Managed workflow + custom native modules via config plugins and EAS builds.

## Frameworks

- **Expo ~53.0.20** — App runtime, config plugins, Metro (`metro.config.js` via `expo/metro-config`), splash/icon/asset bundling (`app.json`).
- **React 19.0.0 + React Native 0.79.5** — Core UI. Entry: `index.js` → `registerRootComponent(App)` (`App.js`).
- **React Navigation 6** — `@react-navigation/native ^6.1.9` + `@react-navigation/drawer ^6.6.6`; implementation in `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`.
- **react-native-paper ^5.10.5** — Material components (Cards, Buttons, Switches wrapped in `src/components/Custom*.js`).
- **Animation / gesture / layout** — `react-native-reanimated ~3.17.4` (Babel plugin `react-native-reanimated/plugin` in `babel.config.js` — must stay last), `react-native-gesture-handler ~2.24.0`, `react-native-screens ~4.11.1`, `react-native-safe-area-context 5.4.0`, `expo-linear-gradient ~14.1.5`, `react-native-modal ^14.0.0-rc.1`, `react-native-confetti-cannon ^1.5.2`, `@react-native-community/datetimepicker 8.4.1` (wrapped by `src/components/CustomDateTimePicker.js`).
- **Icons / fonts** — `@expo/vector-icons ^14.0.0`, `expo-font ~13.3.2` + `@expo-google-fonts/hanken-grotesk ^0.4.3`, `@expo-google-fonts/inter ^0.4.2`, `@expo-google-fonts/jetbrains-mono ^0.4.1`.
- **On-device AI runtime** — `llama.rn ^0.12.4` (llama.cpp bindings, Expo plugin `llama.rn` in `app.json`). Model: `qwen2.5-0.5b-instruct-q4_k_m.gguf` (~468 MB, `n_ctx: 2048`, `n_threads: 2`, CPU-only) — see `src/utils/aiService.js`.

## Data & Storage (include storage versioning, encryption details if found)

- **AsyncStorage `@react-native-async-storage/async-storage 2.1.2`** — Single source of truth for structured state. All keys versioned by `STORAGE_VERSION = "v7.0"` in `src/utils/storage.js` (`APP_VERSION = "v3.5.0"` matches `package.json` / `app.json` version).
  - Key families guarded by `isUserDataKey()` (`src/utils/storage.js:7-21`): `kwestup_data_`, `kwestup_userName_`, `kwestup_theme_mode_`, `kwestup_theme_name_`, `kwestup_timer_state_`, `kwestup_activeVault_`, `kwestup_vaults_`, `kwestup_billing_`, `kwestup_widget_`, `kwestup_telemetry_`, `kwestup_ai_model_`.
  - `migrateUserDataIfNeeded()` (`src/utils/storage.js:68-186`): scans `kwestup_data_v*`, semver-sorts, copies highest-version payload + username/theme/timer/vault/billing keys forward. `src/utils/vaultService.js:6-9` keeps dynamic `VAULTS_KEY`/`ACTIVE_KEY` plus legacy `kwestup_vaults_v5.0` fallback.
  - `clearAllCaches()` (`src/utils/storage.js:24-65`): wipes only non-`isUserDataKey` keys; telemetry consent (`kwestup_telemetry_optin`) and AI download state (`kwestup_ai_model_download_resumable`) survive wipes.
  - Billing: `BILLING_KEY = kwestup_billing_${STORAGE_VERSION}` in `src/utils/billingStorage.js:4`.
- **Filesystem `expo-file-system ~18.1.11`** — Markdown vaults at `${documentDirectory}Notes/Vaults/<vaultId>/` (`src/utils/vaultService.js:17-19`, `getVaultPath`). CRUD in `src/utils/fileStorage.js` (`saveNoteFile`, `readNoteFile`, `deleteNoteFile`, `getAllNotesFromFilesystem`); multi-file import via `src/utils/vaultImport.js`; one-time flat-`Notes/` → `Notes/Vaults/default/` migration in `migrateToVaultSystem()` (`src/utils/vaultService.js:179-236`).
- **Encryption `crypto-js ^4.2.0`** — Backup envelopes in `src/utils/exportService.js:20-96`:
  - **v2 (current):** AES-256-CBC, per-archive 128-bit random salt + 128-bit random IV (`CryptoJS.lib.WordArray.random(16)`), PBKDF2-HMAC-SHA256 **100,000 iterations**, envelope `{ v: 2, kdf, hasher, iterations, salt(hex), iv(hex), ciphertext }`.
  - **v1 (legacy fallback):** static salt `4b77657374557053616c745f7632`, PBKDF2 1,000 iterations, IV = salt. `decryptBackup()` auto-detects v2 JSON envelope, falls back to v1.
  - Archive pipeline (`exportArchive`/`importArchive`, `src/utils/exportService.js:208-380`): collect AsyncStorage (`collectAsyncStorageData`) + pack vault `.md` files (`packVaults`) + `loadBillingData()` → `metadata { version, timestamp, appVersion, storageVersion }` → encrypt → write `${cacheDirectory}kwestup-backup.kwestup` → `expo-sharing` share sheet → temp cleanup; import reverses with strict `metadata`/`storage` shape check and billing reminder rescheduling.
- **No embedded DB / ORM** — No SQLite, WatermelonDB, Realm, MMKV, Firebase, or Supabase. JSON-in-AsyncStorage + `.md`-on-disk is the entire persistence layer.

## Testing (framework, presets)

- **Runner: Jest `^29.7.0` + `jest-expo ~53.0.0`** — Preset `jest-expo/android` in `jest.config.js` (Android-first; `moduleFileExtensions` prioritises `android.*`).
- **Transform:** `babel-jest ^29.7.0` via `babel-preset-expo`. `transformIgnorePatterns` whitelists RN/Expo/`llama.rn`/`react-native-android-widget`/`react-native-paper` etc.
- **Setup harness:** `__tests__/setup/jest.setup.js` — in-memory mocks for `AsyncStorage`, `expo-file-system` (virtual FS with `__inMemoryFS`/`__resetFS`), `llama.rn`, `react-native-android-widget`, `expo-notifications`/`haptics`/`sharing`/`document-picker`/`camera`, `react-native-reanimated/mock`.
- **Discovery:** `testMatch: **/__tests__/**/*.test.[jt]s?(x)`; coverage collected from `src/**/*` (excl. `*.styles.js`). Suites present: `__tests__/unit/{dateUtils,storageMigration,exportImportService,syncService,vaultAndFileStorage}.test.js`, `__tests__/phase12-widget-logic.test.js`, `__tests__/setup/jest.setup.test.js`.
- **Commands:** `npm test` (`jest --passWithNoTests`), `npm run test:watch`, `npm run test:coverage`; CI runs `npm test -- --ci --maxWorkers=2 --coverage`.

## Tooling & CI/CD

- **Lint:** ESLint `^9.39.4` flat config (`eslint.config.js`) with `@babel/eslint-parser`, `eslint-plugin-react ^7.37.5`, `eslint-plugin-react-hooks ^7.1.1`, `eslint-plugin-react-native ^5.0.0`. Notable rules: `react-native/no-unused-styles` + `no-inline-styles` + `no-color-literals` = warn, `react-hooks/rules-of-hooks` = error, `no-console` = warn, `react/prop-types` off. Ignores `android/`, `ios/`, `KwestUpPC/`, build outputs. `npm run lint` / `lint:report`.
- **Types:** `typescript ~5.8.3`, `@types/jest ^29.5.14`, `@types/react ~19.0.10`; no `tsc --noEmit` gate in CI.
- **CI:** `.github/workflows/ci.yml` — `lint-and-test` on push/PR to `main`/`development`: checkout → Node 20 → `npm install` → `npm run lint` → `npm test -- --ci --maxWorkers=2 --coverage`. Plus `.github/workflows/semgrep.yml` (static analysis).
- **Build:** EAS (`eas.json`, CLI `>= 3.10.0`): `development` (dev-client, internal APK), `preview` (internal), `production` (APK, `NODE_OPTIONS=--max-old-space-size=4096`). Local builds via `expo run:android/ios`, `expo start`, `expo start --web`.
- **Postinstall patch:** `patch-llama-gradle.js` (`package.json` `postinstall`) — strips `isNewArchitectureEnabled()` guards in `llama.rn` gradle (old-arch support) and injects `getFallbackSize()` into `RNWidgetUtil.java` for widget sizing.
- **Bundler:** Metro default Expo config (`metro.config.js` — `getDefaultConfig(__dirname)` unmodified).

## Key Dependencies (table: package | version | purpose)

| Package | Version | Purpose |
|---|---|---|
| `expo` | `~53.0.20` | Managed runtime, plugins, Metro/bundler integration |
| `react` | `19.0.0` | UI framework |
| `react-native` | `0.79.5` | Native runtime (Hermes on Android) |
| `llama.rn` | `^0.12.4` | On-device LLM inference (Qwen GGUF via llama.cpp) |
| `@react-native-async-storage/async-storage` | `2.1.2` | Versioned key-value state store |
| `expo-file-system` | `~18.1.11` | Vault `.md` files, model file, backup temp files |
| `crypto-js` | `^4.2.0` | AES-256 + PBKDF2 backup encryption |
| `expo-sharing` | `~13.1.5` | Export `.kwestup` via native share sheet |
| `expo-document-picker` | `~13.1.6` | Import `.kwestup` archives + `.md/.txt` vault import |
| `expo-camera` | `~16.1.11` | QR sync-code scanning (`src/components/QRScannerModal.js`) |
| `expo-notifications` | `~0.31.4` | Birthday / task / bill local reminders |
| `expo-haptics` | `~14.1.4` | Tactile feedback across screens |
| `expo-font` + `@expo-google-fonts/{hanken-grotesk,inter,jetbrains-mono}` | `~13.3.2` / `^0.4.x` | Bundled display/mono fonts |
| `expo-linear-gradient` | `~14.1.5` | Liquid-glass backgrounds (`LiquidGlassBackground.js`) |
| `expo-status-bar` | `~2.2.3` | Status bar control |
| `expo-dev-client` | `~5.2.4` | Development builds (native modules) |
| `expo-build-properties` | `~0.14.8` | Native build props (iOS static frameworks) |
| `react-native-android-widget` | `^0.16.1` | 4 home-screen widgets + headless task handler |
| `@react-navigation/native` / `drawer` | `^6.1.9` / `^6.6.6` | Drawer navigation (`src/navigation/`) |
| `react-native-paper` | `^5.10.5` | Material UI primitives |
| `react-native-reanimated` | `~3.17.4` | Animations (Babel plugin required) |
| `react-native-gesture-handler` | `~2.24.0` | Gesture system |
| `react-native-screens` / `safe-area-context` | `~4.11.1` / `5.4.0` | Navigation performance + insets |
| `@react-native-community/datetimepicker` | `8.4.1` | Date/time pickers |
| `@expo/vector-icons` | `^14.0.0` | Icon set |
| `react-native-modal` | `^14.0.0-rc.1` | Modals (task edit, QR scanner) |
| `react-native-confetti-cannon` | `^1.5.2` | Celebration effects |
| `use-latest-callback` | `^0.2.4` | Stable-callback hook |
| `jest` / `jest-expo` / `babel-jest` | `^29.7.0` / `~53.0.0` / `^29.7.0` | Test runner + Expo preset + transform |
| `typescript` / `@types/react` / `@types/jest` | `~5.8.3` / `~19.0.10` / `^29.5.14` | Widget TS + type checking |
| `eslint` + `eslint-plugin-react(-hooks,-native)` + `@babel/eslint-parser` | `^9.39.4` / `^7.x`/`^5.0.0` | Flat-config lint gate |

---

*Stack analysis: 2026-09-27*
