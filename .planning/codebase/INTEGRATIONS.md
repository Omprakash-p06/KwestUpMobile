# Integrations

**Analysis Date:** 2026-09-28

> Local-first stance: this app has **no cloud backend, no auth provider, no remote database, and no crash/monitoring SaaS**. The only internet egress in product code is (a) one-time GGUF model download from Hugging Face, (b) optional GitHub release check, (c) opt-in telemetry POST, and (d) a dev-only httpbin connectivity probe that is skipped in release builds. Everything else is on-device or LAN.

## Internal Modules / Cross-cutting integrations

All cross-cutting logic lives in `src/utils/` and is consumed by screens, contexts, and widgets — no external SDK involved:

- **Central date engine — `src/utils/dateUtils.js`:** sole authority for calendar dates (`getLocalDateString`, `parseLocalDate`, `getTomorrowLocalDateString`, `getLocalMonthDayString`). Consumed by `App.js`, `DailyTasksScreen`, `BillingScreen`, `SearchScreen`, `widgets/widget-task-handler.tsx`, and `src/utils/aiService.js` (LLM prompt "today" + keyword-fallback due dates). Rule: never use UTC `toISOString().slice(0,10)` for calendar days.
- **Pure task mutation layer — `src/utils/taskMutations.js`:** framework-agnostic recurrence/subtask/list transforms (`calculateNextRecurrence`, subtask + list helpers). Shared by `src/context/TaskContext.js` (React provider with notification/haptic side-effects) and headless `widgets/widget-task-handler.tsx`. Rule: new task logic goes here first, thin wrappers in consumers.
- **Domain contexts — `src/context/`:** `TaskContext.js`, `VaultContext.js`, `BillingContext.js`, `BirthdayContext.js` composed in `App.js`; `src/navigation/AppNavigator.js` injects them with backward-compatible prop fallbacks (`taskCtx?.x ?? props`).
- **Structured logging — `src/utils/logger.js`:** sole logging facade; `ErrorBoundary` crash path reads `logger.getRecentLogs()`. All product code logs via `logger`, never raw `console`.
- **Crash boundary — `src/components/ErrorBoundary.js`:** wraps the tree in `App.js`; copy-paste diagnostics report (clipboard → Share fallback), no network upload.
- **Notifications hub — `src/utils/notifications.js` (+ `billingNotifications.js`, `BirthdayContext.js`):** `setNotificationHandler` configured at import; schedulers for daily tasks, birthdays (morning reminders), and recurring bills. Triggered from `TaskContext` mutations and billing flows.
- **Vault/filesystem — `src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/vaultImport.js`:** multi-vault `.md` storage on `expo-file-system`, directory import via `expo-document-picker`.
- **Backup pipeline — `src/utils/exportService.js`:** `encryptBackup` / `decryptBackup` / `packVaults` / `exportArchive` (+ import side); consumes `storage.js` key allowlist, `vaultService`, `billingStorage`, `billingNotifications` (re-schedule on restore), and `expo-sharing` for the export sheet. Covered by `__tests__/unit/exportImportService.test.js`.

## External Services (note local-first — absence of cloud deps if true; note httpbin probe gating if found)

**Cloud backends / auth / databases / analytics: NONE.** Verified: no `firebase`, `supabase`, `aws`, `auth0`, `sentry`, `amplitude`, `mixpanel` in `package.json` or `src/` imports; `.planning/PROJECT.md` out-of-scope explicitly forbids remote accounts and centralized cloud DBs.

| Service | Use | Code | Notes |
|---|---|---|---|
| **Hugging Face (model CDN)** | One-time download of pinned GGUF model | `src/utils/aiService.js` — `MODEL_DOWNLOAD_URL = https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/<pinned-commit>/qwen2.5-0.5b-instruct-q4_k_m.gguf` | Commit pinned (`MODEL_PINNED_COMMIT = 9217f5db…`); resumable `DownloadResumable` with `AsyncStorage` resume state (stale URL/fileUri discarded); 10 retries, exponential backoff + jitter; post-download SHA-256 + size gate. Only network transfer the app *requires*; inference itself is fully offline via `llama.rn`. |
| **GitHub Releases (update check)** | Optional "new version available" prompt | `src/utils/diagnostics.js` — `checkForUpdates()` → `GET https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest` | Compares `tag_name` semver vs `APP_VERSION`; surfaces APK asset URL. Best-effort, fail-silent (`{ hasUpdate: false }`). |
| **httpbin (connectivity probe)** | Dev-only network diagnostic | `src/utils/diagnostics.js` — `runNetworkDiagnostics()` → `GET https://httpbin.org/json` | **Gated dev-only (Phase 19, WR-03):** `isDiagnosticsEnabled()` (`__DEV__`, else `NODE_ENV !== production`) returns early in release — a production build never contacts httpbin and never pays probe latency at startup. Same gate covers `runDeviceDiagnostics`. Callers in `App.js` additionally gate on `__DEV__`. |
| **Self-hosted telemetry endpoint** | Opt-in usage telemetry | `src/utils/diagnostics.js` — `sendTelemetryEvent()` → `POST https://api.kwestup.com/telemetry` | **Opt-in only:** no-ops unless `AsyncStorage("kwestup_telemetry_optin") === "true"`. Payload `{ event, version, platform, timestamp, ...payload }`. Fail-silent offline. Key survives cache wipes via `isUserDataKey` allowlist. |

## LAN / Device-to-device (sync protocol, validation rules if found)

PC-companion sync over local Wi-Fi — plain HTTP to a user-supplied LAN host, no cloud relay. Implementation: `src/utils/syncService.js`; UI/scan: `src/components/QRScannerModal.js` (`expo-camera`) + sync screens; tests: `__tests__/unit/syncService.test.js`.

- **Protocol:** `GET http://<ip>:<port>/ping` (connectivity, 3 s timeout, placeholder token `ping-token-check`) → `POST` sync handshake with Bearer token + local payload; `fetchWithTimeout` (default 4 s, `AbortController`) throughout.
- **Config validation — `validateSyncConfig({ ip, port, token })`:** strict IPv4 octet check (dotted-numeric input must pass full IPv4 regex — rejects `999.999.1.1`), else hostname (`hostnameRegex`) or IPv6 accepted; path-injection rejected via hostname/IP shape; port coerced to integer, must be 1–65535; token trimmed, minimum 6 chars. Returns normalized `{ ip, port, token }`.
- **Payload validation — `validateSyncPayload(data)`:** requires top-level object with `notes[]`, `tasks[]`, `birthdays[]` (missing array throws — prevents accidental note wipes); `taskLists` defaulted to `[]` when absent.
- **Transport note:** plain `http://` LAN (no TLS) with token auth — accepted LAN-sync trade-off per Phase 16 (`SEC-02`); QR scan provisions `{ ip, port, token }` so secrets never typed manually.

## Build & Platform integrations (Expo, EAS, Android native)

- **Expo managed + config plugins (`app.json`):** slug `kwestupmobile`, SDK `53.0.0`, package `com.omprakashp06.kwestupmobile`, `versionCode 7`. Plugins: `llama.rn` (native LLM), `expo-camera` (QR permission string), `expo-build-properties` (iOS `useFrameworks: static`), `react-native-android-widget` declaring 4 widgets (FocusTimer, DailyTasks, ImportantTasks, TasksList; `updatePeriodMillis 1800000`, preview images in `assets/widget-preview/`). `extra.eas.projectId 9b029b06-…`, owner `omprakash-p06`.
- **EAS (`eas.json`):** `development` (dev-client, internal APK), `preview` (internal), `production` (APK, `NODE_OPTIONS=--max-old-space-size=4096`); CLI `>= 3.10.0`. No OTA/`expo-updates` — updates ship as new APKs via GitHub Releases.
- **Android native (`android/`):** standard RN Gradle project (`build.gradle`, `gradle.properties`, `settings.gradle`, `gradlew`); `postinstall: node patch-llama-gradle.js` patches the `llama.rn` C++ binding build. `android/` ignored by ESLint.
- **Widget bridge:** `index.js` registers both the app root and the headless handler (`registerWidgetTaskHandler(widgetTaskHandler)` from `react-native-android-widget`); `widgets/widget-task-handler.tsx` performs storage-direct task toggles via `taskMutations.js` (no React tree). `KwestUpPC/` desktop companion directory exists in repo but is ESLint-ignored (separate surface).
- **OS services via Expo SDK:** notifications (`expo-notifications` — Android permission flow in `src/utils/notifications.js`), haptics (`expo-haptics`), fonts (`expo-font`), clipboard/share/document-picker/file-system as listed in STACK.md.

## Environment & Config

- **Env files / secrets: none required.** No `.env` reads detected; no API keys, auth tokens, or cloud credentials — nothing to provision. (`ls .env*` → not present; never commit secrets per repo policy.)
- **Version sources of truth:** `package.json` (`3.5.0`) + `app.json` (`version`/`versionCode`) + `src/utils/storage.js` (`APP_VERSION`, `STORAGE_VERSION`). Bump all three together; storage migration handles the data-key rollover.
- **Build-time env:** only `NODE_ENV` (Babel prod console strip + logger/diag dev gates) and EAS `NODE_OPTIONS` for production memory. `__DEV__` is the runtime dev flag.
- **Persisted config keys (AsyncStorage):** theme (`kwestup_theme_mode_*/name_*`), userName, timer state (decoupled low-overhead key to avoid Binder `-22`), vault registry/active vault, billing blob, `kwestup_widget_active_tab`, `kwestup_telemetry_optin`, `kwestup_ai_model_download_resumable`, `kwestup_last_version`/`kwestup_last_clear`. All survive `clearAllCaches()` by allowlist.
- **CI environment:** GitHub Actions `ubuntu-latest`, Node 20, `npm install` → lint → Jest with coverage (`.github/workflows/ci.yml`); Semgrep scan (`.github/workflows/semgrep.yml`).

---

*Integration audit: 2026-09-28*
