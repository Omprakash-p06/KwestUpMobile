# Integrations

**Analysis Date:** 2026-09-27

## Internal Modules / Cross-cutting integrations

- **Versioned storage core** — `src/utils/storage.js` (`STORAGE_VERSION = "v7.0"`, `APP_VERSION = "v3.5.0"`, `isUserDataKey`, `migrateUserDataIfNeeded`, `clearAllCaches`) is imported by `src/utils/exportService.js`, `src/utils/vaultService.js`, `src/utils/billingStorage.js`, and `widgets/widget-task-handler.tsx`. Every persistence integration keys off `kwestup_*_${STORAGE_VERSION}`.
- **Vault filesystem trio** — `src/utils/vaultService.js` (registry + `getVaultPath` → `${documentDirectory}Notes/Vaults/<id>/`) ↔ `src/utils/fileStorage.js` (note CRUD, hashtag scan) ↔ `src/utils/vaultImport.js` (`expo-document-picker` multi-select → `createVault` → copy). Consumed by `src/screens/NotesScreen.js`, `src/screens/SearchScreen.js`, and `src/utils/exportService.js:packVaults`.
- **Backup pipeline** — `src/utils/exportService.js` (`encryptBackup`/`decryptBackup` via `crypto-js`, `exportArchive`/`importArchive`) orchestrates `collectAsyncStorageData` + `packVaults` + `loadBillingData`/`saveBillingData` + `expo-file-system` cache file + `expo-sharing`. UI entry: `src/screens/SettingsScreen.js` (export with passphrase + progress, `DocumentPicker.getDocumentAsync` import).
- **Billing + notifications loop** — `src/utils/billingStorage.js` (transactions/budgets/recurringBills under `kwestup_billing_${STORAGE_VERSION}`) ↔ `src/utils/billingNotifications.js` (`scheduleRecurringBillReminder`/`cancelRecurringBillReminders`) ↔ `expo-notifications`; import path reschedules reminders per-device (`src/utils/exportService.js:368-379`). Screens: `src/screens/BillingScreen.js`. Parallel loop: `src/utils/notifications.js` (daily-task, due-date, birthday schedulers) ↔ `src/screens/BirthdaysScreen.js`, `src/screens/DailyTasksScreen.js`, `src/screens/TaskListScreen.js`.
- **AI pipeline** — `src/utils/aiService.js` (`initLlama`/`releaseAllLlama` from `llama.rn`, `expo-file-system` model cache, `AsyncStorage` resumable key `kwestup_ai_model_download_resumable`) exposes `isModelDownloaded`/`downloadModel`/`loadModel`/`unloadModel`/`summarizeNote`/`extractTasksFromNote`/`parseGlobalCommand`/`assistWriting{,Custom}`. Consumed by `src/components/AIAssistant.js` (+ `expo-haptics` feedback). Fallback chain: LLM JSON → regex/keyword parser so commands work even when inference fails.
- **Date engine** — `src/utils/dateUtils.js` (`getLocalDateString`, `getLocalMonthDayString`) shared by `src/utils/aiService.js`, `widgets/widget-task-handler.tsx`, and screens to avoid UTC `toISOString().slice(0,10)` bugs.
- **Widget ↔ app bridge** — `index.js` registers both `registerRootComponent(App)` and `registerWidgetTaskHandler(widgetTaskHandler)`. `widgets/widget-task-handler.tsx` reads/writes the same `kwestup_data_${STORAGE_VERSION}` / `kwestup_timer_state_${STORAGE_VERSION}` keys as `App.js`, renders `FocusTimerWidget`/`DailyTasksWidget`/`ImportantTasksWidget`/`TasksListWidget` via `requestWidgetUpdate`, handles `WIDGET_CLICK` (`TOGGLE_TASK`/`COMPLETE_TASK` with recurrence spawning, `SWITCH_TAB`) and `WIDGET_ADDED/UPDATE/RESIZED` re-render.
- **Navigation shell** — `src/navigation/AppNavigator.js` + `src/navigation/CustomDrawerContent.js` (drawer) wire all screens in `src/screens/` with shared theme (`src/theme/colors.js`, `src/theme/styles.js`) and `Custom*` primitives in `src/components/`.

## External Services (note: local-first — highlight absence of cloud deps if true)

> **Local-first confirmed: no cloud database, auth provider, backend API, crash reporter, or analytics SDK is integrated.** No `firebase`, `supabase`, `aws-amplify`, `auth0`, `sentry`, `amplitude`, `stripe`, or push-notification service appears in `package.json`, `src/`, or `app.json`. All features work offline; network is used only for the four optional endpoints below plus LAN sync.

- **Hugging Face (AI model CDN — download only)** — `MODEL_DOWNLOAD_URL = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"` in `src/utils/aiService.js:16-17`. Fetched via `FileSystem.createDownloadResumable` with 10-retry exponential backoff; 450 MB size gate in `isModelDownloaded()` deletes truncated files. Only network transfer required for first-time setup; inference is fully offline.
- **GitHub Releases (update check — read only)** — `checkForUpdates()` in `src/utils/diagnostics.js:50-94` calls `https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest`, compares `tag_name` against `APP_VERSION`, surfaces `.apk` asset URL. Manual/opt-in from UI; never auto-installs.
- **httpbin (connectivity probe — diagnostic only)** — `runNetworkDiagnostics()` in `src/utils/diagnostics.js:8-30` GETs `https://httpbin.org/json` with no-cache headers. Debug utility only.
- **Placeholder telemetry endpoint (opt-in, default OFF)** — `sendTelemetryEvent()` in `src/utils/diagnostics.js:110-132` POSTs to `https://api.kwestup.com/telemetry` **only if** `AsyncStorage("kwestup_telemetry_optin") === "true"`. No-op otherwise; key is preserved across cache wipes (`src/utils/storage.js:18`).
- **Bundled fonts (build-time, offline at runtime)** — `@expo-google-fonts/hanken-grotesk|inter|jetbrains-mono` loaded via `expo-font`; no runtime Google Fonts network calls.
- **OS-local services only** — `expo-notifications` (all reminders scheduled on-device, no FCM/APNs server), `expo-haptics`, `expo-sharing`/`document-picker` (both stay on-device), `AsyncStorage` + `expo-file-system` (never leave the phone except via user-initiated LAN sync or encrypted export).

## LAN / Device-to-device (sync protocol, validation rules if found)

- **Companion:** KwestUp PC desktop sync server over same-subnet Wi-Fi (`KwestUpPC/` directory, eslint-ignored; `docker-compose` dev env per `.planning/PROJECT.md`). Mobile is HTTP client; no cloud relay.
- **Protocol** (`src/utils/syncService.js`):
  1. `pingSyncServer(config)` — `GET http://<ip>:<port>/ping` (3 s `AbortController` timeout, dummy `ping-token-check`), expects `{ status: "online" }` (`src/utils/syncService.js:105-127`).
  2. `performSync(config, localData)` — verifies ping, then `POST http://<ip>:<port>/sync` with `Authorization: Bearer <token>`, JSON body `{ notes, tasks, taskLists, birthdays, themeMode, selectedThemeName, userName }` (10 s timeout). `401/403` → "re-scan token" error; `AbortError` → timeout error (`src/utils/syncService.js:133-193`).
  3. Response must pass `validateSyncPayload()` or state is never overwritten.
- **Validation rules** (`src/utils/syncService.js:32-100`):
  - `validateSyncConfig({ip, port, token})` — strict IPv4 octet regex (`25[0-5]|2[0-4][0-9]|...`); dotted-numeric that fails strict IPv4 is rejected (no `999.1.1.1` bypass); otherwise hostname RFC regex or IPv6; port must be integer **1–65535**; token must be string with `trim().length >= 6`. Returns normalised `{ ip: trimmedIp, port: numericPort, token: trimmedToken }`.
  - `validateSyncPayload(data)` — must be a non-array object with **`notes`, `tasks`, `birthdays` arrays** (missing → throw, protecting against note wipes); `taskLists` defaults to `[]` when absent.
- **QR bootstrap** — `src/components/QRScannerModal.js` uses `expo-camera` `CameraView` + `useCameraPermissions` to scan the PC server's QR (encodes `ip`/`port`/`token`); haptic feedback via `expo-haptics`. Camera permission string in `app.json:34-39`.
- **Transport note:** plain `http://` LAN (no TLS) with bearer token auth — acceptable on trusted LAN per local-first constraint, but never route over the public internet.
- **Tests:** `__tests__/unit/syncService.test.js` covers config/payload validators and mocked `fetch` handshake.

## Build & Platform integrations (Expo, EAS, Android native)

- **Expo SDK 53** (`app.json`): slug `kwestupmobile`, `owner: omprakash-p06`, `extra.eas.projectId: 9b029b06-5b07-4a1d-9999-a543a3ef1614`, portrait, `userInterfaceStyle: light`, `assetBundlePatterns: ["**/*"]`.
- **Android target:** package `com.omprakashp06.kwestupmobile`, `versionCode: 7`, adaptive icon (`#131313`), `android/` Gradle project (`app/`, `gradle/`, `gradlew`). iOS config is tablet-support flag only — Android is the supported platform.
- **Config plugins** (`app.json:32-104`): `llama.rn` (native LLM), `expo-camera` (QR permission text), `expo-build-properties` (iOS `useFrameworks: static`), `react-native-android-widget` declaring 4 widgets — `FocusTimer`, `DailyTasks`, `ImportantTasks` (3×2 cells, 250dp×100dp) and `TasksList` (4×3, 320dp×180dp), each `updatePeriodMillis: 1800000` with preview images in `assets/widget-preview/`.
- **EAS** (`eas.json`, CLI `>= 3.10.0`): `development` (dev-client, internal APK) / `preview` (internal) / `production` (APK + `NODE_OPTIONS=--max-old-space-size=4096`).
- **Native patch hook:** `patch-llama-gradle.js` (runs on `postinstall`) — unconditionally applies `com.facebook.react` plugin + `react{}` block in `llama.rn` gradle (old-architecture support) and injects orientation-aware `getWidgetWidth/Height` + `getFallbackSize` into `RNWidgetUtil.java`.
- **Dual entry** (`index.js:1-11`): `registerRootComponent(App)` + `registerWidgetTaskHandler(widgetTaskHandler)` so widgets run headless without launching the full app.

## Environment & Config

- **No `.env` / secrets required.** Grep over `src/` shows no `process.env`, `EXPO_PUBLIC_*`, Firebase, or API-key usage. The repo contains no `.env*` contract; all config is in `app.json`, `eas.json`, and on-device AsyncStorage.
- **Version coordination:** `package.json` (`3.5.0`) = `app.json` `expo.version` (`3.5.0`) = `APP_VERSION` (`v3.5.0` in `src/utils/storage.js:3`); `STORAGE_VERSION` (`v7.0`) versions every persisted key; `android.versionCode` (`7`) gates Play/internal updates independently.
- **Key files:** `package.json` (deps + `postinstall`), `app.json` (Expo/EAS/widget/camera config), `eas.json` (build profiles), `tsconfig.json` (extends `expo/tsconfig.base`, empty overrides), `babel.config.js` (`babel-preset-expo` + reanimated plugin), `metro.config.js` (stock Expo), `jest.config.js` (`jest-expo/android` + `__tests__/setup/jest.setup.js`), `eslint.config.js` (flat config), `index.js` (dual registration), `android/` (native shell), `assets/` (icons, splash, widget previews).
- **On-device state locations:** `AsyncStorage` (`kwestup_*` keys), `${documentDirectory}Notes/Vaults/<vaultId>/*.md`, `${documentDirectory}models/qwen2.5-0.5b-instruct-q4_k_m.gguf`, `${cacheDirectory}kwestup-backup.kwestup` (transient export). Telemetry consent `kwestup_telemetry_optin` and resumable-download `kwestup_ai_model_download_resumable` persist across migrations and cache clears by design.

---

*Integration audit: 2026-09-27*
