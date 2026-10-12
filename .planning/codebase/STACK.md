# Technology Stack

**Analysis Date:** 2026-10-12

## Languages

**Primary:**
- JavaScript (ES2021) - Majority of app code: `App.js`, `src/screens/*.js`, `src/context/*.js`, `src/utils/*.js`, `src/navigation/*.js`, `src/components/*.js`
- TypeScript (~5.8.3, `strict: true`, `allowJs: true`, `checkJs: false`) - All new engine code: `src/behavior/*.ts`, `src/ai/*.ts`, `src/commands/*.ts`, `src/services/*.ts`, `widgets/*.tsx`
- TSX - Home-screen widgets: `widgets/FocusTimerWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/TasksListWidget.tsx`, `widgets/HabitWidget.tsx`, `widgets/widget-task-handler.tsx`

**Secondary:**
- Java/Gradle + Kotlin (native Android shell) - `android/app/build.gradle`, `android/build.gradle`, patched `node_modules/llama.rn/android/build.gradle` via `patch-llama-gradle.js`
- JSON/YAML config - `app.json`, `eas.json`, `tsconfig.json`, `.github/workflows/ci.yml`

## Runtime

**Environment:**
- Expo SDK `~57.0.0` (resolves `57.0.27`) on React Native `0.86.3` + React `19.2.3` (from `package.json`)
- **SDK 57 alignment (reconciled 2026-10-12, debug session `expo57-native-compat`):** every native
  module now matches `expo@57`'s `bundledNativeModules.json`. Before this, `package.json` mixed an
  SDK 57 core with SDK 53-generation native modules (`expo-*` at 0.x/1x.x, Reanimated 3). Verify
  with `npx expo install --check` (must print "Dependencies are up to date").
- Node `>=22.13` required (`package.json` `engines`); observed dev runtime Node `22.19.0` + npm `11.4.2`
- Metro bundler via `expo/metro-config` (`metro.config.js`); Babel via `babel-preset-expo` (`babel.config.js`); Hermes is the default RN runtime for release builds

**Package Manager:**
- npm (only manager in use)
- Lockfile: `package-lock.json` present — install with `npm ci` (as `.github/workflows/ci.yml` does)

## Frameworks

**Core:**
- Expo `~57.0.0` - App runtime, config plugins, EAS builds (`app.json`, `eas.json`)
- React Navigation `^7.5.0` (`@react-navigation/native`) + `@react-navigation/drawer` `^7.14.3` - Drawer/stack navigation. v7 is required by Reanimated 4: drawer v6 called `useAnimatedGestureHandler`, which Reanimated 4 **removed**. Only `createDrawerNavigator`, `NavigationContainer`, `useNavigation`, `useNavigationState` and `useFocusEffect` are used, all unchanged in v7. Navigation lives in in `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`
- `react-native-paper` `^5.10.5` - Themed `PaperProvider` wrapper in `App.js`
- `react-native-gesture-handler` `~2.32.0` + `react-native-reanimated` `4.5.1` + `react-native-worklets` `0.10.1` - Gestures, drawer, timer/list animations. Reanimated 4 is New-Architecture-only and requires worklets; its Babel plugin moved to `react-native-worklets/plugin` and is now configured **automatically by `babel-preset-expo`**, so `babel.config.js` lists no animation plugin. Only `src/components/CustomSwitch.js` imports Reanimated (and only `Animated.View`)
- `react-native-screens` `~4.26.0` + `react-native-safe-area-context` `~5.7.0` - Native screen container + safe areas (`App.js`)
- `expo-font` `~57.0.4` + `@expo-google-fonts/inter`, `@expo-google-fonts/hanken-grotesk`, `@expo-google-fonts/jetbrains-mono` - `useFonts` loading in `App.js`
- `expo-status-bar` `~57.0.1`, `expo-linear-gradient` `~57.0.2`, `@expo/vector-icons` `^15.0.2`, `react-native-modal` `^13.0.1`, `react-native-confetti-cannon` `^1.5.2`, `expo-haptics` `~57.0.3` - UI polish, dialogs, celebrations, haptics (`App.js`, `src/components/*.js`)

**Testing:**
- Jest `^29.7.0` + `jest-expo` `~57.0.5` + `@react-native/jest-preset` `0.86.3` (pinned explicitly: `legacy-peer-deps=true` in `.npmrc` skips this optional peer, and without it `jest-expo` crashes before running a single test) - Runner, preset `jest-expo/android` in `jest.config.js`
- `babel-jest` `^29.7.0` + `@types/jest` `^29.5.14` - Transform + types
- Run: `npm test` (all), `npm run test:watch`, `npm run test:coverage`; CI runs `npx jest --ci --maxWorkers=2 --coverage` (see `.github/workflows/ci.yml`)

**Build/Dev:**
- EAS CLI `>= 3.10.0` (`eas.json`) + `expo-dev-client` `~57.0.19` - `development` (internal APK, dev client), `preview` (internal), `production` (APK + `NODE_OPTIONS=--max-old-space-size=4096`)
- TypeScript `~6.0.3` (`tsconfig.json` extends `expo/tsconfig.base`) - `npm run typecheck` (`tsc --noEmit`). TS 6 no longer auto-includes `node_modules/@types`, so `tsconfig.json` declares `"types": ["jest", "node"]`; without it the suite reports ~1427 `Cannot find name 'expect'` errors
- ESLint `^9.39.4` flat config (`eslint.config.js`, legacy `.eslintrc.js` still present) + `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-native`, `@babel/eslint-parser` - `npm run lint`, `npm run lint:report`
- `babel-plugin-transform-remove-console` - Strips `console.log/info/debug` in production only, keeps `error`/`warn` (`babel.config.js`)
- `patch-llama-gradle.js` (runs on `postinstall`) - **No longer patches `llama.rn`.** The llama.rn branch was removed 2026-10-12: it force-unwrapped llama.rn's `if (isNewArchitectureEnabled())` guards so codegen ran while `newArchEnabled=false`. `android/gradle.properties` now sets `newArchEnabled=true`, which satisfies llama.rn's own gate, so the workaround was redundant. The remaining job is the unrelated `react-native-android-widget` sizing fallback (idempotent, fails closed)
- `expo-build-properties` `~57.0.22` - iOS `useFrameworks: static` (required by `llama.rn`) in `app.json`

## Key Dependencies

**Critical:**
- `llama.rn` `0.12.4` - On-device Qwen2.5-0.5B-Instruct Q4_K_M GGUF inference (~468 MB). Lifecycle in `src/utils/aiService.js`; heuristic fallbacks in `src/ai/*.ts`; Expo plugin entry in `app.json`
- `@react-native-async-storage/async-storage` `2.2.0` - Primary KV store for all app state (keys namespaced `kwestup_*`, storage version `v7.0` in `src/utils/storage.js`)
- `expo-file-system` `~57.0.7` - imported as **`expo-file-system/legacy`** (SDK 54+ moved the classic `documentDirectory`/async-function surface behind that subpath; the package default export is now the `Paths`/`File`/`Directory` API). Vault markdown files under `FileSystem.documentDirectory`, model cache under `models/`; used in `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/exportService.js`, `src/utils/aiService.js`, `src/screens/SettingsScreen.js`
- `crypto-js` `^4.2.0` - AES-256 + PBKDF2-HMAC-SHA256 backup encryption and SHA-256 model hashing in `src/utils/exportService.js`, `src/utils/aiService.js`
- `expo-notifications` `~57.0.22` - Local notifications only (tasks, birthdays, billing, focus timer, behavioral cues). Unified API in `src/services/notificationService.ts`; legacy adapter in `src/utils/notifications.js`

**Infrastructure:**
- `expo-camera` `~57.0.6` - QR sync-code scanning in `src/components/QRScannerModal.js` (permission string in `app.json`)
- `expo-document-picker` `~57.0.3` + `expo-sharing` `~57.0.22` - Encrypted backup import/export in `src/utils/vaultImport.js`, `src/utils/exportService.js`, `src/screens/SettingsScreen.js`
- `expo-clipboard` `~57.0.2` - Crash-log copy in `src/components/ErrorBoundary.js`
- `@react-native-community/datetimepicker` `9.1.0` - Date/time input in `src/components/CustomDateTimePicker.js`
- `react-native-android-widget` `^0.16.1` - Five home-screen widgets (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList`, `HabitWidget` in `app.json` + `widgets/*.tsx`); task handler registered in `index.js` via `widgets/widget-task-handler.tsx`
- `use-latest-callback` `^0.2.4` - Stable-callback helper for hooks

## Configuration

**Environment:**
- No `.env` files present (verified — no `EXPO_PUBLIC_*`, no `expo-constants` usage, no `process.env` app config beyond `NODE_ENV`/`__DEV__` guards in `src/utils/logger.js`, `src/utils/diagnostics.js`, `babel.config.js`)
- `.npmrc` file present — note existence only, contents never read (may hold registry auth)
- App identity in `app.json`: slug `kwestupmobile`, version `3.5.0`, Android package `com.omprakashp06.kwestupmobile` (`versionCode` 7), EAS `projectId` `9b029b06-5b07-4a1d-9999-a543a3ef1614`, owner `omprakash-p06`
- Storage versioning in `src/utils/storage.js`: `APP_VERSION = "v3.5.0"`, `STORAGE_VERSION = "v7.0"`; all keys prefixed `kwestup_*`

**Build:**
- `app.json` - Expo app identity, splash/icon, `llama.rn` + `expo-camera` + `expo-build-properties` + `react-native-android-widget` plugin configs
- `eas.json` - Build profiles (`development`/`preview`/`production`) + `submit.production`
- `tsconfig.json` - Extends `expo/tsconfig.base`, includes `src/**/*`, `widgets/**/*`, `__tests__/**/*`, root configs; `checkJs: false` by documented decision
- `babel.config.js` - `babel-preset-expo` + conditional `transform-remove-console` only. The worklets/Reanimated plugin is injected by `babel-preset-expo` automatically (Expo docs for SDK 57); the old explicit `react-native-reanimated/plugin` entry was removed
- `metro.config.js` - Default `expo/metro-config` (no customization)
- `jest.config.js` - Android preset, `transformIgnorePatterns` for RN/Expo/llama.rn/widget libs, `testMatch **/__tests__/**/*.test.[jt]s?(x)`, coverage floors statements 47 / branches 38 / functions 35 / lines 50
- `eslint.config.js` - Flat config for `**/*.{js,jsx}` (TS files currently uncovered); `android/`, `ios/`, `coverage/` ignored
- `android/` - Prebuilt native shell (`android/app/build.gradle`, `android/build.gradle`); do not hand-edit native code — change `app.json` + rebuild

## Platform Requirements

**Development:**
- Node `>=22.13`, npm, Expo CLI / EAS CLI `>= 3.10.0`
- `npm ci && npx expo start` for JS-only work; `npx expo run:android` / `npm run android` (or EAS `development` APK) for native modules (`llama.rn`, widgets, camera, notifications)
- Android emulator or device (widgets + `llama.rn` are Android-first; iOS only declares `supportsTablet: true`)
- ~600 MB free for GGUF model download at runtime (not bundled in the APK)

**Production:**
- EAS Build Android APK (`eas.json` `production` profile with 4 GB Node heap); distributed via GitHub Releases APK asset, not Play Store (`src/utils/diagnostics.js` `checkForUpdates`, `App.js` update prompt)
- Fully offline-capable after install except: one-time ~468 MB model download from HuggingFace, LAN sync to a paired PC, and optional opt-in telemetry POST
- No backend to deploy — local-first app; `api.kwestup.com/telemetry` is a stub endpoint, not a required service

---

*Stack analysis: 2026-10-12*
