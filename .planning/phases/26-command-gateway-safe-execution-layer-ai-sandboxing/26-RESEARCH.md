# Phase 26 Research: Command Gateway, Safe Execution Layer & AI Sandboxing

**Phase:** 26 of 28 (Milestone 3: KwestUp 4.0 — Atomic Behavior Engine)  
**Requirements Addressed:** `CMD-01`  
**Domain:** Command Gateway, Schema Validation, Capability & Permission Checks, Safe Execution Layer, AI Sandboxing  
**Date:** 2026-10-11  

---

## 1. Executive Summary

Phase 26 establishes the **Command Gateway, Safe Execution Layer & AI Sandboxing** (`CMD-01`), building the critical security and execution boundary between callers (such as user interactions, background widgets, and upcoming on-device AI in Phase 27) and KwestUp's internal state mutation layers.

As articulated in [`4.0/KwestUp_4.0_Master_Plan.md §7`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/4.0/KwestUp_4.0_Master_Plan.md#L395-L465) and [`rulebook/ai/intent-parser.md`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/rulebook/ai/intent-parser.md):
> *"The AI parser is strictly a translator. It possesses zero execution authority. It CANNOT write to AsyncStorage or filesystem vaults. It CANNOT schedule Android system notifications. It CANNOT mutate widget state. All parsed outputs are piped to `commandValidator.ts` and `commandExecutor.ts` for deterministic validation before any system state changes."*

Without a strictly validated command gateway:
1. Untrusted AI outputs (e.g. from local Qwen model) or untrusted payloads could perform arbitrary parameter injections, prototype pollution, or prompt injection attacks to mutate or erase user data ([`CONCERNS.md:25`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/.planning/codebase/CONCERNS.md#L25)).
2. Callers could bypass engine-owned state invariants (e.g., trying to set habit `status` or falsify streak counts directly rather than progressing through deterministic recovery and completion state machines).
3. Concurrent duplicate invocations (double-tap on UI/widget or model inference retries) could duplicate mutations or corrupt state.

Phase 26 solves this by introducing:
1. **Command Validator ([`src/commands/commandValidator.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/commands/commandValidator.ts)):**
   - Finite validation against the 11 `CommandAction` types defined in [`src/commands/types.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/commands/types.ts).
   - Strict schema enforcement, input trimming, length boundaries, and prohibited field guards (e.g. `status` forbidden from `UPDATE_HABIT`).
   - Capability checks matching machine rule [`SYS_COMMAND_CAPABILITY_CHECK_001`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/rulebook/machine/rules.json#L43-L54).
   - Actor permission checking (`caller: 'ai' | 'user' | 'widget' | 'engine'`), requiring confirmation for destructive actions.
2. **Command Executor ([`src/commands/commandExecutor.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/commands/commandExecutor.ts)):**
   - Bounded in-memory idempotency deduplication cache enforcing machine rule [`SYS_IDEMPOTENT_COMMAND_001`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/rulebook/machine/rules.json#L31-L41).
   - Safe handler execution with error isolation (never throws to caller; returns structured `CommandExecutionResult`).
   - EventBus telemetry dispatch (`COMMAND_EXECUTED` event emission).
   - Traceable result payloads with echo IDs (`requestId`) and `rulesApplied`.
3. **AI Sandbox ([`src/commands/aiSandbox.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/commands/aiSandbox.ts)):**
   - Ingestion and sanitization of untrusted AI model output.
   - Prototype pollution prevention, script stripping, and path traversal protection.
   - PII log sanitization conforming to [`SYS_PII_LOG_REDACT_001`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/rulebook/machine/rules.json#L19-L29).
   - Hard guarantee that AI has zero direct access to AsyncStorage, native modules, or filesystem APIs.
4. **Domain Gateway Integration & React Hook ([`src/commands/habitCommandHandlers.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/commands/habitCommandHandlers.ts), [`src/commands/useCommandGateway.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/commands/useCommandGateway.ts)):**
   - Integrates command handlers with `HabitContext` and pure domain engines.
   - Exposes clean `useCommandGateway` hook for application screens and assistant UI.

---

## 2. Command Vocabulary & Schema Analysis

The authoritative command contract in [`src/commands/types.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/commands/types.ts) defines 11 discrete actions:

| Action | Allowed Callers | Invariants & Constraints |
|--------|----------------|--------------------------|
| `CREATE_HABIT` | `user`, `ai`, `engine` | Requires `title` (1..100 chars), `behavior` (1..200 chars), `minimumAction` (1..100 chars, <120s), `normalTarget` (1..100 chars), `frequency` (`daily`\|`weekdays`\|`weekends`\|`weekly`\|`custom`). If `custom`, `customSchedule.weekdays` must be non-empty array of ints 0..6. Cue parameters validated. |
| `UPDATE_HABIT` | `user`, `ai` | Requires `habitId`. Updates strictly restricted to `title`, `behavior`, `minimumAction`, `normalTarget`. **`status` is strictly prohibited** (engine-owned). |
| `DELETE_HABIT` | `user`, `engine` (AI requires `confirmed: true`) | Requires `habitId`. Destructive action: AI caller blocked without explicit user confirmation flag. |
| `LOG_HABIT` | `user`, `ai`, `widget`, `engine` | Requires `habitId`, valid ISO 8601 `completedAt`. Optional `durationMinutes` ($\ge 0$) and valid `frictionCategory`. |
| `START_RECOVERY` | `user`, `ai`, `widget`, `engine` | Requires `habitId` and valid `frictionCategory` enum. |
| `DISMISS_INTERVENTION` | `user`, `widget` | Requires `interventionId` and `reason` in `['acted', 'dismissed', 'expired']`. |
| `ADJUST_DIFFICULTY` | `user`, `ai`, `engine` | Requires `habitId`, `direction` in `['easier', 'harder']`, `newMinimumAction` (1..100 chars). |
| `CREATE_IDENTITY` | `user`, `ai` | Requires `statement` (1..200 chars, non-empty trimmed string). |
| `PAUSE_HABIT` | `user`, `engine` | Requires `habitId`, `actor` in `['user', 'engine']`, `reason` (1..200 chars). |
| `ARCHIVE_HABIT` | `user`, `engine` (AI requires `confirmed: true`) | Requires `habitId`, `actor` in `['user', 'engine']`, `reason`. Destructive/lifecycle action. |
| `RESUME_HABIT` | `user`, `engine` | Requires `habitId`, `actor` in `['user', 'engine']`, `reason`. |

---

## 3. Machine Rules & Security Invariants

The command subsystem enforces 4 deterministic rules from [`rulebook/machine/rules.json`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/rulebook/machine/rules.json):

```json
{
  "rules": [
    {
      "id": "SYS_ZERO_CLOUD_001",
      "description": "Strict local-first privacy: forbid cloud network transmission of user behavioral data.",
      "when": {
        "event": "DATA_TRANSMISSION",
        "destination": "cloud"
      },
      "then": {
        "action": "BLOCK_TRANSMISSION",
        "reason": "Local-first invariant"
      },
      "priority": 1000
    },
    {
      "id": "SYS_PII_LOG_REDACT_001",
      "description": "PII and sensitive habit contents must be redacted from system logs and diagnostics.",
      "when": {
        "logEvent": "RECORD_BREADCRUMB",
        "hasSensitiveFields": true
      },
      "then": {
        "action": "REDACT_SENSITIVE_FIELDS"
      },
      "priority": 999
    },
    {
      "id": "SYS_IDEMPOTENT_COMMAND_001",
      "description": "Reject duplicate commands dispatched with existing idempotencyKey.",
      "when": {
        "command": "DISPATCH",
        "isDuplicateKey": true
      },
      "then": {
        "action": "RETURN_CACHED_RESULT"
      },
      "priority": 950
    },
    {
      "id": "SYS_COMMAND_CAPABILITY_CHECK_001",
      "description": "Command Gateway verifies that requested capability exists before execution.",
      "when": {
        "command": "VALIDATE",
        "capabilitySupported": false
      },
      "then": {
        "action": "REJECT_COMMAND",
        "error": "UNSUPPORTED_CAPABILITY"
      },
      "priority": 900
    }
  ]
}
```

### Key Security Invariants to Implement:
1. **Capability Gate (`SYS_COMMAND_CAPABILITY_CHECK_001`):**
   - Actions not in the supported capability catalog are rejected immediately with rule ID citation.
2. **Idempotency Gate (`SYS_IDEMPOTENT_COMMAND_001`):**
   - Every `DispatchedCommand` includes an `idempotencyKey`.
   - The executor checks its bounded ring/LRU cache. If an identical key executed within the TTL window (e.g. 15 minutes), the cached `CommandExecutionResult` is returned without re-executing mutations.
3. **AI Sandboxing & Sanitization (`SYS_ZERO_CLOUD_001`, `SYS_PII_LOG_REDACT_001`):**
   - All untrusted input from AI is treated as potentially adversarial.
   - Prototype keys (`__proto__`, `constructor`, `prototype`) are stripped.
   - Storage keys (`kwestup_*`) and file system paths (`/`, `..`, `file://`) are strictly forbidden in parameters.
   - PII and habit statements are never dumped raw into forensic logs.
4. **Destructive Action Confirmation:**
   - AI cannot trigger irreversible deletions or archiving without user confirmation (`requiresConfirmation: true`).

---

## 4. Architecture & Data Flow

```text
Untrusted Caller (AI Intent Parser / Assistant UI / Widget / Context)
                           │
                           ▼
                 ┌──────────────────┐
                 │    AI SANDBOX    │  ◄── Strips prototypes, validates caller,
                 │ (Sanitization &  │      enforces confirmation gates
                 │  Boundary Guard) │
                 └─────────┬────────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │ COMMAND GATEWAY  │
                 │                  │
                 │ Schema Validator │  ◄── Enforces CommandPayload<A> constraints,
                 │ Capability Check │      cites SYS_COMMAND_CAPABILITY_CHECK_001
                 │ Permission Check │
                 └─────────┬────────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │ COMMAND EXECUTOR │
                 │                  │
                 │ Idempotency Dedup│  ◄── Cites SYS_IDEMPOTENT_COMMAND_001,
                 │ Handler Dispatch │      bounds double-taps
                 │ Event Emission   │  ◄── Emits COMMAND_EXECUTED on eventBus
                 └─────────┬────────┘
                           │
                           ▼
                Domain Handlers (HabitContext / Pure Engines)
                           │
                           ▼
                 CommandExecutionResult
                 { success, entityId, message, requestId, rulesApplied }
```

---

## 5. Wave Breakdown & Plan Structure

### Wave 1: 26-01-PLAN.md — Command Gateway Validation, Capability Checks & Sandboxed Executor
- **Focus:** Pure TypeScript command validation, capability evaluation, and idempotent executor core.
- **Artifacts:**
  - `src/commands/commandValidator.ts` (validation logic, capability rules, actor permissions).
  - `src/commands/commandExecutor.ts` (idempotency LRU cache, handler registry, event emission, execution result packaging).
  - `__tests__/unit/commandGateway.test.ts` (comprehensive unit test suite covering validation of all 11 actions, capability checks, and idempotency deduping).

### Wave 2: 26-02-PLAN.md — AI Sandboxing Layer, Domain Integration & Safety Guarantees
- **Focus:** AI sandboxing, domain handler integration with `HabitContext`, and developer gateway hook.
- **Artifacts:**
  - `src/commands/aiSandbox.ts` (untrusted AI output sanitization, prototype pollution protection, confirmation gate).
  - `src/commands/habitCommandHandlers.ts` (concrete handlers bridging commands to `HabitContext` and pure engines).
  - `src/commands/useCommandGateway.ts` (React hook for UI and assistant dispatch).
  - `src/commands/index.ts` (barrel export for the commands subsystem).
  - `__tests__/unit/aiSandbox.test.ts` (security and adversarial payload tests).
  - `__tests__/unit/commandIntegration.test.ts` (integration tests verifying end-to-end command dispatch to domain contexts).

---

## 6. Verification Strategy & Acceptance Criteria

1. **Type Safety:**
   - 100% strict TypeScript in `src/commands/*.ts`.
   - `npm run typecheck` exits 0 with zero errors across the entire repository.
2. **Linting Standards:**
   - `npm run lint` exits 0 with zero errors.
   - Zero raw `console.*` statements in new code; all logging routed via `src/utils/logger.js`.
3. **Test Coverage:**
   - 100% passing tests in `__tests__/unit/commandGateway.test.ts`, `__tests__/unit/aiSandbox.test.ts`, and `__tests__/unit/commandIntegration.test.ts`.
   - Full regression suite `npm test` passes cleanly with zero regressions.
4. **Security Verification:**
   - AI sandbox tests explicitly verify rejection of prototype pollution, path traversal attempts, and unconfirmed destructive actions.
   - Idempotency test verifies duplicate dispatches with identical keys return cached results without double-mutating state.
