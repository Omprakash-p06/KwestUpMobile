---
status: root_cause_found
trigger: "SDK 57 upgrade not finished — source-level checks pass (TypeScript, lint, Jest, dependency validation, package-lock consistency) but Android native build and real-device startup path unverified. Concerns: llama.rn 0.12.4 bridgeless/JSI init path, 16KB page-size packaging alignment. Blockers: ~400MB disk free, missing NDK/CMake, no debug APK built yet."
created: 2026-10-12
updated: 2026-10-12
---

# Debug Session: sdk-57-native-build-blocked

## Symptoms

- Expected: Native build verified — SDK 57 upgrade complete means debug APK builds via Gradle wrapper, release APK 16KB-aligned, device smoke tests pass on Nothing Phone 3a.
- Actual: Native build blocked — source checks pass but native Android build never attempted/succeeded on this machine.
- Errors: Build env errors — Gradle disk-space failure (~400MB free), missing NDK/CMake versions, no SDK platform recorded. No llama.rn JSI runtime errors yet (unverified path).
- Timeline: Never built — SDK 57 upgrade started recently, source-level validation done, native build never succeeded in this environment.
- Reproduction: Gradle build — run documented Gradle wrapper debug APK build; also pending: release APK ELF/APK alignment inspection, device test (cold start, model init/inference/reload, widgets, notifications, focus timer, vault access).

## Current Focus

- hypothesis: Native build is blocked purely by environment gaps (missing NDK/CMake, Java 21 vs required 17, critically low disk), NOT by source misconfiguration — gradle.properties, 16KB flags, and llama.rn codegen gate are all correct.
- test: Environment inspection (disk, SDK packages via sdkmanager, java version, gradle/llama configs).
- expecting: NDK/CMake absent, Java mismatch, disk < 8GB free.
- next_action: remediate environment (free disk → install NDK 27 + CMake → install Java 17) then run Gradle debug build
- reasoning_checkpoint: 2026-10-12 — source config verified correct; no code change needed; remaining work is env remediation + build verification.

## Evidence

- timestamp: 2026-10-12T14:30Z
  test: disk + env baseline
  expecting: adequate disk, ANDROID_HOME/JAVA_HOME set, compatible Java
  found: C: 477G total / 472G used / 5.1G free (99% used; trigger's ~400MB figure is stale, but 5.1G is still below the ~8-10G a Gradle+NDK build needs). ANDROID_HOME, ANDROID_SDK_ROOT, JAVA_HOME all unset. System java is 21.0.7 LTS — RN 0.86 / AGP requires Java 17, so Gradle will fail even after NDK install until Java 17 is provided.
- timestamp: 2026-10-12T14:30Z
  test: SDK package inventory via sdkmanager --list_installed + ls C:/Android/Sdk
  expecting: NDK + CMake present alongside platforms/build-tools
  found: installed = build-tools 34.0.0/35.0.0, platforms android-34/android-35, emulator, platform-tools 37.0.1, x86_64 system image. MISSING: ndk/ and cmake/ directories entirely. local.properties points at C:/Android/Sdk so Gradle resolves the SDK, but any llama.rn native compile (externalNativeBuild cmake path src/main/CMakeLists.txt) fails with no CMake/NDK.
- timestamp: 2026-10-12T14:30Z
  test: source-config audit (gradle.properties, build.gradle, app/build.gradle, llama.rn build.gradle, patch script)
  expecting: misconfiguration explaining blocked build
  found: source config is CORRECT — newArchEnabled=true satisfies llama.rn's codegen gate (build.gradle:12/84/239; NativeRNLlamaSpec requires codegen output), hermesEnabled=true, expo.useLegacyPackaging=true (16KB install-time extraction), root build.gradle injects -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON + max-page-size=16384 for all cmake modules, llama.rn already passes FLEXIBLE_PAGE_SIZES itself. patch-llama-gradle.js correctly no longer force-unwraps llama guards. No Android Studio JBR found; Gradle wrapper 8.13; node v22.19.0 meets engines>=22.13. adb present (1.0.41 v37.0.1).
  rules_out: source-level misconfiguration as the blocker.

## Eliminated

- Source misconfiguration (newArchEnabled, Hermes, 16KB packaging flags, llama.rn codegen gate, widget patch) — all verified correct; no code fix required.
- Missing SDK platforms — android-34 + android-35 present, matching Expo SDK 57 default compileSdk 35.

## Specialist Review

- specialist_hint: general (Android Gradle/NDK environment issue, not TS/React code)
- dispatch: skipped — no matching specialist skill installed in this environment (no engineering:debug / native-android skill available); finding is environment remediation, not code review.

## Resolution

- root_cause: Android native build blocked by three environment gaps, not by source code — (1) NDK entirely absent (Expo SDK 57 default 27.1.12297006; llama.rn compiles llama.cpp via CMake and fails without it); (2) CMake entirely absent (llama.rn externalNativeBuild requires it); (3) Java 21 system default vs Java 17 required by RN 0.86 AGP chain, with JAVA_HOME unset and no Android Studio JBR present. Contributing constraint: only 5.1GB free on C: (99% used) — below the ~8-10GB needed for NDK+CMake+Gradle build working set, so remediation must start with freeing disk. ANDROID_HOME/ANDROID_SDK_ROOT also unset (non-blocking today via local.properties sdk.dir, but fragile).
- fix: NOT APPLIED (no code change needed or made — remediation is environment steps for the user, in order): (1) free C: to >=10GB (node_modules is only 533M; look at Gradle caches, emulator images, downloads); (2) install toolchain: `sdkmanager.bat "ndk;27.1.12297006" "cmake;3.22.1"` (verify exact cmake train via `sdkmanager --list`); (3) install Temurin/OpenJDK 17, set JAVA_HOME + prepend to PATH for the build shell; (4) set ANDROID_HOME=C:/Android/Sdk (+ ANDROID_SDK_ROOT same) persistently; (5) run `cd android && ./gradlew assembleDebug` (narrow architectures first if disk still tight: `-PreactNativeArchitectures=arm64-v8a`); (6) device smoke on Nothing Phone 3a (cold start, llama.rn model init/inference/reload, widgets, notifications, focus timer, vault) + release APK 16KB alignment check. NDK/CMake install was deliberately NOT attempted in-session: 5.1GB free risks driving C: to zero mid-download.
- verification: null (pending — debug APK build + device smoke + 16KB alignment inspection not yet run)
- files_changed: []
