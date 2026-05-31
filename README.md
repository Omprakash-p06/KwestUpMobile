# KwestUp Mobile

[![React Native](https://img.shields.io/badge/React_Native-0.79-61dafb?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-53-000000?logo=expo&logoColor=white)](https://expo.dev/)
[![Local AI](https://img.shields.io/badge/Local_AI-llama.cpp-red?logo=artificial-intelligence)](https://github.com/ggerganov/llama.cpp)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**KwestUp Mobile** is a premium, privacy-respecting, and completely offline-first personal workspace application designed to bring the capabilities of **Obsidian** and **Notion** directly to your mobile device. With rich Markdown notes, Google Tasks-style task lists, and birthday reminders, KwestUp Mobile processes all your data locally on your device—keeping your personal life private.

A key highlight is the built-in **On-Device Local AI**, which compiles native C++ `llama.cpp` bindings via `react-native-llama` to run a quantized Qwen3-0.6B-GGUF model entirely offline. It provides Note Summarization and Task Extraction without transmitting a single byte of your data to the cloud. Furthermore, KwestUp Mobile synchronizes locally over Wi-Fi with the **KwestUp PC** desktop app via a simple camera scan of a PC-generated QR code.

---

## 🌟 Key Features

### 📝 Notion & Obsidian-Style Notes
- **Local Filesystem Vault**: Organizes raw Markdown `.md` documents inside structured directories.
- **Collapsible Explorer Sidebar**: Intuitive navigation for managing multiple notebooks and tags.
- **Dual Markdown Engine**: Seamless toggle between a rich raw-text editor and a beautiful styled markdown rendering engine.
- **Notion-Style Auto-Save**: Debounced background writing to prevent data loss.

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
git clone https://github.com/Omprakash-p06/KwestUpMobile.git
cd KwestUpMobile
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

## 🧩 Widget Status & Future Blueprint

### Current Implementation Status
> [!IMPORTANT]
> **Widgets are currently NOT implemented in the KwestUp Mobile codebase.**
> 
> As of Phase 6, the core mobile database, local LLM integration, and local sync algorithms are fully functional. Android App Widgets are planned for the next feature release milestone.

### Widget Engineering Blueprint
To integrate Android App Widgets in the next milestone, developers should follow this blueprint:

```
                  ┌──────────────────────────────┐
                  │   KwestUp SQLite / MMKV      │
                  │   (Shared Local Storage)     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │    React Native App logic    │
                  └──────────────┬───────────────┘
                                 │ Writes updates
                                 ▼
                  ┌──────────────────────────────┐
                  │ Android SharedPreferences /  │
                  │ SQLite Database              │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                ┌─────────────────────────────────┐
                │ react-native-android-widget     │
                │ (Custom AppWidgetProvider)      │
                ├─────────────────────────────────┤
                │ • Layout defined in XML/React   │
                │ • Reads tasks & focus timer     │
                │ • Standard broadcast updates    │
                └─────────────────────────────────┘
```

#### Android Implementation Steps
1. **Dependencies**: Use the highly efficient `react-native-android-widget` library to build widgets using React-style layouts, or build custom Kotlin providers in `android/app/src/main/java`.
2. **Provider**: Create `KwestUpWidgetProvider.kt` extending `AppWidgetProvider`.
3. **Layout**: Define widget layouts using Android's remote views (`widget_layout.xml` in resources) containing:
   - Quick-add note button (Deep link launcher: `kwestup://notes/new`).
   - Active task lists with checkboxes.
   - Focus Timer progress circle.
4. **Data Sync**: Store active tasks in Android's `SharedPreferences` during React Native saves, and fetch them in `AppWidgetProvider`'s `onUpdate()`.


---

## 👥 Authors & License

- **Developer**: Omprakash Panda
- **Repository**: [https://github.com/Omprakash-p06/KwestUpMobile](https://github.com/Omprakash-p06/KwestUpMobile)
- **License**: MIT License