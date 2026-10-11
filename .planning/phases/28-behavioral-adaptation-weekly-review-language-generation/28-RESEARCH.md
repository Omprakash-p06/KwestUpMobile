# Phase 28 Research: Behavioral Adaptation, Weekly Review & Language Generation

**Phase:** 28 of 28 (Milestone 3: KwestUp 4.0 — Atomic Behavior Engine)  
**Requirements Addressed:** `AI-04`  
**Domain:** Semantic Friction Diagnosis, Behavior Analyst, Language Generator, Weekly Review Engine, Deterministic Intervention Mapping, End-to-End Hardening  
**Date:** 2026-10-11  

---

## 1. Executive Summary

Phase 28 delivers requirement `AI-04`: **Behavioral Adaptation, Weekly Review & Language Generation**, representing the capstone phase of Milestone 3 and the final integration of the KwestUp 4.0 Atomic Behavior Engine.

In Phase 26 and Phase 27, we established:
1. The **Finite Command Gateway & AI Sandbox** (`src/commands/`) isolating storage and native OS capabilities behind type validation, idempotency caching, and confirmation gates.
2. The **On-Device AI Intent Parser & Behavior Compiler** (`src/ai/`) extracting bare facts from natural language via Qwen2.5-0.5B (with 100% offline heuristic fallback) and deterministically compiling them into validated habit plans.

Phase 28 elevates the on-device AI into two high-value, privacy-preserving behavioral roles:
1. **Behavior Analyst:** Semantically diagnosing user friction from reflection notes and check-in utterances, categorizing obstacles across the 6-pillar Atomic Habits friction taxonomy (`effort`, `time`, `setup`, `emotional`, `mental`, `location`), and mapping them to deterministic system adjustments.
2. **Language Generator:** Synthesizing factual, non-punitive weekly reflection narratives from 7-day behavior telemetry, celebrating identity evidence votes, evaluating Never-Miss-Twice recovery adherence, and suggesting actionable system adaptations without toxic gamification.

```text
                                  ┌──────────────────────────────────────────────┐
                                  │            User Reflection Note              │
                                  │   "Too exhausted to code after late work"    │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │   Behavior Analyst (src/ai/frictionAnalyzer) │
                                  │   ├─ On-Device Qwen (Prompt clamped ≤500)    │
                                  │   └─ Heuristic Regex/Keyword Fallback        │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                      Friction Category: 'effort' (Physical Energy)
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │     Deterministic Intervention Mapping       │
                                  │     Rule: MINIMUM_ACTION_001                 │
                                  │     Action: ADJUST_DIFFICULTY (2-min action) │
                                  └──────────────────────┬───────────────────────┘
                                                         │
┌─────────────────────────────────┐                      │
│ 7-Day Behavior Events Log       │                      │
│ (kwestup_behavior_events_v1)    ├────────┐             │
├─────────────────────────────────┤        │             │
│ Identity Evidence Votes         │        ▼             ▼
│ (kwestup_identities_v1)         ├─► ┌──────────────────────────────────────────┐
├─────────────────────────────────┤   │ Weekly Review Engine                     │
│ Active Habit States             │   │ (src/ai/weeklyReviewEngine.ts)           │
│ (kwestup_habits_v1)             ├───┤ ├─ Identity Vote Aggregation             │
└─────────────────────────────────┘   │ ├─ Rolling Consistency Rate              │
                                      │ ├─ Never-Miss-Twice Recovery Rate        │
                                      │ ├─ Language Generator (Narrative)        │
                                      │ └─ Deterministic Adjustment Proposals    │
                                      └──────────────────┬───────────────────────┘
                                                         │
                                                         ▼
                                      ┌──────────────────────────────────────────┐
                                      │ Weekly Behavioral Review UI              │
                                      │ (src/components/WeeklyReviewModal.js)    │
                                      │ ├─ Factual Identity Scorecard            │
                                      │ ├─ Friction Distribution Chart           │
                                      │ └─ [Accept Adjustment] -> Gateway Hook   │
                                      └──────────────────────────────────────────┘
```

---

## 2. Friction Taxonomy & Diagnostic Specification

### 2.1 The 6 Friction Categories
Per [`rulebook/atomic-habits/friction.md`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/rulebook/atomic-habits/friction.md) and [`src/behavior/types.ts:FrictionCategory`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/behavior/types.ts#L193):

| Category | Description | Common Trigger Utterances | Deterministic Adaptation | Rule ID |
| :--- | :--- | :--- | :--- | :--- |
| `effort` | Physical / energy exhaustion | "too tired", "exhausted", "low energy", "drained", "no strength" | Downscale to 2-minute gateway version (`ADJUST_DIFFICULTY`) | `MINIMUM_ACTION_001` |
| `time` | Duration / schedule conflict | "too busy", "no time", "running late", "meeting ran over", "rush" | Shift cue time or anchor (`UPDATE_HABIT` / `CUE_STACK_001`) | `CUE_STACK_001` |
| `setup` | Environment / preparation friction | "couldn't find gear", "notes not ready", "room messy", "tools missing" | Add priming step to preceding evening routine (`CUE_STACK_002`) | `CUE_STACK_002` |
| `emotional` | Anxiety / dread / perfectionism | "dreading it", "anxious", "overwhelmed", "avoiding", "afraid to start" | Micro-step downscaling + Identity affirmation | `HABIT_IDENTITY_ANCHOR_001` |
| `mental` | Cognitive ambiguity / lack of clarity | "confusing", "didn't know what to do", "stuck", "too complex", "vague" | Specify exact first line / file target (`UPDATE_HABIT`) | `MINIMUM_ACTION_001` |
| `location` | Contextual / travel disruption | "traveling", "in a hotel", "away from home", "at airport", "on vacation" | Switch to portable / travel routine variant | `CUE_STACK_001` |

### 2.2 Model Diagnostic Contract & Budgeting
The Behavior Analyst prompt instructs Qwen2.5-0.5B to classify input text into exactly one `FrictionCategory`:
- Input clamped to 500 characters.
- System prompt is concise (~120 tokens), enforcing strict JSON output:
  `{"category": "effort"|"time"|"setup"|"emotional"|"mental"|"location", "reason": "brief explanation"}`
- `n_predict: 80`, temperature 0.1, 10s timeout race.
- **Fail-safe:** Every failure (malformed JSON, timeout, missing model, invalid category) immediately cascades to `diagnoseFrictionHeuristic`.

### 2.3 Deterministic Heuristic Fallback
`diagnoseFrictionHeuristic` uses curated regex patterns matching the taxonomy, providing instant, offline diagnostics with zero dependencies.

---

## 3. Weekly Review Engine & Language Generator

### 3.1 Philosophical Principles (Atomic Habits Chapter 20)
Per [`rulebook/atomic-habits/review-system.md`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/rulebook/atomic-habits/review-system.md):
1. **Factual Self-Reflection:** Reflect on what went well, what friction occurred, and how to adapt.
2. **Identity Evidence Votes:** Habits are votes cast for the type of person you wish to become. Focus on the cumulative vote tally (`totalEvidenceVotes`), not fragile streak perfection.
3. **Zero Toxic Gamification:**
   - No guilt tripping ("You broke your 10-day streak!").
   - No punitive loss aversion ("Start all over from zero!").
   - No aggressive red warnings or manipulative anxiety hooks.
   - Frame every miss as valuable diagnostic data about system friction, not human weakness.

### 3.2 Weekly Metric Computation
The review engine operates over a 7-day rolling window (`baseDate - 7 days` to `baseDate`):
1. **Total Habits Tracked:** Number of active and recovery habits.
2. **Overall Consistency Rate:** Mean completion consistency across all tracked habits via `calculateRollingConsistency`.
3. **Total Completions & Misses:** Sum of `HABIT_COMPLETED` and `HABIT_MISSED` events.
4. **Never-Miss-Twice Recovery Rate:**
   $$\text{Recovery Adherence} = \frac{\text{Recovery Completions}}{\text{Single Misses}}$$
   Measures whether the user rebounded on the day immediately following a miss.
5. **Identity Votes Cast:** Map of `identityId` to votes accumulated during the 7-day window and all-time total.
6. **Top Friction Touchpoints:** Frequency table of diagnosed friction categories during the week.
7. **Deterministic Adjustment Proposals:** List of executable `DispatchedCommand` proposals resolving recurring friction.

### 3.3 Language Generator Specification
- **Prompt:** Grounded with factual 7-day metrics, identity names, and top friction touchpoint. Clamped to ≤600 characters.
- **Constraints:** `n_predict: 180`, temperature 0.3, max 15s timeout.
- **Tone:** Encouraging, philosophical, concise (2 short paragraphs).
- **Fallback (`generateWeeklyReviewHeuristic`):** Structured template string inserting actual user stats:
  > *"This week, you cast {N} votes for your identity as a {identityTitle}. Your consistency was {rate}%. When friction arose ({topFriction}), your system adapted. Remember: you don't rise to the level of your goals, you fall to the level of your systems."*

---

## 4. UI Architecture: Weekly Behavioral Review Modal

### 4.1 Component Design (`WeeklyReviewModal.js`)
- Styled using `LiquidGlassCard`, theme tokens (`currentTheme.primary`, `cardBackground`, etc.), and `@expo/vector-icons`.
- Content sections:
  1. **Header & Date Range:** Sunday date or custom range.
  2. **Identity Scorecard:** Carousel or list of identities with votes cast this week (+N votes).
  3. **Consistency & Recovery Metrics:** Circular or bar indicator showing consistency rate and Never-Miss-Twice recovery score.
  4. **Friction Breakdown:** Chip tags showing which friction types occurred.
  5. **Narrative Reflection:** Generated text from Language Generator.
  6. **Actionable System Proposals:** Card showing proposed difficulty downscaling or cue adjustment with a one-tap **"Apply Adjustment"** button.
- Tapping **"Apply Adjustment"** dispatches the command directly through `useCommandGateway.dispatchCommand` (with user confirmation).

---

## 5. End-to-End Integration Hardening & Production Gates

### 5.1 Pipeline Verification Scenarios
A complete integration test (`__tests__/unit/behavioralPipelineE2E.test.ts`) verifies the unbroken chain across all Milestone 3 layers:
1. Natural language utterance -> `parseUserIntent` -> `compileIntentToCommand` -> `executeCommand` -> `HabitContext` adds habit.
2. Miss event logged -> `recoveryEngine` transitions to recovery status -> `selectWidgetTouchpoint` surfaces 2-minute recovery cue.
3. Friction note submitted -> `diagnoseFriction` classifies category -> `mapFrictionToIntervention` proposes difficulty adjustment -> Gateway executes `ADJUST_DIFFICULTY`.
4. Weekly review triggered -> `generateWeeklyReview` computes report -> UI accepts adjustment -> Gateway persists changes.

### 5.2 Quality Gates
- `npm run typecheck`: 0 errors.
- `npm run lint`: 0 errors.
- `npm test`: 100% pass across all test suites (>450 tests).
