# Technology Stack

**Analysis Date:** 2026-10-01

## Languages

**Primary:**
- JavaScript (ES2021) - All runtime code in `src/`, `App.js`, `index.js`, `widgets/`, `__tests__/`
- TypeScript 5.8 (`~5.8.3`) - Type contracts only: `src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts`; config/tooling files `jest.config.js`, `babel.config.js`, `metro.config.js`, `eslint.config.js`, `patch-llama-gradle.js` are typechecked via `tsconfig.json` include (JS still `allowJs: true`, `checkJs: false`)

**Secondary:**
- JSON - `app.json`, `eas.json`, `package.json`, `rulebook/manifest.json`
- Gradle/Groovy + Kotlin/Java - Native Android shell in `android/` (`android/build.gradle`, `android/app/`, `android/settings.gradle`)
- Markdown - Governance docs in `rulebook/`, `src/domains/README.md`, `4.0/`

## Runtime

**Environment:**
- React Native `0.79.5` + React `19.0.0` via Expo SDK `53.0.0` (`sdkVersion: "53.0.0"` in `app.json`)
- Hermes (Expo default) on device; Metro bundler in dev via `metro.config.js`
- Node `>=22.13` required (`engines` in `package.json`); CI pins Node 22 in `.github/workflows/ci.yml`

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`, installed with `npm ci` in CI)

## Frameworks

**Core:**
- Expo `~53.0.20` - Managed workflow, native-module bridge, EAS builds (`app.json`, `eas.json`)
- React Navigation `^6.1.9` (`@react-navigation/native`) + Drawer `^6.6.6` (`@react-navigation/drawer`) - Navigation in `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`
- React Native Paper `^5.10.5` - Material UI components across `src/screens/`, `src/components/`
- React Native Reanimated `~3.17.4` - Animations (Babel plugin must stay last in `babel.config.js`)
- React Native Gesture Handler `~2.24.0` + Screens `~4.11.1` + Safe Area Context `5.4.0` - Navigation prerequisites

**Testing:**
- Jest `^29.7.0` + `jest-expo ~53.0.0` (preset `jest-expo/android` in `jest.config.js`) - 26 suites / 358 tests
- `babel-jest ^29.7.0`, `@types/jest ^29.5.14` - Transform + typings
- Setup: `__tests__/setup/jest.setup.js` (wired via `setupFiles` in `jest.config.js`)

**Build/Dev:**
- `babel-preset-expo` + `react-native-reanimated/plugin` + prod-only `babel-plugin-transform-remove-console ^6.9.4` (strips `log/info/debug`, keeps `error/warn`) - see `babel.config.js`
- TypeScript `~5.8.3` with `strict: true`, `noEmit: true` - `tsconfig.json` extends `expo/tsconfig.base`; `npm run typecheck` = `tsc --noEmit`; CI runs it as a gate (`.github/workflows/ci.yml`)
- ESLint `^9.39.4` (flat config in `eslint.config.js`) + `eslint-plugin-react ^7.37.5`, `eslint-plugin-react-hooks ^7.1.1`, `eslint-plugin-react-native ^5.0.0`, `@babel/eslint-parser ^7.29.7`
- EAS CLI `>= 3.10.0` (`eas.json`) - `development` / `preview` / `production` profiles (APK for Android)
- `patch-llama-gradle.js` (run as `postinstall`) - Patches `node_modules/llama.rn/android/build.gradle` for old-architecture support

## Key Dependencies

**Critical:**
- `llama.rn 0.12.4` - On-device LLM inference, used in `src/utils/aiService.js` (`initLlama`, `releaseAllLlama`); Expo plugin entry in `app.json`; model `qwen2.5-0.5b-instruct-q4_k_m.gguf` (~468 MB)
- `@react-native-async-storage/async-storage 2.1.2` - Primary key-value store, used in `src/utils/storage.js`, `src/utils/billingStorage.js`, `src/utils/vaultService.js`, `src/utils/exportService.js`, `src/utils/aiService.js`, `src/context/TaskContext.js`, `src/screens/SettingsScreen.js`
- `expo-file-system ~18.1.11` - Vault files, model download, backup import/export; used in `src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/vaultImport.js`, `src/utils/exportService.js`, `src/utils/aiService.js`, `src/screens/SettingsScreen.js`
- `expo-notifications ~0.31.4` - Local reminders; used in `src/utils/notifications.js`, `src/utils/billingNotifications.js`, `src/context/BirthdayContext.js`
- `crypto-js ^4.2.0` - AES-256 + PBKDF2 backup encryption + SHA-256 helpers; used in `src/utils/exportService.js`, `src/utils/aiService.js`

**Infrastructure:**
- `expo-camera ~16.1.11` - QR sync-code scanning in `src/components/QRScannerModal.js` (`CameraView`, `useCameraPermissions`)
- `expo-document-picker ~13.1.6` + `expo-sharing ~13.1.5` - Backup import/export in `src/utils/vaultImport.js`, `src/screens/SettingsScreen.js`, `src/utils/exportService.js`
- `expo-clipboard ~7.0.1` - Error copy in `src/components/ErrorBoundary.js`
- `expo-haptics ~14.1.4` - Tactile feedback across `src/screens/*`, `src/components/CustomButton.js`, `src/components/AIAssistant.js`, `src/context/TaskContext.js`
- `expo-font ~13.3.2` + `@expo-google-fonts/inter`, `@expo-google-fonts/hanken-grotesk`, `@expo-google-fonts/jetbrains-mono` - Bundled fonts
- `expo-dev-client ~5.2.4` + `expo-status-bar ~2.2.3` + `expo-linear-gradient ~14.1.5` - Dev builds, chrome, gradients
- `react-native-android-widget ^0.16.1` - 4 home-screen widgets (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList` in `app.json`); handler in `widgets/widget-task-handler.js`, registered in `index.js`
- `@react-native-community/datetimepicker 8.4.1`, `react-native-modal ^13.0.1`, `react-native-confetti-cannon ^1.5.2`, `@expo/vector-icons ^14.0.0`, `use-latest-callback ^0.2.4` - UI utilities

## Configuration

**Environment:**
- No `.env` file convention detected; no `react-native-dotenv` / `expo-constants` env reads. App is offline-first with zero required secrets.
- EAS project link in `app.json` (`extra.eas.projectId: 9b029b06-5b07-4a1d-9999-a543a3ef1614`, `owner: omprakash-p06`).
- `.env*` / secrets files: not present (do not create one for normal dev; passphrase-based backup encryption takes user input at runtime in `src/utils/exportService.js`).

**Build:**
- `app.json` - App identity (`KwestUp`, `com.omprakashp06.kwestupmobile`, `version 3.5.0`, `versionCode 7`), icons/splash, `expo-camera` permission string, `expo-build-properties` (iOS `useFrameworks: static`), widget declarations
- `eas.json` - Build profiles; `production` sets `NODE_OPTIONS=--max-old-space-size=4096`
- `tsconfig.json` - `strict: true`, `allowJs: true`, `checkJs: false` (1152 pre-existing JS errors tracked pre-Phase 22); `include: src/**`, `__tests__/**`, tooling configs; `exclude: node_modules`, `widgets/**` (2 pre-existing style-type errors tracked for Phase 25)
- `babel.config.js` - Env-keyed cache (`api.cache.using(() => process.env.NODE_ENV)`), prod console stripping
- `metro.config.js` - Default `expo/metro-config`
- `jest.config.js` - Android preset, `transformIgnorePatterns` allowlist for RN/Expo/llama.rn/widget libs, `testMatch: **/__tests__/**/*.test.[jt]s?(x)`, coverage from `src/**` (no global thresholds yet)
- `eslint.config.js` - Flat config; `no-console: warn`, `react-native/no-inline-styles: warn`; ignores `android/`, `ios/`, `assets/`, `coverage/`
- `android/gradle.properties`, `android/build.gradle`, `android/settings.gradle` - Native Android build settings

## Platform Requirements

**Development:**
- Node `>=22.13`, npm, Expo CLI / EAS CLI `>= 3.10.0`
- Android Studio + SDK for `expo run:android` / local `android/` builds; `npm run start` for Metro
- Scripts in `package.json`: `start` (`expo start`), `android` / `ios` (`expo run:android|ios`), `web` (`expo start --web`), `lint`, `lint:report`, `typecheck`, `test`, `test:watch`, `test:coverage`

**Production:**
- Android APK via EAS (`eas.json` `production` profile, `buildType: apk`); `versionCode 7` in `app.json`
- iOS config present (`supportsTablet: true`, `useFrameworks: static`) but primary target is Android
- Offline-capable: no server required; on-device LLM model downloads on first AI use (~468 MB into `FileSystem.documentDirectory`)

---

*Stack analysis: 2026-10-01*
