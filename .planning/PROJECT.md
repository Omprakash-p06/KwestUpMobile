# KwestUp Mobile

## What This Is

KwestUp Mobile is a feature-rich, privacy-first, offline-first personal productivity workspace and Android app built with React Native and Expo. It provides Markdown notes with multi-vault filesystem support, Google Tasks-style categorized lists with nested checklists, upcoming birthday reminders, personal finance/budget tracking, interactive Android home-screen widgets, local Wi-Fi sync with a PC desktop companion, and fully offline on-device AI summarization via quantized GGUF models.

## Core Value

Absolute privacy and local-first reliability: user data stays entirely on-device and syncs directly over the local network without mandatory cloud accounts, remote servers, or third-party intermediaries.

## Requirements

### Validated

<!-- Shipped in Milestone 1 (Phases 1-13) -->

- ✓ [NOTE-01..03] Markdown notes organizer, folder explorer, and preview engine — Phase 1
- ✓ [TASK-01..03] Categorized task lists, checklist subtasks, and progress tracking — Phase 2
- ✓ [REMD-01..02] Birthday reminder cards, age calculation, and morning notifications — Phase 3
- ✓ [SYNC-01..02] Local Wi-Fi sync with PC companion via QR code scan — Phase 4
- ✓ [LAI-01..02] On-device offline LLM (llama.cpp / Qwen) for note summaries and task extraction — Phase 5
- ✓ [DOCKER-01] Docker-compose development environment and network tests — Phase 6
- ✓ [UI-01] React Native Skia liquid glass styling — Phase 7
- ✓ [NOTE-04] Multiple isolated filesystem vaults and directory importing — Phase 8
- ✓ [WIDG-01] Android home-screen widgets for focus timer and daily tasks — Phase 9
- ✓ [UI-02..03] Tactile industrial console UI design — Phase 10
- ✓ [EXPORT-01] Encrypted `.kwestup` data export and import — Phase 11
- ✓ [WIDG-02] Interactive Android home-screen widgets with task toggling and tab switching — Phase 12
- ✓ [BILL-01] Personal finance, budget envelopes, and recurring bill tracking — Phase 13

### Active

<!-- Milestone 2: Hardened Offline-First & Production Readiness -->

- [ ] **TEST-01**: Configure Jest test runner, Babel environment, and mock native modules (`llama.rn`, `react-native-android-widget`, `AsyncStorage`, `expo-file-system`).
- [ ] **TEST-02**: Establish true unit and integration test suites importing production code for core utilities and state mutations.
- [ ] **TEST-03**: Establish automated GitHub Actions CI pipeline running lint and test validation on push/PR.
- [ ] **DATE-01**: Centralize device-local calendar date and timezone calculations in `src/utils/dateUtils.js`.
- [ ] **DATE-02**: Eliminate all UTC `toISOString().slice(0, 10)` date bugs across `App.js`, `DailyTasksScreen`, `BillingScreen`, `SearchScreen`, and `widget-task-handler.tsx`.
- [ ] **SEC-01**: Modernize backup encryption with per-archive cryptographically random salt and IV, PBKDF2 with ≥100,000 iterations, and legacy archive fallback.
- [ ] **SEC-02**: Secure LAN synchronization transport and token authentication over local Wi-Fi.
- [ ] **STORE-01**: Fix storage migration version key drift and prevent version change cache clear from wiping telemetry and AI download state.
- [ ] **ARCH-01**: Decouple monolithic state and callbacks from `App.js` into dedicated domain stores/context providers.
- [ ] **ARCH-02**: Unify task recurrence and completion mutations into a single authoritative data mutation layer shared between app and home-screen widgets.
- [ ] **AI-01**: Secure and harden on-device AI pipeline with pinned model release and SHA-256 checksum verification before loading.
- [ ] **AI-02**: Implement robust AI memory lifecycle management (auto-unloading context) and structured fallback handling.
- [ ] **OBS-01**: Strip emoji-based debug console logging from production builds.
- [ ] **OBS-02**: Set up structured crash and diagnostics boundaries for release builds.

### Out of Scope

- Remote cloud accounts & mandatory cloud login — conflicts with core value of privacy-first local workspace.
- Centralized cloud databases (Firebase, Supabase) — all sync remains peer-to-peer / LAN.
- Web app deployment — current architecture and native dependencies (llama.cpp, android-widget) are focused on Android.
- Full TypeScript conversion of entire legacy codebase — widgets remain TS, core JS is typed incrementally without disruptive full rewrites.

## Context

- **Baseline Codebase:** 13 completed phases, React Native 0.79.5, Expo SDK 53, running on Android.
- **Audits Completed:** 2026-08/2026-09 codebase architecture, concerns, conventions, integrations, stack, structure, and testing audits.
- **Key Challenges Identified:** Monolithic `App.js` (~1270 lines), prop-drilling ~50 items, duplicated task recurrence in widget vs app, UTC calendar bug affecting non-UTC users, weak backup crypto parameters, and lack of automated test suite and CI test gates.

## Constraints

- **Local-First & Offline:** Must function 100% offline without network connectivity; sync only over direct LAN.
- **Android Native Dependencies:** Must preserve compatibility with `llama.rn` native C++ bindings, `react-native-android-widget`, and Expo SDK 53.
- **Git Branching Strategy:** Intermediate work commits to `development` branch; `production` reserved for fully tested milestone release builds.
- **CI/CD Quality Gate:** All tests and linter checks must pass cleanly on GitHub Actions.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on Hardened Offline-First rather than Cloud | Protects core privacy differentiator and resolves deep architectural debt before adding external surfaces | ✓ Good |
| Standardize on Jest + Babel for Testing | Enables running fast unit tests in Node environment while mocking native Expo/Android bridges | ✓ Good |
| Centralize Date Engine | Eliminates subtle timezone rollover and midnight detection bugs across all features | — Pending |
| Unified Mutation Layer for Widgets & App | Solves stale in-memory state and divergence between widget-task-handler and App.js | — Pending |

---
*Last updated: 2026-09-27 after Milestone 2 scope definition and codebase audit synthesis*
