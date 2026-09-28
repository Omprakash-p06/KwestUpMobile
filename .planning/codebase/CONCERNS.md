# Concerns

**Analysis Date:** 2026-09-28
**Lens:** Milestone 2 complete (19/19 phases, 171 tests passing) — release-readiness review.

## Tech Debt (ranked)

1. **Per-task `updatedAt` merge absent in `refreshTasksFromStorage` (Phase 17 deferral, still open)**
   - Whole-array overwrite: storage snapshot replaces in-memory tasks if JSON differs.
   - Files: `src/context/TaskContext.js:129-171` (refresh), `src/context/TaskContext.js:69-71` (documented residual micro-window: in-app mutation <500ms before foreground refresh can be overwritten).
   - Impact: low-probability task-edit loss on foreground resume. Per-task `updatedAt` fields already exist (`src/utils/taskMutations.js:61,98,131,159,175,226`) — merge key is available, merge logic is not.

2. **Double-confirm on task delete (screen + context both confirm)**
   - `src/screens/TaskListScreen.js:249-254` and `:343-348` call `showConfirmation(...)` then `deleteTask(task.id)`; `src/context/TaskContext.js:228-249` runs `confirmFn` (customConfirm || showConfirmationDialog) again before executing.
   - Impact: user must confirm twice per delete (UX bug, not data loss). Fix: screen should pass title/message through `deleteTask(id, customConfirm)` or context should skip confirm when caller already confirmed.

3. **Raw `console.*` bypassing `logger` (Phase 19 incomplete coverage)**
   - `src/utils/vaultImport.js:22,28,39,62,64,68` — 6 raw calls (error/log/warn), including filename + destPath logging.
   - `src/navigation/AppNavigator.js:118,380` — raw `console.warn`.
   - `src/context/BillingContext.js:40,51,61,71,81,91,101`, `src/utils/billingStorage.js:24,33`, `src/utils/notifications.js:60,78,100,111,178,192`, `src/screens/BirthdaysScreen.js:72`, `src/screens/NotesScreen.js:743` — raw `console.error`.
   - `widgets/widget-task-handler.tsx:80,84,132+` — raw `console.log`/`console.warn` in headless widget context (no logger import).
   - `src/utils/logger.js:145,151,156,161` — the 4 intentional passthroughs (by design, gated: debug/info dev-only via `babel.config.js` `transform-remove-console` + `isDevelopment()`).
   - Impact: unredacted, unbuffered output; `babel.config.js` strips log/info/debug in prod but keeps `warn`/`error`, so raw error calls with user data survive to release logs.

4. **Oversized screen/component files (complexity / review risk)**
   - `src/screens/NotesScreen.js` (2013 lines), `src/screens/SettingsScreen.js` (1101), `src/utils/aiService.js` (1064), `src/screens/BillingScreen.js` (815), `src/screens/TaskListScreen.js` (803), `src/screens/DailyTasksScreen.js` (691). No TODO/FIXME/HACK markers in `src/` (only match is the `TODO:`-tag parser regex in `src/utils/aiService.js:516-517`, not a debt marker).

5. **Legacy backup v1 fallback kept indefinitely**
   - `src/utils/exportService.js:84-92` — static salt `4b77657374557053616c745f7632`, 1000 PBKDF2 iterations, salt reused as IV. Correctly isolated as decrypt-only fallback (new archives always v2: `src/utils/exportService.js:21-47`, 128-bit random salt/IV, 100k iterations, SHA-256), but weak archives remain restorable forever. Consider a warn-and-migrate prompt on v1 import.

6. **Destructive import with no rollback**
   - `src/utils/exportService.js:309-324` — `importArchive` clears all user AsyncStorage keys (`multiRemove`) before `multiSet` restore; a crash between the two leaves empty state. No pre-import snapshot/rollback. Vault file restore (`:329-363`) also overwrites in place.

7. **Hardcoded remote texture URLs (privacy + offline fragility)**
   - `src/screens/NotesScreen.js:503,505,785,788`, `src/components/LiquidGlassCard.js:32,35`, `src/components/LiquidGlassBackground.js:12,35` — `transparenttextures.com` / `unsplash.com` image fetches. Every render path with these contacts a third party (IP leak vs. local-first promise) and fails offline. Bundle locally or drop.

## Security & Privacy Notes

- **Backup encryption v2 — verified present** (`src/utils/exportService.js:21-47` encrypt / `:58-97` decrypt): per-archive 16-byte random salt + IV, PBKDF2-HMAC-SHA256 100k iterations, AES-256, envelope `{v:2, kdf, hasher, iterations, salt, iv, ciphertext}` with auto-detect + v1 fallback. Residual: passphrase lives only in call-stack memory (no SecureStore/AsyncStorage persistence found — good), but wrong-passphrase errors are generic by design (`:299-300`).
- **LAN sync validation — verified present** (`src/utils/syncService.js:34-72` config, `:82-102` payload): strict IPv4 octet check, hostname/IPv6 regexes, port 1–65535 integer, token min 6 chars trimmed; payload requires `notes`/`tasks`/`birthdays` arrays (prevents note-wipe). Transport is plaintext `http://` (`:110`, `:137`) — acceptable for LAN-only but token travels as `Bearer` over unencrypted Wi-Fi; document "trusted-network only" in release notes. `pingSyncServer` (`:107-129`) uses a dummy `ping-token-check` token — never against internet, LAN host only.
- **Storage keys/versioning — verified present** (`src/utils/storage.js:4-22`): dynamic `STORAGE_VERSION = "v7.0"`, `isUserDataKey` allowlist (`kwestup_data/userName/theme/vaults/billing/widget/telemetry/ai_model`) preserved across `clearAllCaches` (`:25-66`) and migrated highest-version-wins (`:69-187`). No secrets stored in AsyncStorage (unencrypted store holds only user data — consistent with local-first model, but worth stating in privacy copy).
- **Model integrity — verified present** (`src/utils/aiService.js:135-192`): chunked streaming SHA-256 (`MODEL_HASH_CHUNK_BYTES` 8 MB, base64 windows via `expo-file-system ~18.1.11`), pinned commit `9217f5d…` + expected SHA-256 `74a4da8c…` + exact size 491,400,032 bytes; fail-closed validator, corrupt file deleted (`:206-239`), post-download gate (`:336-341`). Fast size-only path (`customValidator === null`) skips hashing on routine entry — by design, hash runs at download time.
- **Crash-report PII redaction — verified present**: key-based redaction before buffering in `src/utils/logger.js:37-81` (`SENSITIVE_KEYS` covers content/body/note/title/text/message/passphrase/token/key/secret/password; 1000-char cap; WeakSet cycle guard; Error cause recursion; deep-freeze at `:116-134`); report capped at 8000 chars in `src/components/ErrorBoundary.js:93-97`; `componentDidCatch` funnels through `logger.error` (`:37-40`).
- **Known residual — positional string args NOT key-redacted**: `sanitizeEntry` (`src/utils/logger.js:86-107`) passes a string `message` through verbatim; only `details` objects go through `serializeItem`. Any `logger.error("…", userTitle)`-style call with user content in the message position lands unredacted in the ring buffer and the copy-pasteable crash report. Convention going forward: never interpolate user content into the message string — always pass as `details` objects.
- **`ErrorBoundary` report exfiltration surface**: report contains full `error.stack` + `componentStack` unredacted (`src/components/ErrorBoundary.js:74-91`) — stacks can embed file URIs/note titles. Copy/Share is user-initiated (acceptable), but there is no redact pass over the stack strings.
- **Vault import filename sanitization — adequate but narrow**: `src/utils/vaultImport.js:54-55` strips `/\?%*:|"<>` but allows `..` segments and overlong names; `destPath = vault.path + safeName` (`:57`) with no length cap or `..` rejection. Add `..`/leading-dot rejection and a length clamp.
- **No third-party network probes in release except update check**: `runNetworkDiagnostics` (httpbin) and `runDeviceDiagnostics` are dev-gated (`src/utils/diagnostics.js:10-20,109-114`, callers in `App.js:226-229` check `__DEV__`). Exceptions below.

## Reliability / Offline Risks

- **GitHub update check phones home on every launch in production** — `App.js:537-556` fires `checkForUpdates` (GET `https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest`, `src/utils/diagnostics.js:62-106`) 2s after init with no `__DEV__` guard and no user opt-out. Privacy contradiction for a local-first app + startup latency/failure surface. Gate behind explicit Settings action or telemetry opt-in.
- **Telemetry endpoint is a placeholder domain**: `sendTelemetryEvent` POSTs to `https://api.kwestup.com/telemetry` (`src/utils/diagnostics.js:127-149`), opt-in gated (`kwestup_telemetry_optin`), fire-and-forget from `App.js:205,1005`. If the domain is unregistered, opt-in users leak version/platform/timestamp + payload to whoever owns it or fail silently. Verify domain ownership before release or remove.
- **Home-widget stale reads / split-brain writes**: widget handler reads/writes `kwestup_data_${STORAGE_VERSION}` directly (`widgets/widget-task-handler.tsx:89-132`) bypassing TaskContext debounce; in-app `refreshTasksFromStorage` whole-overwrites on AppState active (`src/context/TaskContext.js:173-191`). Widget toggle racing an in-app edit can lose one side (same root cause as Tech Debt #1). Widget also has its own 600ms ticking-animation delay write path.
- **Import-while-dirty**: `importArchive` clear-then-restore has no confirmation of successful decrypt-to-restore atomicity (see Tech Debt #6); interrupted import = data loss. Recommend pre-import auto-export prompt.
- **APK self-update flow is manual and error-prone**: `src/screens/SettingsScreen.js:102-134` downloads APK then `Alert`s user to install manually from Downloads; no integrity check on downloaded APK (contrast with GGUF SHA-256 gating).

## Test Gaps

- Coverage: 11 suites in `__tests__/unit/` (`aiService`, `aiAssistant-smoke`, `dateUtils`, `errorBoundary`, `exportImportService`, `logger`, `storageMigration`, `syncService`, `taskContext`, `taskMutations`, `vaultAndFileStorage`) + `phase12-widget-logic.test.js` at root. No suites for: `src/utils/billingStorage.js` / `billingNotifications.js` / `BillingContext.js`, `src/utils/notifications.js` scheduling/cancel paths, `src/utils/diagnostics.js` (update-compare, telemetry opt-in), `src/utils/vaultImport.js` (filename sanitization, `..` traversal), `widgets/widget-task-handler.tsx` toggle/merge logic, any screen-level UI (delete double-confirm, import/export flows), `src/utils/fileStorage.js` error paths beyond vault tests.
- `__tests__/unit/exportImportService.test.js:129` references legacy `kwestup_tasks_v5.0` key — passes only if migration handles it; fine, but no test asserts v1-weak-archive warning or import-rollback behavior.
- No test pins the logger residual (string-message PII passthrough) or the 8000-char report cap against pathological buffers.

## Release-Readiness Gaps

1. Decide on GitHub update-check behavior (remove auto-check, keep manual in Settings, or gate on opt-in) — privacy promise at stake.
2. Resolve `api.kwestup.com` telemetry ownership or strip `sendTelemetryEvent` before store submission.
3. Fix or explicitly accept: double-confirm delete, per-task merge deferral, raw-console leftovers (`vaultImport.js`, billing, notifications, widget handler).
4. Bundle remote textures locally or remove (offline + tracker-free requirement).
5. Add import safety: pre-import snapshot/rollback or at minimum a blocking "import replaces everything" confirm with auto-backup offer.
6. Large-file review: `NotesScreen.js` (2013) and `SettingsScreen.js` (1101) unreviewed at this granularity — recommend focused review pass before release branch cut.

## Recommended Next Investigations

- Trace every `logger.*` call with a non-literal first argument; confirm no user content sits in message position (codemod to `details`-object form).
- Fuzz `validateSyncConfig` with IPv6/hostname edge cases and `validateSyncPayload` with oversized arrays (DoS via giant LAN payload — no size cap in `performSync`).
- Soak-test widget ↔ app concurrent toggles with 500ms–2s timing to quantify the merge-loss window.
- Audit `AsyncStorage` total size growth (vault + billing + timer keys) against Android Binder limits; `App.js:421-459` split already mitigates, verify with production-size vault.
- Confirm `transform-remove-console` actually strips in the EAS release profile (check `eas.json` build type sets `NODE_ENV=production`) and that retained `warn`/`error` calls carry no PII.

---

*Concerns audit: 2026-09-28*
