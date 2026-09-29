# Roadmap: KwestUp Mobile

## Overview

The roadmap for KwestUp Mobile transitions the application into a highly performant, local-first productivity workspace. The phases are ordered logically to establish core modules first (Notes, Tasks, Birthdays), implement the Wi-Fi synchronization network next, integrate offline local AI, and finally containerize developer environments.

---

## Phases

- [x] **Phase 1: Notion/Obsidian-style Notes** - Obsidian-style raw `.md` filesystem vault organizer. ✅ COMPLETE
- [x] **Phase 2: Google Tasks-style Task Management** - Build Google Tasks-style Lists with checklists and DB persistence. ✅ COMPLETE
- [x] **Phase 3: Birthday Reminder Module** - Build contact birthday dashboard with countdowns and alerts. ✅ COMPLETE
- [x] **Phase 4: Local Network Sync via QR Scanner** - Two-way Wi-Fi sync between mobile and Electron PC app using QR scanner. ✅ COMPLETE
- [x] **Phase 5: Local On-Device AI Integration** - Host offline LLM on-device for summarization and task generation. ✅ COMPLETE
- [x] **Phase 6: Docker Integration & System Polish** - Developer containerization and visual audits. ✅ COMPLETE
- [x] **Phase 7: Premium Liquid Glass UI Redesign (Skia)** - Dynamic fluid glass layouts using React Native Skia. ✅ COMPLETE
- [x] **Phase 8: Obsidian-Style Note Vaults** - Support separate note vaults and directory importing. ✅ COMPLETE
- [x] **Phase 9: Android Home-Screen Widgets** - Interactive widgets for timer and daily tasks. ✅ COMPLETE
- [x] **Phase 10: Tactile Industrial UI Redesign** - Rebuild visual themes to replicate the high-contrast skeuomorphic industrial console specify in '/UI Design plan'. ✅ COMPLETE
- [x] **Phase 11: Encrypted Data Export & Import** - Support AES-256 encrypted backups of vaults and settings. ✅ COMPLETE
- [x] **Phase 12: Interactable Android Home-Screen Widget v2** - Upgrade widgets to support task toggling and tab switching. ✅ COMPLETE
- [x] **Phase 13: Billing & Money Management** - Budgets, expenses, recurring bills, and spending analytics. ✅ COMPLETE

### Milestone 2: Hardened Offline-First & Production Readiness

- [x] **Phase 14: Automated Testing Framework & CI/CD Pipeline** - Jest test runner, native module mocks, unit test suites, and GitHub Actions CI workflow. ✅ COMPLETE
- [x] **Phase 15: Centralized Local Date Engine & Timezone Bug Fixes** - Device-local calendar date utility replacing UTC slicing across app, screens, and widgets. ✅ COMPLETE
- [x] **Phase 16: Security & Storage Migration Hardening** - Per-archive random salt/IV with PBKDF2 100k+, LAN sync transport security, and storage migration key hardening. ✅ COMPLETE
- [x] **Phase 17: State Architecture & Unified Mutation Layer** - Decouple App.js into domain contexts/stores and unify task recurrence/completion between app and widgets. ✅ COMPLETE
- [x] **Phase 18: On-Device AI Pipeline Hardening** - SHA-256 checksum model verification, pinned releases, fallback handling, and memory lifecycle cleanup. ✅ COMPLETE
- [x] **Phase 19: Production Observability & Logging Cleanup** - Strip debug emoji console logging from release bundles and establish structured crash boundaries. ✅ COMPLETE

### Milestone 3: KwestUp 4.0 — Atomic Behavior Engine

- [ ] **Phase 20: Repository Governance, Behavioral Rulebook & Architecture Foundation** - Establish Atomic Habits rulebook, governance contracts, and domain scaffolding.
- [ ] **Phase 21: Technology Platform Upgrade (Expo SDK 57, RN 0.86, Node 22)** - Upgrade runtime framework and verify native dependencies (`llama.rn`, `android-widget`).
- [ ] **Phase 22: Unified Notification Service & Dispatch Engine** - Consolidate distributed notification mechanics and implement strict policy gates (rate limits, quiet hours).
- [ ] **Phase 23: Domain Event Bus & Behavioral Telemetry** - Type-safe internal event bus instrumenting domain state transitions.
- [ ] **Phase 24: Core Behavior Engine (Habits, Cues, Recovery & Rewards)** - Pure behavior engines (2-minute rule, never-miss-twice recovery) and `HabitContext`.
- [ ] **Phase 25: Intervention Engine & Behavioral Home-Screen Widgets** - Multi-surface behavioral intervention delivery across notifications and interactive Android widgets.
- [ ] **Phase 26: Type-Safe Command Registry & AI Sandboxing** - Schema-validated command execution isolating OS/storage APIs from direct AI writes.
- [ ] **Phase 27: On-Device AI Intent Parser & Habit Compiler** - Natural-language intent translation into structured behavioral routines using local LLM.
- [ ] **Phase 28: Behavioral Adaptation, Weekly Review & Hardening** - Friction diagnosis, adaptive habit tuning, end-to-end integration, and release validation.

---

## Phase Details

### Phase 1: Notion/Obsidian-style Notes

**Goal**: Build a beautiful, nested-folder Markdown notes organizer mimicking Notion/Obsidian.
**Depends on**: Nothing.
**Requirements**: [NOTE-01, NOTE-02, NOTE-03]
**Success Criteria**:

  1. Users can create, organize, and delete markdown notes in folders.
  2. The preview mode cleanly renders markdown titles, bolding, lists, and checklists.

**Plans**:

- [x] 01-01-PLAN.md — Core persistence layer: notes state, filesystem init, factory reset wipe. ✅
- [x] 01-02-PLAN.md — Notes list UI, sidebar explorer, dual markdown editor/preview engine. ✅

---

### Phase 2: Google Tasks-style Task Management

**Goal**: Implement a slick, high-performance task management system resembling Google Tasks.
**Depends on**: Phase 1.
**Requirements**: [TASK-01, TASK-02, TASK-03]
**Success Criteria**:

  1. Users can slide between custom task categories/lists.
  2. Tasks display nested checklists with visual progress completion tracking.

**Plans**:

- [x] 02-01-PLAN.md — Build Task lists DB tables, core task CRUD logic, and category tabs UI. ✅
- [x] 02-02-PLAN.md — Build subtasks checklists UI and visual progress tracker. ✅

---

### Phase 3: Birthday Reminder Module

**Goal**: Add time-sensitive upcoming birthday indicators and native system alerts.
**Depends on**: Phase 2.
**Requirements**: [REMD-01, REMD-02]
**Success Criteria**:

  1. Birthday cards display age and days remaining with automated countdowns.
  2. Local system notifications fire correctly on the morning of scheduled birthdays.

**Plans**:

- [x] 03-01-PLAN.md — Create birthday list screen, age algorithms, and contact CRUD. ✅
- [x] 03-02-PLAN.md — Integrate Expo local notification manager and advance alert options. ✅

---

### Phase 4: Local Network Sync via QR Scanner

**Goal**: Synchronize database contents locally over Wi-Fi with KwestUp PC desktop app using a QR code camera scan.
**Depends on**: Phase 3.
**Requirements**: [SYNC-01, SYNC-02]
**Success Criteria**:

  1. The mobile camera scans PC-displayed QR codes to retrieve connection details.
  2. Two-way Wi-Fi synchronization successfully merges local data with PC app local JSON storage.
  3. A robust standalone Python synchronization server is created for PC testing.

**Plans**:

- [x] 04-01-PLAN.md — Integrate QR scanning module and parse credentials payload. ✅
- [x] 04-02-PLAN.md — Implement local HTTP sync client and data merge algorithms. ✅
- [x] 04-03-PLAN.md — Develop the companion Python synchronization server (`sync_server.py`) for desktop. ✅

---

### Phase 5: Local On-Device AI Integration

**Goal**: Host a fully offline 0.6B parameter LLM on-device (specifically Qwen3-0.6B-GGUF: https://huggingface.co/Qwen/Qwen3-0.6B-GGUF) for local summarization and task generation.
**Depends on**: Phase 1, Phase 4.
**Requirements**: [LAI-01, LAI-02]
**Success Criteria**:

  1. Native C++ llama.cpp compiles correctly inside React Native via native bindings.
  2. AI model runs entirely offline, successfully summarizing notes and extracting checklist items into the Tasks database.

**Plans**:

- [x] 05-01-PLAN.md — Integrate `react-native-llama` native library and set up GGUF model loader. ✅
- [x] 05-02-PLAN.md — Implement note summarization UI and automated task extraction pipeline. ✅

---

### Phase 6: Docker Integration & System Polish

**Goal**: Provide developer containerization and polish the overall user interface.
**Depends on**: Phase 5.
**Requirements**: [DOCKER-01]
**Success Criteria**:

  1. Docker-compose spins up local development servers and executes clean network tests.
  2. Visual elements are completely polished, fully responsive, and premium.

**Plans**:

- [x] 06-01-PLAN.md — Write Dockerfiles, docker-compose, and automation testing scripts. ✅
- [x] 06-02-PLAN.md — Complete comprehensive visual audit, optimize startup latency, and freeze code. ✅

---

### Phase 7: Premium Liquid Glass UI Redesign (Skia) ✅ COMPLETE

**Goal**: Install React Native Skia and completely rewrite app styles to use dynamic, hardware-accelerated fluid glass card layouts.
**Depends on**: Phase 6.
**Requirements**: [UI-01]
**Success Criteria**:

  1. Shopify `@shopify/react-native-skia` library is installed and compiled successfully.
  2. The application uses BackdropFilters with liquid blend matrices and glowing highlight borders.

**Plans**:

- [x] 07-01-PLAN.md — Install Skia, create LiquidGlassCard, LiquidGlassBackground, glassTheme tokens, and glass-styled primitives. ✅
- [x] 07-02-PLAN.md — Refactor screens, navigation, drawer, and cards to use the Liquid Glass theme. ✅

---

### Phase 8: Obsidian-Style Note Vaults ✅ COMPLETE

**Goal**: Support multiple separate raw `.md` note vaults, dynamic switching, and folder importing.
**Depends on**: Phase 7.
**Requirements**: [NOTE-04]
**Success Criteria**:

   1. Users can create, switch between, and delete isolated notes vaults on local directories.
   2. Existing local folders of markdown files can be imported as functional vaults.

**Plans**:

- [x] 08-01-PLAN.md — Vault Service & Migration Layer: vaultService.js, vaultImport.js, fileStorage.js refactor, App.js vault state. (Wave 1) ✅
- [x] 08-02-PLAN.md — Vault Management UI: vault switcher sidebar, CRUD modals, import .md flow. (Wave 2) ✅

### Phase 9: Android Home-Screen Widgets

**Goal**: Fully implement interactive home-screen widgets for Android devices.
**Depends on**: Phase 8.
**Requirements**: [WIDG-01]
**Success Criteria**:

  1. Android widgets (`react-native-android-widget` or custom widget receivers) render task lists and focus timer counts on Android user home screens.

**Plans**:

- [x] 09-01-PLAN.md — Install react-native-android-widget, create FocusTimerWidget, DailyTasksWidget, widget task handler, and app.json config. (Wave 1) ✅
- [x] 09-02-PLAN.md — Wire widget registration in index.js and add debounced foreground update effects in App.js. (Wave 2) ✅

---

### Phase 10: Tactile Industrial UI Redesign

**Goal**: Completely refactor app styling, layout boundaries, typography, buttons, checkboxes, and AI components to replicate the premium, high-contrast, tactile industrial console specify in '/UI Design plan'.
**Depends on**: Phase 9.
**Requirements**: [UI-02, UI-03]
**Success Criteria**:

  1. Hanken Grotesk and JetBrains Mono fonts load and display correctly.
  2. All cards render sharp 0px corners, outward bevel heights, stardust textures, and Dark corner bolts/screws.
  3. Checked note checklists and completed tasks render an "X" mark inside a square outline.
  4. AIAssistant features card renders a looping animated horizontal laser scanning line.

**Plans**:

- [x] 10-01-PLAN.md — Foundation, custom fonts loading, industrial theme colors, global styles font family injector, and LiquidGlassCard/Background skeuomorphic redesigns. (Wave 1) ✅
- [x] 10-02-PLAN.md — Rebuilding CustomButton as a mechanical button with color inversion, checked X-mark checkboxes, and loop laser scan animations. (Wave 2) ✅

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Notes | 2/2 | ✅ Complete | 2026-05-28 |
| 2. Tasks | 2/2 | ✅ Complete | 2026-05-28 |
| 3. Birthdays | 2/2 | ✅ Complete | 2026-05-28 |
| 4. QR Sync | 3/3 | ✅ Complete | 2026-05-29 |
| 5. On-Device AI | 2/2 | ✅ Complete | 2026-05-29 |
| 6. Docker & Polish | 2/2 | ✅ Complete | 2026-05-29 |
| 7. Skia Glass UI | 2/2 | ✅ Complete | 2026-05-31 |
| 8. Note Vaults | 2/2 | ✅ Complete | 2026-05-31 |
| 9. Android Widgets | 2/2 | ✅ Complete | 2026-05-31 |
| 10. Industrial UI | 2/2 | ✅ Complete | 2026-06-05 |
| 11. Encrypted Export | 2/2 | ✅ Complete | 2026-06-18 |
| 12. Interactable Widget v2 | 2/2 | ✅ Complete | 2026-06-28 |
| 13. Billing & Money Management | 2/2 | ✅ Complete | 2026-07-07 |
| 14. Testing & CI/CD | 3/3 | ✅ Complete | 2026-09-27 |
| 15. Local Date Engine | 2/2 | ✅ Complete | 2026-09-27 |
| 16. Security & Storage Hardening | 0/2 | ⏳ Pending | - |
| 17. State & Mutation Architecture | 0/2 | ⏳ Pending | - |
| 18. Local AI Hardening | 0/2 | ⏳ Pending | - |
| 19. Observability & Logging | 0/1 | ⏳ Pending | - |

---

## Phase Details

### Phase 14: Automated Testing Framework & CI/CD Pipeline

**Goal**: Establish automated unit and integration testing harness with Jest, React Native Testing Library, native mocks, and a GitHub Actions CI pipeline.
**Depends on**: Phase 13.
**Requirements**: [TEST-01, TEST-02, TEST-03]
**Success Criteria**:

  1. Jest is configured and runs successfully with `npm test`.
  2. Native modules (`llama.rn`, `react-native-android-widget`, `AsyncStorage`, `expo-file-system`) are cleanly mocked for Node test environments.
  3. Real unit tests import production code for core utilities and state logic and pass.
  4. GitHub Actions workflow runs linter and tests on pull requests and pushes to `main` and `development`.

**Plans**:

- [x] 14-01-PLAN.md — Jest test environment setup, Babel transform, native mocks, and npm test script. ✅
- [x] 14-02-PLAN.md — Unit test suites for core business logic and utilities (`exportService`, `importService`, `fileStorage`, `vaultService`, `syncService`). ✅
- [x] 14-03-PLAN.md — GitHub Actions CI pipeline synchronization with branch protection and test verification. ✅

---

### Phase 15: Centralized Local Date Engine & Timezone Bug Fixes

**Goal**: Replace all fragile UTC date slicing with a centralized device-local calendar date utility across tasks, birthdays, billing, search, and widgets.
**Depends on**: Phase 14.
**Requirements**: [DATE-01, DATE-02]
**Success Criteria**:

  1. `src/utils/dateUtils.js` provides consistent `getLocalDateString()`, `isSameLocalDay()`, and timezone-aware formatting.
  2. All `new Date().toISOString().slice(0, 10)` callsites in `App.js`, `DailyTasksScreen`, `BillingScreen`, `SearchScreen`, and `widget-task-handler.tsx` are refactored to use local date utilities.
  3. Comprehensive unit tests verify boundary conditions (midnight rollover, positive/negative UTC offsets, leap years).

**Plans**:

- [x] 15-01-PLAN.md — Implement centralized `dateUtils.js` with comprehensive timezone boundary tests. ✅
- [x] 15-02-PLAN.md — Refactor screens, handlers, and widgets to use `dateUtils.js`. ✅

---

### Phase 16: Security & Storage Migration Hardening

**Goal**: Modernize `.kwestup` backup encryption (per-archive random salt/IV, PBKDF2 100k+ iterations), secure LAN sync transport & token exchange, and fix storage migration version key drift.
**Depends on**: Phase 15.
**Requirements**: [SEC-01, SEC-02, STORE-01]
**Success Criteria**:

  1. Backups use per-export random salt & IV with ≥100,000 PBKDF2 iterations and maintain backward-compatible decryption for legacy backups.
  2. LAN sync verifies session tokens securely and rejects unauthorized or malformed requests.
  3. Storage migration targets active `currentStorageVersion` rather than hardcoded legacy keys, and cache cleaning preserves telemetry opt-in and AI download state.

**Plans**:

- [x] 16-01-PLAN.md — Upgrade backup encryption in `exportService.js` and `importService.js` with legacy migration tests. ✅
- [x] 16-02-PLAN.md — Secure LAN sync handshake and fix storage migration keys and cache clearing. ✅

---

### Phase 17: State Architecture & Unified Mutation Layer

**Goal**: Decouple `App.js` monolith into dedicated domain stores/context and unify task recurrence and completion mutations between app and home-screen widgets.
**Depends on**: Phase 16.
**Requirements**: [ARCH-01, ARCH-02]
**Success Criteria**:

  1. Monolithic state in `App.js` is factored into modular domain providers/stores (Tasks, Vaults, Birthdays, Billing).
  2. Shared task mutation module handles task toggling and recurrence spawning for both `App` and `widgets/widget-task-handler.tsx`.
  3. App foreground reload automatically synchronizes in-memory state with widget-driven AsyncStorage mutations.

**Plans**:

- [x] 17-01-PLAN.md — Create shared task mutation and recurrence module with unit test coverage. ✅
- [x] 17-02-PLAN.md — Refactor `App.js` to consume domain contexts and subscribe to storage changes. ✅

---

### Phase 18: On-Device AI Pipeline Hardening

**Goal**: Pin AI model release, enforce SHA-256 checksum verification before loading, and implement robust error fallback and memory lifecycle management.
**Depends on**: Phase 17.
**Requirements**: [AI-01, AI-02]
**Success Criteria**:

  1. AI model download URL is pinned to an immutable release tag/commit with pre-load SHA-256 integrity verification.
  2. Memory lifecycle is managed with automatic unloading (`releaseAllLlama`) when components unmount or memory is constrained.
  3. Inference failures gracefully fallback to rule-based summarization and extraction without crashing.

**Plans**:

- [x] 18-01-PLAN.md — Implement checksum verification and immutable model pinning in `aiService.js`. ✅
- [x] 18-02-PLAN.md — Context memory lifecycle management and fallback extraction pipeline. ✅

---

### Phase 19: Production Observability & Logging Cleanup

**Goal**: Strip verbose emoji debug logs from release builds and establish structured crash boundaries and diagnostics.
**Depends on**: Phase 18.
**Requirements**: [OBS-01, OBS-02]
**Success Criteria**:

  1. Over 100 verbose `console.log` calls are stripped or routed through an environment-aware logger that silences debug logs in production.
  2. Top-level React error boundary catches unexpected runtime crashes with user-friendly recovery UI.

**Plans**:

- [x] 19-01-PLAN.md — Build-Time Log Stripping & Runtime Structured Logger ✅
- [x] 19-02-PLAN.md — Root Error Boundary & Structured Crash Recovery UI ✅

---

### Phase 20: Repository Governance, Behavioral Rulebook & Architecture Foundation

**Goal**: Establish the Atomic Habits behavioral rulebook, governance contracts, TypeScript configuration, and architectural domain scaffolding.
**Depends on**: Phase 19.
**Requirements**: [GOV-01, GOV-02]
**Success Criteria**:

  1. Complete `rulebook/` directory tree established with Atomic Habits principles (4 laws, inversions, identity, 2-minute rule, habit stacking, never miss twice), AI policies, behavioral rules, and examples.
  2. Foundation domain directories scaffolded (`src/behavior/`, `src/commands/`, `src/services/`, `src/domains/`) with core type definitions and contracts.
  3. Incremental TypeScript compilation configured (`tsconfig.json`, `npm run typecheck`) and passing cleanly for new architectural foundations.
  4. Codebase map alignment: resolve remaining raw console calls in `src/utils/vaultImport.js`, `billingStorage.js`, and `notifications.js` to route through `logger.js`.

**Plans**:
**Wave 1**

- [ ] 20-01-PLAN.md — Rulebook Creation & Behavioral Governance Contracts

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 20-02-PLAN.md — Architectural Scaffolding, TypeScript Foundation & Codebase Map Alignment

---

### Phase 21: Technology Platform Upgrade (Expo SDK 57, RN 0.86, Node 22)

**Goal**: Upgrade core runtime to Expo SDK 57, React Native 0.86, React 19.2.3, and Node 22 while preserving native module stability and test suites.
**Depends on**: Phase 20.
**Requirements**: [UPGD-01]
**Success Criteria**:

  1. Dependencies cleanly upgraded to Expo SDK 57 supported pairings without package conflicts.
  2. Native modules (`llama.rn` postinstall patch, `react-native-android-widget`, `reanimated`) compile and function correctly.
  3. Full Jest test suite and ESLint pass 100% cleanly on Node 22.

---

### Phase 22: Unified Notification Service & Dispatch Engine

**Goal**: Consolidate distributed notification mechanics from App.js, screens, and contexts into a dedicated `notificationService.ts` with strict policy gates.
**Depends on**: Phase 21.
**Requirements**: [NOTIF-01, NOTIF-02]
**Success Criteria**:

  1. Single authoritative `src/services/notificationService.ts` handles all Android channels, scheduling, cancellations, and permissions.
  2. Hard behavioral notification policy engine enforces quiet hours, max daily notification caps, and deduplication windows outside the LLM.

---

### Phase 23: Domain Event Bus & Behavioral Telemetry

**Goal**: Implement a lightweight, type-safe in-memory event bus decoupling domain mutations from behavioral reactions.
**Depends on**: Phase 22.
**Requirements**: [EVT-01]
**Success Criteria**:

  1. `src/behavior/eventBus.ts` handles decoupled pub/sub for domain events (`TASK_CREATED`, `TASK_COMPLETED`, `HABIT_COMPLETED`, `WIDGET_ACTION`, etc.).
  2. Task, billing, birthday, and timer mutations emit domain events on state transitions.

---

### Phase 24: Core Behavior Engine (Habits, Cues, Recovery & Rewards)

**Goal**: Implement pure, deterministic behavioral logic engines, isolated habit persistence, and `HabitContext`.
**Depends on**: Phase 23.
**Requirements**: [BEH-01, BEH-02]
**Success Criteria**:

  1. Pure deterministic engines: `habitEngine.ts`, `cueEngine.ts`, `recoveryEngine.ts`, `rewardEngine.ts`, and `improvementEngine.ts`.
  2. Isolated `HabitContext` with versioned storage key `kwestup_habits_v1` and immutable behavior history `kwestup_behavior_events_v1`.
  3. Support for minimum action (2-minute rule), habit stacking, and "never miss twice" recovery state machine.

---

### Phase 25: Intervention Engine & Behavioral Home-Screen Widgets

**Goal**: Coordinate behavioral interventions across multi-surface touchpoints (in-app, notifications, and interactive Android widgets).
**Depends on**: Phase 24.
**Requirements**: [INTV-01, WIDG-03]
**Success Criteria**:

  1. `interventionEngine.ts` arbitrates when and where to intervene based on user behavior and policy limits.
  2. Android home-screen widgets render actionable behavioral states (Today, Next Action, Don't Miss Twice recovery).

---

### Phase 26: Type-Safe Command Registry & AI Sandboxing

**Goal**: Create a finite, schema-validated command execution layer ensuring the AI can never directly manipulate storage, widgets, or OS APIs.
**Depends on**: Phase 25.
**Requirements**: [CMD-01]
**Success Criteria**:

  1. Finite KwestUp command registry with strict schema validation (`commandValidator.ts`, `commandExecutor.ts`).
  2. Direct storage writes and Android system calls forbidden from AI execution paths.

---

### Phase 27: On-Device AI Intent Parser & Habit Compiler

**Goal**: Connect on-device Qwen LLM to natural-language intent parsing and habit compilation into structured commands.
**Depends on**: Phase 26.
**Requirements**: [AI-03]
**Success Criteria**:

  1. Natural-language prompt (e.g., "I want to study DSA every evening") compiles into identity statement, habit, cue, minimum action, and normal target.
  2. Heuristic fallback ensures offline reliability even if LLM inference is unavailable.

---

### Phase 28: Behavioral Adaptation, Weekly Review & Hardening

**Goal**: Implement historical friction diagnosis, weekly review system, comprehensive end-to-end integration tests, and production release readiness.
**Depends on**: Phase 27.
**Requirements**: [AI-04]
**Success Criteria**:

  1. Adaptive engine analyzes miss patterns and suggests friction reductions (e.g., dropping to 2-minute version or changing cue).
  2. Weekly behavioral review UI provides actionable self-reflection without toxic gamification.
  3. All unit, domain, and integration tests pass 100% with zero lint or type errors.
