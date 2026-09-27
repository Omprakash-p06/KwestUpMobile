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
- [ ] **Phase 14: Automated Testing Framework & CI/CD Pipeline** - Jest test runner, native module mocks, unit test suites, and GitHub Actions CI workflow.
- [ ] **Phase 15: Centralized Local Date Engine & Timezone Bug Fixes** - Device-local calendar date utility replacing UTC slicing across app, screens, and widgets.
- [ ] **Phase 16: Security & Storage Migration Hardening** - Per-archive random salt/IV with PBKDF2 100k+, LAN sync transport security, and storage migration key hardening.
- [ ] **Phase 17: State Architecture & Unified Mutation Layer** - Decouple App.js into domain contexts/stores and unify task recurrence/completion between app and widgets.
- [ ] **Phase 18: On-Device AI Pipeline Hardening** - SHA-256 checksum model verification, pinned releases, fallback handling, and memory lifecycle cleanup.
- [ ] **Phase 19: Production Observability & Logging Cleanup** - Strip debug emoji console logging from release bundles and establish structured crash boundaries.

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
| 14. Testing & CI/CD | 0/3 | ⏳ Pending | - |
| 15. Local Date Engine | 0/2 | ⏳ Pending | - |
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
- [ ] 14-01-PLAN.md — Jest test environment setup, Babel transform, native mocks, and npm test script.
- [ ] 14-02-PLAN.md — Unit test suites for core business logic and utilities (`dateUtils`, `fileStorage`, `vaultService`, `exportService`).
- [ ] 14-03-PLAN.md — GitHub Actions CI pipeline synchronization with branch protection and test verification.

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
- [ ] 15-01-PLAN.md — Implement centralized `dateUtils.js` with comprehensive timezone boundary tests.
- [ ] 15-02-PLAN.md — Refactor screens, handlers, and widgets to use `dateUtils.js`.

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
- [ ] 16-01-PLAN.md — Upgrade backup encryption in `exportService.js` and `importService.js` with legacy migration tests.
- [ ] 16-02-PLAN.md — Secure LAN sync handshake and fix storage migration keys and cache clearing.

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
- [ ] 17-01-PLAN.md — Create shared task mutation and recurrence module with unit test coverage.
- [ ] 17-02-PLAN.md — Refactor `App.js` to consume domain contexts and subscribe to storage changes.

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
- [ ] 18-01-PLAN.md — Implement checksum verification and immutable model pinning in `aiService.js`.
- [ ] 18-02-PLAN.md — Context memory lifecycle management and fallback extraction pipeline.

---

### Phase 19: Production Observability & Logging Cleanup
**Goal**: Strip verbose emoji debug logs from release builds and establish structured crash boundaries and diagnostics.
**Depends on**: Phase 18.
**Requirements**: [OBS-01, OBS-02]
**Success Criteria**:
  1. Over 100 verbose `console.log` calls are stripped or routed through an environment-aware logger that silences debug logs in production.
  2. Top-level React error boundary catches unexpected runtime crashes with user-friendly recovery UI.
**Plans**:
- [ ] 19-01-PLAN.md — Logger utility, Babel transform for production log stripping, and root error boundary.

