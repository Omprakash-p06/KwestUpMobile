# Stack

**Analysis Date:** 2026-10-11

## Languages & Runtimes

- **JavaScript (mixed JS + TS)** — `allowJs: true`, `strict: true`, `checkJs: false` (`tsconfig.json:3-13`); most `src/context`, `src/utils` are `.js`, new `src/ai/*`, `src/commands/*` are `.ts`.
- **JS engine: Hermes** — `hermesEnabled=true` (`android/gradle.properties:64`).
- **React Native architecture: Old Architecture (Paper/bridge)** — `newArchEnabled=false` (`android/gradle.properties:60`); llama.rn uses Old-Arch bridge `getCatalystInstance().getJSCallInvokerHolder()` (comment `android/gradle.properties:42-60`).
- **Node `>=22.13`** — `package.json:70-72`. **TypeScript `~5.8.3`** (`package.json:67`).

## Frameworks

- **Expo `~57.0.0`** — managed workflow + prebuild (`android/` committed), entry `index.js:1-11` (`registerRootComponent` + `registerWidgetTaskHandler`).
- **React `19.2.3` + React Native `0.86.0`** (`package.json:42-43`).
- **Navigation:** `@react-navigation/native ^6.1.9`, `@react-navigation/drawer ^6.6.6` (`package.json:25-26`); navigator at `src/navigation/AppNavigator.js`.
- **UI:** `react-native-paper ^5.10.5`, `@expo/vector-icons ^14.0.0`, `expo-linear-gradient ~14.1.5`, `react-native-modal ^13.0.1`, `react-native-confetti-cannon ^1.5.2` (`package.json:22,37,45,47-48`).
- **Animation/gesture:** `react-native-reanimated ~3.17.4` (Babel plugin must be last, `babel.config.js:19-20`), `react-native-gesture-handler ~2.24.0`, `react-native-screens ~4.11.1`, `react-native-safe-area-context 5.4.0` (`package.json:46,49-51`).

## Key Dependencies

| package | version | purpose |
|---|---|---|
| `expo` | `~57.0.0` | managed runtime, config plugins (`package.json:28`) |
| `react` / `react-native` | `19.2.3` / `0.86.0` | UI runtime (`package.json:42-43`) |
| `llama.rn` | `0.12.4` (pinned, no `~^`) | on-device LLM inference via `initLlama` (`package.json:41`, `src/utils/aiService.js:10`) |
| `Qwen2.5-0.5B-Instruct Q4_K_M GGUF` | file `qwen2.5-0.5b-instruct-q4_k_m.gguf`, ~468 MB | offline intent-parser model (`src/utils/aiService.js:23-30`) |
| `@react-native-async-storage/async-storage` | `2.1.2` (pinned) | primary KV persistence for habits/vaults/notif history (`package.json:23`) |
| `expo-file-system` | `~18.1.11` | model download, vault/note files, backup I/O (`package.json:34`) |
| `expo-notifications` | `~0.31.4` | local scheduled reminders, 5 Android channels (`package.json:38`, `src/services/notificationService.ts:35-73`) |
| `expo-camera` | `~16.1.11` | QR sync-code scanning, permission in `app.json:34-39` |
| `expo-document-picker` / `expo-sharing` | `~13.1.6` / `~13.1.5` | vault import / backup export share sheet (`src/utils/vaultImport.js:1-2`, `src/utils/exportService.js:2-3`) |
| `expo-clipboard` | `~7.0.1` | copy sync tokens / backup text |
| `expo-font` + `@expo-google-fonts/{inter,hanken-grotesk,jetbrains-mono}` | `~13.3.2` | bundled fonts loaded in `App.js:12-29` |
| `expo-haptics` | `~14.1.4` | tactile feedback |
| `expo-dev-client` | `~5.2.4` | dev builds (`eas.json:6-12`) |
| `expo-build-properties` | `~0.14.8` | iOS `useFrameworks: static` (`app.json:40-47`) |
| `react-native-android-widget` | `^0.16.1` | 5 home-screen widgets (`app.json:48-115`, `widgets/*.tsx`) |
| `crypto-js` | `^4.2.0` | AES-256/PBKDF2 backup encryption, SHA-256 model hash (`src/utils/exportService.js:1`, `src/utils/aiService.js:13`) |
| `@react-native-community/datetimepicker` | `8.4.1` (pinned) | reminder/time pickers |
| `use-latest-callback` | `^0.2.4` | hook helper |
| `jest-expo` / `jest` / `babel-jest` | `~57.0.0` / `^29.7.0` | Android jest preset (`jest.config.js:1-4`) |

## Tooling (build/test/lint)

- **Babel:** `babel-preset-expo` + prod-only `transform-remove-console` (keeps `error`/`warn`) + `react-native-reanimated/plugin` last (`babel.config.js:15-20`); cache keyed on `NODE_ENV` (`babel.config.js:6-10`).
- **Metro:** default Expo config (`metro.config.js:1-5`).
- **Tests:** Jest `^29.7.0` with `jest-expo/android` preset, setup `__tests__/setup/jest.setup.js`, `transformIgnorePatterns` covers `llama.rn` + `react-native-android-widget` (`jest.config.js:1-11`); scripts `test`, `test:watch`, `test:coverage` (`package.json:13-15`).
- **Lint:** ESLint 9 flat config `eslint.config.js:6-48` (react, react-native, hooks plugins; `no-console: warn`); legacy `.eslintrc.js` also present; `lint` / `lint:report` scripts (`package.json:10-11`).
- **Typecheck:** `tsc --noEmit` (`package.json:12`).
- **Native patches (postinstall):** `node patch-llama-gradle.js` (`package.json:16`) unwraps `isNewArchitectureEnabled()` guards in `llama.rn/android/build.gradle` and injects `getFallbackSize` into `RNWidgetUtil.java` (`patch-llama-gradle.js:6-165`).
- **EAS:** CLI `>=3.10.0`; `development` (dev-client, internal APK), `preview` (internal), `production` (APK + `NODE_OPTIONS=--max-old-space-size=4096`) (`eas.json:1-24`); projectId `9b029b06-...` (`app.json:117-120`).

## Platform Targets

- **Android (primary):** package `com.omprakashp06.kwestupmobile`, `versionCode 7` (`app.json:20-27`); ABIs `armeabi-v7a,arm64-v8a,x86,x86_64`, AndroidX, `expo.useLegacyPackaging=true` (Android 16 16KB pages), `edgeToEdgeEnabled=true` (`android/gradle.properties:34,26,79,84`); Gradle JVM 4 GB, parallel + caching (`android/gradle.properties:13-20`).
- **iOS:** tablet support, static frameworks (`app.json:17-19`, `app.json:40-47`).
- **Web:** favicon only (`app.json:28-30`).

## Pins/Notes

- **Exact native pins (no range):** `llama.rn 0.12.4`, `async-storage 2.1.2`, `datetimepicker 8.4.1`, `safe-area-context 5.4.0`, `react-native 0.86.0`, `react 19.2.3` (`package.json:23-24,41-43,50`).
- **`newArchEnabled=false` — do not flip** without non-NothingOS stability proof + llama.rn New-Arch API migration (`android/gradle.properties:42-60`).
- **SDK drift:** `app.json:31` declares `sdkVersion: 53.0.0` while installed `expo ~57.0.0` / `jest-expo ~57.0.0` — treat 57 as truth, stale field is technical debt.
- **Model pin:** commit `9217f5db79a29953eb74d5343926648285ec7e67`, SHA-256 `74a4da8c…7a9db`, size `491400032` B, URL `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/...` (`src/utils/aiService.js:23-28`).

---
*Stack analysis: 2026-10-11*
