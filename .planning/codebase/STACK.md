# Technology Stack

**Analysis Date:** 2026-10-11

## Languages

**Primary:**
- JavaScript (ES2021, JSX) - All app code: `App.js`, `src/screens/*.js`, `src/context/*.js`, `src/utils/*.js`, `src/components/*.js`, `src/navigation/*.js`
- TypeScript (strict, ~5.8.3) - Newer engine/service layer: `src/services/notificationService.ts`, `src/services/types.ts`, `src/behavior/*.ts`, `src/commands/types.ts`, `widgets/*.tsx`

**Secondary:**
- Java / Gradle (Android native shell) - `android/build.gradle`, `android/app/`, `android/settings.gradle` — Expo prebuild output + `llama.rn` native module
- JSON / config DSL - `app.json`, `eas.json`, `tsconfig.json`, `eslint.config.js`, `jest.config.js`, `metro.config.js`

## Runtime

**Environment:**
- Expo SDK `~57.0.0` (`package.json`) with React Native `0.86.0` and React `19.2.3`
- Node.js `>=22.13` (enforced via `package.json` `engines`; verified `v22.19.0` locally, CI uses `actions/setup-node@v4` with `node-version: 22`)
- Hermes (Expo default JS engine on device; JSC not configured)

**Package Manager:**
- npm `11.4.2` (lockfile `package-lock.json` present, committed)
- Install flag: `legacy-peer-deps=true` in `.npmrc` (required — React 19 / RN peer ranges conflict otherwise; CI uses `npm ci`)

**Note — SDK version drift:** `app.json` still declares `"sdkVersion": "53.0.0"` while installed `expo` is `~57.0.0` and `jest-expo` is `~57.0.0`. The installed version wins at build time; the stale `sdkVersion` field should be updated or removed.

## Frameworks

**Core:**
- Expo (managed workflow + dev-client `~5.2.4`) - App runtime, config plugins, EAS builds — `app.json`, `App.js`, `index.js`
- React Native `0.86.0` - Cross-platform UI primitives
- React Navigation `^6.x` (`@react-navigation/native ^6.1.9`, `@react-navigation/drawer ^6.6.6`) + `react-native-screens ~4.11.1` + `react-native-safe-area-context 5.4.0` - Drawer/tab navigation — `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`
- react-native-paper `^5.10.5` + `@expo/vector-icons ^14.0.0` - Material UI kit + icons (`PaperProvider` wraps app in `App.js`)
- react-native-reanimated `~3.17.4` (babel plugin **must be listed last** in `babel.config.js`) + `react-native-gesture-handler ~2.24.0` - Animations/gestures (`GestureHandlerRootView` in `App.js`)
- expo-font `~13.3.2` + `@expo-google-fonts/{inter,hanken-grotesk,jetbrains-mono}` - Bundled fonts loaded via `useFonts` in `App.js`

**Testing:**
- Jest `^29.7.0` + `jest-expo ~57.0.0` (`jest-expo/android` preset) + `babel-jest ^29.7.0` - Runner/transform — `jest.config.js`
- `@types/jest ^29.5.14`, `@types/react ~19.2.0` - Type support for tests

**Build/Dev:**
- `babel-preset-expo` + `react-native-reanimated/plugin` + `babel-plugin-transform-remove-console ^6.9.4` (strips `log/info/debug`, keeps `error/warn` in production) — `babel.config.js`
- Expo Metro (`expo/metro-config`) — `metro.config.js` (default config, no customization)
- TypeScript `~5.8.3` (`tsc --noEmit`, `strict: true`, `allowJs: true`, `checkJs: false`) — `tsconfig.json`
- ESLint `^9.39.4` (flat config) + `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-native`, `@babel/eslint-parser` — `eslint.config.js`, `.eslintrc.js` (legacy, superseded)
- EAS CLI `>= 3.10.0` - Cloud builds — `eas.json`
- `patch-llama-gradle.js` (runs as `postinstall`) - Patches `node_modules/llama.rn/android/build.gradle` for Old Architecture JSI support (idempotent)

## Key Dependencies

**Critical (app cannot function without):**
- `@react-native-async-storage/async-storage 2.1.2` - Primary KV store for all user state (tasks, habits, billing, vault registry, AI download state, notification history) — `src/utils/storage.js`, `src/utils/billingStorage.js`, `src/context/TaskContext.js`, `src/services/notificationService.ts`
- `expo-file-system ~18.1.11` - Vault markdown files on disk (`FileSystem.documentDirectory` + per-vault dirs) + LLM model binary storage — `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/aiService.js`
- `llama.rn 0.12.4` - On-device LLM inference (`initLlama` / `releaseAllLlama`) — `src/utils/aiService.js`
- `crypto-js ^4.2.0` - AES-256 backup encryption (PBKDF2-HMAC-SHA256, 100k iterations, v2 envelope) + model SHA-256 verification — `src/utils/exportService.js`, `src/utils/aiService.js`
- `expo-notifications ~0.31.4` - Local scheduled notifications, 5 Android channels — `src/services/notificationService.ts`

**Infrastructure / OS integration:**
- `expo-camera ~16.1.11` - QR sync-code scanner — `src/components/QRScannerModal.js` (permission string in `app.json`)
- `expo-document-picker ~13.1.6` + `expo-sharing ~13.1.5` - Encrypted backup import/export — `src/utils/vaultImport.js`, `src/utils/exportService.js`, `src/screens/SettingsScreen.js`
- `expo-clipboard ~7.0.1` - Copy diagnostics/error details — `src/components/ErrorBoundary.js`
- `expo-haptics ~14.1.4` - Tactile feedback on buttons, tasks, timers — `src/components/CustomButton.js`, `src/screens/*.js`, `src/context/TaskContext.js`
- `expo-dev-client ~5.2.4` - Custom dev builds (required: native modules `llama.rn` + widgets cannot run in Expo Go)
- `expo-build-properties ~0.14.8` - Native build flags (`ios.useFrameworks: static`) — `app.json`
- `react-native-android-widget ^0.16.1` - 4 home-screen widgets (FocusTimer, DailyTasks, ImportantTasks, TasksList) — `widgets/*.tsx`, `index.js` (`registerWidgetTaskHandler`)
- `expo-status-bar ~2.2.3`, `expo-linear-gradient ~14.1.5` - Status bar + glassmorphism backgrounds — `src/components/LiquidGlassBackground.js`
- `@react-native-community/datetimepicker 8.4.1` - Date/time pickers — `src/components/CustomDateTimePicker.js`
- `react-native-modal ^13.0.1`, `react-native-confetti-cannon ^1.5.2` - Modals + reward celebration — `App.js`, `src/components/TaskEditModal.js`
- `use-latest-callback ^0.2.4` - Stable-callback helper for hooks

## Configuration

**Environment:**
- No `.env` files exist in the repo (verified 2026-10-11) and no `EXPO_PUBLIC_*` / `process.env` app config is used outside `NODE_ENV` / `__DEV__` guards in `src/utils/diagnostics.js` and `src/utils/logger.js`
- All runtime configuration is code constants + AsyncStorage keys (`kwestup_*` prefixes enumerated in `src/utils/storage.js` → `isUserDataKey`) and static Expo config in `app.json` (`extra.eas.projectId`, Android `package`, widget definitions)
- Secrets location: none — there are no API keys or cloud credentials. Backup encryption passphrases are user-supplied at runtime and never persisted (see `src/utils/exportService.js`)

**Build:**
- `app.json` - Expo manifest (name/slug/version `3.5.0`, Android package `com.omprakashp06.kwestupmobile`, `versionCode` 7, camera permission, 4 widget specs, EAS `projectId`)
- `eas.json` - `development` (dev-client APK, internal), `preview` (internal), `production` (APK + `NODE_OPTIONS=--max-old-space-size=4096`)
- `babel.config.js` - `babel-preset-expo` + production console-stripping + reanimated plugin last; cache keyed on `NODE_ENV`
- `tsconfig.json` - Extends `expo/tsconfig.base`; `strict: true`, `allowJs: true`, `checkJs: false`; `widgets/**/*` excluded (2 pre-existing style-type errors tracked for hardening)
- `metro.config.js` - Stock `getDefaultConfig`, no custom resolvers
- `android/` - Prebuild native shell (`build.gradle`, `gradle.properties`, `settings.gradle`); do not hand-edit — regenerate via `expo prebuild`
- `.npmrc` - `legacy-peer-deps=true`
- `jest.config.js` - `jest-expo/android` preset, `transformIgnorePatterns` allow-list includes `llama.rn` and `react-native-android-widget`
- `eslint.config.js` - Flat config; `no-console: warn`, `react-hooks/rules-of-hooks: error`
- `.github/workflows/ci.yml` - Lint → typecheck → `jest --ci --maxWorkers=2 --coverage` on `main`/`development`
- `.github/workflows/semgrep.yml` + `.semgrepignore` - Security scan (`continue-on-error: true`)

## Platform Requirements

**Development:**
- Node `>=22.13`, npm with `legacy-peer-deps=true`
- Expo dev-client build on device/emulator (plain Expo Go is **not** sufficient — `llama.rn` and `react-native-android-widget` need native code): `npm run android` / `npm run ios` (`expo run:android` / `expo run:ios`)
- `npm start` (`expo start`) serves the JS bundle for dev-client or web (`npm run web`)
- Quality gates: `npm run lint`, `npm run typecheck` (`tsc --noEmit`), `npm test` (`jest`), `npm run test:coverage`

**Production:**
- Android APK via EAS (`eas.json` production profile); Android `versionCode` 7, package `com.omprakashp06.kwestupmobile`
- iOS configured (`supportsTablet: true`, `useFrameworks: static`) but no EAS iOS submit profile yet — `eas.json` `submit.production` is empty
- Fully offline-capable after install except: LAN sync (needs same-subnet PC server), update check (needs internet), and one-time ~469 MB LLM download (needs internet)
- No server, database, or push-notification service to provision — local notifications only

---

*Stack analysis: 2026-10-11*
