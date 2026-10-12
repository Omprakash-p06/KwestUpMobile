---
slug: expo57-native-compat
status: verifying
trigger: >
  Architecture-review P0 ("Resolve the Expo 57 compatibility contradiction"): package.json
  declares Expo SDK ~57.0.0 + React Native 0.86.0, but the native/animation stack is pinned to
  the SDK 53 generation (react-native-reanimated ~3.17.4, no react-native-worklets) and
  android/gradle.properties still sets newArchEnabled=false. Request: verify the ACTUAL
  installed dependency tree and native build rather than trusting package.json version strings.
created: 2026-10-12
updated: 2026-10-12
---

## Symptoms

1. Expected: a clean Android development build and production APK built from this tree, with model
   loading, widget interactions, notifications and the focus timer working on a physical device
   (review's acceptance criterion for P0-1).
2. Actual: `package.json` mixes two SDK generations. The declared platform (`expo@~57.0.0`,
   `react-native@0.86.0`, `react@19.2.3`) is SDK 57, while every native module is an SDK 53 build
   (`expo-notifications@~0.31.4`, `expo-file-system@~18.1.11`, `react-native-reanimated@~3.17.4`,
   `react-native-screens@~4.11.1`, `react-native-gesture-handler@~2.24.0`,
   `@react-native-async-storage/async-storage@2.1.2`). `react-native-worklets` — required by the
   Reanimated version SDK 57 expects — is absent entirely.
3. Error messages: none observed yet — the JS-only CI gate (typecheck / lint / jest) passes green
   because it never touches the native graph. No Android SDK / device is available in this
   environment, so the native build could not be executed here.
4. Timeline: SDK 57 core was raised in Phase 21 (2026-10-10, per the resolved
   `npm-ci-eresolve-dependency-conflict` session), long after the 2026-06-05 decision to pin
   `newArchEnabled=false` for a NothingOS (Nothing Phone 3a, Android 16) Fabric-init crash. The
   native/animation stack was never reconciled with the new core.
5. Reproduction: `npm ls expo react-native react-native-reanimated react-native-worklets`,
   read `android/gradle.properties`, `app.json`, `babel.config.js`, `package.json`.

**Project:** KwestUpMobile — React Native (bare, committed `android/`) at
C:\Users\OM Prakash\Documents\KwestUpMobile

## Current Focus

**Hypothesis:** The SDK 53 → 57 upgrade was PARTIAL. Only the platform core was raised; the native
module set, the Reanimated generation, the Babel worklet plugin, `app.json`'s `sdkVersion` and the
`newArchEnabled` switch were left at SDK 53. Because SDK 57 / RN 0.86 is New-Architecture-only, the
`newArchEnabled=false` "fix" of 2026-06-05 is now inert — it no longer prevents anything, while the
absent `react-native-worklets` and the Reanimated 3 / RN 0.86 pairing block the build.

**Decision (2026-10-12):** user chose **complete the SDK 57 upgrade** and directed that the *actual*
native compatibility failure be resolved, not just version strings.

**Next action:** device verification. The JS-level reconciliation is applied and green; the Android
build and on-device smoke tests must be run where there is disk space and an Android SDK with the
NDK (see "Outcome" below).

## Evidence Log

- timestamp: 2026-10-12
  checked: `npm ls expo react-native react-native-reanimated react-native-worklets llama.rn`
  found: local `node_modules` is entirely the PRE-upgrade generation — `expo@53.0.20`,
    `react-native@0.79.5`, `react-native-reanimated@3.17.5`, everything else flagged
    `invalid: "0.86.0" from the root project`. `llama.rn@0.12.4` present.
  implication: the local tree cannot validate SDK-57 native behaviour at all; all version facts must
    be read from `package.json` / `package-lock.json`, not from `node_modules`.
- timestamp: 2026-10-12
  checked: `package-lock.json` resolved versions (what CI installs)
  found: `expo@57.0.27`, `react-native@0.86.0`, `react@19.2.3`, `jest-expo@57.0.5`,
    `react-native-reanimated@3.17.5`, `react-native-worklets` = **null**, `@shopify/react-native-skia`
    = null. `jest-expo` peers `@react-native/jest-preset@^0.86.3`.
  implication: the lockfile genuinely resolves SDK 57 core + Reanimated 3 + no worklets — the
    contradiction is committed, not a local-cache artefact.
- timestamp: 2026-10-12
  checked: `expo@57.0.27/bundledNativeModules.json` (authoritative SDK 57 expected versions)
    diffed against `package.json`
  found: 19 packages mismatch the SDK 57 expectations —
    `react-native-reanimated` expected `4.5.1` vs `~3.17.4`;
    `react-native-worklets` expected `0.10.1` vs **absent**;
    `react-native` expected `0.86.3` vs `0.86.0`;
    `react-native-screens` `~4.26.0` vs `~4.11.1`;
    `react-native-gesture-handler` `~2.32.0` vs `~2.24.0`;
    `react-native-safe-area-context` `~5.7.0` vs `5.4.0`;
    `@react-native-async-storage/async-storage` `2.2.0` vs `2.1.2`;
    `@react-native-community/datetimepicker` `9.1.0` vs `8.4.1`;
    `expo-notifications` `~57.0.22` vs `~0.31.4`;
    `expo-file-system` `~57.0.7` vs `~18.1.11`;
    `expo-camera` `~57.0.6` vs `~16.1.11`;
    `expo-clipboard` `~57.0.2` vs `~7.0.1`;
    `expo-document-picker` `~57.0.3` vs `~13.1.6`;
    `expo-haptics` `~57.0.3` vs `~14.1.4`;
    `expo-linear-gradient` `~57.0.2` vs `~14.1.5`;
    `expo-sharing` `~57.0.22` vs `~13.1.5`;
    `expo-font` `~57.0.4` vs `~13.3.2`;
    `expo-status-bar` `~57.0.1` vs `~2.2.3`;
    `expo-build-properties` also SDK 53-line (not in bundled list).
  implication: the ENTIRE native module set is one SDK generation behind the core it is linked
    against. This is the contradiction the review flagged — and it is wider than Reanimated alone.
- timestamp: 2026-10-12
  checked: `android/gradle.properties`
  found: `newArchEnabled=false` with a long 2026-06-05 comment ("⚠️ KEEP FALSE — definitive root
    cause"): Fabric init conflicts with NothingOS `NtOnlineConfigImpl` on Nothing Phone 3a; and a
    claim that llama.rn's `RNLlamaModule.install()` targets the Old-Arch bridge.
  implication: an Old Architecture build is what the native config is written for — but the pinned
    RN version no longer honours that switch (see next evidence row).
- timestamp: 2026-10-12
  checked: Expo docs — https://docs.expo.dev/guides/new-architecture/
  found: "Starting with React Native 0.82, the option to disable the New Architecture was removed,
    so setting newArchEnabled to false has no effect." (page updated 2026-09-03). Corroborated by
    the React Native 0.82 "A New Era" release post (2025-10-08) and independent write-ups
    ("Expo SDK 55 and later have removed the opt-out flag entirely").
  implication: **RN 0.86 always builds New Architecture. `newArchEnabled=false` is a no-op
    placebo.** The June 2026 NothingOS mitigation is not actually in force, and the "KEEP FALSE"
    comment is now actively misleading — the risk it documents is unmitigated either way.
- timestamp: 2026-10-12
  checked: Reanimated migration docs + Expo Android build-failure reports
    (docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x)
  found: "In Reanimated 4, worklets implementation has been moved to a separate library named
    react-native-worklets." Android build failures report "Reanimated / Worklets require new
    architecture to be enabled. Please enable it by setting newArchEnabled=true in
    gradle.properties."
  implication: Reanimated 3.17.5 + RN 0.86 + New-Arch-only is an unsupported pairing; the SDK 57
    target (Reanimated 4.5.1 + worklets 0.10.1) also requires the Babel plugin to move to
    `react-native-worklets/plugin`.
- timestamp: 2026-10-12
  checked: `babel.config.js`
  found: `plugins.push('react-native-reanimated/plugin')` (last, as required) — no
    `react-native-worklets/plugin`.
  implication: the worklet Babel transform is wired to the Reanimated 3 mechanism; after the
    Reanimated 4 upgrade this must change, or every worklet/animation build breaks.
- timestamp: 2026-10-12
  checked: `app.json`
  found: `"sdkVersion": "53.0.0"` alongside `expo@~57.0.0`; plugins list `llama.rn`,
    `expo-camera`, `expo-build-properties`, `react-native-android-widget` (5 widgets).
  implication: a third, human-readable source of truth still asserts SDK 53. Prebuild/config
    consumers read a value that contradicts the installed core.
- timestamp: 2026-10-12
  checked: Reanimated surface area in source —
    `grep -rln "react-native-reanimated" src widgets App.js` + API census
  found: exactly ONE importing file, `src/components/CustomSwitch.js`, and it uses only
    `Animated.View` (no `useAnimatedStyle`, `useSharedValue`, `useWorkletCallback`,
    `useAnimatedGestureHandler`, `runOnJS`/`runOnUI`, no worklets). No
    `react-native-worklets` imports anywhere. No `GestureDetector`/`Gesture.*` usage.
  implication: the Reanimated 3 → 4 migration is nearly risk-free at the source level (version bump
    + Babel plugin swap only). Good news for the fix path.
- timestamp: 2026-10-12
  checked: `patch-llama-gradle.js` (runs on every `postinstall`, fails closed) + the
    2026-06-05 `knowledge-base.md` entry `llama-rn-compile-error-2`
  found (verified against upstream `llama.rn@0.12.4/android/build.gradle`): line 12
    `def isNewArchitectureEnabled() { return rootProject.hasProperty("newArchEnabled") &&
    rootProject.getProperty("newArchEnabled") == "true" }`, gating `apply plugin:
    "com.facebook.react"` (l.84-85) and `react { codegenJavaPackageName = "com.rnllama" }`
    (l.239-240). Line 11 of `RNLlamaModule.java` is `public class RNLlamaModule extends
    NativeRNLlamaSpec` — UNCONDITIONALLY, so the codegen output is a compile-time requirement in
    both architectures. The script unwraps both conditionals so codegen always runs.
  implication: the postinstall patch is LOAD-BEARING AND BENIGN, not a hazard — it supplies the
    codegen that `extends NativeRNLlamaSpec` always needs while the flag is false; had the flag
    been true, the upstream conditional would already be satisfied and the script idempotently
    skips. Corrects the review's/knowledge-base's framing that the patch serves only Old Arch.
- timestamp: 2026-10-12
  checked: `llama.rn@0.12.4/android/src/main/java/com/rnllama/RNLlamaPackage.java`
  found: line 32 `boolean isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;` (fed from
    `isNewArchitectureEnabled()`, i.e. from the `newArchEnabled` GRADLE PROPERTY).
  implication: **the stale flag is not inert for third-party modules.** RN 0.86 ignores
    `newArchEnabled` for its own build, but llama.rn still reads it as a Gradle property and uses
    it to decide whether to register as a TurboModule. With `newArchEnabled=false` committed,
    llama.rn registers as a LEGACY module inside a runtime that is New Architecture regardless —
    the exact mismatch the flag was written to prevent, now inverted.
- timestamp: 2026-10-12
  checked: React Native 0.86.0 sources — `bridge/ReactContext.java:173`,
    `runtime/BridgelessReactContext.kt:79-91`, `runtime/BridgelessCatalystInstance.kt:107-109`
  found: bridgeless `getCatalystInstance()` logs "[WARNING] Bridgeless doesn't support
    CatalystInstance..." and returns a `BridgelessCatalystInstance` compat shim (it only throws
    `UnsupportedOperationException` when `UNSTABLE_ENABLE_MINIFY_LEGACY_ARCHITECTURE` is set).
    That shim implements `jsCallInvokerHolder` as
    `@get:JvmName("getJSCallInvokerHolder") ... requireNotNull(reactHost.jsCallInvokerHolder)` —
    the legacy JVM name kept deliberately for this backward-compatibility case.
  implication: llama.rn 0.12.4's Old-Arch-shaped `install()` is NOT proven broken on RN 0.86 — its
    `getCatalystInstance().getJSCallInvokerHolder()` cast resolves through a maintained shim.
    Downgraded from suspected-broken to a device-verification item. (`llama.rn@0.13.0-rc.7`, the
    current `latest` on npm, has byte-identical install() code, so a version bump would not change
    this either way.)
- timestamp: 2026-10-12
  checked: existing debug sessions + `.planning/codebase/CONCERNS.md`, `STACK.md`, `ARCHITECTURE.md`
    cross-references
  found: `STACK.md` line 33 propagates the contradiction ("Expo SDK ~57.0.0" alongside
    "react-native-reanimated ~3.17.4"); `ARCHITECTURE.md` line 46 calls `TaskContext.js` the "Sole
    writer of tasks/taskLists/dailyTasks" while line 99 documents the widget handler doing "direct
    AsyncStorage reads/writes" and line 20 an App.js "notes mirror" — the review's second P0.
  implication: the documentation mirrors the code's contradictions rather than resolving them; the
    review's criticism is accurate, and the sibling P0s are real (tracked separately below).

## Eliminated

- hypothesis: the local `node_modules` state proves the app is on SDK 53
  evidence: `npm ls` shows `expo@53.0.20`/`react-native@0.79.5` locally, but `package-lock.json`
  resolves `expo@57.0.27`/`react-native@0.86.0`. The local tree is a stale install, not the
  committed truth — the committed truth is the (partial) SDK 57 upgrade. Ruled out as the root
  cause; it is a verification hazard.
- hypothesis: the Expo 57 statement in `package.json` is itself the bug (i.e. the upgrade was
  imaginary)
  evidence: `expo@57.0.27` and `jest-expo@57.0.5` really are resolved in the lockfile and really do
  exist on npm (`sdk-57` dist-tag = 57.0.27); the earlier session installed them from the lockfile.
  Ruled out — the upgrade happened, it just didn't finish.
- hypothesis: the CI failure fixed on 2026-10-10 (`@react-native/jest-preset` missing) explains the
  native contradiction
  evidence: that was a Jest-resolution defect in the JS toolchain; it is fixed and distinct from the
  native module generation gap. Ruled out as the same root cause (it is a downstream symptom of the
  same partial upgrade).
- hypothesis: llama.rn@0.12.4's `.install()` cannot work on RN 0.86 because it calls the Old-Arch
  `context.getCatalystInstance()`, so AI assist / model loading is dead on this stack, and upgrading
  llama.rn would fix it
  evidence: RN 0.86 `BridgelessReactContext.getCatalystInstance()` returns a `BridgelessCatalystInstance`
  compat shim (throwing only when `UNSTABLE_ENABLE_MINIFY_LEGACY_ARCHITECTURE` is enabled), and that
  shim's `jsCallInvokerHolder` is implemented and kept under the legacy JVM name
  `getJSCallInvokerHolder`. `install()` also catches `Exception` and resolves `false` rather than
  crashing. `llama.rn@0.13.0-rc.7` (npm `latest`) carries identical install() code. Ruled out as
  proven-broken; retained as a device-verification item.

## Resolution

**Root Cause (CONFIRMED):** A partial SDK 53 → 57 upgrade. The platform core was raised
(`expo@~57.0.0`, `react-native@0.86.0`, `react@19.2.3`, `jest-expo@~57.0.0`) without reconciling the
19 native modules that SDK 57 expects, without adding `react-native-worklets`, and without updating
the Reanimated generation or its Babel plugin.

Three consequences, in descending order of importance:

1. **The committed native module set cannot be linked against the committed core.** Every `expo-*`
   module, Reanimated, screens, gesture-handler, safe-area-context, async-storage and datetimepicker
   is an SDK 53 build; `expo@57` core + `expo-modules-core@57` is the runtime they would be built
   against. Alignment requires `expo install --fix` on an SDK 57 tree (~19 packages).
2. **The 2026-06-05 NothingOS mitigation is inert.** RN ≥ 0.82 removed the opt-out, so
   `newArchEnabled=false` does not produce an Old-Architecture build (Expo docs, 2026-09-03). The
   app runs New Architecture either way, meaning the phone-specific crash the flag was written to
   prevent is currently unmitigated, and the "⚠️ KEEP FALSE" comment is misleading rather than
   protective.
3. **The stale flag still has a real second effect.** llama.rn reads `newArchEnabled` as a Gradle
   property to compute `BuildConfig.IS_NEW_ARCHITECTURE_ENABLED`, which decides whether it registers
   as a TurboModule. So the false value makes llama.rn self-register as a legacy module inside a
   New-Arch runtime.

Secondary: `app.json` still declares `"sdkVersion": "53.0.0"`, and `babel.config.js` keeps the
Reanimated 3 plugin (`react-native-reanimated/plugin`) where the SDK 57 target
(Reanimated 4.5.1 + worklets 0.10.1) requires `react-native-worklets/plugin`.

**Fix: APPLIED 2026-10-12.** Nineteen packages realigned to `expo@57.0.27`'s `bundledNativeModules`,
Reanimated 3 -> 4 with `react-native-worklets`, Babel plugin removed (auto-configured), navigation
v6 -> v7, `expo-file-system` imports moved to the legacy subpath, the dead `newArchEnabled=false`
replaced with `true` (+ reason), the llama.rn postinstall unwrap removed, `app.json` `sdkVersion`
removed, `splash` moved to the `expo-splash-screen` plugin, TypeScript 5.8 -> 6.0 with explicit
ambient `types`, `@babel/core` -> ^7.29.0. Full inventory in the change set below.

**Verification actually performed (all after the final edit):**

| Gate | Result |
| --- | --- |
| `tsc --noEmit` | **0 errors** (TS 6.0.3) |
| `eslint .` | **0 errors** (478 warnings, pre-existing style class) |
| `jest --ci` | **30 suites / 457 tests pass** |
| `npx expo install --check` | **"Dependencies are up to date"** (exit 0) |
| `npx expo-doctor` | **20/21 checks pass** |
| `npm run postinstall` | exit 0; leaves `llama.rn`'s build.gradle **untouched** (verified on a pristine reinstall) |
| llama.rn gradle gate | statically verified: `newArchEnabled=true` -> `isNewArchitectureEnabled()` true -> `react { codegenJavaPackageName = "com.rnllama" }` runs, required because `RNLlamaModule extends NativeRNLlamaSpec` unconditionally |

**Could NOT be verified here (environment blockers, not code):**
1. **No Android build was produced.** The host C: drive is at **100% (400 MB free of 477 GB)**, and
the first Gradle attempt died with `There is not enough space on the disk` while compiling the RN
gradle plugin. `C:/Android/Sdk` also has **no NDK and no CMake** and only platforms 34/35, which
RN 0.86's native modules (Reanimated 4, worklets, llama.rn) require.
2. **No device.** The review's acceptance criterion — clean dev build + production APK with model
loading, widget interactions, notifications and focus timer on a physical device — is unmet.
3. **Remaining expo-doctor check:** "app config fields may not be synced in a non-CNG project" —
the repo commits `android/` *and* declares native config in `app.json`, so EAS/Prebuild cannot sync
`orientation`, `icon`, `userInterfaceStyle`, `ios`, `android` or `plugins`. Informational, and an
architectural property of the repo rather than a regression.
4. **Nothing was committed.**

**Environment note for reproducing locally (Windows):** the Gradle wrapper and every JVM-side
download fail with `SocketTimeoutException` unless the JVM prefers IPv4. Export
`GRADLE_OPTS="-Djava.net.preferIPv4Stack=true"` before `./gradlew`. With that set, Gradle 8.13
installs correctly.

**Not the cause (corrected during investigation):** the `patch-llama-gradle.js` postinstall patch
was load-bearing and benign, not a hazard — `RNLlamaModule extends NativeRNLlamaSpec`
unconditionally, so its codegen must run regardless of architecture; and llama.rn's use of
`getCatalystInstance()` resolves through a maintained bridgeless compat shim in RN 0.86, so it is
not proven broken. It was removed anyway because `newArchEnabled=true` makes it redundant, and the
brief forbade keeping speculative native patches.

## On-Device Verification Checklist (blocking — the fix is NOT proven until this passes)

Delegate the build to a machine with free disk space and an Android SDK that includes the NDK and
CMake for RN 0.86 (SDK Manager: `platforms;android-36`, `ndk;<version>`, `cmake;<version>`), then:

```bash
export GRADLE_OPTS="-Djava.net.preferIPv4Stack=true"   # Windows: required, see below
cd android
gradlew.bat clean                        # or ./gradlew clean
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a   # fastest proof
./gradlew :app:assembleRelease           # production APK (signed with the debug keystore today)
```

A successful `assembleDebug` proves the two things this session could not: that `newArchEnabled=true`
drives llama.rn's codegen (so `NativeRNLlamaSpec` is generated) and that Reanimated 4 + worklets
compile under the New Architecture.

Then, **on the Nothing Phone 3a (Android 16) — the device that caused the original `newArchEnabled`
workaround:**

1. **Cold start / crash (highest risk, P0):** install and launch from a killed state at least 5
times. The 2026-06-05 session pinned `newArchEnabled=false` because
`DefaultNewArchitectureEntryPoint.load()` (Fabric C++ init) conflicted with NothingOS
`NtOnlineConfigImpl`. That mitigation is inert at RN 0.86, so this is the first thing to re-test.
2. **Model loading (`llama.rn`):** Settings -> AI Assist -> download/load Qwen2.5-0.5B Q4_K_M, then
run one inference. `install()` still calls `getCatalystInstance().getJSCallInvokerHolder()`, which on
RN 0.86 routes through `BridgelessCatalystInstance`'s compatibility shim — a deprecation path. Watch
for `install()` resolving `false` (AI silently disabled) rather than a hard crash.
3. **Unload / reload:** unload the model, reload it, and confirm no JSI crash (`cleanupJSIBindings`).
4. **Widgets:** add all five (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList`, `HabitWidget`),
toggle a task from a widget, then return to the app and confirm both changes survive.
5. **Notifications:** task due-date, birthday, billing and behavioural cue notifications fire, and a
notification action executes exactly once (idempotency).
6. **Focus timer:** start/stop/complete a session, and confirm the widget reflects it.
7. **Navigation (new in this change):** open/close the drawer repeatedly — `@react-navigation/drawer`
7.x + Reanimated 4 is the one pairing that changed shape here.
8. **Files paths (new in this change):** create/edit a note, export an encrypted backup to a file,
and import it back — these all route through `expo-file-system/legacy`.

## Related Sessions

- `.planning/debug/npm-ci-eresolve-dependency-conflict.md` (resolved 2026-10-10) — the same partial
  upgrade surfacing as an ERESOLVE/Jest crash. That session fixed the JS toolchain symptom; this one
  addresses the native generation gap it left behind.
- `knowledge-base.md` — `llama-rn-compile-error-2` (2026-06-05) records the opposite architecture
  conclusion from what `android/gradle.properties` now claims.
