# Technology Stack

**Analysis Date:** 2026-10-12

## Languages

**Primary:**
- JavaScript (ES2021) - Majority of app code: `App.js`, `src/screens/*.js`, `src/context/*.js`, `src/utils/*.js`, `src/navigation/*.js`, `src/components/*.js`
- TypeScript (strict) - Typed core services and engines: `src/services/notificationService.ts`, `src/services/types.ts`, `src/behavior/*.ts`, `src/domains/**/*.ts`, `widgets/*.tsx`
- TSX - Android home-screen widgets: `widgets/FocusTimerWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/TasksListWidget.tsx`, `widgets/HabitWidget.tsx`, `widgets/widget-task-handler.tsx`

**Secondary:**
- Java / Kotlin + Gradle (Android native shell) - `android/` (Expo prebuild output, `llama.rn` native module, `react-native-android-widget` hosts)
- JSON - Config and data envelopes: `app.json`, `eas.json`, `package.json`, encrypted-backup envelope in `src/utils/exportService.js`

## Runtime

**Environment:**
- Node.js `>=22.13` (declared in `package.json` engines; CI pins Node 22 via `actions/setup-node@v4` in `.github/workflows/ci.yml`)
- Expo SDK `~57.0.0` (`package.json`; note `app.json` still stamps `"sdkVersion": "53.0.0"` — stale field, harmless)
- React `19.2.3` + React Native `0.86.0` (Hermes via Expo default)
- Metro bundler via `expo/metro-config` (`metro.config.js`)

**Package Manager:**
- npm (only manager configured)
- Lockfile: present (`package-lock.json`, installed in CI with `npm ci`)
- Registry auth file: `.npmrc` present at repo root (existence only — never read for secrets)
- `postinstall`: `node patch-llama-gradle.js` — patches `node_modules/llama.rn/android/build.gradle` for Old Architecture JSI support (idempotent, see `patch-llama-gradle.js`)

## Frameworks

**Core:**
- Expo `~57.0.0` + `expo-dev-client` `~5.2.4` - Managed workflow with custom dev client (`expo start`, `expo run:android`, `expo run:ios`)
- React Navigation Drawer `^6.6.6` + Native `^6.1.9` - Drawer navigation (`src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`)
- `react-native-paper` `^5.10.5` - Material provider wrapping the app (`App.js` → `<PaperProvider>`)
- `react-native-gesture-handler` `~2.24.0` + `react-native-reanimated` `~3.17.4` - Gesture root + animations (`App.js`, `src/components/CustomSwitch.js`)
- `react-native-safe-area-context` `5.4.0` + `react-native-screens` `~4.11.1` - Safe areas and native screens
- `expo-font` `~13.3.2` + `@expo-google-fonts/{inter,hanken-grotesk,jetbrains-mono}` - Font loading via `useFonts` in `App.js`

**Testing:**
- Jest `^29.7.0` + `jest-expo` `~57.0.0` (android preset) - Runner, config in `jest.config.js`
- `babel-jest` `^29.7.0` + `@types/jest` `^29.5.14` - Transform and types
- `__tests__/setup/jest.setup.js` - Shared setup file (appended to `jest-expo/android` preset files)

**Build/Dev:**
- `babel-preset-expo` - Base preset (`babel.config.js`); `react-native-reanimated/plugin` always last; `babel-plugin-transform-remove-console` strips `log/info/debug` (keeps `error`/`warn`) in production only; Babel cache keyed on `NODE_ENV`
- TypeScript `~5.8.3` - `tsc --noEmit`; strict true, `allowJs: true`, `checkJs: false` (phased enablement noted in `tsconfig.json`)
- ESLint `^9.39.4` (flat config in `eslint.config.js`) + `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-native`, `@babel/eslint-parser`
- EAS CLI `>= 3.10.0` - Builds in `eas.json` (development internal APK + dev client, preview internal, production APK with `NODE_OPTIONS=--max-old-space-size=4096`)
- `expo-build-properties` `~0.14.8` - iOS `useFrameworks: static` (required by `llama.rn` static linking)

## Key Dependencies

**Critical:**
- `llama.rn` `0.12.4` - On-device LLM inference (Qwen2.5-0.5B-Instruct Q4_K_M GGUF, n_ctx 2048, CPU-only). Lifecycle in `src/utils/aiService.js` (`initLlama`, `releaseAllLlama`, idle-unload, AppState unload)
- `@react-native-async-storage/async-storage` `2.1.2` - Primary KV store for all app state (`src/utils/storage.js`, `src/context/*.js`)
- `expo-file-system` `~18.1.11` - Notes/vault markdown files (`src/utils/fileStorage.js`, `src/utils/vaultService.js`) + GGUF model download/verify (`src/utils/aiService.js`)
- `expo-notifications` `~0.31.4` - All local reminders via `src/services/notificationService.ts` (5 Android channels, policy-gated scheduler)
- `crypto-js` `^4.2.0` - SHA-256 model integrity (`src/utils/aiService.js`) + AES-256/PBKDF2 backup encryption (`src/utils/exportService.js`)
- `react-native-android-widget` `^0.16.1` - 5 home-screen widgets declared in `app.json` plugins, rendered by `widgets/*.tsx`, updated from `App.js`

**Infrastructure:**
- `expo-camera` `~16.1.11` - QR sync-code scanner (`src/components/QRScannerModal.js`)
- `expo-document-picker` `~13.1.6` + `expo-sharing` `~13.1.5` - Vault `.md` import (`src/utils/vaultImport.js`) and encrypted-backup export/share (`src/utils/exportService.js`, `src/screens/SettingsScreen.js`)
- `expo-clipboard` `~7.0.1` - Error-details copy in `src/components/ErrorBoundary.js`
- `expo-haptics` `~14.1.4` - Success/error tactile feedback across screens and `App.js`
- `expo-linear-gradient` `~14.1.5` - `LiquidGlassBackground` / `LiquidGlassCard` visuals
- `@react-native-community/datetimepicker` `8.4.1` - Backing picker for `src/components/CustomDateTimePicker.js`
- `react-native-modal` `^13.0.1` - App-level confirmation/name/telemetry dialogs in `App.js`
- `react-native-confetti-cannon` `^1.5.2` - Focus-session celebration in `App.js`
- `@expo/vector-icons` `^14.0.0` - Icon set
- `expo-status-bar` `~2.2.3` - Themed status bar in `App.js`
- `use-latest-callback` `^0.2.4` - Callback stability helper

## Configuration

**Environment:**
- No `.env` files present; `.env*.local` is gitignored. No `EXPO_PUBLIC_*` vars and no `process.env` app config — only `NODE_ENV`/`__DEV__` branching in `src/utils/logger.js` and `src/utils/diagnostics.js`
- Runtime config lives in `app.json` (`expo.extra.eas.projectId`, `owner: omprakash-p06`, Android `package: com.omprakashp06.kwestupmobile`, `versionCode: 7`) and version constants `APP_VERSION = "v3.5.0"` / `STORAGE_VERSION = "v7.0"` in `src/utils/storage.js`
- Secrets location: none — there are no API keys, tokens, or cloud credentials in the repo. LAN sync token is user-scanned at runtime (QR camera), never stored in config

**Build:**
- `app.json` - App identity, icons/splash, `llama.rn` + `expo-camera` + `expo-build-properties` + `react-native-android-widget` plugin config (5 widgets, 30-min `updatePeriodMillis`)
- `eas.json` - Build profiles and submit placeholder
- `babel.config.js` - Preset + env-conditional plugins
- `metro.config.js` - Default Expo Metro config (no customization)
- `tsconfig.json` - Extends `expo/tsconfig.base`, strict, includes `src/**/*`, `widgets/**/*`, `__tests__/**/*`, root configs
- `jest.config.js` - `jest-expo/android` preset, custom setup file, `transformIgnorePatterns` covering RN/Expo/Reanimated/Paper/llama.rn/widget libs
- `eslint.config.js` + `.eslintrc.js` (legacy, superseded by flat config) - Lint rules
- `android/` - Prebuilt native project (git-tracked shell; `android/app/build/`, `.gradle/` gitignored)
- `.npmrc` - Present (do not read contents)

## Platform Requirements

**Development:**
- Node 22+, npm, Expo CLI / EAS CLI `>= 3.10.0`
- `npm ci` then `npx expo start` (Expo Go incompatible with `llama.rn` native code — use `expo run:android` / dev-client APK from the `development` profile)
- Android SDK for local runs; large model download (~468 MB) needs stable Wi-Fi on first AI use

**Production:**
- Android-first target: internal-distribution APKs (`eas.json` builds `apk` for development and production); 5 Android widgets + notification channels are Android-gated in code (`Platform.OS === 'android'` checks in `App.js`, `src/services/notificationService.ts`)
- iOS supported as tablet-capable managed target (`supportsTablet: true`, static frameworks) but widgets/notifications paths are Android-optimized
- Deployment: EAS Build + GitHub Releases APK asset (consumed by in-app updater); no store-submit config beyond empty `eas.json` submit placeholder

---

*Stack analysis: 2026-10-12*
