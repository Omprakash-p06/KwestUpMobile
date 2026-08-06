# Codebase Concerns

**Analysis Date:** 2026-08-06

## Tech Debt

**Screens are monolithic and oversized.**
- Issue: Single files concentrate hundreds of lines of UI, state, and handlers in one component, making them hard to navigate, test, and extend.
- Files: `src/screens/NotesScreen.js` (2012 lines), `src/screens/SettingsScreen.js` (1100 lines), `src/components/AIAssistant.js` (1089 lines), `src/screens/BillingScreen.js` (813 lines), `src/screens/TaskListScreen.js` (803 lines), `src/utils/aiService.js` (633 lines)
- Impact: High risk of regression when touching any of these; reviewers cannot meaningfully diff them; impossible to unit-test in isolation.
- Fix approach: Extract repeated editor/panel/task subcomponents and pure helper functions (e.g., note sanitization, recurrence logic) into dedicated modules with tests.

**Root `App.js` is a state monolith.**
- Issue: The entire app's state, persistence, notification scheduling, and navigation callbacks (`handleAddTask`, `handleToggleTask`, recurrence spawning, birthday rescheduling) all live in one 1269-line component.
- Files: `App.js`
- Impact: Every feature touches this file causing frequent merge conflicts; state lives in props drilled to many screens; no separation between business logic and UI.
- Fix approach: Introduce a data-layer module (e.g., a reducer/context for tasks, birthdays, vaults) so screens consume actions instead of callbacks.

**Recurrence / toggle logic is duplicated across app and widget.**
- Issue: The "spawn next recurrence on complete" workflow exists both in App.js (`App.js` lines ~750-770) and in widget-land `widgets/widget-task-handler.tsx` (lines 141-179). The widget writes directly to AsyncStorage while the running App keeps state in memory.
- Files: `widgets/widget-task-handler.tsx`, `App.js`
- Impact: Behavior drifts between the two paths (progressive-recurrence and notification re-scheduling differ); widget toggles do not update the App's in-memory state until the next AppState foreground reload, so the open app can show stale task lists right after a widget interaction.
- Fix approach: Factor recurrence into a single shared module imported by both paths; subscribe the foreground app to widget-driven storage changes.

**Two overlapping/legacy ESLint configs.**
- Issue: Both legacy `.eslintrc.js` and flat `eslint.config.js` are committed and both configure the same plugins/rules with slightly different rule sets.
- Files: `.eslintrc.js`, `eslint.config.js`
- Impact: Confusing which one is authoritative; lint results differ depending on how ESLint is invoked.
- Fix approach: Remove the legacy `.eslintrc.js` and standardize on the flat `eslint.config.js`.

**Native node_modules patches via postinstall script.**
- Issue: `patch-llama-gradle.js` runs on `npm install` and mutates `node_modules/llama.rn/android/build.gradle` and `node_modules/react-native-android-widget/.../RNWidgetUtil.java` using regex string replacement.
- Files: `patch-llama-gradle.js` (`package.json` `postinstall`)
- Impact: Upgrading `llama.rn` or `react-native-android-widget` silently breaks the build when the regex no longer matches (the script only logs a warning and continues); these modifications are only re-applied when `npm install` is next run.
- Fix approach: Replace patches with a local fork of the packages, or wrap patching in a build check that fails loudly on mismatch, and add a comment + test asserting the post-patch content.

**App version tracked in multiple sources of truth.**
- Issue: Version `3.5.0` is duplicated in `package.json`, `app.json`, and `src/utils/storage.js` (`APP_VERSION = "v3.5.0"`), plus `versionCode: 7` in `app.json`.
- Impact: Version can drift and update/DAG version checks (via GitHub releases in `src/utils/diagnostics.js`) compare against `storage.js`'s value, which can disagree with the shipped build.
- Fix approach: Derive all version values from a single source at build time.

## Known Bugs

**UTC-vs-local date handling for "today".**
- Symptoms: Daily-task rollover, birthday detection, and `completedDate` stamps all use `new Date().toISOString().slice(0, 10)`, which returns the **UTC** calendar date.
- Files: `App.js` (lines 275, 278, 376, 759), `src/screens/DailyTasksScreen.js` (lines 27, 78), `src/screens/SearchScreen.js` (line 61), `src/screens/BillingScreen.js` (lines 152, 228, 587), `src/navigation/AppNavigator.js` (line 126), `widgets/widget-task-handler.tsx` (line 130)
- Trigger: For users in timezones with a positive UTC offset (e.g. UTC+5:30, suggested by the default currency `₹`), the local day starts ahead of UTC, so "today" isn't recognized until early-to-mid morning local. For users behind UTC (e.g. UTC-5), late-evening local belongs to tomorrow's UTC date.
- Workaround: none; data resets/comparisons are wrong for timezones other than UTC.
- Fix approach: Compute the local date using `getFullYear()/getMonth/getDate()` of the local `Date`, not `.toISOString()`.

**Storage migration writes version-gap keys.**
- Symptoms: When migrating legacy data, `storage.js` hard-codes the destination active-vault/vaults keys to `v5.0` (`kwestup_activeVault_v5.0`, `kwestup_vaults_v5.0`) instead of the current `STORAGE_VERSION`.
- Files: `src/utils/storage.js` (lines 143, 153)
- Impact: Migration targets a key version that may be stale relative to current storage; could silently lose or misroute vault state.
- Fix approach: Reuse `currentStorageVersion` for these writes.

**`clearAllCaches` on version change wipes telemetry opt-in and AI-model download state.**
- Symptoms: `clearAllCaches()` (runs automatically on every app version change, `App.js` line 213) filters all keys containing "kwestup" that are `!isUserDataKey`. This includes `kwestup_telemetry_optin` and `kwestup_ai_model_download_resumable` (both are kwestup keys not in `isUserDataKey` in `src/utils/storage.js`).
- Files: `src/utils/storage.js` (lines 30-43), `App.js` (line 213), `src/utils/diagnostics.js` (line 112), `src/utils/aiService.js` (line 19)
- Impact: Detects telemetry consent and aborts an in-progress AI model download on every app update.
- Workaround: none.

## Security Considerations

**Backup encryption uses weak / reused crypto parameters.**
- Risk: Encrypted archives via CryptoJS AES: a hardcoded salt `"4b776573745..."` is used both as the PBKDF2 salt **and** as the AES IV, with only `iterations: 1000` for key derivation. Reusing the salt as IV across every archive + weak KDF iterations materially weakens the cipher.
- Files: `src/utils/exportService.js` (lines 21-23, 38-40)
- Current mitigation: none (user-supplied passphrase is fed to PBKDF2).
- Recommendations: Use a random per-export salt + IV, raise PBKDF2 iterations to ≥100k, and store salt/IV in the archive header rather than hardcoded.

**Local network sync transmits a bearer token over plaintext HTTP.**
- Trigger: `performSync` builds `http://${ip}:${port}` URLs and sends `Authorization: Bearer <token>` in cleartext across the LAN.
- Files: `src/utils/syncService.js` (lines 29, 57, 89); token provided via QR/manual entry in `src/components/QRScannerModal.js`
- Current mitigation: a per-session security token generated by the PC server and scanned as a QR; but no TLS on the sync channel.
- Recommendations: Optional over `https` for the sync endpoint; at minimum, enforce non-`localhost` IPs, and document the token's exposure on shared Wi-Fi.

**No integrity verification of the downloaded on-device AI model.**
- Trigger: `isModelDownloaded()` treats a file as valid based only on the total bytes (`size < 450_000_000`), and the download URL is a mutable `resolve/main` branch pointer on HuggingFace.
- Files: `src/utils/aiService.js` (lines 14-16, 33-46)
- Current mitigation: size-based corruption detection only.
- Recommendations: Pin the model to a specific commit/tag and verify a SHA-256 checksum after download before loading.

**Extensive defensive `console.*` logging left enabled.**
- Trigger: Over 100 `console.log/warn` callsites across `src/` (especially `App.js`, `*.js` utils, widget handler); emojis logs indicate debug logging intended for dev retained in the production bundle.
- Files: `App.js` (lines 76,148,212,433,702,708,752,769,784,792,848,881,889,909,1243), `src/utils/*.js`, `widgets/*`
- Current mitigation: none (retained everywhere).
- Recommendation: strip internationalized emoji-based debug logging from the production bundle, since the app is shipped as a release APK (via `eas.json`/release flow).

## Performance Bottlenecks/Potential Bottlenecks

**On-device LLM model is a 468MB download with heavy retry/resume state.**
- Problem: `downloadModel` in `aiService.js` downloads a 468MB GGUF model with up to 10 retries (exponential backoff capped at 32s) and saves resumable state to `AsyncStorage` on every failed attempt; the loaded context is memory-hungry and `n_ctx` is tuned down to avoid OOM.
- Files: `src/utils/aiService.js` (lines 14-17, 88-119, 60-150, configured 180-205)
- Cause: `initLlama` uses `n_ctx: 2048` (reduced for stability) and runs CPU-only (`n_gpu_layers: 0`); a large model on mid-range phones is slow and memory-intensive.
- Improvement: keep `use_mlock: false` to avoid native OOM; the open AI context holds device memory — `unloadModel`/`releaseAllLlama` exists (`src/utils/aiService.js` line 207) but callers must remember to invoke it to free RAM.

## Fragile Areas & Risk Areas

**Notes/filesystem ops with sanitization + path concat.**
- Files: `src/utils/fileStorage.js` (saveNote, deleteNote, scan), `src/utils/vaultService.js`
- Why fragile: Note titles are sanitized with a regex that replaces spaces and template-dangerous characters then appends them onto file paths; if a vault, folder, or title becomes empty or the sanitizer changes, files land in unexpected paths or collide across vaults.
- Safe change: keep the sanitizer shared/consistent; test for empty-title/unusual-char/null-byte cases.

**`aiService` global mutable module state + busy-wait mutex.**
- Files: `src/utils/aiService.js` (lines 21-23, 158-172, 262-263, 380)
- Why fragile: `_llamaContext` single-instance plus a `while (_isInitializing) { await sleep(100) }` spin loop to serialize init; any call that rejects resets the context to `null`, forcing reload on next call (expensive, ~seconds). Concurrent request storm could defeat the mutex.
- Safe change: replace the busy loop with a promise-chain mutex; make reload requests coalesce with a single in-flight `init`.

**Birthday/notification scheduling offset logic.**
- Files: `src/utils/notifications.js` (lines 117-182)
- Why fragile: `scheduleCustomBirthdayReminders` schedules for "this year and next year" and skips past dates only with `< today`, and uses `getMonth()`-based rollover checks to fix Feb rollover manually; if `birthDate` format comes in different shape, month/day indices are inferred from `parts.length`.
- Test coverage: **Gap** — this scheduling path has no tests.

## Scaling Limits

**AsyncStorage is the persistence layer for all structured data.**
- Current capacity: all tasks, lists, birthdays, billing, settings, and a serialized `timerState` are stored as a single JSON string under `kwestup_data_v7.0` plus `kwestup_billing_*` keys.
- Files: `src/utils/storage.js` (key layout/`isUserDataKey`), `App.js` (load/save), `src/utils/billingStorage.js`
- Scaling path: for small personal use it is fine, but it has no schema migration granularity beyond the coarse `STORAGE_VERSION`; large note vaults are stored on disk via `src/utils/fileStorage.js`, but heavy task/billing data growth risks a single large AsyncStorage payload.

## Dependencies at Risk

**`llama.rn` (v0.12.4) — large on-device AI native module.**
- Risk: RN 0.79.5 / Expo 53 compatibility requires a manual postinstall patch of its `build.gradle`; the app forces old-arch behavior via the `patch-llama-gradle.js` regex.
- Impact: any library bump can break on-device AI (build failure or native model crash).
- Migration: pin `llama.rn` to a tight minor range; add a CI check that asserts the postinstall patch was applied.

- `react-native-android-widget` (^0.16.1) — also patched via the same postinstall script (sizing fallback in `RNWidgetUtil.java`, `patch-llama-gradle.js` lines 41-94). Bump requires re-checking patches.

## Test Coverage Gaps

**Wire-up + runner gaps.**
- No `test` script in `package.json`; no Jest config file. Test file exists at `__tests__/phase12-widget-logic.test.js` but is a standalone console-assertion script, not integrated with a runner or CI.
- Impact: The migration/scheduling/recurrence/notification logic has no automated regression protection.

**Untested high-risk paths (priority Med).**
- Note add/delete/sanitizer operations → `src/utils/fileStorage.js`, `vaultService.js`.
- Birthday notification scheduling → `src/utils/notifications.js` (day/Feb-29/advance).
- On-device AI `parseGlobalCommand` fallback regex → `src/utils/aiService.js` (lines 397-477).
- Backup encrypt/decrypt roundtrip → `src/utils/exportService.js`.
- Full `NotesScreen.js`/`SettingsScreen.js`/`AIAssistant.js` interactivity → no unit/component/integration tests at all regardless of the many `setTimeout`/debounce/edit flows.

---

*Mapping date: 2026-08-06.*