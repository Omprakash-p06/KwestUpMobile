---
status: issues-found
files_reviewed: 12
findings:
  critical: 1
  warning: 6
  info: 1
  total: 8
phase: "26"
depth: standard
---

# Phase 26: Code Review Report — Command Gateway, Safe Execution Layer & AI Sandboxing

**Reviewed:** 2026-10-11  
**Depth:** standard (per-file analysis with security, concurrency, and behavioral rulebook checks)  
**Files Reviewed:** 12 (`src/behavior/types.ts`, `src/commands/types.ts`, `src/commands/commandValidator.ts`, `src/commands/commandExecutor.ts`, `src/commands/aiSandbox.ts`, `src/commands/habitCommandHandlers.ts`, `src/commands/useCommandGateway.ts`, `src/commands/index.ts`, `widgets/widget-task-handler.tsx`, `__tests__/unit/commandGateway.test.ts`, `__tests__/unit/aiSandbox.test.ts`, `__tests__/unit/commandIntegration.test.ts`)  
**Status:** issues-found  

---

## Summary

Reviewed all 12 Phase 26 files plus cross-referenced `rulebook/machine/rules.json`, `rulebook/ai/intent-parser.md`, `src/behavior/habitEngine.ts` (`compileHabitPlan`), and `src/context/HabitContext.js`. The finite action catalog (11 actions), schema validator, in-memory idempotency deduplication cache (`SYS_IDEMPOTENT_COMMAND_001`), error isolation, and React hook architecture provide a strong foundation for requirement `[CMD-01]`.

However, 1 critical security vulnerability and 6 warnings were identified:
1. **Critical:** Untrusted AI payloads can self-authorize destructive actions by providing `"confirmed": true` in the parsed LLM output, bypassing user confirmation.
2. **Security:** Path traversal regex does not detect Windows drive letters (`C:\`), UNC paths, or dangerous Unix system directories, while falsely matching harmless user strings starting with `/`.
3. **Architecture:** Multi-component usage of `useCommandGateway` causes premature unregistration of default handlers on unmount due to lack of reference counting.
4. **Data Integrity:** `CREATE_HABIT` command handler passes flat `cueType` / `cueTime` parameters, which are ignored by `compileHabitPlan` expecting nested `cue: { type, time }`, causing cues to default to `'manual'`.
5. **Validation:** `UPDATE_HABIT` allows arbitrary unknown keys if at least one valid key is present, and does not validate `stretchTarget` types/lengths.
6. **Typing:** `CommandPayload<'CREATE_HABIT'>` strictly requires `identityId`, which conflicts with autonomous on-device AI intent extraction in Phase 27.
7. **Governance:** Machine rule `SYS_AI_CONFIRMATION_GATE_001` is cited in execution traces but missing from `rulebook/machine/rules.json`.
8. **Performance (Info):** Idempotency cache retains expired entries until 200 items accumulate, and misses opportunistically purging expired keys on lookup.

---

## Findings & Action Plan

### CR-01: AI Payload Can Self-Authorize Destructive Actions via `parsed.confirmed: true`

**Severity:** Critical  
**File:** `src/commands/aiSandbox.ts:162`  
**Issue:**  
The sandbox checks:
```ts
const isConfirmed = options.confirmed === true || parsed.confirmed === true;
```
If an untrusted LLM produces `{ "action": "DELETE_HABIT", "payload": { "habitId": "h-1" }, "confirmed": true }` (e.g. Prompt injection or hallucination), the confirmation gate is bypassed without any human user consent.  
**Fix:**  
Confirmation must be strictly derived from the caller's explicit options:
```ts
const isConfirmed = options.confirmed === true;
```

---

### WR-01: Incomplete Path Traversal Regex Bypasses Windows & UNC Injections

**Severity:** Warning  
**File:** `src/commands/aiSandbox.ts:17`  
**Issue:**  
`PATH_TRAVERSAL_PATTERN = /(\.\.\/|\.\.\\|file:\/\/|^\/[a-z0-9_]+)/i` ignores Windows drive paths (`C:\...`, `D:/...`), network UNC paths (`\\server\share`), and Unix absolute system paths (`/etc/`, `/data/`), while `^\/[a-z0-9_]+` falsely flags user inputs starting with `/` (e.g. `/walk`).  
**Fix:**  
Harden regex to match specific file protocols, relative traversals, drive letters, UNC shares, and root system directories:
```ts
const PATH_TRAVERSAL_PATTERN =
  /(\.\.\/|\.\.\\|file:\/\/|^[a-zA-Z]:[/\\]|^\\\\[a-zA-Z0-9_]+|^\/(etc|data|system|proc|sys|dev|root|var|tmp|usr|bin|storage)\b)/i;
```

---

### WR-02: Premature Handler Unregistration in `useCommandGateway`

**Severity:** Warning  
**File:** `src/commands/useCommandGateway.ts:32-37`  
**File:** `src/commands/habitCommandHandlers.ts:165-176`  
**Issue:**  
When multiple components mount `useCommandGateway()`, if one component unmounts, its cleanup `unregister()` removes all handlers from the singleton `commandExecutor`. Active mounted components then fail with `"No handler registered for command action"`.  
**Fix:**  
Implement active reference counting in `registerDefaultHabitHandlers` so handlers remain registered until all consumers have unmounted.

---

### WR-03: `CREATE_HABIT` Handler Drops Cue Structure for `compileHabitPlan`

**Severity:** Warning  
**File:** `src/commands/habitCommandHandlers.ts:36-44`  
**File:** `src/behavior/habitEngine.ts:98, 136-139`  
**Issue:**  
`CommandPayload<'CREATE_HABIT'>` places `cueType`, `cueTime`, `cueLocation` at top level. `compileHabitPlan` expects `input.cue?.type`. Passing `payload` directly causes `compileHabitPlan` to see `input.cue === undefined`, defaulting the cue to `'manual'` and attaching `'CUE_MANDATORY_001'`, silently dropping the user's scheduled time and cue type.  
**Fix:**  
In `habitCommandHandlers.ts:CREATE_HABIT`, construct a normalized input object containing `cue: { type: payload.cueType, time: payload.cueTime, location: payload.cueLocation }`.

---

### WR-04: `UPDATE_HABIT` Permits Unrecognized Keys and Unvalidated `stretchTarget`

**Severity:** Warning  
**File:** `src/commands/commandValidator.ts:204-222`  
**Issue:**  
1. Only `FORBIDDEN_UPDATE_KEYS` are checked for rejection. If an update has `{ title: 'Valid', unknownMalicious: 123 }`, `presentAllowed.length > 0`, so `unknownMalicious` passes validation.  
2. `stretchTarget` is listed in `allowedKeys`, but never checked for string type or character limit ($\le 100$).  
**Fix:**  
Explicitly reject any keys not in `allowedKeys`. Validate `stretchTarget` when present.

---

### WR-05: `identityId` Rigidly Required in `CREATE_HABIT` Command Payload

**Severity:** Warning  
**File:** `src/commands/types.ts:29`  
**File:** `src/commands/commandValidator.ts:140-185`  
**Issue:**  
`identityId: string` is marked as strictly required in `CommandPayload<'CREATE_HABIT'>`. However, in Atomic Habits compilation, identity is auto-generated if omitted (`input.identityId || generateEntityId('identity')`). Autonomous AI extraction in Phase 27 will not have an upfront `identityId`.  
**Fix:**  
Make `identityId?: string` optional in `types.ts` and validate that if present, it is a non-empty string up to 100 characters.

---

### WR-06: Missing Governance Machine Rule `SYS_AI_CONFIRMATION_GATE_001`

**Severity:** Warning  
**File:** `rulebook/machine/rules.json`  
**File:** `src/commands/aiSandbox.ts:177`  
**Issue:**  
`aiSandbox.ts` cites `rulesApplied: ['SYS_AI_CONFIRMATION_GATE_001']`, but the rule is not declared in `rulebook/machine/rules.json`.  
**Fix:**  
Add `SYS_AI_CONFIRMATION_GATE_001` with priority 980 to `rulebook/machine/rules.json`.

---

### IN-01: Idempotency Cache TTL Expiration & Sweep

**Severity:** Info  
**File:** `src/commands/commandExecutor.ts:78-91, 136-155`  
**Issue:**  
Expired items are only removed when 200 items are reached. Replayed expired keys are not deleted on lookup.  
**Fix:**  
Purge expired entries during lookup and perform an opportunistic purge of expired entries when `setInCache` triggers eviction.
