# External Integrations

**Analysis Date:** 2026-08-06

## APIs & External Services

**On-Device AI Models (Hugging Face):**
- Service: In-app LLM inference via `llama.rn` in `src/utils/aiService.js`.
  - Model: Qwen2.5-0.5B-Instruct Q4_K_M GGUF (~468MB, CPU-only).
  - SDK/Client: `llama.rn` + `expo-file-system` `DownloadResumable`.
  - Download URL: `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf`.
  - Auth: none (public model). Resumable with retry/backoff, persisted via AsyncStorage key `kwestup_ai_model_download_resumable`.
  - Behavior: runs fully offline. Features use model context with n_ctx 2048, n_threads 2. Functions: `summarizeNote`, `extractTasksFromNote`, `parseGlobalCommand`, `assistWriting`, `assistWritingCustom`.

**Update / Release Check (GitHub Releases):**
- Service: `checkForUpdates` in `src/utils/diagnostics.js`.
  - Endpoint: `https://api.github.com/repos/Omprakashp06/KwestUpMobile/releases/latest`.
  - SDK/Client: native `fetch` with GitHub API Accept header + `User-Agent: KwestUp-Mobile`.
  - Auth: none (public). Looks for the latest release tag, finds the `.apk` release asset, `releaseUrl`, and notes. Opens `releaseUrl` via `Linking.openURL`.

**Telemetry (kwestup.com):**
- Service: Anonymized usage telemetry, opt-in.
  - Endpoint: `https://api.kwestup.com/telemetry` (POST, JSON) in `src/utils/diagnostics.js` (`sendTelemetryEvent`).
  - Payload: event name, version, `Platform.OS`, timestamp.
  - Auth: none. Opt-in gate persisted under `kwestup_telemetry_optin` in AsyncStorage. Sent only at opt-in `launch`. No personal data sent.

**Network Diagnostics (httpbin.org):**
- Service: connectivity probe in `src/utils/diagnostics.js` (`runNetworkDiagnostics`) — GET `https://httpbin.org/json` to verify reachability (informational logs only).

## Local Network Sync (Companion PC server)

**Peer-to-Peer Sync Server:**
- Service: User running "KwestUp PC Sync Server" on a same-subnet PC/localhost.
  - SDK/Client: native `fetch` with timeouts in `src/utils/syncService.js` (`performSync` 10s, `pingSyncServer` 3s).
  - Discovery: user scans a QR (`src/components/QRScannerModal.js`) whose payload is `{"ip","port","token"}` (default port 5001) or enters it manually (IP regex-validated, incl. `localhost`/`127.0.0.1`).
  - Endpoints: `GET {base}/ping` (health, expects `{"status":"online"}`) and `POST {base}/sync` (full bidirectional payload exchange).
  - Auth: `Authorization: Bearer {token}` on `/sync`; 401/403 surfaces "invalid or expired — please re-scan".
  - Data: sends notes, tasks, taskLists, birthdays, themeMode, selectedThemeName, userName; returns the same so the client overwrites local state and reschedules birthday/bill reminders.
  - No TLS — plain HTTP on LAN.

## Data Storage

**Databases:**
- None (no SQL/ORM). Primary structured persistence is **AsyncStorage** JSON key-value (`kwestup_data_v7.0`, `kwestup_timer_state_v7.0`, `kwestup_theme_*`, `kwestup_vaults_v5.0`, `kwestup_activeVault_v5.0`, `kwestup_billing_v7.0`, `kwestup_userName_v7.0`). Key list + migration logic in `src/utils/storage.js`.
- Markdown note files on the local filesystem under `{documentDirectory}Notes/Vaults/<vaultId>/` (see `src/utils/vaultService.js`, `src/utils/fileStorage.js`).

**File Storage:**
- Local filesystem only (`expo-file-system`). Vault markdown files, AI model binary, and temp backup files. No cloud object storage.

**Caching:**
- None beyond AsyncStorage keys + OS caches (no Redis/Memcached). Cache clearing (`clearAllCaches`) in `src/utils/storage.js`.

## Auth & Identity

**Auth Provider:**
- None. No user accounts, OAuth, or SSO.
- Sync uses a scannable bearer token (QR or manual) from the PC server for local peer auth.
- Encrypted self-backups use a user passphrase (AES-256 + PBKDF2, salt from `src/utils/exportService.js` `encryptBackup`/`decryptBackup`).

## Notifications

**Local Notifications:** (no remote push provider)
- All scheduling is local via `expo-notifications` in `src/utils/notifications.js` and `src/utils/billingNotifications.js`. No channels/FCM/APNs used.
- Categories: daily task reminders, due-date task alerts, immediate completion pings, birthday + advance reminders (scheduled for current + next year), recurring bill reminders.

## On-Device AI (external model source)

- **Model download:** Qwen2.5-0.5B from Hugging Face (see APIs above). After download the model runs fully on-device; no API key needed.

## Monitoring & Observability

- **Error tracking:** None (no Sentry/Datadog). Errors primarily logged via `console.warn`/`console.error`.
- **Logs:** `console.*` only. Optional opt-in telemetry endpoint above.
- **Secret scanning:** GitHub Actions workflow `.github/workflows/semgrep.yml` runs `semgrep/semgrep-action@v1` with auto config on push to `main`/`develop` and PRs to `main`.

## CI/CD & Deployment

- **Hosting:** EAS Build (Expo) produces Android APKs; distribution profile `internal` (ADB) and `production` (APK). Release artifacts published via GitHub Releases (checks in `checkForUpdates`).
- **CI Pipeline:** GitHub Actions only for Semgrep security scans. No automated test/deploy pipeline beyond release artifacts.

## Environment Configuration

- **Required env vars:** none at runtime; the app talks to LAN sync server only after user-provided connection. `NODE_OPTIONS` set in `eas.json` production build profile only.
- **Secrets location:** no `.env`; `app.json` contains EAS `projectId`; native signing uses the debug keystore (`android/app/build.gradle`). Sync token is user-provided/served on-demand by the PC server (never stored in app source).

## Webhooks & Callbacks
- Incoming: None. Outgoing: None. Communication is pull/local on demand (LAN sync, GitHub check, model download).

---

*Integration audit: 2026-08-06*