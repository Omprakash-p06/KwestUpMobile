# Phase 18 Code Review

## Scope (files + lines changed)

Phase 18 (On-Device AI Pipeline Hardening) — single commit `888d86b`, depth: standard.

| File | Lines | Change |
|------|-------|--------|
| `src/utils/aiService.js` | 869 total (~450 added/modified) | Model pinning constants, `computeSha256`, `verifyModelIntegrity`, `_initPromise` lock, `getModelContextStatus`, `IDLE_UNLOAD_TIMEOUT_MS`/`resetIdleTimer`, `handleAppStateChange`, heuristic fallbacks, try/catch wrappers, dateUtils in `parseGlobalCommand` |
| `src/components/AIAssistant.js` | 1095 total (2 areas) | Unmount `unloadModel` cleanup, duplicate StyleSheet import removal |
| `__tests__/unit/aiService.test.js` | 461 (NEW) | 29 tests |

## Findings

### [Critical] src/utils/aiService.js:95-126 — SHA-256 verification is theater; only size is ever checked

**Description:** `MODEL_EXPECTED_SHA256` is declared but never computationally enforced. `verifyModelIntegrity` checks exact byte size, then only hashes if the caller passes a `customValidator` — and no production caller does (`isModelDownloaded` at line 131-133 passes none; `loadModel` at line 261 goes through `isModelDownloaded`). The hash constant appears solely inside a log string (line 115). A tampered or attacker-substituted 491,400,032-byte file passes verification and is fed to `initLlama`. `computeSha256` only hashes in-memory strings/WordArrays and is never wired to file content (reading a 468 MB file into a JS string for crypto-js is infeasible anyway, so the "cryptographic verification" plan goal is structurally unmet, not just unwired).
**Recommendation:** Either implement real file hashing (chunked read via `FileSystem.readAsStringAsync` with base64 chunks fed incrementally — or acknowledge Expo FS can't stream-hash and downgrade the claim), or at minimum enforce size + pinned-URL download provenance and stop advertising SHA-256 integrity. At the very least, wire a default validator path so the constant is compared, not just logged.

### [Critical] src/components/AIAssistant.js:968 — `RNStyleSheet` is undefined; module throws on import

**Description:** `taskRow` uses `borderBottomWidth: RNStyleSheet.hairlineWidth`, but the file imports only `StyleSheet` (line 12) and `RNStyleSheet` is defined nowhere (sole occurrence in `src/`). Since `rawStyles` is evaluated at module load, importing `AIAssistant` throws `ReferenceError: RNStyleSheet is not defined`, crashing any screen that mounts it. Git blame shows the line predates Phase 18 (`a3de22d`), but Phase 18 touched this file (import cleanup) without catching it, and no test imports the component so the 138/138 suite is blind to it.
**Recommendation:** Change to `StyleSheet.hairlineWidth` (one-line fix) and add a smoke test that imports/renders `AIAssistant`.

### [Critical] src/utils/aiService.js:165-197 — Post-download integrity never verified; resume path bypasses URL pinning

**Description:** Two gaps defeat the pinning story: (a) `downloadModel` returns success immediately after `downloadAsync()` with no `verifyModelIntegrity` call, so truncated/corrupt downloads are accepted as "downloaded" until the next `loadModel` (which then throws instead of re-downloading); (b) the resume path (lines 165-179) reconstructs `DownloadResumable` from `parsedState.url` persisted in AsyncStorage — a URL written by any older/downgraded app version, not `MODEL_DOWNLOAD_URL`. A stale non-pinned URL is resumed and its output trusted.
**Recommendation:** After successful download, call `verifyModelIntegrity(MODEL_PATH)` and throw/delete on failure; on the resume path, validate `parsedState.url === MODEL_DOWNLOAD_URL && parsedState.fileUri === MODEL_PATH` and start fresh on mismatch.

### [Warning] src/utils/aiService.js:295-308 — Unload-while-inflight race resurrects the model

**Description:** `unloadModel` clears `_llamaContext` and the idle timer but knows nothing about `_initPromise`. If the app backgrounds (line 64-68), the idle timer fires (line 45-47), or the component unmounts while `initLlama` is still in flight, the pending promise later resolves and assigns `_llamaContext`, silently re-creating the native context the lifecycle manager just freed — defeating the OOM protection that is this phase's headline goal. `getModelContextStatus` then reports `isLoaded: true` with no timer re-armed.
**Recommendation:** Add a load-generation counter (or an `_unloadRequested` flag checked after `initLlama` resolves, releasing and nulling if set). Test: start `loadModel` with deferred `initLlama`, call `unloadModel`, resolve, assert context is null/released.

### [Warning] src/utils/aiService.js:487-490, 557-560, 611-615 — Catch blocks null the JS handle without releasing native memory

**Description:** All three inference catch blocks do `_llamaContext = null` directly instead of calling `unloadModel()`. The native llama context is never released via `releaseAllLlama`, so every failed inference leaks the native allocation while the JS side believes it is unloaded. Repeated failures (the exact scenario the fallback pipeline exists for) accumulate native memory — the opposite of the phase's OOM goal. (`assistWriting` at 785-794 gets this right by design intent but still only nulls; same leak.)
**Recommendation:** Replace `_llamaContext = null` in catch blocks with `await unloadModel()` (or `unloadModel()` fire-and-forget with the existing internal catch). Note the double-release risk is nil since `unloadModel` guards on `_llamaContext`.

### [Warning] src/utils/aiService.js:630 — `parseGlobalCommand` crashes on null/non-string input outside any try/catch

**Description:** `const lower = command.toLowerCase()` (plus `command.match` at 639, `command.replace` at 648/661/687) executes after the LLM try/catch has closed, with no input validation. `parseGlobalCommand(null)`, `undefined`, or a non-string throws an unhandled `TypeError` — no heuristic fallback, rejected promise to the UI. Sibling heuristics (`extractTasksFromNoteHeuristic`, `summarizeNoteHeuristic`) both guard with `typeof !== "string"` checks; this entry point does not.
**Recommendation:** Add `if (!command || typeof command !== "string") return { type: "task", title: "New Task", description: ..., dueDate: null };` (or throw a validation error intentionally) at the top, before `resetIdleTimer`.

### [Warning] src/utils/aiService.js:690-701 — `parseLocalDate` Invalid Date used unguarded; `toISOString()` throws RangeError

**Description:** Phase 15 made `parseLocalDate` strict (returns Invalid Date, never today — confirmed in `dateUtils.js:63-86`). The tomorrow/today branches call `parseLocalDate(...)` then `.setHours(...)` then `.toISOString()` with no `isNaN` guard, all outside the LLM try/catch. On an Invalid Date, `toISOString()` throws `RangeError: Invalid time value` as an unhandled rejection. In practice the inputs come from `getTomorrowLocalDateString()`/`getLocalDateString()` (valid barring clock pathology or the `''` return at `dateUtils.js:123`), so probability is low — but the phase explicitly claims date-authority robustness while adding an unguarded strict-parser call site.
**Recommendation:** Guard with `if (isNaN(d.getTime())) { dueDate = null; } else { ... }` in both branches.

### [Warning] src/utils/aiService.js:70-73 — AppState listener is a module-load side effect with no unsubscribe

**Description:** The subscription registers at import time and no removal handle or cleanup export exists. Under Fast Refresh, test re-imports (module registry resets), or multiple importers in different bundles, duplicate listeners accumulate — each backgrounding fires N `unloadModel` calls (benign today only because unload is idempotent). More importantly it is untestable/unmanaged lifecycle hidden in a util module.
**Recommendation:** Export `subscribeAppState()`/`unsubscribeAppState()` (returning the subscription) and register from the app root component's `useEffect`; keep the guarded auto-register as fallback only.

### [Warning] src/utils/aiService.js:364-371 — Numbered-list heuristic accepts any short item as a task (false positives)

**Description:** Branch 4 adds numbered items when `actionVerbRegex.test(itemText) || itemText.length < 80` — i.e., *every* numbered item under 80 chars becomes a task regardless of content. `1. Introduction`, `2. Prerequisites`, `3. References` in ordinary notes are extracted as actionable tasks. The bullet branch (correctly) requires the verb; the numbered branch's length fallback swallows the precision.
**Recommendation:** Require the action-verb match for numbered items too, or restrict the length fallback to items containing task signals (checkbox semantics, trailing "TODO", etc.).

### [Info] src/utils/aiService.js:80-85 — `computeSha256` cannot serve its stated purpose and fails silently

**Description:** The utility only accepts strings/WordArrays and returns `""` for anything else — it can never hash the 468 MB GGUF file, which is the only artifact whose integrity matters. Its tests hash `'hello world'`, proving crypto-js works, not that the model is verified. Silent `""` on misuse masks wiring errors.
**Recommendation:** Document it as a string-hashing helper (not model verification), or remove it if no caller needs it; prefer throwing `TypeError` over returning `""` for invalid input.

### [Info] src/utils/aiService.js:721-756, 807-828 — `assistWriting*` have no fallback and crash on non-string notes

**Description:** Inconsistent with the phase's "always succeed" resilience claim: both writing-assistant paths `await loadModel()` outside try/catch (a missing model rejects straight to the UI) and do `noteContent.slice(...)` with no type guard (`assistWriting(null)` → TypeError). `summarizeNote`/`extractTasksFromNote` clamp with `(noteContent || "")`; these two don't.
**Recommendation:** Apply the same `(noteContent || "").slice(...)` clamp; decide explicitly whether writing-assist should fall back (return input with a notice) or intentionally throw, and document the choice.

### [Info] src/components/AIAssistant.js:99-103 — Unmount cleanup fires a floating promise

**Description:** `useEffect` cleanup calls `unloadModel()` without handling the promise. Benign today (`unloadModel` catches internally), but a future throw inside it becomes an unhandled rejection with no stack context.
**Recommendation:** `return () => { unloadModel().catch(() => {}); };` — or make it explicit with a comment.

### [Info] __tests__/unit/aiService.test.js — High coverage of happy paths; adversarial paths untested

**Description:** 29 tests cover pinning constants, size checks, coalescing, heuristics, and fallback-on-missing-model well. Missing: unload-during-inflight race, `parseGlobalCommand(null)`, throwing (not just false-returning) `customValidator`, Invalid-Date handling, duplicate AppState subscription, and any import/render of `AIAssistant` (which would have caught the `RNStyleSheet` crash).
**Recommendation:** Add the five cases above; especially the component smoke import.

## Strengths

- **Promise-lock correctness (the headline bug risk) is right:** `_initPromise` is assigned synchronously, concurrent callers coalesce, and `finally` clears it — a failed `loadModel` does *not* poison the lock; the retry test path (`unloadModel` → `loadModel` → `initLlama` ×2) proves recovery works.
- **Idle-timer hygiene in Jest:** `unref()` guard (lines 48-50) prevents the 5-minute handle from hanging the suite — a detail many implementations miss.
- **Corruption purge on size mismatch** with idempotent delete is the correct fail-closed shape for the check it does perform.
- **Heuristic tests assert real behavior** (dedup case-insensitivity, token-callback streaming of fallback summary) rather than just existence.
- **Local date authority** is genuinely used in both fallback branches; `todayStr` is threaded into the LLM prompt for anchored parsing.

## Verdict

**NEEDS FIXES** — 3 Critical (hash verification unenforced, `RNStyleSheet` module crash, post-download/resume trust gap) plus 6 Warnings must be addressed before this pipeline is production-trustworthy. The concurrency lock and fallback plumbing — the hardest logic — are sound; the failures are in verification completeness and lifecycle races around it.
