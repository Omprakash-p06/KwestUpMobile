---
status: issues-found
files_reviewed: 9
findings:
  critical: 0
  warning: 8
  info: 0
  total: 8
phase: "27"
depth: standard
---

# Phase 27: Code Review Report — On-Device AI Intent Parser & Behavior Compiler

**Reviewed:** 2026-10-11  
**Depth:** standard (per-file analysis with security, concurrency, NLP heuristics, and behavioral rulebook checks)  
**Files Reviewed:** 9 (`src/ai/types.ts`, `src/ai/rulePacketRetriever.ts`, `src/ai/heuristicParser.ts`, `src/ai/intentParser.ts`, `src/ai/behaviorCompiler.ts`, `src/ai/index.ts`, `src/commands/aiSandbox.ts`, `__tests__/unit/intentParser.test.ts`, `__tests__/unit/behaviorCompiler.test.ts`)  
**Status:** issues-found  

---

## Summary

Reviewed all 9 Phase 27 files plus cross-referenced `rulebook/machine/habitRules.json`, `rulebook/ai/intent-parser.md`, `src/commands/commandValidator.ts`, `src/commands/aiSandbox.ts`, and `src/behavior/habitEngine.ts`. The specialist on-device intent parser, rule packet RAG retriever, 100% offline heuristic parser, deterministic behavior compiler, and sandboxed gateway execution bridge provide a resilient implementation for requirement `[AI-03]`.

However, 8 quality, robustness, and accuracy findings were identified across the subsystem:
1. **Security / Reliability:** Unescaped `anchor` string interpolated into `new RegExp` in `src/ai/heuristicParser.ts:195` can throw unhandled `SyntaxError: Invalid regular expression` and crash if user input contains regex metacharacters (`(`, `)`, `?`, `*`).
2. **Robustness / Latency:** Missing timeout on native `ctx.completion` in `src/ai/intentParser.ts:98` can hang the caller indefinitely if inference deadlocks or is thermally throttled on low-end hardware.
3. **Completeness / Capability:** `src/ai/behaviorCompiler.ts` lacks a case for `UPDATE_HABIT`, causing natural language updates to fail with `"Unsupported compilation action 'UPDATE_HABIT'"` even though it is exposed in the LLM intent schema.
4. **Data Integrity:** In `src/ai/behaviorCompiler.ts`, when `activeHabits` is non-empty but no habit matches `intent.behavior`, generating a random `generateEntityId('habit')` leads to downstream runtime exceptions in `completeHabit` / `HabitContext` rather than returning a clear compilation error.
5. **NLP Accuracy:** In `src/ai/heuristicParser.ts`, saying "at 7 in the evening" results in `07:00` (7 AM) because `explicitTimeMatch` sets `07:00` and the subsequent evening check only applies `time = time || '20:00'`.
6. **NLP Accuracy:** In `src/ai/behaviorCompiler.ts`, the keyword `"study"` was bound exclusively to `"software engineer"`, causing general learning habits (e.g. "study Spanish", "study biology") to incorrectly generate software engineer identity statements.
7. **Governance:** Rules `CUE_STACK_001`, `HABIT_PAUSE_001`, and `HABIT_IDENTITY_ANCHOR_001` are cited in execution traces and prompt injection but are missing from `rulebook/machine/habitRules.json`.
8. **Edge-Case Defense:** In `src/commands/aiSandbox.ts`, array payloads containing `undefined` elements cause sanitization rejection rather than filtering out `undefined` entries.

---

## Findings & Action Plan

### WR-01: Regex Injection Crash in `heuristicParser.ts` via Unescaped Anchor

**Severity:** Warning  
**File:** `src/ai/heuristicParser.ts:195`  
**Issue:**  
The clean behavior extraction constructs a regex with user-supplied anchor text:
```ts
if (anchor) {
  behavior = behavior.replace(new RegExp(`(?:after|before|following|right after|when I)\\s+${anchor}`, 'gi'), '');
}
```
If `anchor` contains unescaped regex metacharacters (e.g. `"morning coffee (hot)"` or `"workout?"`), `new RegExp` throws an uncaught `SyntaxError: Invalid regular expression`, causing the parser to crash.  
**Fix:**  
Sanitize and escape regex metacharacters in `anchor` prior to compiling the regular expression.

---

### WR-02: Unbounded On-Device LLM Inference Timeout in `intentParser.ts`

**Severity:** Warning  
**File:** `src/ai/intentParser.ts:98-111`  
**Issue:**  
`ctx.completion(...)` is awaited without an inference timeout. Under heavy CPU load or thermal throttling on budget devices, stalled inference will hang `parseUserIntent` indefinitely, freezing UI assistant consumers.  
**Fix:**  
Wrap `ctx.completion` in a `Promise.race` with a 15-second timeout (`DEFAULT_INFERENCE_TIMEOUT_MS`). On timeout, log a debug warning and gracefully fall back to `parseIntentHeuristic`.

---

### WR-03: `UPDATE_HABIT` Unsupported in Behavior Compiler

**Severity:** Warning  
**File:** `src/ai/behaviorCompiler.ts:403`  
**Issue:**  
The LLM intent parser prompt includes `"UPDATE_HABIT"` in its action catalog. However, `compileIntentToCommand` only handles 9 of the 10 intent actions, rejecting `UPDATE_HABIT` under `default` with `"Unsupported compilation action 'UPDATE_HABIT'"`.  
**Fix:**  
Add a `case 'UPDATE_HABIT':` branch to `compileIntentToCommand` that resolves the target habit and compiles an `UPDATE_HABIT` command proposal with `updates` (`minimumAction`, `normalTarget`, etc.).

---

### WR-04: Ghost Habit IDs Generated When No Active Habit Matches

**Severity:** Warning  
**File:** `src/ai/behaviorCompiler.ts:221, 244, 268, 292, 316, 342, 367`  
**Issue:**  
For habit-dependent actions (`LOG_HABIT`, `PAUSE_HABIT`, `DELETE_HABIT`, etc.), when `activeHabits` contains habits but none match `intent.behavior`, the compiler invents a random `habitId` via `generateEntityId('habit')`. Passing this non-existent ID to the Command Gateway causes `HabitContext` to throw `"Habit with ID ... not found"`.  
**Fix:**  
Implement `resolveTargetHabitId(behavior, activeHabits)`. When `activeHabits` is populated and no match is found, return a descriptive compilation error (`success: false, errors: ['No active habit found matching ...']`).

---

### WR-05: Missing Time-of-Day Adjustment for AM/PM-less Clock Times

**Severity:** Warning  
**File:** `src/ai/heuristicParser.ts:136-155`  
**Issue:**  
When an utterance contains clock times without AM/PM markers (e.g. `"study at 7 in the evening"`), `explicitTimeMatch` defaults to `"07:00"`. The subsequent check `time = time || '20:00'` does not update `time` because it is already set, incorrectly producing 7:00 AM.  
**Fix:**  
If a clock time was extracted without an explicit AM/PM period and the utterance mentions `evening` or `night`, adjust `hour < 12` to PM (`hour + 12`).

---

### WR-06: Archetype Collision Between General Study and Software Engineering

**Severity:** Warning  
**File:** `src/ai/behaviorCompiler.ts:35`  
**Issue:**  
`ARCHETYPE_IDENTITIES` grouped `"study"` under software engineering (`"I am a disciplined software engineer and continuous learner"`). Consequently, general learning habits (e.g. `"study Spanish"`, `"study biology"`) are assigned a software engineering identity statement.  
**Fix:**  
Separate software engineering (`code`, `program`, `software`, `dsa`, `algorithm`) from general learning (`study`, `learn`, `language`, `research`), creating a dedicated `"I am a curious, disciplined, and lifelong learner"` identity statement.

---

### WR-07: Behavioral Machine Rules Missing in `habitRules.json`

**Severity:** Warning  
**File:** `rulebook/machine/habitRules.json`  
**Issue:**  
Machine rules `CUE_STACK_001` (Habit stack anchor routine), `HABIT_PAUSE_001` (Temporary hold), and `HABIT_IDENTITY_ANCHOR_001` (Identity anchor statement) are documented in Master Plan §7 and cited by the AI subsystem but omitted from `habitRules.json`.  
**Fix:**  
Add `CUE_STACK_001`, `HABIT_PAUSE_001`, and `HABIT_IDENTITY_ANCHOR_001` to `rulebook/machine/habitRules.json`.

---

### WR-08: Sandbox Array Sanitization Rejects Legitimate Arrays Containing `undefined`

**Severity:** Warning  
**File:** `src/commands/aiSandbox.ts:73`  
**Issue:**  
`sanitizeValue` maps arrays with `value.map(sanitizeValue)`. If an array contains sparse or `undefined` elements, `sanitizeValue(undefined)` throws a security violation instead of filtering `undefined` elements.  
**Fix:**  
Filter out `undefined` entries in `sanitizeValue` before mapping array elements.
