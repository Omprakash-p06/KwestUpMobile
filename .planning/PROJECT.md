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

<!-- Shipped in Milestone 2 (Phases 14-19: Hardened Offline-First & Production Readiness) -->

- ✓ [TEST-01..03] Automated Jest test runner, native mocks, unit test suites, and CI/CD pipeline — Phase 14
- ✓ [DATE-01..02] Centralized local date engine eliminating UTC calendar bugs — Phase 15
- ✓ [SEC-01..02, STORE-01] Backup encryption v2 (PBKDF2 100k+), LAN sync auth, and migration key hardening — Phase 16
- ✓ [ARCH-01..02] Decoupled domain context providers and unified task mutation engine — Phase 17
- ✓ [AI-01..02] Pinned model SHA-256 integrity verification, memory lifecycle, and heuristic fallback — Phase 18
- ✓ [OBS-01..02] Production log stripping, structured logger ring-buffer, and root ErrorBoundary — Phase 19

### Active

<!-- Milestone 3: KwestUp 4.0 — Atomic Behavior Engine -->

- [ ] **GOV-01**: Establish comprehensive Atomic Habits behavioral rulebook and policy contracts in `rulebook/`.
- [ ] **GOV-02**: Set up TypeScript compilation foundation (`tsconfig.json`) and scaffold domain directory hierarchy (`src/behavior/`, `src/commands/`, `src/services/`, `src/domains/`).
- [ ] **UPGD-01**: Upgrade to Expo SDK 57, React Native 0.86, React 19.2.3, and Node 22 while preserving native module stability (`llama.rn`, `react-native-android-widget`).
- [ ] **NOTIF-01**: Consolidate distributed notification mechanics into `src/services/notificationService.ts` with dedicated Android channels, priority rules, and timeouts.
- [ ] **NOTIF-02**: Enforce deterministic behavioral notification policies (quiet hours, max notifications per day, deduplication windows).
- [ ] **EVT-01**: Implement type-safe in-memory domain event bus (`src/behavior/eventBus.ts`) instrumenting task, billing, birthday, and timer lifecycle events.
- [ ] **BEH-01**: Implement deterministic behavior engines (habit, cue, 2-minute minimum action, never-miss-twice recovery, factual rewards).
- [ ] **BEH-02**: Build `HabitContext` with isolated versioned storage (`kwestup_habits_v1`, `kwestup_behavior_events_v1`) and migration safeguards.
- [ ] **INTV-01**: Implement `interventionEngine.ts` governing multi-surface delivery across Notifications, Widgets, and In-App surfaces.
- [ ] **WIDG-03**: Upgrade Android home-screen widgets to render actionable behavioral cues (Today, Next, Don't Miss Twice recovery).
- [ ] **CMD-01**: Implement finite type-safe command registry, schema validation, and safe execution sandbox isolating storage/OS APIs from direct AI writes.
- [ ] **AI-03**: Implement on-device AI intent parser and habit compiler translating natural-language goals into structured behavioral contracts.
- [ ] **AI-04**: Build adaptive review engine diagnosing friction and proposing habit adjustments from historical behavior evidence.

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
