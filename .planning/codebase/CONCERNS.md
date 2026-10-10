# Codebase Concerns

**Analysis Date:** 2026-10-10

## Tech Debt

**God files (oversized modules):**
- Issue: Five modules exceed 1,000 lines and mix UI, business logic, I/O, and styles in one file. They are hard to review, test, and modify without regressions.
- Files: `src/screens/NotesScreen.js` (2013 lines), `src/screens/SettingsScreen.js` (1101 lines), `src/components/AIAssistant.js` (1096 lines), `App.js` (1071 lines), `src/utils/aiService.js` (1064 lines)
- Impact: Slow onboarding; a change in one concern (e.g. note file I/O) risks breaking unrelated UI in the same file; test setup for these files is expensive.
- Fix approach: Extract by concern — e.g. split `src/screens/NotesScreen.js` into screen + `useNotesFilesystem` hook + `noteFileOps` helper; split `src/screens/SettingsScreen.js` into update-check, model-download, and archive-modal subcomponents; split `App.js` boot/load/sync logic into `src/utils/appBoot.js`. Do one file per phase with characterization tests first.

**Non-cryptographic ID generation:**
- Issue: Entity IDs use `Date.now().toString() + Math.random().toString(36).slice(2)` — not UUID, not monotonic-safe, collision-prone under rapid creation or identical timestamps.
- Files: `src/utils/taskMutations.js:54`, `src/screens/NotesScreen.js:1261`
- Impact: Duplicate task/note IDs cause React key collisions, wrong-item edits/deletes, and sync merge ambiguity against the PC server.
- Fix approach: Add a single `generateId()` helper in `src/utils/dateUtils.js` (or new `src/utils/ids.js`) using `CryptoJS.lib.WordArray.random` or `expo-crypto`, and replace both call sites plus any future creators.

**Silent empty catch blocks:**
- Issue: Bare `catch {}` swallows filesystem errors with no log, no breadcrumb, no user signal.
- Files: `src/screens/SettingsScreen.js:188`, `src/screens/SettingsScreen.js:207` (model-size probe after download/check)
- Impact: Model-size UI silently shows stale/null values; real disk failures are invisible in forensics.
- Fix approach: Replace with `catch (err) { logger.debug(...); }` using `src/utils/logger.js`. Enforce with an ESLint `no-empty` error rule.

**Logger bypass via raw console calls:**
- Issue: ~20 direct `console.error` / `console.warn` / `console.log` calls bypass the redacting, buffering `src/utils/logger.js` engine, so PII redaction and crash-forensics breadcrumbs are skipped.
- Files: `src/context/VaultContext.js:48,60,62,73`, `src/context/BillingContext.js:40,51,61,71,81,91,101`, `src/screens/SettingsScreen.js:106,134`, `src/screens/NotesScreen.js:743`, `src/navigation/AppNavigator.js:125,387`
- Impact: Vault names, billing payloads, and tokens may land verbatim in native logs; crash reports miss these events entirely.
- Fix approach: Replace every raw `console.*` with `logger.warn/error/info` from `src/utils/logger.js`. Then escalate `no-console` from `warn` to `error` in `eslint.config.js:46` (currently deliberately `warn` per the WR-09 comment).

**Suppressed exhaustive-deps warnings:**
- Issue: `react-hooks/exhaustive-deps` is silenced inline instead of fixing the dependency list.
- Files: `src/screens/DashboardScreen.js:116,133`
- Impact: Stale-closure bugs (dashboard shows outdated tasks/birthdays) with no lint signal.
- Fix approach: Include the missing deps or extract the effect body into a `useCallback` with an explicit dep array; remove both `eslint-disable-next-line` comments.

**Plaintext AsyncStorage as system of record:**
- Issue: All tasks, billing, theme, telemetry opt-in, and vault metadata live unencrypted in `AsyncStorage` under `kwestup_*` keys.
- Files: `src/utils/storage.js`, `src/utils/billingStorage.js`, `src/context/TaskContext.js:76-92`, `src/services/notificationService.ts:153-184`
- Impact: Any app with device file access (rooted device, backup extraction) reads full user data. Export encryption (`src/utils/exportService.js`) protects only the archive, not data at rest.
- Fix approach: Migrate genuinely sensitive keys to `expo-secure-store`, or add an at-rest encryption layer for the `kwestup_data_*` blob. At minimum document the threat model in `README.md`.

**Legacy v1 backup decryption path with static salt:**
- Issue: `decryptBackup` falls back to a hardcoded salt (`4b77657374557053616c745f7632`) with only 1,000 PBKDF2 iterations for old archives.
- Files: `src/utils/exportService.js:84-92`
- Impact: Old archives are far easier to brute-force; the static salt defeats per-archive uniqueness. Kept for backward compat but never re-encrypts on import.
- Fix approach: On successful v1 import in `importArchive` (`src/utils/exportService.js:279-385`), immediately re-export (or flag) via the v2 envelope (random salt/IV, 100,000 iterations). Log a deprecation warning and schedule v1 removal.

**Destructive import with no rollback:**
- Issue: `importArchive` does `multiRemove` of all user keys (`src/utils/exportService.js:310-315`) *before* restoring storage and vault files, with no pre-import snapshot or transactional restore.
- Files: `src/utils/exportService.js:309-324`
- Impact: A crash, validation failure after wipe, or disk-full during vault restore causes permanent data loss. The payload check (`!payload?.metadata || !payload?.storage`) happens before wipe, but per-note write failures after wipe do not roll back.
- Fix approach: Snapshot current `collectAsyncStorageData()` + vault list to a temp rollback archive before wiping; on any post-wipe throw, restore the snapshot. Alternatively write to staging keys and swap.

**Documented TaskContext persistence race window:**
- Issue: The code itself documents a residual race: a mutation <500 ms before a foreground storage refresh can be overwritten by the storage read; no per-task `updatedAt` merge exists.
- Files: `src/context/TaskContext.js:63-126` (debounced 500 ms write-through + `refreshTasksFromStorage`)
- Impact: Rapid background→foreground transitions or widget writes can silently drop the newest task edit.
- Fix approach: Add per-entity `updatedAt` last-writer-wins merge in `refreshTasksFromStorage` (`src/context/TaskContext.js:129-171`) instead of whole-array `JSON.stringify` replacement.

**Full-snapshot JSON comparison on every keystroke:**
- Issue: Every `tasks`/`taskLists`/`dailyTasks` change serializes the entire snapshot twice (`JSON.stringify` for change detection) and re-reads + re-parses the whole AsyncStorage blob on write.
- Files: `src/context/TaskContext.js:94-126`
- Impact: O(n) stringify on each toggle/keystroke; jank grows linearly with task count; read-modify-write amplifies I/O.
- Fix approach: Hash or version-counter dirty check; persist only the changed domain slice instead of the merged blob.

**Lenient semgrep/CI gates:**
- Issue: `.semgrepignore` contains a stray `UI Design plan` entry; `eslint.config.js` keeps `no-console` at `warn`; `jest.config.js` has no `coverageThreshold`; `.npmrc` sets `legacy-peer-deps=true`.
- Files: `.semgrepignore`, `eslint.config.js:43-46`, `jest.config.js`, `.npmrc`
- Impact: Security scanning skips unknown paths; console bypasses never fail CI; coverage can regress silently (~28% lines today); peer-dependency conflicts (the exact `ERESOLVE` just fixed in `4b82fba`) are masked rather than resolved.
- Fix approach: Clean `.semgrepignore` to real paths; escalate `no-console` to `error` after the logger migration; add a realistic coverage floor (e.g. 25% now, ratcheting to 70%) in `jest.config.js`; schedule removal of `legacy-peer-deps=true` once the Expo 57 / RN 0.86 peer set is clean.

## Known Bugs

**QR manual-entry validation is weaker than sync validation:**
- Symptoms: Manual IP entry accepts anything matching `/^(\d{1,3}\.){3}\d{1,3}$/` plus `localhost`, without octet-range checks (e.g. `999.999.999.999` passes the form) — then fails later inside `validateSyncConfig` with a confusing error.
- Files: `src/components/QRScannerModal.js:78-84` vs `src/utils/syncService.js:45-60`
- Trigger: Settings → sync → manual entry → type an out-of-range IP → submit.
- Workaround: Scan the QR code instead of manual entry, or type a valid LAN IPv4 address.
- Fix approach: Reuse `validateSyncConfig` from `src/utils/syncService.js` inside `handleManualSubmit` and surface its error string in `formError`.

**Monthly recurrence overflows short months:**
- Symptoms: A task due Jan 31 recurring `monthly` via `date.setMonth(date.getMonth() + 1)` lands on Mar 2/3 instead of Feb 28, because JS `Date` overflows.
- Files: `src/utils/taskMutations.js:35-36`
- Trigger: Create a monthly recurring task due on the 29th–31st, complete it, inspect the spawned occurrence.
- Workaround: None in-app; edit the spawned due date manually.
- Fix approach: Clamp to end-of-month in `calculateNextRecurrence` (compute target month, then `Math.min(day, daysInTargetMonth)`).

**Progressive recurrence title numbering is naive:**
- Symptoms: `newTitle += " - 2"` when no trailing number exists, and only the *last* digit run increments — titles like `Sprint 1 review 3` become `Sprint 1 review 4` (arguably wrong scope), and repeated completions of unnumbered tasks produce `Task - 2` every time rather than incrementing.
- Files: `src/utils/taskMutations.js:37-50`
- Trigger: Complete a `progressive` task twice and compare spawned titles.
- Workaround: Rename spawned tasks manually.
- Fix approach: Track an explicit recurrence counter on the task object instead of parsing the title; fall back to title parsing only for legacy tasks.

**`validateSyncPayload` mutates its input:**
- Symptoms: The validator assigns `data.taskLists = []` onto the caller's object instead of returning a copy, so callers holding the raw server response see it silently modified.
- Files: `src/utils/syncService.js:97-100`
- Trigger: Any `/sync` response lacking `taskLists`; subsequent retry/logging logic sees the mutated shape.
- Workaround: None needed for correctness today, but fragile for future middleware.
- Fix approach: Return `{ ...data, taskLists: Array.isArray(data.taskLists) ? data.taskLists : [] }`.

**Stale default-list guard in TaskContext:**
- Symptoms: The `initialTaskLists !== DEFAULT_TASK_LISTS` reference check (`src/context/TaskContext.js:52`) means a legitimately re-created but equal-by-value list array is ignored, leaving stale lists visible.
- Files: `src/context/TaskContext.js:51-55`
- Trigger: Boot or sync path that passes a fresh `[{id:"default_inbox",...}]` array that is `!==` by reference yet semantically current — or conversely a same-reference stale array that skips the update.
- Workaround: Restart the app to force re-hydration.
- Fix approach: Compare by value (length + ids) rather than reference identity.

**APK self-update has no integrity verification:**
- Symptoms: `handleDownloadAndInstallUpdate` downloads whatever bytes the URL returns (status 200 check only), saves to cache, and hands to the share sheet — no SHA, no signature, no size check against the release asset metadata.
- Files: `src/screens/SettingsScreen.js:48-112`, `src/utils/diagnostics.js:62-106`
- Trigger: Successful update check with `apkUrl` set; a MITM or compromised release asset yields arbitrary APK install prompt.
- Workaround: Download from the GitHub release page manually and verify.
- Fix approach: Compare `downloadResult` size/asset metadata from the GitHub API response and, when available, a published checksum before invoking `Sharing.shareAsync`.

## Security Considerations

**Cleartext HTTP LAN sync:**
- Risk: Full notes/tasks/birthdays payload plus bearer token travel over unauthenticated `http://<ip>:<port>/sync` on the LAN. Any network observer captures everything.
- Files: `src/utils/syncService.js:110,137,164-172`
- Current mitigation: Strict `validateSyncConfig` (IP/hostname allowlist, port bounds, ≥6-char token) and `Authorization: Bearer` header; `validateSyncPayload` prevents note-wipe shapes.
- Recommendations: Add optional HTTPS/TLS with certificate pinning or at minimum document "trusted LAN only"; rotate the token per session; never log the token (verify `logger` redaction covers `Authorization` values passed as details).

**Sync token lifetime and storage:**
- Risk: The QR-scanned token (`src/components/QRScannerModal.js:38-91`) is held in app state and sent per sync with no evident expiry, rotation, or secure storage.
- Files: `src/components/QRScannerModal.js`, `src/utils/syncService.js:169`
- Current mitigation: Minimum-length check (`src/utils/syncService.js:67`); QR payload schema check.
- Recommendations: Store the token in `expo-secure-store`, add inactivity expiry, and provide a "forget PC" action that wipes it.

**Unencrypted notes on filesystem:**
- Risk: Vault markdown is stored as plaintext `.md` under `FileSystem.documentDirectory/Notes/Vaults/` — readable from device backups and file managers.
- Files: `src/utils/fileStorage.js`, `src/utils/vaultService.js`
- Current mitigation: App sandboxing only.
- Recommendations: Offer per-vault encryption (reuse the `exportService` AES-256 envelope primitives) for sensitive vaults; document the plaintext model.

**Export temp file in shared cache:**
- Risk: `exportArchive` writes the *encrypted* archive to `FileSystem.cacheDirectory` (`src/utils/exportService.js:210,241`) and relies on a `finally` cleanup (`src/utils/exportService.js:257-268`). A crash between write and share/delete leaves the archive in cache.
- Files: `src/utils/exportService.js:209-269`
- Current mitigation: `finally`-block deletion with `idempotent: true`; payload itself is AES-256.
- Recommendations: Verify no cache-backup agent uploads `cacheDirectory`; wipe stale `kwestup-backup.kwestup` files on boot.

**Passphrase handling in memory:**
- Risk: Export/import passphrases live in `SettingsScreen` state (`exportPassphrase`, `confirmPassphrase`, `importPassphrase` at `src/screens/SettingsScreen.js:165-167`) and are passed as plain strings through `encryptBackup`/`decryptBackup`; no zeroing, and the passphrase key itself is in the logger redaction list but the raw envelope error paths log adjacent objects.
- Files: `src/screens/SettingsScreen.js:161-172`, `src/utils/exportService.js:21-47`
- Current mitigation: `SENSITIVE_KEYS` redaction in `src/utils/logger.js:37-38` covers `passphrase`.
- Recommendations: Clear passphrase state immediately after use (`setExportPassphrase("")` etc. are present — verify all exit paths including errors); never include passphrase-adjacent objects in log details.

**Diagnostics and telemetry endpoints:**
- Risk: `runNetworkDiagnostics` probes `https://httpbin.org/json` (now dev-gated, but still hardcoded); `checkForUpdates` hits the GitHub API unauthenticated (rate-limit observable fingerprint); `sendTelemetryEvent` POSTs to `https://api.kwestup.com/telemetry` gated only by a string flag in AsyncStorage.
- Files: `src/utils/diagnostics.js:13-42,62-106,127-149`
- Current mitigation: Dev-only guards (`isDiagnosticsEnabled` + `__DEV__` gates in `App.js` callers); telemetry requires explicit `kwestup_telemetry_optin === "true"`.
- Recommendations: Remove or make the httpbin probe configurable; pin the telemetry domain expectation in docs; confirm the opt-in toggle in `src/screens/SettingsScreen.js` (`telemetryEnabled`) is the sole writer of the flag.

**Import path traversal surface:**
- Risk: `importArchive` reconstructs `folder`/`title` strings from the archive into filesystem paths (`${vaultPath}${folder}/`, `${folderPath}${title}.md` at `src/utils/exportService.js:344-356`) with no sanitization — a malicious `.kwestup` file could write outside the vault via `../`.
- Files: `src/utils/exportService.js:342-359`, `src/utils/vaultImport.js:76-93`
- Current mitigation: Archives are passphrase-encrypted (attacker needs the passphrase), and `vaultImport` caps file count/size.
- Recommendations: Sanitize `folder`/`title` (strip `/`, `\`, `..`, null bytes) before path join; reject entries escaping `vaultPath`.

## Performance Bottlenecks

**Vault export walks the filesystem serially-then-parallel:**
- Problem: `packVaults` awaits `getInfoAsync` per item sequentially, then fans out unbounded `Promise.all` reads per folder with no concurrency cap and no progress granularity for large vaults.
- Files: `src/utils/exportService.js:105-179`
- Cause: Correctness-first implementation; no batching or backpressure.
- Improvement path: Cap concurrency (e.g. p-limit 8), stream notes into the payload, and report per-vault progress via the existing `onProgress` callback.

**PBKDF2 100k iterations on the JS thread:**
- Problem: `encryptBackup`/`decryptBackup` run 100,000-iteration PBKDF2-HMAC-SHA256 synchronously on the JS thread; large vaults add big `JSON.stringify` on top.
- Files: `src/utils/exportService.js:27-31,71-75`
- Cause: `crypto-js` is pure JS with no native offload.
- Improvement path: Move encrypt/decrypt into a background path (e.g. `expo-crypto` digest or a native module / worker) and chunk payload serialization; show determinate progress during the KDF phase.

**468 MB on-device model lifecycle:**
- Problem: The Qwen2.5-0.5B GGUF (~491 MB, `MODEL_EXPECTED_SIZE` in `src/utils/aiService.js:26`) downloads, SHA-verifies by streaming base64 chunks, and loads via `llama.rn` — heavy on storage, memory, and battery; idle-unload (5 min) and background-unload help but any inference spikes RSS.
- Files: `src/utils/aiService.js`, `src/screens/SettingsScreen.js:174-230`
- Cause: Full-weight local inference is inherently heavy on mobile.
- Improvement path: Keep the AppState auto-unload (`subscribeAppState` in `src/utils/aiService.js:84-114`); add low-memory warnings, download-on-WiFi-only guard, and surface `getModelContextStatus()` in Settings before inference attempts.

**NotesScreen re-reads the whole vault on routine ops:**
- Problem: Note create/save/delete paths re-enumerate and re-read vault files; with hundreds of notes this is O(vault) per keystroke-save.
- Files: `src/screens/NotesScreen.js`, `src/utils/fileStorage.js:169-230`
- Cause: Filesystem is the source of truth with no index/cache layer.
- Improvement path: Maintain an in-memory note index (title → mtime/size) refreshed incrementally; debounce saves; virtualize the note list.

## Fragile Areas

**App.js boot orchestration:**
- Files: `App.js` (1071 lines: font loading, migration, vault init, billing load, diagnostics, sync, widget registration, timer state)
- Why fragile: Single component owns boot ordering for storage migration (`migrateUserDataIfNeeded`), vault migration (`migrateToVaultSystem`), cache clearing, and provider nesting. A thrown error in any step can leave the app on a spinner or half-migrated state. `FORCE_CLEAR_ALL_STORAGE = false` (`App.js:65`) is a footgun if ever flipped in a release.
- Safe modification: Add changes behind the existing phase-plan pattern (research → validation → execution plans in `.planning/`); never reorder migration before backup; keep `FORCE_CLEAR_ALL_STORAGE` false and consider deleting the flag.
- Test coverage: Boot path has no dedicated test; only `taskContext.test.js` and `storageMigration.test.js` cover fragments.

**Storage migration version sorting:**
- Files: `src/utils/storage.js:90-137` (semver-ish sort of `kwestup_data_v*`), `src/utils/storage.js:140-179` (lexicographic `.sort()` for vault/billing keys)
- Why fragile: Data keys use numeric-segment sort but vault/billing keys use plain string sort — `v10` sorts before `v9` lexicographically, migrating from the wrong "highest" version. Cross-key version skew (data at v7, billing at v5) is silently papered over.
- Safe modification: Reuse the numeric `versionPattern` comparator for all three key families; add a migration test with v9/v10 fixtures in `__tests__/unit/storageMigration.test.js`.
- Test coverage: Partial (`storageMigration.test.js` exists but does not cover the v9-vs-v10 lexicographic case).

**Sync handshake (LAN REST):**
- Files: `src/utils/syncService.js`, `src/components/QRScannerModal.js`, `App.js` (`handleExecuteSync` path)
- Why fragile: Hardcoded `http`, 3 s ping / 10 s sync timeouts, no retry, no schema versioning on the payload beyond array-presence checks. A slow vault transfer trips `AbortError` with a generic message.
- Safe modification: Keep `validateSyncConfig`/`validateSyncPayload` as the contract seam; add payload `version` negotiation before changing shape; test timeout and 401/403 paths (already partially in `__tests__/unit/syncService.test.js`).
- Test coverage: Good for validation/ping; end-to-end sync against a real PC server is untested.

**Notification rescheduling on import/delete-list:**
- Files: `src/utils/exportService.js:368-384`, `src/context/TaskContext.js:306-338`, `src/services/notificationService.ts`
- Why fragile: Import cancels foreign notification IDs (safe-ignored) then reschedules per bill — a failure mid-loop leaves half the bills rescheduled and half stale. Deleting a task list cancels notifications in a `forEach` without awaiting, so failures are silent.
- Safe modification: Collect reschedule results and only `saveBillingData` after all succeed; await cancellations and log failures via `logger`.
- Test coverage: `notificationService.test.ts` covers the service; the import-reschedule loop and delete-list fan-out have no tests.

**Billing + theming context sprawl:**
- Files: `src/context/BillingContext.js`, `src/context/VaultContext.js`, `src/context/BirthdayContext.js`, `src/screens/BillingScreen.js` (823 lines)
- Why fragile: Each context does direct `console.error` + `AsyncStorage` I/O with no shared data-layer; `BillingScreen` mixes transaction, budget, and recurring-bill UIs.
- Safe modification: Route new billing/vault reads through the existing `billingStorage`/`vaultService` helpers; mirror the `TaskContext` write-through pattern rather than adding ad-hoc `setItem` calls.
- Test coverage: None for the three contexts; only `taskContext.test.js` exists.

## Scaling Limits

**Single-blob AsyncStorage record:**
- Current capacity: Entire task state (tasks + lists + daily) lives in one `kwestup_data_v7.0` JSON value; billing in one `kwestup_billing_*` value.
- Limit: AsyncStorage values degrade past ~1–2 MB (slow parse, ANR risk on low-end Android); a multi-thousand-task vault makes every boot parse and every TaskContext write a multi-MB stringify.
- Scaling path: Shard tasks by list or paginate; store only metadata in AsyncStorage and bodies on filesystem (the vault pattern already proves this works).

**Forensics ring-buffer (50 entries):**
- Current capacity: `MAX_LOG_BUFFER_SIZE = 50` (`src/utils/logger.js:13`).
- Limit: High-churn sessions (sync + export + AI inference) evict the earliest breadcrumbs before a crash report is copied.
- Scaling path: Raise to 200 with the existing truncation caps, or spill WARN+ to a bounded on-disk log rotated daily.

**Notification history prune window:**
- Current capacity: 48-hour history in AsyncStorage (`src/services/notificationService.ts:148-168`).
- Limit: Fine today; recurring-bill reschedule storms (import path) can bloat the key transiently.
- Scaling path: Cap entry count in addition to age; batch writes during import rescheduling.

**Filesystem note count:**
- Current capacity: One `.md` file per note, enumerated via `readDirectoryAsync` per folder on every pack/list.
- Limit: Thousands of notes → directory enumeration latency and `packVaults` fan-out pressure (see Performance).
- Scaling path: Index file + incremental refresh; archive/cold-storage vault tier.

## Dependencies at Risk

**llama.rn 0.12.4 (native, pinned):**
- Risk: Native module tied to the Expo 57 / RN 0.86 NDK/Gradle set; the repo already carries a `patch-llama-gradle.js` postinstall shim — upgrades to Expo/RN will break the native build until the patch is revised.
- Impact: AI features fail to build; `postinstall` patch silently diverges from upstream.
- Migration plan: Track `llama.rn` releases against the Expo SDK; gate SDK bumps on a clean `expo run:android` with the model path present; consider making AI an optional build flavor.

**Expo ~57 + React Native 0.86 + React 19.2.3 (bleeding edge):**
- Risk: Very new major set; third-party libs (`react-native-paper` 5.x, `react-native-reanimated` 3.x, `react-navigation/drawer` 6.x) lag behind and required `legacy-peer-deps=true` to install (see `4b82fba`).
- Impact: Subtle runtime incompatibilities (gesture handler, screens, safe-area) surface only on device.
- Migration plan: Keep the `.npmrc` workaround but re-attempt `npm install` without it each dependency bump; run the full jest suite plus on-device smoke (notes, tasks, billing, sync, AI) before any Expo upgrade.

**react-native-android-widget ^0.16.1:**
- Risk: Niche native widget bridge with a small maintainer base; widget handler (`widgets/`) duplicates task-mutation logic via the shared `src/utils/taskMutations.js` engine — drift risk if the headless handler imports diverge.
- Impact: Widget shows stale tasks or crashes the host on OS updates.
- Migration plan: Keep all widget logic funneled through `src/utils/taskMutations.js` (already the design); cover the handler with `__tests__/phase12-widget-logic.test.js` (exists — extend on every mutation-engine change).

**crypto-js ^4.2.0 (pure JS crypto):**
- Risk: Unmaintained-adjacent pure-JS AES/PBKDF2; slow (see Performance) and harder to audit than platform crypto.
- Impact: Export/import jank on large vaults; no hardware acceleration.
- Migration plan: Evaluate `expo-crypto` for hashing and a native AES-GCM module for the envelope; keep the v2 envelope field (`kdf`, `iterations`) so a future KDF can be negotiated.

**jest-expo ~57 + jest 29 (test infra):**
- Risk: `transformIgnorePatterns` allowlist in `jest.config.js` must be hand-maintained per native lib; each new native dep needs an entry or tests fail to transform.
- Impact: Silent test breakage on dependency add.
- Migration plan: When adding a native dep, update `transformIgnorePatterns` in the same commit and run `npm test` before pushing.

## Missing Critical Features

**No at-rest encryption option:**
- Problem: Beyond the export archive, nothing is encrypted — AsyncStorage blobs, vault markdown, notification history, and cache temp files are all plaintext.
- Blocks: Any "private vault" / compliance story; safe device backups.

**No backup integrity verification or rollback:**
- Problem: `importArchive` trusts the decrypted payload shape (`metadata` + `storage` presence only) with no checksum, no schema version gate, and no pre-restore snapshot.
- Blocks: Safe restore; cross-version restores are trial-and-error.

**No crash reporting pipeline:**
- Problem: Forensics end at the in-memory ring-buffer (`getRecentLogs`) plus manual copy-paste diagnostics; no Sentry/Crashlytics sink.
- Blocks: Learning about production crashes at all — release builds silence debug/info and keep only warn/error in RAM, which vanish on process death.

**No E2E or device-farm coverage:**
- Problem: No Detox/Maestro/EAS-device tests; sync, widgets, notifications, APK update, and AI inference are all manual on-device.
- Blocks: Confidence in the exact paths (LAN sync, import wipe-then-restore, widget refresh) most likely to cause data loss.

**No TLS option for LAN sync:**
- Problem: Sync is HTTP-only with a static bearer token.
- Blocks: Use on untrusted networks; any shared-WiFi deployment story.

## Test Coverage Gaps

**Overall (low enforcement):**
- What's not tested: Enforced floor is zero — `jest.config.js` explicitly documents ~28% lines / ~17% functions with no `coverageThreshold`, so regressions merge green.
- Files: `jest.config.js` (CR-09 comment), all files below
- Risk: Coverage silently decays as features land.
- Priority: High — add a ratcheting threshold (start at current reality, raise per milestone toward the documented 70/90/95 targets).

**Untested screens (the bulk of user behavior):**
- What's not tested: Note CRUD + filesystem round-trip through the real screen, billing flows (transactions/budgets/recurring bills), dashboard aggregation, settings update/archive flows, search, focus timer.
- Files: `src/screens/NotesScreen.js`, `src/screens/BillingScreen.js`, `src/screens/SettingsScreen.js`, `src/screens/DashboardScreen.js`, `src/screens/TaskListScreen.js`, `src/screens/SearchScreen.js`, `src/screens/FocusTimerScreen.js`, `src/screens/BirthdaysScreen.js`, `src/screens/DailyTasksScreen.js`
- Risk: The highest-line-count, highest-churn files have zero automated coverage; regressions found only by manual testing.
- Priority: High — start with `BillingScreen` calc logic and `NotesScreen` file-op helpers (extract first, then test the extractions).

**Untested contexts:**
- What's not tested: Vault, billing, and birthday providers (load/switch/refresh/add/delete paths, all with direct I/O + raw console errors).
- Files: `src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`
- Risk: Silent data-loss bugs in load/refresh paths go undetected.
- Priority: High — cover load-failure and switch-vault paths first.

**Untested navigation and theming:**
- What's not tested: Drawer/task-creation wiring (`onTaskCreated` / `onTasksExtracted` fallbacks), theme resolution, custom component library.
- Files: `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`, `src/components/Custom*.js`, `src/theme/colors.js`, `src/theme/styles.js`
- Risk: Medium — `AppNavigator.js:125,387` warns-and-drops tasks when `TaskContext` is unavailable; theme regressions are cosmetic but pervasive.
- Priority: Medium.

**Thinly tested critical paths:**
- What's not tested: Import-restore rollback (nonexistent), monthly/progressive recurrence edge cases, QR manual validation vs `validateSyncConfig` parity, APK download failure modes, telemetry opt-in gating, storage-migration v9-vs-v10 ordering.
- Files: `src/utils/exportService.js`, `src/utils/taskMutations.js`, `src/components/QRScannerModal.js`, `src/screens/SettingsScreen.js:48-112`, `src/utils/diagnostics.js:127-149`, `src/utils/storage.js:140-179`
- Risk: Each maps to a Known Bug or Security item above breaking unnoticed.
- Priority: Medium — add one regression test per bullet when fixing.

**Well-covered (do not regress):**
- `src/utils/taskMutations.js` (`taskMutations.test.js`), `src/utils/syncService.js` (`syncService.test.js`), `src/utils/logger.js` (`logger.test.js`), `src/utils/dateUtils.js` (`dateUtils.test.js`), `src/utils/aiService.js` (`aiService.test.js`), `src/services/notificationService.ts` (`notificationService.test.ts`), `src/utils/storage.js` migration (`storageMigration.test.js`), vault/file storage (`vaultAndFileStorage.test.js`), export/import (`exportImportService.test.js`), `src/components/ErrorBoundary.js` (`errorBoundary.test.js`).

---

*Concerns audit: 2026-10-10*
