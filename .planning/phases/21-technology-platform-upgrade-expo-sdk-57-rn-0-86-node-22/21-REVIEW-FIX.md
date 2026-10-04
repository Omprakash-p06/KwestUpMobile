---
phase: 21-technology-platform-upgrade-expo-sdk-57-rn-0-86-node-22
fixed_at: 2026-10-04T00:00:00Z
review_path: .planning/phases/21-technology-platform-upgrade-expo-sdk-57-rn-0-86-node-22/21-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 21: Code Review Fix Report

**Fixed at:** 2026-10-04T00:00:00Z
**Source review:** .planning/phases/21-technology-platform-upgrade-expo-sdk-57-rn-0-86-node-22/21-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — Critical + Warning only)
- Fixed: 2 (WR-02, WR-03)
- Skipped: 1 (WR-01)
- Out of scope (not fixed, not counted): IN-01, IN-02

**Verification environment:** all gates (`node -c`, `node patch-llama-gradle.js` x2 for idempotency, `npm run typecheck`, `npm run lint`) ran in the main checkout (repo root `C:\Users\OM Prakash\Documents\KwestUpMobile`), not an isolated worktree — no worktree was created for this fix run, so results are reproducible from the current tree.

## Fixed Issues

### WR-02: Whole-file substring guard/verification can false-fail and false-skip

**Files modified:** `patch-llama-gradle.js`
**Commit:** 4cbce1f (`fix(21): WR-02 WR-03 per-pattern patch guards and fail-closed missing targets` — single atomic commit covering WR-02 + WR-03, both in the same file)
**Applied fix:**
- Section 1 (llama.rn): replaced the global `includes('apply plugin...') && !includes('if (isNewArchitectureEnabled())')` idempotency guard and the global post-patch verification with per-regex replacement-count assertions (`before1/didPatch1`, `before2/didPatch2` via `content !== before`) plus per-pattern `hasPatchable1/hasPatchable2` detection. Post-patch verification now asserts the owned patterns are gone (`stillPatchable1/stillPatchable2`) and the unwrapped plugin is present, so unrelated `isNewArchitectureEnabled()` blocks elsewhere no longer hard-fail `npm install`. `/g`-regex `lastIndex` is reset before each `.test()`. Idempotent skip preserved (no patchable patterns + unwrapped plugin present → skip without rewrite). A no-match-at-all case now fails with an actionable message ("upstream file layout may have changed — update the patterns").
- Section 2 (widget): scoped the idempotency guard from bare `includes('getFallbackSize')` to our injected call signature `includes('getFallbackSize(context, widgetId')`, so an upstream helper with the same name but different semantics no longer causes a silent skip. Added `beforeWidth/didPatchWidth` replacement-count assertion: unpatched-but-unmatchable files (upstream restructured, no our-patch) now fail with an actionable message instead of writing a silently incomplete patch. Guard is `if (hasOurPatch) skip` (not `&& !hasPatchableWidth`) because our own replacement re-contains a width+height pair the regex would re-match — requiring "no patchable remainder" would never skip and would duplicate the `getFallbackSize` block on every install (caught during verification: double-patch produced 3 definitions; fixed, restored pristine file from `react-native-android-widget@0.16.1` tarball, re-verified single patch + stable counts).
- **Verification:** `node -c patch-llama-gradle.js` → SYNTAX_OK; `node patch-llama-gradle.js` run 1 → llama skip (already patched) + widget patched (3 `getFallbackSize` refs / 1 definition), exit 0; run 2 → both skip, counts stable (3/1), exit 0 — idempotent. `npm run typecheck` → clean. `npm run lint` → 0 errors (480 pre-existing warnings, none in patched file).

### WR-03: Missing-target branches fail open while verification failures fail closed

**Files modified:** `patch-llama-gradle.js`
**Commit:** 4cbce1f (same atomic commit as WR-02 — both findings are in the same file and the edits are intertwined)
**Applied fix:** both missing-target branches (`targetFile` at former lines 34-36, `widgetUtilFile` at former lines 99-101) changed from `console.warn` + exit 0 to fail-closed `console.error` + `hasErrors = true` (surfacing via the existing `process.exit(1)`), with comments justifying the choice (missing required patch would otherwise surface later as an obscure Gradle/Java build failure). Chose fail-closed per review recommendation; no evidence found that warn-and-continue is intended (script is wired as `postinstall`, patches are required for the Android build).
- **Verification:** covered by the same gates as WR-02 above (syntax OK, idempotent runs exit 0 with targets present, typecheck clean, lint 0 errors). Missing-target path itself was not live-fired (targets exist in this checkout) — logic is a two-line `console.error` + flag following the file's existing `hasErrors` pattern.

## Skipped Issues

### WR-01: Satellite dependency pins not realigned to SDK 57

**File:** `package.json:29-40,44-51`
**Reason:** skipped — no safe atomic fix exists within fix scope. Realignment requires the networked official path (`npx expo install expo@^57.0.0 --fix` + `expo-doctor`) plus a native rebuild validation (Gradle/Pod) that is beyond this fix run; a hand-edited partial version bump of 12+ satellite pins (expo-camera, expo-clipboard, expo-dev-client, expo-document-picker, expo-file-system, expo-font, expo-haptics, expo-linear-gradient, expo-notifications, expo-sharing, expo-status-bar, expo-build-properties, reanimated ~3.17.4 → ~4.5, gesture-handler ~2.24.0 → ~2.32, worklets) without that validation risks trading a latent mismatch for a guaranteed broken tree. `package.json` was deliberately left untouched.
**Original issue:** `expo` bumped `~53.0.20` → `~57.0.0` but all lockstep satellite pins left at pre-upgrade versions; SDK 57 bundles reanimated ~4.5 / gesture-handler ~2.32 / worklets ~0.10.
**Recommended manual follow-up:**
```bash
npx expo install expo@^57.0.0 --fix
npx expo-doctor@latest
# commit the resulting aligned pins (incl. reanimated ~4.5, gesture-handler ~2.32, worklets ~0.10)
```

## Out of Scope (not in fix_scope=critical_warning, not fixed)

### IN-01: Unguarded synchronous fs I/O with existsSync→read TOCTOU gap

**File:** `patch-llama-gradle.js:9-10,30,42,95`
**Reason:** out of scope (Info severity, fix_scope=critical_warning). No change made.

### IN-02: Hardcoded provider names, magic dimensions, and empty catch in injected Java

**File:** `patch-llama-gradle.js:71-86`
**Reason:** out of scope (Info severity, fix_scope=critical_warning). No change made.

---

_Fixed: 2026-10-04T00:00:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
