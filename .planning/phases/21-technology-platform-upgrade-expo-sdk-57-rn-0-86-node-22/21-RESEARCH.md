# Phase 21 Research: Technology Platform Upgrade (Expo SDK 57, RN 0.86, Node 22)

**Phase:** 21 of 28 (Milestone 3: KwestUp 4.0 Core Technology Platform)  
**Requirements Addressed:** `UPGD-01`  
**Domain:** Runtime Upgrades, Native Module Stability, Postinstall Patch Hardening, Jest & CI Quality Gates  
**Date:** 2026-10-04  

---

## 1. Executive Summary

Phase 21 executes the core platform and runtime upgrade for **KwestUp Mobile**, modernizing the baseline from Expo SDK 53 to **Expo SDK 57**, React Native 0.79.5 to **React Native 0.86**, React 19.0.0 to **React 19.2.3**, while pinning **Node 22.13+** as the authoritative runtime across local development and CI pipelines.

As established in [4.0/KwestUp_4.0_Master_Plan.md](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/4.0/KwestUp_4.0_Master_Plan.md) (§16 & §25) and [.planning/codebase/CONCERNS.md](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/.planning/codebase/CONCERNS.md), upgrading an offline-first mobile application featuring native AI inference (`llama.rn`) and home-screen widgets (`react-native-android-widget`) requires strict dependency pairing discipline rather than ad-hoc package bumps.

### Non-Negotiable Phase Objectives:
1. **Runtime & Dependency Modernization (`UPGD-01`):** Upgrade `expo`, `react-native`, `react`, and all bundled `expo-*` companion packages to Expo SDK 57 supported pairings without peer dependency conflicts.
2. **Native Patch & Postinstall Hardening:** Address the critical concern in `CONCERNS.md` regarding unverified regex replacements in `patch-llama-gradle.js`. Add strict idempotency guards, target file existence checks, and patch validation assertions.
3. **Android Architecture Invariants:** Maintain `newArchEnabled=false` in `android/gradle.properties` (due to Snapdragon 7s Gen 3 / NothingOS startup conflicts) and ensure 16 KB ELF page-size linker flags remain enforced for Android 16.
4. **Test Harness & CI Hardening:** Remove `--passWithNoTests` from `package.json` to prevent masking zero-test suites, update `jest-expo` to SDK 57 compatibility, and ensure 100% of existing unit tests pass cleanly.

---

## 2. Dependency Matrix & Version Delta

| Package | Current Baseline (v3.5.0) | Target Upgrade (SDK 57) | Architectural Role / Constraints |
|---|---|---|---|
| **`expo`** | `~53.0.20` | `~57.0.0` | Core managed runtime & native module framework. |
| **`react-native`** | `0.79.5` | `0.86.x` | Core platform runtime. Targets stable SDK 57 pairing. |
| **`react`** | `19.0.0` | `19.2.3` | UI runtime. Must match Expo SDK 57 React 19 alignment. |
| **`@types/react`** | `~19.0.10` | `~19.2.0` | TypeScript definitions for React 19.2.x. |
| **`jest-expo`** | `~53.0.0` | `~57.0.0` | Jest environment preset for Node test execution. |
| **`llama.rn`** | `0.12.4` (exact) | `0.12.4` (exact) | On-device Qwen inference. Must keep exact pinning + postinstall patch. |
| **`react-native-android-widget`** | `^0.16.1` | `^0.16.1` | Android home-screen widget framework with sizing fallback patch. |
| **`react-native-reanimated`** | `~3.17.4` | Compatible SDK 57 pairing | Babel plugin must remain last in `babel.config.js`. |
| **`@react-native-async-storage/async-storage`** | `2.1.2` | Supported SDK 57 version | System of record for key-value persistence. |
| **`expo-file-system`** | `~18.1.11` | Compatible SDK 57 pairing | Notes markdown vault storage & AI model downloads. |
| **`expo-notifications`** | `~0.31.4` | Compatible SDK 57 pairing | Local push & reminder scheduling. |
| **`Node.js`** | `>=22.13` (`package.json`) | `>=22.13` (Node 22 pinned) | Pinned in `.github/workflows/ci.yml`. |

---

## 3. Native Modules & Postinstall Patch Hardening

In [.planning/codebase/CONCERNS.md](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/.planning/codebase/CONCERNS.md), the postinstall patch script was highlighted as a critical fragility point:
> *"`postinstall: node patch-llama-gradle.js` rewrites `node_modules/llama.rn/android/build.gradle` and `node_modules/react-native-android-widget/.../RNWidgetUtil.java` via regex replacement on every `npm install`/`npm ci`, with no checksum assertion, no idempotency guard beyond string matching, and no CI step verifying it ran."*

### Hardening Strategy for `patch-llama-gradle.js`:
1. **Idempotency Guard**:
   - For `llama.rn`: Detect if `apply plugin: "com.facebook.react"` is already applied outside the `isNewArchitectureEnabled()` conditional. If already patched, skip silently and log confirmation.
   - For `react-native-android-widget`: The `!content.includes('getFallbackSize')` guard already exists; strengthen it with exact return type and method signature assertions.
2. **Post-Patch Verification**:
   - Add a verification routine that validates both files contain the expected syntax post-execution. If a patch fails to apply or the regex matches 0 targets, throw a non-zero exit code to alert CI/developers immediately.
3. **Old Architecture Compatibility**:
   - `RNLlamaModule.install()` uses `context.getCatalystInstance().getJSCallInvokerHolder()`. The patched `build.gradle` ensures the module compiles cleanly when `newArchEnabled=false`.

---

## 4. Android Native Architecture & 16 KB Page Size Alignment

From `android/gradle.properties` and past resolved debug sessions (`newarch-startup-crash-v2`):

1. **`newArchEnabled=false` Invariant**:
   - Fabric / New Architecture C++ initialization conflicts with NothingOS system injection on Snapdragon 7s Gen 3 hardware.
   - `llama.rn` JSI bindings operate over the Old Architecture CatalystInstance bridge without requiring Fabric.
   - Keep `newArchEnabled=false` throughout Phase 21.

2. **16 KB ELF Page-Size Alignment**:
   - Android 16 (API 36) mandates 16 KB page-size alignment for native `.so` binaries.
   - Root `android/build.gradle` injects `-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` and `-DCMAKE_SHARED_LINKER_FLAGS=-Wl,-z,max-page-size=16384` into all CMake subprojects.
   - `expo.useLegacyPackaging=true` in `gradle.properties` uncompresses native libraries at install time to support 16 KB alignment.
   - Verify these settings remain intact across the upgrade.

---

## 5. Test Harness & Quality Gate Hardening

1. **Eliminate `--passWithNoTests`**:
   - `package.json` currently specifies `"test": "jest --passWithNoTests"`. As identified in `CONCERNS.md`, this masks accidental test glob deletions.
   - Change to `"test": "jest"`.
2. **Jest Environment Compatibility**:
   - Upgrade `jest-expo` to match SDK 57.
   - Verify `__tests__/setup/jest.setup.js` continues to mock native modules (`llama.rn`, `react-native-android-widget`, `AsyncStorage`, `expo-file-system`) cleanly under Jest 29 and Node 22.
3. **Babel & ESLint**:
   - Ensure `babel.config.js` maintains the production console removal plugin (`babel-plugin-transform-remove-console`) while keeping `react-native-reanimated/plugin` at the end of the plugin array.

---

## 6. Validation Architecture & Test Strategy

### Automated Verification Gates
```bash
npm run typecheck       # Validates TypeScript compilation with 0 errors
npm run lint            # Validates ESLint flat config with 0 errors
npm test                # Executes full Jest test suite (13 suites, 180+ tests) without --passWithNoTests
```

### Manual & Build Verification
1. Verify `node patch-llama-gradle.js` exits 0 with validation confirmation.
2. Verify package lockfile resolves without unresolved peer dependency conflicts (`npm ci` clean).
3. Verify CI workflow (`.github/workflows/ci.yml`) runs on Node 22 with green status.
