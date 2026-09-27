# Phase 18 Validation: On-Device AI Pipeline Hardening

**Phase:** 18 of 19  
**Status:** In Planning  
**Validation Suite:** `__tests__/unit/aiService.test.js`

---

## 1. Automated Validation Gates

### Test Execution
```bash
npx jest __tests__/unit/aiService.test.js
npm test
npm run lint
```

### Coverage Criteria
- All 10 test suites must pass 100%.
- ESLint must report 0 errors.

---

## 2. Test Cases & Verification Matrix

| Test Case | Method / Component | Expected Behavior |
|-----------|-------------------|-------------------|
| **TC-AI-01** | `MODEL_DOWNLOAD_URL` | Contains immutable commit hash `9217f5db79a29953eb74d5343926648285ec7e67` |
| **TC-AI-02** | `verifyModelIntegrity` | Returns `true` when model file size equals `491,400,032` bytes |
| **TC-AI-03** | `verifyModelIntegrity` (Corrupted) | Returns `false`, deletes corrupted file from filesystem, logs warning |
| **TC-AI-04** | `loadModel` (Mutex) | Concurrent calls coalesce into a single initialization promise; `initLlama` called once |
| **TC-AI-05** | `unloadModel` | Calls `releaseAllLlama()`, resets internal context pointer to `null` |
| **TC-AI-06** | `AppState` Listener | Automatically invokes `unloadModel()` when app changes to `background` or `inactive` |
| **TC-AI-07** | `extractTasksFromNote` (Fallback) | Returns extracted tasks from markdown checklist items (`- [ ]`, `TODO:`, action verbs) when LLM throws |
| **TC-AI-08** | `summarizeNote` (Fallback) | Generates structured bulleted summary from headers and paragraphs when LLM throws |
| **TC-AI-09** | `parseGlobalCommand` (Fallback) | Accurately extracts task, birthday, or transaction without throwing when LLM fails |
| **TC-AI-10** | `AIAssistant` (Lifecycle) | Triggers `unloadModel()` on component unmount to free RAM |

---

## 3. Failure Mode Recovery

1. **Partial Download:** If a download is cancelled halfway (e.g. 200MB written), `verifyModelIntegrity` identifies size mismatch, deletes the corrupted file, and prevents native crash.
2. **Native OOM Crash Prevention:** Native `releaseAllLlama()` is invoked whenever the app goes to the background, preventing Android Low Memory Killer (LMK) from terminating the app.
3. **Inference Exception:** When native C++ llama throws an error during inference, functions catch the error, reset `_llamaContext = null`, and seamlessly return heuristic fallback output without failing user actions.
