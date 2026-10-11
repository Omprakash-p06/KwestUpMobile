# Codebase Concerns

**Analysis Date:** 2026-10-11

## Tech Debt

**TypeScript strictness deferred (`checkJs: false`):**
- Issue: JS files are excluded from typechecking. `tsconfig.json` documents ~1152 pre-existing JS errors across `src/screens`, `src/navigation`, `App.js`, `__tests__` that block enabling `checkJs:true`. `App.js`, `index.js`, and `widgets/**/*` are additionally excluded from the TS program (widget `flex` excess-prop errors would otherwise red the gate). New `src/behavior/*.ts` and `src/services/*.ts` are strict, but all surrounding callers in JS are unchecked — type errors at the JS↔TS boundary are invisible.
- Files: `tsconfig.json`, `App.js`, `src/screens/*.js`, `src/navigation/AppNavigator.js`, `widgets/*.js`
- Impact: Refactors of shared contracts (`src/behavior/types.ts`, `src/services/types.ts`) can silently break JS callers; `tsc --noEmit` passes while runtime breaks.
- Fix approach: Phased `// @ts-check` rollout per directory (start with `src/utils/storage.js`, `src/utils/billingStorage.js`, `src/utils/vaultImport.js` per the CR-08 note), fix in small batches, then flip `checkJs:true`. Track widget `flex` style-type errors separately for the Phase 25 widget hardening.

**No coverage gate enforced:**
- Issue: `jest.config.js` explicitly documents no global `coverageThreshold` because current coverage is ~28% lines / ~17% functions. CI collects `--coverage` for tracking only, so coverage can regress silently.
- Files: `jest.config.js`
- Impact: Untested code ships without friction; coverage debt compounds.
- Fix approach: Add per-directory thresholds starting where coverage is already strong (e.g. `src/behavior/`, `src/services/notificationService.ts`), ratchet upward; keep the 70/90/95 targets from the jest comment as the end goal.

**Lint warnings banked instead of fixed:**
- Issue: `no-console` stays at `warn` (~100 pre-existing `console.*` statements triaged as WR-09); `react-native/no-inline-styles`, `no-unused-styles`, `no-color-literals` are `warn`. `tsc`/`eslint` are clean only because the rules are lenient, not because the code is clean.
- Files: `eslint.config.js`, `src/utils/logger.js` (has `/* eslint-disable no-console */` by design — that one is correct), `src/context/VaultContext.js`, `src/screens/NotesScreen.js`, `src/screens/SettingsScreen.js`, `src/navigation/AppNavigator.js`, `src/screens/DashboardScreen.js` (2× `eslint-disable-next-line react-hooks/exhaustive-deps`)
- Impact: Real warnings drown in noise; exhaustive-deps suppressions hide stale-closure bugs.
- Fix approach: Route all logging through `src/utils/logger.js` (which redacts PII), delete raw `console.*` call sites, then escalate `no-console` to `error`. Justify or remove each `exhaustive-deps` suppression in `src/screens/DashboardScreen.js:116,133`.

**God-files / oversized modules:**
- Issue: Several files exceed 700–2000 lines and mix UI, state, persistence, and side effects: `src/screens/NotesScreen.js` (2014 lines), `src/screens/SettingsScreen.js` (1102), `src/components/AIAssistant.js` (1097), `App.js` (1089), `src/utils/aiService.js` (1065), `src/theme/styles.js` (896), `src/screens/BillingScreen.js` (859), `src/screens/TaskListScreen.js` (804), `src/services/notificationService.ts` (768).
- Files: As listed above.
- Impact: Hard to review, hard to test, high merge-conflict surface; `NotesScreen.js` and `App.js` are the highest-risk edit targets.
- Fix approach: Extract by responsibility (e.g. split `NotesScreen.js` into editor/view/list/import subcomponents + hooks; split `App.js` boot orchestration into `src/boot/*.js`; split `aiService.js` into model-lifecycle / download / inference modules). No behavior change, just moves with existing tests pinning behavior.

**Deprecated shim still shipped:**
- Issue: `src/utils/notifications.js` is marked `@deprecated` in favor of `src/services/notificationService.ts`, but remains in the bundle and importable.
- Files: `src/utils/notifications.js`, `src/services/notificationService.ts`
- Impact: New code may import the deprecated path and bypass behavioral policy (quiet hours, caps, dedup).
- Fix approach: Grep for importers, migrate them, delete the shim.

**Collision-prone ID generation (`Date.now().toString()`):**
- Issue: Entity IDs are generated with `Date.now().toString()` in at least 6 places — rapid double-tap / batch import can produce duplicate IDs.
- Files: `src/context/BirthdayContext.js:40`, `src/context/BillingContext.js:49,123`, `src/screens/BirthdaysScreen.js:53`, `src/screens/BillingScreen.js:150,187,212`, `src/navigation/AppNavigator.js:139,166`, `src/utils/vaultService.js:78`
- Impact: Duplicate IDs cause overwrites, wrong-item deletes, and sync payload corruption. The typed path already does it right — `generateEntityId` in `src/behavior/habitEngine.ts` (used by `src/context/HabitContext.js`).
- Fix approach: Centralize ID generation in one helper (crypto-random, e.g. `CryptoJS.lib.WordArray.random` or `expo-crypto`) and replace all `Date.now()` ID sites.

**Dual persistence models with documented race windows:**
- Issue: `TaskContext.js` uses debounced read-modify-write against a shared `kwestup_data_v7.0` key that `App.js` also writes (birthdays/notes/theme). Comments document a residual micro-window: a mutation <500ms before a foreground refresh can be overwritten; only a per-task `updatedAt` merge closes it. `HabitContext.js` avoids this with isolated versioned keys (`kwestup_habits_v1`, etc.) — the two contexts follow different patterns.
- Files: `src/context/TaskContext.js:64-72,77-93,95-120`, `App.js` (boot `loadData`/persist), `src/context/HabitContext.js:142-159` (good pattern)
- Impact: Silent user-data loss (tasks/dailyTasks) onunlucky timing; inconsistent patterns confuse future contributors.
- Fix approach: Migrate task persistence to isolated versioned keys like habits, or add `updatedAt` per-entity last-write-wins merge. Add a regression test that interleaves a mutation with a background refresh.

## Known Bugs

**Boot-guard can only protect, not heal:**
- Symptoms: `TaskContext.js:104-116` boot guard refuses to persist an empty in-memory snapshot over non-empty storage — correct, but if hydration itself failed (corrupt JSON), the UI silently shows empty state with only a log line.
- Files: `src/context/TaskContext.js:104-120,133-169`, `src/context/HabitContext.js:100-103` (same fail-empty pattern)
- Trigger: Corrupt `kwestup_data_v7.0` value (killed mid-write) → `JSON.parse` throws → caught → empty defaults rendered.
- Workaround: Storage migration (`src/utils/storage.js:migrateUserDataIfNeeded`) may restore from a legacy version key if one exists.

**Unguarded `JSON.parse` on storage/sync/AI outputs:**
- Symptoms: Dozens of bare `JSON.parse(raw)` calls on AsyncStorage values, sync payloads, and LLM raw output. Most are inside try/catch that falls back to `[]`/`{}` (data silently dropped); LLM parse sites in `aiService.js:720,806` can throw out of inference helpers.
- Files: `src/utils/vaultService.js:51`, `src/utils/billingStorage.js:22`, `src/context/TaskContext.js:81,108,136`, `src/context/HabitContext.js:80-96`, `src/utils/aiService.js:296,720,806`, `src/utils/exportService.js:62,81,92`, `src/services/notificationService.ts:155`
- Trigger: Corrupt storage value, malformed sync payload, or non-JSON LLM output.
- Workaround: Most call sites degrade to empty state; export/import surfaces "Unable to decrypt archive" regardless of actual cause, misleading users.

**Stale-closure suppressions in Dashboard:**
- Symptoms: Two `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions mean effects may capture stale state.
- Files: `src/screens/DashboardScreen.js:116,133`
- Trigger: State referenced inside those effects changes without re-running the effect.
- Workaround: None — inspect each suppression before touching surrounding code.

**Notification fire-once paths swallow errors:**
- Symptoms: `TaskContext.js:217` schedules reminders with `.catch(e => logger.warn(...))` — a scheduling failure is a warn-and-continue, so a task can appear to have a reminder that was never scheduled.
- Files: `src/context/TaskContext.js:217`, `src/utils/billingNotifications.js:78-87` (`return null` on failure), `src/services/notificationService.ts` (exempt recurring paths don't re-verify)
- Trigger: Notification permission denied/revoked after task creation.
- Workaround: Re-save the task to reschedule.

## Security Considerations

**Sensitive data at rest is unencrypted (AsyncStorage plaintext):**
- Risk: Tasks, birthdays, billing amounts, habit titles, behavior events, and vault configs sit in plaintext AsyncStorage. Device backup / rooted-device read exposes PII and financial data. Only the export archive is encrypted — live storage is not.
- Files: `src/utils/storage.js` (`kwestup_data_v7.0`), `src/utils/billingStorage.js`, `src/context/HabitContext.js` (`kwestup_habits_v1`, `kwestup_behavior_events_v1`, `kwestup_identities_v1`, `kwestup_rewards_v1`), `src/utils/vaultService.js` (`VAULTS_KEY`, `ACTIVE_KEY`), `src/utils/diagnostics.js:129` (telemetry opt-in flag)
- Current mitigation: Export encryption via `src/utils/exportService.js:encryptBackup` (PBKDF2-SHA256 100k + AES-256, v2 envelope) — covers backups only.
- Recommendations: Adopt `expo-secure-store` for tokens/passphrases at minimum; evaluate encrypted-storage for billing/PII keys; never log note bodies (the `logger.js:38` redaction regex is the control — keep it updated as new field names are added).

**Weak legacy backup KDF still accepted:**
- Risk: `decryptBackup` transparently falls back to v1 (static salt `4b77657374557053616c745f7632`, 1000 PBKDF2 iterations) for old archives. Any v1 archive in the wild is far cheaper to brute-force.
- Files: `src/utils/exportService.js:84-92`
- Current mitigation: New archives always use v2 (random 16-byte salt/IV, 100k iterations) — `src/utils/exportService.js:21-47`.
- Recommendations: Warn on v1 import and offer re-export to v2; consider a sunset version that drops v1.

**LAN sync token policy is weak + transport risk:**
- Risk: Sync bearer token minimum length is 6 chars (`src/utils/syncService.js:67`); validation permits hostnames/IPv6; if the sync URL is `http://` (LAN), the bearer travels in cleartext on the local network. QR-scanned config (`src/components/QRScannerModal.js`) is a token-injection surface.
- Files: `src/utils/syncService.js:9-24,34-72,169-176`, `src/components/QRScannerModal.js`, `src/screens/SettingsScreen.js` (sync UI)
- Current mitigation: `validateSyncConfig` rejects malformed IPs/ports/short tokens; `validateSyncPayload` guards against note-wipe payloads (`src/utils/syncService.js:74+`).
- Recommendations: Raise token minimum (≥32 random chars), prefer HTTPS/wss or document the LAN-cleartext risk in UI, validate QR payload shape before use, and add auth-failure lockout/throttling.

**Filename sanitization is incomplete (vault/file layer):**
- Risk: `saveNoteFile` sanitizes `/\\?%*:|"<> ` to `_` but allows `..` segments and does not constrain folder names the same way; a crafted folder/title from import/sync could escape the vault directory. `vaultImport.js` (markdown import) and sync-restore paths write attacker-influenced filenames.
- Files: `src/utils/fileStorage.js:33-54`, `src/utils/vaultImport.js`, `src/utils/vaultService.js:18-20`, `src/utils/exportService.js:274+` (import-restore pipeline)
- Current mitigation: Model-file hashing is fail-closed (`src/utils/aiService.js:184`); sync payload shape is validated.
- Recommendations: Centralize a `sanitizePathSegment` helper that strips `.`, `..`, leading `-`, control chars, and caps length; apply to folder + title + vault name; add unit tests with `../`, absolute, and unicode-overlong inputs; verify `deleteNoteFile`/vault-delete cannot escape the vault root.

**LLM prompt-injection surface (on-device model):**
- Risk: Note/task content is interpolated into inference prompts (`src/utils/aiService.js:615+,947+,1021+`). Malicious note text (pasted from web, imported .md, synced) can attempt instruction override; extracted "TODO:" lines in `aiService.js:516-517` flow into task creation (`AppNavigator.js` handlers) — a prompt-injection → task-creation chain.
- Files: `src/utils/aiService.js`, `src/components/AIAssistant.js`, `src/navigation/AppNavigator.js:112-139,166-387` (task-creation callbacks with `console.warn` fallbacks)
- Current mitigation: Output is parsed as JSON with try/catch; task creation goes through validated mutations.
- Recommendations: Delimit untrusted content with explicit boundaries in prompts, cap/validate extracted tasks before creation, and never let model output auto-execute destructive actions without confirmation.

**Dependency vulnerabilities (transitive `ws`):**
- Risk: `npm audit` reports 73 vulnerabilities (1 low, 19 moderate, 52 high, 1 critical), dominated by transitive `ws` advisories (memory disclosure, memory-exhaustion DoS via tiny fragments) through `react-devtools-core`. No `.env` files exist in the repo (verified — secrets posture is clean), and `.gitignore` correctly excludes `*.key`, `*.p12`, `*.pem`, `.env*.local`.
- Files: `package.json`, `package-lock.json`, `.gitignore`
- Current mitigation: Dev-only exposure (Metro/devtools), not production runtime — but `npm ci` installs it for every contributor.
- Recommendations: Run `npm audit fix` for the non-breaking subset; track the breaking remainder; add a scheduled `npm audit` CI step with `--audit-level=high` so new advisories page.

## Performance Bottlenecks

**Whole-snapshot `JSON.stringify` on every keystroke:**
- Problem: Both `TaskContext` and `HabitContext` `JSON.stringify` the entire snapshot on every state change to detect dirtiness, then debounce the write (≤1s / 400ms). With large task/note lists this is O(n) serialization per render.
- Files: `src/context/TaskContext.js:95-100`, `src/context/HabitContext.js:161-170`
- Cause: Dirty-check by full serialization instead of version counters / dirty flags.
- Improvement path: Dirty-flag set by mutation functions, or persist only the changed slice; measure with a 1000-task fixture first.

**Oversized screens re-render wholesale:**
- Problem: `NotesScreen` (2014 lines), `SettingsScreen` (1102), `AIAssistant` (1097) hold many unrelated states in one component — any keystroke re-renders the whole tree (search, lists, editor, modals).
- Files: `src/screens/NotesScreen.js`, `src/screens/SettingsScreen.js`, `src/components/AIAssistant.js`
- Cause: Monolithic component state; `FlatList` benefits lost when parent re-creates props inline.
- Improvement path: Split into memoized subcomponents, `useMemo` filtered lists, move editor state into a child component so typing doesn't re-render the list.

**On-device LLM memory pressure (~468MB model):**
- Problem: `qwen2.5-0.5b-instruct-q4_k_m.gguf` (~491MB, pinned commit in `aiService.js:23-28`) loads into a memory-constrained RN process; idle-unload (5 min) and background-unload (`aiService.js:41-73`) mitigate but any inference while notes/tasks are large risks OOM kills, especially with the ~5000-char prompt clamps (`aiService.js:947-948`).
- Files: `src/utils/aiService.js:22-56,281-360,384,461-473,947-948`
- Cause: Single-process inference + full-file hashing (`hashFileSha256`) on every download verification.
- Improvement path: Keep idle/background unload; stream hash verification; chunk large-note summarization; surface a low-memory fallback that disables AI features gracefully.

**Notification history growth:**
- Problem: `NOTIFICATION_HISTORY_KEY` (`kwestup_notification_history_v1`) accumulates dispatch records used for cap/gap/dedup evaluation (`notificationService.ts:155+`). No bound is documented unlike behavior events (500-cap in `HabitContext.js:38`).
- Files: `src/services/notificationService.ts:33,155-233`
- Cause: Append-only history without pruning.
- Improvement path: Cap history (e.g. keep last 30 days / 500 entries) and prune on write, mirroring `MAX_PERSISTED_BEHAVIOR_EVENTS`.

## Fragile Areas

**App.js boot orchestration (1089 lines):**
- Files: `App.js`
- Why fragile: Owns font loading, theme resolution, storage migration, vault init, notes/tasks/birthdays hydration, widget registration, AI AppState subscription, diagnostics, and provider nesting. Order matters; a failure early in the chain leaves providers with empty defaults and the boot guard (`TaskContext`) then protects the emptiness — appearing as data loss.
- Safe modification: Change one boot step at a time; keep `migrateUserDataIfNeeded` before any read; never add a second writer to `kwestup_data_*` keys; test fresh-install, upgrade-with-legacy-data, and corrupt-storage scenarios.
- Test coverage: Partial — `storageMigration.test.js`, `taskContext.test.js` cover pieces; no boot-sequence integration test.

**Vault filesystem + AsyncStorage dual source of truth:**
- Files: `src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/vaultImport.js`, `src/context/VaultContext.js`, `App.js` (vault init/migration)
- Why fragile: Vault configs live in AsyncStorage while note bodies live on disk; the two can desync (dir deleted but config remains, or vice versa). Legacy keys (`kwestup_vaults_v5.0`) add a third state.
- Safe modification: Always mutate through `vaultService.js` helpers (which touch both stores); never write vault keys directly; add a repair/reconcile pass on boot.
- Test coverage: `vaultAndFileStorage.test.js` covers helpers, not desync repair.

**Export/import/restore pipeline (destructive restore):**
- Files: `src/utils/exportService.js:205-385`, `src/screens/SettingsScreen.js:590+`
- Why fragile: Import does clear-storage → restore-storage → restore-vault-files. Any failure mid-restore (bad passphrase detected late, disk full, killed app) leaves partial state. Error messages collapse all failures to "Unable to decrypt archive."
- Safe modification: Backup current state before clearing; restore to temp keys then swap; distinguish wrong-passphrase from corrupt-file from IO errors in UI copy.
- Test coverage: `exportImportService.test.js` — extend with mid-restore-failure cases.

**Notification scheduling (exempt recurring paths):**
- Files: `src/services/notificationService.ts` (767 lines), `src/utils/billingNotifications.js`, `src/context/TaskContext.js:200-260`
- Why fragile: The one-shot-vs-recurring exemption architecture (documented at the top of `notificationService.ts`) is subtle — schedule-time JS cannot constrain future OS firings, so policy (caps, gaps, dedup) applies only to behavior one-shots. A well-meaning "unify the paths" refactor breaks Feb-29/advance-reminder semantics.
- Safe modification: Read the ADR header comment first; keep recurring paths exempt; add tests before changing evaluation order. `notificationService.test.ts` (908 lines) is the safety net — keep it green.
- Test coverage: Strong — `__tests__/unit/notificationService.test.ts` is the largest suite.

**New behavior engine cluster (Phase 23/24):**
- Files: `src/behavior/eventBus.ts`, `src/behavior/ruleEngine.ts`, `src/behavior/habitEngine.ts`, `src/behavior/recoveryEngine.ts`, `src/behavior/rewardEngine.ts`, `src/behavior/improvementEngine.ts`, `src/behavior/cueEngine.ts`, `src/context/HabitContext.js`, `rulebook/machine/*.json`
- Why fragile: Brand-new deterministic rules + event bus + telemetry with cross-cutting imports (`TaskContext` → `eventBus`; `HabitContext` → engines). Rule JSON shape drift vs `evaluateCondition` operator grammar (`ruleEngine.ts:68-80`) fails silently (condition never matches, no error).
- Safe modification: Validate rule JSON against a schema on load; keep engines pure (no IO) as they are now; route all side effects through `HabitContext`/dispatch.
- Test coverage: Strong — `behaviorRuleEngine.test.ts`, `eventBus.test.ts`, `habitContext.test.js`, `domainEventInstrumentation.test.js`.

**Native boundaries (llama.rn, widgets, gradle patch):**
- Files: `src/utils/aiService.js` (llama.rn lifecycle), `widgets/*`, `patch-llama-gradle.js` (postinstall), `android/*`, `eas.json`
- Why fragile: `postinstall` patches native gradle files — Expo SDK upgrades can silently invalidate the patch. Widgets run headless (no JS context guarantees) and are excluded from typechecking. `llama.rn@0.12.4` is pinned with no upgrade path documented.
- Safe modification: After any Expo/RN upgrade, re-run `postinstall` and verify the patch applied; test widgets on-device (no Jest coverage — `phase12-widget-logic.test.js` covers logic only, not rendering).
- Test coverage: None for native rendering paths.

## Scaling Limits

**AsyncStorage single-key documents:**
- Current capacity: Entire task corpus serializes into one `kwestup_data_v7.0` value; habits/events/rewards into four more keys. Fine for hundreds of items.
- Limit: Multi-MB values hit AsyncStorage performance cliffs (slow parse, UI jank during hydration, higher corrupt-on-kill risk). Behavior events are already capped at 500; tasks/notes are not.
- Scaling path: Cap/paginate task history, move note bodies fully to filesystem (already the direction), consider SQLite (`expo-sqlite`) when lists exceed low thousands.

**Behavior event history (500-cap):**
- Current capacity: `MAX_PERSISTED_BEHAVIOR_EVENTS = 500` FIFO in `src/context/HabitContext.js:38`.
- Limit: Long-term consistency/automaticity scores (`improvementEngine.ts`) lose signal beyond the window; streak math stays correct (derived from habits, not events).
- Scaling path: Aggregate old events into rollups before eviction if multi-year analytics are ever needed.

## Dependencies at Risk

**llama.rn@0.12.4 (pinned, native, single-source):**
- Risk: Pinned native module with a postinstall gradle patch; no fallback if it breaks on a future RN/Expo version. Model is pinned to a HuggingFace commit — URL/commit rot breaks downloads.
- Impact: All AI features (`AIAssistant`, summarization, task extraction) go dark.
- Migration plan: Isolate all llama.rn imports behind `aiService.js` (already the case — do not import `llama.rn` anywhere else); document minimum-supported Expo/RN matrix; add a download-URL health check to diagnostics.

**expo-notifications scheduling semantics:**
- Risk: Core reminders depend on OS-level scheduling quirks (Doze, exact-alarm permissions, iOS limits). The codebase already works around this with the recurring-exemption design, but OS behavior changes can silently drop reminders.
- Impact: Missed task/bill/birthday reminders — the highest-trust feature.
- Migration plan: Keep `notificationService.test.ts` green; add an on-device reminder self-test in Settings; monitor Expo changelog for scheduling changes.

**react-native-android-widget:**
- Risk: Third-party widget bridge (`^0.16.1`) with headless rendering; excluded from typechecking; minimal test coverage.
- Impact: Widget breakage on RN upgrades.
- Migration plan: Phase 25 widget-engine hardening (already tracked in `tsconfig.json` comments); pin version and test on-device per release.

## Missing Critical Features

**No crash/error reporting:**
- Problem: `src/utils/logger.js` + `src/utils/diagnostics.js` record breadcrumbs/telemetry locally only. Production crashes leave no server-side trace — issues are found via user reports.
- Blocks: Triaging field failures (OOM kills, boot failures, restore failures).

**No backup-before-destructive-restore:**
- Problem: Import wipes storage before restoring (`exportService.js`). No automatic pre-restore snapshot.
- Blocks: Safe user recovery from a bad import.

**No screen-level test coverage:**
- Problem: All 9 screens (`src/screens/*`) and `App.js` boot have zero component tests; only `ErrorBoundary` has a smoke test. 18 suites / 293 tests all pass, but they cover utils/engines/contexts only.
- Blocks: Confident UI refactoring (especially `NotesScreen`, `SettingsScreen`).

## Test Coverage Gaps

**Screens (zero component tests):**
- What's not tested: Rendering, navigation, user flows for `DailyTasksScreen`, `BirthdaysScreen`, `BillingScreen`, `NotesScreen`, `FocusTimerScreen`, `DashboardScreen`, `SettingsScreen`, `SearchScreen`, `TaskListScreen`.
- Files: `src/screens/*.js`
- Risk: UI regressions ship undetected; the 2014-line `NotesScreen` is the blind spot.
- Priority: Medium (logic is tested below the UI; add smoke tests for the two most-edited screens first)

**App.js boot sequence:**
- What's not tested: Migration ordering, hydration failure modes, provider wiring, widget registration.
- Files: `App.js`
- Risk: Upgrade/corruption scenarios only surface on user devices.
- Priority: High

**Vault import / export round-trip on device:**
- What's not tested: Real-filesystem import of hostile filenames, large-vault performance, mid-restore kill recovery.
- Files: `src/utils/vaultImport.js`, `src/utils/exportService.js`, `src/utils/fileStorage.js`
- Risk: Data-loss bugs in the highest-stakes flow.
- Priority: High

**AI inference paths:**
- What's not tested: Only `aiService.test.js` + `aiAssistant-smoke.test.js` exist; model-output parsing edge cases (non-JSON, truncated, oversized) and OOM fallback are thinly covered.
- Files: `src/utils/aiService.js`, `src/components/AIAssistant.js`
- Risk: Model upgrades or large notes produce unhandled inference failures.
- Priority: Medium

**Billing and birthday reminder end-to-end:**
- What's not tested: Scheduling → OS firing → deep-link handling; `billingNotifications.js` null-return paths; Feb-29/advance-reminder edge cases beyond unit level.
- Files: `src/utils/billingNotifications.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`
- Risk: Silent reminder loss.
- Priority: Medium

---

*Concerns audit: 2026-10-11*
