---
slug: phase-plans-codemap-audit
status: resolved
trigger: make sure all the plans for each phase are made with respect to the codebase map in ./planning/codebase/
created: 2026-10-04
---

# Phase Plans vs. Codebase Map Audit

## 1. Executive Summary

This audit evaluates all phase specifications and plans across the KwestUp project against the refreshed 7 architectural codebase map documents in `.planning/codebase/` (dated 2026-10-01):
- `ARCHITECTURE.md`
- `CONCERNS.md`
- `CONVENTIONS.md`
- `INTEGRATIONS.md`
- `STACK.md`
- `STRUCTURE.md`
- `TESTING.md`

### Core Audit Outcomes:
1. **Existing Baseline Verified**: All 13 unit test suites pass (180 tests passing, 0 failures), TypeScript typecheck passes (`tsc --noEmit`), and ESLint passes (0 errors).
2. **Syntax Discrepancy Remediated**: A syntax/declaration error in `src/screens/DashboardScreen.js` (missing `const getDailyCompletions = (tasks) => {` header accidentally deleted during a previous merge) was identified and restored, ensuring `npm run typecheck` passes cleanly.
3. **Completed Phases Verified & Synchronized**: Phases 14 through 20 are fully executed and validated. `ROADMAP.md`'s progress table (which had stale `⏳ Pending` markers for Phases 16–19 and omitted Phase 20) and `REQUIREMENTS.md` (which had `GOV-01`/`GOV-02` marked pending) have been synchronized with the actual codebase map.
4. **Milestone 3 (Phases 21–28) Technical Alignment**: All future roadmap phases have been audited against specific architectural constraints, technical debt, and contracts defined in `.planning/codebase/`. Explicit plan breakdowns and technical contracts have been established for each phase.

---

## 2. Completed Phases (Phases 14–20) vs. Codebase Map

| Phase | Plans | Codebase Reality & Verification | Tech Debt / Follow-ups in Codemap |
|---|---|---|---|
| **Phase 14: Automated Testing & CI/CD** | 14-01, 14-02, 14-03 | Configured Jest 29 (`jest-expo/android`), mock harness (`__tests__/setup/jest.setup.js`), and GitHub Actions CI (`.github/workflows/ci.yml`). | CI currently runs `npm run lint` without `--max-warnings=0` due to 473 pre-existing style/console warnings; Semgrep scan is non-blocking (`continue-on-error: true`). Tracked in `CONCERNS.md`. |
| **Phase 15: Centralized Local Date Engine** | 15-01, 15-02 | Created `src/utils/dateUtils.js`. Eliminated UTC `toISOString().slice(0, 10)` slicing bugs across all screens and widgets. | All boundary and leap-year tests pass in `__tests__/unit/dateUtils.test.js`. Verified. |
| **Phase 16: Security & Storage Hardening** | 16-01, 16-02 | Upgraded backup encryption to v2 (PBKDF2-HMAC-SHA256 100k iterations, random salt/IV) with v1 backward compatibility; secured LAN sync validation; fixed `STORAGE_VERSION` key persistence. | Legacy v1 archives still decryptable via fallback; plaintext-at-rest posture in AsyncStorage documented in `CONCERNS.md` / `rulebook/rules/privacy.md`. |
| **Phase 17: State Architecture & Unified Mutation Layer** | 17-01, 17-02 | Created pure `src/utils/taskMutations.js` shared by `App.js`, `TaskContext.js`, and headless `widgets/widget-task-handler.tsx`. Foreground re-sync on `AppState` change. | Context decomposition completed for Tasks, Vaults, Billing, and Birthdays. |
| **Phase 18: On-Device AI Pipeline Hardening** | 18-01, 18-02 | Pinned Qwen GGUF model commit (`9217f5db...`), SHA-256 integrity validation, native memory lifecycle management (`releaseAllLlama()`), and rule-based fallback. | Model bookkeeping in AsyncStorage can be throttled (tracked in `CONCERNS.md`). |
| **Phase 19: Production Observability & Logging Cleanup** | 19-01, 19-02 | Introduced `src/utils/logger.js` with PII redaction and `__DEV__` gating; build-time log stripping via `babel-plugin-transform-remove-console`; root `ErrorBoundary.js`. | Redaction regex in `logger.js` needs extension in Phase 22 for behavioral keys (`habitTitle|cueText`). |
| **Phase 20: Governance & Architecture Foundation** | 20-01, 20-02 | Established 44-doc `rulebook/` (Markdown philosophy + machine `rulebook/machine/*.json`), foundation directories (`src/behavior/`, `src/commands/`, `src/services/`, `src/domains/`), TypeScript stubs, and CI typecheck gate. | `tsconfig.json` keeps `checkJs: false` and excludes `widgets/**` due to pre-existing JS warnings; phased lift planned for Phase 22 & Phase 25. |

---

## 3. Milestone 3 (Phases 21–28) Architectural Audit & Plan Mapping

### Phase 21: Technology Platform Upgrade (Expo SDK 57, RN 0.86, Node 22)
- **Codemap Anchors**: `STACK.md` §Frameworks, `CONCERNS.md` §Tech Debt ("postinstall native patch script runs unverified"), `TESTING.md` §Run Commands.
- **Critical Technical Constraints**:
  1. `llama.rn 0.12.4` and `react-native-android-widget` require verification under React Native 0.86 / Expo SDK 57. The `patch-llama-gradle.js` postinstall script must be hardened with checksum/idempotency assertions or converted to `patch-package`.
  2. Local test script in `package.json` must drop `--passWithNoTests` to prevent false positive passes.
  3. Ensure Android 16 KB page-size linker flags and `@shopify/react-native-skia 2.0.6` compatibility are preserved.
- **Audited Plans**:
  - `21-01-PLAN.md`: Runtime & Dependency Upgrade (Expo SDK 57, RN 0.86, React 19.2.3, Babel config, and Jest test script cleanup).
  - `21-02-PLAN.md`: Native Module & Postinstall Patch Hardening (`patch-llama-gradle.js` checksum validation, 16KB page-size linker flags, and widget build validation).

### Phase 22: Unified Notification Service & Dispatch Engine
- **Codemap Anchors**: `ARCHITECTURE.md` §Component Responsibilities, `CONCERNS.md` §Known Bugs ("Legacy notification schedulers bypass BehavioralNotificationPolicy"), `CONVENTIONS.md` §Logging.
- **Critical Technical Constraints**:
  1. Consolidate legacy schedulers from `src/utils/notifications.js` and `src/utils/billingNotifications.js` into authoritative `src/services/notificationService.ts`.
  2. Enforce `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` outside the LLM: quiet hours (22:00–08:00), 3 notifications/day cap, 90-min spacing, 30-min dedup window.
  3. Extend `SENSITIVE_KEYS` regex in `src/utils/logger.js` to include `habitTitle|cueText` to protect forensic ring buffers.
  4. Enable phased `checkJs` on `notifications.js` and `billingStorage.js`.
- **Audited Plans**:
  - `22-01-PLAN.md`: Unified `src/services/notificationService.ts` core engine (channels, permissions, and typed descriptors).
  - `22-02-PLAN.md`: Policy gate enforcement, caller migration from `App.js` & contexts, and `logger.js` redaction expansion.

### Phase 23: Domain Event Bus & Behavioral Telemetry
- **Codemap Anchors**: `STRUCTURE.md` §Directory Purposes (`src/behavior/`), `ARCHITECTURE.md` §Three-Layer Intelligence Architecture.
- **Critical Technical Constraints**:
  1. `src/behavior/eventBus.ts` must be a lightweight, in-memory pub/sub bus with typed event interfaces (`BehaviorEvent` from `src/behavior/types.ts`).
  2. Pure task mutations (`taskMutations.js`) and domain context providers emit events (`TASK_CREATED`, `TASK_COMPLETED`, `TASK_MISSED`, `HABIT_COMPLETED`, `WIDGET_ACTION`, `FOCUS_COMPLETED`) without synchronous coupling to behavior engines.
- **Audited Plans**:
  - `23-01-PLAN.md`: In-memory type-safe `eventBus.ts` core and event dispatcher.
  - `23-02-PLAN.md`: Domain mutation instrumentation (tasks, billing, birthdays, focus timer) with unit test coverage.

### Phase 24: Core Behavior & Deterministic Rule Engine
- **Codemap Anchors**: `ARCHITECTURE.md` §Layer 2 (Rule Intelligence), `rulebook/machine/*.json`, `CONCERNS.md` §Security.
- **Critical Technical Constraints**:
  1. Deterministic Rule Engine loads machine rule definitions from `rulebook/machine/*.json` (`habitRules.json`, `recoveryRules.json`, `rewardRules.json`, `rules.json`).
  2. Every state evaluation logs `rulesApplied` audit traces with explicit Rule IDs (`HABIT_CREATE_001`, `MINIMUM_ACTION_001`, `RECOVERY_001`).
  3. Dedicated `HabitContext` with isolated versioned storage keys (`kwestup_habits_v1`, `kwestup_behavior_events_v1`), protected under `isUserDataKey` in `src/utils/storage.js`.
  4. Implements 2-minute minimum action, habit stacking, and "never miss twice" recovery state machines.
- **Audited Plans**:
  - `24-01-PLAN.md`: Pure deterministic rule evaluation engine and machine rule parsers with audit logging.
  - `24-02-PLAN.md`: `HabitContext`, versioned storage persistence, minimum action, and recovery state machines.

### Phase 25: Intervention Engine & Behavioral Home-Screen Widgets
- **Codemap Anchors**: `CONCERNS.md` §Tech Debt ("widgets/ excluded from typecheck"), `ARCHITECTURE.md` §Headless/platform duality.
- **Critical Technical Constraints**:
  1. `widgets/widget-task-handler.tsx` runs in Android headless background; it cannot use React hooks or contexts. Behavioral widget updates must read from pure storage / pure engines.
  2. Fix the 2 `flex` style-type errors in `widgets/TasksListWidget.tsx` and lift the `widgets/**/*` exclusion from `tsconfig.json`.
  3. `interventionEngine.ts` arbitrates across in-app prompts, notifications, and home-screen widgets under `interventionRules.json` anti-spam constraints (`REMINDER_ANTI_SPAM_001`).
- **Audited Plans**:
  - `25-01-PLAN.md`: Multi-surface `interventionEngine.ts` with anti-spam and quiet-hour arbitration.
  - `25-02-PLAN.md`: Behavioral widget renderers (Today, Next Action, Recovery cues) and widget typecheck inclusion.

### Phase 26: Command Gateway, Safe Execution Layer & AI Sandboxing
- **Codemap Anchors**: `ARCHITECTURE.md` §Layer 3 (Execution Intelligence), `CONCERNS.md` §God files (`aiService.js`), `src/commands/types.ts`.
- **Critical Technical Constraints**:
  1. AI model must NEVER directly write to `AsyncStorage`, schedule OS notifications, or modify widgets.
  2. Command Gateway validates command schemas against `src/commands/types.ts` (`commandValidator.ts`), verifies capabilities/permissions, and executes commands safely (`commandExecutor.ts`).
  3. Generates traceable result payloads with echo IDs and applied rule IDs.
- **Audited Plans**:
  - `26-01-PLAN.md`: Command Gateway validation, capability checks, and sandboxed executor.
  - `26-02-PLAN.md`: AI sandboxing layer and command dispatch integration with domain contexts.

### Phase 27: On-Device AI Intent Parser & Behavior Compiler
- **Codemap Anchors**: `ARCHITECTURE.md` §Layer 1 (LLM Intelligence), `INTEGRATIONS.md` §On-device AI model download, `CONCERNS.md` §God files.
- **Critical Technical Constraints**:
  1. Small ~400 MB Qwen model acts solely as an **Intent Parser**, extracting bare semantic facts (`intent`, `behavior`, `frequency`, `anchor`).
  2. **Behavior Compiler** deterministically compiles extracted facts into complete habit plans (identity, minimum <120s action, cue stack, recovery, reward) using the Phase 24 Rule Engine.
  3. Pre-load SHA-256 integrity verification and automated RAM cleanup (`releaseAllLlama()`) on component unmount or backgrounding.
  4. Heuristic rule-based fallback ensures 100% offline availability if model is downloading or inference fails.
- **Audited Plans**:
  - `27-01-PLAN.md`: Specialist Intent Parser module and offline heuristic fallback.
  - `27-02-PLAN.md`: Deterministic Behavior Compiler and llama.rn memory lifecycle management.

### Phase 28: Behavioral Adaptation, Weekly Review & Language Generation
- **Codemap Anchors**: `ARCHITECTURE.md` §Pattern Overview, `4.0/KwestUp_4.0_Master_Plan.md` §M11-M12.
- **Critical Technical Constraints**:
  1. AI operates as **Behavior Analyst** (semantic friction diagnosis from `BehaviorEvent` history) and **Language Generator** (natural-language reflection and plan explanations).
  2. Deterministic rule engine maps identified friction to supported KwestUp interventions without toxic gamification.
  3. Comprehensive end-to-end integration tests covering all critical user flows across `__tests__/`.
- **Audited Plans**:
  - `28-01-PLAN.md`: Behavior Analyst friction diagnosis and Language Generator weekly review engine.
  - `28-02-PLAN.md`: End-to-end test suite hardening, performance validation, and production release sign-off.

---

## 4. Verification & Action Items Completed

- [x] All 7 codebase map files (`ARCHITECTURE.md`, `CONCERNS.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `STACK.md`, `STRUCTURE.md`, `TESTING.md`) audited against current and upcoming phases.
- [x] Syntax error in `src/screens/DashboardScreen.js` fixed and verified (`npm run typecheck` exits 0).
- [x] Jest test suites verified passing 100% (13 suites, 180 tests passing).
- [x] ESLint verified passing (0 errors).
- [x] Stale progress table in `ROADMAP.md` updated with completed phases 16–20 and roadmap phases 21–28.
- [x] `REQUIREMENTS.md` updated with `GOV-01` and `GOV-02` marked complete and traceability synchronized.
