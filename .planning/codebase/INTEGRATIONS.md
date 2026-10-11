# External Integrations

**Analysis Date:** 2026-10-11

> This app is **local-first / offline-first**. There is no SaaS backend, no BaaS (Supabase/Firebase), no auth provider, no payment gateway, no analytics SDK, and no push service. Every "integration" below is either an on-device OS capability, a file download, or a direct LAN/HTTPS call made with the global `fetch`. There are no API keys or secrets in the repo.

## APIs & External Services

**On-device AI model download (Hugging Face):**
- Qwen2.5-0.5B-Instruct Q4_K_M GGUF (~468 MB) via `llama.rn` — offline inference after one-time download
  - SDK/Client: `llama.rn 0.12.4` (`initLlama` / `releaseAllLlama`)
  - Download URL (pinned commit): `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf`
  - Integrity: SHA-256 `74a4da8c…7a9db` + size `491400032` bytes verified post-download; resumable state in `kwestup_ai_model_download_resumable`
  - Auth: none (public model repo)
  - Implementation: `src/utils/aiService.js` (`MODEL_DOWNLOAD_URL`, `MODEL_EXPECTED_SHA256`, `MODEL_PATH` under `FileSystem.documentDirectory/models/`)

**Companion PC sync server (LAN REST, first-party):**
- KwestUp PC Sync Server over plain HTTP on the local network — bidirectional vault sync
  - Endpoints: `GET http://{ip}:{port}/ping` → `{ status: "online" }`; `POST http://{ip}:{port}/sync` with JSON payload (`notes`, `tasks`, `taskLists`, `birthdays`, `themeMode`, `selectedThemeName`, `userName`), `Authorization: Bearer {token}`
  - Auth: per-pairing token (min 6 chars) provisioned by QR scan (`expo-camera` → `src/components/QRScannerModal.js`); 401/403 surfaces "re-scan" error
  - Validation: `validateSyncConfig` (strict IPv4/hostname/IPv6 + port 1–65535), `validateSyncPayload` (requires `notes`/`tasks`/`birthdays` arrays), 4 s ping timeout / 10 s sync timeout via `AbortController`
  - Implementation: `src/utils/syncService.js` (`pingSyncServer`, `performSync`); invoked from `App.js` and `src/screens/SettingsScreen.js`

**Update check (GitHub Releases API):**
- `GET https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest` (`Accept: application/vnd.github.v3+json`, `User-Agent: KwestUp-Mobile`)
  - Compares `tag_name` against `APP_VERSION` (`v3.5.0` in `src/utils/storage.js`); surfaces release URL/notes and `.apk` asset URL via callback
  - Auth: none (public repo endpoint, unauthenticated rate limits apply)
  - Implementation: `src/utils/diagnostics.js` (`checkForUpdates`, `isNewerVersion`)

**Telemetry (opt-in stub, placeholder endpoint):**
- `POST https://api.kwestup.com/telemetry` with `{ event, version, platform, timestamp, ...payload }`
  - Gated on `AsyncStorage` key `kwestup_telemetry_optin === "true"`; silent no-op otherwise and on any network failure
  - Status: domain is a placeholder — treat as non-functional until a real collector exists; do not add PII to payloads
  - Implementation: `src/utils/diagnostics.js` (`sendTelemetryEvent`)

**Dev-only network probe (never runs in release):**
- `GET https://httpbin.org/json` behind `__DEV__` guard (`isDiagnosticsEnabled()`); release builds skip it entirely
  - Implementation: `src/utils/diagnostics.js` (`runNetworkDiagnostics`)

**What is NOT integrated:** no axios/fetch wrapper library (raw global `fetch` only), no WebSocket/SSE, no Supabase/Firebase/AWS/Stripe/Clerk/Auth0/RevenueCat/Sentry/Amplitude/Segment/OneSignal, no `expo-constants` remote config, no `EXPO_PUBLIC_*` vars.

## Data Storage

**Databases:**
- None. No SQLite, WatermelonDB, Realm, Supabase, or Firebase. Structured state lives in key-value storage:
  - Connection: n/a (on-device only)
  - Client: `@react-native-async-storage/async-storage 2.1.2` — key namespaces enumerated in `isUserDataKey()` in `src/utils/storage.js` (`kwestup_data_*`, `kwestup_vaults_*`, `kwestup_billing_*`, `kwestup_habits_*`, `kwestup_behavior_events_*`, `kwestup_notification_history_v1`, `kwestup_telemetry_optin`, etc.)

**File Storage:**
- On-device filesystem only (`expo-file-system ~18.1.11`):
  - Vault note markdown: per-vault directories from `getVaultPath()` — `src/utils/fileStorage.js` (`saveNoteFile`, `getAllNotesFromFilesystem`, `wipeNotesFilesystem`), registry/migration in `src/utils/vaultService.js`
  - LLM binary: `FileSystem.documentDirectory/models/qwen2.5-0.5b-instruct-q4_k_m.gguf` — `src/utils/aiService.js`
  - Encrypted backup import/export: `expo-document-picker ~13.1.6` (import) + `expo-sharing ~13.1.5` (export share sheet) — `src/utils/vaultImport.js`, `src/utils/exportService.js`, `src/screens/SettingsScreen.js`
  - No S3/GCS/Cloudinary or any remote bucket

**Caching:**
- None (no React Query cache, no Redis, no image CDN). `clearAllCaches()` in `src/utils/storage.js` only removes non-user `kwestup*`/`*cache*` AsyncStorage keys while preserving everything matched by `isUserDataKey()`

## Authentication & Identity

**Auth Provider:**
- None — single-user local app, no accounts, no sessions, no OAuth
  - Implementation: physical device possession is the auth boundary. Sensitive operations use user-supplied passphrases at runtime:
  - Backup encryption: AES-256 + PBKDF2-HMAC-SHA256 (100k iterations, random 16-byte salt/IV, v2 envelope with legacy v1 fallback) via `crypto-js` — `src/utils/exportService.js` (`encryptBackup` / `decryptBackup`)
  - LAN sync pairing: QR-provisioned bearer token per `src/utils/syncService.js`; camera permission string in `app.json`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Bugsnag/Crashlytics). Errors surface via in-app `src/components/ErrorBoundary.js` (with copy-to-clipboard via `expo-clipboard`) and the file/AsyncStorage-backed `src/utils/logger.js` (dev-verbose, production `error`/`warn` only — enforced by `babel-plugin-transform-remove-console`)

**Logs:**
- Custom `logger` (`debug/info/warn/error`) in `src/utils/logger.js`; dev-only device/network diagnostics in `src/utils/diagnostics.js` (`runDeviceDiagnostics`, gated on `__DEV__`)
- Quality signals in CI: ESLint JSON report artifact + Jest coverage artifact (see below)

## CI/CD & Deployment

**Hosting:**
- No backend hosting. Mobile artifacts built with EAS Build:
  - `extra.eas.projectId: 9b029b06-5b07-4a1d-9999-a543a3ef1614`, owner `omprakash-p06` — `app.json`
  - Profiles in `eas.json`: `development` (dev-client APK, internal), `preview` (internal), `production` (APK, `NODE_OPTIONS=--max-old-space-size=4096`); `submit.production` is empty (no store submission wired)
  - Updates distributed as GitHub Release APKs (see update-check API above)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml` (push/PR on `main`, `development`): `npm ci` → `npm run lint` → `npm run typecheck` → `npx jest --ci --maxWorkers=2 --coverage`, uploads `eslint-report.json` + `coverage/`
- Semgrep security scan — `.github/workflows/semgrep.yml` (`continue-on-error: true`, scope in `.semgrepignore`)

## Environment Configuration

**Required env vars:**
- None. Verified 2026-10-11: no `.env*` files exist, no `EXPO_PUBLIC_*` references, and the only `process.env.NODE_ENV` reads are build-mode guards in `src/utils/diagnostics.js` and `src/utils/logger.js`
- Configuration surface is: `app.json` (Expo manifest), `eas.json` (build profiles), `src/utils/storage.js` (`APP_VERSION v3.5.0`, `STORAGE_VERSION v7.0`), and user defaults seeded into AsyncStorage at runtime

**Secrets location:**
- No secrets to store — no API keys, tokens, or service credentials exist. Do not introduce any without also adding `.env` + `.gitignore` coverage (currently neither exists for env files)

## Webhooks & Callbacks

**Incoming:**
- None — no server, no webhook receivers. The only "incoming" data paths are: LAN `POST /sync` *client* (this app calls out; it never listens), QR-scanned pairing payloads, document-picker imports, and the Android widget task handler (`registerWidgetTaskHandler(widgetTaskHandler)` in `index.js` → `widgets/widget-task-handler.tsx`)

**Outgoing:**
- `POST {lan-server}/sync` (authenticated vault sync) — `src/utils/syncService.js`
- `POST https://api.kwestup.com/telemetry` (opt-in only, placeholder) — `src/utils/diagnostics.js`
- `GET https://api.github.com/.../releases/latest` (update check) — `src/utils/diagnostics.js`
- `GET https://huggingface.co/.../qwen2.5-0.5b-instruct-q4_k_m.gguf` (one-time model download) — `src/utils/aiService.js`
- OS-level: local notification scheduling via `expo-notifications` (5 channels: `kwestup_behavior_cues`, `kwestup_daily_tasks`, `kwestup_birthdays`, `kwestup_billing`, `kwestup_system`) — `src/services/notificationService.ts`; share-sheet export via `expo-sharing`; haptics via `expo-haptics`; 4 Android home-screen widgets via `react-native-android-widget` (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList` in `widgets/*.tsx`, declared in `app.json`)

---

*Integration audit: 2026-10-11*
