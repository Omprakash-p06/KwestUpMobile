# Technology Stack

**Analysis Date:** 2026-10-18

## Languages

**Primary:**
- JavaScript (ES2021, JSX) - Screens, components, React contexts, utilities (`App.js`, `src/screens/`, `src/components/`, `src/context/`, `src/utils/`)
- TypeScript (~6.0.3) - Behavior domain engines, AI pipeline, command gateway, widget handler, notification service (`src/behavior/`, `src/ai/`, `src/commands/`, `src/services/`, `widgets/`)

**Secondary:**
- Java / Kotlin (Android native) - Gradle build config, widget receivers (`android/app/src/main/java/`, `android/app/main/AndroidManifest.xml`)
- C/C++ (transitive) - Compiled by `llama.rn` native inference bindings via CMake/NDK
- Markdown - Vault note content stored as `.md` files

## Runtime

**Environment:**
- Node.js `>=22.13.0` (declared in `package.json` `engines`)
- Hermes JS engine (`hermesEnabled=true` in `android/gradle.properties`)
- React Native New Architecture is mandatory (`newArchEnabled=true`; opt-out removed in RN 0.82)

**Package Manager:**
- npm (lockfile: `package-lock.json` present)
- `.npmrc` sets `legacy-peer-deps=true`
- `postinstall` hook runs `patch-llama-gradle.js`

## Frameworks

**Core:**
- Expo SDK `~57.0.0` - Managed/prebuild workflow, native module autolinking
- React Native `0.86.3` - Mobile runtime
- React `19.2.3` - UI layer
- React Navigation `@react-navigation/native` `^7.5.0` + `@react-navigation/drawer` `^7.14.3` - Navigation (`src/navigation/AppNavigator.js`)
- React Native Paper `^5.10.5` - UI design system
- llama.rn `0.12.4` - On-device LLM inference (Qwen2.5-0.5B-Instruct GGUF)
- react-native-android-widget `^0.16.1` - 5 native Android home-screen widgets (`widgets/`)

**Testing:**
- Jest `^29.7.0` with `jest-expo/android` preset - Unit/integration tests (`__tests__/`)
- fast-check `^4.10.2` - Property-based testing (`__tests__/unit/propertyBased.test.ts`)
- Stryker Mutator `^8.7.1` (`@stryker-mutator/core`, `jest-runner`) - Mutation testing on `src/utils/taskMutations.js`
- @types/jest `^29.5.14`

**Build/Dev:**
- Babel `^7.29.0` with `babel-preset-expo` (`babel.config.js`)
- Metro (`expo/metro-config`, `metro.config.js`) - Default Expo Metro config
- TypeScript `~6.0.3` - `tsc --noEmit` typecheck gate (`tsconfig.json`)
- ESLint `^9.39.4` (flat config `eslint.config.js`) with `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-native`
- babel-plugin-transform-remove-console `^6.9.4` - Strips `console.log/info/debug` in production bundles
- Expo Dev Client `~57.0.19` - Custom native modules require dev builds (not Expo Go)
- EAS Build (`eas.json`) - `development`, `preview`, `production` profiles

## Key Dependencies

**Critical:**
- `@react-native-async-storage/async-storage` `2.2.0` - Primary persistence (storage schema `v7.0`, key prefix `kwestup_…`)
- `expo-file-system` `~57.0.7` - Local Markdown vault storage and GGUF model download; imports use the `expo-file-system/legacy` API
- `expo-notifications` `~57.0.22` - 5 Android notification channels (behavior cues, daily tasks, birthdays, billing, system)
- `expo-camera` `~57.0.6` - QR scanning for LAN sync pairing (`src/components/QRScannerModal.js`)
- `crypto-js` `^4.2.0` - SHA-256 integrity verification of the downloaded GGUF model (`src/utils/aiService.js`)
- `react-native-reanimated` `4.5.1` + `react-native-worklets` `0.10.1` - Animations (plugin auto-configured by babel-preset-expo)

**Infrastructure:**
- `@react-native-community/datetimepicker` `9.1.0` - Date/time selection
- `react-native-gesture-handler` `~2.32.0`, `react-native-screens` `~4.26.0`, `react-native-safe-area-context` `~5.7.0`
- `expo-document-picker` `~57.0.3`, `expo-sharing` `~57.0.22`, `expo-clipboard` `~57.0.2` - Export/import and sharing flows
- `expo-haptics` `~57.0.3`, `expo-linear-gradient` `~57.0.2`, `expo-font` `~57.0.4`, `expo-splash-screen` `~57.0.9`, `expo-status-bar` `~57.0.1`
- `@expo-google-fonts/hanken-grotesk` `^0.4.3`, `@expo-google-fonts/inter` `^0.4.2`, `@expo-google-fonts/jetbrains-mono` `^0.4.1` - Typography
- `@expo/vector-icons` `^15.0.2` - Icon set
- `react-native-modal` `^13.0.1`, `react-native-confetti-cannon` `^1.5.2`
- `use-latest-callback` `^0.2.4` - Stable callbacks for navigation
- `expo-build-properties` `~57.0.22` - iOS `useFrameworks: "static"` config

## Configuration

**Environment:**
- No `.env*` files detected at repo root (`.gitignore` only ignores `.env*.local`); no environment variables are required for core operation
- App config in `app.json` (name `KwestUp`, slug `kwestupmobile`, Android package `com.omprakashp06.kwestupmobile`, `versionCode` 7)
- EAS project ID `9b029b06-5b07-4a1d-9999-a543a3ef1614`; owner `omprakash-p06`
- Telemetry is opt-in via AsyncStorage key `kwestup_telemetry_optin`

**Build:**
- `babel.config.js` - `babel-preset-expo`; cache keyed on `NODE_ENV`; Stryker instrumenter isolation path
- `metro.config.js` - Default Expo Metro config
- `jest.config.js` - `jest-expo/android` preset, coverage ratchet (statements 47 / branches 38 / functions 35 / lines 50)
- `tsconfig.json` - Extends `expo/tsconfig.base`, `strict: true`, `allowJs: true`, `checkJs: false`, `types: ["jest","node"]`
- `stryker.config.json` - Jest runner, 4 concurrency, 15s timeout
- `android/build.gradle` - Injects 16 KB page-size linker flags (`-Wl,-z,max-page-size=16384`) into native modules
- `android/gradle.properties` - `newArchEnabled=true`, `hermesEnabled=true`, `expo.useLegacyPackaging=true`, `expo.edgeToEdgeEnabled=true`
- `eas.json` - Production build uses `NODE_OPTIONS=--max-old-space-size=4096`
- `patch-llama-gradle.js` - Postinstall patch adds widget sizing fallbacks to `react-native-android-widget`

**Native plugins (`app.json`):**
- `expo-splash-screen`, `llama.rn`, `expo-camera` (camera permission), `expo-build-properties`, `react-native-android-widget` (5 widget definitions)

## Platform Requirements

**Development:**
- Node.js `>=22.13.0`, npm `>=10`
- Android SDK Platform 35 (Android 15), JDK 17 (`JAVA_HOME`), Android NDK `27.1.12297006`, CMake `3.22.1`
- No iOS project directory present (`ios/` absent) — Android-first project; iOS config limited to `app.json`
- Custom native modules require `npx expo run:android` / Expo Dev Client, not Expo Go

**Production:**
- Android APK via Gradle (`android/app/build/outputs/apk/release/`) or EAS Build (`eas build --profile production --platform android`)
- Android 16 16 KB page-size compliance configured
- Version `3.5.0` (`app.json` / `package.json`)

## CI / Quality Gates

- `.github/workflows/ci.yml` - Node 22, `npm ci`, ESLint (blocking), TypeScript check, Jest with coverage (`--ci --maxWorkers=2`), artifact upload
- `.github/workflows/semgrep.yml` - Semgrep CE `1.180.0` container, report-only scan (`|| true`), SARIF artifact
- Branches gated: `main`, `development`

---

*Stack analysis: 2026-10-18*
