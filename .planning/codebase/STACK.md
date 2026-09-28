# Technology Stack

**Analysis Date:** 2026-09-28

## Languages & Runtimes

- **JavaScript (ES2021)** — Primary language for app code. `src/**/*.js`, `App.js`, `index.js`, `widgets/*.tsx` (TS only in widgets). ESLint `ecmaVersion: 2021`, `sourceType: module` (`eslint.config.js`).
- **TypeScript (incremental, widgets-only)** — `widgets/*.tsx` (`DailyTasksWidget.tsx`, `FocusTimerWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx`, `widget-task-handler.tsx`). Full TS conversion of legacy JS explicitly out of scope (`.planning/PROJECT.md`).
- **TypeScript ~5.8.3** (devDependency) — Type support; base config extends `expo/tsconfig.base` (`tsconfig.json` is a 4-line shim).
- **Node.js 20** — CI runtime (`actions/setup-node@v4`, `node-version: 20` in `.github/workflows/ci.yml`). Local dev via Expo CLI / Metro.
- **React 19.0.0 / React Native 0.79.5** — UI runtime (`package.json`).
- **Hermes (via Expo SDK 53 / RN 0.79 default)** — Production JS engine on Android (standard for this SDK; no custom `hermes` config in repo).

## Frameworks

- **Expo SDK ~53.0.20 (`expo": "~53.0.20"`)** — Managed workflow core: `expo/metro-config`, `babel-preset-expo`, `jest-expo`. Entry via `registerRootComponent(App)` (`index.js`).
- **Expo Router: NOT used** — Navigation is React Navigation drawer stack: `@react-navigation/native ^6.1.9`, `@react-navigation/drawer ^6.6.6`, wired in `src/navigation/AppNavigator.js`, drawer UI in `src/navigation/CustomDrawerContent.js`.
- **UI kits:** `react-native-paper ^5.10.5` (theming, e.g. `useTheme` in `src/components/TaskCard.js`), `@expo/vector-icons ^14.0.0` (MaterialCommunityIcons throughout), `expo-linear-gradient ~14.1.5`, `react-native-modal ^14.0.0-rc.1`, `react-native-confetti-cannon ^1.5.2`, `react-native-reanimated ~3.17.4` (Babel plugin must be listed last in `babel.config.js`), `react-native-gesture-handler ~2.24.0`, `react-native-screens ~4.11.1`, `react-native-safe-area-context 5.4.0`, `@react-native-community/datetimepicker 8.4.1`.
- **State:** No Redux/MobX/Zustand. Four domain React Context providers in `src/context/` (`TaskContext.js`, `VaultContext.js`, `BillingContext.js`, `BirthdayContext.js`) composed in `App.js`; pure shared logic in `src/utils/taskMutations.js` (shared by app + headless widget handler).
- **Fonts:** `@expo-google-fonts/hanken-grotesk`, `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono` loaded via `expo-font ~13.3.2`.

## Data & Storage (storage versioning, encryption details if found)

- **Structured state → `@react-native-async-storage/async-storage 2.1.2`** (async key-value). Single JSON blob `kwestup_data_<STORAGE_VERSION>` plus decoupled keys (timer, theme, userName, vaults, billing, widget, telemetry, AI download). All key construction uses the dynamic `STORAGE_VERSION` constant — never hardcode version suffixes.
  - Constants: `APP_VERSION = "v3.5.0"`, `STORAGE_VERSION = "v7.0"` in `src/utils/storage.js`.
  - `isUserDataKey()` allowlist in `src/utils/storage.js` protects `kwestup_data_`, `kwestup_userName_`, `kwestup_theme_mode_/_name_`, `kwestup_timer_state_`, `kwestup_activeVault_`, `kwestup_vaults_`, `kwestup_billing_`, `kwestup_widget_`, `kwestup_telemetry_`, `kwestup_ai_model_` prefixes from `clearAllCaches()` wipes.
  - `migrateUserDataIfNeeded()` in `src/utils/storage.js` promotes the highest-version legacy `kwestup_data_v*` blob plus vault/billing/timer keys; stamps `kwestup_last_version` / `kwestup_last_clear`.
  - Domain stores: `src/utils/billingStorage.js` (`kwestup_billing_*`), `src/utils/vaultService.js` (`kwestup_vaults_*/activeVault_*`), telemetry opt-in key `kwestup_telemetry_optin`, resume key `kwestup_ai_model_download_resumable` (`src/utils/aiService.js`).
- **Notes/vault files → `expo-file-system ~18.1.11`** (`.md` files on device). `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/vaultImport.js` (directory import via `expo-document-picker ~13.1.6`).
- **Backup encryption → `crypto-js ^4.2.0` (pure JS, no native linking).** `src/utils/exportService.js`:
  - **v2 envelope (current):** AES-256-CBC, per-archive 128-bit random salt + 128-bit random IV (`CryptoJS.lib.WordArray.random(16)`), PBKDF2-HMAC-SHA256 with **100,000 iterations**, `keySize: 256/32`. Envelope JSON: `{ v: 2, kdf: "PBKDF2", hasher: "SHA256", iterations, salt(hex), iv(hex), ciphertext }`. Same plaintext + passphrase yields distinct ciphertexts (CPA security).
  - **v1 fallback (legacy read-only):** static salt `"4b77657374557053616c745f7632"`, 1,000 iterations, salt-as-IV. `decryptBackup()` auto-detects v2 vs v1; tampered/wrong-passphrase throws `"Unable to decrypt archive. Please verify the passphrase."`.
  - Export pipeline: collect → pack → encrypt → write cache file → `expo-sharing ~13.1.5` share sheet → cleanup.
- **AI model integrity → `crypto-js` SHA-256 (chunked).** `src/utils/aiService.js`: `hashFileSha256()` streams the ~468 MB GGUF via `FileSystem.readAsStringAsync` Base64 windows of `MODEL_HASH_CHUNK_BYTES = 8 MB`, incremental `CryptoJS.algo.SHA256`; `verifyModelIntegrity()` enforces exact byte size (`MODEL_EXPECTED_SIZE = 491400032`) + digest match against pinned `MODEL_EXPECTED_SHA256`, fail-closed (delete corrupt file).
- **No cloud database / ORM.** No Firebase, Supabase, SQLite, WatermelonDB, or Realm detected in `package.json` — consistent with local-first constraint.

## Observability (logger, error boundary, babel console strip)

- **Structured logger — `src/utils/logger.js` (Phase 19, OBS-01):**
  - Levels `debug/info/warn/error` + 50-entry FIFO deep-frozen ring buffer (`MAX_LOG_BUFFER_SIZE = 50`, `getRecentLogs()`, `clearLogs()`).
  - Environment-aware: `debug`/`info` gated on `isDevelopment()` (`__DEV__` else `NODE_ENV !== 'production'`) — neither console-emit nor buffer in production. `warn`/`error` always buffer + passthrough.
  - PII redaction at record time: key regex `/(content|body|note|title|text|message|passphrase|token|key|secret|password)/i` → `[Redacted]`; strings capped at 1000 chars, arrays at 50 items, depth cap 4 + `WeakSet` cycle guard; entries deep-frozen (WR-02).
  - ESLint `no-console: warn` pushes all product code to `logger`; `src/utils/logger.js` itself carries `/* eslint-disable no-console */`.
- **Error boundary — `src/components/ErrorBoundary.js` (Phase 19, OBS-02):** class component wrapping the tree (mounted in `App.js`). `componentDidCatch` → `logger.error`. Fallback card (Try Again / Copy Error Report / Restart Application): report includes timestamp, platform, `APP_VERSION`, `STORAGE_VERSION`, error + component stack, and PII-redacted breadcrumbs, capped at 8000 chars; copy via `expo-clipboard ~7.0.1` with `Share` fallback and explicit copy-failed state. No `expo-updates` — restart is a manual-reopen prompt (documented limitation).
- **Babel console strip (Phase 19, OBS-01) — `babel.config.js`:** `babel-plugin-transform-remove-console ^6.9.4` in production only (`NODE_ENV === 'production'`, `exclude: ['error','warn']`); cache keyed on `NODE_ENV` via `api.cache.using()` (WR-01); `react-native-reanimated/plugin` always last.
- **Diagnostics probes — `src/utils/diagnostics.js`:** `runDeviceDiagnostics`, `runNetworkDiagnostics`, `checkForUpdates`, `sendTelemetryEvent`. All console/noise probes dev-gated in Phase 19 (see INTEGRATIONS.md). Crash reporting is local-only (copy-paste report); no Sentry/Crashlytics.

## Testing (framework, presets)

- **Runner: Jest `^29.7.0` + `jest-expo ~53.0.0`, preset `jest-expo/android`** (`jest.config.js`). Commands: `npm test` (`jest --passWithNoTests`), `npm run test:watch`, `npm run test:coverage`; CI runs `npm test -- --ci --maxWorkers=2 --coverage` (`.github/workflows/ci.yml`).
- **Transform:** `babel-jest ^29.7.0` with `babel-preset-expo`; `transformIgnorePatterns` whitelists RN/Expo/llama.rn/widget libs. `moduleFileExtensions` prioritizes `.android.*`. `testMatch: **/__tests__/**/*.test.[jt]s?(x)`; coverage collects `src/**/*.{js,jsx,ts,tsx}` excluding `*.styles.js`.
- **Native mocks harness — `__tests__/setup/jest.setup.js`** (loaded via `setupFiles`): AsyncStorage (official mock), in-memory virtual FS for `expo-file-system` (`documentDirectory file:///mock-docs/`, `cacheDirectory file:///mock-cache/`), `llama.rn` (`initLlama`/`releaseAllLlama`), `react-native-android-widget`, `expo-notifications`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-camera`, `expo-clipboard`, `@expo/vector-icons`, `react-native-reanimated/mock`.
- **Suites (13 files):** `__tests__/unit/` — `aiService`, `aiAssistant-smoke`, `dateUtils`, `errorBoundary`, `exportImportService`, `logger`, `storageMigration`, `syncService`, `taskContext`, `taskMutations`, `vaultAndFileStorage`, plus `__tests__/setup/jest.setup.test.js` and `__tests__/phase12-widget-logic.test.js`. STATE.md reports 171 tests passing, 0 ESLint errors at Milestone 2 close.

## Tooling & CI/CD

- **Package manager:** npm (lockfile present: `package-lock.json`). `postinstall: node patch-llama-gradle.js` patches the `llama.rn` Android Gradle binding.
- **Metro:** stock `expo/metro-config` (`metro.config.js`, 5 lines, no custom resolver).
- **Lint:** ESLint `^9.39.4` flat config (`eslint.config.js`): `@babel/eslint-parser`, `eslint-plugin-react`, `eslint-plugin-react-native`, `eslint-plugin-react-hooks`; `no-console: warn`, `react/prop-types: off`, RN rules (`no-unused-styles`, `no-inline-styles`, `no-color-literals` as warn). Ignores `node_modules`, `.expo`, `dist`, `web-build`, `android`, `ios`, `assets`, `KwestUpPC`. `npm run lint`, `npm run lint:report` (JSON report).
- **CI — `.github/workflows/ci.yml`:** `CI Pipeline (Lint & Test)` on push/PR to `main` + `development`: checkout → Node 20 → `npm install` → `npm run lint` → `npm test -- --ci --maxWorkers=2 --coverage`. Quality gate: all lint + tests green. Companion `.github/workflows/semgrep.yml` for static security scan.
- **Build:** EAS (`eas.json`: `development` internal APK + dev-client, `preview` internal, `production` APK with `NODE_OPTIONS=--max-old-space-size=4096`; `cli >= 3.10.0`). No `expo-updates`/OTA configured. Local builds via `expo run:android` / `expo run:ios` / `expo start`.

## Key Dependencies (table: package | version | purpose)

| Package | Version | Purpose |
|---|---|---|
| `expo` | `~53.0.20` | Managed workflow core, Metro/Babel presets, `registerRootComponent` |
| `react` | `19.0.0` | UI runtime |
| `react-native` | `0.79.5` | UI runtime (Android target) |
| `llama.rn` | `^0.12.4` | On-device LLM native binding (`initLlama`/`releaseAllLlama`); Qwen2.5-0.5B Q4_K_M GGUF, CPU-only `n_ctx 2048`, `n_threads 2` |
| `crypto-js` | `^4.2.0` | AES-256 backup crypto (PBKDF2-SHA256 100k), SHA-256 model hashing — pure JS |
| `@react-native-async-storage/async-storage` | `2.1.2` | Structured state persistence (versioned keys) |
| `expo-file-system` | `~18.1.11` | Vault `.md` files, model download (resumable), archive staging |
| `expo-notifications` | `~0.31.4` | Birthday/daily-task/billing reminders (handler in `src/utils/notifications.js`) |
| `expo-camera` | `~16.1.11` | QR sync-code scanning (`src/components/QRScannerModal.js`) |
| `expo-clipboard` | `~7.0.1` | Copy error report (`ErrorBoundary`) |
| `expo-sharing` | `~13.1.5` | Export `.kwestup` archive via native share sheet |
| `expo-document-picker` | `~13.1.6` | Vault directory import + archive import picker |
| `expo-haptics` | `~14.1.4` | Tactile feedback on interactions |
| `expo-font` + `@expo-google-fonts/{hanken-grotesk,inter,jetbrains-mono}` | `~13.3.2` / `^0.4.x` | Brand typography |
| `react-native-android-widget` | `^0.16.1` | 4 home-screen widgets + headless `widgetTaskHandler` (`index.js`, `widgets/`) |
| `@react-navigation/native` / `drawer` | `^6.1.9` / `^6.6.6` | Drawer navigation (`src/navigation/`) |
| `react-native-paper` | `^5.10.5` | Material theming components |
| `react-native-reanimated` | `~3.17.4` | Animations (Babel plugin last) |
| `react-native-gesture-handler` / `screens` / `safe-area-context` | `~2.24.0` / `~4.11.1` / `5.4.0` | Navigation prerequisites |
| `expo-dev-client` | `~5.2.4` | Development builds |
| `expo-build-properties` | `~0.14.8` | Native build config (iOS `useFrameworks: static`) |
| `expo-status-bar` / `expo-linear-gradient` | `~2.2.3` / `~14.1.5` | Chrome + styling |
| `@react-native-community/datetimepicker` | `8.4.1` | Date/time pickers |
| `@expo/vector-icons` | `^14.0.0` | Icon set (MaterialCommunityIcons) |
| `react-native-modal` | `^14.0.0-rc.1` | Modals (task edit, QR, AI assistant) |
| `react-native-confetti-cannon` | `^1.5.2` | Celebration effects |
| `use-latest-callback` | `^0.2.4` | Stable callback helper |
| `jest` / `jest-expo` / `babel-jest` / `@types/jest` | `^29.7.0` / `~53.0.0` / `^29.7.0` / `^29.5.14` | Test runner + Expo preset + transform + types |
| `eslint` + `eslint-plugin-react(-native,-hooks)` + `@babel/eslint-parser` | `^9.39.4` et al | Flat-config lint |
| `babel-plugin-transform-remove-console` | `^6.9.4` | Prod console strip (log/info/debug) |
| `typescript` | `~5.8.3` | Widget TS + type checking |

---

*Stack analysis: 2026-09-28*
