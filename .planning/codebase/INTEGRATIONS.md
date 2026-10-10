# External Integrations

**Analysis Date:** 2026-10-10

## APIs & External Services

**Update distribution:**
- GitHub Releases API - OTA-style update check (compares `APP_VERSION` against latest tag, surfaces APK asset + release notes)
  - SDK/Client: bare `fetch` in `src/utils/diagnostics.js` (`checkForUpdates`)
  - Auth: none (public repo endpoint `https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest`)
  - Trigger: background timer 2s after init in `App.js`; manual "check for updates" row in `src/screens/SettingsScreen.js` opens `releaseUrl` via `Linking.openURL`

**On-device AI model distribution:**
- Hugging Face Hub - One-shot GGUF model download (`qwen2.5-0.5b-instruct-q4_k_m.gguf`, ~468 MB, pinned commit `9217f5db...`)
  - SDK/Client: `expo-file-system` resumable download + `crypto-js` SHA-256 verification in `src/utils/aiService.js` (`MODEL_DOWNLOAD_URL`, `MODEL_EXPECTED_SHA256`, `MODEL_EXPECTED_SIZE`)
  - Auth: none (public `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/...` URL)
  - Inference itself is fully offline via `llama.rn` (`initLlama`); no API key, no cloud LLM call anywhere in `src/`

**Dev-only connectivity probe:**
- httpbin - Startup network reachability probe (`GET https://httpbin.org/json`)
  - SDK/Client: bare `fetch` in `src/utils/diagnostics.js` (`runNetworkDiagnostics`)
  - Auth: none
  - Guard: dev-only (`__DEV__` gate in `App.js` + `isDiagnosticsEnabled()` in `src/utils/diagnostics.js`); never fires in release builds

**Placeholder telemetry (opt-in, likely unprovisioned):**
- `api.kwestup.com` - Anonymous `launch` event POST (`{event, version, platform, timestamp}`)
  - SDK/Client: bare `fetch` in `src/utils/diagnostics.js` (`sendTelemetryEvent`)
  - Auth: none
  - Guard: AsyncStorage opt-in flag `kwestup_telemetry_optin` (`true` required); consent dialog in `App.js`, toggle in `src/screens/SettingsScreen.js`; fails silently offline. Domain does not resolve to a known backend — treat as stub endpoint

**LAN companion sync (first-party, user-hosted):**
- KwestUp PC Sync Server - Bidirectional REST over local Wi-Fi (`GET /ping`, `POST /sync` with `{notes, tasks, taskLists, birthdays, themeMode, selectedThemeName, userName}`)
  - SDK/Client: bare `fetch` with `AbortController` timeouts (3s ping / 10s sync) in `src/utils/syncService.js` (`pingSyncServer`, `performSync`, `validateSyncConfig`, `validateSyncPayload`); invoked from `App.js` (`handleExecuteSync`)
  - Auth: `Authorization: Bearer <token>` header; config `{ip, port, token}` provisioned by QR scan (`src/components/QRScannerModal.js` + `expo-camera`); token must be ≥6 chars, port 1–65535, strict IPv4/hostname/IPv6 validation
  - Base URL is always plain `http://<ip>:<port>` — LAN-only by design, never HTTPS

**What is NOT integrated:** No Stripe/billing API, no Supabase/Firebase/AWS backend, no Auth0/Clerk, no Sentry/crash reporting, no analytics SDK (Segment/Amplitude/Mixpanel/OneSignal), no `axios`/`WebSocket`/`XMLHttpRequest` usage in `src/` — all network I/O is bare `fetch` to the five endpoints above.

## Data Storage

**Databases:**
- None remote. Local-only persistence:
  - `@react-native-async-storage/async-storage` `2.1.2` — versioned JSON blobs (`kwestup_data_v*`, `kwestup_timer_state_v*`, `kwestup_userName_*`, `kwestup_theme_*`, `kwestup_vaults_*`, `kwestup_activeVault_*`, billing key in `src/utils/billingStorage.js`, `kwestup_notification_history_v1`, `kwestup_telemetry_optin`, resumable-download state). Read/write sites: `App.js`, `src/context/TaskContext.js`, `src/utils/storage.js`, `src/utils/vaultService.js`, `src/utils/exportService.js`, `src/services/notificationService.ts`
  - Connection: no connection string — on-device storage, no env var
  - Client: `AsyncStorage` directly (no ORM, no wrapper library); migration helpers in `src/utils/storage.js` (`migrateUserDataIfNeeded`, `clearAllCaches`)

**File Storage:**
- Local filesystem only via `expo-file-system` (`FileSystem.documentDirectory`):
  - Vault note markdown trees (`src/utils/fileStorage.js` — `initNotesFolder`, `saveNoteFile`, `getAllNotesFromFilesystem`, `wipeNotesFilesystem`; paths from `src/utils/vaultService.js` `getVaultPath`)
  - AI model file `models/qwen2.5-0.5b-instruct-q4_k_m.gguf` (`MODEL_DIR`/`MODEL_PATH` in `src/utils/aiService.js`)
  - Encrypted backup archives round-tripped through `expo-sharing` / `expo-document-picker` (`src/utils/exportService.js`, `src/utils/vaultImport.js`, `src/screens/SettingsScreen.js`)
- No S3/GCS/Azure or CDN integration

**Caching:**
- None remote. Local version-cache invalidation only: `clearAllCaches()` in `src/utils/storage.js` runs on `APP_VERSION` change (see `App.js` background init)

## Authentication & Identity

**Auth Provider:**
- Custom local-only — no external IdP
  - Implementation: onboarding username stored in AsyncStorage (`kwestup_userName_*`, collected in `App.js` name dialog); no password, no session, no token refresh
  - LAN sync authorization: per-connection Bearer token scanned from PC QR code, validated client-side in `src/utils/syncService.js`, sent per-request; 401/403 surfaces "re-scan" error
  - Backup encryption passphrase: user-supplied at export time, PBKDF2-HMAC-SHA256 (100k iterations, random 16-byte salt/IV, v2 envelope) with legacy v1 fallback, in `src/utils/exportService.js` (`encryptBackup`/`decryptBackup`); passphrase itself is never stored

## Monitoring & Observability

**Error Tracking:**
- None external (no Sentry/Bugsnag). In-app `ErrorBoundary` (`src/components/ErrorBoundary.js`) with copy-to-clipboard (`expo-clipboard`) report action

**Logs:**
- Custom `logger` facade in `src/utils/logger.js` (debug gated on `process.env.NODE_ENV !== 'production'`; production strips `log/info/debug` at bundle time via `babel-plugin-transform-remove-console`, keeps `error`/`warn`)
- Dev-only device/network probes in `src/utils/diagnostics.js` (gated on `__DEV__`)
- Build-time quality gates (not runtime): ESLint JSON report + Jest coverage uploaded as CI artifacts (`.github/workflows/ci.yml`); Semgrep scans (`.github/workflows/semgrep.yml`, `.semgrepignore`)

## CI/CD & Deployment

**Hosting:**
- No backend hosting. Client distribution via EAS Build (`eas.json`: `development` dev-client internal APK, `preview` internal, `production` APK) for Android package `com.omprakashp06.kwestupmobile` (`app.json`); iOS declares `supportsTablet` but has no submit profile; releases published as GitHub Release APKs consumed by the in-app updater
- EAS project binding: `extra.eas.projectId: 9b029b06-5b07-4a1d-9999-a543a3ef1614`, `owner: omprakash-p06` in `app.json`

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`): `npm ci` → `npm run lint` → `npm run typecheck` (`tsc --noEmit`) → `npx jest --ci --maxWorkers=2 --coverage` on `main`/`development` pushes and PRs; uploads `eslint-report.json` and `coverage/`
- Semgrep security scan (`.github/workflows/semgrep.yml` + `semgrep` job in `ci.yml`, `continue-on-error: true`)

## Environment Configuration

**Required env vars:**
- None. Repo contains no `.env` files (verified 2026-10-10); the only environment reads are `process.env.NODE_ENV` (`src/utils/logger.js`, `babel.config.js`) and `__DEV__` (`src/utils/diagnostics.js`, `App.js`). No `expo-constants` / `@env` / `extra.*` secrets consumed in `src/`

**Secrets location:**
- No secrets committed. `.gitignore` excludes `.env*.local`, keystores (`*.jks`, `*.p8`, `*.p12`, `*.key`, `*.pem`, `*.mobileprovision`), and Expo/build artifacts. `.npmrc` exists at root (existence only — contents never read). LAN tokens and backup passphrases are runtime-only user input, never persisted to the repo

## Webhooks & Callbacks

**Incoming:**
- None. No server, no push-notification provider, no deep-link handler beyond opening the release URL via `Linking.openURL` (`App.js`, `src/screens/SettingsScreen.js`, including `https://github.com/Omprakash-p06/KwestUp` support link)

**Outgoing:**
- None persistent. The only outbound POST is the opt-in single-shot telemetry event (`POST https://api.kwestup.com/telemetry` in `src/utils/diagnostics.js`); LAN `POST /sync` targets the user's own PC, not a cloud webhook

---
*Integration audit: 2026-10-10*
