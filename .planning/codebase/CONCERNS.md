# Codebase Concerns

**Analysis Date:** 2026-10-11

## Tech Debt

**God files (monolithic modules):**
- Issue: Several modules exceed 700 lines and mix UI, state, IO, and business logic, making review and refactor risky.
- Files: `App.js` (1085 lines), `src/screens/NotesScreen.js` (2013 lines), `src/screens/SettingsScreen.js` (1101 lines), `src/components/AIAssistant.js` (1096 lines), `src/utils/aiService.js` (1064 lines), `src/screens/TaskListScreen.js` (803 lines), `src/services/notificationService.ts` (767 lines), `src/screens/BillingScreen.js` (858 lines)
- Impact: High merge-conflict surface, hard to unit test, slow onboarding; a change to notes search risks touching note IO, vault switching, and import in one file.
- Fix approach: Extract per-screen hooks (`useNotesSearch`, `useArchiveFlow`, `useModelDownload`) and move pure logic into `src/utils/` with unit tests before splitting JSX. Start with `src/screens/NotesScreen.js` (largest, highest churn).

**Mixed JS/TS with no type gate:**
- Issue: Only `src/services/*.ts`, `src/behavior/*.ts`, `src/commands/*.ts` are TypeScript; all screens/contexts/utils are untyped `.js`. `tsc --noEmit` exists (`package.json`) but there is no evidence it gates CI, and `src/services/notificationService.ts:95` uses `importance: channel.importance as any`.
- Files: `src/services/notificationService.ts`, `tsconfig.json`, `package.json`
- Impact: Refactors of shared shapes (task, vault, billing) fail silently at runtime; the `as any` hides channel-shape drift across Expo SDK upgrades.
- Fix approach: Add `tsc --noEmit` to CI, replace the `as any` with a narrow union cast, then convert `src/utils/taskMutations.js` and `src/utils/storage.js` to TS first (most-imported pure modules).

**Non-unique ID generation:**
- Issue: IDs use `Date.now().toString()` alone in several production paths (collides when N items are created in the same millisecond, e.g. AI batch extraction). Only `calculateNextRecurrence` (`src/utils/taskMutations.js:54`) appends random entropy.
- Files: `src/utils/taskMutations.js:169`, `src/utils/taskMutations.js:246`, `src/screens/TaskListScreen.js:86`, `src/screens/NotesScreen.js:1261` (has entropy — good), `src/screens/BirthdaysScreen.js:53`, `src/screens/BillingScreen.js:150,187,212`, `src/context/BirthdayContext.js:40`, `src/utils/vaultService.js:78`, `src/navigation/AppNavigator.js:139,166`, `src/behavior/eventBus.ts:21` (has entropy — good)
- Impact: Duplicate task/bill/birthday/vault IDs → silent overwrite or wrong-item delete/notify. Previously flagged in the Phase-17 review and still present.
- Fix approach: Extract a single `generateId(prefix)` helper (timestamp + `Math.random().toString(36).slice(2)`) in `src/utils/` and replace every `Date.now().toString()` call site; add a collision unit test that creates 1000 IDs in a tight loop.

**Swallowed errors (`catch {}`):**
- Issue: Bare `catch {}` blocks silently discard filesystem/model errors with no log, no UI signal.
- Files: `src/screens/SettingsScreen.js:188`, `src/screens/SettingsScreen.js:207`
- Impact: Model download/size check can fail invisibly; user sees stale "not downloaded" state with no recourse.
- Fix approach: Replace with `logger.warn` + user-visible `setDownloadError`/toast. Escalate `no-console` and add an eslint `no-empty` error rule.

**`console.*` bypassing the logger:**
- Issue: Direct `console.warn`/`console.error`/`console.log` calls remain outside `src/utils/logger.js`, so they skip PII redaction, the forensic ring-buffer, and prod silencing. `no-console` is only `warn` (see `eslint.config.js:46`).
- Files: `src/context/VaultContext.js:48,60,62,73`, `src/navigation/AppNavigator.js:125,387`, `src/screens/SettingsScreen.js:106,134`, `src/screens/NotesScreen.js:743`
- Impact: Potential PII in release logs; inconsistent forensics; the pre-existing ~100-statement backlog noted in `eslint.config.js:43-45` never shrinks.
- Fix approach: Codemod remaining `console.*` to `logger.*`; then flip `no-console` to `error`.

**No coverage gate, acknowledged low coverage:**
- Issue: `jest.config.js:30-33` documents ~28% line / ~17% function coverage with no `coverageThreshold` — "a 70% gate would red CI".
- Files: `jest.config.js`, `eslint.config.js`
- Impact: Regressions in untested areas (screens, import pipeline, billing) ship undetected; coverage can only drift downward.
- Fix approach: Add per-module thresholds starting with high-risk pure modules (`taskMutations`, `exportService`, `notificationService`, `eventBus`) at current +5%, ratchet upward.

**Dangerous dev kill-switch in shipped code:**
- Issue: `const FORCE_CLEAR_ALL_STORAGE = false` in `App.js:66`, consumed at `App.js:195`, can wipe caches on next launch if ever flipped in a release build.
- Files: `App.js:66`, `App.js:195-196`
- Impact: One-line accidental flip (or bad merge) triggers mass cache clear for all users on upgrade.
- Fix approach: Delete the flag; expose cache-clear only behind the Settings UI action that already exists.

**Legacy weak-crypto fallback (v1 envelope):**
- Issue: `decryptBackup` (`src/utils/exportService.js:84-92`) falls back to static salt `4b77657374557053616c745f7632` with 1,000 PBKDF2 iterations when the v2 envelope is absent.
- Files: `src/utils/exportService.js:58-97`
- Impact: Old archives remain decryptable with far weaker KDF; an attacker with a v1 file can brute-force much faster. Keeping the fallback indefinitely extends the weak-crypto window.
- Fix approach: On successful v1 import, immediately re-encrypt to v2 and warn the user; add a deprecation timeline and log v1 usage via telemetry.

**Dead placeholder domain layer:**
- Issue: `src/domains/` contains only `README.md` — an aspirational layer with no code after 23+ phases.
- Files: `src/domains/README.md`
- Impact: Confuses "where do I put this?" decisions; planners may target a layer that does not exist.
- Fix approach: Either implement the first domain slice or delete the directory and remove it from architecture docs.

**Duplicated model-path constant:**
- Issue: `MODEL_PATH` is constructed independently in `src/utils/aiService.js:30` and `src/screens/SettingsScreen.js:22`.
- Files: `src/utils/aiService.js:30`, `src/screens/SettingsScreen.js:22`
- Impact: A rename of the model file breaks Settings size/delete checks while downloads succeed (or vice versa).
- Fix approach: Export `MODEL_PATH`/`MODEL_FILENAME` from `aiService.js` once and import in `SettingsScreen.js`.

**Overbroad cache-clear key matcher:**
- Issue: `clearAllCaches` (`src/utils/storage.js:33-41`) deletes any key containing `kwestup`, `medical`, `clean`, `sidebar`, or `cache` unless allow-listed by `isUserDataKey`.
- Files: `src/utils/storage.js:24-66`
- Impact: Substring `cache`/`clean` (a theme name is literally `"clean"`) can match unrelated third-party or future keys; runs automatically on every version change (`App.js:197-200`).
- Fix approach: Switch to an explicit key prefix allowlist (`kwestup_` + known third-party keys) and require the destructive path to be opt-in from Settings.

## Known Bugs

**Destructive import with no rollback:**
- Symptoms: `importArchive` (`src/utils/exportService.js:279-324`) reads → decrypts → `multiRemove`s ALL user keys → `multiSet`s backup entries. If the app crashes, the archive is partially written, or `multiSet` fails midway, the user's pre-import data is already gone with no backup copy.
- Files: `src/utils/exportService.js:309-324`
- Trigger: Import a large archive on a low-memory device; kill the app at ~45% progress; relaunch to find partial data.
- Workaround: Manually export a backup before every import (not prompted by UI).
- Fix approach: Snapshot existing user keys to a temp backup key prefix before `multiRemove`; restore-or-rollback in `try/catch`; surface progress + "keep a pre-import backup" prompt in `src/screens/SettingsScreen.js:315-340`.

**Import restore bypasses filename sanitization:**
- Symptoms: Export restore writes `${vaultPath}${folder}/${title}.md` (`src/utils/exportService.js:343-358`) using the raw stored title, while `readNoteFile`/`saveNoteFile` sanitize titles via `.replace(/[/\\?%*:|"<>. ]/g, "_")` (`src/utils/fileStorage.js:38-42`). Notes with spaces, dots, or special chars in the title restore to paths the reader never looks up.
- Files: `src/utils/exportService.js:343-358`, `src/utils/fileStorage.js:33-61`, `src/utils/fileStorage.js:70-91`
- Trigger: Create note titled "Q3 Review. Final", export, wipe, import — note file exists on disk but opens as empty/missing.
- Workaround: None user-side.
- Fix approach: Reuse the same `sanitizeTitle`/`sanitizeFolder` helpers in both write paths; add a round-trip test (save → export → wipe → import → read) with hostile titles.

**Filename collision from aggressive sanitization:**
- Symptoms: `fileStorage.js` maps spaces AND dots AND underscores-adjacent chars all to `_`, so "My Note", "My_Note", and "My.Note" resolve to the same file and silently overwrite each other.
- Files: `src/utils/fileStorage.js:38-42`, `src/utils/fileStorage.js:73-76`, `src/utils/fileStorage.js:102-105`
- Trigger: Create two notes differing only by space vs underscore in one folder.
- Fix approach: Keep dots/spaces handling distinct (or append a short id suffix on collision like `vaultImport.js:86-99` already does).

**Deleting the last vault leaves a dangling active ID:**
- Symptoms: `deleteVault` (`src/utils/vaultService.js:100-122`) only re-points the active vault `if remaining.length > 0`. Deleting the final vault leaves `ACTIVE_KEY` pointing at a non-existent vault; next launch resolves a missing directory.
- Files: `src/utils/vaultService.js:100-122`
- Trigger: Create one vault, delete it, restart the app.
- Fix approach: Guard deletion of the last vault in UI, or auto-recreate the `default` vault when none remain.

**Task write race inside the 500ms debounce window (documented residual):**
- Symptoms: `TaskContext.js:70-72` self-documents that a mutation made <500ms before a foreground refresh can be overwritten by the storage read; no per-task `updatedAt` merge exists.
- Files: `src/context/TaskContext.js:64-80`, `App.js:235-270`
- Trigger: Rapid task toggle during cold-start refresh.
- Fix approach: Add per-task `updatedAt` last-writer-wins merge (the comment already prescribes this; slated but unscheduled).

**Stale-closure reschedule workaround is load-bearing:**
- Symptoms: `App.js:258-260` (WR-08) notes the reschedule block must iterate locally-loaded birthdays, not state, because the closure captures stale `[]`. Correct today, but any future edit that "simplifies" it back to state reintroduces missed birthday reminders.
- Files: `App.js:255-260`
- Fix approach: Extract birthday rescheduling into a tested util taking an explicit array argument so the invariant is enforced by signature, not comment.

## Security Considerations

**Logger redaction is key-name-only; free-text PII still buffered:**
- Risk: `SENSITIVE_KEYS` (`src/utils/logger.js:37-38`) redacts object *values by key name*, but message strings pass through verbatim (`sanitizeEntry`, `src/utils/logger.js:86-107`). Any call like `logger.debug("saved", noteTitle)` or pasted crash-report text lands unredacted in the 50-entry ring-buffer and the copy-pasteable diagnostics report.
- Files: `src/utils/logger.js:37-107`, `src/utils/logger.js:125-134`
- Current mitigation: Key-based redaction, 1000-char truncation, depth cap, cycle guard, dev-gating of debug/info.
- Recommendations: Add a content-side sweep for long free-text details (truncate + tag), audit all `logger.*` call sites passing note/bill/birthday strings as the message, and confirm the crash-report share sheet warns that content may be included.

**No passphrase strength floor on encrypted export:**
- Risk: `handleExportConfirm` (`src/screens/SettingsScreen.js:287-296`) rejects only empty/mismatched passphrases. A 1-character passphrase yields a valid AES-256 archive whose PBKDF2 (100k) protection is trivially brute-forced.
- Files: `src/screens/SettingsScreen.js:287-313`, `src/utils/exportService.js:21-47`
- Current mitigation: Random 16-byte salt + IV per archive, 100k PBKDF2-SHA256 (v2).
- Recommendations: Enforce min length (≥12 chars) + confirmation, show a strength hint, and document that archives are only as strong as the passphrase.

**Archive import has no size cap (memory exhaustion):**
- Risk: `importArchive` does `readAsStringAsync(filePath)` with no size check (`src/utils/exportService.js:285`), and the picker accepts `type: "*/*"` (`src/screens/SettingsScreen.js:271-274`). A multi-hundred-MB file is fully loaded into the JS heap before decryption.
- Files: `src/utils/exportService.js:279-300`, `src/screens/SettingsScreen.js:268-285`
- Current mitigation: `vaultImport.js` caps at 50 files / 1 MB each — but the archive path does not share that guard.
- Recommendations: `getInfoAsync` size check before read (e.g. reject >50 MB with a clear error), stream/chunked read if larger archives must be supported.

**LAN sync token floor (6 chars) and plaintext storage:**
- Risk: `validateSyncConfig` (`src/utils/syncService.js:67`) accepts a 6-character token; tokens persist in AsyncStorage unencrypted and ride LAN HTTP depending on server config.
- Files: `src/utils/syncService.js:34-72`
- Current mitigation: Strict IPv4/hostname/port validation, payload shape validation (`validateSyncPayload`), 4s fetch timeout.
- Recommendations: Raise token minimum (≥16 chars, encourage QR-generated), document plaintext-at-rest explicitly in Settings UI, prefer HTTPS-only sync URIs.

**APK self-update without signature verification:**
- Risk: `SettingsScreen` downloads an APK from the GitHub release asset over the network and triggers install (`src/screens/SettingsScreen.js:60-112`); verification is limited to GitHub HTTPS transport — no checksum/signature check against a pinned value (unlike the AI model flow, which pins SHA-256).
- Files: `src/screens/SettingsScreen.js:60-149`, `src/utils/diagnostics.js:62-106`
- Current mitigation: HTTPS + GitHub release provenance.
- Recommendations: Publish SHA-256 per release asset and verify post-download before install; show the verified version string in UI.

**Passphrase and token material in component state:**
- Risk: Export/import passphrases live in `SettingsScreen` state (`exportPassphrase`, `confirmPassphrase`, `importPassphrase`, `src/screens/SettingsScreen.js:165-172`) and sync tokens flow through QR scan state — all inspectable via devtools/flipper and retained until cleared.
- Files: `src/screens/SettingsScreen.js:161-172`, `src/screens/SettingsScreen.js:287-340`
- Current mitigation: State cleared on modal open (`handleExportPress`); nothing persisted.
- Recommendations: Zero-out passphrase state immediately after use (already partially done — verify every path), never log passphrases (audit `logger.*` calls in the archive flow).

**`legacy-peer-deps=true` masks dependency conflicts:**
- Risk: `.npmrc` sets `legacy-peer-deps=true` (added to resolve an ERESOLVE conflict per git history `4b82fba`). Incompatible peer ranges (notably `@react-navigation/drawer` v6 under React 19 / Expo 57) install without error.
- Files: `.npmrc`, `package.json`, `package-lock.json`
- Current mitigation: Pinned lockfile.
- Recommendations: Re-attempt `npm install` without the flag each dependency upgrade; record remaining conflicts explicitly instead of a blanket bypass.

## Performance Bottlenecks

**468 MB model SHA-256 in JS (main-thread, Base64 chunks):**
- Problem: Model integrity check reads the whole GGUF via `readAsStringAsync` Base64 chunks and hashes with `crypto-js` (pure JS) — `src/utils/aiService.js:141-160`.
- Files: `src/utils/aiService.js:22-31`, `src/utils/aiService.js:141-260`
- Cause: `crypto-js` has no native acceleration; Base64 inflates IO ~33%; runs on the JS thread.
- Improvement path: Hash incrementally with `expo-crypto` (native digest) or verify size-first + sparse-chunk sampling; move verification off the launch path into the download-completion step with progress UI.

**Single-blob AsyncStorage dataset parsed on every load:**
- Problem: All tasks/lists/daily data live in one `kwestup_data_${STORAGE_VERSION}` JSON string parsed wholesale in `App.js:loadData` and rewritten (debounced ≤1s) on every mutation (`src/context/TaskContext.js:73-80`).
- Files: `App.js:235-270`, `src/context/TaskContext.js:64-80`, `src/utils/storage.js:68-80`
- Cause: No pagination, no per-entity keys, no SQLite.
- Improvement path: Split hot collections into per-list keys or migrate to `expo-sqlite`; at minimum measure blob size in diagnostics and warn past a threshold.

**Sequential per-note filesystem round-trips in export/import:**
- Problem: Export (`src/utils/exportService.js:133-150`) and import (`src/utils/exportService.js:332-362`) issue `getInfoAsync`/`makeDirectoryAsync`/`readAsStringAsync`/`writeAsStringAsync` per note, serially. A 500-note vault = thousands of awaited bridge calls.
- Files: `src/utils/exportService.js:99-160`, `src/utils/exportService.js:328-363`, `src/utils/fileStorage.js:180-230`
- Cause: No batching, no concurrency limit, progress callback per file re-renders Settings.
- Improvement path: Concurrency-limited worker pool (e.g. 8 in flight), throttle progress updates, batch directory creation per folder.

**Cold-start fan-out with fire-and-forget migration race:**
- Problem: `initializeApp` awaits 5 parallel reads, then fires vault migration + cache-clear + diagnostics without awaiting (`App.js:192-212`) while `loadData` (triggered on `isInitialized`) concurrently reads/migrates the same storage keys.
- Files: `App.js:150-234`
- Cause: Migration (`migrateToVaultSystem`, `migrateUserDataIfNeeded`) is not mutually exclusive with the first data load.
- Improvement path: Single async boot chain with an explicit phase gate (migrate → load → render), plus a startup-timing log to catch regressions.

**Oversized screens re-render wholesale:**
- Problem: `NotesScreen.js` (2013 lines) and `SettingsScreen.js` (1101 lines) hold dozens of `useState` slices in one component; any keystroke/progress tick re-renders the whole tree. ESLint `no-inline-styles`/`no-color-literals` are `warn`-only (`eslint.config.js:34-37`), so style objects are likely recreated per render.
- Files: `src/screens/NotesScreen.js`, `src/screens/SettingsScreen.js`, `eslint.config.js:34-37`
- Improvement path: Split into memoized sub-components, hoist static styles, throttle progress state (already partially done for archive progress — extend to model download + search input).

## Fragile Areas

**App.js boot sequence:**
- Files: `App.js:74-270`
- Why fragile: One 1085-line component owns font loading, version check, vault init, migration, theme, telemetry consent, timer restore, widget tab, and sync. Ordering assumptions live in comments, not code.
- Safe modification: Change one boot phase at a time; keep `initializeApp` → `loadData` ordering; run the full jest suite plus a cold-start manual pass on Android after any edit.
- Test coverage: No tests cover `App.js` (all 16 suites target utils/services; only `errorBoundary` and `aiAssistant-smoke` touch components).

**Storage versioning + auto cache-clear on upgrade:**
- Files: `src/utils/storage.js:4-66`, `App.js:192-211`
- Why fragile: Bumping `STORAGE_VERSION` (`v7.0`) triggers `clearAllCaches` with substring matching; `migrateUserDataIfNeeded` silently no-ops when the new key already exists, so a half-migrated state is indistinguishable from success.
- Safe modification: Dry-run migration behind a Settings "diagnostics" action first; log key counts before/after `multiRemove`.
- Test coverage: `__tests__/unit/storageMigration.test.js` covers migration happy paths only — no interrupted-migration or double-run test.

**Vault filesystem layout + one-shot migration:**
- Files: `src/utils/vaultService.js:173-237`, `src/utils/fileStorage.js`
- Why fragile: `migrateToVaultSystem` moves (not copies) user files with a copy+delete fallback per item; a crash mid-loop leaves half the notes in `Notes/` and half in `Notes/Vaults/default/`, and the guard (`Vaults/` exists → skip) then treats the partial state as done.
- Safe modification: Make migration idempotent per item (skip already-moved, resume remaining) rather than directory-existence-gated; test with a fixture tree.
- Test coverage: `__tests__/unit/vaultAndFileStorage.test.js` — covers CRUD, not the migration resume path.

**Notification policy split-brain (JS vs OS):**
- Files: `src/services/notificationService.ts:1-17` (decision record), `src/services/notificationService.ts:340-720`
- Why fragile: Behavioral caps/gaps/dedup apply only to one-shot `behavior` requests; all recurring triggers are explicitly exempt because "schedule-time JS cannot constrain native future OS-level firings". Any PM request to "just cap birthday reminders too" contradicts an architecture decision that is only documented in a code comment.
- Safe modification: Read the decision record at the top of `notificationService.ts` before touching policy; keep quiet-hours shifting (still applied) separate from caps.
- Test coverage: `__tests__/unit/notificationService.test.ts` — policy unit tests exist; no OS-level firing tests possible in jest.

**Headless widget handler sharing `taskMutations`:**
- Files: `widgets/widget-task-handler.tsx`, `src/utils/taskMutations.js`
- Why fragile: The widget runs headless (no React context, possibly stale JS bundle) and imports the same pure module as the app — any signature change breaks the widget silently on devices that cached the old bundle.
- Safe modification: Treat `taskMutations.js` exports as a versioned contract; add widget-handler tests to the same suite as any mutation change.
- Test coverage: `__tests__/phase12-widget-logic.test.js` only — no coverage of the handler's recurrence spawn path.

**Phase-23 eventBus (new global):**
- Files: `src/behavior/eventBus.ts`, `src/context/TaskContext.js:222-293`
- Why fragile: New process-wide singleton with `typedListeners`/`wildcardListeners`; a missed `unsubscribe` leaks handlers across navigation mounts; `clear()` exists but is test-only (`src/behavior/eventBus.ts:246-247`).
- Safe modification: Always pair `subscribe` with cleanup in `useEffect` return; never call `clear()` in app code.
- Test coverage: `__tests__/unit/eventBus.test.ts` + `domainEventInstrumentation.test.js` — good unit coverage, zero lifecycle/leak tests.

**Expo SDK 57 / `expo-file-system` API surface:**
- Files: `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/exportService.js`, `src/utils/vaultImport.js`, `src/utils/aiService.js`
- Why fragile: Every persistence path depends on legacy `FileSystem.documentDirectory` / `readAsStringAsync` / `writeAsStringAsync`. Expo 57 renames/restructures this API family (`expo-file-system/legacy`), so an SDK bump can break all note/vault/model IO at once.
- Safe modification: Centralize all FS access behind one wrapper module before upgrading; pin and test the SDK upgrade in isolation.
- Test coverage: Mocked FS in `__tests__/setup/jest.setup.js` — mocks hide real API-shape drift.

## Scaling Limits

**AsyncStorage single-blob growth:**
- Current capacity: Entire task dataset + settings in one JSON value per storage version.
- Limit: AsyncStorage throughput degrades past ~1–2 MB values on Android; `JSON.parse` blocks the JS thread; `multiSet` restore of large blobs risks transaction failures.
- Scaling path: Per-list/per-task keys now; `expo-sqlite` when notes/tasks exceed a measured threshold (add blob-size telemetry first).

**Notification history unbounded array:**
- Current capacity: `kwestup_notification_history_v1` appended on every dispatch (`src/services/notificationService.ts:33` + history recording paths).
- Limit: Array grows without documented trimming; slows every policy evaluation that scans it (dedup/min-gap checks).
- Scaling path: Cap history (e.g. last 200 entries / 30 days) with FIFO eviction like `logger.js:125-134` already demonstrates.

**Forensic log buffer fixed at 50 entries:**
- Current capacity: 50-entry FIFO (`src/utils/logger.js:13`).
- Limit: Fine for crash forensics; insufficient for session replay or post-release diagnostics of intermittent bugs.
- Scaling path: Persist WARN/ERROR breadcrumbs to a bounded on-disk ring file (opt-in, redacted) when chasing field issues.

**Vault count and note count per vault:**
- Current capacity: Flat directory per vault; full `readDirectoryAsync` scans (`src/utils/fileStorage.js:180-230`).
- Limit: Hundreds of notes per folder → slow search/sync/export (all full scans today).
- Scaling path: Filename index cached in AsyncStorage with mtime invalidation; paginate search results (`src/screens/SearchScreen.js` runs 4 parallel full scans per keystroke).

## Dependencies at Risk

**`llama.rn@0.12.4` (exact pin, native module):**
- Risk: Pinned native bridge tied to specific RN/Gradle shapes; `patch-llama-gradle.js` postinstall rewrites native build files on every `npm install` — breaks silently on AGP/Gradle upgrades. `no_gpu_devices: true` workaround (`src/utils/aiService.js:424`) signals existing Android GPU probing failures.
- Impact: AI features fail to build or crash on new devices; every RN/Expo upgrade must re-validate the patch script.
- Migration plan: Track upstream `llama.rn` releases; add a CI step that runs the Gradle patch + native build smoke on the pinned AGP before merging SDK bumps; keep `IDLE_UNLOAD_TIMEOUT_MS` + AppState unload as the memory backstop.

**`crypto-js@^4.2.0` (unmaintained pure-JS crypto):**
- Risk: No native acceleration — PBKDF2-100k + AES on large archives and SHA-256 over 468 MB run in JS; last meaningful upstream maintenance years ago.
- Impact: Export of large vaults and model verification jank or ANR on low-end devices.
- Migration plan: Migrate hashing to `expo-crypto` (native) and KDF/file cipher to a native module in phases; keep envelope format (`v:2`) stable so archives stay compatible.

**`react-native-android-widget@^0.16.1` (Android-only):**
- Risk: Widgets are Android-exclusive; iOS has no counterpart. Any shared task-mutation change must be validated against the headless handler with no iOS safety net.
- Impact: Feature asymmetry; widget bugs only reproducible on device, not in jest.
- Migration plan: Keep widget logic in pure `taskMutations.js` (current design — do not regress); add handler-level tests per widget (`widgets/*.tsx` have none today).

**Expo ~57 / React Native 0.86 / React 19.2.3 (bleeding-edge trio):**
- Risk: Major-version combination with `legacy-peer-deps` bypass; `@react-navigation/drawer@^6` predates React 19; `jest-expo@~57` Android preset is the only tested target.
- Impact: Navigation/gesture/reanimated incompatibilities surface as runtime crashes, not install errors.
- Migration plan: Upgrade `@react-navigation` to the v7 line validated for React 19; re-attempt install without `legacy-peer-deps` quarterly.

**`expo-notifications@~0.31.4` OS-behavior coupling:**
- Risk: Recurring triggers, channels, and importance levels are OS-version-sensitive; the policy-exemption architecture (see Fragile Areas) means behavior changes with Android notification policy, not app code.
- Impact: Reminders fire at wrong times or get batched by Doze/Battery-optimization on some OEMs with no app-side signal.
- Migration plan: Document OEM-specific verification steps; add a Settings "notification diagnostics" screen showing scheduled vs fired counts from history.

## Missing Critical Features

**No destructive-action safety net:**
- Problem: Import wipes all user data before restoring with no automatic pre-import backup and no undo (`src/utils/exportService.js:309-315`).
- Blocks: Safe restore UX; every support case for a failed import is unrecoverable data loss.

**No app-lock / biometric gate for encrypted content:**
- Problem: Vault files and archives are protected only by OS sandbox + optional export passphrase; there is no PIN/biometric gate in-app.
- Blocks: Privacy-story completeness for a notes app holding personal content.

**No E2E or device-lab coverage:**
- Problem: 16 jest suites, all unit-level; no Maestro/Detox/EAS-device flow covers boot → create task → schedule notification → export → import.
- Blocks: Confidence in the exact paths flagged above (migration resume, import rollback, widget contract).

## Test Coverage Gaps

**Screens (9/9 untested):**
- What's not tested: All user flows in `DashboardScreen`, `TaskListScreen`, `DailyTasksScreen`, `NotesScreen`, `BirthdaysScreen`, `BillingScreen`, `FocusTimerScreen`, `SearchScreen`, `SettingsScreen` — including archive export/import handlers, billing CRUD + reschedule, QR sync execution.
- Files: `src/screens/*.js`
- Risk: The most destructive path in the app (import wipe) has zero automated tests; regressions only surface via manual QA.
- Priority: High

**Contexts (3/4 untested):**
- What's not tested: `BillingContext.js`, `BirthdayContext.js`, `VaultContext.js` provider behavior (persistence, error paths, active-vault switching). Only `TaskContext` has a suite (`__tests__/unit/taskContext.test.js`).
- Files: `src/context/BillingContext.js`, `src/context/BirthdayContext.js`, `src/context/VaultContext.js`
- Risk: Billing reminder rescheduling and vault-switch data routing break silently.
- Priority: High

**Widget handlers and billing notification math:**
- What's not tested: `widgets/widget-task-handler.tsx` recurrence spawn, `widgets/*.tsx` rendering, `src/utils/billingNotifications.js` scheduling edge cases (month-end, leap day), `src/utils/syncService.js` beyond happy-path validation.
- Files: `widgets/widget-task-handler.tsx`, `widgets/*.tsx`, `src/utils/billingNotifications.js`, `src/utils/syncService.js:100-195`
- Risk: Recurring spawned-task ID shape and billing reschedule drift diverge from app behavior unnoticed.
- Priority: Medium

**Failure-injection paths (import/migration/AI download):**
- What's not tested: Interrupted migration resume, `multiSet` failure rollback, model-download retry with jitter (`src/utils/aiService.js:384`), SHA mismatch handling, oversized-archive rejection.
- Files: `src/utils/exportService.js`, `src/utils/vaultService.js:173-237`, `src/utils/aiService.js:218-360`
- Risk: Every resilience path added in recent phases is unverified under fault conditions.
- Priority: Medium

---

*Concerns audit: 2026-10-11*
