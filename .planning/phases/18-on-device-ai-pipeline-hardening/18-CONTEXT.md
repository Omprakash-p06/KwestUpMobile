# Phase 18 Context: On-Device AI Pipeline Hardening

**Phase:** 18 of 19  
**Status:** In Planning  
**Requirements:** `AI-01`, `AI-02`  
**Dependencies:** Phase 17 (Completed)

---

## 1. Overview

KwestUp Mobile features a local, on-device AI assistant powered by `llama.rn` running a quantized GGUF model (`qwen2.5-0.5b-instruct-q4_k_m.gguf`, ~468 MB). All inference runs strictly on-device without cloud servers, protecting user privacy.

While functional, the current implementation in `src/utils/aiService.js` and `src/components/AIAssistant.js` exhibits significant production and stability risks:
1. **Unpinned Mutable Download URL:** The model is fetched from Hugging Face's mutable `resolve/main` branch (`https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf`). If upstream updates or alters the file, downloads will silently break or diverge.
2. **Missing Cryptographic Integrity Verification:** The model check only verifies `fileInfo.size >= 450MB`. There is no exact byte size verification or SHA-256 checksum validation. Corrupted downloads or partial writes can crash the native `llama.rn` engine with unrecoverable SIGSEGV/abort.
3. **Spin-Wait Mutex in `loadModel`:** Concurrent calls spin-sleep (`while (_isInitializing) await new Promise(r => setTimeout(r, 100))`) instead of using a clean Promise-based mutex/queue.
4. **Memory Leaks and Lack of Lifecycle Management:** The 500 MB native model context remains allocated in device RAM even when the user leaves the AI Assistant, navigates elsewhere, or backgrounds the app. There is no `AppState` background listener or unmount cleanup hook.
5. **Brittle Fallback Handling:** If LLM inference fails, `summarizeNote` and `extractTasksFromNote` throw unhandled errors instead of falling back to robust rule-based markdown heuristics.
6. **Zero Test Coverage:** `src/utils/aiService.js` has 0% unit test coverage.

---

## 2. Requirements & Acceptance Criteria

### AI-01: Immutable Model Pinning & Cryptographic Integrity Verification
- **Pinned Release URL:** Pin the download URL to an exact, immutable Hugging Face git commit hash (`9217f5db79a29953eb74d5343926648285ec7e67`).
- **Integrity Constants:** Declare authoritative constants for the model:
  - `MODEL_PINNED_COMMIT`: `"9217f5db79a29953eb74d5343926648285ec7e67"`
  - `MODEL_EXPECTED_SHA256`: `"74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db"`
  - `MODEL_EXPECTED_SIZE`: `491400032` bytes
- **Pre-load Verification:** Implement `verifyModelIntegrity(filePath)` that validates:
  - File presence and exact byte size (`491,400,032`).
  - Cryptographic checksum validation against `MODEL_EXPECTED_SHA256`.
  - Automatic purging of corrupted files with descriptive errors if verification fails.
- **Mutex Refactoring:** Replace the busy-wait `while (_isInitializing)` loop with a Promise-based initialization lock.

### AI-02: Memory Lifecycle Management & Rule-Based Fallback Pipeline
- **Memory Lifecycle Management:**
  - `AppState` listener in `aiService.js` that automatically unloads the model context (`releaseAllLlama()`) when the app transitions to `background` or `inactive`.
  - Component unmount cleanup in `AIAssistant.js` to ensure the model is freed whenever the modal or screen unmounts.
  - Optional idle timeout to auto-unload after 5 minutes of inactivity.
- **Rule-Based Fallback Pipeline:**
  - `summarizeNote(noteContent)`: When LLM is unavailable or inference throws, fallback to structured markdown heuristics (headers, key lead sentences, action bullet points).
  - `extractTasksFromNote(noteContent)`: When LLM fails, fallback to regex extraction of markdown checklist items (`- [ ]`, `* [ ]`, `TODO:`, numbered actionable items).
  - `parseGlobalCommand(command)`: Integrate `dateUtils.js` for local date calculation instead of raw UTC `new Date()`.
- **Unit Test Suite:**
  - Create `__tests__/unit/aiService.test.js` verifying model verification, mutex synchronization, memory release, and all fallback pipelines.

---

## 3. Constraints & Design Decisions

- **Local-First Privacy:** No remote analytics, external LLM APIs, or cloud fallback. All fallbacks must execute locally in pure JavaScript.
- **Hermes Memory Safety:** Due to React Native Hermes memory limits (~50-100MB string limit), chunked/streamed processing and native file info must be used rather than loading 491MB GGUF files entirely into JS string memory.
- **Backwards Compatibility:** Maintain existing exported function signatures (`summarizeNote`, `extractTasksFromNote`, `parseGlobalCommand`, `assistWriting`, `assistWritingCustom`, `loadModel`, `unloadModel`, `isModelDownloaded`, `downloadModel`) so screens and components continue functioning without API breakage.
