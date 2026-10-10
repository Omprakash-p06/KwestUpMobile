# Technology Stack

**Analysis Date:** 2026-10-10

## Languages

**Primary:**
- JavaScript (ES2021) - App entry and nearly all product code (`App.js`, `index.js`, `src/**/*.js`)
- TypeScript (strict) - Typed service layer and headless widgets (`src/services/notificationService.ts`, `src/services/types.ts`, `widgets/*.tsx`)

**Secondary:**
- JSON - Expo/EAS/build/test configuration (`app.json`, `eas.json`, `tsconfig.json`, `jest.config.js` content is JS)
- Gradle/Groovy + Java/Kotlin (generated) - Prebuilt native shell under `android/` (patched at install by `patch-llama-gradle.js`); not hand-edited
- YAML - CI workflow definitions (`.github/workflows/ci.yml`, `.github/workflows/semgrep.yml`)

## Runtime

**Environment:**
- Node.js `>=22.13` (declared in `package.json` engines; CI pins Node 22 via `actions/setup-node@v4` in `.github/workflows/ci.yml`)
- Expo managed workflow with dev-client (`expo-dev-client`); entry `index.js` calls `registerRootComponent(App)` from `expo`
- React Native `0.86.0` with Hermes (Expo default); `android/` is the prebuilt native container

**Package Manager:**
- npm (only manager evidenced)
- Lockfile: present (`package-lock.json`, installed in CI with `npm ci`)

## Frameworks

**Core:**
- Expo `~57.0.0` (`package.json`) - Managed runtime, config plugins, OTA/build substrate. Note: `app.json` still stamps `"sdkVersion": "53.0.0"` — stale field, `package.json` is authoritative
- React `19.2.3` - UI runtime (`App.js`, `src/screens/*`, `src/components/*`)
- React Navigation `^6.1.9` (`@react-navigation/native`) + `@react-navigation/drawer` `^6.6.6` - App navigation (`src/navigation/AppNavigator.js`)
- react-native-paper `^5.10.5` - Material component kit, themed via `PaperProvider` in `App.js`
- react-native-reanimated `~3.17.4` (+ `react-native-gesture-handler` `~2.24.0`, `react-native-safe-area-context` `5.4.0`, `react-native-screens` `~4.11.1`) - Animation/gesture/screen primitives; Reanimated Babel plugin must stay last in `babel.config.js`

**Testing:**
- Jest `^29.7.0` + `jest-expo` `~57.0.0` preset (`jest-expo/android`) - Runner, config: `jest.config.js`
- `babel-jest` `^29.7.0` + `@types/jest` `^29.5.14` - Transform and types for `__tests__/**/*.test.[jt]s?(x)`

**Build/Dev:**
- EAS CLI `>= 3.10.0` (required by `eas.json`) with profiles `development` / `preview` / `production` (all APK for Android; production sets `NODE_OPTIONS=--max-old-space-size=4096`)
- `expo-build-properties` `~0.14.8` - Native build-property config plugin (`app.json`, iOS `useFrameworks: static`)
- Babel: `babel-preset-expo` preset + `babel-plugin-transform-remove-console` (production strips `log/info/debug`, keeps `error/warn`) + `react-native-reanimated/plugin`, config: `babel.config.js`
- Metro: default Expo config via `expo/metro-config`, config: `metro.config.js`
- TypeScript `~5.8.3` (strict, `allowJs: true`, `checkJs: false`) - Gate command `npm run typecheck` (`tsc --noEmit`), config: `tsconfig.json`
- ESLint `^9.39.4` flat config (`eslint.config.js`) with `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-native`; parser `@babel/eslint-parser`
- Semgrep (`semgrep/semgrep-action`, `returntocorp/semgrep-action`) - Security scans in `.github/workflows/semgrep.yml` and `ci.yml`, suppression list in `.semgrepignore`
- `patch-llama-gradle.js` (runs as `postinstall`) - Idempotent patcher that unwraps `isNewArchitectureEnabled()` guards in `node_modules/llama.rn/android/build.gradle` for Old-Architecture JSI

## Key Dependencies

**Critical:**
- `llama.rn` `0.12.4` - On-device LLM inference (Qwen2.5-0.5B-Instruct Q4_K_M GGUF); lifecycle owned by `src/utils/aiService.js` via `initLlama` / `releaseAllLlama`; registered as Expo config plugin in `app.json`
- `@react-native-async-storage/async-storage` `2.1.2` - Primary key-value store for all versioned app state (`kwestup_data_v*`, `kwestup_userName_v*`, `kwestup_timer_state_v*`, vault/billing/notification keys); used in `App.js`, `src/context/TaskContext.js`, `src/utils/storage.js`, `src/utils/vaultService.js`, `src/utils/billingStorage.js`, `src/services/notificationService.ts`
- `expo-file-system` `~18.1.11` - Vault markdown-note files (`src/utils/fileStorage.js`), model-file download + SHA-256 chunked hashing (`src/utils/aiService.js`), backup export/import (`src/utils/exportService.js`, `src/utils/vaultImport.js`)
- `expo-notifications` `~0.31.4` - Local scheduling only (daily tasks, birthdays, bills, focus timer); engine in `src/services/notificationService.ts` with 5 Android channels
- `crypto-js` `^4.2.0` - AES-256 + PBKDF2-HMAC-SHA256 backup encryption (`src/utils/exportService.js`) and SHA-256 helpers (`src/utils/aiService.js`)

**Infrastructure:**
- `expo-camera` `~16.1.11` - QR sync-code scanner (`src/components/QRScannerModal.js` via `CameraView`/`useCameraPermissions`); permission string in `app.json`
- `expo-document-picker` `~13.1.6` + `expo-sharing` `~13.1.5` - Backup file pick/share (`src/utils/vaultImport.js`, `src/utils/exportService.js`, `src/screens/SettingsScreen.js`)
- `expo-clipboard` `~7.0.1` - Error-report copy (`src/components/ErrorBoundary.js`)
- `expo-font` `~13.3.2` + `@expo-google-fonts/inter`, `@expo-google-fonts/hanken-grotesk`, `@expo-google-fonts/jetbrains-mono` - Bundled fonts loaded in `App.js` via `useFonts`
- `expo-haptics` `~14.1.4` - Tactile feedback on buttons, tasks, timers, sync (used in `App.js`, `src/components/CustomButton.js`, `src/components/AIAssistant.js`, most `src/screens/*`)
- `expo-status-bar` `~2.2.3`, `expo-linear-gradient` `~14.1.5` - Status bar + background visuals (`App.js`, `src/components/LiquidGlassBackground.js`)
- `@react-native-community/datetimepicker` `8.4.1` - Date/time pickers for tasks, birthdays, bills
- `react-native-modal` `^13.0.1` - Dialogs/confirmations (`App.js`, settings/task modals)
- `react-native-confetti-cannon` `^1.5.2` - Focus-session celebration (`App.js`)
- `react-native-android-widget` `^0.16.1` - Four home-screen widgets (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList`) declared in `app.json`, rendered by `widgets/*.tsx`, pushed via `requestWidgetTaskHandler`/`requestWidgetUpdate` in `App.js`, `index.js`
- `@expo/vector-icons` `^14.0.0` - Icon set
- `use-latest-callback` `^0.2.4` - Stale-closure guard for callbacks

## Configuration

**Environment:**
- No `.env` files present in repo root (verified 2026-10-10); `.gitignore` covers `.env*.local`
- No remote config: only `process.env.NODE_ENV` (`src/utils/logger.js`, `babel.config.js`) and React Native `__DEV__` (`src/utils/diagnostics.js`, `App.js`) branch dev-only diagnostics and console stripping
- Expo `extra.eas.projectId: 9b029b06-5b07-4a1d-9999-a543a3ef1614` + `owner: omprakash-p06` in `app.json`; no other `extra` keys
- `.npmrc` file present at repo root (existence only — contents not read per secrets policy)

**Build:**
- `app.json` - App identity (`KwestUp` 3.5.0, slug `kwestupmobile`), Android package `com.omprakashp06.kwestupmobile` (`versionCode` 7), icons/splash, orientation `portrait`, config plugins (`llama.rn`, `expo-camera`, `expo-build-properties`, `react-native-android-widget`)
- `eas.json` - Build profiles (`development` dev-client internal APK, `preview` internal, `production` APK + raised heap)
- `babel.config.js`, `metro.config.js`, `tsconfig.json`, `jest.config.js`, `eslint.config.js`, `eas.json`, `.npmrc`
- Native patch hook: `postinstall` → `node patch-llama-gradle.js`

## Platform Requirements

**Development:**
- Node 22+, npm, Expo CLI / EAS CLI `>= 3.10.0`, Android Studio SDK (for `expo run:android`), Jest + ESLint + `tsc`
- Commands (`package.json` scripts): `npm start` (`expo start`), `npm run android` / `npm run ios`, `npm run lint`, `npm run typecheck`, `npm test` / `test:watch` / `test:coverage`

**Production:**
- Android APK via EAS (`production` profile, `buildType: apk`); `versionCode` 7 tracks Play/manual versioning in `app.json`
- iOS `supportsTablet: true` declared but no IPA submit profile configured in `eas.json` (`submit.production` is empty)
- Offline-first: full functionality without network except update check, model download, LAN sync, and opt-in telemetry; ~469 MB GGUF model downloaded on demand to `FileSystem.documentDirectory/models/`

---
*Stack analysis: 2026-10-10*
