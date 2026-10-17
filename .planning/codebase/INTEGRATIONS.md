# External Integrations

**Analysis Date:** 2026-10-18

## APIs & External Services

**Local Network / Device Sync (primary integration):**
- KwestUp PC Sync Server - Bidirectional REST synchronization with the companion desktop app over the local Wi-Fi subnet
  - Client: Native `fetch` with `AbortController` timeouts (`src/utils/syncService.js`)
  - Endpoints: `GET http://<ip>:<port>/ping` (3s timeout), `POST http://<ip>:<port>/sync` (10s timeout)
  - Auth: `Authorization: Bearer <token>` header; token obtained by scanning a QR code served at `http://localhost:5001/` on the PC
  - Pairing: `expo-camera` `CameraView` scans a JSON payload `{ ip, port, token }` (`src/components/QRScannerModal.js`); manual IP/port/token entry supported
  - Validation: strict IPv4/hostname/IPv6 and port (1–65535) validation; payload must contain `notes`, `tasks`, `birthdays` arrays (`src/utils/syncService.js`)
  - Transport: plain HTTP cleartext (enabled via `android:usesCleartextTraffic="true"`)

**On-Device AI Model Distribution:**
- Hugging Face - Downloads the quantized GGUF model file
  - URL: `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/<pinned-commit>/qwen2.5-0.5b-instruct-q4_k_m.gguf`
  - Pinned commit: `9217f5db79a29953eb74d5343926648285ec7e67`
  - Integrity: expected size `491400032` bytes; expected SHA-256 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`
  - Client: `expo-file-system/legacy` `createDownloadResumable` with 10-attempt exponential backoff + jitter, resumable state persisted to AsyncStorage (`src/utils/aiService.js`)
  - Verification: streaming chunked SHA-256 via `crypto-js` (8 MB windows); corrupt/truncated files are deleted, fail-closed

**App Update Check:**
- GitHub Releases API - Checks for newer app versions
  - URL: `https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest`
  - Headers: `Accept: application/vnd.github.v3+json`, `User-Agent: KwestUp-Mobile`
  - Reads `tag_name`, `html_url`, `body`, and first `.apk` asset download URL (`src/utils/diagnostics.js`)

**Telemetry (opt-in, anonymous):**
- KwestUp telemetry endpoint - Sends app-version and OS-platform events only when the user opts in
  - URL: `https://api.kwestup.com/telemetry` (POST JSON)
  - Gate: AsyncStorage key `kwestup_telemetry_optin` must equal `"true"`; disabled by default (`src/utils/diagnostics.js`, consent prompt in `App.js`)
  - Payload: `{ event, version, platform, timestamp, ...payload }` — no personal data or content

**Development-only Diagnostics (never runs in release):**
- `https://httpbin.org/json` - Connectivity probe, gated on `__DEV__` (`src/utils/diagnostics.js` `runNetworkDiagnostics`)

**Remote Image Assets (UI textures):**
- `https://www.transparenttextures.com/patterns/*.png` - Paper/metal background textures for cards and notes (`src/components/LiquidGlassCard.js`, `src/components/LiquidGlassBackground.js`, `src/screens/NotesScreen.js`)
- `https://images.unsplash.com/photo-1586075010923-2dd4570fb338` - Light paper background image (`src/components/LiquidGlassBackground.js`)
- `https://github.com/Omprakash-p06/KwestUp` - Opened via `Linking.openURL` from Settings (`src/screens/SettingsScreen.js`)

## Data Storage

**Databases:**
- None (no server-side or cloud database)
- `@react-native-async-storage/async-storage` `2.2.0` - On-device key-value persistence, schema version `v7.0` (`src/utils/storage.js`)
  - Keys namespaced `kwestup_…` (data, userName, theme, timer state, vaults, billing, widgets, telemetry, AI model, habits, behavior events, identities, rewards, interventions, idempotency, notification history)
  - Migration from legacy `v*` keys handled by `migrateUserDataIfNeeded` (`src/utils/storage.js`)

**File Storage:**
- Local filesystem only (`expo-file-system/legacy`)
  - Markdown vaults: `<documentDirectory>/Notes/Vaults/<vaultId>/*.md` (`src/utils/vaultService.js`)
  - AI model: `<documentDirectory>/models/qwen2.5-0.5b-instruct-q4_k_m.gguf` (`src/utils/aiService.js`)
- Export/import via `expo-document-picker` and `expo-sharing` (`src/utils/exportService.js`, `src/utils/vaultImport.js`)

**Caching:**
- In-memory metadata cache for vault notes; AsyncStorage-backed caches cleared by `clearAllCaches` (`src/utils/storage.js`)
- In-memory 50-entry log ring buffer for forensics (`src/utils/logger.js`)
- 100-event domain EventBus ring buffer (`src/behavior/eventBus.ts`)

## Authentication & Identity

**Auth Provider:**
- Custom (no third-party identity provider)
  - LAN sync uses an ephemeral Bearer token embedded in the PC-served pairing QR code (`src/utils/syncService.js`)
  - No accounts, cloud login, OAuth, or user registration
  - On-device vault encryption/passphrase support via `crypto-js` (`src/utils/vaultService.js`, `src/utils/vaultImport.js`)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Crashlytics, or third-party error SDK)
  - Custom `ErrorBoundary` component (`src/components/ErrorBoundary.js`) and in-memory forensics log buffer (`src/utils/logger.js`)

**Logs:**
- Structured environment-aware logger (`src/utils/logger.js`); `debug`/`info` silenced in production, `warn`/`error` always emitted; PII-key redaction before buffering
- `transform-remove-console` strips `console.log/info/debug` in production bundles (`babel.config.js`)
- Opt-in anonymous telemetry only (`src/utils/diagnostics.js`)

## CI/CD & Deployment

**Hosting:**
- Android only; distributed as APK via GitHub Releases and EAS Build
- No backend hosting / cloud infrastructure

**CI Pipeline:**
- GitHub Actions
  - `.github/workflows/ci.yml` - ESLint, TypeScript check, Jest with coverage
  - `.github/workflows/semgrep.yml` - Semgrep CE security scan (report-only)

## Environment Configuration

**Required env vars:**
- None required at runtime. No `.env` files are present at the repo root (`.gitignore` only excludes `.env*.local`).
- `NODE_OPTIONS=--max-old-space-size=4096` set for EAS production builds (`eas.json`)

**Secrets location:**
- No committed secrets. Native keystore/signing files (`*.jks`, `*.keystore`, `*.pem`, `*.key`, `*.p12`, `*.mobileprovision`) are gitignored (`.gitignore`)
- `android/local.properties` present locally (SDK paths only; gitignored)

## Native Module & Hardware Bindings

These are compiled/OS-level integrations rather than network services:

- `llama.rn` `0.12.4` - Native C++ LLM inference (CPU-only, `n_gpu_layers: 0`, `n_ctx: 2048`, 5-min idle context unload)
- `react-native-android-widget` `^0.16.1` - 5 Android AppWidget receivers (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList`, `HabitWidget`) declared in `android/app/src/main/AndroidManifest.xml`; headless handler `widgets/widget-task-handler.tsx`
- `expo-camera` - Camera access for QR scanning; requires `android.permission.CAMERA`
- `expo-notifications` - 5 EAS/Android notification channels; boot receiver (`RECEIVE_BOOT_COMPLETED`)
- Other Android permissions requested: `INTERNET`, `VIBRATE`, `SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE` (≤API 32), `WRITE_EXTERNAL_STORAGE` (≤API 29)
- `@react-native-community/datetimepicker`, `expo-clipboard`, `expo-haptics`, `expo-document-picker`, `expo-sharing`, `expo-file-system` - OS capability bindings

## Webhooks & Callbacks

**Incoming:**
- None (no webhook endpoints)

**Outgoing:**
- None (no outbound webhooks)

---

*Integration audit: 2026-10-18*
