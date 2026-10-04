---
phase: 21-technology-platform-upgrade-expo-sdk-57-rn-0-86-node-22
reviewed: 2026-10-04T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - package.json
  - patch-llama-gradle.js
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues-found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-10-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues-found

## Summary

Reviewed the two files changed in the SDK 57 upgrade: `package.json` (Expo ~53.0.20 → ~57.0.0, React 19.0.0 → 19.2.3, RN 0.79.5 → 0.86.0, `@types/react` → ~19.2.0, `jest-expo` → ~57.0.0, `test` script dropped `--passWithNoTests`) and `patch-llama-gradle.js` (idempotency guards + post-patch verification with `process.exit(1)`).

The core-version trio is coherent and verified against upstream: Expo SDK 57 targets RN 0.86 + React 19.2.x with Node ≥ 22.13 (Expo SDK reference table; SDK 57 changelog, June 30 2026), so `expo ~57.0.0` / `react 19.2.3` / `react-native 0.86.0` / `jest-expo ~57.0.0` / `engines.node >= 22.13` are all correct. The `test`-script change is safe — 13 test files exist under `__tests__/`, so `--passWithNoTests` was dead weight. No secrets, injection, or dangerous-function issues in either file.

Three warnings remain: the satellite `expo-*` / gesture / reanimated pins were left at pre-upgrade versions instead of being realigned via the official `npx expo install --fix` path, and the new patch-script guards use whole-file substring heuristics that can both false-fail (hard-breaking `npm install` via `exit(1)`) and false-skip, with missing-target branches failing open. Two info-level robustness notes on unguarded `fs` I/O and magic constants in the injected Java.

## Warnings

### WR-01: Satellite dependency pins not realigned to SDK 57

**File:** `package.json:29-40,44-51`
**Severity:** warning
**Issue:** `expo` was bumped `~53.0.20` → `~57.0.0`, but every satellite pin that Expo versions in lockstep was left untouched: `expo-camera ~16.1.11`, `expo-clipboard ~7.0.1`, `expo-dev-client ~5.2.4`, `expo-document-picker ~13.1.6`, `expo-file-system ~18.1.11`, `expo-font ~13.3.2`, `expo-haptics ~14.1.4`, `expo-linear-gradient ~14.1.5`, `expo-notifications ~0.31.4`, `expo-sharing ~13.1.5`, `expo-status-bar ~2.2.3`, `expo-build-properties ~0.14.8` (SDK 57-era `expo-font` is 57.x per npm), and the animation/gesture stack is stale too — `react-native-reanimated ~3.17.4` and `react-native-gesture-handler ~2.24.0`, where SDK 57 bundles reanimated ~4.5 / gesture-handler ~2.32 / worklets ~0.10 (SDK 57 changelog). Expo documents these packages as supporting only their target SDK's RN version, and prescribes `npx expo install expo@^57.0.0 --fix` plus `expo-doctor` as the upgrade path. A hand-edited core-only bump risks native-module / JS-API mismatches that surface as Gradle/Pod build failures or runtime crashes, not install errors.
**Recommendation:**
```bash
npx expo install expo@^57.0.0 --fix
npx expo-doctor@latest
# commit the resulting aligned pins (incl. reanimated ~4.5, gesture-handler ~2.32, worklets ~0.10)
```

### WR-02: Whole-file substring guard/verification can false-fail and false-skip

**File:** `patch-llama-gradle.js:13-14,26`
**Severity:** warning
**Issue:** Both the idempotency guard and the post-patch verification reason about the entire file with `String.includes` instead of the targeted regions. (a) Line 26 fails the patch — and via line 104's `process.exit(1)` hard-fails `npm install`/`npm ci` — if the literal `if (isNewArchitectureEnabled())` appears *anywhere* in `build.gradle`, including an unrelated block added by a future `llama.rn` release that neither regex (lines 19, 22) was meant to touch. There is no recovery path short of editing the script. (b) Conversely, lines 13-14 report "already patched" and skip whenever `apply plugin: "com.facebook.react"` is present and the conditional string is absent — so an upstream-restructured file (unconditional plugin line, but a changed/relocated `react {}` block the `pattern2` regex no longer matches) is declared patched while the `react {}` unwrap never happens, producing a silently incomplete patch and a later Android build failure. Same class of issue at line 44: any pre-existing `getFallbackSize` (even an upstream helper with different semantics) causes a silent skip.
**Recommendation:** Assert on what was actually transformed — e.g. check each `String.replace` changed the match count, or verify the specific unwrapped `react {` block — rather than global string absence/presence:
```js
const before = content;
content = content.replace(pattern1, 'apply plugin: "com.facebook.react"');
const didPatch1 = content !== before;
// ... same for pattern2, then:
if (!didPatch1 && !didPatch2 && !isAlreadyPatched) { /* fail with actionable message */ }
```

### WR-03: Missing-target branches fail open while verification failures fail closed

**File:** `patch-llama-gradle.js:34-36,99-101`
**Severity:** warning
**Issue:** If `node_modules/llama.rn/android/build.gradle` or `RNWidgetUtil.java` is absent (pruned/partial install, renamed package layout after a `llama.rn` or `react-native-android-widget` bump), the script logs `console.warn` and exits 0 — install succeeds, and the missing required patch surfaces much later as an obscure Gradle/Java build failure. This contradicts the script's own new fail-closed posture for verification failures (`hasErrors` + `exit(1)`). If the patches are required for the Android build, a missing target is the same severity as a failed patch.
**Recommendation:**
```js
} else {
  console.error('❌ Target file not found, required patch not applied: ' + targetFile);
  hasErrors = true;
}
// (same for the widgetUtilFile branch)
```
If warn-and-continue is genuinely safe (e.g. iOS-only contributors), keep exit 0 but say so in an explicit comment so the asymmetry is intentional, not accidental.

## Info

### IN-01: Unguarded synchronous fs I/O with existsSync→read TOCTOU gap

**File:** `patch-llama-gradle.js:9-10,30,42,95`
**Severity:** info
**Issue:** `fs.readFileSync` / `fs.writeFileSync` are called outside any `try/catch`. An `EACCES`, `ENOSPC`, or a file removed between the `existsSync` check and the read (TOCTOU) throws an uncaught exception: `npm install` still fails (fail-closed, good) but with a raw Node stack trace instead of the script's clean `❌` diagnostics and single `exit(1)` path.
**Recommendation:** Wrap each read/transform/write section in `try/catch`, log the actionable message, and set `hasErrors = true`:
```js
try {
  // read, transform, verify, write
} catch (err) {
  console.error('❌ Patch failed for ' + targetFile + ': ' + err.message);
  hasErrors = true;
}
```

### IN-02: Hardcoded provider names, magic dimensions, and empty catch in injected Java

**File:** `patch-llama-gradle.js:71-86`
**Severity:** info
**Issue:** The replacement Java hardcodes app-specific widget class suffixes (`"TasksList"`, `"FocusTimer"`, `"DailyTasks"`, `"ImportantTasks"`) and unexplained dimension literals (`180`/`250`, `100`/`250`, default `100`/`250` at lines 77, 79, 85). Renaming a widget provider silently yields wrong-but-plausible fallback sizes. The generated `catch (Exception e) { // Safe fallback }` (lines 82-84) also swallows all diagnostics — acceptable for a size fallback, but a `Log.w` would cost nothing.
**Recommendation:** Hoist the dimensions to named `static final` constants with a comment linking them to the widget specs, and add `android.util.Log.w(TAG, ...)` in the catch of the injected code.

---

_Reviewed: 2026-10-04T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
