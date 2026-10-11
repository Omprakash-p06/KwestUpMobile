---
status: issues-found
files_reviewed: 12
findings:
  critical: 2
  warning: 8
  info: 5
  total: 15
phase: "26"
depth: standard
---

# Phase 26: Code Review Report — Command Gateway & AI Sandbox

**Reviewed:** 2026-10-11
**Depth:** standard
**Files Reviewed:** 12 (3 test suites, 7 src/commands + behavior/types, 1 widget handler)
**Status:** issues-found

## Summary

Reviewed the full Phase 26 surface: `commandValidator` (11-action strict schemas, capability check, engine-owned invariant, AI confirmation gate), `commandExecutor` (200-item/15-min idempotency cache, handler registry, error isolation, telemetry), `aiSandbox` (recursive sanitization, confirmation gate, `executeAiCommand`), `habitCommandHandlers`, `useCommandGateway`, barrel `index`, both `types` files, and `widget-task-handler.tsx`, plus the 35-test suite.

The sanitization core is solid (prototype-pollution stripping, plain-object enforcement, fail-closed capability gate), and tests cover the advertised happy/adversarial paths. But two **critical** confirmation-gate bypasses exist: the sandbox lets untrusted AI output self-attest `confirmed: true` (CR-01), and the validator's gate is fail-open when `actor` is omitted with a loose truthiness check on `confirmed` (CR-02). Both allow destructive `DELETE_HABIT`/`ARCHIVE_HABIT` without genuine user confirmation — data-loss risk in exactly the layer built to prevent it. Warnings cover idempotency-key collisions, mass-assignment of unvalidated fields, error-information leakage, and lifecycle races. No hardcoded secrets, injection sinks, or debug artifacts found.

## Critical Issues

### CR-01: AI can self-attest confirmation via `parsed.confirmed` — sandbox gate bypass

**File:** `src/commands/aiSandbox.ts:162`
**Issue:** `const isConfirmed = options.confirmed === true || parsed.confirmed === true;` ORs the trusted caller option with a field from the **untrusted** AI output object. A compromised or jailbroken model emitting `{"action":"DELETE_HABIT","payload":{"habitId":"x"},"confirmed":true}` passes the `SYS_AI_CONFIRMATION_GATE_001` check at line 170 without any user involvement. The spoofed boolean is then forwarded as `confirmed: isConfirmed` (line 186), so the downstream validator gate (`commandValidator.ts:232,328`) also passes. Both defense layers fall to a single attacker-controlled bit. No test covers this path — the suite only tests gate-pass via trusted `options.confirmed`.
**Impact:** Unconfirmed destructive habit deletion/archival by AI input. Data loss; defeats the primary safety guarantee of the sandbox.
**Fix:**
```ts
// Only the trusted caller option counts. Never read confirmation from untrusted input.
const isConfirmed = options.confirmed === true;
// Optionally: explicitly strip/ignore parsed.confirmed so it can't propagate.
```

### CR-02: Destructive gate fail-open on omitted actor + truthy (non-boolean) `confirmed`

**File:** `src/commands/commandValidator.ts:125,232,328`
**Issue:** Two compounding flaws. (a) Actor resolution `command.actor || options.caller || 'user'` (line 125) defaults a missing actor to `'user'`, and the destructive gates only fire on `actor === 'ai'` (lines 232, 328). Any direct `executeCommand({action:'DELETE_HABIT', idempotencyKey, payload})` caller — widget code, future tools, or AI paths that bypass the sandbox — executes destructively with no confirmation simply by omitting `actor`. The secure default for a destructive gate is to require confirmation unless the actor is positively authenticated as user/engine. (b) The check `!command.confirmed` is loose truthiness: a `confirmed: "false"` (non-empty string), `1`, or `{}` object from untyped JSON callers passes the gate. The sandbox normalizes with `=== true`, but the validator is the final gate and must too.
**Impact:** Confirmation-gate bypass via actor omission or type-confusion on `confirmed`. Unauthorized data deletion.
**Fix:**
```ts
// (a) fail closed: only positively-identified non-AI actors skip confirmation
const actor = command.actor ?? options.caller;
if (actor === undefined && (command.action === 'DELETE_HABIT' || command.action === 'ARCHIVE_HABIT')) {
  errors.push('Destructive action requires explicit actor and user confirmation');
}
// gate on strict boolean:
if (actor === 'ai' && command.confirmed !== true) { errors.push('...requires explicit user confirmation'); }
// also treat unknown/missing actor as untrusted for destructive actions
```

## Warnings

### WR-01: Idempotency cache keyed by key alone; AI-controlled keys; no normalization; TOCTOU race

**File:** `src/commands/commandExecutor.ts:136` + `src/commands/aiSandbox.ts:163-167`
**Issue:** Cache lookup uses only `command.idempotencyKey`, ignoring action/payload. A replayed key with a **different** action/payload returns the first command's `entityId`/success without executing (wrong-entity success, or a destructive replay masked as success). The sandbox additionally accepts AI-supplied `parsed.idempotencyKey` verbatim (any ≥4-char string), letting untrusted input choose cache keys — enabling cache-poisoning/probing and reflection of uncapped strings into `requestId` on the sanitize-failure path (line 158, no 128-char cap unlike the validator). Keys are also not trimmed/normalized, so `'abc '` and `'abc'` are distinct entries (whitespace-variant double execution). Finally, two concurrent `executeCommand` calls with the same key both miss the cache (check-then-set with no in-flight tracking), so widget double-tap can double-execute non-idempotent handlers.
**Impact:** Wrong-result replays, cache manipulation by AI input, duplicate side effects on races.
**Fix:**
```ts
// namespace sandbox keys (never honor AI-supplied keys):
const idempotencyKey = options.idempotencyKey ?? `cmd_ai_${...}`;
// bind cache entries to action+payload:
const cacheKey = `${command.action}::${command.idempotencyKey}::${stableHash(command.payload)}`;
// normalize: command.idempotencyKey.trim() before validate + lookup;
// add in-flight Map<string, Promise> for concurrent dedup.
```

### WR-02: Payload-level `actor` for PAUSE/ARCHIVE/RESUME is self-attested, unbound to command actor

**File:** `src/commands/commandValidator.ts:308,322,339`
**Issue:** `PAUSE_HABIT`/`ARCHIVE_HABIT`/`RESUME_HABIT` require `payload.actor` to be `'user'|'engine'`, but that field is asserted inside the payload itself with no binding to the authenticated `command.actor`. An `actor:'ai'` (or widget) command carrying `payload:{actor:'user', ...}` plus a spoofed confirmation satisfies both checks. There is no mechanism linking who claims to act with who actually dispatches.
**Impact:** Lifecycle state transitions (pause/archive/resume) attributable to 'user' by any caller. Audit-trail forgery.
**Fix:** Derive authorization from `command.actor` (the dispatch credential), not `payload.actor`; either remove `actor` from the payload schemas or require `payload.actor === command.actor` (with command.actor mandatory for these actions).

### WR-03: Mass-assignment — extra/unknown fields pass validation and are forwarded verbatim to storage ops

**File:** `src/commands/commandValidator.ts:204-208` + `src/commands/habitCommandHandlers.ts:37,47,107`
**Issue:** `UPDATE_HABIT` enforces forbidden keys and requires ≥1 allowed key, but never rejects **unknown** keys: `updates:{title:'ok', frequency:'custom', identityId:'attacker-id'}` passes and the handler forwards the whole `payload.updates` object to `ops.updateHabit` (line 47). `CREATE_HABIT` similarly forwards the entire payload (line 37), so AI-supplied extras like `status`/`streakCount` reach `ops.createHabit` — safety depends entirely on the downstream implementation ignoring them, which the gateway cannot guarantee. `ADJUST_DIFFICULTY` (line 107) has the same forward-whole-payload shape, though its schema is fully enumerated.
**Impact:** Privilege/field injection (identity reassignment, state fields) if any `HabitOperations` implementation spreads input. Violates the "strict schema" contract.
**Fix:** Allowlist-strip at validation or handler boundary, e.g. build an explicit `safeUpdates = pick(updates, ['title','behavior','minimumAction','normalTarget'])` and reject unknown keys with an error.

### WR-04: `Math.random()`-based idempotency keys can collide → false dedup suppresses real commands

**File:** `src/commands/aiSandbox.ts:167` + `src/commands/useCommandGateway.ts:45-47`
**Issue:** Both key generators use `` `cmd[_ai]_...${Date.now()}_${Math.random().toString(36).slice(2, 9)}` `` — ~7 base36 chars (~2.8B space) with millisecond timestamp bucketing. Rapid successive dispatches within the same millisecond (AI batch, double-tap) have non-negligible collision probability, and `Math.random` is not collision-resistant. A collision makes the second distinct command return the first's cached result without executing (silent drop).
**Impact:** Silently dropped habit creates/logs. Hard to reproduce, easy to misdiagnose.
**Fix:** Use `crypto.randomUUID()` (available in React Native via `expo-crypto`/`crypto.getRandomValues` polyfill) or a monotonic counter + random suffix: `` `cmd_${Date.now()}_${++seq}_${randomUUID()}` ``.

### WR-05: Cache-hit rule evaluation sits outside the error boundary; expired entries never swept; FIFO mislabeled as LRU

**File:** `src/commands/commandExecutor.ts:78-91,137-155`
**Issue:** (a) The idempotency-hit path calls `loadMachineRules('system')` + `evaluateRules` (lines 139-143) with no try/catch, unlike the handler path. A rule-file load/eval failure on a replay throws out of `executeCommand`, breaking the documented error-isolation guarantee. (b) Expired entries are only overwritten on key reuse — never purged — so dead entries permanently occupy slots of the 200-entry budget, shrinking effective capacity and evicting live entries first. (c) `setInCache` evicts oldest-inserted (FIFO); hits don't refresh recency, so the "LRU eviction" contract claimed in the phase is actually FIFO.
**Impact:** Unexpected throws on replays; premature eviction → duplicate execution after false eviction.
**Fix:** Wrap the hit path in try/catch with fallback `rulesApplied: [...cached, 'SYS_IDEMPOTENT_COMMAND_001']`; add lazy sweep of expired entries (or timestamp-ordered eviction preferring expired); refresh recency on hit or correct docs to FIFO.

### WR-06: Raw handler errors broadcast on `COMMAND_FAILED` bus and fully logged — info disclosure / PII risk

**File:** `src/commands/commandExecutor.ts:213,216-225`
**Issue:** `errorMessage = err?.message` is fanned out verbatim to **all** `eventBus` subscribers (including widget/headless/AI-observable surfaces) and the full `err` object goes to `logger.error`. Storage-layer errors (`Storage disk I/O failure`, SQLite paths, constraint text) and any handler that throws user content (habit titles, identity statements) leak internals and PII into a broadcast channel and persistent logs. No redaction or allowlisting.
**Impact:** Internal-path/DB disclosure; PII (habit titles, identity statements) in logs and cross-surface events.
**Fix:** Emit a stable, non-descriptive code on the bus (`error: 'COMMAND_EXECUTION_FAILED'`) with detail only in a server-side/debug log behind a redaction helper that strips payload-like content.

### WR-07: Hook couples global handler registry to component lifecycle — unregister races and re-register churn

**File:** `src/commands/useCommandGateway.ts:29-37`
**Issue:** The effect registers all 11 global handlers on mount and unregisters on unmount, keyed on `habitOps` identity. If `useHabits()` returns an unstable reference, every render churns the global registry (unregister → brief window with **zero** handlers → concurrent dispatch fails with 'No handler registered'). With two mounted consumers, the first unmount wipes handlers the second still needs. Global mutable registry + per-component ownership is unsound.
**Impact:** Intermittent 'No handler registered' failures; flakiness under re-renders/multi-mount.
**Fix:** Register once at app bootstrap (module init), not in the hook; or refcount registrations. Memoize `habitOps` in `HabitContext` (`useMemo`) so the effect is stable.

### WR-08: Numeric/string boundary gaps — `NaN`/`Infinity` durations pass; UPDATE `stretchTarget` unvalidated

**File:** `src/commands/commandValidator.ts:246,210-221`
**Issue:** `durationMinutes` check `typeof === 'number' && < 0` accepts `NaN` (`NaN < 0` is false) and `Infinity`, which then flow into `completeHabit` and persisted events. `UPDATE_HABIT` permits `stretchTarget` (in `allowedKeys`, line 204) but has no per-field length/type check unlike the other four fields, so a 10KB string passes. (CREATE_HABIT does cap `stretchTarget` at 100 — inconsistent.)
**Impact:** Corrupt persisted telemetry (NaN durations break streak math/JSON round-trips); oversized stored strings.
**Fix:**
```ts
if (p.durationMinutes !== undefined && (typeof p.durationMinutes !== 'number' || !Number.isFinite(p.durationMinutes) || p.durationMinutes < 0))
if (p.updates.stretchTarget !== undefined && (typeof p.updates.stretchTarget !== 'string' || p.updates.stretchTarget.length > 100))
```

## Info

### IN-01: Duplicated `CustomSchedule` type + `stretchTarget` type/validator drift

**File:** `src/commands/types.ts:9-11` vs `src/behavior/types.ts:16-18`; `src/commands/types.ts:47`
**Issue:** `CustomSchedule` is defined independently in both files (identical shape today — divergence waiting to happen). Separately, the `UPDATE_HABIT.updates` type allows only `title|behavior|minimumAction|normalTarget` while the validator's `allowedKeys` also permits `stretchTarget` — type says illegal, runtime says legal (or vice versa), and the handler forwards whatever arrives.
**Fix:** Import `CustomSchedule` from `behavior/types` in `commands/types`; add `'stretchTarget'` to the `updates` Pick (with the WR-08 length check) or remove it from `allowedKeys`.

### IN-02: Unreachable `default` branch in validator switch

**File:** `src/commands/commandValidator.ts:348-350`
**Issue:** Unsupported actions early-return at line 119-122, so `default: errors.push('Unhandled validation...')` is dead code. Harmless but misleading — a future action added to the union without a case would silently… actually it would hit `default` and correctly fail, so it serves as a backstop; still, the early return makes the intent unclear.
**Fix:** Keep as defensive backstop but comment it as such, or restructure so the switch is the single enforcement point.

### IN-03: Sanitizer regexes overblock some legitimate text and underblock encoded traversal

**File:** `src/commands/aiSandbox.ts:16-17,40,57-62`
**Issue:** `STORAGE_KEY_PATTERN = /kwestup_[a-z0-9_]*/i` matches any string containing `kwestup_` — a legitimate habit titled "Export my kwestup_notes" is rejected (fail-closed, safe, but user-visible false positives). Conversely `PATH_TRAVERSAL_PATTERN`'s `^\/[a-z0-9_]+` only fires at string start (no `m` flag, tested per-value), so `"see /etc/passwd"` passes; URL-encoded (`..%2f`, `%2e%2e`), `~/.`, `content://`, and bare `..` forms are unhandled.
**Fix:** Accept residual risk with a comment (AI-generated habit text rarely needs these), or add case-insensitive `%2e`/`%2f` decoding check before testing. Consider narrowing the storage pattern to token boundaries to reduce false positives.

### IN-04: Security layer lacks adversarial regression tests for its own gates

**File:** `__tests__/unit/aiSandbox.test.ts`, `__tests__/unit/commandGateway.test.ts`
**Issue:** No tests for: `executeAiCommand` with spoofed `parsed.confirmed:true` (would currently pass — proves CR-01); `executeCommand(DELETE_HABIT)` with omitted actor (proves CR-02); same-key/different-payload replay (WR-01); `confirmed:"false"` string (CR-02b); `NaN` duration (WR-08). For a security-sensitive layer, the missing negative tests are precisely the ones that would have caught the criticals.
**Fix:** Add the five cases above as failing-first regression tests alongside the fixes.

### IN-05: Widget handler bypasses the command gateway entirely

**File:** `widgets/widget-task-handler.tsx:248-286` (habit path), `:128-240` (task path)
**Issue:** The headless widget path mutates `AsyncStorage` and invokes pure engines directly, bypassing validation, idempotency dedup (it has its own `completedToday` guard), and `COMMAND_EXECUTED` telemetry. Architecturally inconsistent: two execution planes with different safety properties. The in-file comment acknowledges the separate JS environment constraint, so this may be intentional — but it means gateway invariants (confirmation gates, schemas) don't apply to widget-initiated habit completions.
**Fix:** Document as accepted architecture (widget plane vs gateway plane) with a one-line rationale; long-term, route widget intents through `executeCommand` with `actor:'widget'` where the runtime allows.

---

_Reviewed: 2026-10-11_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
