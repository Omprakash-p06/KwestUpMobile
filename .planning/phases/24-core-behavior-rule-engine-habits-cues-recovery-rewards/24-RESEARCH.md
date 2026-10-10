# Phase 24 Research: Core Behavior & Deterministic Rule Engine (Habits, Cues, Recovery & Rewards)

**Phase:** 24 of 28 (Milestone 3: KwestUp 4.0 — Atomic Behavior Engine)  
**Requirements Addressed:** `BEH-01`, `BEH-02`  
**Domain:** Deterministic Behavior Engines, Machine Rule Evaluation, Atomic Habits Invariants, Isolated Habit Persistence  
**Date:** 2026-10-11  

---

## 1. Executive Summary

Phase 24 implements the core behavioral logic of KwestUp 4.0: an **AI-assisted deterministic behavioral machine**. As defined in [`4.0/KwestUp_4.0_Master_Plan.md`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/4.0/KwestUp_4.0_Master_Plan.md), the fundamental architectural principle is:
> *The application enforces the rulebook, not the on-device AI.*

A ~400 MB quantized local LLM cannot and should not be expected to memorize or reliably enforce behavioral constraints, quiet hours, minimum action limits, or recovery state machines. Instead, the application layer implements pure, deterministic behavior engines that evaluate machine-readable rules in [`rulebook/machine/*.json`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/rulebook/machine/) and produce explicit, auditable execution traces (`rulesApplied: [...]`).

Phase 24 achieves this across two primary components:
1. **Pure Deterministic Behavioral Engines (`BEH-01`):**
   - Central rule evaluation engine (`src/behavior/ruleEngine.ts`) capable of evaluating JSON rules from `rulebook/machine/*.json` (`habitRules.json`, `recoveryRules.json`, `rewardRules.json`, `rules.json`).
   - Domain-specific pure engines:
     - `src/behavior/habitEngine.ts` (concurrent cap ≤ 3, minimum action, habit compilation, difficulty progression gate).
     - `src/behavior/cueEngine.ts` (mandatory cue validation, habit stacking linkage).
     - `src/behavior/recoveryEngine.ts` ("never miss twice" state machine, friction review on ≥2 consecutive misses, recovery completion restoration, overload protection).
     - `src/behavior/rewardEngine.ts` (factual milestone rewards, anti-gamification enforcement rejecting arbitrary XP/points).
     - `src/behavior/improvementEngine.ts` (rolling 14-day consistency calculation, streak tracking, automaticity scoring).
   - Execution traces: every state transition records `rulesApplied: [ruleId, ...]`.

2. **Isolated Persistence & `HabitContext` (`BEH-02`):**
   - `HabitContext` (`src/context/HabitContext.js` / `.tsx`) providing state management for habits, identities, and behavior history.
   - Dedicated, isolated versioned AsyncStorage keys:
     - `kwestup_habits_v1`
     - `kwestup_behavior_events_v1` (bounded historical event log, max 500 events with FIFO eviction).
   - Storage security: update `isUserDataKey` in [`src/utils/storage.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/utils/storage.js) to protect `kwestup_habits_` and `kwestup_behavior_events_` against deletion during cache clears (`clearAllCaches()`).
   - Event bus integration: state mutations emit domain events (`HABIT_CREATED`, `HABIT_UPDATED`, `HABIT_COMPLETED`, `HABIT_MISSED`, `RECOVERY_STARTED`) over [`src/behavior/eventBus.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/behavior/eventBus.ts).
   - Provider composition: mount `HabitProvider` in [`App.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/App.js).

---

## 2. Machine Rulebook Analysis

The machine-executable rulebook created in Phase 20 defines 18 core rules across 5 JSON files in `rulebook/machine/`. Phase 24 evaluates and enforces these rules deterministically:

### `rulebook/machine/habitRules.json`
- **`HABIT_CONCURRENT_CAP_001` (Priority 100):** Maximum 3 active concurrent habits. Rejects creation if `activeHabitCount >= 3`.
- **`MINIMUM_ACTION_001` (Priority 90):** Law 3 (Make it Easy). Every habit must have an achievable minimum action taking <120 seconds (Two-Minute Rule). Generates minimum action if missing.
- **`CUE_MANDATORY_001` (Priority 85):** Law 1 (Make it Obvious). Every habit must have an unambiguous cue anchor. Prompts cue selection if missing.
- **`CUE_STACK_002` (Priority 80):** When habit stack anchor is specified, binds execution `immediately-after` anchor habit.
- **`HABIT_IDENTITY_001` (Priority 75):** Associates habit with an identity statement representing desired person/self.
- **`HABIT_PROGRESSION_001` (Priority 90):** Difficulty upgrade gate requires ≥80% rolling consistency across 14 consecutive days before difficulty increase is permitted.

### `rulebook/machine/recoveryRules.json`
- **`RECOVERY_001` (Priority 95):** "Never Miss Twice". First missed day automatically transitions habit to `status: 'recovery'` and scales next session target to `minimumAction` (<120s version).
- **`RECOVERY_CONSECUTIVE_MISS_002` (Priority 90):** Second consecutive miss (`missedConsecutively >= 2`) triggers friction review rather than escalating notifications.
- **`RECOVERY_SUCCESS_001` (Priority 85):** Completion while in `recovery` restores `status: 'active'` and awards `milestoneType: 'recovery'`.
- **`OVERLOAD_TRIGGER_001` (Priority 80):** Active habits ≥ 3 and 7-day miss rate > 40% for ≥ 3 consecutive days triggers overload pause recommendation.

### `rulebook/machine/rewardRules.json`
- **`REWARD_ANTI_GAMIFICATION_001` (Priority 100):** Rejects arbitrary XP, points, and coins. Rewards must record factual behavioral milestones.
- **`REWARD_FIRST_ACTION_001` (Priority 90):** Awards `first_action` milestone ("First Step Taken") on initial completion (`totalEvidenceVotes === 1`).
- **`REWARD_RECOVERY_001` (Priority 85):** Awards `recovery` milestone ("Bounced Back") when completed after a missed day.
- **`REWARD_CONSISTENCY_001` (Priority 80):** Awards `consistency` milestone at 7, 21, and 66 consecutive completion days (automaticity threshold).

### `rulebook/machine/rules.json`
- **`SYS_ZERO_CLOUD_001` (Priority 1000):** Strict local-first privacy; blocks cloud transmission of behavioral data.
- **`SYS_PII_LOG_REDACT_001` (Priority 999):** Habit titles and details redacted from diagnostics logs.

---

## 3. Architecture & Module Design

### 3.1 Pure Behavioral Engine Layer (`src/behavior/`)

All behavioral logic modules are framework-free, pure TypeScript functions. They accept state and options, return immutably transformed results, and take injectable clocks (`{ now, todayDate }`) for 100% deterministic testing.

```text
src/behavior/
├── types.ts              # Core contracts (Habit, Identity, Cue, BehaviorRule, FactualReward, etc.)
├── eventBus.ts           # Decoupled domain event bus (Phase 23)
├── ruleEngine.ts         # Deterministic rule evaluator with condition matching & audit logging
├── habitEngine.ts        # Habit validation, creation, completion, progression gates
├── cueEngine.ts          # Cue validation, habit stacking, trigger resolution
├── recoveryEngine.ts     # Never-miss-twice recovery state machine & overload checks
├── rewardEngine.ts       # Factual milestone rewards engine (anti-gamification)
└── improvementEngine.ts  # Rolling 14-day consistency, streaks, and automaticity scoring
```

#### Rule Evaluator Architecture (`ruleEngine.ts`)
The rule evaluator evaluates a set of `BehaviorRule` objects against a given evaluation context:
- Supports comparison operators: `==`, `!=`, `>=`, `<=`, `>`, `<`, array membership (e.g. `[7, 21, 66]`), and null checks.
- Supports dot notation for nested context properties (e.g. `habit.missedConsecutively`, `cue.type`).
- Sorts matching rules by `priority` (descending).
- Accumulates applied rule IDs into `rulesApplied: string[]`.
- Exports helper functions: `evaluateRules(rules, context)` and `loadMachineRules()`.

#### Deterministic Clock Injection
Per `CONVENTIONS.md:99`, all time-dependent functions accept an options bag:
```typescript
export interface TimeOptions {
  now?: string;       // ISO 8601 string, e.g. "2026-10-11T12:00:00.000Z"
  todayDate?: string; // Local YYYY-MM-DD string, e.g. "2026-10-11"
}
```
Calendar date calculations strictly use `getLocalDateString()` from [`src/utils/dateUtils.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/utils/dateUtils.js), never `toISOString().slice(0, 10)` (per `DATE-01`/`DATE-02`).

---

### 3.2 State & Persistence Layer (`HabitContext.js`)

#### Isolated Storage Key Architecture
In conformance with Master Plan §19 and requirement `[BEH-02]`, habit state is decoupled from the monolithic `kwestup_data_${STORAGE_VERSION}` key:
- `kwestup_habits_v1`: JSON array of `Habit` objects.
- `kwestup_behavior_events_v1`: JSON array of `BehaviorEvent` objects representing the persistent event log.
- `kwestup_identities_v1`: JSON array of `Identity` objects.
- `kwestup_rewards_v1`: JSON array of `FactualReward` objects.

#### Bounded Event Log Hygiene
To prevent unbounded storage growth flagged in `CONCERNS.md:239-242`:
- `kwestup_behavior_events_v1` is capped at a maximum of 500 events with FIFO eviction.
- Eviction keeps the most recent 500 events to ensure rolling 14-day and 66-day consistency calculations remain accurate while bounding AsyncStorage write sizes to <150 KB.

#### Cache-Clear Protection (`storage.js`)
`clearAllCaches()` in `src/utils/storage.js` deletes all keys containing `kwestup` unless allow-listed by `isUserDataKey(key)`. We must update `isUserDataKey` to include:
```javascript
key.startsWith("kwestup_habits_") ||
key.startsWith("kwestup_behavior_events_") ||
key.startsWith("kwestup_identities_") ||
key.startsWith("kwestup_rewards_") ||
key.startsWith("kwestup_interventions_")
```
This guarantees that upgrading storage versions or clearing caches never erases user habit data.

#### Unique ID Generation with Entropy
To resolve `CONCERNS.md:19-24` (non-unique ID generation via `Date.now().toString()`), habit IDs, cue IDs, and reward IDs will use monotonic timestamps combined with cryptographic or random entropy:
```typescript
export function generateEntityId(prefix: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${ts}_${rand}`;
}
```

---

## 4. Codebase Map Alignment

### 4.1 Architecture & Boundaries (`ARCHITECTURE.md` & `STRUCTURE.md`)
- Pure engines belong in `src/behavior/` (typed with strict TypeScript, 0 `any` casts).
- State provider belongs in `src/context/` (`HabitContext.js` / `.tsx`), following the existing provider pattern established by `TaskContext.js`.
- Provider mounted in `App.js` alongside `TaskProvider`, `VaultProvider`, `BillingProvider`, and `BirthdayProvider`.
- Cross-domain communication uses `eventBus.emit()`, never direct cross-context imports.

### 4.2 Concerns & Mitigations (`CONCERNS.md`)
- **CONCERNS.md:19-24 (Non-unique ID generation):** Solved by implementing `generateEntityId(prefix)` with timestamp + entropy for all habit, cue, identity, and reward IDs.
- **CONCERNS.md:67-72 (Overbroad cache-clear key matcher):** Solved by explicitly updating `isUserDataKey` in `src/utils/storage.js` to protect `kwestup_habits_*`, `kwestup_behavior_events_*`, `kwestup_identities_*`, and `kwestup_rewards_*`.
- **CONCERNS.md:164-169 (Single-blob AsyncStorage dataset parsed on every load):** Solved by using dedicated domain keys (`kwestup_habits_v1`, `kwestup_behavior_events_v1`) rather than bloating `kwestup_data_${STORAGE_VERSION}`.
- **CONCERNS.md:239-242 (Unbounded array growth):** Solved by enforcing a hard 500-item FIFO cap on `kwestup_behavior_events_v1`.
- **CONCERNS.md:31-36 (`console.*` bypassing the logger):** Solved by strictly using `logger` from `src/utils/logger.js`.
- **CONCERNS.md:219-224 (Phase-23 eventBus leak risks):** Solved by proper subscription cleanup in `useEffect` hooks.

### 4.3 Conventions & Stack (`CONVENTIONS.md` & `STACK.md`)
- Expo SDK 57, React Native 0.86, React 19.2.3, Node 22.
- Pure functions return new objects (never mutate in-place).
- JSDoc / TypeScript contracts on all public APIs.
- No path aliases (`@/` or `~/`); strict relative imports.

### 4.4 Testing & Mock Strategy (`TESTING.md`)
- Test runner: Jest 29.7.0 with `jest-expo/android`.
- Test locations: `__tests__/unit/behaviorRuleEngine.test.ts` and `__tests__/unit/habitContext.test.js`.
- Mocks: Rely on `__tests__/setup/jest.setup.js` for AsyncStorage; spy on `logger` without replacing it.
- Table-driven unit tests for all rule evaluations and boundary conditions.

---

## 5. Phase 24 Plan Breakdown

- **Plan 24-01 (Wave 1):** Pure Deterministic Behavioral Engines & Machine Rule Evaluator
  - Implement `ruleEngine.ts`, `habitEngine.ts`, `cueEngine.ts`, `recoveryEngine.ts`, `rewardEngine.ts`, and `improvementEngine.ts`.
  - Machine rule loading and condition evaluation.
  - Comprehensive unit test suite in `__tests__/unit/behaviorRuleEngine.test.ts`.

- **Plan 24-02 (Wave 2):** `HabitContext`, Isolated Persistence, Cache Protection & App Provider Wiring
  - Update `isUserDataKey` in `src/utils/storage.js`.
  - Implement `HabitContext.js` with isolated persistence (`kwestup_habits_v1`, `kwestup_behavior_events_v1`), eventBus emission, recovery state machine, and minimum action execution.
  - Mount `HabitProvider` in `App.js`.
  - Comprehensive unit tests in `__tests__/unit/habitContext.test.js`.
