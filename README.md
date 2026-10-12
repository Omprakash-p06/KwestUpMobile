# KwestUp Mobile

[![React Native](https://img.shields.io/badge/React_Native-0.86-61dafb?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-57-000000?logo=expo&logoColor=white)](https://expo.dev/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2F6.0-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Local AI](https://img.shields.io/badge/Local_AI-llama.rn_%2F_Qwen2.5-red?logo=artificial-intelligence)](https://github.com/mybigday/llama.rn)
[![Tests](https://img.shields.io/badge/Tests-496%20passed-brightgreen?logo=jest)](https://jestjs.io/)
[![Downloads](https://img.shields.io/github/downloads/Omprakash-p06/KwestUpMobile/total.svg?label=Total%20Downloads&color=blue)](https://github.com/Omprakash-p06/KwestUpMobile/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

KwestUp Mobile is an offline-first, local-first personal productivity powerhouse and behavioral engineering workspace. Designed for privacy, speed, and seamless workflow automation, KwestUp combines raw Markdown vaults, a full **Atomic Habits behavioral engine**, Google Tasks-style management, interactive Android home-screen widgets, an on-device local LLM assistant, and direct local Wi‑Fi synchronization with a desktop companion app.

### Core Differentiators
- **Local Markdown Vaults:** Fully local document storage (`.md` files) with an in-memory metadata cache for instant search, hashtag indexing, and navigation.
- **KwestUp 4.0 Atomic Habits Subsystem:** Deterministic behavioral engine implementing the 4 Laws of Behavior Change, identity evidence voting, 2-minute gateway actions, cue stacking, and Never-Miss-Twice recovery workflows.
- **Offline Native LLM & Sandboxed Command Gateway:** Private on-device inference via `llama.rn` (Qwen2.5-0.5B-Instruct GGUF) driving intent parsing and behavioral planning through a schema-validated, idempotent command sandbox.
- **5 Native Android App Widgets:** Real-time home-screen widgets including an interactive task list and an adaptive habit touchpoint widget powered by `react-native-android-widget`.
- **Local Wi‑Fi Synchronization:** Direct 2-way LAN synchronization over HTTP with the companion KwestUp desktop app—no accounts, no cloud relays, zero third-party intermediaries.

---

## 🌟 Key Features

### ⚡ KwestUp 4.0 Atomic Habits & Behavioral Engine
- **4-Law Habit Framework:** Implements Atomic Habits principles directly in pure, testable domain engines:
  - *Make it Obvious:* Context-based and anchor-triggered cue stacking (`cueEngine.ts`).
  - *Make it Attractive:* Intrinsic motivation framing and positive identity associations.
  - *Make it Easy:* Automated 2-minute rule gateway actions (`MINIMUM_ACTION_001`) to eliminate initial starting friction.
  - *Make it Satisfying:* Immediate factual feedback and positive reinforcement (`rewardEngine.ts`).
- **Identity Evidence Voting:** Every habit completion casts an immutable evidence vote toward your chosen identity ("I am a runner", "I am a focused writer").
- **Never-Miss-Twice Recovery:** Automated midnight-rollover miss detection. Missing once is a slip; missing twice is prevented through prioritized recovery touchpoints (`recoveryEngine.ts`).
- **Keystone Habit Cap:** Enforces a strict maximum of 3 concurrent active keystone habits to eliminate cognitive overload and maintain high adherence.
- **Weekly Behavioral Reflection:** Built-in reflection modal (`WeeklyReviewModal.js`) that analyzes weekly slip patterns, friction points, and identity vote tallies to suggest micro-adjustments.

### 📝 Vault-Style Markdown Notes
- **Local Filesystem Vaults:** Organizes raw Markdown `.md` documents inside structured directories under `Notes/Vaults/<vaultId>/`.
- **Collapsible Explorer Sidebar:** Intuitive folder and tag hierarchy for managing multiple notebooks.
- **Dual Markdown Engine:** Instant toggle between a focused raw-text editor and a rich styled markdown rendering preview.
- **Safe Auto-Save:** Debounced background persistence preventing data loss during edits.

### 📋 Google Tasks-Style Management
- **Categorized Task Lists:** Swipe smoothly between custom task categories and lists.
- **Nested Checklist Subtasks:** Break complex tasks into subtasks with real-time completion tracking.
- **Due Dates & Recurrence:** Flexible recurrence rules and system alerts to keep deadlines on track.

### 🤖 On-Device Local AI & Sandboxed Command Gateway
- **100% Offline Inference:** Native C++ inference via `llama.rn` bindings running `Qwen2.5-0.5B-Instruct-Q4_K_M.gguf` (~468 MB) downloaded with chunked SHA-256 verification.
- **Deterministic AI Pipeline:** Heuristic and LLM intent parsing (`intentParser.ts`) paired with rule-packet retrieval (`rulePacketRetriever.ts`) and behavioral compilation (`behaviorCompiler.ts`).
- **Sandboxed Command Gateway:** All mutations execute through a schema-validated gateway (`src/commands/`) with actor tagging (`user`, `ai`, `widget`, `engine`), LRU memory deduplication, and durable idempotency caching. The LLM cannot perform unvalidated or destructive modifications.

### 🧩 5 Native Android App Widgets
KwestUp Mobile includes 5 native Android home-screen widgets built with `react-native-android-widget` and coordinated via a headless background task handler:
1. **Focus Timer Widget (2x2):** Real-time focus countdown synchronized with the active timer session.
2. **Daily Tasks Widget (2x2):** Displays today's task statistics (total logged vs. completed).
3. **Important Tasks Widget (2x2):** Displays the top 5 high-priority upcoming tasks.
4. **Interactive Tasks List Widget (4x3):** Interactive scrollable task list allowing users to check off tasks directly from the home screen without launching the app.
5. **Habit Touchpoint Widget (2x2):** Dynamic priority touchpoint displaying your next keystone habit action with priority arbitration (Recovery > Today Due > Next Action > Standby) and one-tap completion.

### 🔄 Local Wi-Fi Synchronization
- **Camera QR Scanner:** Scan your PC screen to capture connection metadata (LAN IP, port, ephemeral Bearer token) via `expo-camera`.
- **2-Way Merge Engine:** Fast localized merge algorithm over plain HTTP with the companion KwestUp desktop app.
- **Zero Cloud Footprint:** No cloud databases, no external servers—sync remains strictly on your local subnet.

### 🎂 Upcoming Birthdays Dashboard
- **Countdown Indicators:** Shows upcoming birthdays, days remaining, and calculated ages.
- **Morning Local Notifications:** Automatically schedules system alerts on birthday mornings.

### 📱 Android Split-Screen & Multi-Window Optimization
- **Dynamic Viewport Sizing:** Navigation drawers and swipe boundaries dynamically adapt using React Native's `useWindowDimensions()` hook.
- **Adaptive Layouts:** Screens utilize dynamic flex wraps and `onLayout` bounds calculations to gracefully adapt when device width is halved in split-screen mode, foldables, or tablets.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies & Libraries |
|-------|--------------------------|
| **Core Framework** | React Native `0.86.3` (New Architecture `newArchEnabled=true`), Expo SDK 57 (`~57.0.0`), React `19.2.3` |
| **Languages** | TypeScript `~5.8.3` / `~6.0.3` (behavior, AI, commands, widgets) + JavaScript ES2021 (screens, components, context) |
| **Navigation** | React Navigation v7 (`@react-navigation/native` `^7.5.0`, `@react-navigation/drawer` `^7.14.3`) |
| **Gestures & Animations** | `react-native-reanimated` `4.5.1`, `react-native-worklets` `0.10.1`, `react-native-gesture-handler` `~2.32.0` |
| **Domain Event Bus** | Singleton typed+wildcard pub/sub (`src/behavior/eventBus.ts`) with deep-frozen immutable events and a 100-event ring buffer |
| **Local AI Engine** | `llama.rn` `0.12.4` running quantized `Qwen2.5-0.5B-Instruct-Q4_K_M.gguf` (~468 MB, CPU-only, 5-min idle context unload) |
| **State & Persistence** | Domain-isolated React Contexts + `@react-native-async-storage/async-storage` `2.2.0` (`v7.0` storage schema with `mergeTasksByUpdatedAt` reconciliation) + `expo-file-system/legacy` |
| **Android Widgets** | `react-native-android-widget` `^0.16.1` with headless task handler in `widgets/widget-task-handler.tsx` (5 widgets with priority arbitration) |
| **OS Notifications** | `expo-notifications` `~57.0.22` with 5 Android notification channels (`src/services/notificationService.ts`) |
| **UI Design System** | `react-native-paper` `^5.10.5` with curated palettes (Clean, Blue, Green, Purple, Dribbble) and AMOLED dark mode |
| **Testing Harness** | Jest `29.7.0` with `jest-expo/android` preset (**34 test suites, 496 tests passing**), `fast-check` property tests, Stryker mutation testing |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** `>= 22.13.0` (Node 22 LTS recommended)
- **npm:** `v10.0.0` or higher
- **Android Native Environment:**
  - Android SDK Platform 35 (Android 15)
  - JDK 17 (set via `JAVA_HOME`)
  - Android NDK `27.1.12297006` (required for `llama.rn` C++ compilation)
  - CMake `3.22.1`
  - Android 15 16 KB page-size linker support (`-Wl,-z,max-page-size=16384`)

### 2. Clone and Install
```bash
git clone https://github.com/Omprakash-p06/KwestUpMobile.git
cd KwestUpMobile
npm ci
```

### 3. Run Development Server
Because KwestUp Mobile uses custom native modules (`llama.rn`, `react-native-android-widget`, `expo-camera`), standard Expo Go does not include these compiled binaries. Use a development build:

```bash
# Start Metro bundler with Expo Dev Client
npm start

# Or compile and launch directly on connected Android device/emulator:
npm run android
# (or: npx expo run:android)
```

---

## 🧪 Testing & Quality Gates

KwestUp enforces strict quality gates across TypeScript compilation, code style, property invariants, and test coverage before changes are merged or deployed:

```bash
# 1. Typecheck the TypeScript subsystem (strict mode, 0 errors)
npm run typecheck

# 2. Lint JavaScript and React Native code (0 errors)
npm run lint

# 3. Execute the Jest unit and integration test suite (34 suites, 496 tests passing)
npm test

# 4. Run property-based testing (fast-check invariant fuzzing across 100+ iterations)
npm run test:property

# 5. Run mutation testing on critical domain mutations (Stryker, >87% mutation score)
npm run test:mutation:critical

# 6. Run tests with coverage reporting
npm run test:coverage
```

Continuous integration runs automatically on every pull request and push to the repository via GitHub Actions (`.github/workflows/ci.yml`).

---

## 🐳 Docker Developer Setup

For testing localized Wi-Fi synchronization services during development, a companion mock sync server is provided:

```bash
docker-compose up -d
```
This boots a containerized local mock server to validate network synchronization, payload verification, and merge behavior.

---

## 🏗️ Building and Compiling the App

KwestUp Mobile uses the Expo prebuild workflow with native Android configurations.

### Compiling the Production Release APK Locally
To build a signed standalone production APK on your development machine:

1. Ensure the Android SDK, JDK 17, and Gradle environments are configured.
2. Run the Gradle build:
   ```bash
   cd android
   ./gradlew clean assembleRelease
   ```
3. Once completed, the production release APK is generated at:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

### Building with EAS
EAS Build configurations are defined in `eas.json`:
```bash
# Build internal development APK
eas build --profile development --platform android

# Build production APK
eas build --profile production --platform android
```

---

## 🔒 Telemetry & Privacy Policy

KwestUp Mobile includes a fully opt-in, anonymous telemetry mechanism to assist with application stability:
* **Explicit Consent:** Telemetry is disabled by default and requires explicit user opt-in during onboarding or in Settings.
* **Strict Anonymity:** Absolutely no personal data, note contents, task items, habits, or financial ledgers are ever collected or transmitted. Only the app version and OS platform are logged.
* **Full Control:** Telemetry can be toggled on or off at any time under Settings.

---

## 👥 Authors & License

- **Developer:** Omprakash Panda
- **Repository:** [https://github.com/Omprakash-p06/KwestUpMobile](https://github.com/Omprakash-p06/KwestUpMobile)
- **License:** MIT License