# Stack

**Analysis Date:** 2026-10-11

## Languages & Runtimes

- **JavaScript (JSX, no TS in app code)** — all app code under `src/` is `.js`; only `src/services/*.ts`, `src/behavior/*.ts`, `src/commands/*.ts` are TypeScript (`src/services/notificationService.ts:1`, `src/behavior/eventBus.ts:1`). `tsconfig.json:12` keeps `checkJs: false`.
- **TypeScript ~5.8.3** (dev only) — `package.json:67`.
- **Hermes (enabled)** — JS engine is Hermes, not JSC — `android/gradle.properties:64` (`hermesEnabled=true`).
- **Node >=22.13** required — `package.json:70-72`.

## Frameworks

- **Expo (managed + dev-client + prebuild)** — `expo-dev-client ~5.2.4` (`package.json:32`), `expo/metro-config` (`metro.config.js:1`), `babel-preset-expo` (`babel.config.js:23`), jest preset `jest-expo/android` (`jest.config.js:1-4`).
- **React 19.2.3 + React Native 0.86.0** — `package.json:42-43` (exact pins, no caret).
- **React Navigation v6** — `@react-navigation/native ^6.1.9`, `drawer ^6.6.6` (`package.json:25-26`); host in `App.js:915`.
- **React Native Paper ^5.10.5** (Material UI kit) — `package.json:48`, provider in `App.js:892`.
- **Reanimated ~3.17.4 + Gesture Handler ~2.24.0 + Screens ~4.11.1 + Safe-area 5.4.0** — `package.json:46,49,51`; reanimated babel plugin must stay last (`babel.config.js:19-20`); root wrapped in `GestureHandlerRootView` (`App.js:889`).

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `expo` | `~57.0.0` | Managed workflow, config plugins, Metro |
| `react` / `react-native` | `19.2.3` / `0.86.0` (exact) | UI runtime |
| `llama.rn` | `0.12.4` (exact) | On-device LLM (llama.cpp JSI, Old-Arch bridge) — `src/utils/aiService.js:10` |
| `@react-native-async-storage/async-storage` | `2.1.2` (exact) | Primary KV store — `src/utils/storage.js:1`, `App.js:178-193` |
| `expo-file-system` | `~18.1.11` | Vault markdown files on disk — `src/utils/fileStorage.js:1` |
| `expo-notifications` | `~0.31.4` | Local reminders (5 channels) — `src/services/notificationService.ts:20,35-73` |
| `expo-camera` | `~16.1.11` | QR sync scanner — `src/components/QRScannerModal.js:14` |
| `expo-document-picker` | `~13.1.6` | Backup-restore + markdown import — `src/utils/vaultImport.js:1`, `src/screens/SettingsScreen.js:6` |
| `expo-sharing` | `~13.1.5` | Share backup/model files — `src/utils/exportService.js:3,245-249` |
| `expo-clipboard` | `~7.0.1` | Copy crash reports — `src/components/ErrorBoundary.js:13,103-104` |
| `expo-font` + `@expo-google-fonts/{inter,hanken-grotesk,jetbrains-mono}` | `~13.3.2` / `^0.4.x` | 14 font faces loaded in `App.js:107-119` |
| `expo-haptics` | `~14.1.4` | Touch/sync feedback — `App.js:832,839` |
| `expo-build-properties` | `~0.14.8` | Native build props (iOS static frameworks) — `app.json:40-47` |
| `react-native-android-widget` | `^0.16.1` | 5 Android home-screen widgets — `app.json:48-115`, `index.js:2,11` |
| `crypto-js` | `^4.2.0` | AES-256 + PBKDF2 backup encryption, SHA-256 model hash — `src/utils/exportService.js:1,21-47`, `src/utils/aiService.js:13` |
| `@react-native-community/datetimepicker` | `8.4.1` (exact) | Date/time pickers — `src/components/CustomDateTimePicker.js` |
| `expo-linear-gradient` / `expo-status-bar` | `~14.1.5` / `~2.2.3` | Visual chrome — `App.js:8,890` |
| `react-native-modal` / `react-native-confetti-cannon` / `@expo/vector-icons` | `^13.0.1` / `^1.5.2` / `^14.0.0` | Dialogs, celebrations, icons — `App.js:5-6,963` |

## Tooling (build/test/lint)

- **Build:** EAS CLI `>=3.10.0` (`eas.json:2-4`); profiles `development` (dev-client APK), `preview` (internal), `production` (APK + `NODE_OPTIONS=--max-old-space-size=4096`) (`eas.json:5-23`). `postinstall: node patch-llama-gradle.js` (`package.json:16`) patches `llama.rn` Old-Arch JSI + widget sizing fallbacks (`patch-llama-gradle.js:1-165`).
- **Babel:** `babel-preset-expo` + production `transform-remove-console` (keeps error/warn) + reanimated last (`babel.config.js:15-20`).
- **Metro:** default Expo config, no customization (`metro.config.js:1-5`).
- **Test:** Jest `^29.7.0` + `jest-expo ~57.0.0` + `babel-jest` (`package.json:58,64-66`); suites under `__tests__/**/*.test.js` (`jest.config.js:24`); scripts `test` / `test:watch` / `test:coverage` (`package.json:13-15`).
- **Lint/typecheck:** ESLint `^9.39.4` flat config + react/react-hooks/react-native plugins (`eslint.config.js:1-48`); `tsc --noEmit` via `typecheck` script (`package.json:12`).

## Platform Targets

- **Android (primary):** package `com.omprakashp06.kwestupmobile`, `versionCode 7` (`app.json:25-26`); ABIs `armeabi-v7a,arm64-v8a,x86,x86_64` (`android/gradle.properties:34`); 16 KB page-size flags injected for Android 16 (`android/build.gradle:41-53`); `expo.useLegacyPackaging=true`, edge-to-edge on (`android/gradle.properties:79,84`); widgets Android-only, guarded by `Platform.OS !== 'android'` (`App.js:598,637`).
- **iOS (secondary):** tablet supported (`app.json:17-19`); static frameworks (`app.json:43-45`).
- **Web:** favicon only (`app.json:28-30`); `expo start --web` script present (`package.json:9`) but not a target.

## Pins/Notes

- **Old Architecture forced OFF-new-arch:** `newArchEnabled=false` (`android/gradle.properties:60`) — deliberate: Fabric crashes on NothingOS + `llama.rn` uses Old-Arch `getCatalystInstance()` bridge (`android/gradle.properties:42-60`).
- **Hermes ON:** `hermesEnabled=true` (`android/gradle.properties:64`).
- **Exact native pins (do not float):** `react 19.2.3`, `react-native 0.86.0`, `llama.rn 0.12.4`, `async-storage 2.1.2`, `datetimepicker 8.4.1`, `safe-area-context 5.4.0` (`package.json:23-52`).
- **SDK version drift (known):** `package.json` declares Expo `~57.0.0` but `app.json:31` still stamps `sdkVersion: 53.0.0`, installed `node_modules/expo` resolves to `53.0.20`, and `README.md:3-4,50` badges claim Expo 53 / RN 0.79. Treat `package.json` as intent; `app.json` + README are stale — reconcile before release.
- **AI model pin:** Qwen2.5-0.5B Q4_K_M GGUF, HF commit `9217f5db…`, SHA-256 + 491,400,032-byte size gate (`src/utils/aiService.js:23-30`).
- **EAS project:** ID `9b029b06-…` (`app.json:117-119`), owner `omprakash-p06` (`app.json:122`).

---
*Stack analysis: 2026-10-11*
