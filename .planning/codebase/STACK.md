# Technology Stack

**Analysis Date:** 2026-10-11

## Languages

**Primary:**
- JavaScript (ES2021) - All app logic: `App.js`, `src/screens/*.js`, `src/utils/*.js`, `src/context/*.js`, `src/components/*.js`, `src/navigation/*.js`
- TypeScript (strict) - New typed layer: `src/services/notificationService.ts`, `src/services/types.ts`, `src/behavior/eventBus.ts`, `src/behavior/types.ts`, `src/commands/types.ts`, `widgets/*.tsx`

**Secondary:**
- Java (Android native) - Patched host files under `node_modules/` at install time (see `patch-llama-gradle.js`); project-level native config in `android/`
- Gradle DSL (Groovy) - Native build scripts: `android/build.gradle`, `android/app/build.gradle`, `android/settings.gradle`

## Runtime

**Environment:**
- Expo SDK ~57.0.0 (`expo": "~57.0.0"` in `package.json`) — note `app.json` still declares `"sdkVersion": "53.0.0"` (stale field, harmless)
- React Native 0.86.0, React 19.2.3
- Hermes (default RN JS engine via `babel-preset-expo`); Node >=22.13 required (`engines` in `package.json`, CI pins Node 22)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`)
- Install hook: `postinstall` runs `node patch-llama-gradle.js` (fail-closed native patches)

## Frameworks

**Core:**
- Expo (managed + dev-client, `expo-dev-client ~5.2.4`) - App shell, OTA-adjacent config, native modules
- React Navigation 6 (`@react-navigation/native ^6.1.9`, `@react-navigation/drawer ^6.6.6`) + `react-native-screens ~4.11.1` - Navigation in `src/navigation/AppNavigator.js`
- React Native Paper ^5.10.5 - Themed UI primitives (`PaperProvider` in `App.js`, `useTheme` in `src/components/TaskCard.js`)
- Reanimated ~3.17.4 (+ `react-native-reanimated/plugin` last in `babel.config.js`) - Animations (`src/components/CustomSwitch.js`)
- Gesture Handler ~2.24.0 (`GestureHandlerRootView` in `App.js`)

**Testing:**
- Jest 29.7.0 + `jest-expo ~57.0.0` (preset `jest-expo/android`) - Runner, config in `jest.config.js`
- `babel-jest`, `@types/jest ^29.5.14` - Transform + types
- Run commands: `npm test` (all), `npm run test:watch`, `npm run test:coverage`

**Build/Dev:**
- Babel: `babel-preset-expo` + `react-native-reanimated/plugin` + prod-only `transform-remove-console` (keeps `error`/`warn`) — `babel.config.js`
- Metro: default Expo config — `metro.config.js`
- TypeScript ~5.8.3, base `expo/tsconfig.base`, `strict: true`, `checkJs: false` — `tsconfig.json`
- ESLint 9 (flat config) + `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-native` — `eslint.config.js`, `npm run lint`
- EAS Build/Submit CLI >= 3.10.0 — `eas.json` (development / preview / production profiles, APK output for Android)

## Key Dependencies

**Critical:**
- `llama.rn 0.12.4` - On-device LLM inference (`initLlama`/`releaseAllLlama` in `src/utils/aiService.js`); Expo plugin `llama.rn` in `app.json`; patched at install by `patch-llama-gradle.js`
- `crypto-js ^4.2.0` - AES-256 backup encryption + SHA-256 model hashing in `src/utils/exportService.js`, `src/utils/aiService.js`
- `@react-native-async-storage/async-storage 2.1.2` - Primary structured store (tasks, billing, prefs) — `src/utils/storage.js`, `src/utils/billingStorage.js`, `src/utils/vaultService.js`
- `expo-file-system ~18.1.11` - Vault markdown files + model download (`FileSystem.documentDirectory/Notes/Vaults/`, `models/`) — `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/aiService.js`
- `expo-notifications ~0.31.4` - All scheduled reminders via `src/services/notificationService.ts` (5 Android channels)
- `expo-camera ~16.1.11` - QR sync-code scanning in `src/components/QRScannerModal.js`
- `react-native-android-widget ^0.16.1` - 4 home-screen widgets (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList` in `app.json` + `widgets/*.tsx`); patched at install by `patch-llama-gradle.js`

**Infrastructure:**
- `expo-font ~13.3.2` + `@expo-google-fonts/{inter,hanken-grotesk,jetbrains-mono}` - Bundled fonts loaded in `App.js`
- `expo-document-picker ~13.1.6` + `expo-sharing ~13.1.5` - Encrypted `.kwestup` backup import/export in `src/utils/exportService.js`, `src/utils/vaultImport.js`, `src/screens/SettingsScreen.js`
- `expo-clipboard ~7.0.1` - Copy error details in `src/components/ErrorBoundary.js`
- `expo-haptics ~14.1.4` - Tactile feedback across screens/components
- `expo-status-bar ~2.2.3`, `expo-linear-gradient ~14.1.5` - UI chrome
- `@react-native-community/datetimepicker 8.4.1` + `CustomDateTimePicker` - Date input in `src/components/CustomDateTimePicker.js`
- `react-native-modal ^13.0.1`, `react-native-confetti-cannon ^1.5.2`, `@expo/vector-icons ^14.0.0`, `react-native-safe-area-context 5.4.0` - UI layer
- `use-latest-callback ^0.2.4` - Callback helper
- `expo-build-properties ~0.14.8` (iOS `useFrameworks: static` for llama.rn compat) - `app.json`

## Configuration

**Environment:**
- No `.env` consumption detected — app is offline-first; configuration lives in `app.json` (`expo.extra.eas.projectId`, owner `omprakash-p06`, Android package `com.omprakashp06.kwestupmobile`, `versionCode: 7`), `eas.json` build profiles, and AsyncStorage keys (`kwestup_*_${STORAGE_VERSION}`)
- `.env*` files: none required by code. A `.npmrc` file exists at repo root (existence only — contents not read per secret hygiene)
- Storage versions: `APP_VERSION = "v3.5.0"` and `STORAGE_VERSION = "v7.0"` in `src/utils/storage.js`; migration logic in `migrateUserDataIfNeeded()`

**Build:**
- `app.json` - Expo app config (name/slug/version, icons, splash, plugins, Android widgets, EAS projectId)
- `eas.json` - Build profiles: `development` (dev-client, internal APK), `preview` (internal), `production` (APK + `NODE_OPTIONS=--max-old-space-size=4096`)
- `android/` - Ejected/native project (`build.gradle`, `settings.gradle`, `gradle.properties`, `gradlew`)
- `babel.config.js`, `metro.config.js`, `tsconfig.json`, `eslint.config.js`, `jest.config.js` - Toolchain configs
- `patch-llama-gradle.js` - Postinstall native patcher (fail-closed, exits 1 on mismatch)

## Platform Requirements

**Development:**
- Node >= 22.13 (CI uses Node 22 + `npm ci`), npm, Expo CLI / EAS CLI >= 3.10.0
- Android Studio + emulator or physical Android device (primary target; widgets are Android-only)
- Expo Dev Client build for native modules (`llama.rn`, widgets, camera) — plain Expo Go is insufficient
- ~500 MB free device storage for the on-device AI model download

**Production:**
- Android APK via EAS (`production` profile, `buildType: apk`), package `com.omprakashp06.kwestupmobile`
- iOS declared (`supportsTablet: true`) but CI builds/tests target Android preset (`jest-expo/android`); Android is the supported production target
- Fully offline-capable; no backend required at runtime (optional LAN sync PC server + optional telemetry endpoint)

---

*Stack analysis: 2026-10-11*
