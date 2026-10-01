# Codebase Concerns

**Analysis Date:** 2026-10-01

## Tech Debt

**Type gate scope exclusions (`checkJs:false`, `widgets/` excluded):**
- Issue: `npm run typecheck` (`tsc --noEmit`) passes exit 0 (verified 2026-10-01), but the gate does not check the highest-risk files. `allowJs:true, checkJs:false` leaves all of `src/utils/*.js` (`src/utils/billingStorage.js`, `src/utils/notifications.js`, `src/utils/vaultImport.js`, `src/utils/aiService.js`, `src/utils/exportService.js`, `src/utils/storage.js`) unchecked. `include` covers `src/**/*`, `__tests__/**/*`, and root config scripts, but `App.js` / `index.js` are out of scope because they import `./widgets/*`, and `exclude` drops `widgets/**/*` entirely. A clean typecheck does not mean the shipped JS is type-safe.
- Files: `tsconfig.json`, `src/utils/*.js`, `App.js` (1067 lines), `index.js`, `widgets/TasksListWidget.tsx`, `widgets/widget-task-handler.tsx`
- Impact: Type errors in billing, notification, vault-import, and widget-handler code reach production undetected; any executor trusting "typecheck green" as full safety is mistaken.
- Fix approach: Phased `checkJs` enablement before Phase 22 (1152 pre-existing JS errors already triaged per the `tsconfig.json` comment — fix file-by-file starting with `src/utils/billingStorage.js`, `src/utils/notifications.js`, `src/utils/vaultImport.js` which already carry runtime validation); fix the 2 `flex` excess-prop style-type errors in `widgets/TasksListWidget.tsx` so the `widgets/**/*` exclusion can be lifted during Phase 25 widget-engine hardening.

**ESLint warnings bank (429 warnings, 0 errors):**
- Issue: `npm run lint` exits 0 with **429 warnings** (verified 2026-10-01) — predominantly `no-console` (raw `console.*` in `src/context/BillingContext.js`, `src/context/VaultContext.js`, `src/utils/billingNotifications.js`, `src/screens/*`, `src/navigation/AppNavigator.js`), plus `no-unused-vars` and `react-native/*` style warnings. CI runs plain `npm run lint` without `--max-warnings=0`, so the warning count can grow unboundedly without failing anything.
- Files: `eslint.config.js`, `.github/workflows/ci.yml`, `src/context/BillingContext.js`, `src/context/VaultContext.js`, `src/utils/billingNotifications.js`, `babel.config.js`
- Impact: Real new violations hide in the noise; `babel-plugin-transform-remove-console` strips `console.*` in production bundles, masking rule violations instead of failing lint.
- Fix approach: Triage the ~429 warnings, then escalate `no-console` from `warn` to `error` and add `--max-warnings=0` to the CI lint step before Phase 22 (both steps are already annotated as phased enforcement in `eslint.config.js` and `.github/workflows/ci.yml`).

**`postinstall` native patch script runs unverified on every install:**
- Issue: `postinstall: node patch-llama-gradle.js` rewrites `node_modules/llama.rn/android/build.gradle` (old-architecture plugin force-apply) and `node_modules/react-native-android-widget/.../RNWidgetUtil.java` (widget sizing fallbacks) via regex replacement on every `npm install`/`npm ci`, with no checksum assertion, no idempotency guard beyond string matching, and no CI step verifying it ran. A `llama.rn` (pinned `0.12.4` exact) or `react-native-android-widget` upgrade that changes those upstream files silently breaks or double-applies the regex patch.
- Files: `package.json`, `patch-llama-gradle.js`
- Impact: Supply-chain surface plus fragile native builds — a routine dep bump can produce unbuildable Android output or silently unpatched widget sizing with no signal.
- Fix approach: Add a checksum/idempotency assertion plus a CI step asserting the patch applied (or migrate the patches into a `patches/` directory applied by `patch-package` with committed patch files); re-verify explicitly after every native upgrade per Master Plan §25.

**Local test script masks zero-test runs:**
- Issue: `package.json` keeps `"test": "jest --passWithNoTests"`, so a local `npm test` with zero collected tests exits green. CI correctly invokes `npx jest --ci --maxWorkers=2 --coverage` (no passthrough flag), but any contributor running the documented `npm test` gets false confidence.
- Files: `package.json`, `.github/workflows/ci.yml`
- Impact: Deleted/misconfigured test globs pass silently locally.
- Fix approach: Remove `--passWithNoTests` from the `test` script (keep it only for explicitly empty watch invocations, if at all).

**God files (`App.js`, `aiService.js`):**
- Issue: `App.js` (1067 lines) mixes providers, navigation wiring, font loading, and startup sequencing; `src/utils/aiService.js` (1064 lines) mixes model download, resumable-download state, SHA-256 verification, intent parsing, and TODO extraction. Both are hard to review, hard to test in isolation, and high-blast-radius for merge conflicts.
- Files: `App.js`, `src/utils/aiService.js`, `src/utils/exportService.js` (381 lines), `src/context/TaskContext.js` (366 lines)
- Impact: Every Phase 22–28 engine integration touching startup, AI, or tasks risks collateral breakage in these files.
- Fix approach: Split `App.js` into a composition root plus `src/startup/*` initializers; extract intent-parsing/TODO-extraction from `aiService.js` into `src/ai/*` pure modules with unit tests (no new behavior, pure moves).

## Known Bugs

**Legacy notification schedulers bypass `BehavioralNotificationPolicy` (grandfathered, unenforced):**
- Symptoms: `scheduleDailyTaskNotification`, `schedulePushNotification`, and `scheduleDueDateNotification` schedule directly via `expo-notifications` with no quiet-hours check (22:00–08:00), no 3/day cap, no 90-min gap, no 30-min dedup. `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` in `src/services/types.ts` is imported by nothing at runtime. The pure guard `canDispatchBehavioralNotification()` exists and is unit-covered, but no caller routes through it.
- Files: `src/utils/notifications.js`, `src/services/types.ts`, `src/context/TaskContext.js`, `src/screens/DailyTasksScreen.js`
- Trigger: Any behavior/task reminder scheduled overnight or more than 3×/day fires unthrottled on a real device.
- Workaround: Grandfather notices + `@deprecated` tags mark the three legacy schedulers; do not add new call sites against `expo-notifications` directly. Full consolidation into the guarded dispatcher is the defined Phase 22 scope.

**`scheduleDueDateNotification` accepts invalid/ambiguous input silently:**
- Symptoms: Returns bare `null` for missing `dueDate`, past dates, and OS rejections alike — callers cannot distinguish the three. `trigger` is passed a raw `Date` object with no wall-clock normalization note.
- Files: `src/utils/notifications.js`
- Trigger: Schedule a task with a malformed or past `dueDate`.
- Workaround: `scheduleDailyTaskNotification` already validates `HH:MM` with a regex plus `logger.error`; apply the same typed-result pattern here in Phase 22.

**Billing analytics silently coerce bad amounts to 0:**
- Symptoms: `toAmount()` in `src/utils/billingStorage.js` maps any non-finite amount (strings that don't parse, `undefined`, objects) to `0`, so `getSpendingByCategory`/`getMonthlyTotals` under-report instead of surfacing corrupt transactions. This is the safe-partial residue of CR-03 (raw `+` concatenation was fixed; silent-zero coercion remains).
- Files: `src/utils/billingStorage.js`
- Trigger: A transaction persisted with `amount: "abc"` or a missing amount disappears from totals without warning.
- Workaround: None at runtime; consider logging/skipping corrupt rows with a count so the UI can flag data-quality issues.

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
- Risk: `SENSITIVE_KEYS` in `src/utils/logger.js` covers `content|body|note|title|text|message|passphrase|token|key|secret|password` but not `habitTitle`/`cueText`. Notification bodies, habit titles, and cue labels can land verbatim in the 50-entry forensic ring-buffer and therefore in the copy-pasteable crash report from `src/components/ErrorBoundary.js`.
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

**Headless widget surface (`widgets/`):**
- Files: `widgets/TasksListWidget.tsx`, `widgets/widget-task-handler.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/FocusTimerWidget.tsx`
- Why fragile: Behavior-critical per Master Plan §9, yet excluded from typecheck (2 pre-existing `flex` excess-prop style-type errors in `TasksListWidget.tsx`); depends on `react-native-android-widget` whose native sizing code is regex-patched at install time by `patch-llama-gradle.js`; headless handler runs outside the React tree so errors surface as silent widget staleness, not crash reports.
- Safe modification: Change one widget at a time, verify with `__tests__/unit/phase12-widget-logic.test.js`, and never widen the `widgets/**/*` exclusion to cover new files.
- Test coverage: Only widget *logic* is unit-tested; no rendering/integration coverage for the headless handler path.

**Notification scheduling matrix:**
- Files: `src/utils/notifications.js`, `src/utils/billingNotifications.js`, `src/context/TaskContext.js`, `src/screens/DailyTasksScreen.js`, `src/services/types.ts`
- Why fragile: Four scheduling call-site families (daily tasks, push, due dates, birthdays, plus billing reminders in `src/utils/billingNotifications.js` which still uses raw `console.error`) with overlapping but inconsistent validation; policy constants duplicated between the guard default args and `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY`.
- Safe modification: Route every new schedule through `canDispatchBehavioralNotification()`; keep `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` as the single numeric source (guard default args should reference it, not restate `3/90/30`).
- Test coverage: Guard pure-function coverage exists; no integration test asserts end-to-end quiet-hours/cap behavior on device.

**Storage migration chain:**
- Files: `src/utils/storage.js`, `src/utils/billingStorage.js`, `src/utils/vaultService.js`
- Why fragile: Version-keyed migration (`STORAGE_VERSION`) walks multiple legacy key namespaces with best-effort fallbacks; a wrong version bump orphans user data silently (loaders return defaults, not errors).
- Safe modification: Any `STORAGE_VERSION` bump requires a migration-path test in `__tests__/unit/storageMigration.test.js` covering every legacy key touched.
- Test coverage: `storageMigration.test.js`, `vaultAndFileStorage.test.js`, and `exportImportService.test.js` cover the known paths; unknown-legacy-shape fuzzing does not exist.

**`FactualReward` dual-vocabulary aliases:**
- Files: `src/behavior/types.ts`, `src/commands/types.ts`
- Why fragile: `milestoneType` accepts both the 7 canonical Master Plan §10 categories and 4 legacy aliases (`first_completion`, `consistency_streak`, `recovery_success`, `fast_activation`) until the Phase 24 migration renames stored rewards. Every consumer must handle both vocabularies; a strict-equality check on one vocabulary silently misses the other.
- Safe modification: Normalize at the read boundary (map legacy → canonical on load) and never persist new legacy values; remove the alias union in Phase 24.
- Test coverage: No exhaustiveness test forces handler updates when a variant is added (flagged in review WR-06 lineage).

## Scaling Limits

**Forensic log buffer (50 entries):**
- Current capacity: 50-entry in-memory FIFO (`MAX_LOG_BUFFER_SIZE` in `src/utils/logger.js`).
- Limit: High-frequency warn/error loops evict the causal breadcrumb before the crash report is built.
- Scaling path: Keep the cap (memory-bounded by design); add loop-suppression/dedup counting instead of raising the limit.

**Vault import caps:**
- Current capacity: 50 files, 1 MB per file (`MAX_FILES`/`MAX_FILE_BYTES` in `src/utils/vaultImport.js`).
- Limit: Power users with large vaults hit a hard reject with only a `logger.warn`.
- Scaling path: Surface a user-facing message with counts, and consider chunked background import if the cap is ever raised.

## Dependencies at Risk

**`llama.rn@0.12.4` native patch coupling:**
- Risk: Exact-pinned (good), but its Android `build.gradle` is regex-rewritten by `patch-llama-gradle.js` on every install. Any 0.12.x → 0.13 upgrade can invalidate the regex with zero diagnostics.
- Impact: Android build breaks or silently builds against the wrong architecture block; on-device AI (Phase 18 pipeline) stops working.
- Migration plan: Verify the patch explicitly after every native upgrade (Master Plan §25); long-term, upstream the old-architecture support or fork-pin the Gradle file.

**`react-native-android-widget@^0.16.1` caret range + native patch:**
- Risk: Caret range permits minor bumps while `RNWidgetUtil.java` is regex-patched for sizing fallbacks; upstream changes to `getWidgetWidth`/`getWidgetHeight` break the patch match or duplicate `getFallbackSize`.
- Impact: Widget sizing regressions on specific launchers/orientations.
- Migration plan: Exact-pin alongside `llama.rn`, or move the sizing fix into a `patch-package` patch with a CI verification step.

## Missing Critical Features

**No notification enforcement layer (Phase 22 scope):**
- Problem: Quiet hours, daily cap, gap, dedup, `maximumRepeatedReminderCount` suppression, `priorityRules` arbitration, and `userOptOut` kill-switch exist as types/constants/grandfathered guard only — nothing enforces them at dispatch time.
- Blocks: Any behavioral intervention work (Phase 25) that assumes throttled delivery; store-review risk from notification spam.

**No coverage gate (thresholds undefined):**
- Problem: `jest.config.js` deliberately defines no `coverageThreshold` (current ~28% lines / ~17% functions per the config comment); CI collects `--coverage` as a tracking artifact only. Master Plan §24 targets (70/90/95) are unenforced.
- Blocks: Confidence in Phase 22/24 engine work landing without regression protection.

## Test Coverage Gaps

**Untested areas (no suites exist):**
- What's not tested: `widgets/widget-task-handler.tsx` headless dispatch path; `src/utils/billingNotifications.js`; `src/context/BillingContext.js` / `src/context/VaultContext.js` / `src/context/BirthdayContext.js`; `App.js` startup sequencing; `src/navigation/*`; `src/screens/*`; `patch-llama-gradle.js` patch-idempotency.
- Files: `widgets/**/*`, `src/utils/billingNotifications.js`, `src/context/*.js`, `App.js`, `src/navigation/AppNavigator.js`, `patch-llama-gradle.js`
- Risk: Widget-tap double-fire (no idempotency-executor test despite `idempotencyKey` being required by `src/commands/types.ts`), billing-reminder scheduling regressions, and startup-order breakage all ship silently.
- Priority: High — widget idempotency + billing notifications before Phase 25; startup smoke (`__tests__/unit/aiAssistant-smoke.test.js` pattern extended) before Phase 21 upgrade.

**Thin existing coverage:**
- What's not tested: Integration paths (scheduler → Expo → cancellation round-trip), storage-migration unknown shapes, export encrypt/decrypt round-trip at scale, DST transition weekends for advance reminders.
- Files: `src/utils/notifications.js`, `src/utils/storage.js`, `src/utils/exportService.js`, `__tests__/unit/*`
- Risk: Medium — pure-function guards are covered, but the seams between modules (where the Phase 20 review found every CR) have no tests.
- Priority: Medium — add as Phase 22/24 engine suites land, raising thresholds toward §24 targets.

---

*Concerns audit: 2026-10-01*
