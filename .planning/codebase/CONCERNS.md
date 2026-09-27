# Concerns

**Analysis Date:** 2026-09-28

> Milestone 2 is 95% complete — Phase 18 complete (commit `888d86b`), Phase 19 next. All 10 test suites (138 tests) passing; zero lint errors.

## Resolved Concerns in Milestone 2

- **✅ RESOLVED (Phase 18) — AI model unpinned release & OOM crashes (`AI-01`, `AI-02`):**
  - Model download pinned to immutable Hugging Face commit `9217f5db79a29953eb74d5343926648285ec7e67`, exact size `491400032` bytes, SHA-256 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`.
  - Corrupted downloads purged automatically before loading.
  - Coalescing Promise mutex lock prevents parallel initialization races.
  - Active memory lifecycle: `handleAppStateChange` auto-unloads on `background`/`inactive`, 5-minute idle timeout with timer unref, and component unmount cleanup in `AIAssistant.js`.
  - Deterministic rule-based fallback pipeline (`extractTasksFromNoteHeuristic`, `summarizeNoteHeuristic`, regex command parser) ensures continuous offline availability.
- **✅ RESOLVED (Phase 17) — Shared task mutation & recurrence layer (`ARCH-02`):**
  - Pure, framework-agnostic `src/utils/taskMutations.js` shared between `TaskContext.js` and `widgets/widget-task-handler.tsx`.
  - Recurrence spawning logic consolidated into a single source of truth.
  - `AppState` foreground sync reconciles headless widget writes with in-memory state.
- **✅ RESOLVED (Phase 16) — Backup encryption & LAN sync hardening (`SEC-01`, `SEC-02`, `STORE-01`):**
  - AES-256 v2 backup envelope with per-archive random salt/IV and PBKDF2 100k iterations.
  - Strict LAN sync IP/port/token validation and response schema verification.
  - Dynamic `STORAGE_VERSION` key management preserving telemetry and AI downloads.
- **✅ RESOLVED (Phase 15) — Local calendar date authority (`DATE-01`, `DATE-02`):**
  - `src/utils/dateUtils.js` eliminates UTC date slicing and midnight negative timezone shifts.
- **✅ RESOLVED (Phase 14) — Automated test infrastructure & CI (`TEST-01`, `TEST-02`, `TEST-03`):**
  - Jest 29 test harness, `jest-expo/android` preset, comprehensive native mocks, GitHub Actions CI gate.

---

## Remaining Tech Debt & Concerns (Prioritized for Phase 19 & Beyond)

**1. Verbose emoji console logging in production builds (`OBS-01` — Phase 19 priority).**
- Files: `src/utils/storage.js`, `src/utils/exportService.js`, `src/utils/syncService.js`, `src/utils/aiService.js`, `src/context/*.js`, `App.js`.
- Issue: Over 150+ emoji-prefixed `console.log` / `console.warn` statements are executed during normal operation. In production release builds, these leak operational details to Android logcat and consume runtime cycles.
- Impact: Security posture, log pollution, slight rendering overhead on low-end devices.
- Planned Solution: In Phase 19, implement an environment-aware logger and Babel plugin (`transform-remove-console` or conditional wrapper) that silences debug logs in production builds while preserving critical error telemetry.

**2. Missing root error boundary & crash diagnostics (`OBS-02` — Phase 19 priority).**
- Files: `App.js`, `index.js`.
- Issue: Currently, uncaught React render errors or component exceptions can crash the app to the home screen without a user-friendly recovery UI.
- Impact: Unhandled runtime errors cause abrupt process termination with no diagnostic state preservation.
- Planned Solution: In Phase 19, wrap the root provider tree in an Error Boundary component that renders a graceful recovery screen with options to restart the app or export diagnostics.

**3. Transitive state coupling: Screen prop fan-out vs direct context consumption.**
- Files: `App.js`, `src/navigation/AppNavigator.js`, `src/screens/*.js`.
- Issue: While domain contexts (`TaskContext`, `VaultContext`, `BillingContext`, `BirthdayContext`) are active and provide state to `AppNavigator.js`, screens are still wired via prop callbacks rather than calling `useTasks()`, `useVaults()`, `useBilling()`, `useBirthdays()` directly.
- Impact: Boilerplate prop threading in `AppNavigator.js`.
- Next Steps: In future maintenance, screens can incrementally adopt context hooks directly, deprecating intermediate prop passing.

**4. Oversized screen components.**
- Files: `src/screens/NotesScreen.js` (~2012 lines), `src/screens/SettingsScreen.js` (~1100 lines), `src/components/AIAssistant.js` (~1090 lines).
- Issue: Screen files combine UI layout, inline modals, and specialized user interactions in large single files.
- Impact: Reduced developer ergonomics during targeted modifications.
- Mitigation: Logic is isolated into helper services (`fileStorage.js`, `vaultService.js`, `aiService.js`); avoid unnecessary screen splitting unless actively refactoring screen features.

**5. Dual ESLint configuration files.**
- Files: `.eslintrc.js` (legacy format) and `eslint.config.js` (flat config).
- Issue: Two configuration files exist simultaneously to accommodate both modern flat-config runners and legacy IDE plugins.
- Impact: Rule changes must be synchronized across both files.
- Mitigation: Both files are verified and produce identical zero-error results in `npm run lint`.

**6. Release APK artifact in repository history.**
- Files: `build/kwestup-v3.0.1.apk`.
- Issue: Pre-built binary from prior releases remains committed in `build/`.
- Impact: Repository clone size is slightly larger than necessary.
- Next Steps: Remove binary from git tracking and publish releases strictly via GitHub Release artifacts or EAS.
