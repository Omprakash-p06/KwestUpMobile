# Concerns

**Analysis Date:** 2026-09-28

> Milestone 2 is 89% complete — Phase 17 done (plans 17-01, 17-02; commit `0786531`), Phase 18 next. Phase 15 review (`15-REVIEW.md`, APPROVED WITH NOTES) + fix commit `7a706b1` verified present — all 6 warnings downgraded below. Zero `TODO`/`FIXME`/`HACK`/`XXX` markers in source (grep-verified across repo). Suite status verified: **9 suites, 109 tests, all passing.**

## Tech Debt (ranked list with file refs)

**1. Dual-writer paths: legacy `App.js` handlers vs new context/mutation layer (NEW — top Phase 18 risk).**
- Files: `App.js` (1293 lines; legacy `toggleTaskComplete` ~L704, `handleCompleteTask` ~L793, `handleSaveTask` ~L818, subtask/list handlers ~L850–975, still passed as props at L1075–1084, L1251) vs `src/context/TaskContext.js` (271 lines) + `src/utils/taskMutations.js` (293 lines); resolution in `src/navigation/AppNavigator.js` (`taskCtx?.toggleTaskComplete ?? toggleTaskComplete`, ~L94).
- Issue: Two parallel write paths coexist by design as a transition step. `App.js` still owns ~15 root `useState` slices (L99+) and feeds providers via `initial*` props (`App.js:1054-1059`); contexts re-sync on prop change. `TaskContext` also exposes raw `setTasks`/`setTaskLists`/`setDailyTasks` escape hatches (L242–247), so any caller can bypass the mutation layer entirely.
- Impact: Whichever path a screen/AI-assistant actually calls determines notification side-effects and recurrence behavior; `handleSaveTask` semantics differ (legacy `App.js` version vs `TaskContext.handleSaveTask` with `await cancel/schedule` at L183–211). Stale-prop overwrite risk if `App.js` reloads while context holds newer edits.
- Fix approach: Phase 18 must delete the legacy `App.js` task handlers, have screens call `useTasks()` directly (remove `AppNavigator` prop fan-out/fallbacks), and remove or gate the raw setters. `17-02-PLAN.md:185` already names this exact removal step.

**2. `App.js` still a state monolith (reduced, no longer the sole blocker).**
- Files: `App.js` (1293 lines, was 1268 — grew slightly from provider wiring).
- Issue: Tasks/lists now have a context, but birthdays/billing/vault/timer/telemetry/persistence-load (`loadData` ~L300–410), sync, reset-data, and consent modal logic remain in `App.js`. `dailyTasks` streak-reset logic is still inline in `App.js:loadData` with no shared pure module.
- Impact: Same merge-conflict magnet as before, smaller blast radius for tasks only.
- Fix approach: Migrate `dailyTasks` streak logic into a tested pure module next (mirrors the `taskMutations.js` pilot); then birthday/billing/vault writes.

**3. Screens remain monolithic and oversized (unchanged).**
- Files: `src/screens/NotesScreen.js` (2012 lines), `src/screens/SettingsScreen.js` (1100 lines), `src/components/AIAssistant.js` (1089 lines), `src/screens/TaskListScreen.js` (803 lines), `src/screens/DailyTasksScreen.js` (691 lines), `src/utils/aiService.js` (634 lines).
- Impact: All screens 0% coverage (see Test Gaps); high regression risk for any Phase 18 screen rewiring to contexts.
- Fix approach: Carve out only what Phase 18 needs; do not wholesale-split screens.

**4. ✅ DOWNGRADED — recurrence deduplicated via shared module (was #3).**
- Files: `src/utils/taskMutations.js` (`toggleTask`, `calculateNextRecurrence`); `widgets/widget-task-handler.tsx` (L11 imports `toggleTask`, L126–130 calls it — the 55-line manual loop is gone per `17-01-SUMMARY.md`).
- Verified: widget and app now share one recurrence implementation; `completedDate: null` standardized in the shared module (old `undefined`-vs-`null` review note resolved at the source).
- Residual: `dailyTasks` streak logic still duplicated/inline (`App.js` vs `DailyTasksScreen` vs `SearchScreen` — see item 6); notification re-scheduling differs (context schedules for spawned recurrence at `TaskContext.js:129-137`; widget does not schedule — acceptable headless limitation, but document it).

**5. Release APK committed to git (unchanged).**
- Files: `build/kwestup-v3.0.1.apk` (confirmed tracked via `git ls-files build/`); stale vs current v3.5.0.
- Impact: Binary bloats every clone/fetch; canonical-build confusion.
- Fix approach: `git rm --cached build/kwestup-v3.0.1.apk`, broaden `.gitignore` to `build/`, publish via GitHub Releases / EAS.

**6. Search-vs-Daily streak parity — ✅ FIXED for Search, still inline (downgraded).**
- Files: `src/screens/SearchScreen.js` (`handleToggleDailyTask` now maintains `streak`/`totalCompleted` with yesterday-string continuity, verified in `7a706b1` diff); `src/screens/DailyTasksScreen.js` (L66–104 original logic); `App.js:loadData` streak-reset.
- Verified: the exact review Warning 5 is addressed. No shared `toggleDailyTask` helper exists yet — three inline copies can still drift.
- Fix approach: Extract one tested `toggleDailyTask` pure helper (same pilot pattern as `taskMutations.js`).

**7. Two overlapping ESLint configs (unchanged).**
- Files: `.eslintrc.js` (legacy) + `eslint.config.js` (flat; ignores `node_modules/**`, `.expo/**`, `dist/**`, `web-build/**`, `android/**`, `ios/**`, `assets/**`, `KwestUpPC/**`).
- Fix approach: Delete `.eslintrc.js`, standardize on flat config (ESLint 9).

**8. Native `node_modules` patches via postinstall regex (unchanged).**
- Files: `patch-llama-gradle.js` (targets `node_modules/llama.rn/android/build.gradle`, `node_modules/react-native-android-widget/.../RNWidgetUtil.java`).
- Impact: Any bump of `llama.rn` (^0.12.4) / `react-native-android-widget` (^0.16.1) can silently break the build (warn-and-continue); patches re-apply only on `npm install`.
- Fix approach: Fail loudly on pattern mismatch; CI assertion on post-patch content; long-term `patch-package` with checksums.

**9. App version in multiple sources of truth (unchanged).**
- Files: `app.json` (`versionCode: 7`, version 3.5.0), `android/app/build.gradle` (`versionCode 7`, `versionName "3.5.0"`), `src/utils/storage.js` (`APP_VERSION = "v3.5.0"`, `STORAGE_VERSION = "v7.0"`); `package.json` version line not re-verified this pass.
- Impact: `src/utils/diagnostics.js` update-check compares against `storage.js` value, which can disagree with the shipped binary.
- Fix approach: Single build-time source of truth.

**10. ~150+ `console.*` callsites retained in shipped code (grew with 4 new contexts).**
- Files: prior counts hold (`App.js`, `diagnostics.js`, `vaultService.js`, `exportService.js`, `fileStorage.js`, `storage.js`, `aiService.js`, `notifications.js`, `vaultImport.js`, `widget-task-handler.tsx`, `syncService.js`, `billingStorage.js`, `billingNotifications.js`) **plus** new: `src/context/TaskContext.js` (L74, L101), `src/context/VaultContext.js` (4), `src/context/BillingContext.js` (7).
- Fix approach: Gate behind `__DEV__` or strip in release via Babel plugin.

## Security Notes (encryption, validation, storage)

**Backup encryption v2 — hardened in Phase 16, v1 fallback retained by design (re-verified).**
- Files: `src/utils/exportService.js` (v2: PBKDF2-HMAC-SHA256 100000 iterations at L25; envelope L28/36; decrypt re-derives at L69–72; v1 static salt `4b77657374557053616c745f7632` + 1000 iterations at L84–85).
- Residual: any v1 archive (or attacker-supplied v1 blob) inherits weak parameters; no UI nudge to re-export v1 → v2. Wrong-passphrase path stays generic (good).
- Recommendation: flag successful v1 imports in UI with one-tap re-export to v2.

**LAN sync validation — hardened in Phase 16, plaintext transport remains (re-verified).**
- Files: `src/utils/syncService.js` (`validateSyncConfig` L32, `validateSyncPayload` L80, `pingSyncServer` L107 with `"ping-token-check"` substitution, `performSync` L134, `baseUrl = http://…` at L108/L135; `AbortController` at L8 — timeout/abort path exists, still unaudited end-to-end).
- Residual risk 1 — plaintext HTTP bearer on LAN: acceptable only under trusted-LAN threat model; document in UI copy; consider optional HTTPS/pinning follow-up.
- Residual risk 2 — ping succeeds without the real token (low severity, no data returned).
- Recommendation: audit `AbortController`/timeout wiring in `performSync`/`pingSyncServer` while Phase 18 touches nearby code.

**Storage keys / versioning — current `v7.0`, wide key surface (re-verified).**
- Files: `src/utils/storage.js` (`STORAGE_VERSION = "v7.0"`, `APP_VERSION = "v3.5.0"`); new contexts read versioned keys (`TaskContext` `kwestup_data_${STORAGE_VERSION}`, widget handler same + `kwestup_timer_state_${STORAGE_VERSION}`).
- Residual: ~15 versioned prefixes, coarse whole-version migration; `kwestup_last_version`/`kwestup_last_clear` bookkeeping semantics across upgrades still unconfirmed. No `.env`/secret files in scope — local-first, nothing committed.

**Telemetry consent — opt-in default holds through Phase 17 (re-verified pattern, not re-read line-by-line this pass).**
- Files: `App.js` (default `false`, consent modal), `src/screens/SettingsScreen.js` (toggle).
- Watch item: any Phase 18 state refactor must keep the default `false` and the `clearAllCaches` shield.

**AI model download — integrity gap STILL OPEN (re-verified).**
- Files: `src/utils/aiService.js` (L17 mutable `resolve/main` HuggingFace URL; size-only validity check; no SHA-256/pinning — grep confirms no `checksum`/`SHA` in file).
- Risk: bytes can change under the branch pointer undetected; size check cannot catch substitution.
- Recommendation: pin immutable commit/tag URL + post-download SHA-256 before `initLlama`; store checksum alongside `kwestup_ai_model_*`.

**Phase 15 review outcome — all 6 warnings VERIFIED FIXED (`7a706b1`).**
- `parseLocalDate` silent-today → now strict `YYYY-MM-DD` regex + round-trip, Invalid Date on garbage (`src/utils/dateUtils.js`).
- Calendar rollover (`2023-02-29`, ISO-datetime truncation) → rejected by strict contract.
- Epoch-0 falsiness (`getYesterday/TomorrowLocalDateString`, `isSameLocalDay(0,0)`) → explicit null/undefined/empty checks.
- `BillingScreen` unguarded `t.date.startsWith` → `(t.date || '').startsWith`; `formatMonthLabel` guards non-`YYYY-MM` → `""`.
- Search-vs-Daily streak divergence → streak/totalCompleted bookkeeping added to `SearchScreen`.
- `DashboardScreen.computeBirthdayDaysRemaining` → regex + range + round-trip validation, sentinel `999` on invalid, finite-check on diff.
- Remaining Info-level notes NOT fixed (accepted): render-time `today` snapshot staleness past midnight, `aiService` unvalidated birthday day (`Oct 99`), out-of-contract input coercion edge (`dateUtils` Info), adversarial-input test additions (partially — `dateUtils.test.js` gained cases in the fix commit).

## Reliability / Offline Risks

**Widget ↔ app convergence improved but still last-writer-wins with a JSON-compare race window (CHANGED).**
- Files: `widgets/widget-task-handler.tsx` (writes full `kwestup_data_*` blob via shared `toggleTask`); `src/context/TaskContext.js` (`refreshTasksFromStorage` L61–103, `AppState` foreground listener L106–123); `App.js` legacy load path still active.
- Good: foreground re-sync now exists in BOTH `TaskContext` and `App.js`; shared mutation removes behavior drift for tasks.
- Risk: full-blob read-modify-write on both sides with `JSON.stringify` compare — concurrent foreground edit + widget toggle can drop one side's write; 600 ms ticking-animation `setTimeout` in the widget handler (L122) widens the race; no queue/lock/vector-clock.
- Safe change: serialize widget writes (single-flight), narrow writes to per-task keys or add a revision counter; add a conflict test.

**`TaskContext` initial-prop sync can clobber newer state (NEW).**
- Files: `src/context/TaskContext.js` (L42–58: `if (initialTasks.length > 0) setTasks(initialTasks)` on every `initialTasks` identity change).
- Risk: `App.js` passes arrays that change identity on each render path; a late/stale `initialTasks` arrival overwrites in-context edits made since mount. Same pattern in all four providers (`BillingContext`, `BirthdayContext`, `VaultContext` untested — see Test Gaps).
- Safe change: sync once on mount (or gate on a boot-token/revision), not on every identity change.

**Notification side-effects split across layers (NEW).**
- Files: `TaskContext.toggleTaskComplete` schedules + patches `notificationId` in a nested `setTasks` (L126–140); `handleSaveTask` awaits cancel/schedule before `setTasks` (L183–211); legacy `App.js` handlers have their own variants; widget path schedules nothing.
- Risk: spawned-recurrence notification scheduled in context but never persisted back to AsyncStorage by the same write (second `setTasks` may race with `refreshTasksFromStorage`); tasks completed via widget lose due-date alarms silently.
- Safe change: make notification-id assignment part of the mutation result (return `notificationId` intent from the pure layer), persist atomically.

**AsyncStorage single-blob persistence, no per-entity schema (unchanged).**
- Files: `src/utils/storage.js`, `App.js` load/save, `src/utils/billingStorage.js`.
- Risk: whole-blob atomic failure; no partial recovery; growth in one payload. Notes safe on-disk (`src/utils/fileStorage.js`).
- Phase 18 relevance: add write-through validation + last-known-good fallback in the unified layer.

**`aiService` global mutable state + busy-wait mutex (unchanged).**
- Files: `src/utils/aiService.js` (module `_llamaContext`/`_isInitializing`, spin-sleep init, `n_ctx: 2048` CPU-only, 468 MB resumable download, manual unload pairing).
- Safe change: promise-chain single-flight init; audit unload pairing.

**Note folder path still unsanitized (re-verified OPEN).**
- Files: `src/utils/fileStorage.js` (folder only `.trim()`ed at L37/72/101/139; title sanitized at L38–40/73–75/102–104; `vaultImport.js` L55 same title-only pattern).
- Risk: `..`/`/`/null-byte folder input → path traversal / unexpected directories; title collisions after flattening (`.` and space → `_`) overwrite.
- Safe change: one shared sanitizer for folder + title; reject `..`/separators; add collision/traversal tests.

**Birthday/notification date math — partially covered now (improved).**
- Files: `src/utils/notifications.js` (0% coverage, unchanged); `src/screens/DashboardScreen.js` (hardened, see above); `src/utils/dateUtils.js` 92% stmts.
- Safe change: unit-test `scheduleCustomBirthdayReminders` pure logic before Phase 18 touches scheduling.

## Test Gaps

- Suite status (verified `npm test -- --ci --coverage`): **9 suites, 109 tests, all passing** (was 7/88). New: `__tests__/unit/taskMutations.test.js` (307 lines, `taskMutations.js` 97% stmts) and `__tests__/unit/taskContext.test.js` (141 lines, `TaskContext.js` ~60% stmts).
- Covered (good): `dateUtils.js` 92%, `storage.js` ~92%, `syncService.js` ~95%, `taskMutations.js` 97%.
- Partially covered: `exportService.js` ~67–68%, `fileStorage.js` ~67%, `vaultService.js` ~64%, `TaskContext.js` ~60% (AppState listener, refresh-from-storage, notification branches uncovered at L50/56/77/85/91–101/110–111/117–120/130–133/143–154/165/173/191–193/200–201/214–216/221–223/228–230/235–237).
- Zero coverage (priority-ordered): **all screens 0%**, `theme/*` 0%, `aiService.js` 0%, `notifications.js` ~1% (was 0 — one line now hit incidentally), `diagnostics.js` 0%, `vaultImport.js` 0%, `billingStorage.js` ~21%, `billingNotifications.js` ~10%, **all three new providers 0%: `BillingContext.js`, `BirthdayContext.js`, `VaultContext.js`**.
- Structural gap (still open): `__tests__/phase12-widget-logic.test.js` re-implements toggle/sort helpers locally instead of importing `src/utils/taskMutations.js` / the widget handler — passes while production drifts. Replace with real imports now that the shared module exists (trivial win).
- Missing types: no component/integration/E2E tests; no conflict/race test for widget↔app concurrent writes; no `clearAllCaches` shield test beyond migration units; no checksum/pinning test (blocked on AI-model fix).

## Recommended Next Investigations (esp. relevant to Phase 18)

1. **Kill the dual-writer path first**: delete legacy `App.js` task handlers, route screens through `useTasks()`, remove `AppNavigator` fallbacks and raw `setTasks` escape hatches — with the 109-test suite green before/after.
2. **Fix `TaskContext` initial-prop sync** (mount-once or revision-gated) and add a regression test: context edit → stale `initialTasks` arrival → edit must survive.
3. **Prove widget↔app convergence**: concurrent-write test (foreground edit + widget toggle) against `refreshTasksFromStorage`; consider revision counter or per-task keys.
4. **Fold notification-id assignment into the persisted write** so spawned-recurrence alarms survive reloads; document the widget-schedules-nothing limitation.
5. **Extract `toggleDailyTask` as the second shared pure module** (Search/Daily/`App.js` loadData) with streak tests — rehearses the Phase 18 pattern on a small surface.
6. **Close the small chores**: `git rm --cached build/kwestup-v3.0.1.apk` + ignore `build/`; delete `.eslintrc.js`; replace `phase12-widget-logic` copies with real `taskMutations.js` imports; add `notifications.js` scheduling + `fileStorage.js` sanitizer/traversal tests.
7. **Android/native audit** (still unexamined): `patch-llama-gradle.js` regex fragility, `RNWidgetUtil.java` patch interaction with widget re-render throttling, `versionCode 7` bump discipline, and Binder-payload limits on large task lists.

---

*Concerns audit: 2026-09-28*
