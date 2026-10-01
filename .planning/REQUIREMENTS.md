# Requirements: KwestUp Mobile (Milestone 2: Hardened Offline-First & Production Readiness)

**Defined:** 2026-09-27
**Core Value:** Absolute privacy and local-first reliability: user data stays entirely on-device and syncs directly over the local network without mandatory cloud accounts, remote servers, or third-party intermediaries.

## v2 Requirements (Milestone 2)

Requirements for the hardening and production readiness milestone.

### Testing & CI/CD

- [x] **TEST-01**: Configure Jest test runner, Babel environment, and mock native modules (`llama.rn`, `react-native-android-widget`, `AsyncStorage`, `expo-file-system`).
- [x] **TEST-02**: Establish true unit and integration test suites importing production code for core utilities and state mutations.
- [x] **TEST-03**: Establish automated GitHub Actions CI pipeline running lint and test validation on push/PR.

### Date & Timezone Integrity

- [x] **DATE-01**: Centralize device-local calendar date and timezone calculations in `src/utils/dateUtils.js`.
- [x] **DATE-02**: Eliminate all UTC `toISOString().slice(0, 10)` date bugs across `App.js`, `DailyTasksScreen`, `BillingScreen`, `SearchScreen`, and `widget-task-handler.tsx`.

### Security & Storage

- [x] **SEC-01**: Modernize backup encryption with per-archive cryptographically random salt and IV, PBKDF2 with ≥100,000 iterations, and legacy archive fallback.
- [x] **SEC-02**: Secure LAN synchronization transport and token authentication over local Wi-Fi.
- [x] **STORE-01**: Fix storage migration version key drift and prevent version change cache clear from wiping telemetry and AI download state.

### Architecture & State

- [x] **ARCH-01**: Decouple monolithic state and callbacks from `App.js` into dedicated domain stores/context providers.
- [x] **ARCH-02**: Unify task recurrence and completion mutations into a single authoritative data mutation layer shared between app and home-screen widgets.

### Local AI Pipeline

- [x] **AI-01**: Secure and harden on-device AI pipeline with pinned model release and SHA-256 checksum verification before loading.
- [x] **AI-02**: Implement robust AI memory lifecycle management (auto-unloading context) and structured fallback handling.

### Observability & Polish

- [x] **OBS-01**: Strip emoji-based debug console logging from production builds.
- [x] **OBS-02**: Set up structured crash and diagnostics boundaries for release builds.

## v3 Requirements (Milestone 3: KwestUp 4.0 — Atomic Behavior Engine)

Requirements for the behavioral execution system, technology platform upgrade, and AI habit compiler.

### Repository Governance & Architecture Foundation
- [ ] **GOV-01**: Establish comprehensive two-layer Atomic Habits behavioral rulebook: human markdown philosophy contracts and machine-executable rule sets (`rulebook/machine/*.json`) with explicit Rule IDs (`HABIT_CREATE_001`, `RECOVERY_001`, etc.).
- [ ] **GOV-02**: Set up TypeScript compilation foundation (`tsconfig.json`) and scaffold domain directory hierarchy (`src/behavior/`, `src/commands/`, `src/services/`, `src/domains/`).

### Technology Platform Upgrade
- [ ] **UPGD-01**: Upgrade to Expo SDK 57, React Native 0.86, React 19.2.3, and Node 22 while preserving native module stability (`llama.rn`, `react-native-android-widget`).

### Notification Extraction & Policy Engine
- [ ] **NOTIF-01**: Consolidate distributed notification mechanics into `src/services/notificationService.ts` with dedicated Android channels, priority rules, and timeouts.
- [ ] **NOTIF-02**: Enforce deterministic behavioral notification policies (quiet hours, max notifications per day, deduplication windows) outside the LLM.

### Domain Events & Behavioral Telemetry
- [ ] **EVT-01**: Implement type-safe in-memory domain event bus (`src/behavior/eventBus.ts`) instrumenting task, billing, birthday, and timer lifecycle events.

### Core Behavior & Deterministic Rule Engine
- [ ] **BEH-01**: Implement deterministic behavior engines (habit, cue, 2-minute minimum action, never-miss-twice recovery, factual rewards) evaluating machine rules and logging `rulesApplied` audit traces.
- [ ] **BEH-02**: Build `HabitContext` with isolated versioned storage (`kwestup_habits_v1`, `kwestup_behavior_events_v1`) and migration safeguards.

### Multi-Surface Intervention & Behavioral Widgets
- [ ] **INTV-01**: Implement `interventionEngine.ts` governing multi-surface delivery across Notifications, Widgets, and In-App surfaces under `interventionRules.json` policy limits.
- [ ] **WIDG-03**: Upgrade Android home-screen widgets to render actionable behavioral cues (Today, Next, Don't Miss Twice recovery).

### Command Gateway & Behavior Compiler
- [ ] **CMD-01**: Implement finite type-safe Command Gateway with schema validation, capability checks, and execution sandboxing isolating storage/OS APIs from direct AI writes.
- [ ] **AI-03**: Implement on-device AI Intent Parser (extracting bare facts) and deterministic Behavior Compiler (expanding intent into verified habit contracts using the rule engine).
- [ ] **AI-04**: Build adaptive review engine combining semantic Behavior Analyst (friction diagnosis) and Language Generator (weekly reflection) mapped to deterministic interventions.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud user authentication (OAuth/Firebase) | Conflicts with core privacy-first local workspace principle |
| Cloud database synchronization | Sync is strictly peer-to-peer / LAN |
| Web application bundle | Focused on Android mobile and desktop companion |
| Full codebase TypeScript rewrite | Incremental typing: new architecture code is TS-first, existing screens migrate progressively |
| Unrestricted device automation / OS hijacking | KwestUp owns internal behavior and cues; does not block third-party apps or alter Android settings |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 14 | Complete |
| TEST-02 | Phase 14 | Complete |
| TEST-03 | Phase 14 | Complete |
| DATE-01 | Phase 15 | Complete |
| DATE-02 | Phase 15 | Complete |
| SEC-01  | Phase 16 | Complete |
| SEC-02  | Phase 16 | Complete |
| STORE-01| Phase 16 | Complete |
| ARCH-01 | Phase 17 | Complete |
| ARCH-02 | Phase 17 | Complete |
| AI-01   | Phase 18 | Complete |
| AI-02   | Phase 18 | Complete |
| OBS-01  | Phase 19 | Complete |
| OBS-02  | Phase 19 | Complete |
| GOV-01  | Phase 20 | Pending |
| GOV-02  | Phase 20 | Pending |
| UPGD-01 | Phase 21 | Pending |
| NOTIF-01| Phase 22 | Pending |
| NOTIF-02| Phase 22 | Pending |
| EVT-01  | Phase 23 | Pending |
| BEH-01  | Phase 24 | Pending |
| BEH-02  | Phase 24 | Pending |
| INTV-01 | Phase 25 | Pending |
| WIDG-03 | Phase 25 | Pending |
| CMD-01  | Phase 26 | Pending |
| AI-03   | Phase 27 | Pending |
| AI-04   | Phase 28 | Pending |

**Coverage:**
- Active requirements: 13 total (Milestone 3)
- Completed requirements: 14 total (Milestone 2)
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-27*
*Last updated: 2026-09-27 after Milestone 2 scope definition*
