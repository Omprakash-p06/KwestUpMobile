# Integrations

**Analysis Date:** 2026-09-28

## Internal Modules / Cross-cutting integrations

**Unified task mutation layer (Phase 17 ARCH-02):**
- `src/utils/taskMutations.js` — framework-agnostic pure functions (`toggleTask`, `completeTask`, `saveTask`, `deleteTask`, `toggleSubtask`, `createTaskList`, `renameTaskList`, `deleteTaskList`, `calculateNextRecurrence`) with injectable `{ now, todayDate }` for determinism.
- Consumers: `src/context/TaskContext.js` (in-app handlers + notification side-effects) and `widgets/widget-task-handler.tsx` (`TOGGLE_TASK` / `COMPLETE_TASK` click actions read `kwestup_data_${STORAGE_VERSION}`, call `toggleTask()`, write back, then `requestWidgetUpdate` on `ImportantTasks` / `DailyTasks` / `TasksList`).
- Foreground re-sync: `TaskContext.refreshTasksFromStorage()` re-reads AsyncStorage on `AppState === 'active'` so headless widget writes converge with in-memory state (structural JSON comparison guard).

**Date engine (Phase 15 DATE-01/DATE-02):**
- `src/utils/dateUtils.js` — sole authority for calendar dates (`getLocalDateString`, `parseLocalDate`, `getYesterdayLocalDateString`, `getTomorrowLocalDateString`, `getLocalMonthString`, `getLocalMonthDayString`, `isSameLocalDay`); device-local timezone only, never UTC-sliced.
- Consumers: `src/utils/taskMutations.js` (`todayDate` default), `widgets/widget-task-handler.tsx`, `src/utils/aiService.js` (birthday and task due-date parsing), screens/billing code.

**On-Device AI Pipeline (Phase 18 AI-01/AI-02):**
- `src/utils/aiService.js` — local LLM inference engine using `llama.rn`:
  - Upstream release pinned to Hugging Face commit `9217f5db79a29953eb74d5343926648285ec7e67`, size `491400032` bytes, SHA-256 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`.
  - Integrity validation via `verifyModelIntegrity` before loading, with automatic purging of corrupted or truncated downloads (`FileSystem.deleteAsync`).
  - Mutex lock via coalescing Promise (`_initPromise`) to prevent concurrent initialization race conditions.
  - Active memory lifecycle: `handleAppStateChange` auto-unloads context on `background`/`inactive`; 5-minute idle timeout with timer unref support; component unmount cleanup in `src/components/AIAssistant.js`.
  - Deterministic offline fallbacks: `extractTasksFromNoteHeuristic`, `summarizeNoteHeuristic`, and keyword-based regex command parser guaranteeing zero-failure UX.

**Domain contexts (Phase 17 ARCH-01):**
- `src/context/TaskContext.js` — tasks / task lists / daily tasks + notification scheduling (`scheduleDueDateNotification`, `cancelDueDateNotification`, `schedulePushNotification` from `src/utils/notifications.js`) + haptics (`expo-haptics`).
- `src/context/VaultContext.js` — vault registry + filesystem notes via `src/utils/vaultService.js` + `src/utils/fileStorage.js` (`getAllNotesFromFilesystem`).
- `src/context/BirthdayContext.js`, `src/context/BillingContext.js` — remaining domains, backed by `src/utils/billingStorage.js` + `src/utils/billingNotifications.js`.

**Notifications mesh:**
- `src/utils/notifications.js` (`expo-notifications`): daily-task repeats, immediate push, due-date triggers, birthday two-year fan-out with advance reminders — all scheduled locally, no push provider.
- `src/utils/billingNotifications.js`: recurring-bill reminders, cancelled + rescheduled on `.kwestup` import (`src/utils/exportService.js` `importArchive()`).

**Backup pipeline:**
- `src/utils/exportService.js` ties `src/utils/storage.js` (`isUserDataKey`), `src/utils/vaultService.js` (`getVaults`, `getVaultPath`, `ensureVaultsDir`), `src/utils/billingStorage.js`, `expo-file-system`, `expo-sharing`, `expo-document-picker` (import side) into encrypted `.kwestup` export/import.

## External Services

**None — local-first by design.** Verified: no `firebase`, `supabase`, `amplify`, `axios`, cloud-analytics, crash-reporter, or payment SDK in `package.json` or `src/` imports (only local `analyticsBar` style names in `src/screens/BillingScreen.js`). Stated constraint in `.planning/PROJECT.md`: remote cloud accounts, centralized cloud DBs, and web deployment are out of scope.

**Single outbound network fetch in the entire app:**
- Hugging Face release endpoint — `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf` in `src/utils/aiService.js` (`MODEL_DOWNLOAD_URL`). One-time ~468.64 MB GGUF download via resumable `FileSystem.createDownloadResumable` with 10-retry exponential backoff; resume state in `kwestup_ai_model_download_resumable`; integrity verified by byte-size and SHA-256 checksum gate in `verifyModelIntegrity()`. Everything else (load, summarize, extract, parse, assist) runs fully offline through `llama.rn`.
- LAN peer only (next section) — `fetch()` to user-supplied `http://<ip>:<port>` sync peer; no fixed remote host.

## LAN / Device-to-device

**Protocol (`src/utils/syncService.js`):** plain-HTTP JSON REST against the KwestUp PC companion over local Wi-Fi. `usesCleartextTraffic="true"` in `android/app/src/main/AndroidManifest.xml` exists to permit this LAN HTTP traffic.
- `GET /ping` → `{ status: "online" }` health check, 3 s timeout (`pingSyncServer()`).
- `POST /sync` with `Authorization: Bearer <token>`, 10 s timeout (`performSync()`); client sends `{ notes, tasks, taskLists, birthdays, themeMode, selectedThemeName, userName }`, expects merged `{ notes, tasks, taskLists, birthdays }` back.
- Pairing UX: `src/components/QRScannerModal.js` (`expo-camera`) scans the PC server's QR (IP/port/token).

**Validation rules (SEC-02 hardening, all in `src/utils/syncService.js`):**
- `validateSyncConfig()`: strict IPv4 octet check for dotted-numeric input (rejects `999.999.999.999`), hostname (`hostnameRegex`) / IPv6 alternatives, no path injection; port coerced to integer and bounded 1–65535; token trimmed, minimum 6 chars — throws descriptive `Error` otherwise.
- `validateSyncPayload()`: response must be a JSON object with `notes`, `tasks`, `birthdays` arrays (missing array = throw, prevents note wipes); `taskLists` defaults to `[]`.
- Transport errors: 401/403 → "token invalid/expired, re-scan"; `AbortError` → timeout guidance; `fetchWithTimeout()` via `AbortController` throughout.

## Build & Platform integrations

**Expo / EAS:**
- Expo SDK 53 managed + prebuild; config plugins in `app.json`: `llama.rn`, `expo-camera` (QR permission string), `expo-build-properties` (iOS `useFrameworks: static`), `react-native-android-widget` (4 widget registrations: `FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList`, 30-min `updatePeriodMillis`, preview images under `assets/widget-preview/`).
- EAS (`eas.json`, `app.json` `extra.eas.projectId 9b029b06-…`, owner `omprakash-p06`): `development` (dev-client internal APK), `preview` (internal), `production` (APK, 4 GB Node heap). App `version 3.5.0`, Android `package com.omprakashp06.kwestupmobile`, `versionCode 7`, portrait-only.

**Android native (`android/`, `AndroidManifest.xml`):**
- Permissions: `CAMERA` (QR scan), `INTERNET`, `RECORD_AUDIO` (llama voice-adjacent), `VIBRATE`, `RECEIVE_BOOT_COMPLETED` (widget re-render after reboot), `SYSTEM_ALERT_WINDOW`; scoped storage permissions (`READ_EXTERNAL_STORAGE` maxSdk 32, `WRITE_EXTERNAL_STORAGE` maxSdk 29).
- 4 widget `receiver`s (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList`) handling `APPWIDGET_UPDATE` + package `WIDGET_CLICK` + `BOOT_COMPLETED`; `RNWidgetCollectionService` for collection widgets; `largeHeap="true"` (LLM), deep-link scheme `exp+kwestupmobile`, Expo updates disabled (`ENABLED=false`).
- Entry wiring (`index.js`): `registerRootComponent(App)` + `registerWidgetTaskHandler(widgetTaskHandler)`; `android:name=".MainApplication"`, portrait `MainActivity`.

**OS services used on-device:**
- Local notifications (`expo-notifications`), haptics (`expo-haptics`), share sheet (`expo-sharing`), document picker (`expo-document-picker`), datetime picker (`@react-native-community/datetimepicker`), file/AsyncStorage as above — no cloud push, no analytics, no crash-reporting backend.

## Environment & Config

**Required env vars:** none. No `.env` consumption detected; no remote API keys, no secrets files. All configuration is code + `app.json`/`eas.json`.

**Config surface:**
- `app.json` — identity, icons/splash (`assets/`), plugins, widget registry, EAS project binding.
- `eas.json` — build profiles and submission stub.
- `package.json` — scripts (`start`, `android`, `ios`, `web`, `lint`, `test*`, `postinstall: node patch-llama-gradle.js`); the postinstall patch keeps the `llama.rn` Gradle build working.
- `babel.config.js` (`babel-preset-expo` + Reanimated plugin), `metro.config.js` (default `expo/metro-config`), `tsconfig.json` (extends `expo/tsconfig.base`), `eslint.config.js` (flat config), `jest.config.js` (Expo Android preset + native mocks).
- Version keys: `APP_VERSION v3.5.0` / `STORAGE_VERSION v7.0` in `src/utils/storage.js`; telemetry consent (`kwestup_telemetry_*`) and AI download state (`kwestup_ai_model_*`) are allowlisted through cache wipes.

---

*Integration audit: 2026-09-28*
