# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## global-standards — Missing Global Processing Standards
- **Date:** 2026-05-17
- **Error patterns:** missing, standards, map, test, lint, GEMINI.md
- **Root cause:** Global standards for codebase mapping and pre-commit testing are not documented in the project's memory or workspace instructions.
- **Fix:** Create a workspace-specific GEMINI.md in the root directory to document these global standards and ensure they are followed by all agents.
- **Files changed:** GEMINI.md, .planning/codebase/CONVENTIONS.md, .planning/codebase/TESTING.md
---

## sonar-server-not-reached — SonarQube Scanner Missing Host URL
- **Date:** 2026-05-26
- **Error patterns:** SonarQube, server, not reached, host, url, colon, empty
- **Root cause:** When required secrets (`SONAR_HOST_URL` or `SONAR_TOKEN`) are not configured (e.g. on fork PR builds), they pass as empty strings to the environment variables, causing the SonarQube scanner to crash.
- **Fix:** Add a conditional `if` check to the workflow step so it only runs if both secrets are non-empty.
- **Files changed:** .github/workflows/sonarqube.yml
---

## llama-rn-compile-error-2 — Llama.rn compile error with New Architecture disabled
- **Date:** 2026-06-05
- **Error patterns:** llama.rn, NativeRNLlamaSpec, compileReleaseJavaWithJavac, compile, Gradle, newArchEnabled, android-16
- **Root cause:** React Native New Architecture was disabled (`newArchEnabled=false`) to avoid a startup crash on Android 16. However, `llama.rn` v0.12.4 requires New Architecture codegen (`NativeRNLlamaSpec`) to compile. The startup crash under New Architecture was actually caused by `@shopify/react-native-skia` pre-release `v2.0.0-next.4` not being 16 KB page-aligned.
- **Fix:** Re-enabled the New Architecture (`newArchEnabled=true` in `gradle.properties`). Upgraded `@shopify/react-native-skia` to `2.0.6` (which supports 16 KB page alignment). Injected 16 KB page size linker flags globally for all Gradle C++ subprojects via a `subprojects` block in root `android/build.gradle`.
- **Files changed:** package.json, package-lock.json, android/gradle.properties, android/build.gradle, src/screens/FocusTimerScreen.js
---
## android16-manifest-permissions — Legacy Storage Permissions Crash on Android 13+
- **Date:** 2026-06-05
- **Error patterns:** READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, SecurityException, permission, Android 13, API 33
- **Root cause:** `READ_EXTERNAL_STORAGE` is silently revoked on Android 13+ (API 33+). `WRITE_EXTERNAL_STORAGE` is blocked on Android 10+ (API 29+). Without `maxSdkVersion` scoping, the permissions appear in the installed package manifest and may cause unexpected SecurityExceptions.
- **Fix:** Added `android:maxSdkVersion="32"` to `READ_EXTERNAL_STORAGE` and `android:maxSdkVersion="29"` to `WRITE_EXTERNAL_STORAGE` in `AndroidManifest.xml`.
- **Files changed:** android/app/src/main/AndroidManifest.xml
---

## android16-adjustresize-deprecated — `adjustResize` Broken on Android 11+ with Edge-to-Edge
- **Date:** 2026-06-05
- **Error patterns:** keyboard, soft keyboard, adjustResize, windowSoftInputMode, Android 11, edge-to-edge, layout overlapping
- **Root cause:** `windowSoftInputMode="adjustResize"` was deprecated in Android 11 (API 30) and is fully broken on Android 16 when edge-to-edge is enforced. With edge-to-edge active, the window cannot resize — the keyboard overlaps content.
- **Fix:** Changed `windowSoftInputMode` to `adjustPan`. Works correctly with `WindowInsetsCompat` and safe-area-context.
- **Files changed:** android/app/src/main/AndroidManifest.xml
---

## android16-edge-to-edge-conflict — `windowOptOutEdgeToEdgeEnforcement` vs `expo.edgeToEdgeEnabled`
- **Date:** 2026-06-05
- **Error patterns:** windowOptOutEdgeToEdgeEnforcement, edge-to-edge, safe area, insets, zero insets, status bar content hidden
- **Root cause:** `styles.xml` opted OUT of edge-to-edge (`windowOptOutEdgeToEdgeEnforcement=true`) while `gradle.properties` opted IN (`expo.edgeToEdgeEnabled=true`). On Android 16 the opt-out is **ignored** — OS enforces edge-to-edge for all apps. The conflict made `react-native-safe-area-context` report 0 insets while content was still drawn behind system bars.
- **Fix:** Removed `windowOptOutEdgeToEdgeEnforcement` from `styles.xml`. Edge-to-edge state is now consistent across all configuration sources.
- **Files changed:** android/app/src/main/res/values/styles.xml
---

## android16-cmake-injection-npe — CMake Subprojects Injection NullPointerException
- **Date:** 2026-06-05
- **Error patterns:** NullPointerException, externalNativeBuild, cmake, Gradle sync, afterEvaluate, subprojects
- **Root cause:** The global 16 KB CMake flag injection in `android/build.gradle` accessed `externalNativeBuild.cmake` without null-safe guards. Pure-Java modules without a CMake build would throw NPE during `afterEvaluate`.
- **Fix:** Used null-safe access (`?.cmake`), wrapped in `try/catch`, added duplicate-flag guards with `contains()`/`startsWith()`.
- **Files changed:** android/build.gradle
---
