# Codebase Concerns

**Analysis Date:** 2026-10-04

## Tech Debt

**Satellite `expo-*` pins stale after SDK 57 core bump (WR-01, UNFIXED — highest Phase 22 risk):**
- Issue: `expo` was bumped `~53.0.20` → `~57.0.0` (`package.json:28`) but every lockstep satellite pin was left at pre-upgrade versions: `expo-camera ~16.1.11`, `expo-clipboard ~7.0.1`, `expo-dev-client ~5.2.4`, `expo-document-picker ~13.1.6`, `expo-file-system ~18.1.11`, `expo-font ~13.3.2`, `expo-haptics ~14.1.4`, `expo-linear-gradient ~14.1.5`, `expo-notifications ~0.31.4`, `expo-sharing ~13.1.5`, `expo-status-bar ~2.2.3`, `expo-build-properties ~0.14.8` (`package.json:29-40`), plus `react-native-reanimated ~3.17.4` (SDK 57 bundles ~4.5) and `react-native-gesture-handler ~2.24.0` (SDK 57 bundles ~2.32) (`package.json:46,49`). `app.json` still declares `"sdkVersion": "53.0.0"`. Expo documents these packages as supporting only their target SDK's RN version. A hand-edited core-only bump risks native-module/JS-API mismatches surfacing as Gradle/Pod build failures or runtime crashes, not install errors. For Phase 22 this is load-bearing: the Unified Notification Service builds on `expo-notifications`, which is itself one of the stale pins — its trigger API shape (`Date` object vs `SchedulableTrigger`) may change under the realignment.
- Files: `package.json:28-51`, `app.json` (`sdkVersion` field)
- Impact: Any Phase 22 notification-engine work written against `expo-notifications@0.31.4` trigger semantics may need rework after `npx expo install --fix` lands; a latent native mismatch can red Android builds with no JS-level signal.
- Fix approach: Run the official path BEFORE Phase 22 engine code, then re-verify: `npx expo install expo@^57.0.0 --fix && npx expo-doctor@latest`, commit aligned pins (incl. reanimated ~4.5, gesture-handler ~2.32, worklets ~0.10), bump `app.json` `sdkVersion` to `57.0.0`, and re-run the full gate (`npm ci`, `npm run typecheck`, `npm run lint`, `npx jest --ci --coverage`) plus an Android native build. Deliberately skipped in 21-REVIEW-FIX (no safe atomic hand-edit; needs networked validation) — see `.planning/phases/21-technology-platform-upgrade-expo-sdk-57-rn-0-86-node-22/21-REVIEW-FIX.md`.

**Type gate scope exclusions (`checkJs:false`, `widgets/` excluded):**
- Issue: `npm run typecheck` (`tsc --noEmit`) passes exit 0 (verified 2026-10-04), but the gate does not check the highest-risk files. `allowJs:true, checkJs:false` leaves all of `src/utils/*.js` (`src/utils/billingStorage.js`, `src/utils/notifications.js`, `src/utils/vaultImport.js`, `src/utils/aiService.js`, `src/utils/exportService.js`, `src/utils/storage.js`) unchecked. `include` covers `src/**/*`, `__tests__/**/*`, and root config scripts, but `App.js` / `index.js` are out of scope because they import `./widgets/*`, and `exclude` drops `widgets/**/*` entirely. A clean typecheck does not mean the shipped JS is type-safe.
- Files: `tsconfig.json`, `src/utils/*.js`, `App.js` (1078 lines), `index.js`, `widgets/TasksListWidget.tsx`, `widgets/widget-task-handler.tsx`
- Impact: Type errors in billing, notification, vault-import, and widget-handler code reach production undetected; any executor trusting "typecheck green" as full safety is mistaken.
- Fix approach: Phased `checkJs` enablement before Phase 22 (1152 pre-existing JS errors already triaged per the `tsconfig.json` comment — fix file-by-file starting with `src/utils/billingStorage.js`, `src/utils/notifications.js`, `src/utils/vaultImport.js` which already carry runtime validation); fix the 2 `flex` excess-prop style-type errors in `widgets/TasksListWidget.tsx` so the `widgets/**/*` exclusion can be lifted during Phase 25 widget-engine hardening.

**ESLint warnings bank (~480 warnings, 0 errors):**
- Issue: `npm run lint` exits 0 with ~480 warnings (480 counted 2026-10-04 in 21-REVIEW-FIX verification, up from 429 on 2026-10-01 — the count is growing) — predominantly `no-console` (raw `console.*` in `src/context/BillingContext.js`, `src/context/VaultContext.js`, `src/utils/billingNotifications.js:73,85`, `src/screens/*`, `src/navigation/AppNavigator.js`), plus `no-unused-vars` and `react-native/*` style warnings. CI runs plain `npm run lint` without `--max-warnings=0`, so the warning count grows unboundedly without failing anything.
- Files: `eslint.config.js`, `.github/workflows/ci.yml`, `src/context/BillingContext.js`, `src/context/VaultContext.js`, `src/utils/billingNotifications.js`, `babel.config.js`
- Impact: Real new violations hide in the noise; `babel-plugin-transform-remove-console` strips `console.*` in production bundles, masking rule violations instead of failing lint.
- Fix approach: Triage the warnings, then escalate `no-console` from `warn` to `error` and add `--max-warnings=0` to the CI lint step before Phase 22 (both steps are already annotated as phased enforcement in `eslint.config.js` and `.github/workflows/ci.yml`).

**`postinstall` native patch script hardened but still regex-patching `node_modules` (WR-02/WR-03 fixed, IN-01/IN-02 open):**
- Issue: `postinstall: node patch-llama-gradle.js` rewrites `node_modules/llama.rn/android/build.gradle` (old-architecture plugin force-apply) and `node_modules/react-native-android-widget/.../RNWidgetUtil.java` (widget sizing fallbacks). Phase 21 review-fix (commit `4cbce1f`) replaced whole-file substring guards with per-pattern replacement-count assertions (`before1/didPatch1`, `before2/didPatch2`, `beforeWidth/didPatchWidth` in `patch-llama-gradle.js:32-38,137-141`), scoped the widget idempotency guard to the injected call signature (`getFallbackSize(context, widgetId` at `patch-llama-gradle.js:86`), and made both missing-target branches fail closed (`console.error` + `hasErrors = true`, `patch-llama-gradle.js:62-68,155-161`). Idempotency verified (two consecutive runs, stable counts, exit 0). Residual fragility: (a) IN-01 — all `fs.readFileSync`/`writeFileSync` calls (`patch-llama-gradle.js:10,57,73-74,151`) are outside `try/catch`, so `EACCES`/`ENOSPC`/TOCTOU failures surface as raw Node stack traces instead of the script's clean diagnostics; (b) IN-02 — the injected Java hardcodes widget provider suffixes (`TasksList`, `FocusTimer`, `DailyTasks`, `ImportantTasks` at `patch-llama-gradle.js:124,126`) and magic dimensions (`180`/`250`, `100`/`250` at lines 125,127,133) with an empty `catch (Exception e)` swallowing diagnostics (`patch-llama-gradle.js:130-132`); renaming a widget provider silently yields wrong-but-plausible fallback sizes. Any `llama.rn` or `react-native-android-widget` upgrade that restructures the upstream files fails the install loudly now (good) but still requires a manual pattern update in the script.
- Files: `package.json:16`, `patch-llama-gradle.js` (165 lines)
- Impact: Supply-chain surface plus fragile native builds — a routine dep bump fails `npm ci` (fail-closed, intended) until someone hand-edits the regexes; IN-02 staleness produces silently wrong widget sizes with no signal.
- Fix approach: Wrap each read/transform/write section in `try/catch` (IN-01); hoist injected-Java dimensions to named constants and add `Log.w` in the catch (IN-02); long-term migrate both patches to `patch-package` with committed patch files plus a CI step asserting the patch applied. Re-verify explicitly after every native upgrade per Master Plan §25 — especially after the WR-01 satellite realignment, which may touch `expo-build-properties` native config.

**Local test script fixed; coverage still unenforced:**
- Issue: `package.json` `"test": "jest"` no longer passes `--passWithNoTests` (fixed in Phase 21) — empty suites now fail fast locally. What remains: `jest.config.js` deliberately defines no `coverageThreshold` (current ~28% lines / ~17% functions per the config comment); CI collects `--coverage` as a tracking artifact only. Master Plan §24 targets (70/90/95) are unenforced.
- Files: `package.json:13`, `jest.config.js`, `.github/workflows/ci.yml`
- Impact: Phase 22/24 engine work can land without regression protection; coverage can regress silently.
- Fix approach: Raise thresholds toward §24 targets as Phase 22/24 engine suites land; add the first threshold (even a low floor that ratchets) before Phase 22 so regressions fail CI.

**God files (`App.js`, `aiService.js`):**
- Issue: `App.js` (1078 lines) mixes providers, navigation wiring, font loading, and startup sequencing; `src/utils/aiService.js` (1064 lines) mixes model download, resumable-download state, SHA-256 verification, intent parsing, and TODO extraction. Both are hard to review, hard to test in isolation, and high-blast-radius for merge conflicts.
- Files: `App.js`, `src/utils/aiService.js`, `src/utils/exportService.js` (381 lines), `src/context/TaskContext.js` (366 lines)
- Impact: Every Phase 22–28 engine integration touching startup, AI, or tasks risks collateral breakage in these files.
- Fix approach: Split `App.js` into a composition root plus `src/startup/*` initializers; extract intent-parsing/TODO-extraction from `aiService.js` into `src/ai/*` pure modules with unit tests (no new behavior, pure moves).

## Known Bugs

**Legacy notification schedulers bypass `BehavioralNotificationPolicy` (grandfathered, unenforced):**
- Symptoms: `scheduleDailyTaskNotification`, `schedulePushNotification`, and `scheduleDueDateNotification` schedule directly via `expo-notifications` with no quiet-hours check (22:00–08:00), no 3/day cap, no 90-min gap, no 30-min dedup. `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` in `src/services/types.ts` is imported by nothing at runtime. The pure guard `canDispatchBehavioralNotification()` (`src/utils/notifications.js:66-89`) exists and is unit-covered, but no caller routes through it.
- Files: `src/utils/notifications.js:93-160`, `src/services/types.ts`, `src/context/TaskContext.js`, `src/screens/DailyTasksScreen.js`
- Trigger: Any behavior/task reminder scheduled overnight or more than 3×/day fires unthrottled on a real device.
- Workaround: Grandfather notices + `@deprecated` tags mark the three legacy schedulers; do not add new call sites against `expo-notifications` directly. Full consolidation into the guarded dispatcher is the defined Phase 22 scope.

**Unguarded 6th schedule call site in `App.js` (focus-timer completion fires outside all policy):**
- Symptoms: `App.js:703` calls `Notifications.scheduleNotificationAsync({ trigger: null })` fire-and-forget on focus-session completion — no `try/catch`, no permission check, no quiet-hours/cap/gap routing, and no persisted ID (uncancellable). It is the only schedule call site outside `src/utils/notifications.js` and `src/utils/billingNotifications.js`, and it is NOT covered by the grandfather notice (which names only the three legacy schedulers plus birthday reminders).
- Files: `App.js:703-711`
- Trigger: Completing a focus session at any hour fires an immediate notification, including inside 22:00–08:00 quiet hours.
- Workaround: Route this call through the Phase 22 guarded dispatcher (immediate triggers still count against cap/gap); persist or drop the returned ID explicitly.

**`scheduleDueDateNotification` accepts invalid/ambiguous input silently:**
- Symptoms: Returns bare `null` for missing `dueDate`, past dates, and OS rejections alike — callers cannot distinguish the three (`src/utils/notifications.js:141-160`). `trigger` is passed a raw `Date` object with no wall-clock normalization note. Note: after the WR-01 satellite realignment, `expo-notifications` may require `SchedulableTrigger` (`{ type, date }`) instead of a bare `Date` — this call site will need re-verification against the realigned SDK.
- Files: `src/utils/notifications.js:141-160`
- Trigger: Schedule a task with a malformed or past `dueDate`.
- Workaround: `scheduleDailyTaskNotification` already validates `HH:MM` with a regex plus `logger.error`; apply the same typed-result pattern here in Phase 22.

**Billing analytics silently coerce bad amounts to 0:**
- Symptoms: `toAmount()` in `src/utils/billingStorage.js` maps any non-finite amount (strings that don't parse, `undefined`, objects) to `0`, so `getSpendingByCategory`/`getMonthlyTotals` under-report instead of surfacing corrupt transactions. This is the safe-partial residue of CR-03 (raw `+` concatenation was fixed; silent-zero coercion remains).
- Files: `src/utils/billingStorage.js`
- Trigger: A transaction persisted with `amount: "abc"` or a missing amount disappears from totals without warning.
- Workaround: None at runtime; consider logging/skipping corrupt rows with a count so the UI can flag data-quality issues.

**Billing reminder crashes on non-numeric amount; uses raw `console.error`:**
- Symptoms: `scheduleRecurringBillReminder` interpolates `bill.amount.toFixed(2)` (`src/utils/billingNotifications.js:69`) with no numeric guard — a bill with a string/missing amount throws `TypeError` instead of scheduling. Both schedule and cancel paths log via raw `console.error` (`src/utils/billingNotifications.js:73,85`), bypassing the `logger` redaction pipeline and tripping the `no-console` lint warning. `getNextDueDate`/`getNotifyDate` do pure date math with no quiet-hours awareness (09:00 anchor is fine, but `notifyDaysBefore` arithmetic can land inside quiet hours — Phase 22 must decide whether billing reminders count toward the 3/day cap).
- Files: `src/utils/billingNotifications.js:11-73,85`
- Trigger: A recurring bill persisted with `amount: "abc"` or `amount: undefined` crashes the reminder path; any billing reminder scheduled overnight fires unthrottled.
- Workaround: Reuse the `toAmount()` validation from `src/utils/billingStorage.js` before `toFixed`; swap `console.error` for `logger.error` (also clears two lint warnings).

## Security Considerations

**All at-rest data is AsyncStorage plaintext:**
- Risk: Billing transactions/budgets, task lists, vault indexes, timer state, and user names persist via unencrypted `AsyncStorage`. Only exported backup archives get AES-256 (`src/utils/exportService.js` v2 envelope: PBKDF2-HMAC-SHA256 100k iterations, random salt/IV). A rooted device, backup extraction, or companion-app read exposes financial and behavioral data in the clear.
- Files: `src/utils/storage.js`, `src/utils/billingStorage.js`, `src/utils/vaultService.js`, `src/context/TaskContext.js`, `src/utils/exportService.js`
- Current mitigation: Encrypted export path with legacy-v1 fallback decrypt; no telemetry egress (offline-first posture); logger redaction before buffering.
- Recommendations: Evaluate `expo-secure-store` for billing data + vault index keys at the Phase 22/24 boundary; document the plaintext-at-rest posture in `rulebook/rules/privacy.md` so it is an explicit decision, not an accident.

**Legacy v1 backup decrypt path weakens passphrase KDF:**
- Risk: `decryptBackup` in `src/utils/exportService.js` transparently falls back to legacy v1 decryption (static salt, 1,000 PBKDF2 iterations) for old archives. Any v1 archive in the wild remains brute-forceable at ~100× lower cost, and the auto-fallback means a downgraded envelope is accepted silently.
- Files: `src/utils/exportService.js`
- Current mitigation: New archives always write v2 (100k iterations, random salt/IV).
- Recommendations: On successful v1 decrypt, force immediate v2 re-encrypt and warn the user to delete old archives; add an `iterations` floor check that rejects envelopes below a minimum.

**Logger redaction regex missing Phase 22 behavioral keys:**
- Risk: `SENSITIVE_KEYS` in `src/utils/logger.js` covers `content|body|note|title|text|message|passphrase|token|key|secret|password` but not `habitTitle`/`cueText`. Notification bodies, habit titles, and cue labels can land verbatim in the 50-entry forensic ring-buffer and therefore in the copy-pasteable crash report from `src/components/ErrorBoundary.js`. Phase 22 makes this worse: every notification payload flows through the new dispatcher, multiplying redaction-relevant log lines.
- Files: `src/utils/logger.js`, `src/components/ErrorBoundary.js`, `rulebook/rules/privacy.md`
- Current mitigation: Key-based redaction before buffering, string length caps, cycle guard; `debug`/`info` fully gated out of production.
- Recommendations: Apply the mandated Phase 22 extension (`habitTitle|cueText` in the regex) when the Unified Notification Service lands; add a regression test asserting behavioral keys redact (extends `__tests__/unit/logger.test.js` CR-01 coverage).

**Semgrep scan is non-blocking; CI actions float on major tags:**
- Risk: The `semgrep` job runs with `continue-on-error: true`, so high-severity findings never red the gate. `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, and `returntocorp/semgrep-action@v1` float on mutable major tags rather than SHAs.
- Files: `.github/workflows/ci.yml`
- Current mitigation: `permissions: contents: read`, `concurrency` cancel-in-progress, Node 22, `npm ci` — all already fixed in the Phase 20 review-fix.
- Recommendations: Enforce the Semgrep gate (remove `continue-on-error` after triaging the baseline) and pin actions to SHAs before Phase 22.

## Performance Bottlenecks

**Sequential vault import with per-file round-trips:**
- Problem: `importMDFilesAsVault` in `src/utils/vaultImport.js` reads and writes each file sequentially (`readAsStringAsync` → `getInfoAsync` → `writeAsStringAsync`, plus a collision-probing `getInfoAsync` loop). Collision suffix probing is linear per file.
- Files: `src/utils/vaultImport.js`
- Cause: No batching or concurrency; each file costs 2–4 serialized native-bridge round-trips.
- Improvement path: Acceptable at the enforced caps (≤50 files, ≤1 MB each); if caps ever rise, batch `getInfoAsync` probes and parallelize reads with a small concurrency limit, keeping per-file try/catch isolation.

**On-device model download state in AsyncStorage:**
- Problem: Resumable-download bookkeeping (`RESUMABLE_DOWNLOAD_KEY`) in `src/utils/aiService.js` does JSON parse/stringify of download state through AsyncStorage on progress ticks — AsyncStorage is slow and shared with UI-critical reads.
- Files: `src/utils/aiService.js`
- Cause: Progress persistence coupled to the same storage lane as tasks/billing/vaults.
- Improvement path: Throttle progress writes (e.g., every N percent or M seconds) and move transient download state to memory, persisting only resume checkpoints.

## Fragile Areas

**Old Architecture lock-in (NothingOS/Snapdragon crash — do NOT flip `newArchEnabled`):**
- Files: `android/gradle.properties:46-60`, `patch-llama-gradle.js:6-68`
- Why fragile: `newArchEnabled=false` is load-bearing, with a documented root cause (2026-06-05 debug session `newarch-startup-crash-v2`): `DefaultNewArchitectureEntryPoint.load()` (Fabric C++ init) conflicts with NothingOS `NtOnlineConfigImpl` injection on Nothing Phone 3a (Snapdragon 7s Gen 3) — startup crash regardless of JS modules loaded. `llama.rn`'s `RNLlamaModule.install()` targets the Old Arch bridge (`getCatalystInstance().getJSCallInvokerHolder()`), which is exactly what the postinstall patch force-enables. Flipping the flag reintroduces the startup crash AND invalidates the llama patch's reason for existing. The reanimated ~3.17.4 → ~4.5 jump in the WR-01 realignment is the sharp edge here: reanimated 4.x is Fabric-first, and its Old Arch compatibility path must be verified on a NothingOS device, not just the emulator.
- Safe modification: Re-enable ONLY if (a) non-NothingOS stability is confirmed AND (b) `llama.rn` moves to `ReactContext.getJSCallInvoker()` (New Arch API). Any planner proposing New Arch migration must budget NothingOS-device validation as a first-class gate.
- Test coverage: None — this is a native/device constraint invisible to Jest. Manual device matrix only.

**16 KB page-size readiness unverified in-repo:**
- Files: `android/gradle.properties`, `app.json` (`expo-build-properties` plugin block with only `ios.useFrameworks: static` — no `android` block)
- Why fragile: STATE.md claims 16 KB page-size linker flags were preserved through Phase 21, but no `pageSize`, `align`, or `16KB` token was found in `android/gradle.properties`, `app.json`, or `package.json` during this audit. Either the flags live in generated native projects (not committed) or the claim is aspirational. Android 15+ devices with 16 KB pages crash non-compliant native libraries at load — and `llama.rn` ships prebuilt native code, the highest-risk component for page-size noncompliance.
- Safe modification: Before Phase 22, confirm where the 16 KB flags live (`android/app/build.gradle` NDK `pageSize` / Expo `expo-build-properties` `android.extraProguardRules` or equivalent) and add an explicit check; do not assume compliance from STATE.md alone.
- Test coverage: None possible in Jest — requires `check_elf_alignment.sh` or Play Console pre-launch report on a 16 KB device image.

**Headless widget surface (`widgets/`):**
- Files: `widgets/TasksListWidget.tsx`, `widgets/widget-task-handler.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/FocusTimerWidget.tsx`
- Why fragile: Behavior-critical per Master Plan §9, yet excluded from typecheck (2 pre-existing `flex` excess-prop style-type errors in `TasksListWidget.tsx`); depends on `react-native-android-widget` whose native sizing code is regex-patched at install time by `patch-llama-gradle.js`; headless handler runs outside the React tree so errors surface as silent widget staleness, not crash reports.
- Safe modification: Change one widget at a time, verify with `__tests__/unit/phase12-widget-logic.test.js`, and never widen the `widgets/**/*` exclusion to cover new files.
- Test coverage: Only widget *logic* is unit-tested; no rendering/integration coverage for the headless handler path.

**Notification scheduling matrix (Phase 22 consolidation target — read this before planning):**
- Files: `src/utils/notifications.js` (284 lines), `src/utils/billingNotifications.js` (93 lines), `src/context/TaskContext.js`, `src/screens/DailyTasksScreen.js`, `src/context/BirthdayContext.js`, `App.js:703-711`, `src/services/types.ts`
- Why fragile: SIX scheduling call-site families with overlapping but inconsistent validation: (1) daily tasks (`scheduleDailyTaskNotification`, HH:MM regex-validated), (2) immediate push (`schedulePushNotification`, no validation at all), (3) due dates (`scheduleDueDateNotification`, silent-null on bad input), (4) birthdays (`scheduleCustomBirthdayReminders`, 2-year pre-scheduling with Feb-29 handling — the most hardened path), (5) billing reminders (`scheduleRecurringBillReminder`, `toFixed` crash risk + raw `console.error`), (6) focus-timer completion (`App.js:703`, unguarded fire-and-forget, uncancellable). Policy constants are duplicated between the guard default args (`src/utils/notifications.js:66`) and `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` (`src/services/types.ts`). Birthday scheduling pre-creates 2 years of notifications with no cap-awareness — under a 3/day cap, a birthday + advance reminder can consume 2 of 3 daily slots.
- Safe modification: Route every new schedule through `canDispatchBehavioralNotification()`; keep `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` as the single numeric source (guard default args should reference it, not restate `3/90/30`); decide explicitly whether billing/birthday/focus-timer notifications count toward the behavioral cap before writing the dispatcher (rulebook `reminders.md` says "maximum 3 push notifications per calendar day across all active habits and task reminders combined" — billing and birthday scope is ambiguous).
- Test coverage: Guard pure-function coverage exists; no integration test asserts end-to-end quiet-hours/cap behavior on device. Birthday Feb-29/DST edge cases have the best coverage of any scheduler — use them as the pattern for the new dispatcher tests.

**Storage migration chain:**
- Files: `src/utils/storage.js`, `src/utils/billingStorage.js`, `src/utils/vaultService.js`
- Why fragile: Version-keyed migration (`STORAGE_VERSION`) walks multiple legacy key namespaces with best-effort fallbacks; a wrong version bump orphans user data silently (loaders return defaults, not errors). Phase 22 adds risk: the notification dispatcher will need persisted dispatch history (for cap/gap/dedup) — a new storage namespace that must join the migration chain correctly from day one.
- Safe modification: Any `STORAGE_VERSION` bump requires a migration-path test in `__tests__/unit/storageMigration.test.js` covering every legacy key touched. Design the Phase 22 dispatch-history store with its own versioned key and a "missing history = empty history, not error" loader default.
- Test coverage: `storageMigration.test.js`, `vaultAndFileStorage.test.js`, and `exportImportService.test.js` cover the known paths; unknown-legacy-shape fuzzing does not exist.

**`FactualReward` dual-vocabulary aliases:**
- Files: `src/behavior/types.ts`, `src/commands/types.ts`
- Why fragile: `milestoneType` accepts both the 7 canonical Master Plan §10 categories and 4 legacy aliases (`first_completion`, `consistency_streak`, `recovery_success`, `fast_activation`) until the Phase 24 migration renames stored rewards. Every consumer must handle both vocabularies; a strict-equality check on one vocabulary silently misses the other.
- Safe modification: Normalize at the read boundary (map legacy → canonical on load) and never persist new legacy values; remove the alias union in Phase 24.
- Test coverage: No exhaustiveness test forces handler updates when a variant is added (flagged in review WR-06 lineage).

## Scaling Limits

**Forensic log buffer (50 entries):**
- Current capacity: 50-entry in-memory FIFO (`MAX_LOG_BUFFER_SIZE` in `src/utils/logger.js`).
- Limit: High-frequency warn/error loops evict the causal breadcrumb before the crash report is built. Phase 22 increases pressure: a guarded dispatcher that logs every suppression decision (quiet-hours defer, cap hit, dedup drop) can churn the buffer under reminder bursts.
- Scaling path: Keep the cap (memory-bounded by design); add loop-suppression/dedup counting instead of raising the limit; log dispatch *decisions* at `debug` (gated out of production) and only *failures* at `warn`/`error`.

**Vault import caps:**
- Current capacity: 50 files, 1 MB per file (`MAX_FILES`/`MAX_FILE_BYTES` in `src/utils/vaultImport.js`).
- Limit: Power users with large vaults hit a hard reject with only a `logger.warn`.
- Scaling path: Surface a user-facing message with counts, and consider chunked background import if the cap is ever raised.

**Birthday 2-year pre-scheduling vs Phase 22 cap:**
- Current capacity: `scheduleCustomBirthdayReminders` (`src/utils/notifications.js:178-269`) pre-schedules this year + next year (up to 2 birthday + 2 advance = 4 notifications per birthday contact).
- Limit: Under Phase 22 enforcement, pre-scheduled OS-level notifications bypass the JS-layer dispatcher entirely — the cap/gap/dedup logic cannot throttle what is already handed to the OS. Every pre-scheduled birthday notification is cap-invisible.
- Scaling path: Phase 22 must decide: either exempt pre-scheduled birthday/billing notifications from the cap (document in `rulebook/rules/reminders.md`) or replace pre-scheduling with dispatcher-owned just-in-time scheduling. Do not leave it ambiguous — silent over-delivery is the failure mode.

## Dependencies at Risk

**`expo-notifications@~0.31.4` stale pin + Phase 22 builds on it:**
- Risk: Stale per WR-01 (SDK 57-era pin differs); the trigger API is the specific breakage surface — newer `expo-notifications` versions replaced bare `Date` triggers with typed `SchedulableTrigger` objects and changed daily-trigger shapes. All four `scheduleNotificationAsync` call sites in `src/utils/notifications.js:101,124,146,218,242`, the billing call site (`src/utils/billingNotifications.js:65`), and `App.js:703` use the OLD trigger shapes.
- Impact: Writing the Phase 22 dispatcher against the old API then realigning (or vice versa) means double work or runtime `trigger` rejection on device.
- Migration plan: Realign FIRST (`npx expo install --fix`), read the new `trigger` type, then write the dispatcher against the realigned API. Verify each call site's trigger shape on a real Android device (Nothing Phone 3a in the matrix — NothingOS notification channels have OEM-specific behavior).

**`llama.rn@0.12.4` native patch coupling:**
- Risk: Exact-pinned (good), but its Android `build.gradle` is regex-rewritten by `patch-llama-gradle.js` on every install. Any 0.12.x → 0.13 upgrade can invalidate the regex — now fails loudly at install (WR-02 fix) instead of silently, but still blocks `npm ci` until the patterns are updated.
- Impact: Android build breaks; on-device AI (Phase 18 pipeline) stops working.
- Migration plan: Verify the patch explicitly after every native upgrade (Master Plan §25); long-term, upstream the old-architecture support or fork-pin the Gradle file.

**`react-native-android-widget@^0.16.1` caret range + native patch:**
- Risk: Caret range permits minor bumps while `RNWidgetUtil.java` is regex-patched for sizing fallbacks; upstream changes to `getWidgetWidth`/`getWidgetHeight` break the patch match or duplicate `getFallbackSize`. Guard now scoped to the injected signature (`patch-llama-gradle.js:86`), so upstream-same-name helpers no longer false-skip — but an upstream restructure still fails the install until the `patternWidth` regex (`patch-llama-gradle.js:76`) is updated, and IN-02 hardcoded provider suffixes rot independently of the patch.
- Impact: Widget sizing regressions on specific launchers/orientations; failed installs on minor bumps.
- Migration plan: Exact-pin alongside `llama.rn`, or move the sizing fix into a `patch-package` patch with a CI verification step.

**`react-native-reanimated ~3.17.4` / `gesture-handler ~2.24.0` major-version staleness:**
- Risk: SDK 57 bundles reanimated ~4.5 / gesture-handler ~2.32 / worklets ~0.10 — the installed majors are a full generation behind. Reanimated 3→4 is a breaking major (worklets extracted to a separate package, Fabric-first execution model). The app runs Old Arch (`newArchEnabled=false`), and reanimated 4's Old Arch fallback path is the least-tested configuration upstream.
- Impact: The WR-01 realignment is not a patch bump — it is a major migration for the animation stack, with potential API breaks in every screen using shared-element transitions or gesture-driven components, compounded by the Old Arch lock-in above.
- Migration plan: Treat reanimated/gesture-handler realignment as its own verification gate inside the WR-01 follow-up: after `expo install --fix`, smoke-test every animated surface (confetti cannon, modals, drawer navigation, focus-timer transitions) on both emulator and the NothingOS device before committing.

## Missing Critical Features

**No notification enforcement layer (Phase 22 scope):**
- Problem: Quiet hours, daily cap, gap, dedup, `maximumRepeatedReminderCount` suppression, `priorityRules` arbitration, and `userOptOut` kill-switch exist as types/constants/grandfathered guard only — nothing enforces them at dispatch time. Six call-site families (not three — the grandfather notice undercounts: billing + `App.js` focus-timer are unlisted) must be consolidated, and the birthday 2-year pre-scheduling model is architecturally incompatible with a dispatch-time cap.
- Blocks: Any behavioral intervention work (Phase 25) that assumes throttled delivery; store-review risk from notification spam.

**No coverage gate (thresholds undefined):**
- Problem: `jest.config.js` deliberately defines no `coverageThreshold` (current ~28% lines / ~17% functions per the config comment); CI collects `--coverage` as a tracking artifact only. Master Plan §24 targets (70/90/95) are unenforced.
- Blocks: Confidence in Phase 22/24 engine work landing without regression protection.

## Test Coverage Gaps

**Untested areas (no suites exist):**
- What's not tested: `widgets/widget-task-handler.tsx` headless dispatch path; `src/utils/billingNotifications.js` (including the `toFixed` crash path); `src/context/BillingContext.js` / `src/context/VaultContext.js` / `src/context/BirthdayContext.js`; `App.js` startup sequencing and the `App.js:703` focus-timer notification path; `src/navigation/*`; `src/screens/*`; `patch-llama-gradle.js` patch-idempotency (verified manually twice in 21-REVIEW-FIX but not as a committed test — a regression reintroducing double-patch duplication would not be caught by CI).
- Files: `widgets/**/*`, `src/utils/billingNotifications.js`, `src/context/*.js`, `App.js`, `src/navigation/AppNavigator.js`, `patch-llama-gradle.js`
- Risk: Widget-tap double-fire (no idempotency-executor test despite `idempotencyKey` being required by `src/commands/types.ts`), billing-reminder scheduling regressions, and startup-order breakage all ship silently.
- Priority: High — widget idempotency + billing notifications before Phase 25; notification-dispatcher suites as Phase 22's first deliverable (guard exists, dispatcher does not); startup smoke (`__tests__/unit/aiAssistant-smoke.test.js` pattern extended) before any further native upgrade.

**Thin existing coverage:**
- What's not tested: Integration paths (scheduler → Expo → cancellation round-trip), storage-migration unknown shapes, export encrypt/decrypt round-trip at scale, DST transition weekends for advance reminders. The birthday advance-reminder wall-clock re-assertion (`src/utils/notifications.js:239`) has no DST-transition test despite being the exact class of bug (quiet-hours drift) Phase 22 must eliminate.
- Files: `src/utils/notifications.js`, `src/utils/storage.js`, `src/utils/exportService.js`, `__tests__/unit/*`
- Risk: Medium — pure-function guards are covered, but the seams between modules (where the Phase 20 review found every CR) have no tests.
- Priority: Medium — add as Phase 22/24 engine suites land, raising thresholds toward §24 targets. First test to write in Phase 22: quiet-hours deferral round-trip (`canDispatchBehavioralNotification` → reschedule at 08:01 → dispatch), because every other enforcement property depends on the clock being right.

---

*Concerns audit: 2026-10-04*
