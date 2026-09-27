# Phase 18 Research: On-Device AI Pipeline Hardening

**Phase:** 18 of 19  
**Domain:** `llama.rn`, On-Device AI Inference, Cryptographic Verification, Memory Lifecycle  
**Date:** 2026-09-28

---

## 1. Upstream Model Release & Integrity Specifications

### Hugging Face Endpoint Investigation
- **Repository:** `Qwen/Qwen2.5-0.5B-Instruct-GGUF`
- **File:** `qwen2.5-0.5b-instruct-q4_k_m.gguf`
- **Git LFS Pointer Data:**
  ```text
  version https://git-lfs.github.com/spec/v1
  oid sha256:74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db
  size 491400032
  ```
- **Hugging Face API Commit Hash:** `9217f5db79a29953eb74d5343926648285ec7e67`
- **Pinned Download URL:**
  `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf`
- **HTTP Verification:** Verified via HTTP HEAD request returning `HTTP 200 OK`, `Content-Length: 491400032`, and `X-Linked-ETag: "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db"`.

---

## 2. Technical Findings & Architectural Decisions

### Hermes Memory Limits & Checksum Verification
- **Hermes Buffer Constraint:** Attempting to read a 491 MB file into memory via `FileSystem.readAsStringAsync` in React Native Hermes causes an Out-Of-Memory crash because Hermes enforces heap/string length caps (~50-100 MB).
- **Multi-Tiered Integrity Verification Strategy:**
  1. **Strict Exact Size Check ($O(1)$ Native FileSystem):** `fileInfo.size === 491400032`. Any truncated download (e.g. 450 MB or 480 MB) is immediately caught without crossing the JS bridge or consuming heap memory.
  2. **SHA-256 Verification Utility:** Export a standalone `computeSha256(data)` function backed by `crypto-js/sha256` for string/buffer verification, and allow `verifyModelIntegrity` to accept mock/custom checksum validators for testing.
  3. **Automatic Cleanup on Integrity Failure:** If a file exists but fails verification, automatically remove it via `FileSystem.deleteAsync` so the user is prompted to cleanly re-download rather than crashing native C++ `llama.cpp`.

### Concurrency Mutex Pattern: Promise-Based Queue
- **Problem:** Currently `loadModel` uses a spin-wait loop:
  ```javascript
  while (_isInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  ```
- **Solution:** Replace with a Promise-based lock:
  ```javascript
  let _llamaContext = null;
  let _initPromise = null;

  export const loadModel = async () => {
    if (_llamaContext) return _llamaContext;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      try {
        await verifyModelIntegrity();
        _llamaContext = await initLlama({ ... });
        return _llamaContext;
      } finally {
        _initPromise = null;
      }
    })();

    return _initPromise;
  };
  ```
  This guarantees that concurrent callers await the exact same promise without polling.

### Context Memory Lifecycle Management
- **Background Release:** When KwestUp goes to the background (`AppState === 'background' || AppState === 'inactive'`), device memory is at highest risk of OS termination (LMK - Low Memory Killer). Calling `unloadModel()` (`releaseAllLlama()`) instantly frees ~500 MB of native RAM.
- **Component Lifecycle:** `AIAssistant` modal should trigger `unloadModel()` on component unmount via React's `useEffect` cleanup.
- **Idle Timeout:** Automatically schedule a 5-minute inactivity timer that releases the context if no inference requests are dispatched.

### Resilient Fallback Extraction Pipeline
- **Heuristic Task Extraction (`extractTasksFromNote`):**
  - If model is not downloaded or inference throws, parse note markdown:
    - Checklist items: `/^[\s-]*\[[ xX]?\]\s*(.+)$/gm`
    - TODO statements: `/^[\s-]*TODO:\s*(.+)$/gmi`
    - Action item bullets: `/^[\s-]*[-*+]\s+(?:Buy|Call|Send|Check|Review|Fix|Update|Create|Email|Prepare|Submit|Meet|Finish|Pay|Read|Write)\b\s*(.+)$/gmi`
- **Heuristic Summarization (`summarizeNote`):**
  - Extract document title / top markdown headers (`#`, `##`).
  - Extract first sentence of each paragraph.
  - Format as clean bullet points (`• Header: Summary sentence`).
- **Date Handling in Global Command (`parseGlobalCommand`):**
  - Replace UTC `new Date()` with local date calculations via `dateUtils.js`.

---

## 3. Test Strategy
- Unit test suite `__tests__/unit/aiService.test.js`:
  - Verify model configuration constants (`MODEL_PINNED_COMMIT`, `MODEL_EXPECTED_SHA256`, `MODEL_EXPECTED_SIZE`).
  - Verify `verifyModelIntegrity` passes with exact size and fails/cleans up on size mismatch.
  - Verify `loadModel` mutex handles concurrent calls without duplicate `initLlama` execution.
  - Verify `unloadModel` calls `releaseAllLlama` and clears `_llamaContext`.
  - Verify `extractTasksFromNote` fallback parses markdown checklists and action items when `initLlama` is rejected.
  - Verify `summarizeNote` fallback generates bullet points from markdown text.
  - Verify `parseGlobalCommand` fallback handles tasks, birthdays, and transactions.
