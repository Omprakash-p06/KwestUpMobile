# External Integrations

**Analysis Date:** 2026-10-01

## APIs & External Services

**On-device AI model download:**
- Hugging Face (`huggingface.co`) - One-time GGUF model fetch for offline inference
  - SDK/Client: `llama.rn 0.12.4` (`initLlama`) + `expo-file-system` resumable download in `src/utils/aiService.js`
  - URL: `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/<pinned-commit>/qwen2.5-0.5b-instruct-q4_k_m.gguf` (`MODEL_DOWNLOAD_URL`, `MODEL_PINNED_COMMIT`, `MODEL_EXPECTED_SHA256`, `MODEL_EXPECTED_SIZE` in `src/utils/aiService.js`)
  - Auth: none (public repo, pinned commit `9217f5db79a29953eb74d5343926648285ec7e67`, SHA-256 verified)

**LAN companion sync (user's own PC, not a SaaS backend):**
- User-hosted KwestUp PC endpoint over local network - Ping + REST sync handshake with QR-provisioned config
  - SDK/Client: raw `fetch` with `AbortController` timeout in `src/utils/syncService.js` (`fetchWithTimeout`, `validateSyncConfig`)
  - Base URL: `http://<ip>:<port>` built from QR code scanned in `src/components/QRScannerModal.js` (hint text references `http://localhost:5001/` PC screen)
  - Auth: pre-shared `token` from QR config (`{ ip, port, token }`), validated strictly (IPv4/hostname/IPv6 checks)

**Release / diagnostics probes:**
- GitHub Releases API - Update check in `src/utils/diagnostics.js` (`checkForUpdates` fetches `https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest`)
  - SDK/Client: raw `fetch`
  - Auth: none
- httpbin (`https://httpbin.org/json`) - Dev-only network probe in `src/utils/diagnostics.js` (`runNetworkDiagnostics`); skipped in release builds via `isDiagnosticsEnabled()` (`__DEV__` guard)
  - SDK/Client: raw `fetch`
  - Auth: none

**Remote static assets (no SDK, plain image URIs):**
- `transparenttextures.com` + `images.unsplash.com` - Card/grain textures in `src/components/LiquidGlassCard.js`, `src/components/LiquidGlassBackground.js`, `src/screens/NotesScreen.js`
  - SDK/Client: `expo-image` / React Native `Image` `uri` source
  - Auth: none

**Dead / stub endpoint (never called in production):**
- `https://api.kwestup.com/telemetry` - Exists only inside a commented/disabled stub in `src/utils/diagnostics.js`; no telemetry is sent
  - Auth: n/a

## Data Storage

**Databases:**
- None (no SQLite/WatermelonDB/Realm/Supabase/Firebase). All persistence is key-value + files:
  - Connection: n/a
  - Client: `@react-native-async-storage/async-storage 2.1.2` via `src/utils/storage.js` (`APP_VERSION`, `STORAGE_VERSION`, `isUserDataKey`), `src/utils/billingStorage.js`, `src/context/TaskContext.js`, `src/utils/diagnostics.js`, `src/utils/aiService.js` (resumable-download key `kwestup_ai_model_download_resumable`)

**File Storage:**
- On-device filesystem only (`expo-file-system ~18.1.11`)
  - Vault JSON files via `src/utils/vaultService.js` (`getVaultPath`, `ensureVaultsDir`, `getVaults`)
  - Generic read/write via `src/utils/fileStorage.js`
  - Backup import via `expo-document-picker` in `src/utils/vaultImport.js` and `src/screens/SettingsScreen.js`
  - Backup export + share via `expo-sharing` in `src/utils/exportService.js` and `src/screens/SettingsScreen.js`
  - LLM model at `${FileSystem.documentDirectory}models/qwen2.5-0.5b-instruct-q4_k_m.gguf` (`MODEL_DIR`, `MODEL_PATH` in `src/utils/aiService.js`)

**Caching:**
- None (no React Query/SWR/Redis). In-memory module singletons only (e.g. `_llamaContext` + `_initPromise` in `src/utils/aiService.js`, idle-unload timer `IDLE_UNLOAD_TIMEOUT_MS`)

## Authentication & Identity

**Auth Provider:**
- None (local-only app, no login/signup/OAuth)
  - Implementation: user data stays on device; encrypted backup archives use a user-supplied passphrase with AES-256 + PBKDF2-HMAC-SHA256 (100k iterations, v2 envelope) in `src/utils/exportService.js` (`encryptBackup` / `decryptBackup`); LAN sync uses QR-provisioned pre-shared token in `src/utils/syncService.js`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Crashlytics). Local handling only:
  - `src/components/ErrorBoundary.js` (copy-to-clipboard via `expo-clipboard`)
  - Central `logger` in `src/utils/logger.js` (imported by `src/utils/aiService.js`, `src/utils/notifications.js`, `src/utils/exportService.js`, `src/utils/syncService.js`, `src/utils/diagnostics.js`)
  - `npm run lint:report` writes `eslint-report.json`; CI uploads it as an artifact (`.github/workflows/ci.yml`)

**Logs:**
- Console via `logger` wrapper (`debug/info/warn/error`); Babel strips `log/info/debug` from production bundles, preserves `error/warn` (`babel.config.js` + `babel-plugin-transform-remove-console`)

## CI/CD & Deployment

**Hosting:**
- No backend hosting. Mobile binary distributed via EAS (`eas.json`): `development` (dev-client APK, internal), `preview` (internal), `production` (APK + `NODE_OPTIONS=--max-old-space-size=4096`); EAS project `9b029b06-5b07-4a1d-9999-a543a3ef1614` (`app.json` `extra.eas`)

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml` on `main` + `development`): setup Node 22 → `npm ci` → `npm run lint` → `npm run typecheck` (`tsc --noEmit`, strict mode per `tsconfig.json`) → `npx jest --ci --maxWorkers=2 --coverage` → upload `eslint-report.json` + `coverage/` artifacts
- Semgrep security scan (`.github/workflows/semgrep.yml`, `continue-on-error: true`, `.semgrepignore` at repo root)

## Environment Configuration

**Required env vars:**
- None. There is no `.env` convention and no code reads `process.env.*` / `expo-constants` for secrets (only `NODE_ENV` for Babel/dev guards in `babel.config.js` and `src/utils/diagnostics.js`).

**Secrets location:**
- No secrets stored. Sensitive inputs are runtime-only: backup passphrase (typed by user, never persisted — see `src/utils/exportService.js`) and LAN sync token (QR-provisioned, validated in `src/utils/syncService.js`). Do not commit `.env` / credential files if introduced later.

## Webhooks & Callbacks

**Incoming:**
- None (no server, no push provider like FCM/APNs configured; `expo-notifications` used for local scheduling only in `src/utils/notifications.js`, `src/utils/billingNotifications.js`, `src/context/BirthdayContext.js`)
- OS callbacks only: `AppState` background/unload hook for the LLM context (`subscribeAppState` in `src/utils/aiService.js`), headless widget task handler (`registerWidgetTaskHandler(widgetTaskHandler)` in `index.js` → `widgets/widget-task-handler.js`)

**Outgoing:**
- Hugging Face model download (one-time, `src/utils/aiService.js`)
- GitHub Releases version check (`src/utils/diagnostics.js`)
- httpbin dev-only probe (`src/utils/diagnostics.js`, dev builds only)
- LAN sync REST calls to the user's PC (`src/utils/syncService.js`)
- No analytics/telemetry webhooks; the `api.kwestup.com/telemetry` stub in `src/utils/diagnostics.js` is disabled

---

*Integration audit: 2026-10-01*
