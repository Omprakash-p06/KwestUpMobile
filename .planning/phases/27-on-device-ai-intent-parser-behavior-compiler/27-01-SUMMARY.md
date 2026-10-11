# Phase 27 Plan 01 Summary: Specialist Intent Parser & Heuristic Fallback

**Plan:** 27-01  
**Wave:** 1  
**Status:** Completed ✅  
**Date:** 2026-10-11  

---

## 1. What was built

1. **`src/ai/types.ts`**:
   - Defined `ExtractedIntent` interface capturing bare facts (`action`, `behavior`, `frequency`, `customWeekdays`, `cueType`, `time`, `anchor`, `location`, `minimumAction`, `target`, `reason`, `confidence`, `source`, `rulesRetrieved`).
   - Defined `IntentParserOptions`, `RulePacket`, `CompilationResult`, and `CompilerOptions`.

2. **`src/ai/rulePacketRetriever.ts`**:
   - Implemented keyword-based lightweight rule RAG (`retrieveRulePacket`, `formatRulePacketForPrompt`).
   - Matches keywords to behavioral rules (`CUE_STACK_001/002`, `HABIT_IDENTITY_ANCHOR_001`, `MINIMUM_ACTION_001`, `NEVER_MISS_TWICE_001`, `HABIT_PAUSE_001`).
   - Strictly limits output to 3 rules and clamps prompt text $\le 200$ characters.

3. **`src/ai/heuristicParser.ts`**:
   - Implemented 100% offline, deterministic intent parsing (`parseIntentHeuristic`, `normalizeTimeString`).
   - Extracts actions across `CREATE_HABIT`, `DELETE_HABIT`, `PAUSE_HABIT`, `RESUME_HABIT`, `ARCHIVE_HABIT`, `LOG_HABIT`, `ADJUST_DIFFICULTY`, `START_RECOVERY`, `CREATE_IDENTITY`.
   - Normalizes clock times (`07:30`, `20:00`), frequencies (`daily`, `weekdays`, `weekends`, `weekly`, `custom`), habit stack anchors (`after dinner`), and locations (`gym`).

4. **`src/ai/intentParser.ts`**:
   - On-device Qwen2.5-0.5B execution with input clamped to 500 chars, `n_predict: 120`, and temperature `0.1`.
   - Injects formatted rule packet into system prompt.
   - Resilient error isolation: if native LLM fails, is uninstalled, or outputs malformed text, automatically falls back to `parseIntentHeuristic` without throwing to caller.

5. **`__tests__/unit/intentParser.test.ts`**:
   - 19 automated unit tests verifying rule RAG, heuristic parser, and specialist LLM pipeline with 100% pass rate.

---

## 2. Quality Gates Status

- **TypeScript (`tsc --noEmit`):** Passed with **0 errors**.
- **ESLint (`npm run lint`):** Passed with **0 errors**.
- **Jest (`intentParser.test.ts`):** **19 / 19 tests passed**.
