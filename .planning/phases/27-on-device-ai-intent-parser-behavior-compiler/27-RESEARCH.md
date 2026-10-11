# Phase 27 Research: On-Device AI Intent Parser & Behavior Compiler

**Phase:** 27 of 28 (Milestone 3: KwestUp 4.0 — Atomic Behavior Engine)  
**Requirements Addressed:** `AI-03`  
**Domain:** On-Device Intent Extraction, Specialist LLM Prompting, Rule Packet Retrieval (Rule RAG), Offline Heuristic Fallback, Deterministic Behavior Compilation  
**Date:** 2026-10-11  

---

## 1. Executive Summary

Phase 27 fulfills requirement `AI-03`: **On-Device AI Intent Parser & Behavior Compiler**. It connects the local, offline Qwen2.5-0.5B LLM to specialized natural-language intent parsing and deterministic habit compilation.

As established in the architectural foundation of KwestUp ([`4.0/KwestUp_4.0_Master_Plan.md §1 & §7`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/4.0/KwestUp_4.0_Master_Plan.md#L10-L86)):
> *"KwestUp is an AI-assisted deterministic behavioral machine, not an AI-controlled operating system. A ~400 MB quantized on-device Qwen model cannot and should not be expected to memorize, reason over, or reliably apply the entire Atomic Habits rulebook on every interaction. Instead, think of the model as a specialist intent extractor operating inside a deterministic behavioral machine."*

### The Architectural Pipeline
```text
User Natural Language Input
            ↓
Specialist Intent Parser (src/ai/intentParser.ts)
  ├─ On-Device LLM (llama.rn + Qwen2.5-0.5B, n_predict ≤ 120)
  ├─ Rule Packet Retriever (Lightweight Rule RAG, 2–3 machine rules)
  └─ Heuristic Fallback Engine (src/ai/heuristicParser.ts, 100% offline regex/NLP)
            ↓
Extracted Bare-Fact Intent (ExtractedIntent)
  { action, behavior, frequency, cueType, time, anchor, minimumAction }
            ↓
Behavior Compiler (src/ai/behaviorCompiler.ts)
  ├─ Evaluates HABIT_CONCURRENT_CAP_001 (Max 3 active habits)
  ├─ Derives Two-Minute Minimum Action (MINIMUM_ACTION_001, <120s)
  ├─ Anchors Identity Statement (HABIT_IDENTITY_ANCHOR_001)
  ├─ Binds Implementation Intention / Habit Stack (CUE_STACK_001/002)
  └─ Sets Never-Miss-Twice Recovery Contract (NEVER_MISS_TWICE_001)
            ↓
Dispatched Command Proposal
            ↓
Command Gateway & AI Sandbox (src/commands/aiSandbox.ts, Phase 26)
  ├─ Prototype pollution & path traversal sanitization
  ├─ Confirmation gating for destructive actions (DELETE_HABIT, ARCHIVE_HABIT)
  └─ Safe execution via CommandExecutor (Idempotency, EventBus telemetry)
```

By decoupling **probabilistic intent extraction** (what did the user say?) from **deterministic compilation** (what are the mathematical and rulebook constraints of Atomic Habits?), we eliminate model hallucinations, context overflows, and corrupted habit states.

---

## 2. Intent Parser Specification & Contract

### 2.1 The Extracted Intent Schema
Rather than asking a 0.5B model to generate deep nested schemas, the specialist model extracts only primitive facts:

```typescript
export interface ExtractedIntent {
  action: CommandAction; // CREATE_HABIT, LOG_HABIT, PAUSE_HABIT, DELETE_HABIT, etc.
  behavior: string; // The core action, e.g. "study DSA" or "read books"
  frequency?: HabitFrequency; // 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom'
  customWeekdays?: number[]; // [1, 3, 5] if custom
  cueType?: CueType; // 'time' | 'after-habit' | 'morning' | 'evening' | 'manual'
  time?: string; // "07:30" (HH:mm)
  anchor?: string; // "after dinner", "when I wake up"
  location?: string; // "in study room", "gym"
  minimumAction?: string; // optional hint if user mentioned small start
  target?: string; // optional normal target if mentioned
  reason?: string; // reason for pause/archive/recovery
  confidence: number; // 0.0 to 1.0
  source: 'llm' | 'heuristic';
  rulesRetrieved?: string[];
}
```

### 2.2 Model Prompt Design
The on-device Qwen model is prompted strictly as an intent classification and fact extraction engine:
1. **System Prompt:** Compact (~150 tokens) role definition with strict JSON output requirement.
2. **Grammar / Schema Constraints:** Output must be a single flat JSON object with exact property keys.
3. **Budget & Token Limits:** `n_predict: 120`. Clamped input at 500 characters. Temperature `0.1` for maximum determinism.
4. **Memory Management:** Connects to `loadModel()`, `resetIdleTimer()`, and `unloadModel()` from [`src/utils/aiService.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/utils/aiService.js).

---

## 3. Rule Packet Retrieval (Rule RAG)

### 3.1 Motivation
Injecting the entire `rulebook/machine/*.json` (over 30 rules) into a small 0.5B model's prompt exceeds context limits, wastes memory, and causes attention drift.
However, providing **2 to 3 relevant rule definitions** when specific behavioral triggers are detected in the user utterance allows the model to map nuanced phrasing accurately.

### 3.2 Keyword Index
| Trigger Keywords | Retrieved Rule IDs | Injected Context Snippet |
| :--- | :--- | :--- |
| `after`, `before`, `stack`, `then`, `when I` | `CUE_STACK_001`, `CUE_STACK_002` | `Rule CUE_STACK: Anchor target habit to an existing daily anchor habit.` |
| `identity`, `become`, `person`, `type of` | `HABIT_IDENTITY_ANCHOR_001` | `Rule IDENTITY: Ground habit in identity belief ("I am a...").` |
| `start small`, `2 min`, `two minute`, `easy` | `MINIMUM_ACTION_001` | `Rule 2-MIN: Define gateway action that takes under 120 seconds.` |
| `miss`, `missed`, `skip`, `fail`, `relapse` | `NEVER_MISS_TWICE_001` | `Rule RECOVERY: Never miss twice. Revert to 2-minute version next day.` |
| `pause`, `vacation`, `break`, `hold` | `HABIT_PAUSE_001` | `Rule PAUSE: Temporary pause preserves streak and identity.` |

### 3.3 Strict Budgeting
The injected rule packet is capped at **200 characters**, preventing context blowup while maximizing relevance.

---

## 4. Offline Heuristic Fallback Engine

KwestUp's core value is **100% offline local-first reliability** ([`PROJECT.md`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/.planning/PROJECT.md#L7-L9)). The app must remain fully functional even when:
1. The user has not downloaded the ~468 MB model.
2. Device RAM is constrained or background memory pressure forces model unload.
3. Native LLM inference throws a GGML error or malformed JSON.

### 4.1 Pattern Matching Capabilities
The heuristic parser ([`src/ai/heuristicParser.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/ai/heuristicParser.ts)) evaluates:
- **Action Verbs & Intent Markers:**
  - Delete: `/(?:delete|remove|cancel|stop)\s+(?:habit\s+)?(.+)/i`
  - Pause: `/(?:pause|put on hold|freeze)\s+(?:habit\s+)?(.+)/i`
  - Resume: `/(?:resume|unpause|continue)\s+(?:habit\s+)?(.+)/i`
  - Log/Complete: `/(?:log|completed|finished|did|check off)\s+(?:habit\s+)?(.+)/i`
  - Adjust Difficulty: `/(?:make easier|too hard|reduce|lower)\s+(?:habit\s+)?(.+)/i`
  - Create: `/(?:i want to|start|create|build a habit of|remind me to)\s+(.+)/i`
- **Time & Cue Patterns:**
  - Explicit clock times: `/(?:at|by)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i` (normalized to `HH:mm`)
  - Time of day: `morning` -> `08:00`, `evening` / `night` -> `20:00`, `afternoon` -> `14:00`
  - Habit stacking: `/(?:after|before|following)\s+([^,.]+)/i` -> anchor habit extracted
- **Frequency Markers:**
  - `every day`, `daily` -> `'daily'`
  - `weekdays`, `mon-fri` -> `'weekdays'`
  - `weekends` -> `'weekends'`
  - `weekly`, `once a week` -> `'weekly'`

---

## 5. Deterministic Behavior Compiler

The Behavior Compiler ([`src/ai/behaviorCompiler.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/ai/behaviorCompiler.ts)) takes the bare-fact `ExtractedIntent` and produces a fully qualified, rule-compliant habit plan.

### 5.1 Deterministic Expansion Rules
1. **Concurrent Cap Check (`HABIT_CONCURRENT_CAP_001`):**
   - Checks against existing active habits from `HabitContext` / storage.
   - If active count $\ge 3$, compiles a rejection response explaining the constraint and suggesting pausing or graduating an existing habit.
2. **Two-Minute Rule Generation (`MINIMUM_ACTION_001`):**
   - If user provided minimum action: verifies length $\le 100$ and non-empty.
   - If absent: deterministically generates gateway action:
     - `"read books"` -> `"Read 1 page"`
     - `"exercise / pushups"` -> `"Do 1 pushup or stretch for 30s"`
     - `"meditate"` -> `"Sit quietly for 1 minute"`
     - Default: `"2-minute version: start <behavior>"`
3. **Identity Framing (`HABIT_IDENTITY_ANCHOR_001`):**
   - Automatically derives identity statement if omitted:
     - `"read books"` -> `"I am a consistent reader"`
     - `"run / jog"` -> `"I am an active runner"`
     - `"code / study DSA"` -> `"I am a disciplined software engineer"`
     - Default: `"I am a consistent <behavior> practitioner"`
4. **Cue Stack Binding (`CUE_STACK_001`, `CUE_STACK_002`):**
   - Normalizes cue into structured `Cue` object with type, time, anchor, and location.
5. **Never-Miss-Twice Protocol (`NEVER_MISS_TWICE_001`):**
   - Configures automatic fallback to the 2-minute minimum action whenever a scheduled habit is missed.
6. **Command Formulation:**
   - Synthesizes a valid `DispatchedCommand` payload matching [`src/commands/types.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/commands/types.ts).
   - If destructive (`DELETE_HABIT`, `ARCHIVE_HABIT`), sets `requiresConfirmation: true`.

---

## 6. Threat Modeling & Security Posture

| Threat | Risk Level | Mitigation in Phase 27 |
| :--- | :--- | :--- |
| **Prompt Injection / Jailbreak** | High | LLM output is parsed solely for primitive facts; prompt is clamped to 500 chars; model has zero execution authority; all compiled commands pass through `commandValidator.ts` and `aiSandbox.ts`. |
| **Hallucinated State Mutation** | High | LLM cannot generate IDs, streaks, or status flags. Behavior Compiler deterministically controls all domain rules and parameters. |
| **Memory Exhaustion (OOM)** | High | Output tokens strictly capped (`n_predict: 120`). Native context auto-unloaded on 5-min idle or background. Native failure gracefully triggers heuristic fallback. |
| **Cloud Egress / Privacy Leak** | Critical | 100% offline inference. No network sockets opened. User prompt text and intent parameters are sanitized from forensic logger ring buffers. |

---

## 7. Plan Slicing for Phase 27

- **Plan 27-01 (Wave 1): Specialist Intent Parser & Heuristic Fallback**
  - Implement `src/ai/types.ts` defining `ExtractedIntent` and parser contracts.
  - Implement `src/ai/rulePacketRetriever.ts` for lightweight keyword-based rule RAG.
  - Implement `src/ai/heuristicParser.ts` for 100% offline regex/pattern intent extraction.
  - Implement `src/ai/intentParser.ts` integrating llama.rn Qwen prompt with heuristic fallback.
  - Unit tests in `__tests__/unit/intentParser.test.ts`.

- **Plan 27-02 (Wave 2): Deterministic Behavior Compiler & Command Gateway Dispatch**
  - Implement `src/ai/behaviorCompiler.ts` compiling `ExtractedIntent` into complete Atomic Habits plans and `DispatchedCommand` objects.
  - Integrate with `compileHabitPlan`, `generateMinimumAction`, and `validateHabitCreation` from `habitEngine.ts`.
  - Connect with `src/commands/aiSandbox.ts` for sandboxed execution and destructive confirmation gating.
  - Unit & integration tests in `__tests__/unit/behaviorCompiler.test.ts`.
