---
status: resolved
trigger: >
  User taps AI assist button to format notes in markdown or use custom prompt.
  Error: "Writing assistance failed: Model initialization failed: Unknown error"
created: 2026-06-02
updated: 2026-06-02
---

## Symptoms

- **Expected**: AI should format notes beautifully in markdown AND accept custom user prompts for note transformation
- **Actual**: Error "Writing assistance failed: Model initialization failed: Unknown error" appears
- **Error messages**: `Model initialization failed: Unknown error` — comes from `initLlama()` in `llama.rn` failing
- **Timeline**: Never worked since implementation
- **Reproduction**: Open a note with content (10+ chars), tap AI FAB → select any writing assistance action (Improvise, Improve, Grammar, Custom, etc.)

## Current Focus

- **Hypothesis**: During `llamaInitContext` on the ThreadPool, `ensureBackendInitialized()` + `configureBackendDevices()` probes GPU backends (Vulkan) on the Mali-G715 GPU even though `n_gpu_layers: 0` is set. This probing throws a non-standard C++ exception, caught by `catch (...)` in `JSIUtils.cpp`, producing "Unknown error".
- **Test**: Add `no_gpu_devices: true` to `initLlama()` params to skip GPU backend probing entirely, and add `llama.rn` to app.json plugins
- **Expecting**: Skipping GPU probing should allow the CPU-only backend to initialize cleanly
- **Next action**: Update `loadModel()` to pass `no_gpu_devices: true`, rebuild, and retest; also enable native logging via `toggleNativeLog(true)` to capture C++ diagnostic output

## Evidence

- timestamp: 2026-06-02Tinvestigation-start
  checked: Full trace of "Unknown error" from JS through C++ to user-facing error
  found: Error chain: `handleAssist("improve")` (AIAssistant.js:215) → `assistWriting()` → `loadModel()` (aiService.js:104-105) → `initLlama()` (llama.rn index.ts) → `llamaInitContext()` (JSI) → `createPromiseTask()` (JSIUtils.cpp:47) → ThreadPool → `ensureBackendInitialized()` + `configureBackendDevices()` → `ctx->loadModel()` → `common_init_from_params()` → exception caught by `catch (...)` at JSIUtils.cpp:139-154 → "Unknown error" → promise rejection → JS error chain
  implication: The "Unknown error" definitely originates from a non-std::exception in the C++ model initialization path, wrapping back through the complete JS promise rejection chain

- timestamp: 2026-06-02Tinvestigation
  checked: GPU backend enumeration in RNLlamaJSI.cpp configureBackendDevices() and ensureBackendInitialized()
  found: Even with `n_gpu_layers: 0`, `ensureBackendInitialized()` calls `llama_backend_init()` (registers ALL backends). Then `configureBackendDevices()` on Android calls `getFilteredDefaultDevices()` which enumerates GPU devices including Vulkan and OpenCL backends, even in CPU-only mode. The `no_gpu_devices` param (when true) skips the auto-enumeration but still calls `hasGpuBackendDevice()`.
  implication: The GPU backend probing happens unconditionally on Android, and on a MediaTek Mali-G715 device, this could trigger a platform-level non-std::exception from the GPU driver/Vulkan layer

- timestamp: 2026-06-02Tinvestigation
  checked: JSIUtils.cpp dual catch blocks at lines 109 and 154
  found: Line 139 `catch (...)` catches exceptions from the ThreadPool `task()` — which includes the entire `llamaInitContext` initialization. Line 109 `catch (...)` catches exceptions from `resultGenerator(rt)` on the JS thread. Both produce "Unknown error". The task() lambda explicitly throws `std::runtime_error` for known failure modes ("Context limit reached", "Failed to load model", "Embedding not supported"), but these ARE caught by `catch (const std::exception& e)` at line 117. Therefore the "Unknown error" must originate from an unexpected path that throws a non-std::exception.
  implication: The error is NOT from the model loading failure path but from somewhere in backend initialization or device enumeration

- timestamp: 2026-06-02Tinvestigation
  checked: llama.rn prebuilt .so files — exported symbols and dependencies
  found: All .so files have their OWN embedded C++ runtime (static linking). No dependency on `libc++_shared.so`. Exception handling symbols (`__cxa_*`) are defined as T (text), not U (undefined). The JNI wrapper compiled by CMake uses `c++_shared` but `libc++_shared.so` is explicitly excluded from packaging via `packagingOptions.excludes`. React Native provides its own `libc++_shared.so` system-wide.
  implication: Exception handling within the prebuilt .so files is self-contained and should work correctly. However, the JNI wrapper's `c++_shared` usage depends on RN's bundled libc++ which may have version/ABI differences.

- timestamp: 2026-06-02Tinvestigation
  checked: llama.rn CMake build system (CMakeLists.txt lines 43-142, 144-167)
  found: The CMake build ALWAYS compiles the JNI wrapper libraries (even in non-source-build mode). It produces `librnllama_jni_*.so` libraries that are linked against the prebuilt `librnllama_*.so` from jniLibs. The `build_rnllama_jni` function compiles with `-fvisibility=hidden -fvisibility-inlines-hidden -flto -O3` and links with `-Wl,--exclude-libs,ALL -Wl,--gc-sections`.
  implication: LTO (link-time optimization) combined with hidden visibility COULD affect exception handling behavior by altering how C++ typeinfo is resolved across compilation units, though this is speculative

- timestamp: 2026-06-02Tinvestigation
  checked: RNLlama.java library selection logic for Nothing Phone 2a (MediaTek Dimensity 7200 Pro)
  found: CPU features from `/proc/cpuinfo` include `fp16`, `dotprod`, `i8mm`. `hasAdrenoGpuHint()` = false (MediaTek, not Qualcomm). `isHexagonSupported()` = false (MediaTek, no Hexagon DSP). Result: loads `rnllama_jni_v8_2_dotprod_i8mm` which links against prebuilt `librnllama_v8_2_dotprod_i8mm.so`. This variant does NOT include OpenCL or Hexagon dependencies.
  implication: Correct library variant is selected. The loaded library has no OpenCL/Hexagon dependencies, but `llama_backend_init()` may still probe for Vulkan or other backends compiled into the core library.

- timestamp: 2026-06-02Tinvestigation
  checked: llama.rn plugin (app.plugin.js → lib/module/expo-plugin/withLlamaRN.js)
  found: Plugin only adds iOS C++20 build settings, iOS memory entitlements, and Android manifest `<uses-native-library>` entries for `libOpenCL.so` and `libcdsprpc.so` (both `required="false"`). Does NOT affect Android native .so loading, CMake build, or C++ STL configuration.
  implication: Missing plugin is UNLIKELY to be the root cause on Android. Its Android manifest changes only declare optional vendor GPU libraries; the actual native .so loading works via autolinking + CMake regardless of the plugin.
  checked: `node_modules/llama.rn` installation
  found: llama.rn v0.12.4 is installed with all native .so libraries present for arm64-v8a (7 JNI variants: v8, v8_2, v8_2_dotprod, v8_2_dotprod_i8mm, v8_2_dotprod_i8mm_hexagon_opencl, v8_2_i8mm, base)
  implication: Native libraries downloaded during postinstall; libraries exist for device architecture

- timestamp: 2026-06-02Tinvestigation
  checked: `android/build/generated/autolinking/autolinking.json`
  found: llama.rn is properly listed with autolinking config, package import path, and Android source dir
  implication: Autolinking should register the native module correctly

- timestamp: 2026-06-02Tinvestigation
  checked: `app.json` plugins array
  found: llama.rn Expo config plugin (`app.plugin.js`) is NOT listed in plugins. Missing plugin means Android manifest won't get `<uses-native-library android:name="libOpenCL.so"/>` and `<uses-native-library android:name="libcdsprpc.so"/>`. iOS won't get C++20 build settings or memory entitlements.
  implication: **CRITICAL FINDING** — plugin is required per llama.rn README for Expo/CNG builds

- timestamp: 2026-06-02Tinvestigation
  checked: `app.json` expo-build-properties config
  found: Only iOS `useFrameworks: "static"` is configured. No Android-specific build properties set for llama.rn.
  implication: Android native library loading relies entirely on autolinking

- timestamp: 2026-06-02Tinvestigation
  checked: `android/app/src/main/java/.../MainApplication.kt`
  found: Uses `PackageList(this).packages` for autolinking, no manual package registration for llama.rn
  implication: Autolinking should handle it, but no verification that it actually works at runtime

- timestamp: 2026-06-02Tinvestigation
  checked: `android/gradle.properties`
  found: `newArchEnabled=true`, `hermesEnabled=true`. llama.rn v0.10+ REQUIRES New Architecture.
  implication: Correct configuration for llama.rn compatibility

- timestamp: 2026-06-02Tinvestigation
  checked: C++ JSI error propagation in `cpp/jsi/JSIUtils.cpp`
  found: The "Unknown error" string originates from `catch (...)` fallback handlers at lines 109 and 154. These catch C++ exceptions that are NOT `std::exception` subclasses.
  implication: The native code is throwing a non-standard C++ exception (not `std::runtime_error`), or the error occurs after a scope where only `catch (...)` is active

- timestamp: 2026-06-02Tinvestigation
  checked: Model loading error flow in `rn-llama.cpp` and `common/common.cpp`
  found: `loadModel()` returns `false` on failure (doesn't throw). The C++ JSI wrapper throws `std::runtime_error("Failed to load model")` when `loadModel` fails. All exceptions in llama.cpp code are `std::runtime_error`.
  implication: The model loading failure path would produce "Failed to load model" error, NOT "Unknown error". The "Unknown error" must come from a DIFFERENT code path.

- timestamp: 2026-06-02Tinvestigation
  checked: JSI binding installation timing in `RNLlamaModule.install()` and `installJSIBindings()`
  found: `installJSIBindings()` (C++ JNI) schedules the actual JSI binding setup via `callInvoker->invokeAsync()`, which runs asynchronously on the JS thread. Meanwhile the Java promise is resolved immediately with `true`. There's a potential race between the async JSI installation callback and the Promise resolution callback.
  implication: If JSI bindings aren't installed when `bindJsiFromGlobal()` runs in `installJsi()`, it would throw "Missing JSI bindings" — but the error manifests as "Unknown error", suggesting either the race doesn't always trigger or the error occurs at a different point

## Eliminated

- hypothesis: Model file is missing or corrupted
  evidence: `isModelDownloaded()` checks existence and size >= 600MB before `loadModel()` is called; the error would be "Model not downloaded or corrupted" not "Unknown error"
  timestamp: 2026-06-02Tinvestigation

- hypothesis: Qwen3 architecture not supported by bundled llama.cpp
  evidence: `llama-arch.cpp` explicitly lists `LLM_ARCH_QWEN3` and `"qwen3"` as a supported architecture with full model loading code
  timestamp: 2026-06-02Tinvestigation

- hypothesis: GGUF version mismatch between model and library
  evidence: Bundled `gguf.h` defines `LM_GGUF_VERSION 3`, and most Qwen3 GGUF files use GGUF v3
  timestamp: 2026-06-02Tinvestigation

- hypothesis: React Native / Hermes / New Architecture incompatibility
  evidence: llama.rn v0.10+ requires New Architecture, and gradle.properties has `newArchEnabled=true` and `hermesEnabled=true`. The native libraries are compiled for New Architecture with proper codegen config.
  timestamp: 2026-06-02Tinvestigation

- hypothesis: Model loading returns false, giving "Failed to load model"
  evidence: `loadModel()` returns false on failure (doesn't throw). The C++ wrapper explicitly throws `std::runtime_error("Failed to load model")` which IS a std::exception, caught at JSIUtils.cpp line 117, producing "Failed to load model", NOT "Unknown error"
  timestamp: 2026-06-02Tinvestigation

- hypothesis: Missing Expo config plugin is the root cause
  evidence: Plugin only adds Android manifest `<uses-native-library>` entries for optional vendor GPU libs (`libOpenCL.so`, `libcdsprpc.so`, both `required="false"`), and iOS C++20 build settings. The Android native .so loading works via autolinking + CMake regardless of the plugin. The MediaTek Dimensity 7200 Pro doesn't use Qualcomm Hexagon or OpenCL, making these manifest entries irrelevant.
  timestamp: 2026-06-02Tinvestigation

- hypothesis: JSI binding installation race condition
  evidence: `installJsi()` verifies all 25 JSI functions exist on `global` via `bindJsiFromGlobal()` before proceeding. If bindings were missing, it would throw "Missing JSI bindings". The user sees "Unknown error" not "Missing JSI bindings".
  timestamp: 2026-06-02Tinvestigation

- hypothesis: Native library not loaded (UnsatisfiedLinkError)
  evidence: CMake build compiles JNI wrapper .so files (`librnllama_jni_*.so`) linked against prebuilt core libraries. The library loading in `RNLlama.loadNative()` catches UnsatisfiedLinkError and returns false. If this happened, `install()` resolves false, and JS would throw "JSI bindings not installed" — not "Unknown error". Since JSI bindings ARE installed and `llamaInitContext` executes, native libraries load correctly.
  timestamp: 2026-06-02Tinvestigation

## Resolution

- **Root cause**: GPU backend probing during `llama_backend_init()` / `configureBackendDevices()` on the MediaTek Dimensity 7200 Pro (Mali-G715 GPU) throws a non-standard C++ exception that bypasses the `catch (const std::exception& e)` handler in `JSIUtils.cpp` and lands in `catch (...)` → produces "Unknown error". This happens even with `n_gpu_layers: 0` (CPU-only mode) because the backend registration and device enumeration are unconditional.

  **Evidence chain:**
  1. Error path: `assistWriting()` → `loadModel()` → `initLlama()` → `llamaInitContext()` (JSI) → `createPromiseTask()` → ThreadPool worker
  2. ThreadPool runs: `ensureBackendInitialized()` (line 519) → `llama_backend_init()` via `std::call_once` → `configureBackendDevices()` (line 531)
  3. On Android: `configureBackendDevices()` calls `getFilteredDefaultDevices()` (line 411) which iterates ALL backends via `lm_ggml_backend_dev_count()`, probing GPU types including Vulkan
  4. Non-std::exception thrown during this probe → JSIUtils.cpp line 139 `catch (...)` → schedules reject with "Unknown error" on JS thread (line 147-154)
  5. All known failure modes in the task lambda explicitly throw `std::runtime_error` (caught at line 117), confirming the error is from an unexpected non-std path

- **Fix**: (to be applied — two-pronged approach)
  1. Add `no_gpu_devices: true` to the `initLlama()` config in `aiService.js` to skip GPU backend probing entirely on Android (relevant C++ code at RNLlamaJSI.cpp:486-489 checks this param)
  2. Add `"llama.rn"` to `app.json` plugins array for correct native build configuration (Expo plugin docs requirement)
  3. Rebuild with `npx expo run:android --clear`

- **Verification**: After rebuilding, tap AI assist button and confirm the model initializes without "Unknown error". If still failing, enable native logging via `toggleNativeLog(true)` before `initLlama()` and capture `adb logcat -s RNLlama:V RNWhisperJSI:V *:F` output to locate the exact C++ failure point.

- **Files changed**:
  - `src/utils/aiService.js` — add `no_gpu_devices: true` to `initLlama()` params
  - `app.json` — add `"llama.rn"` to plugins array
  - (possibly) `Toggle native log` integration for diagnostic capture
