# Phase 27 Validation: On-Device AI Intent Parser & Behavior Compiler

**Phase:** 27 of 28 (Milestone 3: KwestUp 4.0 — Atomic Behavior Engine)  
**Status:** In Planning  
**Requirements Addressed:** `AI-03`  
**Validation Suites:** `npm run typecheck`, `npm run lint`, `npm test`  

---

## 1. Automated Validation Gates

### Test Execution Commands
```bash
npm run typecheck
npm run lint
npm test
```

### Gate Criteria
- **TypeScript Static Verification**: `npm run typecheck` (`tsc --noEmit`) passes with 0 errors across all files in `src/` and `widgets/`.
- **ESLint Code Quality**: `npm run lint` (`eslint .`) passes with 0 errors. All new modules adhere to zero raw `console.*` rules, routing logging through `src/utils/logger.js`.
- **Jest Test Suite**: Dedicated unit test suites `__tests__/unit/intentParser.test.ts` and `__tests__/unit/behaviorCompiler.test.ts` pass 100%, and the full regression suite passes 100% (23+ suites, 365+ tests).

---

## 2. Test Cases & Verification Matrix

| Test Case | Component / File | Expected Behavior |
|---|---|---|
| **TC-AIP-01** | `rulePacketRetriever.ts` Keyword Matching | Matches keywords (`after`, `stack`, `identity`, `2 min`, `missed`, `pause`) to corresponding machine rule IDs (`CUE_STACK_001/002`, `HABIT_IDENTITY_ANCHOR_001`, `MINIMUM_ACTION_001`, `NEVER_MISS_TWICE_001`, `HABIT_PAUSE_001`). |
| **TC-AIP-02** | `rulePacketRetriever.ts` Prompt Clamping | Enforces prompt text budget: output string is clamped to $\le 200$ characters, preventing context bloat. |
| **TC-AIP-03** | `heuristicParser.ts` Action Identification | Identifies `CREATE_HABIT`, `DELETE_HABIT`, `PAUSE_HABIT`, `RESUME_HABIT`, `ARCHIVE_HABIT`, `LOG_HABIT`, and `ADJUST_DIFFICULTY` from natural language utterances with 100% offline reliability. |
| **TC-AIP-04** | `heuristicParser.ts` Frequency Extraction | Correctly extracts frequencies: `'daily'`, `'weekdays'`, `'weekends'`, `'weekly'`, and `'custom'` (with custom weekdays array). |
| **TC-AIP-05** | `heuristicParser.ts` Cue & Time Extraction | Normalizes explicit times (e.g. "at 7:30 am" -> "07:30"), extracts time-of-day cues (morning/evening), and identifies habit stack anchors ("after dinner", "before bed"). |
| **TC-AIP-06** | `intentParser.ts` On-Device LLM Integration | When on-device Qwen model is available, successfully invokes completion with clamped input and `n_predict: 120`, parsing valid JSON output into `ExtractedIntent` with `source: 'llm'`. |
| **TC-AIP-07** | `intentParser.ts` Resilient Heuristic Fallback | When on-device model produces malformed JSON, times out, or throws native GGML error, gracefully falls back to `heuristicParser.ts` with `source: 'heuristic'` without throwing or interrupting the user. |
| **TC-AIP-08** | `intentParser.ts` Privacy & Log Sanitization | User utterances and extracted intent parameters are redacted from forensic logs in compliance with `SYS_PII_LOG_REDACT_001`. |
| **TC-AIP-09** | `behaviorCompiler.ts` Concurrent Habit Cap | Evaluates `HABIT_CONCURRENT_CAP_001`: If user has 3 active habits, compilation fails with clear explanatory message suggesting pausing or graduating an existing habit. |
| **TC-AIP-10** | `behaviorCompiler.ts` 2-Minute Minimum Action | Deterministically derives achievable gateway action taking <120s (`MINIMUM_ACTION_001`) from behavior text if not explicitly provided. |
| **TC-AIP-11** | `behaviorCompiler.ts` Identity Statement Anchoring | Automatically anchors habit to an identity belief (`HABIT_IDENTITY_ANCHOR_001`) if omitted (e.g. "I am a consistent reader"). |
| **TC-AIP-12** | `behaviorCompiler.ts` Cue Stack & Recovery Binding | Binds structured Cue and configures Never-Miss-Twice recovery downscaling (`NEVER_MISS_TWICE_001`). |
| **TC-AIP-13** | `behaviorCompiler.ts` Destructive Action Confirmation Gate | Flagged operations (`DELETE_HABIT`, `ARCHIVE_HABIT`) set `requiresConfirmation: true`. `compileAndExecuteIntent` rejects unconfirmed execution with `SYS_AI_CONFIRMATION_GATE_001`. |
| **TC-AIP-14** | `behaviorCompiler.ts` End-to-End Command Dispatch | Successfully compiles and dispatches executable command proposal through `executeAiCommand` in `src/commands/aiSandbox.ts`, invoking habit handler and emitting `COMMAND_EXECUTED` domain event. |

---

## 3. Failure Mode & Boundary Considerations

1. **Model Context OOM / Native Crash:**
   Inference is capped to `n_predict: 120`. If native llama.rn throws or encounters memory pressure, the parser catches the error, frees context via `unloadModel()`, and instantly resolves using the deterministic heuristic engine.
2. **Context Overload via Excessive User Utterance:**
   User input strings are clamped to 500 characters prior to prompt construction, completely eliminating prompt stuffing attacks.
3. **Hallucinated State & Unauthorized Capabilities:**
   The Qwen model is constrained to bare fact extraction. It cannot invent commands, write to storage, or alter habit state directly. All actions flow through the Behavior Compiler and Command Gateway.
4. **Destructive Execution Protection:**
   The Behavior Compiler and AI Sandbox require explicit human confirmation (`options.confirmed: true`) before deleting or archiving any habit.
