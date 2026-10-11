# Phase 26 Validation: Command Gateway, Safe Execution Layer & AI Sandboxing

**Phase:** 26 of 28 (Milestone 3: KwestUp 4.0 — Atomic Behavior Engine)  
**Status:** In Planning  
**Requirements Addressed:** `CMD-01`  
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
- **ESLint Code Quality**: `npm run lint` (`eslint .`) passes with 0 errors. All new modules adhere to zero raw `console.*` rules, routing all logging through `src/utils/logger.js`.
- **Jest Test Suite**: Dedicated unit test suites `__tests__/unit/commandGateway.test.ts`, `__tests__/unit/aiSandbox.test.ts`, and `__tests__/unit/commandIntegration.test.ts` pass 100%, and the full regression suite passes 100% (22+ suites, 350+ tests).

---

## 2. Test Cases & Verification Matrix

| Test Case | Component / File | Expected Behavior |
|---|---|---|
| **TC-CMD-01** | `commandValidator.ts` Schema Validation | Validates parameters and lengths across all 11 `CommandAction` types (`CREATE_HABIT`, `UPDATE_HABIT`, `DELETE_HABIT`, `LOG_HABIT`, `START_RECOVERY`, `DISMISS_INTERVENTION`, `ADJUST_DIFFICULTY`, `CREATE_IDENTITY`, `PAUSE_HABIT`, `ARCHIVE_HABIT`, `RESUME_HABIT`). Rejects missing fields, out-of-range strings, negative durations. |
| **TC-CMD-02** | `commandValidator.ts` Prohibited Field Guard | `UPDATE_HABIT`: Rejects attempts to modify engine-owned properties (`status`, `streakCount`, `bestStreak`, `totalEvidenceVotes`, `lastCompletedDate`). Only permits `title`, `behavior`, `minimumAction`, `normalTarget`. |
| **TC-CMD-03** | `commandValidator.ts` Capability Evaluation | `SYS_COMMAND_CAPABILITY_CHECK_001`: Evaluates action against supported capabilities. Unrecognized commands are rejected with rule citation. |
| **TC-CMD-04** | `commandValidator.ts` Actor Permissions | Rejects unconfirmed destructive operations (`DELETE_HABIT`, `ARCHIVE_HABIT`) when caller is `'ai'` and `command.confirmed !== true`. Permits when `confirmed: true`. |
| **TC-CMD-05** | `commandExecutor.ts` Idempotency Deduplication | `SYS_IDEMPOTENT_COMMAND_001`: When a command with an existing `idempotencyKey` is dispatched within the TTL window, returns the cached `CommandExecutionResult` without re-executing handler. |
| **TC-CMD-06** | `commandExecutor.ts` Error Isolation | Handler failure (throw/rejection) is safely caught, logged via `logger.error`, and returns `{ success: false, error: ... }` without crashing the caller or unhandled rejection. |
| **TC-CMD-07** | `commandExecutor.ts` Domain Telemetry Dispatch | Successful command execution emits `COMMAND_EXECUTED` event on `eventBus` with caller, entityId, and idempotencyKey. |
| **TC-CMD-08** | `aiSandbox.ts` Prototype Pollution Defense | Sanitizes incoming AI payloads, stripping `__proto__`, `constructor`, and `prototype` references to prevent prototype poisoning. |
| **TC-CMD-09** | `aiSandbox.ts` Storage Key & Path Injection Defense | Strips and rejects attempts to pass storage keys (`kwestup_*`) or path traversal sequences (`../`, `file://`, `/`). |
| **TC-CMD-10** | `aiSandbox.ts` Zero-Escape Invariant | Enforces that AI execution paths have ZERO access to `AsyncStorage`, native Android APIs, or notification services; all actions must route through Command Gateway. |
| **TC-CMD-11** | `aiSandbox.ts` PII Log Scrubbing | Enforces `SYS_PII_LOG_REDACT_001`: redacts sensitive user habit text and cue strings from diagnostic breadcrumb logs. |
| **TC-CMD-12** | `habitCommandHandlers.ts` End-to-End Integration | Successfully executes habit lifecycle actions (`CREATE_HABIT`, `UPDATE_HABIT`, `LOG_HABIT`, `START_RECOVERY`, `PAUSE_HABIT`, `RESUME_HABIT`, `DELETE_HABIT`) through `HabitContext` and pure engines. |

---

## 3. Failure Mode & Boundary Considerations

1. **Adversarial Payload Injection:**
   Untrusted LLM outputs may contain nested objects, unexpected prototypes, or injection strings. The AI sandbox must defensively clone and sanitize raw inputs, rejecting non-primitive references.
2. **Idempotency Cache Memory Ceiling:**
   The idempotency deduplication cache must be bounded (e.g. max 200 items, FIFO eviction) with an expiration TTL (15 minutes) to ensure memory never leaks over long app sessions.
3. **Engine-Owned State Protection:**
   The habit state machine (`active` -> `recovery` -> `active`) is owned by the deterministic behavior engine (`habitEngine.ts`, `recoveryEngine.ts`). Callers must not be able to bypass the rules by submitting an update with `status: 'active'`.
4. **Offline Isolation:**
   In adherence to `SYS_ZERO_CLOUD_001`, the Command Gateway and AI Sandbox must never initiate network calls. All execution is 100% on-device and offline.
