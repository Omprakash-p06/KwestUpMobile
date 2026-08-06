# Technology Stack

**Analysis Date:** 2026-08-06

## Project Overview

KwestUp Mobile (`kwestupmobile`, v3.5.0) is a native Android-first productivity app built with the Expo managed workflow. Features include daily tasks, personal tasks, markdown notes organized into "vaults", a focus timer, birthday reminders, billing/expense tracking, on-device AI assistance, and Android home-screen widgets.

## Languages

**Primary:**
- JavaScript (ES2021, JSX) — all application logic in `src/screens`, `src/components`, `src/utils`, and `App.js`. Uses the older ES module style with Babel.
- TypeScript (5.8.3) — used only for the Android home-screen widget layer under `widgets/*.tsx` (e.g. `widgets/FocusTimerWidget.tsx`, `widgets/widget-task-handler.tsx`). The core app is not type-checked.

**Secondary:**
- Kotlin — Android native config applied via Gradle plugins (`org.jetbrains.kotlin.android`) in `android/app/build.gradle`.
- Groovy (Gradle DSL) — `android/app/build.gradle`, `android/settings.gradle`.
- Java — patched native source of third-party libs via `patch-llama-gradle.js`.

## Runtime

**Environment:**
- React Native `0.79.5` on React `19.0.0`
- Expo SDK `53.0.0` (`expo` `~53.0.20`)
- Hermes JS engine enabled (`hermesEnabled=true` in `android/gradle.properties`)
- **Old Architecture only** — `newArchEnabled=false` is hard-locked in `android/gradle.properties` due to a NothingOS startup crash (`DefaultNewArchitectureEntryPoint.load()` conflict) and because `llama.rn` targets the Old Arch CatalystInstance bridge API.

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- **React Native / Expo** `~53.0.20` — app framework. Entry point `index.js` registers the root component and the widget task handler via `react-native-android-widget`.
- **React Navigation** `@react-navigation/native` `^6.1.9` + `@react-navigation/drawer` `^6.6.6` — navigation, wired in `src/navigation/AppNavigator.js`.
- **react-native-paper** `^5.10.5` — Material UI theming/PaperProvider, used in `App.js`.

**Testing:**
- **Jest** referenced via ESLint `env: { jest: true }` (`.eslintrc.js`). Single test file present: `__tests__/phase12-widget-logic.test.js`. No Jest config file detected.

**Build/Dev:**
- **Expo CLI** — scripts `expo start`, `expo run:android`, `expo run:ios`, `expo start --web` in `package.json`.
- **Metro** bundler — standard Expo config `metro.config.js`.
- **Babel** — `babel.config.js` uses `babel-preset-expo` plus `react-native-reanimated/plugin`.
- **Gradle 8.13** wrapper — `android/gradle/wrapper/gradle-wrapper.properties`. Kotlin build plugin `org.jetbrains.kotlin.android`.
- **react-native-reanimated** `~3.17.4` — animations; requires its Babel plugin.

## Key Dependencies

**Critical:**
- `expo` `~53.0.20` — core SDK and build toolchain.
- `react-native` `0.79.5` — UI runtime.
- `react` `19.0.0` — component model.
- `llama.rn` `^0.12.4` — on-device LLM inference for AI Assistant features (see INTEGRATIONS.md).
- `@react-native-async-storage/async-storage` `2.1.2` — all structured app data (tasks, birthdays, themes, vaults, billing) as JSON key/value.
- `expo-file-system` `~18.1.11` — markdown note files in vaults, AI model file download, backup read/write.
- `react-native-android-widget` `^0.16.1` — Android home-screen widgets (FocusTimer, DailyTasks, ImportantTasks, TasksList).

**Infrastructure:**
- `expo-notifications` `~0.31.4` — local scheduled notifications (task due dates, daily tasks, birthday + advance reminders, recurring bill reminders).
- `expo-camera` `~16.1.11` — QR code scanning for PC sync pairing (`src/components/QRScannerModal.js`).
- `expo-document-picker` `~13.1.6` — import markdown vaults (`src/utils/vaultImport.js`) and settings restore.
- `expo-sharing` `~13.1.5` — export share sheet for backups (`src/utils/exportService.js`).
- `crypto-js` `^4.2.0` — AES-256 + PBKDF2 backup encryption/decryption (`src/utils/exportService.js`).
- `@expo-google-fonts/{inter,hanken-grotesk,jetbrains-mono}` — bundled fonts loaded via `expo-font`.
- `@expo/vector-icons` `^14.0.0` — MaterialCommunityIcons.
- `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens`, `react-native-safe-area-context` — navigation/gesture stack.
- `expo-linear-gradient`, `expo-haptics`, `expo-status-bar`, `@react-native-community/datetimepicker`, `react-native-modal`, `react-native-confetti-cannon`.

**Dev/QA:**
- `eslint` `^9.39.4` with `@babel/eslint-parser`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-native`.
- `typescript` `~5.8.3`, `@types/react` `~19.0.10`.
- `@babel/core` `^7.20.0`.

## Configuration

**Environment:**
- No `.env` files present. No runtime env-var reads in source. Most runtime configuration is user-entered (sync host/token) or stored in AsyncStorage (theme mode, name, telemetry opt-in).
- Hardcoded external endpoints live in source:
  - `src/utils/diagnostics.js` — GitHub Releases API, `https://httpbin.org/json`, `https://api.kwestup.com/telemetry`.
  - `src/utils/aiService.js` — HuggingFaceGGQF model URL.
- EAS project identity stored in `app.json` under `extra.eas.projectId` (`9b029b06-5b07-4a1d-9999-a543a3ef1614`), owner `omprakas-p06`.

**Build:**
- `eas.json` — EAS build profiles: `development` (internal, APK), `preview` (internal), `production` (APK with `NODE_OPTIONS=--max-old-space-size=4096`). Submission via `production` profile.
- `app.json` — Expo app config: name `KwestUp`, v3.5.0, Android package `com.omprakashp06.kwestupmobile`, versionCode 7; Expo plugins `llama.rn`, `expo-camera`, `expo-build-properties` (iOS static frameworks), `react-native-android-widget` (4 widget defs).
- `tsconfig.json` — extends `expo/tsconfig.base`, no strict overrides.
- `postinstall` script `node patch-llama-gradle.js` patches `llama.rn` and `react-native-android-widget` native sources for old-architecture & widget sizing fallbacks. Any dependency upgrade that regenerates `node_modules` re-triggers this patch.

## Platform Requirements

**Development:**
- Node + npm and the Expo/React Native toolchain.
- Android SDK (SDK 3.5.0/native builds run via `expo run:android`).
- Android day-to-day dev; iOS config exists (`ios.supportsTablet`, `expo-build-properties` static frameworks) but Linux machines cannot build iOS directly.

**Production:**
- Distribution via EAS Build producing Android APKs (`.github/workflows`). No store auto-submit configured further.
- Security scanning via Semgrep via GitHub Actions workflow `.github/workflows/semgrep.yml`.

---

*Stack analysis: 2026-08-06*