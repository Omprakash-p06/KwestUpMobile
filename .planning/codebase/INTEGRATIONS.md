# External Integrations

**Analysis Date:** 2026-10-11

## APIs & External Services

**On-device AI (no cloud LLM):**
- llama.rn native binding (`llama.rn 0.12.4`) - Offline inference in `src/utils/aiService.js` (`loadModel`, `summarizeNote`, `extractTasksFromNote`, `parseGlobalCommand`, `assistWriting`)
  - SDK/Client: `import { initLlama, releaseAllLlama } from "llama.rn"`
  - Model download: `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf` (~468 MB, pinned commit + SHA-256 `74a4da8c…93d7a9db` + exact size `491400032` verified in `verifyModelIntegrity`)
  - Auth: none (public HuggingFace URL)

**Update check:**
- GitHub Releases API - `GET https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest` in `checkForUpdates()` (`src/utils/diagnostics.js:65`), invoked from `App.js` post-init with a release-page prompt
  - SDK/Client: raw `fetch` with `Accept: application/vnd.github.v3+json`
  - Auth: none (unauthenticated public API)

**Dev-only connectivity probe:**
- `GET https://httpbin.org/json` in `runNetworkDiagnostics()` (`src/utils/diagnostics.js:24`) — gated to `__DEV__` only, never runs in release builds
  - Auth: none

**Optional telemetry (opt-in):**
- `POST https://api.kwestup.com/telemetry` in `sendTelemetryEvent()` (`src/utils/diagnostics.js:132`) — fires only when `AsyncStorage` key `kwestup_telemetry_optin === "true"`; payload is `{ event, version, platform, timestamp }`, no notes/personal data
  - SDK/Client: raw `fetch`
  - Auth: none (no token); user opt-in dialog in `App.js`

**LAN sync (self-hosted companion, primary data-exchange integration):**
- KwestUp PC Sync Server over local network — `GET /ping` + `POST /sync` with Bearer token in `src/utils/syncService.js` (`pingSyncServer`, `performSync`); orchestrated by `handleExecuteSync` in `App.js`
  - Client: raw `fetch` with `AbortController` timeouts (3 s ping / 10 s sync), strict `validateSyncConfig` (IPv4/hostname/IPv6 + port 1–65535 + token ≥ 6 chars) and `validateSyncPayload` (requires `notes`/`tasks`/`birthdays` arrays)
  - Base URL: `http://{ip}:{port}` (user-entered LAN address, QR-scanned via `src/components/QRScannerModal.js` which references `http://localhost:5001/`)
  - Auth: `Authorization: Bearer <token>` header; 401/403 surfaces "re-scan" error

**Remote imagery (UI decoration only):**
- `https://www.transparenttextures.com/patterns/*.png` (paper/brushed-alum/stardust textures) in `src/components/LiquidGlassBackground.js`, `src/components/LiquidGlassCard.js`, `src/screens/NotesScreen.js`
- `https://images.unsplash.com/photo-1586075010923-2dd4570fb338?...` (light paper fallback) in `src/components/LiquidGlassBackground.js`
- GitHub repo link `https://github.com/Omprakash-p06/KwestUp` opened via `Linking` in `src/screens/SettingsScreen.js`

## Data Storage

**Databases:**
- No remote/SQL database. Local-only persistence:
  - AsyncStorage (`@react-native-async-storage/async-storage`) — structured state: `kwestup_data_${STORAGE_VERSION}`, `kwestup_userName_*`, `kwestup_theme_mode_*`, `kwestup_theme_name_*`, `kwestup_timer_state_*`, `kwestup_activeVault_*`, `kwestup_vaults_*`, `kwestup_billing_*`, `kwestup_widget_*`, `kwestup_telemetry_*`, `kwestup_ai_model_*`, `kwestup_notification_history_v1`. Key inventory in `isUserDataKey()` (`src/utils/storage.js:8`); versioning/migration via `APP_VERSION`/`STORAGE_VERSION` + `migrateUserDataIfNeeded()`
  - Connection: n/a (on-device). Client: `AsyncStorage` API directly
  - Billing store: `kwestup_billing_${STORAGE_VERSION}` via `loadBillingData`/`saveBillingData` in `src/utils/billingStorage.js`

**File Storage:**
- On-device filesystem via `expo-file-system ~18.1.11` (no cloud bucket):
  - Vault notes: `<documentDirectory>/Notes/Vaults/<vaultId>/<folder>/<title>.md` — `getVaultPath()` in `src/utils/vaultService.js:18`; CRUD in `src/utils/fileStorage.js`
  - AI model: `<documentDirectory>/models/qwen2.5-0.5b-instruct-q4_k_m.gguf` (`MODEL_DIR`/`MODEL_PATH` in `src/utils/aiService.js:29`)
  - Backup staging: `${FileSystem.cacheDirectory}kwestup-backup.kwestup` temp file in `exportArchive()` (`src/utils/exportService.js:210`), always cleaned up
  - Import source: user-picked `.kwestup` file via `expo-document-picker`; share-out via `expo-sharing`

**Caching:**
- Buried in AsyncStorage hygiene (`clearAllCaches()` in `src/utils/storage.js` clears non-`isUserDataKey` kwestup/cache keys + `kwestup_ui_cache`, `kwestup_version_check`, `sidebar:state` on version change) and notification history pruning (48 h window in `src/services/notificationService.ts`). No Redis/Memcached/CDN.

## Authentication & Identity

**Auth Provider:**
- Custom, local-only — no OAuth/Supabase/Firebase/Auth0:
  - Implementation: no login at all. Single-device identity is the user-entered `userName` (`kwestup_userName_*`); vault data is protected at rest only by optional user-passphrase AES-256 backup encryption (PBKDF2-HMAC-SHA256, 100k iterations, v2 envelope; legacy v1 fallback) in `encryptBackup`/`decryptBackup` (`src/utils/exportService.js:22`)
  - LAN sync authorization: pre-shared Bearer token scanned from the PC server QR code (`validateSyncConfig` in `src/utils/syncService.js:34`)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Crashlytics/Bugsnag). In-app `ErrorBoundary` (`src/components/ErrorBoundary.js`) with clipboard copy of error details; structured `logger` utility (`src/utils/logger.js`, prod `console` stripped except `error`/`warn` via `babel.config.js`)

**Logs:**
- Local `logger.debug/info/warn/error` wrapper; device/network diagnostics print locally in dev only (`runDeviceDiagnostics`, `runNetworkDiagnostics` in `src/utils/diagnostics.js`); optional anonymous launch/platform telemetry only when opted in (see above)

## CI/CD & Deployment

**Hosting:**
- No backend hosting. Distribution: EAS Build APKs (`eas.json`: `development` dev-client APK, `preview` internal, `production` APK) for Android package `com.omprakashp06.kwestupmobile`; EAS project `9b029b06-5b07-4a1d-9999-a543a3ef1614`, owner `omprakash-p06` (`app.json:105`)
- Update discovery (not OTA): GitHub Releases polling → user visits release page to download APK manually

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml`: Node 22 + `npm ci` → ESLint (`npm run lint`) → `tsc --noEmit` → `jest --ci --maxWorkers=2 --coverage`; uploads `eslint-report.json` + `coverage/` artifacts; triggers on `main`/`development` push/PR
- `.github/workflows/semgrep.yml` + `semgrep` job in `ci.yml`: Semgrep security scan (`config: auto`, `continue-on-error: true`); `.semgrepignore` at root

## Environment Configuration

**Required env vars:**
- None. The app runs with zero required environment variables — all runtime config is compile-time (`app.json`, `eas.json`) or on-device (AsyncStorage + filesystem). `NODE_OPTIONS=--max-old-space-size=4096` is set for the EAS production build only (`eas.json:21`)

**Secrets location:**
- No secrets committed or required. Sensitive-adjacent values are user-supplied at runtime only: backup passphrase (never stored — passed transiently to `encryptBackup`/`decryptBackup`) and LAN sync token (entered/scanned per sync session). Forbidden-file note: `.npmrc` exists at repo root — existence only, contents never read; no `.env`/`credentials`/`*.pem` consumption detected in code

## Webhooks & Callbacks

**Incoming:**
- None. No webhook receivers, push-notification providers (FCM/APNs), deep-link handlers, or inbound server ports. Local notifications are scheduled OS-side via `expo-notifications` (`src/services/notificationService.ts`) across 5 Android channels (`kwestup_behavior_cues`, `kwestup_daily_tasks`, `kwestup_birthdays`, `kwestup_billing`, `kwestup_system`)

**Outgoing:**
- `POST /sync` payload `{ notes, tasks, taskLists, birthdays, themeMode, selectedThemeName, userName }` to the user-configured LAN PC server (`src/utils/syncService.js:135`)
- `POST https://api.kwestup.com/telemetry` opt-in launch events (`src/utils/diagnostics.js:127`)
- `GET https://api.github.com/.../releases/latest` update checks; `GET https://httpbin.org/json` dev-only probe (see above)

---

*Integration audit: 2026-10-11*
