---
phase: 20-repository-governance-behavioral-rulebook-architecture-foundation
reviewed: 2026-10-01T00:00:00Z
depth: standard
files_reviewed: 58
files_reviewed_list:
  - .github/workflows/ci.yml
  - 4.0/KwestUp_4.0_Master_Plan.md
  - package.json
  - rulebook/CHANGELOG.md
  - rulebook/README.md
  - rulebook/ai/adaptation-engine.md
  - rulebook/ai/check-in-engine.md
  - rulebook/ai/habit-compiler.md
  - rulebook/ai/intent-parser.md
  - rulebook/ai/intervention-planner.md
  - rulebook/atomic-habits/accountability.md
  - rulebook/atomic-habits/commitment-devices.md
  - rulebook/atomic-habits/deliberate-practice.md
  - rulebook/atomic-habits/environment-design.md
  - rulebook/atomic-habits/friction.md
  - rulebook/atomic-habits/goldilocks-zone.md
  - rulebook/atomic-habits/habit-loop.md
  - rulebook/atomic-habits/habit-stacking.md
  - rulebook/atomic-habits/habit-tracking.md
  - rulebook/atomic-habits/identity.md
  - rulebook/atomic-habits/implementation-intentions.md
  - rulebook/atomic-habits/inversion-difficult.md
  - rulebook/atomic-habits/inversion-invisible.md
  - rulebook/atomic-habits/inversion-unattractive.md
  - rulebook/atomic-habits/inversion-unsatisfying.md
  - rulebook/atomic-habits/law-1-obvious.md
  - rulebook/atomic-habits/law-2-attractive.md
  - rulebook/atomic-habits/law-3-easy.md
  - rulebook/atomic-habits/law-4-satisfying.md
  - rulebook/atomic-habits/never-miss-twice.md
  - rulebook/atomic-habits/plateau.md
  - rulebook/atomic-habits/review-system.md
  - rulebook/atomic-habits/temptation-bundling.md
  - rulebook/atomic-habits/two-minute-rule.md
  - rulebook/examples/exercise.md
  - rulebook/examples/personal-projects.md
  - rulebook/examples/phone-use.md
  - rulebook/examples/reading.md
  - rulebook/examples/sleep.md
  - rulebook/examples/study.md
  - rulebook/examples/work.md
  - rulebook/manifest.json
  - rulebook/rules/habit-creation.md
  - rulebook/rules/habit-modification.md
  - rulebook/rules/missed-habit.md
  - rulebook/rules/overload.md
  - rulebook/rules/privacy.md
  - rulebook/rules/reminders.md
  - rulebook/rules/rewards.md
  - rulebook/rules/widgets.md
  - src/behavior/types.ts
  - src/commands/types.ts
  - src/domains/README.md
  - src/services/types.ts
  - src/utils/billingStorage.js
  - src/utils/notifications.js
  - src/utils/vaultImport.js
  - tsconfig.json
findings:
  critical: 12
  warning: 12
  info: 3
  total: 27
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-10-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 58
**Status:** issues_found

## Summary

Reviewed 58 files at standard depth: 6 code/type files (`src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts`, `src/utils/billingStorage.js`, `src/utils/notifications.js`, `src/utils/vaultImport.js`), 3 config/CI files (`package.json`, `tsconfig.json`, `.github/workflows/ci.yml`), the 4.0 Master Plan, `src/domains/README.md`, and 47 rulebook governance markdown files (flagged only for blocking contradictions/threshold gaps, not prose style).

The rulebook prose is internally coherent on recovery/undo semantics, but the executable contracts built on top of it have real defects: crash-on-malformed-input paths in the two most crash-prone JS utilities, silent data-loss shapes in billing storage, a notification layer that bypasses the very policy it claims to grandfather toward, type contracts that omit fields the rulebook mandates, and CI/type gates that pass green while checking nothing. The overload policy as written is unreachable under the creation cap. These must be fixed before Phase 22/24 enforcement gates mean anything.

## Critical Issues

### CR-01: Birthday scheduler crashes on missing/invalid `birthDate` — parsing sits outside try/catch

**File:** `src/utils/notifications.js:119-125`
**Issue:** `birthDate.split("-")` and `(remindAtTime || "00:00").split(":").map(Number)` execute **before** the `try` block (try starts line 129). If `birthDate` is `null`/`undefined`/non-string (corrupt birthday record, partial import), this throws `TypeError: Cannot read properties of undefined` synchronously and crashes the caller. There is no validation of `parts`, `month`/`day` NaN, or `hours`/`minutes` NaN. An `Invalid Date` then flows into `scheduleNotificationAsync`, producing partial `notificationIds` the caller persists — orphaned schedules that can never be cancelled reliably.
**Fix:**
```js
export async function scheduleCustomBirthdayReminders(birthday) {
  const notificationIds = [];
  try {
    const { name, birthDate, remindAtTime, advanceReminder } = birthday ?? {};
    if (typeof birthDate !== 'string' || typeof name !== 'string' || !name.trim()) return [];
    const parts = birthDate.split('-');
    if (parts.length < 2 || parts.length > 3) return [];
    // ... validate month/day/hours/minutes with Number.isInteger + range checks,
    // return [] on invalid instead of throwing
  } catch (error) {
    logger.error('Failed to schedule birthday reminders', { error });
  }
  return notificationIds;
}
```
Move ALL parsing inside `try`, validate ranges (month 1-12, day 1-31, hours 0-23, minutes 0-59), and never return partial IDs on failure (return `[]` or throw a typed error the caller handles atomically).

### CR-02: Billing storage accepts corrupt persisted shape — every reader then crashes

**File:** `src/utils/billingStorage.js:18-28`
**Issue:** `loadBillingData` does `JSON.parse(raw)` then `{ ...DEFAULT_BILLING, ...parsed }` with zero shape validation. If storage contains `"null"`, `"[]"`, `"42"`, `{"transactions": null}`, or `{"transactions": {}}` (all reachable via manual AsyncStorage edits, failed migrations, or a previous buggy write), the spread succeeds but `data.transactions` is `null`/non-array. Every downstream caller (`addTransaction`, `deleteTransaction`, `getSpendingByCategory`) then throws on `.filter`, `.find`, or `for..of`. The `catch` returns defaults only for parse errors, not shape errors — so corruption persists and crashes on every load.
**Fix:**
```js
const isArray = (v) => Array.isArray(v);
export const loadBillingData = async () => {
  try {
    const raw = await AsyncStorage.getItem(BILLING_KEY);
    if (!raw) return { ...DEFAULT_BILLING };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_BILLING };
    return {
      transactions: isArray(parsed.transactions) ? parsed.transactions : [],
      budgets: isArray(parsed.budgets) ? parsed.budgets : [],
      recurringBills: isArray(parsed.recurringBills) ? parsed.recurringBills : [],
      currency: typeof parsed.currency === 'string' ? parsed.currency : DEFAULT_BILLING.currency,
    };
  } catch (err) {
    logger.error('billingStorage: loadBillingData failed', { error: err });
    return { ...DEFAULT_BILLING };
  }
};
```

### CR-03: Financial totals use raw `+` on unvalidated `amount` — string amounts corrupt sums

**File:** `src/utils/billingStorage.js:86-110`
**Issue:** `getSpendingByCategory` does `result[tx.category] = (result[tx.category] || 0) + tx.amount` and `getMonthlyTotals` does `income += tx.amount`. If any `tx.amount` is a string (`"100"` from a text input that was never coerced), a number, `undefined`, or `NaN`, the result is string concatenation (`0 + "100" = "0100"`), `NaN` propagation, or silent wrong totals. No `Number()` coercion, no `Number.isFinite` guard, no category fallback for missing `tx.category` (creates `"undefined"` key). Financial reporting that is wrong is worse than financial reporting that is absent.
**Fix:**
```js
const toAmount = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
};
// then: result[cat] = (result[cat] || 0) + toAmount(tx.amount);
// and skip transactions where !Number.isFinite(toAmount(...)) per product decision,
// or explicitly count them as 0 with a logged warning.
```

### CR-04: `upsertBudget` category-fallback mutates identity — wrong-record overwrite / ID orphaning

**File:** `src/utils/billingStorage.js:56-70`
**Issue:** `find((b) => b.id === budget.id || b.category === budget.category)` matches on category when IDs differ, then `map((b) => b.id === existing.id ? { ...existing, ...budget } : b)` spreads the incoming `budget` (with its **new** `id`) over the old record. Result: the old record's `id` is silently replaced, orphaning any references to the old ID, or two distinct budgets sharing a category collapse into one. Worse, when both `budget.id` and `budget.category` are `undefined`, `b.category === budget.category` is `undefined === undefined = true` — the first budget in the array is overwritten by garbage.
**Fix:**
```js
export const upsertBudget = async (budget) => {
  if (!budget || typeof budget.id !== 'string' || !budget.id) throw new Error('upsertBudget: budget.id is required');
  const data = await loadBillingData();
  const idx = data.budgets.findIndex((b) => b.id === budget.id);
  const updatedBudgets = idx >= 0
    ? data.budgets.map((b, i) => (i === idx ? { ...b, ...budget, id: b.id } : b))
    : [...data.budgets, budget];
  // category-uniqueness, if desired, must be a separate explicit validated rule —
  // never a silent OR fallback.
};
```

### CR-05: Notification layer bypasses the hard `BehavioralNotificationPolicy` it claims to grandfather toward

**File:** `src/utils/notifications.js:40-104`, `src/services/types.ts:27-45`, `rulebook/rules/reminders.md:14-21`
**Issue:** `scheduleDailyTaskNotification`, `schedulePushNotification`, and `scheduleDueDateNotification` schedule directly via Expo with **no** quiet-hours check (22:00–08:00), **no** 3/day cap, **no** 90-minute gap, and **no** 30-minute dedup. `src/services/types.ts` defines `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` but nothing imports or enforces it — it is a dead constant. `rulebook/README.md` says legacy schedulers are "grandfathered until Phase 22," but there is no code comment, lint rule, or wrapper preventing new call sites from using the unguarded path. Any Phase 22 test asserting the cap will fail against these functions, and any reviewer trusting the policy constant is trusting theater.
**Fix:**
```ts
// Do not add new schedule call sites against expo-notifications directly.
// Route all behavior/task scheduling through a single guard:
// canDispatch(now, history, policy) checks quietHours + maxPerDay + minGapMinutes + dedup window
// and returns { allowed: boolean; deferUntil?: string; reason: string }.
// Until Phase 22 lands, add a prominent comment + eslint restricted-import on these three
// functions marking them deprecated/grandfathered, and make DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY
// the single imported source of the 3 / 90 / 22:00-08:00 / 30 constants (no hardcoded copies).
```

### CR-06: Overload policy is unreachable under the creation cap — dead governance (blocks Phase 24)

**File:** `rulebook/rules/overload.md:17-18`, `rulebook/rules/habit-creation.md:14-15`
**Issue:** Creation caps at **max 3 active** habits (`CREATE_HABIT` rejected at 3). Overload requires **≥4 active-or-recovery** habits AND >40% 7-day miss rate AND 3-day persistence. Under the cap, 4 can never exist — the conjunction is unsatisfiable for any compliant user. Either the cap counts only `active` while overload counts `active+recovery` (in which case 3 active + 1 recovery = 4 is reachable only transiently and the docs never state this), or overload is dead code. Phase 24 `overloadEngine.test.ts` cannot write a passing/failing pair for an unreachable trigger; the compliance matrix (`rulebook/README.md:70`) asserts both without noting the tension.
**Fix:** Decide and write down one of: (a) overload threshold becomes `≥3 active-or-recovery` to sit under the cap, or (b) creation cap counts `active+recovery` jointly and overload stays at `≥4` only if the cap is raised / grandfather clause documented. Update `overload.md`, `habit-creation.md`, the README matrix row, and `DEFAULT` engine constants together — not just one side.

### CR-07: `Habit` omits `totalEvidenceVotes` the rulebook mandates — spec/code mismatch (blocks Phase 24)

**File:** `src/behavior/types.ts:18-33`, `rulebook/atomic-habits/habit-tracking.md:27-32`, `rulebook/atomic-habits/identity.md:37-40`
**Issue:** Tracking mandates dual metrics: `streakCount` + `bestStreak` + **`totalEvidenceVotes`** (cumulative lifetime votes, preserved across streak resets; `study.md:37` also requires "total lifetime evidence votes are preserved"). `Habit` has the two streak fields but no `totalEvidenceVotes`. Any engine built from `types.ts` alone loses the morale-protection invariant; any engine built from the markdown alone diverges from the type. This is exactly the drift the rulebook claims to prevent.
**Fix:**
```ts
export interface Habit {
  // ...
  streakCount: number;
  bestStreak: number;
  totalEvidenceVotes: number; // cumulative lifetime completions; never reset on miss
  // ...
}
```
Backfill migration for existing stored habits (`totalEvidenceVotes ?? streakCount ?? 0` must be an explicit decision, not an accident).

### CR-08: Type gate is theater — `checkJs:false` + `src`-only include excludes the buggiest files and all tests

**File:** `tsconfig.json:3-19`
**Issue:** `allowJs: true, checkJs: false` means `src/utils/billingStorage.js`, `notifications.js`, `vaultImport.js` — the files with CR-01 through CR-04 — are **never type-checked** by `npm run typecheck`, yet CI's "Run TypeScript Check" step is presented as a quality gate. `include: ["src/**/*"]` simultaneously excludes root `App.js`, `__tests__/**` (if outside `src`), and `patch-llama-gradle.js`, while `exclude` drops `widgets/**/*` (the headless widget handler Master Plan §9 calls behavior-critical). `tsc --noEmit` can pass 100% clean while the shipped JS is broken.
**Fix:**
```json
{
  "compilerOptions": { "strict": true, "allowJs": true, "checkJs": true },
  "include": ["src/**/*", "App.js", "__tests__/**/*", "*.js"],
  "exclude": ["node_modules"]
}
```
Or explicitly document that JS is unchecked and add a separate lint/validation gate for `src/utils/*.js`. Do not claim "type errors in typed code: 0" (§24 gates) while the highest-risk files are out of scope. At minimum remove `widgets/**/*` from `exclude` or justify why the widget surface is exempt.

### CR-09: CI enforces none of the Master Plan §24 gates — missing Semgrep, non-reproducible install, tests can be zero

**File:** `.github/workflows/ci.yml:9-33`, `package.json:13`, `4.0/KwestUp_4.0_Master_Plan.md:714-726`
**Issue:** (a) No Semgrep step despite §24 pipeline (`lint → typecheck → unit → integration → coverage → Semgrep → Android build`) and baseline claim "GitHub Actions lint/test CI + Semgrep". High-severity security gate is absent. (b) `npm install` instead of `npm ci` — non-reproducible, ignores lockfile exactness, slower. (c) `npm test` maps to `jest --passWithNoTests`, so CI is green with **zero tests**; `--coverage` without `--coverageThreshold`/`coverageThreshold` config enforces none of the ≥70%/≥90%/≥95% gates. (d) No `permissions: contents: read`, no `concurrency`, actions pinned to mutable `v4` tags rather than SHAs. A compromised action gets default write token.
**Fix:**
```yaml
permissions:
  contents: read
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
# - use npm ci (requires committing package-lock.json)
# - add semgrep job / step per Master Plan §24
# - remove --passWithNoTests from CI invocation; add jest coverageThresholds
#   matching §24 (70/90/95) so --coverage actually gates
# - pin actions to SHAs; add `npm run lint -- --max-warnings=0`
```

### CR-10: Command layer lets AI bypass the recovery state machine + drops `frequency` the Master Plan example requires

**File:** `src/commands/types.ts:18-61`
**Issue:** (a) `UPDATE_HABIT` permits `status` in `Partial<Pick<Habit,'title'|...|'status'>>` — AI (which "owns interpretation, never execution") can set `active`/`recovery`/`archived` arbitrarily, bypassing `missed-habit.md`'s deterministic midnight-rollover transition. There is no `PAUSE`/`ARCHIVE` separation, no actor field, no guard. (b) `CREATE_HABIT` payload has `identityId/title/behavior/minimumAction/normalTarget/cueType/cueTime` but **no `frequency`** — yet Master Plan §7's canonical example sends `"frequency": "daily"`, `habit-stacking.md` needs anchor linkage, and `personal-projects.md` needs `weekly` Saturday. Frequency sent by AI is silently dropped or rejected downstream. There is also no `CREATE_IDENTITY` command, so `identityId` is required but uncreatable — chicken-and-egg. (c) `HabitFrequency 'custom'` (behavior/types) has no accompanying schedule field anywhere, so `custom` is unrepresentable.
**Fix:**
```ts
// Remove 'status' from AI-mutable UPDATE_HABIT picks; add explicit
// PAUSE_HABIT / ARCHIVE_HABIT / RESUME_HABIT commands with actor + reason,
// while active<->recovery transitions stay engine-owned (never AI-settable).
// Add frequency + cueLocation + stretchTarget to CREATE_HABIT payload,
// add CREATE_IDENTITY (or allow inline identity statement),
// and either define CustomSchedule { daysOfWeek: number[] } or remove 'custom'.
```

### CR-11: Vault import silently overwrites on filename collision; accepts arbitrary renamed binaries with no size/count guard

**File:** `src/utils/vaultImport.js:17-63`
**Issue:** (a) `destPath = vault.path + safeName` with no existence check — two picked files that sanitize to the same `safeName` (e.g., `Note.md` + `note.md` on case-insensitive FS, or `a/b.md`→`a_b.md` collisions) silently overwrite; first file's content is destroyed with only a per-file `debug` log. (b) Picker allows `application/octet-stream` then filters **only by extension** — any binary renamed to `.md` passes, is read as UTF-8, and written into the vault (vault pollution / oversized garbage). No file-size cap, no count cap with `multiple: true`, no content sanity check. A 500-file or 200 MB pick sequentially `await`s with no progress/cancellation (DoS-by-selection). (c) Assumes `vault.path` ends with `/` — if `createVault` returns no trailing slash the concatenation writes a malformed path.
**Fix:**
```js
import * as FileSystem from 'expo-file-system';
// Before write: const info = await FileSystem.getInfoAsync(destPath);
// if (info.exists) append ` (1)`, ` (2)` suffix — never overwrite.
// Enforce MAX_FILE_BYTES (e.g. 1 MB) and MAX_FILES (e.g. 50) before the copy loop;
// reject asset.size > MAX with a user-facing message.
// Join with path helper normalizing trailing slash: `${vault.path.replace(/\/?$/, '/')}${safeName}`.
// Consider checking octet-stream assets by sniffing content, not just extension.
```

### CR-12: `HabitFrequency 'custom'` + `CueType 'manual'` are dead/contradictory variants

**File:** `src/behavior/types.ts:14`, `src/behavior/types.ts:35`, `rulebook/rules/habit-creation.md:19`
**Issue:** `HabitFrequency` includes `'custom'` but no interface carries `customDays`/`cron`/`dates` — a `custom` habit cannot be scheduled, evaluated for miss (`23:59:59` rule), or tested. `CueType` includes `'manual'` while creation rule enumerates only `time|after-habit|task-completion|morning|evening` and states "unscheduled or triggerless habits are rejected" — `manual` reads as triggerless, i.e., the type permits exactly what the rule forbids. Implementers must guess; validators will diverge.
**Fix:** Either remove `'manual'`/`'custom'` until designed, or add the missing fields (`customSchedule?: { weekdays: number[] }`; `manual` cue documented as "user-initiated, no time trigger, explicitly allowed" with creation-rule text updated to include it). Both sides (markdown + types + validator tests) must agree.

## Warnings

### WR-01: Android permission denial is silently swallowed — user never told

**File:** `src/utils/notifications.js:15-38`
**Issue:** iOS branch alerts on denial; Android branch discards the `requestPermissionsAsync` result entirely. On Android 13+ (runtime `POST_NOTIFICATIONS`), denial means every subsequent schedule silently no-ops and the user blames the app. Inconsistent branches.
**Fix:** Capture Android result, check `status !== 'granted'`, and surface the same settings guidance (or return the status so callers can). Do not fire-and-forget permissions.

### WR-02: Daily-task scheduler accepts out-of-range times with no caller-distinguishable error

**File:** `src/utils/notifications.js:41-64`
**Issue:** `task.time.split(':').map(Number)` checked only for `isNaN` — `"25:99"`, `"7"`, `"07:00:00"` all pass or mis-parse; `hours: 25` is handed to Expo which throws, caught, `null` returned. Caller cannot distinguish "task has no time" from "time invalid" from "OS rejected." No range validation (0-23 / 0-59), no format regex.
**Fix:** Validate with `/^([01]?\d|2[0-3]):([0-5]\d)$/` before scheduling; return a typed result (`{ ok: false, reason: 'invalid-time' }`) or throw a named error instead of bare `null`.

### WR-03: Feb-29 handling lands on March 2; advance-reminder math ignores DST wall-clock rule

**File:** `src/utils/notifications.js:138-164`
**Issue:** Non-leap-year Feb 29 correction does `new Date(year, month-1, day+1)` → for Feb 29 this is `new Date(y, 1, 30)` = **March 2**, not Feb 28/Mar 1. Separately, `advanceTarget.setDate(getDate() - daysPrior)` does absolute-date arithmetic while `reminders.md` mandates wall-clock anchoring across DST — spring-forward can shift the advance reminder by an hour into quiet hours.
**Fix:** Decide Feb-29 policy explicitly (Feb 28 vs Mar 1), implement it directly instead of `day+1` probing, and compute reminder times in wall-clock (`dateUtils.js`) terms per the DST counterexample, with a test for the transition weekend.

### WR-04: `saveBillingData` failures masquerade as success — callers return "updated" state that was never persisted

**File:** `src/utils/billingStorage.js:30-36`
**Issue:** `saveBillingData` catches and only logs; all six mutators (`addTransaction`, `deleteTransaction`, `upsertBudget`, `deleteBudget`, `addRecurringBill`, `markBillPaid`, …) `await saveBillingData(updated); return updated;` unconditionally. On quota/full-disk failure the UI shows the new state, restart loses it. Data-loss illusion.
**Fix:** Return `boolean`/`{ ok }` from `saveBillingData` (or rethrow), and have mutators propagate failure so UI can warn instead of pretending.

### WR-05: Vault import trusts `vaultName` and `vault.path` shape without sanitization

**File:** `src/utils/vaultImport.js:47-60`
**Issue:** `vaultName` flows unsanitized into `createVault` (path traversal if it contains `/../` — `createVault` is out of scope so cannot be verified here), and `destPath` assumes trailing slash. Sanitizer strips `/\?%*:|"<>` but leaves control characters and `.`/`..` reservations; `file.name` fallback `note_${Date.now()}.md` can collide within the same ms.
**Fix:** Sanitize `vaultName` (trim, strip separators, cap length, fallback to `"Imported"`), normalize `vault.path` join, add collision suffix, use a monotonic counter + random suffix for fallback names.

### WR-06: Type-enum drift across four files — reward types, intervention types, event types, friction taxonomy disagree

**File:** `src/behavior/types.ts:53-116`, `4.0/KwestUp_4.0_Master_Plan.md:222-234,445-456`
**Issue:** `FactualReward.milestoneType` (`first_completion|consistency_streak|recovery_success|fast_activation|friction_reduction`) matches neither `rewards.md` prose nor Master Plan §10's seven categories (first action, improvement, consistency, recovery, difficulty progression, friction reduction, identity evidence). `Intervention.type` is unconstrained `string` despite the finite-question-bank philosophy — typos become silent new types. `BehaviorEventType` lacks `TASK_CREATED`/`TASK_MISSED`/`HABIT_CREATED`-adjacent M4 events (`Master Plan §M4` lists `TASK_CREATED`, `TASK_MISSED`; types has `HABIT_CREATED/HABIT_UPDATED` but not the task pair). Master Plan §12 lists **10** friction causes while `FrictionCategory` + check-in bank use **6** — Phase 24 implementers must pick a loser.
**Fix:** Canonicalize one enum per concept in `behavior/types.ts` as unions, align Master Plan §10/§12 and `rewards.md`/`friction.md` wording to them, and add an exhaustiveness test so adding a variant forces handler updates.

### WR-07: Command result contracts are ambiguous; no idempotency for double-tap dispatch

**File:** `src/commands/types.ts:63-73`
**Issue:** `CommandValidationResult.errors` optional even when `valid: false` — validators may return `{ valid: false }` with no message, violating creation-rule counterexamples that require specific guidance ("Pause or graduate…"). `CommandExecutionResult` carries both `message` and `error` with no convention (can `success: true` carry `error`?). No `idempotencyKey`/`requestId` anywhere though widgets promise 1-tap logging and Master Plan §22 demands duplicate handling — double-tap fires `LOG_HABIT` twice → double votes.
**Fix:**
```ts
export interface CommandValidationResult { valid: boolean; errors: string[]; } // always present; empty when valid
export interface CommandExecutionResult { success: boolean; entityId?: string; message: string; error?: string; requestId: string; }
// Require callers (widget/notification actions) to send idempotencyKey; executor dedups.
```

### WR-08: Notification policy contract is incomplete and its quiet boundary is off by one minute

**File:** `src/services/types.ts:7-45`, `rulebook/rules/reminders.md:14-16`, `4.0/KwestUp_4.0_Master_Plan.md:340-351`
**Issue:** `BehavioralNotificationPolicy` omits Master Plan §8's `maximumRepeatedReminderCount`, `priorityRules`, `userOptOut` — the intervention-planner's "suppress after 2 ignores" rule has nowhere to live. `importance: number` accepts `999`. `triggerDate: string` (absolute ISO instant) contradicts the wall-clock/DST rule. Boundary: policy says quiet ends `08:00`, reminders doc defers to `08:01` — is `08:00:30` quiet? Tests will flake on the minute.
**Fix:** Add the three missing fields (or explicitly defer them with a TODO + phase tag), type `importance` against the Expo enum, document trigger timezone semantics (wall-clock + `dateUtils`), and pin the boundary (`quietHoursEnd` exclusive, first dispatch `08:01`) in both files identically.

### WR-09: Dependency hygiene — postinstall arbitrary exec, RC in prod deps, console-stripper hides violations, no `engines`

**File:** `package.json:16,47,60,65`
**Issue:** `postinstall: node patch-llama-gradle.js` executes on every `npm install`/CI run with no integrity pin (supply-chain surface; Master Plan §25 says the llama patch "must be explicitly verified after every native upgrade" — nothing here verifies). `react-native-modal@^14.0.0-rc.1` is a pre-release in production deps. `babel-plugin-transform-remove-console` strips `console.*` at build time, masking Master Plan rule 11 ("No raw console.*") instead of failing lint. No `engines` field though the plan mandates Node 22.13+ (CI runs Node 20) and caret `llama.rn@^0.12.4` permits breaking native changes (violates §25 isolation).
**Fix:** Pin `patch-llama-gradle.js` verification (checksum + CI step asserting it ran + test), replace RC with stable, enforce `no-console` in ESLint rather than stripping at build, add `"engines": { "node": ">=22.13" }` aligned with CI's `setup-node`, and pin native-risk deps exactly (no caret) per §25.

### WR-10: Lint gate allows warnings; CI Node/action hygiene gaps

**File:** `.github/workflows/ci.yml:17-33`, `package.json:10`
**Issue:** `npm run lint` = `eslint .` exits 0 with warnings — "lint errors: 0" gate (§24) is not enforced (`--max-warnings=0` missing; `lint:report` script exists but CI never uploads it). `setup-node` uses Node 20 while the documented target is Node 22.13+ (SDK 57/RN 0.86). Actions float on major tags (`checkout@v4`, `setup-node@v4`) instead of SHAs.
**Fix:** `run: npm run lint -- --max-warnings=0`, bump CI to Node 22, pin actions to SHAs, upload `eslint-report.json` + coverage as artifacts.

### WR-11: Two numeric/enumeration contradictions that will fail schema tests

**File:** `rulebook/atomic-habits/goldilocks-zone.md:26`, `rulebook/rules/habit-modification.md:16`, `rulebook/rules/habit-creation.md:19`
**Issue:** (a) Modification caps single-step increases at **10%**, but Goldilocks illustrates "25 minutes → 28 minutes" = **12%**, violating its own cap. A test encoding the cap fails the doc example. (b) Creation enumerates cue types without `'manual'` while `CueType` and the implementation-intentions code block include it (see CR-12) — validators built from either side disagree on whether a manual-cue habit is legal.
**Fix:** Change the Goldilocks example to 25→27 (≈8%) or restate the cap as "5–10% guideline, hard cap 10%"; add `'manual'` to the creation rule's allowed list with its triggerless-but-explicit semantics, or remove it from the type.

### WR-12: Manifest is tamper-invisible; review dates are meaningless; plan tree omits governance files

**File:** `rulebook/manifest.json:1-4`, `rulebook/CHANGELOG.md:1-17`, `4.0/KwestUp_4.0_Master_Plan.md:94-145`
**Issue:** `manifest.json` has no schema version, no content hashes, and a single shared `generated` date; all 44 entries share identical `review_date: 2026-10-01`, so the Rule Change Protocol's "increment review_date" step cannot distinguish reviewed from unreviewed. Master Plan §4's rulebook tree omits `README.md`/`manifest.json`/`CHANGELOG.md` though they are now load-bearing governance. `README.md:77` hard-links `file:///c:/Users/...` absolute paths — broken on any other machine/CI.
**Fix:** Add `manifestVersion` + per-document `sha256` (CI verifies), use real per-change review dates, add the three governance files to the plan tree, and replace `file:///` absolute links with relative links.

## Info

### IN-01: Hardcoded locale/format values that will complicate i18n and testing

**File:** `src/utils/billingStorage.js:13`, `src/services/types.ts:39-44`, `src/utils/notifications.js:48-49,148-150`
**Issue:** `currency: "₹"`, quiet hours `'22:00'/'08:00'`, gaps `3/90/30`, and user-visible English/emoji strings are inline literals. Not wrong today, but every future locale or threshold tweak touches code instead of config. Consider centralizing user-facing strings and deriving defaults from the single policy constant.
**Fix:** Extract `DEFAULT_CURRENCY`, notification copy, and emoji usage into a locale/config module; keep `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` as the sole numeric source.

### IN-02: Domain isolation rule as written forbids the import the codebase already uses

**File:** `src/domains/README.md:13-16`, `src/commands/types.ts:7`
**Issue:** "No domain may import from another domain's internal modules" + "cross-domain calls go through events, never direct imports," yet `commands/types.ts` directly imports from `behavior/types`. Types-vs-runtime sharing is the reasonable exception, but the README does not state it — future reviewers will flag the import as a violation or, worse, duplicate the types.
**Fix:** Amend the README: "Shared type-only imports from `behavior/types.ts` and `commands/types.ts` are allowed; runtime/value imports across domains must go through events."

### IN-03: Master Plan domain/event model already drifts from the types

**File:** `4.0/KwestUp_4.0_Master_Plan.md:153-223,503-504`, `src/behavior/types.ts:18-92`
**Issue:** Plan §5 `Habit` omits `streakCount/bestStreak/lastCompletedDate/stretchTarget`; §5 `Reward` categories differ from `FactualReward`; M4 event list (`TASK_CREATED`, `TASK_MISSED`) is missing from `BehaviorEventType`. Plan also phases work as M0–M12 while `src/domains/README.md` phases as 22–28 with no mapping table. None blocks today (no engines exist yet), but the first engine PR will have to guess which document wins.
**Fix:** Add a one-paragraph phase-mapping note (M0–M12 ↔ Phase 20–28) and reconcile the §5 model + M4 event list with `behavior/types.ts` before Phase 22 starts.

---

_Reviewed: 2026-10-01T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
