---
status: issues-found
files_reviewed: 12
findings:
  critical: 1
  warning: 9
  info: 2
  total: 12
phase: "24"
depth: standard
---

# Phase 24: Code Review Report

**Reviewed:** 2026-10-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues-found

## Summary

Reviewed the Phase 24 behavior domain at standard depth: `src/behavior/{types,ruleEngine,habitEngine,cueEngine,recoveryEngine,rewardEngine,improvementEngine}.ts`, `src/context/HabitContext.js`, `src/utils/storage.js`, `App.js` (provider mount / reset / sync paths), and both unit suites. Cross-checked engine call sites against `rulebook/machine/*.json` (habit, recovery, reward, system, intervention rules).

The core deterministic design is sound — static rule imports (no `eval`, no remote rule fetch, so no rule-injection surface), priority sorting, REJECT_ extraction, FIFO caps, and cache-clear protection for habit keys all work as specified. One BLOCKER ships incorrect behavior to users: same-day double completion bypasses the engine's idempotency guard and mints duplicate factual rewards plus duplicate `HABIT_COMPLETED` events. Nine warnings cover gate bypasses, missing input validation, stale-closure races, an overbroad cache-clear filter, and an incomplete "reset all data" path. Two info items cover ID entropy and persistence robustness.

No hardcoded secrets, no SQL/command injection, no `eval`/`innerHTML` sinks, and no PII-in-logger violations were found (payloads stay out of `logger` calls; the eventBus buffer-PII note is already documented in code).

## Critical Issues

### CR-01: Same-day double completion mints duplicate rewards and events

**File:** `src/context/HabitContext.js:316-392` (interaction with `src/behavior/habitEngine.ts:184-219`)
**Issue:** `completeHabitEngine` is idempotent — when `habit.lastCompletedDate === todayDate` it returns `{ updatedHabit: habit, completedToday: false }` without incrementing streak/votes. `HabitContext.completeHabit` ignores the `completedToday === false` signal: it still evaluates rewards against the unchanged habit, still prepends any granted rewards, still rewrites habit state, and still appends + emits a `HABIT_COMPLETED` event. Concrete duplication: a habit with `totalEvidenceVotes: 0` completes once (votes → 1, earns `first_action`). A second call the same day returns the habit unchanged (votes still 1), but reward evaluation sees `event: HABIT_COMPLETED` + `habit.totalEvidenceVotes: 1`, matches `REWARD_FIRST_ACTION_001` again, and pushes a second "First Step Taken" reward with a new random id. Same flaw duplicates `recovery`/`consistency` milestones and pollutes the 500-item event log with phantom completions that later inflate `calculateRollingConsistency` (which dedupes by day, so the damage is concentrated in rewards + log noise + streak consumers reading event counts).
**Impact:** Incorrect behavior; duplicate user-facing rewards; unbounded-ish log pollution (2× per double-tap). The engine's idempotency contract is dead code in production.
**Fix:**
```js
const completionResult = completeHabitEngine(habit, options);
if (!completionResult.completedToday) {
  return {
    updatedHabit: completionResult.updatedHabit,
    rewards: [],
    completedToday: false,
    rulesApplied: completionResult.rulesApplied,
  };
}
// ... proceed with recovery-restore, reward eval, state write, event emit
```

## Warnings

### WR-01: Empty behavior/title accepted — corrupt habits with `undefined` fields persist

**File:** `src/behavior/habitEngine.ts:91-179` + `src/context/HabitContext.js:199-254`
**Issue:** `compileHabitPlan` never validates `input.behavior`. `target: input.behavior` (line 150) passes `undefined`/empty string straight into the plan, `generateMinimumAction` falls back to the literal `"behavior"` (`(behaviorText || 'behavior')`), and `createHabit` builds `title: input.title || input.behavior` (line 218) which is `undefined` when both are missing. The habit is then persisted and later interpolated into reward copy (`"Completed the initial execution of "${habit.title}""` → `"undefined"`). The test suite only exercises non-empty behavior, so the gap is untested.
**Impact:** Corrupt domain data, user-visible "undefined" strings, events carrying undefined titles.
**Fix:**
```ts
if (!input.behavior || !input.behavior.trim()) {
  return { valid: false, reason: 'Behavior description is required.', rulesApplied: [...] };
}
// and in createHabit, throw before validateHabitCreation when behavior/title blank
```

### WR-02: `completeHabit` resurrects paused/archived habits to `active`

**File:** `src/behavior/habitEngine.ts:200-218`
**Issue:** The engine unconditionally sets `status: 'active'` on every completion ("Restores active from recovery if completed"). A habit the user deliberately `paused` or `archived` that receives a completion (stale widget action, replayed event) silently returns to `active` and re-enters the concurrent-cap pool and overload math.
**Impact:** User intent violated; cap accounting (`validateHabitCreation` counts `active`+`recovery`) corrupted.
**Fix:**
```ts
status: habit.status === 'recovery' ? 'active' : habit.status,
```
and decide explicitly whether completing a `paused`/`archived` habit should be rejected.

### WR-03: Progression gate bypassed by `undefined`/`NaN` consistency

**File:** `src/behavior/habitEngine.ts:224-247` + `src/behavior/ruleEngine.ts:46-89`
**Issue:** `evaluateProgression(_habit, rolling14DayConsistency)` forwards the number into `evaluateCondition('<0.80', value)`. When `value` is `undefined`/`NaN` (caller bug, corrupt event log, division edge), the operator branch requires `typeof contextValue === 'number'` — `undefined` fails it and falls through to `conditionValue === contextValue` → `false`, so `HABIT_PROGRESSION_001` does not match, `result.rejected` is unset, and the function returns `{ allowed: true }`. An absent measurement grants a difficulty upgrade the 80%-gate was built to block. (`NaN` is `typeof 'number'` but every comparison is false, same outcome.)
**Impact:** Safety gate fails open instead of closed.
**Fix:**
```ts
if (typeof rolling14DayConsistency !== 'number' || !Number.isFinite(rolling14DayConsistency)) {
  return { allowed: false, reason: 'Consistency measurement unavailable; consolidate before progressing.', rulesApplied: [] };
}
```

### WR-04: Cue contract mismatch — rulebook `habit_stack` vs code `after-habit`; `time` cues need no time; self-stacking unguarded

**File:** `src/behavior/cueEngine.ts:24-86`, `rulebook/machine/habitRules.json:43-55`, `src/behavior/types.ts:43`
**Issue:** Three related defects: (a) `CUE_STACK_002` fires only when `cue.type === 'habit_stack'`, but `CueType` (types.ts:43) and `VALID_CUE_TYPES` (cueEngine.ts:12-19) define `after-habit`, never `habit_stack`. No real cue object can ever match the rule via `evaluateRules` — `compileHabitPlan` (habitEngine.ts:132-134) and `linkHabitStack` (cueEngine.ts:70-85) paper over this by manually injecting `'CUE_STACK_002'` into `rulesApplied`, so the trace claims a rule fired that the engine could never fire. (b) `validateCue` accepts `{ type: 'time' }` with no `time` field — no `HH:mm` format check — so a "time" cue with no time passes Law-1 validation. (c) `linkHabitStack` dereferences `anchorHabit.id`/`targetHabit.id` with no null guards (a null anchor throws `TypeError`) and never rejects `anchor.id === target.id` (degenerate self-stack persisted as `immediately-after`).
**Impact:** Misleading rule traces; incomplete cues scheduled downstream; crash on null input; nonsense self-stack data.
**Fix:** Align the vocabulary (either add `'habit_stack'` to `CueType` or change the rule to `'after-habit'`), add `if (cue.type === 'time' && !/^\d{2}:\d{2}$/.test(cue.time || '')) return invalid`, and add `if (!anchorHabit?.id || !targetHabit?.id || anchorHabit.id === targetHabit.id) throw` to `linkHabitStack`.

### WR-05: Recovery transition fires on `consecutiveMisses <= 0` and forces archived/paused habits into `recovery`

**File:** `src/behavior/recoveryEngine.ts:16-68`
**Issue:** `evaluateRecoveryTransition` unconditionally sets `status: 'recovery'` and `streakCount: 0`. A defensive or buggy call with `consecutiveMisses: 0` (or negative) still wipes a healthy streak and flips status. Likewise a `paused`/`archived` habit that records a miss is yanked into `recovery`, resurrecting it into the active pool. `nextSessionTarget` also defaults to `habit.normalTarget` with no fallback if that field is `undefined`.
**Impact:** Streak wipe on a no-op call; user-archived habits reactivated by a stray miss event.
**Fix:**
```ts
if (!Number.isInteger(consecutiveMisses) || consecutiveMisses < 1) throw new Error('consecutiveMisses must be >= 1');
if (habit.status === 'paused' || habit.status === 'archived') return { updatedHabit: habit, /* no transition */ ... };
const nextSessionTarget = habit.minimumAction || habit.normalTarget;
```

### WR-06: Overload check measures lifetime miss rate, not 7-day, with a hardcoded duration

**File:** `src/context/HabitContext.js:495-508`
**Issue:** Despite the `sevenDay*` naming and `OVERLOAD_TRIGGER_001` requiring `sevenDayMissRate > 0.40` sustained `consecutiveDaysInCondition >= 3`, `checkOverload` filters `behaviorEvents` with no timestamp window (the 500-item FIFO is a lifetime slice, not 7 days) and passes the literal `3` as `consecutiveDaysInCondition` on every call. Any 3-habit user whose lifetime miss rate exceeds 40% reads as overloaded on day one.
**Impact:** False overload "pause a habit" recommendations; the duration dimension of the rule is fabricated.
**Fix:** Filter events to `timestamp >= now - 7d` before computing the rate, and thread a real consecutive-days-in-condition counter (persisted alongside habits) instead of the constant `3`.

### WR-07: `updateHabit` accepts unrestricted patches; state-updater side effect; stale-closure cap race

**File:** `src/context/HabitContext.js:199-290`
**Issue:** (a) `updateHabit(id, patch)` spreads `...patch` over the habit with no allowlist — a caller (or a future UI binding) can overwrite `id`, `streakCount`, `bestStreak`, `totalEvidenceVotes`, `createdAt`, forging streaks/votes and orphaning events keyed by the old id, defeating the progression gates and factual-reward integrity the engines enforce. (b) `updatedHabit` is assigned inside the `setHabits` updater function, which React may invoke twice in StrictMode — side effects inside updaters are unsafe. (c) `createHabit` validates against the `habits` closure value; two creates dispatched in the same tick (before re-render) both see the same length and both pass `HABIT_CONCURRENT_CAP_001`, so the ≤3 cap can be overshot to 4+. The existing cap test creates habits across separate `act()` flushes and never exercises the same-tick race.
**Impact:** Integrity bypass (forged evidence votes); StrictMode double-invocation hazard; cap overshoot under rapid input.
**Fix:** Allowlist patches (`title, behavior, frequency, minimumAction, normalTarget, stretchTarget, status, customSchedule`), move the lookup before `setHabits` (`const existing = habits.find(...)`), and serialize creation against a ref or derive the count inside a functional update.

### WR-08: `clearAllCaches` deletes third-party keys matching `clean|cache|medical|sidebar`

**File:** `src/utils/storage.js:30-51`
**Issue:** The sweep filter removes any key containing `"medical"`, `"clean"`, `"sidebar"`, or `"cache"` (provided it isn't recognized by `isUserDataKey`). That scope extends far beyond KwestUp keys — any Expo, navigation, or third-party library key containing e.g. `"cache"` is wiped on every version bump (`App.js:198-201` calls this on `lastVersion !== APP_VERSION`). Habit keys themselves are correctly protected by `isUserDataKey` (verified by test), but the collateral filter is overbroad.
**Impact:** Silent deletion of other libraries' persisted state on upgrade.
**Fix:** Scope the filter to the app prefix: `key.startsWith('kwestup') && !isUserDataKey(key)`.

### WR-09: "Reset all data" leaves the entire habit domain behind

**File:** `App.js:820-846`
**Issue:** `handleResetData` clears daily tasks, tasks, lists, birthdays, notes, and timer state, but never touches `kwestup_habits_v1`, `kwestup_identities_v1`, `kwestup_behavior_events_v1`, or `kwestup_rewards_v1` (nor the in-memory `HabitProvider` state, which isn't reachable from `App` — the provider owns its state and exposes no reset). After a user-confirmed "reset all data", habits, streaks, 500-event history, and rewards survive intact.
**Impact:** Stale sensitive behavioral data survives an explicit wipe (privacy expectation violation); next install/hydration resurrects "deleted" habits.
**Fix:** Expose a `resetHabits()` action on `HabitContext` (clear state + `multiRemove` the four keys) and `await` it inside the reset confirmation before showing "All data has been reset!".

## Info

### IN-01: Entity IDs use `Math.random`, not a CSPRNG

**File:** `src/behavior/habitEngine.ts:22-26` (same pattern in `src/behavior/eventBus.ts:18-23`)
**Issue:** `generateEntityId` combines `Date.now()` with `Math.random().toString(36).slice(2, 9)` (~47 bits of entropy, predictable PRNG). Fine for local-only habit/reward/event ids today — collisions at the tested 1,000-id scale are unlikely — but ids are guessable and same-millisecond bursts share the timestamp half.
**Fix (optional):** Prefer `expo-random`/`expo-crypto` `getRandomBytes` or `Crypto.randomUUID()` where available, keeping the `${prefix}_` shape: `` `${prefix}_${Date.now()}_${randomHex}` ``.

### IN-02: Persistence robustness gaps (all-or-nothing hydration, no unmount flush, empty-prop sync)

**File:** `src/context/HabitContext.js:65-182`
**Issue:** Three small robustness notes, none user-visible in the happy path: (a) hydration parses all four keys inside one `try` — a single corrupt JSON value skips every domain (valid keys are discarded, not just the corrupt one). (b) The debounced writer clears its timer on unmount without flushing, so a mutation within `persistDebounceMs` (400 ms) of unmount never reaches `AsyncStorage`. (c) The `initial*` sync effects only apply non-empty arrays, so a parent can never intentionally reset state to `[]` via props.
**Fix (optional):** Per-key try/catch with per-key fallback; flush pending snapshot in the unmount cleanup; sync whenever `Array.isArray(initialX)` regardless of length (guarded by an explicit `isHydrated` + prop-change signal if needed to avoid clobbering hydration).

---

_Reviewed: 2026-10-10T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
