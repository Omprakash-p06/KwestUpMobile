# Codebase Concerns

**Analysis Date:** 2026-10-12

## Tech Debt

**God-component screens (NotesScreen, SettingsScreen, AIAssistant):**
- Issue: Three of the largest files in the repo are single-component UI monoliths that mix state, filesystem I/O, vault management, AI calls, and rendering. `NotesScreen` (2013 lines) holds folder/tag filtering, vault switcher, rename/create/import modals, editor tabs, and selection state in one function component. `SettingsScreen` (1101 lines) mixes APK download, model management, backup/restore, theme, sync, and telemetry opt-in. `AIAssistant` (1096 lines) mixes summarize/extract/edit/quick-create flows plus modal UI.
- Files: `src/screens/NotesScreen.js`, `src/screens/SettingsScreen.js`, `src/components/AIAssistant.js`, `src/utils/aiService.js` (1064 lines), `src/theme/styles.js` (895 lines), `App.js` (1118 lines)
- Impact: Any change to notes/vault/AI risks regressions across unrelated sub-features; code review is slow; new contributors cannot safely extend one flow without reading the whole file.
- Fix approach: Extract one concern per phase — e.g. move vault-switcher state from `NotesScreen` into `src/context/VaultContext.js` consumers or a `useVaultSwitcher` hook; move backup/restore out of `SettingsScreen` into `src/utils/exportService.js` callers with a dedicated `BackupSection` component; split `AIAssistant` into per-action hooks. No behavior change, just file moves with existing tests as guard.

**Collision-prone ID generation via `Date.now()`:**
- Issue: Entity IDs are generated with `Date.now().toString()` (sometimes plus `Math.random()`) in at least six places. Two rapid creates within the same millisecond produce duplicate keys, and `Math.random()` is not a uniqueness source. The most recent commit (`3009152`) already had to fix a key collision in the weekly-review path — this is the same class of bug recurring.
- Files: `src/utils/taskMutations.js:54,169,246`, `src/context/BillingContext.js:49,123`, `src/context/BirthdayContext.js:40`, `src/utils/vaultService.js:78`, `src/navigation/AppNavigator.js:141,168`, `src/context/TaskContext.js:251`
- Impact: Duplicate React keys, AsyncStorage overwrites (one task silently replaces another), broken habit/billing references.
- Fix approach: Introduce a single `generateId()` helper in `src/utils/` (timestamp + monotonic counter + `Math.random().toString(36)` suffix, or `expo-crypto` random UUID) and replace all six call sites. Add a unit test asserting 10k rapid calls produce unique IDs.

**Dual-writer persistence with documented race window:**
- Issue: `TaskContext` persists tasks via debounced (500 ms) read-modify-write against the shared `kwestup_data_<VERSION>` AsyncStorage blob, while `App.js` still persists sibling domains (birthdays/notes/theme) to the same blob. The code comment in `src/context/TaskContext.js:64-72` explicitly documents the residual risk: a mutation made <500 ms before a foreground refresh can be overwritten by the storage read. `refreshTasksFromStorage` does wholesale `setTasks(parsed.tasks)` replacement with only a JSON-equality guard — no per-task `updatedAt` merge.
- Files: `src/context/TaskContext.js:77-172`, `App.js` (boot `loadData` / persistence effects)
- Impact: Intermittent silent task loss on fast app-switch or widget-triggered foreground sync; extremely hard to reproduce in QA.
- Fix approach: Add per-task `updatedAt` timestamps (already partially present via `completedDate`/`updatedAt`) and merge on refresh (newer wins per ID) instead of wholesale replace. Alternatively funnel ALL domain writes through one persistence module. The existing `__tests__/unit/taskContext.test.js` and `storageMigration.test.js` are the regression net.

**Destructive boot flag and wipe-then-restore import:**
- Issue: `App.js:69` carries `const FORCE_CLEAR_ALL_STORAGE = false;` — a one-line flip away from wiping all user data on next launch. Separately, `exportService` restore clears all existing AsyncStorage user keys (`multiRemove`) *before* writing the backup (`multiSet`); a crash/OOM between those two steps leaves the user with neither old nor new data.
- Files: `App.js:69`, `src/utils/exportService.js:309-322`
- Impact: Catastrophic data loss from an accidental commit (flag) or an interrupted restore (crash mid-import).
- Fix approach: Delete the `FORCE_CLEAR_ALL_STORAGE` flag entirely (use a dev-only menu if ever needed again). For restore: write the backup to a staging key first, verify parse, then swap — or at minimum keep the pre-restore blob in memory and re-write it on failure. Cover with `__tests__/unit/exportImportService.test.js` failure-injection cases.

**Legacy v1 backup decryption still accepted:**
- Issue: `decryptBackup` transparently falls back to a legacy v1 path with a hardcoded static salt (`4b77657374557053616c745f7632`) and only 1,000 PBKDF2 iterations. Modern v2 (random salt/IV, 100k iterations) is good, but keeping v1 readable forever preserves a weak-KDF downgrade path.
- Files: `src/utils/exportService.js:58-97` (fallback at lines 84-92)
- Impact: Old archives remain brute-forceable at ~100x lower cost; an attacker who obtains any v1 backup file benefits indefinitely.
- Fix approach: On successful v1 decrypt, immediately re-encrypt to v2 and prompt the user to delete the old file; log a deprecation warning; schedule v1-read removal for the next major version. Track migrated files in `__tests__/unit/exportImportService.test.js`.

**Suppressed lint rules hiding real issues:**
- Issue: `no-console` is demoted to `warn` (with a comment admitting ~100 pre-existing `console.*` statements), `DashboardScreen` carries two `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions, and `logger.js` itself starts with `/* eslint-disable no-console */`. `tsc --noEmit` and `eslint` currently pass, but only because the gates are lenient.
- Files: `eslint.config.js`, `jest.config.js` (coverage-gate comment), `src/screens/DashboardScreen.js:117,134`, `src/utils/logger.js:1`, `src/context/VaultContext.js:60`, `src/navigation/AppNavigator.js:127,396`
- Impact: Stale-closure bugs (the exact class `exhaustive-deps` catches) can hide in dashboard memoization; console noise leaks into production logs; CI stays green while hygiene decays.
- Fix approach: Triage consoles in batches (route through `src/utils/logger.js`, which already gates on `__DEV__`); fix the two `DashboardScreen` deps properly (`focusTick` pattern should be replaced with explicit invalidation or included correctly); then escalate `no-console` to `error` and add the deferred 70% coverage gate.

## Known Bugs

**QR manual-setup port accepts non-numeric input:**
- Symptoms: Typing a non-numeric port (e.g. "abc") in Manual PC Sync Setup passes the empty-check, then `parseInt("abc", 10)` yields `NaN`, which is forwarded to `onConnectionScanned` without validation at the form layer. Downstream `validateSyncConfig` in `src/utils/syncService.js:62-65` should reject it, but the user sees a generic sync failure instead of a form error.
- Files: `src/components/QRScannerModal.js:58-91` (missing `Number.isInteger` check on parsed port)
- Trigger: Open QR modal → Manual Setup → enter valid IP + "abc" port + any token → Establish Connection.
- Workaround: Enter a numeric port 1–65535.

**QR IP regex in modal is weaker than sync-service validation:**
- Symptoms: `QRScannerModal` validates IPs with `/^(\d{1,3}\.){3}\d{1,3}$/`, which accepts `999.999.999.999`, while `validateSyncConfig` in `src/utils/syncService.js:46` enforces strict octet ranges (0–255). A user can pass the form and then fail at connection time with a confusing error.
- Files: `src/components/QRScannerModal.js:79-83`, `src/utils/syncService.js:46-56`
- Trigger: Manual setup with IP `999.1.1.1` passes the form regex but fails strict validation later.
- Workaround: None needed for correctness (connection layer still rejects); fix is to reuse `validateSyncConfig` in the form.

**Global `alert()` used instead of `Alert.alert` in QR scanner:**
- Symptoms: `src/components/QRScannerModal.js:52` calls bare `alert(...)`, which is a web API and is inconsistent with every other screen that uses `Alert` from `react-native`. On some native builds this is a no-op or throws, leaving the user with no feedback after a bad scan (only haptic warning fires).
- Files: `src/components/QRScannerModal.js:52`
- Trigger: Scan any non-KwestUp QR code with the sync scanner on a native build.
- Workaround: The 3-second rescan timer still re-arms scanning.

**Birthday fallback sentinel `daysRemaining: 999` leaks into sort order:**
- Symptoms: Unparseable birthdays get `daysRemaining: 999` (`src/screens/DashboardScreen.js:71,75,79,90`). They sort after all real birthdays, which is intended, but the `upcomingBirthdays` filter (`<= 30`) silently drops them with no user-visible signal that a birthday record is malformed.
- Files: `src/screens/DashboardScreen.js:58-92,126-129`
- Trigger: Enter a birthday with an unexpected date format; it vanishes from the upcoming list instead of flagging an error.
- Workaround: Edit the birthday to `YYYY-MM-DD` format.

## Security Considerations

**All user data stored unencrypted at rest (AsyncStorage + plaintext markdown):**
- Risk: Tasks, habits, billing records, notes, and the LAN sync token live in plaintext — AsyncStorage JSON blob (`kwestup_data_<VERSION>`) plus vault `.md` files on the app filesystem. Anyone with device file access (rooted phone, backup extraction, shared device) reads everything, including financial data.
- Files: `src/utils/storage.js`, `src/utils/billingStorage.js`, `src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/exportService.js:181-194` (collector reads all keys)
- Current mitigation: Only the *exported backup file* is encrypted (AES-256 v2 envelope). On-device data has no encryption. No secrets are hardcoded (verified — no `.env`/credential reads in scope).
- Recommendations: Encrypt sensitive domains (billing, sync token) with `expo-secure-store`/`expo-crypto` instead of AsyncStorage; document the at-rest plaintext posture in the README so users give informed consent; never widen `collectAsyncStorageData` without an allowlist review.

**LAN sync is plaintext HTTP with bearer token in QR payload:**
- Risk: The PC sync channel (`src/utils/syncService.js`, `fetchWithTimeout` default 4 s) runs over the local network; the QR payload carries `{ip, port, token}` and the token is typed/shown in manual setup. LAN eavesdroppers or a malicious QR sticker can harvest the token and push/pull full user data (notes, tasks, birthdays) via the sync handshake.
- Files: `src/utils/syncService.js`, `src/components/QRScannerModal.js:38-56`
- Current mitigation: `validateSyncConfig` enforces token length ≥ 6, strict IP/port validation, and payload-shape checks (`validateSyncPayload`) that refuse malformed server responses to prevent note wipes. Good defense-in-depth at the parsing layer.
- Recommendations: Rotate the sync token per session and expire old ones; add a big-printed origin check (display the pairing code on the PC screen and require manual confirm on mobile); consider TLS or at minimum HMAC-sign sync payloads. Do not lengthen token lifetime.

**`crypto-js` PBKDF2 in JS thread; dependency maintenance risk:**
- Risk: Key derivation (100k PBKDF2-SHA256 iterations) runs in JavaScript via `crypto-js`, which is both slow on low-end Android (UI jank during encrypt/decrypt of large vaults) and a dependency with sparse maintenance. `npm outdated` shows the broader tree drifting (see Dependencies at Risk).
- Files: `src/utils/exportService.js:21-47`, `src/utils/aiService.js:117-178` (SHA-256 hashing via `crypto-js`)
- Current mitigation: 100k iterations + random salt/IV per archive is a sound parameter choice.
- Recommendations: Migrate KDF + AES to `expo-crypto` (native, maintained) when backup v3 is cut; keep the v2 reader for backward compatibility.

**Unbounded `JSON.parse` on untrusted inputs:**
- Risk: QR payloads, AI model outputs (`intentParser`, `frictionAnalyzer`), sandbox inputs (`aiSandbox`), imported vault files, and backup envelopes are all `JSON.parse`d. Most call sites are try/caught, but a deeply nested or very large payload can still cause stack/CPU exhaustion before validation runs. `eventBus` deep-clones via `JSON.parse(JSON.stringify(obj))`, which throws on circular structures and duplicates large payloads in memory.
- Files: `src/components/QRScannerModal.js:43`, `src/ai/intentParser.ts:151`, `src/ai/frictionAnalyzer.ts:328`, `src/commands/aiSandbox.ts:125`, `src/behavior/eventBus.ts:37`, `src/utils/exportService.js:62`
- Current mitigation: QR parse is inside try/catch with schema check (`ip/port/token`); sync payload has structural validation. No `eval()`/`Function()` constructor usage detected.
- Recommendations: Add size caps before parse (reject QR data > 2 KB, backup envelopes streamed rather than fully materialized); add a `safeParse` helper with depth/size limits shared by AI-output parsers; replace `eventBus` structured-clone with `structuredClone` where available.

## Performance Bottlenecks

**Recursive full-vault filesystem scan on notes load:**
- Problem: `getAllNotesFromFilesystem` walks every vault directory, stats every file (`getInfoAsync` per file), and reads every note into memory on each load. Vault listing, backup packing (`packVaults`), and notes boot all repeat these walks independently.
- Files: `src/utils/fileStorage.js:170-189`, `src/utils/exportService.js:105-135`, `src/utils/vaultService.js:185-217`
- Cause: No note index/cache — every screen mount re-enumerates the filesystem with N `getInfoAsync` + N `readAsStringAsync` calls.
- Improvement path: Maintain a lightweight note manifest (id → mtime/size) in AsyncStorage, refresh incrementally by mtime, and only re-read changed files. Paginate `NotesScreen` FlatList with `initialNumToRender`/`windowSize` tuning (currently renders full filtered arrays via `useMemo`).

**PBKDF2 100k iterations blocks the JS thread on large backups:**
- Problem: Encrypt/decrypt of a full-vault backup runs synchronously in JS; on low-end Android this freezes the UI for seconds with no progress feedback.
- Files: `src/utils/exportService.js:21-47,58-97`
- Cause: `crypto-js` is pure JS with no worker offload.
- Improvement path: Move KDF to a native module (`expo-crypto`), chunk large payloads, and show determinate progress in `SettingsScreen` during backup/restore.

**Dashboard recomputation and focus-tick re-renders:**
- Problem: `DashboardScreen` recomputes 7-day completion buckets, birthday enrichment (with per-item date parsing), and full task filtering on every focus event via the `focusTick` state bump, plus `useFocusEffect` forces a re-render on each navigation focus even when nothing changed.
- Files: `src/screens/DashboardScreen.js:25-56,109-136`
- Cause: `focusTick` in the `useMemo` dep array defeats memoization by design (with `exhaustive-deps` disabled to silence the warning).
- Improvement path: Subscribe to actual data changes (task/birthday context version counter) instead of focus ticks; memoize `enrichedBirthdays` by input hash; move `getDailyCompletions` off the render path for large task lists.

**HabitContext writes four AsyncStorage keys per mutation:**
- Problem: Every habit mutation serializes and writes four separate keys (`habits`, `identities`, `behaviorEvents`, `rewards`) with no batching beyond the caller, and boot performs four parallel reads plus four parses with individual fallbacks.
- Files: `src/context/HabitContext.js:72-74,145-148,222-225`
- Cause: One JSON blob per domain, fully rewritten on any change; behavior-event array grows unboundedly except for the in-memory bounding before write.
- Improvement path: Batch the four writes with `multiSet`; cap/prune `behaviorEvents` at the source (retention window) rather than only at write time; consider moving the event log out of AsyncStorage into a ring buffer file.

## Fragile Areas

**Boot/loadData orchestration in `App.js`:**
- Files: `App.js` (1118 lines; boot effects, migration, diagnostics, widget sync, deep-link handling)
- Why fragile: Single file owns font loading, storage migration (`migrateUserDataIfNeeded`, `migrateToVaultSystem`), five context providers, widget registration, notification scheduling, and telemetry gating. A failure in any boot step (e.g. vault migration throwing on a partially-migrated install) cascades to a blank/error screen for all domains.
- Safe modification: Change one boot step at a time; keep each step independently try/caught with fallback to empty state (the current pattern — preserve it); test with a pre-migration fixture (see `__tests__/unit/storageMigration.test.js`).
- Test coverage: Migration and storage paths have unit tests; the composed boot sequence itself has no integration test — a gap.

**Vault migration + filesystem layer (`vaultService` / `fileStorage`):**
- Files: `src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/vaultImport.js`, `src/utils/storage.js`
- Why fragile: Path construction from user-controlled vault/folder/note names (sanitization lives in `vaultImport` and `fileStorage.saveNoteFile` — verify every new write path goes through it); legacy-key fallbacks (`LEGACY_VAULTS_KEY`, `LEGACY_ACTIVE_KEY`) mean two code paths for every read; `deleteAsync(..., {idempotent: true})` vs non-idempotent deletes are mixed (`fileStorage.js:111` non-idempotent vs `:148` idempotent).
- Safe modification: Always normalize names through the existing sanitizer; never add a new storage key without a migration entry and a test in `vaultAndFileStorage.test.js`; prefer idempotent deletes.
- Test coverage: `__tests__/unit/vaultAndFileStorage.test.js` covers the main paths; legacy-fallback branches and import-collision renaming (`vaultImport.js:76-101`) are thin.

**Notification scheduling (`notificationService.ts` + billing reminders):**
- Problem: Scheduling mixes task due-date reminders, bill reminders, and habit nudges across `src/services/notificationService.ts` (767 lines, largest TS file) and `src/utils/billingNotifications.js`. Rescheduling on every task/bill edit without diffing leaves orphaned scheduled notifications; cancelled-task notifications depend on the caller remembering to call `cancelNotification`.
- Files: `src/services/notificationService.ts`, `src/utils/billingNotifications.js`, `src/utils/billingStorage.js`
- Safe modification: Centralize schedule/cancel behind one `resyncNotifications(state)` function that diffs desired vs scheduled IDs; test with `__tests__/unit/notificationService.test.ts`.
- Test coverage: Service-level tests exist; the cross-module "edit task → old reminder cancelled" flow is untested.

**AI download/resume state machine (`aiService.js`):**
- Files: `src/utils/aiService.js:208-384` (download, partial-file cleanup, resumable state in AsyncStorage, jittered retry with `Math.random() * 1000`)
- Why fragile: Partial-model cleanup (`deleteAsync` on failure paths) races with resume; saved resume state can go stale if the model file is deleted out-of-band (`SettingsScreen` model delete at lines 205-225); retry jitter is unseeded and untestable as written.
- Safe modification: Validate resume state against actual file info (`getInfoAsync` size/hash) before resuming; inject the RNG/clock for tests.
- Test coverage: `__tests__/unit/aiService.test.js` is a smoke-level suite; resume-after-partial-delete and checksum-mismatch paths are gaps.

## Scaling Limits

**Single AsyncStorage JSON blob per domain:**
- Current capacity: Fine for hundreds of tasks/notes (typical personal use; 358 tests pass on small fixtures).
- Limit: AsyncStorage values are stringified in full on every read/write — multi-MB blobs (thousands of tasks with subtasks, large behavior-event history, image-heavy notes are filesystem-side so less affected) cause multi-second boot parses and increase the TaskContext race window. `JSON.stringify` comparisons for change detection (`TaskContext.js:138-167`) are O(n) on every refresh.
- Scaling path: Versioned per-entity keys or SQLite (`expo-sqlite`) for tasks/habits/events; keep AsyncStorage for settings/theme only. Add a storage-size diagnostic to `src/utils/diagnostics.js` and warn past a threshold.

**Behavior-event log growth:**
- Current capacity: Bounded only at write time (`boundedEvents` in `HabitContext.js:224`).
- Limit: Long-term users accumulate events faster than the bound prunes if the app is rarely foregrounded long enough to trigger the write path; widget-driven completions append without pruning.
- Scaling path: Time-based retention (e.g. 90 days) enforced on read, not just write; aggregate old events into weekly summaries via the existing `behaviorCompiler`.

**Widget touchpoint recomputation:**
- Current capacity: `selectWidgetTouchpoint` runs on every habit change + app foreground with a 350 ms debounce (`App.js:84`).
- Limit: Cost grows with habit/event count; five widget types (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList`, `Habit`) each re-render independently.
- Scaling path: Memoize touchpoint selection by habit/events hash; throttle widget updates to foreground transitions only (already partially done — keep it).

## Dependencies at Risk

**Expo SDK 53 installed vs 57 wanted (major drift):**
- Risk: `npm outdated` shows the installed tree on Expo 53 (`expo 53.0.20`, `jest-expo 53.0.14`, `react-native 0.79.5`, `react 19.0.0`) while `package.json` wants `~57.0.0` / `0.86.0` / `19.2.3`. A fresh `npm install` jumps four SDK majors at once — high breakage risk (native modules, `llama.rn`, android widget bridge).
- Impact: New contributors get a different app than CI/dev machines; native build failures; `patch-llama-gradle.js` postinstall may not match the resolved native versions.
- Migration plan: Pin exact versions in `package.json` (remove `~`/`^` on Expo-family packages) to the verified set, commit the lockfile state, and schedule a deliberate SDK-57 upgrade as its own phase with a clean `node_modules` + `expo prebuild` verification. Do not drift-upgrade piecemeal.

**React Navigation v6 vs v7:**
- Risk: `@react-navigation/drawer`/`native` at v6 (`6.7.2`/`6.1.18`) with v7 latest (`7.14.3`/`7.5.0`). v7 changes drawer/screen APIs; staying on v6 is fine short-term but forfeits fixes.
- Impact: None today; upgrade cost grows the longer custom navigator code (`src/navigation/AppNavigator.js`, 406 lines) accrues v6-isms.
- Migration plan: Defer until after the Expo-57 upgrade; follow the official v6→v7 codemod in a dedicated phase.

**Jest 29 vs 30, `llama.rn` pre-release available:**
- Risk: `jest`/`babel-jest` 29.7.0 vs 30.x (snapshot format changes); `llama.rn 0.12.4` vs `0.13.0-rc.7` (native model ABI may shift — on-device AI depends on this exact build).
- Impact: Accidental `npm update` breaks the AI test suites or the model runtime.
- Migration plan: Pin `llama.rn` exactly (already pinned — keep it); do not adopt Jest 30 until `jest-expo` 57 support is verified post-SDK-upgrade.

## Missing Critical Features

**No crash reporting / error telemetry in production:**
- Problem: `diagnostics.js` has opt-in telemetry (`kwestup_telemetry_optin`) and `sendTelemetryEvent`, but there is no crash-reporting SDK (Sentry/Crashlytics) and `DEBUG_MODE = false` by default silences the very logs needed for field diagnosis. Production crashes are invisible.
- Blocks: Any data-driven stability work; user bug reports cannot be correlated with stack traces.

**No backup integrity verification or scheduled auto-backup:**
- Problem: Encrypted backups have no checksum/HMAC beyond AES padding validity — a bit-flipped archive fails with a generic "verify passphrase" error, misleading the user. There is no scheduled/auto backup; protection depends on the user remembering to export.
- Blocks: Trustworthy disaster recovery; silent backup corruption goes undetected until restore day.

## Test Coverage Gaps

**Zero component/screen tests for the largest files:**
- What's not tested: `NotesScreen` (2013 lines), `SettingsScreen`, `DashboardScreen`, `AIAssistant`, `TaskListScreen`, `DailyTasksScreen`, `FocusTimerScreen` — no render or interaction tests. `App.js` boot sequence untested. Only `ErrorBoundary` has a component test (`errorBoundary.test.js`).
- Files: `src/screens/*.js`, `src/components/AIAssistant.js`, `App.js`
- Risk: The god-component refactor (the highest-value debt payoff) cannot be attempted safely without a test net; UI regressions ship silently.
- Priority: High

**AI-output parsing and resume edge cases:**
- What's not tested: Malformed/truncated LLM JSON into `intentParser`/`frictionAnalyzer` (only happy-path + smoke via `aiAssistant-smoke.test.js`); model-download resume after partial delete; checksum mismatch; `aiSandbox` adversarial inputs beyond the current suite.
- Files: `src/ai/intentParser.ts`, `src/ai/frictionAnalyzer.ts`, `src/utils/aiService.js:208-384`, `src/commands/aiSandbox.ts`
- Risk: On-device AI failures present as silent empty results (`return []` fallbacks) rather than surfaced errors — users see missing tasks with no explanation.
- Priority: Medium

**Cross-module flows (edit→cancel notification, sync→wipe guard, import→collision rename):**
- What's not tested: Task/bill edit cancelling the stale scheduled notification; sync server returning empty arrays (the wipe-guard in `validateSyncPayload`); vault import filename-collision renaming; ThemeContext-less `Alert` paths.
- Files: `src/services/notificationService.ts`, `src/utils/syncService.js:74+`, `src/utils/vaultImport.js:76-101`
- Risk: Orphaned notifications fire for deleted tasks; a malicious/empty sync payload could still surprise; import overwrites user notes on crafted archives.
- Priority: Medium

**Enforced gates missing (coverage, console):**
- What's not tested: There is deliberately no global `coverageThreshold` (comment in `jest.config.js` admits ~28% lines / ~17% functions across 26 suites) and `no-console` stays `warn`. Coverage is collected but not gated, so it can only decay.
- Files: `jest.config.js`, `eslint.config.js`, `coverage/`
- Risk: New code lands untested by default; the 70/90/95 targets referenced in comments have no enforcement mechanism.
- Priority: High (process) — add a ratchet gate (fail if coverage drops below current floor) as the zero-cost first step before raising to target thresholds.

---

*Concerns audit: 2026-10-12*
