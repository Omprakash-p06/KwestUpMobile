# KwestUp Mobile

[![React Native](https://img.shields.io/badge/React_Native-0.79-61dafb?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-53-000000?logo=expo&logoColor=white)](https://expo.dev/)
[![Local AI](https://img.shields.io/badge/Local_AI-llama.cpp-red?logo=artificial-intelligence)](https://github.com/ggerganov/llama.cpp)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

KwestUp Mobile is a local-first personal workspace and productivity app focused on privacy, portability, and fast offline workflows. It provides Markdown-based note files, structured vaults, Google Tasks-style task lists, and local Wi‑Fi sync with a companion desktop app.

Core differentiators:
- Fully local note storage (raw `.md` files) with a fast in-memory metadata cache for search and navigation.
- Offline-first on-device AI tooling via local `llama.cpp` bindings for note summarization and task extraction.
- Local Wi‑Fi synchronization with the KwestUp PC desktop companion (no cloud intermediaries).

---

## 🌟 Key Features

### 📝 collaborative notes platform & vault-Style Notes
- **Local Filesystem Vault**: Organizes raw Markdown `.md` documents inside structured directories.
- **Collapsible Explorer Sidebar**: Intuitive navigation for managing multiple notebooks and tags.
- **Dual Markdown Engine**: Seamless toggle between a rich raw-text editor and a beautiful styled markdown rendering engine.
- **collaborative notes platform-Style Auto-Save**: Debounced background writing to prevent data loss.

### 📋 Google Tasks-Style Management
- **Custom Categorized Lists**: Swiftly swipe between multiple task categories and lists.
- **CHECKLIST Subtasks**: Break down complex tasks into nested items with dynamic progress tracking.
- **Due Dates & Native Alerts**: Integrated system reminders to keep you on schedule.

### 🎂 Upcoming Birthdays Dashboard
- **Countdown Indicators**: Shows remaining days and precise calculated ages.
- **Morning Local Notifications**: Fires system notifications on scheduled birthday mornings.

### 🔄 Local Wi-Fi Synchronization
- **Camera QR Scanner**: Scans your PC screen to capture connection metadata (Local IP, Port, Security token).
- **2-Way Merge Sync**: Executes a localized high-performance merge algorithm over HTTP/WS with the companion KwestUp PC app.
- **Zero Cloud Intermediaries**: Keeps desktop/mobile syncing secure and strictly local.

### 🤖 Offline Native Local LLM
- **On-Device Inference**: Utilizes `react-native-llama` native C++ bindings for absolute offline privacy.
- **Qwen3-0.6B-GGUF Support**: Runs a high-performance quantized compact language model.
- **Smart Automation**: Auto-extracts actionable checklists from raw notes directly into your task lists, and compiles markdown notes into concise summaries.

---

## 🛠️ Architecture & Tech Stack

- **Core Framework**: React Native (Expo v53 SDK managed workflow)
- **State & Local Persistence**: AsyncStorage & Expo Filesystem for raw Markdown notes vault
- **UI Design System**: React Native Paper with beautiful custom themes (Dribbble/Material hybrid)
- **Local AI Engine**: Native C++ `llama.cpp` via `react-native-llama`
- **Wi-Fi Merging System**: Custom REST sync service supporting atomic sync cycles and haptic-feedback handshakes

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Expo Go App**: Installed on your physical Android device for testing, or an Android Emulator setup.

### 2. Clone and Install
```bash
git clone https://github.com/Omprakash-p06/KwestUp.git
cd KwestUp
npm install
```

### 3. Diagnose Environment
Verify all native tooling and dev requirements are fully set up by running:
```bash
# On Windows
check.bat
```

### 4. Run Development Servers
Start the Expo bundler:
```bash
npm start
```
- Press `a` to launch on a connected Android device or emulator.
- Scan the terminal's QR code using the **Expo Go** app to test on physical devices.


---

## 🐳 Docker Developer Setup

For testing localized Wi-Fi synchronization services during development, a containerized environment is provided.

Ensure Docker is installed and running, then spin up the local development sync infrastructure:
```bash
docker-compose up -d
```
This runs the local companion mock servers to test network synchronization and merge behaviors instantly.

---

## 📱 Android Split-Screen & Multi-Window Optimizations

KwestUp Mobile has been optimized to handle Android's split-screen (multi-window) configurations flawlessly, ensuring a premium user experience on all screen bounds, tablets, and foldables.

### Layout Optimization Details:
- **Dynamic Viewport Sizing**: Instead of reading screen dimensions statically on app mount (which breaks when entering split-screen or resizing), navigation bars and swiping boundaries use the modern React Native `useWindowDimensions()` hook. This dynamically recalculates drawer widths and swipe boundaries in real-time.
- **Flexible Grid Flow**: Screen layouts employ dynamic flexbox constraints and `flexWrap` to adapt grid cards and dashboards nicely when available horizontal width is cut in half.
- **On-Layout Bounds Updates**: The Tasks board uses the `onLayout` hook on view boundaries to determine exact layout boundaries dynamically rather than relying on absolute device widths, preventing paging alignment issues when resized.

---

## 🧩 Native Android App Widgets

KwestUp Mobile includes full native Android App Widgets for productivity at a glance, directly from the device's home screen.

### Implemented Widgets:
1. **Focus Timer Widget (2x2)**: Real-time focus countdown tracking sync'd with the active session.
2. **Daily Tasks Widget (2x2)**: Displays today's task statistics (total logged vs completed).
3. **Important Tasks Widget (2x2)**: Displays the top 5 high-priority tasks currently in the queue.
4. **Interactive Tasks List Widget (4x3)**: A large, interactive list displaying the user's upcoming tasks. Allows users to mark off tasks directly from the widget on their home screen without opening the app.

These widgets are powered by `react-native-android-widget` and use throttled and staggered background updates to protect system resources and avoid background Binder flooding.

---

## 🏗️ Building and Compiling the App

KwestUp Mobile is built using Expo (managed workflow with custom native directories). Follow these steps to build the development build or compile a production-ready APK locally.

### Local Development Build
To run a local development build on a physical device or emulator:
```bash
# Start the Metro bundler
npm run start

# Press 'a' to build and run on a connected Android device/emulator
```

### Compiling the Production APK (Local Release)
To compile the final signed production release package on a local machine:

1. Ensure the Android SDK, JDK 17, and Gradle environments are fully configured.
2. Navigate to the `android/` directory and run the Gradle build:
   ```bash
   cd android
   ./gradlew clean assembleRelease
   ```
3. Once completed successfully, the production-ready APK package will be available at:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

---

## 👥 Authors & License

- **Developer**: Omprakash Panda
- **Repository**: [https://github.com/Omprakash-p06/KwestUp](https://github.com/Omprakash-p06/KwestUp)
- **License**: MIT License