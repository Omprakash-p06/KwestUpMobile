---
slug: remaining-phases-codemap-audit
status: resolved
trigger: User-requested audit to make sure remaining phases (17, 18, 19) work based on codemap documents in .planning/codebase/
created: 2026-09-27
---

# Remaining Phases vs. Codemap Audit

## 1. Executive Summary

This audit compares the remaining roadmap phases (**Phase 17**, **Phase 18**, **Phase 19**) against the 7 architectural codemap documents in `.planning/codebase/`:
- `ARCHITECTURE.md`
- `CONCERNS.md`
- `CONVENTIONS.md`
- `INTEGRATIONS.md`
- `STACK.md`
- `STRUCTURE.md`
- `TESTING.md`

### Audit Outcome: **ALIGNED & VIABLE**
All three remaining phases directly target and resolve specific architectural bottlenecks and technical debt documented in `.planning/codebase/`. Below are the verified technical contracts, critical implementation boundaries, and potential failure modes.

---

## 2. Phase 17: State Architecture & Unified Mutation Layer

### Requirements: `ARCH-01`, `ARCH-02`

### Codemap References:
- `ARCHITECTURE.md`: Monolithic state container (`App.js`), ~50 pieces of context prop-drilled through `AppNavigator.js` into 9 screens.
- `CONCERNS.md`: "Root `App.js` is a state monolith" (lines 13-17); "Recurrence / toggle logic is duplicated across app and widget" (lines 19-24).

### Key Architectural Findings & Constraints:
1. **Background Headless Execution Constraint (Critical)**:
   - `widgets/widget-task-handler.tsx` executes within Android's `react-native-android-widget` background headless task.
   - It **cannot** consume React Hooks, React Context, or component state.
   - **Resolution**: The unified mutation layer must be a **pure JavaScript / TypeScript module** (e.g., `src/utils/taskMutations.js`) containing pure reducer-like functions:
     - `applyTaskToggle(tasks, taskId, now, todayDate)`
     - `spawnNextRecurrence(task, now)`
     - `applyTaskCompletion(tasks, taskId, now, todayDate)`
   - Both `App.js` (or domain context) and `widgets/widget-task-handler.tsx` will import from this single authoritative pure module.

2. **App-Widget Storage Desync**:
   - When a widget toggles a task, it writes directly to `AsyncStorage`.
   - `App.js` in-memory state is unaware until the app is backgrounded and re-opened.
   - **Resolution**: Add an explicit foreground synchronization check (`AppState.addEventListener('change', ...)`) and storage event or reload helper in `TaskContext` so returning to the app immediately re-synchronizes with `AsyncStorage`.

3. **Incremental Context Decomposition**:
   - Rather than a risky single-pass rewrite of `App.js`, decouple state into domain providers:
     - `TaskProvider` (`tasks`, `taskLists`, toggle, recurrence, delete)
     - `VaultProvider` (`vaults`, `activeVaultId`, note filesystem operations)
     - `BillingProvider` (`transactions`, `budgets`, `bills`)
     - `BirthdayProvider` (`birthdays`, notification rescheduling)
   - Screens consume these providers via custom hooks (`useTasks`, `useVaults`), eliminating ~50 prop-drilled arguments from `AppNavigator.js`.

---

## 3. Phase 18: On-Device AI Pipeline Hardening

### Requirements: `AI-01`, `AI-02`

### Codemap References:
- `INTEGRATIONS.md`: Qwen2.5-0.5B GGUF (~468MB, CPU-only), unpinned HuggingFace download URL (`resolve/main`).
- `CONCERNS.md`: "No integrity verification of the downloaded on-device AI model" (lines 77-81); "On-device LLM model is a 468MB download with heavy retry/resume state" (lines 91-96).

### Key Architectural Findings & Constraints:
1. **Model Immutability & Checksum Strategy**:
   - Downloading from `resolve/main` risks upstream file modifications breaking inference.
   - **Resolution**: Pin download URL to an exact commit tag or SHA on HuggingFace.
   - **Mobile Memory Caution**: Reading a 468MB file into JavaScript memory via `CryptoJS.SHA256` will trigger a native JavaScript heap Out-Of-Memory (OOM) crash on Android.
   - **Resolution**: Use `FileSystem.getInfoAsync(MODEL_PATH, { md5: true })` which executes natively in C++/Java without loading the file into the JS runtime, combined with strict byte length validation (`491,400,032` bytes).

2. **Memory Lifecycle Management**:
   - `llama.rn` allocates native heap memory for weights and KV context (`n_ctx: 2048`).
   - If not unloaded, backgrounding or navigating away can cause OS process termination on low-RAM devices.
   - **Resolution**: Enforce automatic unloading (`releaseAllLlama()`) in `AIAssistant.js` cleanup on unmount, and expose an explicit `freeMemory()` API in `src/utils/aiService.js`.

3. **Structured Offline Fallback**:
   - When the model is downloading, missing, or fails to initialize, features must gracefully fallback to deterministic rule-based algorithms (`summarizeNoteFallback`, `extractTasksFromNoteFallback`) already prototyped in `aiService.js`.

---

## 4. Phase 19: Production Observability & Logging Cleanup

### Requirements: `OBS-01`, `OBS-02`

### Codemap References:
- `CONCERNS.md`: "Extensive defensive `console.*` logging left enabled" (lines 83-87). Over 100 debug emoji log callsites.
- `CONVENTIONS.md`: `no-console: warn` in ESLint; debug logs retained in release APKs.
- `INTEGRATIONS.md`: "Monitoring & Observability: Error tracking: None (no Sentry/Datadog)... Logs: console.* only."

### Key Architectural Findings & Constraints:
1. **Production Log Stripping**:
   - Emoji debug logs (`console.log("📂 Notes/Vaults/ directory initialized")`) clutter logcat and consume cycles.
   - **Resolution**: Introduce `src/utils/logger.js` that checks `__DEV__`. In release builds, `logger.debug` and `logger.log` are no-ops.
   - Use `babel-plugin-transform-remove-console` in `babel.config.js` with `exclude: ['error', 'warn']` for production builds.

2. **Crash Resilience (Root Error Boundary)**:
   - React 19 unhandled render errors crash the entire native application.
   - **Resolution**: Wrap the root navigator in `App.js` with an `ErrorBoundary` that catches render exceptions and provides a recovery UI:
     - Clear transient UI caches (`clearAllCaches()`)
     - Reload app state cleanly without user data loss.

---

## 5. Verification Checklist

- [x] Phase 17 matches `ARCHITECTURE.md` and `CONCERNS.md` (decouples `App.js`, unifies task mutations between app and headless widgets).
- [x] Phase 18 matches `INTEGRATIONS.md` and `CONCERNS.md` (pins model commit, verifies integrity natively without JS OOM, manages `llama.rn` RAM lifecycle).
- [x] Phase 19 matches `CONVENTIONS.md` and `CONCERNS.md` (strips emoji logs in production, adds root crash boundary).
- [x] Stale sections in `.planning/codebase/CONCERNS.md` and `TESTING.md` updated to reflect Milestone 2 progress (Phases 14, 15, and 16).
