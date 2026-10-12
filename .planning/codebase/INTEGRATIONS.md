# External Integrations

**Analysis Date:** 2026-10-12

## APIs & External Services

**LAN PC Sync Server (first-party, user-hosted):**
- KwestUp PC Sync Server over plain HTTP on the local network - Bidirectional notes/tasks/taskLists/birthdays/theme sync
  - SDK/Client: raw `fetch` + `AbortController` timeout wrapper (`fetchWithTimeout`) in `src/utils/syncService.js`
  - Auth: `Authorization: Bearer <token>` where token is QR-scanned via `src/components/QRScannerModal.js` (`expo-camera`); validated by `validateSyncConfig` (IP/hostname + port 1-65535 + token min 6 chars)
  - Endpoints hit: `GET http://<ip>:<port>/ping` (`pingSyncServer`, 3 s timeout) then `POST http://<ip>:<port>/sync` (`performSync`, 10 s timeout); payload/response validated by `validateSyncPayload` (requires `notes`, `tasks`, `birthdays` arrays)
  - Orchestration: `App.js` `handleExecuteSync` (wipe + rewrite vault files via `src/utils/fileStorage.js`, cancel + reschedule birthday notifications)
  - No cloud relay — both devices must be on the same Wi-Fi subnet; HTTP (not HTTPS) because it is LAN-only

**GitHub Releases (update distribution):**
- `api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest` - Manual OTA check, APK download redirect
  - SDK/Client: raw `fetch` with `Accept: application/vnd.github.v3+json` in `src/utils/diagnostics.js` `checkForUpdates`
  - Auth: none (public repo endpoint, rate-limited anonymously)
  - Trigger: background `setTimeout` 2 s after init in `App.js`; prompts user with `Linking.openURL(releaseUrl)`; prefers `.apk` asset (`browser_download_url`) when present
  - No Expo Updates / EAS Update service is used

**HuggingFace (AI model CDN):**
- `huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF` pinned commit `9217f5db79a29953eb74d5343926648285ec7e67` - One-time ~468 MB GGUF download
  - SDK/Client: `expo-file-system` `DownloadResumable`/`createDownloadResumable` in `src/utils/aiService.js` `downloadModel` (10 retries, exponential backoff + jitter, resume state in `AsyncStorage` key `kwestup_ai_model_download_resumable`)
  - Auth: none (public URL in `MODEL_DOWNLOAD_URL`)
  - Integrity: exact size `491400032` bytes + chunked SHA-256 `74a4da8c…7a9db` via `verifyModelIntegrity`/`hashFileSha256` (`crypto-js`); corrupt files deleted fail-closed
  - Inference itself is fully offline via `llama.rn` `initLlama` (CPU-only, `n_ctx: 2048`, `n_threads: 2`) — no OpenAI/Anthropic/Gemini/cloud-LLM calls anywhere

**Dev-only / stub endpoints:**
- `https://httpbin.org/json` - Connectivity probe in `src/utils/diagnostics.js` `runNetworkDiagnostics`; dev-only (`__DEV__` guard, skipped in release; callers in `App.js` also gated)
- `https://api.kwestup.com/telemetry` - Opt-in anonymous launch/event POST in `src/utils/diagnostics.js` `sendTelemetryEvent`; gated on `AsyncStorage` `kwestup_telemetry_optin === "true"`; 404/offline is silently swallowed. Treat as stub — no working backend is required for the app to function

**What is NOT integrated:**
- No Supabase, Firebase, Auth0, Clerk, Amplify, RevenueCat, Stripe, OneSignal, Sentry, or any analytics SDK — verified by dependency + import grep over `package.json` and `src/`
- No `axios` or networking library — all HTTP is global `fetch`

## Data Storage

**Databases:**
- None remote. Local-first only:
  - Connection: n/a (no connection string, no env var)
  - Client: `@react-native-async-storage/async-storage` `2.1.2` — versioned keys `kwestup_data_v7.0`, `kwestup_userName_v7.0`, `kwestup_billing_*`, `kwestup_habits_*`, `kwestup_behavior_events_*`, `kwestup_ai_model_*`, `kwestup_telemetry_optin`, etc. (see `src/utils/storage.js` `isUserDataKey`, `STORAGE_VERSION`)
  - State owners: `src/context/TaskContext.js`, `src/context/HabitContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`, `src/context/VaultContext.js`
  - Migration/caching: `migrateUserDataIfNeeded` + `clearAllCaches` (preserves `isUserDataKey` keys) in `src/utils/storage.js`

**File Storage:**
- On-device `expo-file-system` `~18.1.11` (`FileSystem.documentDirectory`) — no S3/GCS/Cloudinary:
  - Vault note markdown files (`<vaultId>/<folder>/<title>.md`) via `src/utils/fileStorage.js` + `src/utils/vaultService.js` (`initNotesFolder`, `saveNoteFile`, `getAllNotesFromFilesystem`, `wipeNotesFilesystem`)
  - AI model cache (`<documentDirectory>models/qwen2.5-0.5b-instruct-q4_k_m.gguf`) via `src/utils/aiService.js` (`MODEL_DIR`, `MODEL_PATH`)
  - Encrypted backup import/export (AES-256 envelope JSON) via `src/utils/exportService.js` + `src/utils/vaultImport.js`, shared/opened with `expo-sharing` `~13.1.5` + `expo-document-picker` `~13.1.6` (`src/screens/SettingsScreen.js`)

**Caching:**
- None external (no Redis/Memcached/CDN). Local caches only:
  - `AsyncStorage` UI/version caches cleared by `clearAllCaches` in `src/utils/storage.js`
  - In-memory LLM context singleton with 5-min idle unload + AppState background unload in `src/utils/aiService.js` (`_llamaContext`, `IDLE_UNLOAD_TIMEOUT_MS`, `subscribeAppState`)

## Authentication & Identity

**Auth Provider:**
- None (no accounts, no login, no OAuth, no session tokens)
  - Implementation: single-device identity is just a display name stored in `AsyncStorage` (`kwestup_userName_v7.0`, set in `App.js` name dialog)
  - LAN sync authorization: short-lived Bearer token scanned from the PC server's QR code (`src/components/QRScannerModal.js` → `src/utils/syncService.js`); never persisted beyond the sync call — user re-scans per session
  - Backup confidentiality: user-chosen passphrase → PBKDF2-HMAC-SHA256 (100k iterations, random 16-byte salt/IV, v2 envelope) + legacy v1 fallback in `src/utils/exportService.js` (`encryptBackup`/`decryptBackup`); wrong passphrase fails closed

## Monitoring & Observability

**Error Tracking:**
- None external (no Sentry/Bugsnag/Crashlytics)
  - In-app: `src/components/ErrorBoundary.js` (crash screen + copy-to-clipboard via `expo-clipboard`) and structured `src/utils/logger.js` (debug gated on `NODE_ENV !== 'production'`; production strips `console.log/info/debug` via `babel.config.js`, keeps `error`/`warn`)

**Logs:**
- Local `logger.debug/info/warn/error` only; no log shipping. Release diagnostics (`runDeviceDiagnostics`, `runNetworkDiagnostics` in `src/utils/diagnostics.js`) are compiled-gated to dev builds

## CI/CD & Deployment

**Hosting:**
- No backend hosting. Client distributed as Android APK built by EAS Build (`eas.json`: `development` internal+dev-client APK, `preview` internal, `production` APK with 4 GB heap; `app.json` EAS `projectId` `9b029b06-5b07-4a1d-9999-a543a3ef1614`, owner `omprakash-p06`)
- Public distribution channel is GitHub Releases APK asset (see update-check flow above); Android `package` `com.omprakashp06.kwestupmobile`, `versionCode` 7

**CI Pipeline:**
- GitHub Actions `.github/workflows/ci.yml` (`lint-and-test` on `ubuntu-latest`, Node 22, `npm ci`): `npm run lint` (blocking) → `npm run lint:report` (artifact, always) → `npm run typecheck` → `npx jest --ci --maxWorkers=2 --coverage` (artifacts: `eslint-report.json`, `coverage/`)
- `.github/workflows/semgrep.yml` - Static-analysis security scan (ruleset in `.semgrepignore`)

## Environment Configuration

**Required env vars:**
- None. The app reads zero runtime env vars — no `EXPO_PUBLIC_*`, no `expo-constants` config, no `app.json` `extra` secrets beyond the public EAS `projectId`. The only build-time env usage is `NODE_ENV`/`__DEV__` for log stripping and dev-only diagnostics, plus `NODE_OPTIONS=--max-old-space-size=4096` injected by the EAS `production` profile itself

**Secrets location:**
- No secrets in repo. No `.env*` files exist (verified). `.npmrc` exists — contents never read (assume registry auth, do not quote). Never commit tokens, passphrases, or QR sync tokens; the LAN Bearer token lives only in memory during a sync session

## Webhooks & Callbacks

**Incoming:**
- None — no server, no push-provider webhooks, no deep-link handlers registered. `expo-notifications` are locally scheduled only (`src/services/notificationService.ts` with 5 Android channels: `kwestup_behavior_cues`, `kwestup_daily_tasks`, `kwestup_birthdays`, `kwestup_billing`, `kwestup_system`); home-screen widgets refresh via local `requestWidgetUpdate` (`App.js`, `index.js`, `widgets/widget-task-handler.tsx`)

**Outgoing:**
- `POST https://api.kwestup.com/telemetry` (`{ event, version, platform, timestamp }`) — fires only on `launch` (and explicit events) when the user opted in via the `App.js` telemetry dialog / `src/screens/SettingsScreen.js` toggle. No other outbound callbacks, no analytics beacons

---

*Integration audit: 2026-10-12*
