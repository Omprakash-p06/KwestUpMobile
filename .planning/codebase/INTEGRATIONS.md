# External Integrations

**Analysis Date:** 2026-10-12

## APIs & External Services

**LAN PC Sync (first-party local REST, primary network integration):**
- KwestUp PC Sync Server over same-subnet HTTP - Bidirectional notes/tasks/taskLists/birthdays/theme sync
  - Client: raw `fetch` with `AbortController` timeouts in `src/utils/syncService.js` (`fetchWithTimeout`, 3s ping / 10s sync)
  - Endpoints: `GET http://<ip>:<port>/ping` (`pingSyncServer`), `POST http://<ip>:<port>/sync` with `Authorization: Bearer <token>` (`performSync`)
  - Auth: user-scanned QR token (min 6 chars) + strict IPv4/hostname/IPv6 + port validation (`validateSyncConfig`); QR capture via `expo-camera` in `src/components/QRScannerModal.js`; orchestration in `App.js` (`handleExecuteSync`)
  - SDK/Client: none (no SDK — plain fetch). No `axios`, no WebSocket

**On-device AI model distribution:**
- Hugging Face (`huggingface.co`) - Pinned GGUF download, no API key
  - URL built in `src/utils/aiService.js`: `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf`
  - Client: `expo-file-system` `DownloadResumable`/`createDownloadResumable` with resume state in AsyncStorage (`kwestup_ai_model_download_resumable`), 10 retries with exponential backoff + jitter, post-download size + SHA-256 gate (`MODEL_EXPECTED_SIZE`, `MODEL_EXPECTED_SHA256`)
  - Inference: `llama.rn` `initLlama`/`completion` (CPU-only, `n_ctx: 2048`, `n_threads: 2`) — fully offline after download; heuristic fallbacks in same file when model absent

**Release / update channel:**
- GitHub Releases API - In-app update check in `src/utils/diagnostics.js` (`checkForUpdates`)
  - `GET https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest` with `Accept: application/vnd.github.v3+json`, `User-Agent: KwestUp-Mobile`; parses `tag_name` vs `APP_VERSION` (`src/utils/storage.js`), surfaces `.apk` asset URL + release notes; prompted via `Linking.openURL` in `App.js`

**Diagnostics probe (dev-only):**
- `https://httpbin.org/json` - Connectivity probe in `src/utils/diagnostics.js` (`runNetworkDiagnostics`); hard-gated to `__DEV__` (`isDiagnosticsEnabled`), never called in release builds; also gated at call site in `App.js`

**Opt-in telemetry (dormant endpoint):**
- `POST https://api.kwestup.com/telemetry` - Anonymous `{ event, version, platform, timestamp }` in `src/utils/diagnostics.js` (`sendTelemetryEvent`); kill-switched by `kwestup_telemetry_optin !== "true"` in AsyncStorage with explicit opt-in dialog in `App.js`; no PII/notes/files sent. Treat as reserved/unprovisioned backend

**Remote media (single static asset):**
- `https://images.unsplash.com/...` - Light-paper texture in `src/components/LiquidGlassBackground.js` (`lightPaperUrl`); loaded as remote `ImageBackground` URI. Only third-party content URL in app UI

**Not integrated:** No Stripe, Supabase, Firebase, AWS, Auth0, Sentry, analytics SDK, ad SDK, or push-notification service (no FCM/APNs server — notifications are local-only). No GraphQL, no axios, no backend database client

## Data Storage

**Databases:**
- None (no SQLite, Realm, WatermelonDB, Drizzle, or remote DB). All structured state is key-value + filesystem
  - Connection: n/a
  - Client: `@react-native-async-storage/async-storage` `2.1.2` — versioned keys (`kwestup_data_v7.0`, `kwestup_timer_state_v7.0`, `kwestup_billing_*`, `kwestup_habits_*`, `kwestup_notification_history_v1`, etc.; key inventory in `src/utils/storage.js` `isUserDataKey`)

**File Storage:**
- On-device `expo-file-system` `~18.1.11` only — no S3/GCS/Cloudinary
  - Notes/vaults markdown tree under `${documentDirectory}Notes/Vaults/<vaultId>/`: `src/utils/fileStorage.js` (`initNotesFolder`, `saveNoteFile`, `getAllNotesFromFilesystem`), `src/utils/vaultService.js` (`ensureVaultsDir`, `migrateToVaultSystem`)
  - AI model cache under `${documentDirectory}models/qwen2.5-0.5b-instruct-q4_k_m.gguf`: `src/utils/aiService.js`
  - Encrypted backup export: AES-256-CBC + PBKDF2-HMAC-SHA256 (100k iterations, random salt/IV, v2 JSON envelope) in `src/utils/exportService.js` (`encryptBackup`/`decryptBackup`), shared out via `expo-sharing` `~13.1.5`, imported via `expo-document-picker` `~13.1.6` (`src/utils/vaultImport.js`, max 50 files / 1 MB each)

**Caching:**
- None as a dedicated layer. Version-cache clearing on upgrade preserves user keys (`clearAllCaches` in `src/utils/storage.js`); widget payloads are sliced server-side-of-Binder (first 5 important / 8 sorted tasks) in `App.js`

## Authentication & Identity

**Auth Provider:**
- None (local-only single-user app, no accounts)
  - Implementation: per-session LAN sync Bearer token scanned from PC QR code (`src/utils/syncService.js` `validateSyncConfig`); backup-archive passphrase for PBKDF2 encryption (`src/utils/exportService.js`); user display name stored locally (`kwestup_userName_v7.0`). No OAuth, JWT issuance, biometrics, or server sessions

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Crashlytics/Bugsnag). Local handling only:
  - Custom `logger` in `src/utils/logger.js` (`debug/info/warn/error`, `__DEV__`/`NODE_ENV`-gated verbosity, prod console-stripped via Babel)
  - `ErrorBoundary` in `src/components/ErrorBoundary.js` with copy-to-clipboard (`expo-clipboard`) diagnostics view
  - CI-side Semgrep scan (`.github/workflows/ci.yml` `semgrep` job + `semgrep.yml`, rules in `.semgrepignore`) — static analysis, not runtime APM

**Logs:**
- `src/utils/logger.js` throughout; release bundles drop `console.log/info/debug` but keep `error`/`warn` (`babel.config.js` + `babel-plugin-transform-remove-console`)

## CI/CD & Deployment

**Hosting:**
- No backend hosting. App artifacts: EAS Build APKs + GitHub Releases (APK asset consumed by the in-app updater in `src/utils/diagnostics.js` + `App.js`)
- EAS project: `9b029b06-5b07-4a1d-9999-a543a3ef1614`, owner `omprakash-p06` (`app.json` `extra.eas`)

**CI Pipeline:**
- GitHub Actions `.github/workflows/ci.yml` (triggers: push/PR to `main`, `development`; `contents: read`; concurrency-cancel): Node 22 → `npm ci` → `npm run lint` (ESLint, warn-tolerant) → `npm run typecheck` (`tsc --noEmit`) → `npx jest --ci --maxWorkers=2 --coverage` → uploads `eslint-report.json` + `coverage/` artifacts. Semgrep job `continue-on-error: true`

## Environment Configuration

**Required env vars:**
- None. There are zero required environment variables — the app runs fully offline with defaults. Verified: no `.env*` files in repo, no `EXPO_PUBLIC_*` references, only `process.env.NODE_ENV` log-gating (`src/utils/logger.js`, `src/utils/diagnostics.js`)

**Secrets location:**
- None stored. `.env*.local`, `*.key`, `*.p12`, `*.pem`, `*.jks` patterns are gitignored (`.gitignore`); `.npmrc` exists at root (existence only). Runtime secrets (LAN token, backup passphrase) are user-supplied per session and never committed

## Webhooks & Callbacks

**Incoming:**
- None. No webhook receivers, no deep-link handlers (`Linking` is used outbound only to open release URLs in `App.js`), no push-token registration

**Outgoing:**
- None as webhooks. Outbound network calls are limited to: LAN `POST /sync`, GitHub Releases `GET`, Hugging Face model `GET` (resumable), opt-in telemetry `POST`, dev-only httpbin probe, and the Unsplash texture `GET`. Local scheduling only for reminders — `expo-notifications` `scheduleNotificationAsync` / cancel APIs in `src/services/notificationService.ts` across 5 Android channels (`kwestup_behavior_cues`, `kwestup_daily_tasks`, `kwestup_birthdays`, `kwestup_billing`, `kwestup_system`)

---

*Integration audit: 2026-10-12*
