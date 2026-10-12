# Codebase Concerns

**Analysis Date:** 2026-10-12

## Tech Debt

**TypeScript strictness disabled for all JavaScript:**
- Issue: `checkJs: false` in `tsconfig.json` hides ~1152 pre-existing type errors across `src/screens`, `src/navigation`, `App.js`, and `__tests__` (stated in `tsconfig.json:6-12`). Strict mode is on but applies only to `.ts` files, so the majority JS surface refactors without type safety. Phased enablement is tracked pre-Phase 22 but no per-file triage list exists in-repo.
- Files: `tsconfig.json`, `src/screens/*.js`, `src/navigation/AppNavigator.js`, `App.js`
- Impact: Silent type regressions in the largest files (`src/screens/NotesScreen.js` 2014 lines, `App.js` 1114 lines, `src/screens/SettingsScreen.js` 1101 lines). Planners cannot rely on `tsc --noEmit` for JS.
- Fix approach: Enable `checkJs` per-directory (start with `src/utils/*.js` which are small and already tested by `__tests__/unit/vaultAndFileStorage.test.js`), add `// @ts-check` file-by-file, and burn down the 1152 count with a tracked checklist.

**Lint gates left on `warn` instead of `error`:**
- Issue: `no-console` is `warn` (`eslint.config.js:46`) until "~100 pre-existing console statements are triaged", and `react-native/no-inline-styles`, `no-color-literals`, `no-unused-styles` are all `warn`. The gate stays green while debt grows.
- Files: `eslint.config.js`, `src/context/VaultContext.js` (4x `console.error`/`console.log`), `src/screens/NotesScreen.js:744`, `src/screens/SettingsScreen.js:106,134`, `src/navigation/AppNavigator.js:128,397`
- Impact: Console noise ships to production logcat; only `src/utils/logger.js` carries the `/* eslint-disable no-console */` exemption it actually needs.
- Fix approach: Migrate the ~12 `console.*` call sites in `src/` to `logger` (which already gates `debug`/`info` on `__DEV__`), then escalate `no-console` to `error`.

**Deprecated dual notification adapters still in tree:**
- Issue: `src/utils/notifications.js` and `src/utils/billingNotifications.js` are fully `@deprecated` (grandfathered v3.5.0) shims over `src/services/notificationService.ts`. Every scheduling path now has two spellings, and `src/utils/exportService.js:8` mixes both (`scheduleBillReminder, cancelNotifications` imported from the service while the adapter re-exports the same names).
- Files: `src/utils/notifications.js`, `src/utils/billingNotifications.js`, `src/services/notificationService.ts`, `src/utils/exportService.js`
- Impact: Future notification work (quiet-hours boundaries, channel importance) must be changed in two places; reviewers must know which import is canonical.
- Fix approach: Delete the adapters after a repo-wide import grep confirms zero callers outside tests, keeping only the two pure date helpers (`getNextDueDate`, `getNotifyDate`) if tests still need them — move those into `src/utils/dateUtils.js`.

**`any` casts concentrated in trust-boundary code:**
- Issue: 29+ `any` usages in TypeScript that most needs narrowing: `src/services/notificationService.ts` (6: `channel.importance as any`, five `trigger: any`), `src/commands/commandValidator.ts` (13x `payload as any`), `src/ai/frictionAnalyzer.ts:279,287,313,352`, `src/ai/intentParser.ts:100,108,134`, `src/ai/weeklyReviewEngine.ts:148,156,192`, `src/commands/aiSandbox.ts:122,160,192`, `src/commands/habitCommandHandlers.ts:16-22`.
- Files: As listed above.
- Impact: Validator/sandbox bypasses become invisible to `tsc`; the AI→command pipeline (`intentParser` → `commandValidator` → `commandExecutor` → `aiSandbox`) is exactly where mistyped payloads cause harm.
- Fix approach: Type `trigger` against the `expo-notifications` schedule-trigger union instead of `any`; introduce a `Record<string, unknown>` payload type with per-command Zod-style guards in `src/commands/commandValidator.ts`.

**God files with mixed responsibilities:**
- Issue: `src/screens/NotesScreen.js` (2014 lines: list + editor + import + search + vault switching), `App.js` (1114 lines: providers + boot migration + diagnostics + sync), `src/components/AIAssistant.js` (1096 lines), `src/screens/SettingsScreen.js` (1101 lines), `src/utils/aiService.js` (1064 lines: hashing + download + resumable state + 4 LLM entry points + heuristic fallback), `src/context/HabitContext.js` (648 lines).
- Files: As listed above.
- Impact: Merge conflicts, untestable UI logic, and slow editor/LSP performance. `NotesScreen` and `AIAssistant` have no dedicated unit tests (only `__tests__/unit/aiAssistant-smoke.test.js` smoke).
- Fix approach: Extract hooks (`useNotesFilesystem`, `useModelDownload`, `useHabitPersistence`) before adding features; split `aiService.js` into `modelStore.js` / `llmClient.js` / `taskExtractor.js`.

**Swallowed errors (fire-and-forget catches):**
- Issue: Haptics and notification cancellations are silenced with empty handlers: `src/screens/DailyTasksScreen.js:36,88,152,165`, `src/screens/FocusTimerScreen.js:56,75,83` (all `.catch(() => {})`); `src/context/TaskContext.js:244-248` ignores haptics errors; `src/context/TaskContext.js:271-273` fires `cancelNotification` inside a state updater without awaiting; `src/utils/exportService.js:421-425` ignores foreign-notification cancel failures (intentional but undocumented outside code).
- Files: As listed above.
- Impact: Real failures (notification permission revoked, haptics unavailable on emulator) never surface in `logger` or the breadcrumb buffer, complicating field debugging.
- Fix approach: Replace `.catch(() => {})` with `.catch((e) => logger.debug(...))` so dev still sees signal and production stays quiet per `src/utils/logger.js:142-152` policy.

**Filename sanitization collision (silent overwrite):**
- Issue: `saveNoteFile` in `src/utils/fileStorage.js:33-61` sanitizes titles with `.replace(/[/\\?%*:|"<>. ]/g, "_")` and writes unconditionally — `a/b`, `a_b`, and `a b` all map to the same file, last write wins. Only the import path (`src/utils/vaultImport.js:84-101`) has collision-safe `(1), (2)` suffixing.
- Files: `src/utils/fileStorage.js`, `src/utils/vaultImport.js`
- Impact: User data loss on plausible titles ("Q&A" vs "Q_A"). Reverse mapping in `getAllNotesFromFilesystem` (`file.replace(/_/g, " ")`) further corrupts round-trips for titles that legitimately contain underscores.
- Fix approach: Extract a shared `resolveUniquePath` helper (reuse the `vaultImport.js` loop) and call it from `saveNoteFile`; store the display title in frontmatter instead of deriving it from the filename.

## Known Bugs

**Task persistence micro-window (<500ms data loss):**
- Symptoms: An in-app task mutation made <500ms before a foreground refresh can be overwritten by the storage read. Documented inline, not fixed.
- Files: `src/context/TaskContext.js:65-73` (comment admits residual risk; "a per-task updatedAt merge would be needed")
- Trigger: Edit a task, background/foreground the app within the 500ms debounce window (`src/context/TaskContext.js:101-124`).
- Workaround: The boot guard (`src/context/TaskContext.js:103-121`) prevents empty-state wipes, but not this reordering race.

**Storage migration picks highest version without schema validation:**
- Symptoms: `migrateUserDataIfNeeded` in `src/utils/storage.js:73-192` copies the highest `kwestup_data_v*` blob verbatim. A corrupt or schema-drifted legacy blob (e.g. pre-`taskLists`) becomes the live blob; `JSON.parse` failures return `false` and leave the user on empty state with no repair prompt.
- Files: `src/utils/storage.js`, `src/context/TaskContext.js:81-89` (read-modify-write assumes object shape)
- Trigger: Upgrade from a very old install, or a manually edited backup.
- Workaround: None in-app; export/backup before upgrading (see `src/utils/exportService.js:279-433` recoverable import).

**`clearAllCaches` substring over-match:**
- Symptoms: The cache-clear filter matches any key *containing* `"medical"`, `"clean"`, `"sidebar"`, or `"cache"` (`src/utils/storage.js:38-46`). A third-party or future first-party key like `medical_reminders_backup` or `cleaner_settings` that is not in `isUserDataKey` would be deleted.
- Files: `src/utils/storage.js:29-71`
- Trigger: `clearAllCaches` on an install with colliding key names.
- Workaround: None; audit `AsyncStorage.getAllKeys()` before clearing on affected devices.

**New storage keys silently excluded from backup/protection:**
- Symptoms: `isUserDataKey` in `src/utils/storage.js:8-27` is a hardcoded prefix allowlist. Any new `kwestup_*` feature key whose prefix is not added is simultaneously (a) wiped by `clearAllCaches` and (b) omitted from `collectAsyncStorageData` backups (`src/utils/exportService.js:188-200`).
- Files: `src/utils/storage.js`, `src/utils/exportService.js`
- Trigger: Adding a feature that persists under a new prefix without updating the allowlist.
- Workaround: Grep for `kwestup_` when adding storage keys; add a unit test asserting every `AsyncStorage.setItem("kwestup_*")` literal has a matching prefix.

**Non-atomic vault creation (orphan directory on crash):**
- Symptoms: `createVault` in `src/utils/vaultService.js:77-94` creates the directory on disk *before* persisting the config. A crash/OOM between the two leaves an on-disk vault with no registry entry (invisible, never cleaned).
- Files: `src/utils/vaultService.js`
- Trigger: Low-memory devices during vault creation.
- Workaround: Re-create the vault; orphan dirs under `Notes/Vaults/` are harmless but waste space.

**Stale `modificationTime` used as both timestamps:**
- Symptoms: `getAllNotesFromFilesystem` in `src/utils/fileStorage.js:202-203,220-221` sets both `createdAt` and `updatedAt` from `modificationTime`, and uses the absolute file path as the note `id`. Sorting by "created" is wrong, and any vault rename/move changes every note identity.
- Files: `src/utils/fileStorage.js:165-231`, `src/utils/exportService.js:105-179` (same pattern in `packVaults`)
- Trigger: Any "sort by oldest" view or identity-keyed list after moving a vault.
- Workaround: None; do not key React lists on anything but the current `id` until a content-hash or frontmatter id is introduced.

## Security Considerations

**All live user data at rest in plaintext AsyncStorage (no SecureStore):**
- Risk: Notes index, tasks, habits, billing state, vault registry, sync token, and AI download state sit unencrypted in AsyncStorage. `expo-secure-store` is not a dependency (`package.json`). Device backup extraction or a rooted device yields everything; only the *exported archive* is encrypted.
- Files: `src/context/TaskContext.js`, `src/context/HabitContext.js`, `src/utils/billingStorage.js`, `src/utils/vaultService.js`, `src/utils/aiService.js:281-351`, `package.json`
- Current mitigation: AES-256 backup encryption in `src/utils/exportService.js:21-47` (PBKDF2 100k, random salt+IV, v2 envelope); key-based PII redaction in the log buffer (`src/utils/logger.js:37-81`).
- Recommendations: Store the sync token, billing identifiers, and passphrase-verifier (never the passphrase) in `expo-secure-store`; document that AsyncStorage contents are plaintext in the threat model.

**LAN sync is plaintext HTTP with bearer token:**
- Risk: `performSync` and `pingSyncServer` build `http://<ip>:<port>` URLs (`src/utils/syncService.js:110,137`). The full notes/tasks/birthdays payload plus `Authorization: Bearer <token>` traverse the LAN unencrypted — any network observer (public Wi-Fi, compromised router) captures credentials and journal content. `pingSyncServer` additionally downgrades a missing token to `"ping-token-check"` (`src/utils/syncService.js:109`), probing the server unauthenticated.
- Files: `src/utils/syncService.js:107-195`
- Current mitigation: Token length floor (≥6 chars) and strict IP/hostname validation (`src/utils/syncService.js:34-72`); 401/403 handling with re-scan guidance.
- Recommendations: Add optional HTTPS with self-signed pinning for the KwestUp PC server, or at minimum warn in `src/components/QRScannerModal.js` manual-setup UI when joining a non-home network; give `pingSyncServer` its own timeout + no default token.

**QR/manual sync token handled as plaintext UI state:**
- Risk: The QR payload is `{ip, port, token}` JSON with no signature or expiry (`src/components/QRScannerModal.js:38-56` accepts any payload with three truthy fields). The manual form keeps the token in a `secureTextEntry` input but passes it up as a plain string (`src/components/QRScannerModal.js:86-90`); no port range check and only a weak IP regex (octets >255 pass, e.g. `999.999.999.999`) before handing off — real validation is deferred to `validateSyncConfig`.
- Files: `src/components/QRScannerModal.js`
- Current mitigation: `try/catch` around `JSON.parse` with user alert; downstream `validateSyncConfig` enforces strict IPv4/octet ranges and port 1–65535.
- Recommendations: Validate port range and token length inline in `handleManualSubmit`; add payload shape + `Number.isInteger(port)` check in `handleBarcodeScanned`; consider single-use pairing tokens with expiry on the PC server.

**Legacy backup decryption path uses static salt + 1000 iterations:**
- Risk: `decryptBackup` falls back to v1 (`src/utils/exportService.js:84-92`) with hardcoded salt `4b77657374557053616c745f7632` ("KwestUpSalt_v2") and 1000 PBKDF2 iterations — GPU-crackable. An attacker who can get a victim to import a crafted file forces the weak path (downgrade-by-file-format; iteration count is attacker-controlled for v2 via `envelope.iterations` with no upper/lower bound, `src/utils/exportService.js:70`).
- Files: `src/utils/exportService.js:58-97`
- Current mitigation: v2 default (random salt/IV, 100k iterations); wrong-passphrase yields a clear error without oracle details.
- Recommendations: Clamp accepted `iterations` (e.g. 50k–600k) and reject v1 restores unless the user explicitly opts in with a "legacy backup" confirmation; sunset v1 after one migration cycle.

**Temp backup in shared cache + share-sheet copy escapes sandbox:**
- Risk: `exportArchive` stages plaintext-ciphertext in `FileSystem.cacheDirectory` (`src/utils/exportService.js:210-242`) and hands it to `Sharing.shareAsync`. Cleanup runs in `finally` (good), but the shared copy the OS/user saves is outside app control indefinitely, protected only by the passphrase.
- Files: `src/utils/exportService.js:209-269`
- Current mitigation: `finally`-block deletion with existence check; per-archive random salt/IV.
- Recommendations: Enforce minimum passphrase strength before export; remind the user the `.kwestup` file is only as strong as the passphrase.

**`.env` (bare) is committable; `.npmrc` present at root:**
- Risk: `.gitignore:33-34` ignores only `.env*.local` — a bare `.env` with secrets would commit cleanly. `.npmrc` exists at repo root (existence noted only, contents never read) and is a classic token-bearing file.
- Files: `.gitignore`, `.npmrc`
- Current mitigation: Keystores/certs (`*.jks`, `*.p8`, `*.p12`, `*.key`, `*.pem`, `*.mobileprovision`) are ignored (`.gitignore:15-31`).
- Recommendations: Change the rule to `.env*` with explicit `!.env.example` allowlist, and add `.npmrc` to `.gitignore` unless the checked-in file is verified token-free.

**Logger redaction is key-name-based only; warn/error passthrough in production:**
- Risk: `SENSITIVE_KEYS` in `src/utils/logger.js:37-39` redacts *object keys* but message strings pass through verbatim — `logger.error("..."+noteTitle)` or `logger.warn(payload)` leaks content into the 50-entry buffer and, for warn/error, to production console/logcat (`src/utils/logger.js:154-162`). `getRecentLogs()` feeds crash/diagnostic reports.
- Files: `src/utils/logger.js`
- Current mitigation: Key-based redaction + 1000-char truncation + depth/cycle guards + dev-gating of debug/info (`src/utils/logger.js:142-152`).
- Recommendations: Never interpolate user content into the message arg (pass as details objects so redaction applies); audit `logger.warn/error` call sites in `src/screens/NotesScreen.js`, `src/screens/SettingsScreen.js`, `src/utils/syncService.js` for inline content.

## Performance Bottlenecks

**Full-vault filesystem scan on read paths (no pagination/index):**
- Problem: `getAllNotesFromFilesystem` (`src/utils/fileStorage.js:165-231`) lists every directory and reads *every* `.md` file's full content sequentially (`await` in nested loops) on each Notes mount/refresh; `packVaults` (`src/utils/exportService.js:105-179`) repeats the whole scan for export/sync. Cost is O(total vault bytes) with per-file `getInfoAsync` + `readAsStringAsync` syscalls and full-content hashtag extraction.
- Files: `src/utils/fileStorage.js`, `src/utils/exportService.js`, `src/screens/NotesScreen.js`, `src/screens/SearchScreen.js`
- Cause: No metadata index, no lazy loading, no virtualized excerpt cache; sequential awaits instead of bounded parallelism in the `fileStorage` path (the export path already parallelizes per-folder).
- Improvement path: Persist a lightweight index (id → mtime/size/excerpt/tags) in AsyncStorage, refresh incrementally by mtime, and load full bodies on open; bound concurrency (e.g. p-limit 8) and add `FlatList` windowing in `NotesScreen`.

**Whole-blob persistence with O(n) stringify per mutation:**
- Problem: Every task/habit keystroke triggers full-snapshot `JSON.stringify` comparisons (2–3x per event: `src/context/TaskContext.js:96-128`, `refreshTasksFromStorage` at `src/context/TaskContext.js:131-173` stringifies prev+next on every foreground), plus a full read-modify-write of the entire `kwestup_data_*` blob through a 500ms debounce. Habit boot does 4 sequential `AsyncStorage.getItem` + 4 `JSON.parse` (`src/context/HabitContext.js:72-96,145-174`) and 4 separate `setItem` writes (`src/context/HabitContext.js:222-225`) instead of one `multiGet`/`multiSet`.
- Files: `src/context/TaskContext.js`, `src/context/HabitContext.js`, `src/services/notificationService.ts:153-184` (history read/write is fine — pruned)
- Cause: Single-blob storage design with structural-equality sync.
- Improvement path: Split keys per domain (`kwestup_tasks_*`, `kwestup_habits_*`), use `multiGet`/`multiSet`, and replace stringify-compare with a version counter/`updatedAt` check.

**Import restores notes sequentially with no fine-grained progress:**
- Problem: `importArchive` (`src/utils/exportService.js:369-406`) awaits each `getInfoAsync`/`makeDirectoryAsync`/`writeAsStringAsync` serially in nested loops; progress jumps 0.6→1.0 across the entire vault phase. Large vaults (hundreds of notes) block the UI with no cancellation.
- Files: `src/utils/exportService.js:279-433`
- Cause: Correctness-first recoverable staging (snapshot → write → verify → prune stale, `src/utils/exportService.js:309-367`) without concurrency or chunking on the file phase.
- Improvement path: Batch file writes with bounded parallelism and report per-vault progress; move import off the JS thread boundary with progress callbacks already plumbed via `onProgress`.

**On-device LLM budget clamps silently truncate long notes:**
- Problem: Three hard char budgets (`~6500` in `src/utils/aiService.js:623`, `~6800` at `src/utils/aiService.js:683`, `~5000` at `src/utils/aiService.js:947-948`) slice input to fit the 2048-token window. Long notes are summarized/parsed from a prefix with no "truncated" signal to the user; `Promise.race` timeout wrappers in `src/ai/intentParser.ts:100-134`, `src/ai/frictionAnalyzer.ts:279-352`, `src/ai/weeklyReviewEngine.ts:148-192` vary per engine (inconsistent timeout UX).
- Files: `src/utils/aiService.js`, `src/ai/intentParser.ts`, `src/ai/frictionAnalyzer.ts`, `src/ai/weeklyReviewEngine.ts`
- Cause: `llama.rn` 0.12.4 context window + low-end memory ceiling (OOM messaging at `src/utils/aiService.js:447`).
- Improvement path: Chunk-and-map long notes with a visible "summarized from first N characters" badge; unify timeout constants per engine.

## Fragile Areas

**Boot orchestration in `App.js`:**
- Files: `App.js` (1114 lines)
- Why fragile: Owns provider nesting, `migrateUserDataIfNeeded`, vault migration, diagnostics gating, sync state, and confirmation dialogs in one module. Any boot-order change risks wiping or double-loading state (cf. TaskContext boot guard above).
- Safe modification: Keep provider order frozen; add boot steps as isolated async functions with individual try/catch, never inline in render; cover with `__tests__/unit/storageMigration.test.js` before touching migration.
- Test coverage: Migration is tested; provider/boot composition is not.

**Task/Habit persistence pair:**
- Files: `src/context/TaskContext.js`, `src/context/HabitContext.js`, `src/utils/storage.js`, `src/utils/taskMutations.js`
- Why fragile: Two writers share one blob key via read-modify-write; HabitContext's 4-key snapshot is not atomic (partial write leaves habits/identities/events/rewards inconsistent); `deleteTask` cancels notifications inside a state updater (`src/context/TaskContext.js:269-275`).
- Safe modification: Route all task-key writes through `writeTaskSnapshot`; never add a second writer for those keys; move side effects (notification cancel/schedule, haptics) out of updaters per the WR-01/WR-02 pattern already applied to `toggleTaskComplete`/`handleSaveTask`.
- Test coverage: `__tests__/unit/taskContext.test.js`, `__tests__/unit/habitContext.test.js`, `__tests__/unit/taskMutations.test.js` exist — extend them for the <500ms race and partial-write cases before refactoring.

**Backup/restore pipeline:**
- Files: `src/utils/exportService.js` (433 lines), `src/utils/vaultImport.js`
- Why fragile: AsyncStorage swap + filesystem restore + billing reschedule span three subsystems; the recoverable staging (`rollbackStorage`, write-verify-prune) is new and subtle — a regression reintroduces the wipe-then-restore data-loss window the comments describe.
- Safe modification: Keep the snapshot/verify/prune order; never `multiRemove` before verified `multiSet`; run `__tests__/unit/exportImportService.test.js` and a manual round-trip (export → delete → import → diff) on every change.
- Test coverage: Export/import service covered; `vaultImport.js` caps (50 files/1MB) and collision loop are not.

**Sync + QR pairing:**
- Files: `src/utils/syncService.js`, `src/components/QRScannerModal.js`, `src/navigation/AppNavigator.js:115-128,397`
- Why fragile: Plain-HTTP LAN fetch with hand-rolled timeouts (`fetchWithTimeout`), payload shape validation (`validateSyncPayload` requires `notes`/`tasks`/`birthdays` arrays), and two "context unavailable" warn-and-drop paths in `AppNavigator` where AI-extracted tasks are silently discarded if `TaskContext` is not mounted.
- Safe modification: Keep `validateSyncPayload` strict (it prevents note wipes); surface the `AppNavigator` drops to the user instead of `console.warn`; add timeouts to `checkForUpdates` (`src/utils/diagnostics.js:62-106` has none).
- Test coverage: `__tests__/unit/syncService.test.js` covers validators; QR modal and navigator drops are untested.

**Widget bridge + native patch script:**
- Files: `widgets/*.tsx` (6 files, incl. `widgets/widget-task-handler.tsx` 513 lines, `widgets/TasksListWidget.tsx` 277 lines), `patch-llama-gradle.js`, `android/`, `eas.json`
- Why fragile: `react-native-android-widget` flex incompatibilities already forced a `widgets/` tsconfig exclusion cycle (see phase-20 review docs); `postinstall` rewrites the llama gradle file, so every `npm install` on a new machine re-patches native build config; hexagon binaries under `android/app/src/main/assets/ggml-hexagon/` are gitignored and must be re-provisioned per clone.
- Safe modification: Pin `react-native-android-widget` and `llama.rn` exactly; re-run `tsc --noEmit` + Android build after any Expo/RN bump; never hand-edit `android/` outputs of the patch script.
- Test coverage: Only `__tests__/phase12-widget-logic.test.js` and `__tests__/unit/behavioralWidget.test.ts` — handler logic largely untested.

**Version/migration constants scattered:**
- Files: `src/utils/storage.js:4-5` (`APP_VERSION v3.5.0`, `STORAGE_VERSION v7.0`), `src/utils/vaultService.js:8-9` (hardcoded `kwestup_vaults_v5.0` legacy keys), `src/utils/diagnostics.js:6` (`DEBUG_MODE = false` dead flag)
- Why fragile: Bumping `STORAGE_VERSION` without updating the v5.0 legacy fallback or `isUserDataKey` strands users on old keys; `cleanVersion`/`isNewerVersion` in `diagnostics.js:45-60` does naive numeric compare (pre-release tags misorder).
- Safe modification: Centralize all version/key constants in `src/utils/storage.js`; add a migration test per version bump.
- Test coverage: `__tests__/unit/storageMigration.test.js` — extend with the new version before release.

## Scaling Limits

**AsyncStorage single-blob ceiling (~6MB Android):**
- Current capacity: All tasks/lists/daily-tasks share one `kwestup_data_<ver>` JSON blob; habits add 4 more keys. Fine for hundreds of tasks.
- Limit: Large vaults are on the filesystem (good), but the AsyncStorage blob hits the ~6MB Android limit at a few thousand rich tasks; `multiSet` then fails and `writeTaskSnapshot` only logs (`src/context/TaskContext.js:91-93`).
- Scaling path: Shard tasks per list or move task bodies to filesystem files with an AsyncStorage index; add a size guard + user-visible "storage full" error instead of log-only.

**Filesystem scan ceiling (hundreds of notes):**
- Current capacity: Tens of notes load imperceptibly; approaching ~500 notes the sequential full-content scan dominates mount time and export/sync latency.
- Limit: No index means every launch pays full cost; low-end devices OOM on very large single notes during export `JSON.stringify(payload)` (`src/utils/exportService.js:224-237` builds the entire archive in memory).
- Scaling path: Metadata index + excerpt cache + streaming/chunked archive writes.

**LLM context ceiling (2048 tokens):**
- Current capacity: Short notes/tasks summarize well on-device via `llama.rn`.
- Limit: Inputs over ~5–6.8k chars are prefix-truncated (see Performance); weekly-review over months of behavior events is bounded only by caller discipline.
- Scaling path: Chunked map-reduce summarization; rule-based pre-filter (already started in `src/ai/heuristicParser.ts`) before LLM calls.

**Notification history bound (healthy):**
- Current capacity: Dispatch history auto-prunes to 48h (`src/services/notificationService.ts:148-184`); log buffer capped at 50 (`src/utils/logger.js:13,125-134`); telemetry opt-in gated (`src/utils/diagnostics.js:127-149`).
- Limit: None observed — these are the patterns to copy elsewhere.

## Dependencies at Risk

**Installed tree does not match `package.json` (partial SDK upgrade in flight):**
- Risk: `npm ls` reports `expo@53.0.20` installed vs `~57.0.0` requested, `jest-expo@53.0.14` vs `~57.0.0`, `react-native@0.79.5` vs `0.86.0`, `@types/react@19.0.14` vs `~19.2.0`, and UNMET `@react-native/jest-preset@0.86.3`. `npm outdated` shows nearly every `expo-*` package one major behind wanted. Any clean `npm install`/`npm ci` will churn the native runtime significantly; `postinstall: node patch-llama-gradle.js` then re-patches whatever lands.
- Impact: Non-reproducible builds; "works on my machine" native crashes; CI (`.github/`) red unless it runs the same install path.
- Migration plan: Finish the SDK 53→57 migration in one commit (install, `expo doctor --fix`, re-run `patch-llama-gradle.js`, rebuild `android/`, run full jest + `tsc --noEmit`), then pin with `package-lock.json` and add an `expo doctor` CI step.

**`llama.rn@0.12.4` native module:**
- Risk: Pinned minor with `0.13.0-rc.7` upstream; couples to exact RN/Expo/NDK/gradle versions via `patch-llama-gradle.js`; model `.gguf` referenced by absolute `documentDirectory` path (`src/screens/SettingsScreen.js:22`, `src/utils/aiService.js:29`) with resumable-download state in AsyncStorage.
- Impact: Expo/RN upgrades break the build; model files are large, unversioned, and device-local (no integrity re-check after first download beyond SHA-256 at fetch in `src/utils/aiService.js:117-178`).
- Migration plan: Keep exact pin; document model provisioning (URL, SHA-256, minimum free space) alongside the hexagon-asset step; add a startup integrity check before `llama.rn` init.

**`react-native-android-widget@^0.16.1`:**
- Risk: Caret range on a community native module with known `flex` style type incompatibilities (phase-20 exclusion cycle); 6 widget files depend on its evolving API.
- Impact: Type errors and Android build breaks on minor bumps.
- Migration plan: Pin exact (`0.16.1`), vendor the flex-style workarounds with comments, and cover `widgets/widget-task-handler.tsx` with unit tests before upgrading.

**`expo-file-system` legacy API surface:**
- Risk: Codebase uses classic APIs (`documentDirectory`, `EncodingType`, `readAsStringAsync`, `cacheDirectory`) across `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/exportService.js`, `src/utils/aiService.js`. SDK 57+/new-arch direction renames/moves these (`expo-file-system/next`); deprecation warnings become build breaks.
- Impact: Every vault/file/export/AI path touches this API — a forced migration is wide.
- Migration plan: Isolate behind a `src/utils/fsCompat.js` shim now; migrate call sites to the shim so the SDK bump touches one file.

**`crypto-js@^4.2.0` pure-JS crypto:**
- Risk: Unmaintained-ish pure-JS AES/PBKDF2 — 100k iterations on the JS thread janks low-end devices during export/import; not constant-time; no native acceleration.
- Impact: Export ANRs on large vaults; weaker side-channel posture than platform keystores.
- Migration plan: Keep envelope format (compat), but benchmark `expo-crypto` digest + a native AES path behind the same `encryptBackup`/`decryptBackup` interface.

**`@react-navigation/drawer@^6` / `native@^6`:**
- Risk: v7 is current (`npm outdated`: drawer 6.7.2→7.14.3, native 6.1.18→7.5.0). Staying on v6 is fine short-term but accumulates API drift with React 19 / RN 0.86.
- Impact: Future gesture-handler/reanimated upgrades force a coordinated navigation major.
- Migration plan: Defer until post-SDK-57 stabilization; no action beyond not widening v6-specific API usage.

## Missing Critical Features

**No encrypted-at-rest story for live data:**
- Problem: Backup encryption exists, but working-set confidentiality relies entirely on OS sandboxing. No `expo-secure-store` integration, no file-level encryption for vault `.md` files, no app-lock/biometric gate.
- Blocks: Any "private vault" or compliance-sensitive usage; lost/unrooted-device backup extraction reads journals in cleartext.

**No crash reporting / error tracking backend:**
- Problem: Forensics stop at the 50-entry in-memory ring buffer (`src/utils/logger.js`) plus opt-in telemetry POST to `https://api.kwestup.com/telemetry` (`src/utils/diagnostics.js:127-149`, endpoint liveness unverified). No Sentry/crashlytics; release stack traces without user copy-paste are lost.
- Blocks: Field-issue diagnosis for sync/import/notification failures.

**No TLS/pinned transport for PC sync:**
- Problem: See Security. There is no certificate or pairing upgrade path in `src/utils/syncService.js` or the PC-server contract.
- Blocks: Safe sync outside trusted home LANs.

**No vault search index / pagination:**
- Problem: `SearchScreen.js` (265 lines) and `NotesScreen.js` scan-and-filter in memory; no FTS index, no excerpt cache, no incremental update.
- Blocks: Usability past a few hundred notes (see Scaling Limits).

**No automated E2E / device testing:**
- Problem: 30 jest suites cover logic, but no Maestro/Detox/Appium flow exercises boot → vault → note CRUD → export/import → sync against a real device/emulator.
- Blocks: Catching the boot-guard race, widget refresh, notification scheduling, and native-patch regressions before release.

## Test Coverage Gaps

**Screens (9/9 untested):**
- What's not tested: `src/screens/NotesScreen.js`, `BillingScreen.js`, `BirthdaysScreen.js`, `DailyTasksScreen.js`, `DashboardScreen.js`, `FocusTimerScreen.js`, `TaskListScreen.js`, `SearchScreen.js`, `SettingsScreen.js` — zero test files reference them.
- Files: `src/screens/*.js`
- Risk: UI state logic (filtering, sorting, edit-modal flows, APK update flow in `SettingsScreen.js:62-134`) breaks unnoticed.
- Priority: Medium (logic is migrating into tested utils/contexts; add component tests for `NotesScreen` vault-switching and `SettingsScreen` update-check first).

**Contexts (Vault/Billing/Birthday untested):**
- What's not tested: `src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js` — no suites; `HabitContext` has `__tests__/unit/habitContext.test.js` but not partial-write/rollback cases.
- Files: `src/context/*.js`
- Risk: Vault switching/refresh failures (`VaultContext.js:48-73` log-only catches) and billing persistence regressions ship silently.
- Priority: High for `VaultContext` (every note path depends on it); Medium for billing/birthday.

**Components (only smoke + boundary covered):**
- What's not tested: `src/components/TaskCard.js`, `TaskEditModal.js`, `QRScannerModal.js`, `CustomDateTimePicker.js`, `AIAssistant.js` internals (only `__tests__/unit/aiAssistant-smoke.test.js`), `WeeklyReviewModal.js`, `TimerLockoutOverlay.js`.
- Files: `src/components/*.js`
- Risk: QR pairing validation, date-picker timezone handling, and review-modal aggregation regress without signal.
- Priority: High for `QRScannerModal` (security-adjacent input validation); Medium for the rest.

**Untested utilities with caps/branches:**
- What's not tested: `src/utils/vaultImport.js` (50-file/1MB caps, collision loop, control-char sanitization), `src/utils/diagnostics.js` (`checkForUpdates` version compare, `sendTelemetryEvent` opt-in), `src/utils/fileStorage.js` collision/overwrite branch, `patch-llama-gradle.js` (no harness at all).
- Files: As listed.
- Risk: Import-path data loss and update-check false positives/negatives.
- Priority: High for `vaultImport.js`; Medium for diagnostics.

**Coverage floor far below targets:**
- What's not tested: Per `jest.config.js:30-43`, the ratchet floor is statements 47 / branches 38 / functions 35 / lines 50 (measured ~49.6/40.8/37.2/52.9 across 30 suites / 457 tests on 2026-10-12) versus §24 targets of 70/90/95. Roughly half of all statements and two-thirds of functions execute only in production.
- Files: `jest.config.js`, `coverage/` (gitignored, regenerate via `npm run test:coverage`)
- Risk: The floor prevents regression but blesses a low absolute bar; engine suites (26–28: gateway, sandbox, intent parser, compiler, weekly review) are well covered while screens/contexts/widgets drag the mean.
- Priority: Medium — raise the floor incrementally per phase (rulebook §24) rather than in one jump; next ratchet candidates are `VaultContext` + `vaultImport` suites.

---

*Concerns audit: 2026-10-12*
