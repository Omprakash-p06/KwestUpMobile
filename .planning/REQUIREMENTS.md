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

- [ ] **OBS-01**: Strip emoji-based debug console logging from production builds.
- [ ] **OBS-02**: Set up structured crash and diagnostics boundaries for release builds.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud user authentication (OAuth/Firebase) | Conflicts with core privacy-first local workspace principle |
| Cloud database synchronization | Sync is strictly peer-to-peer / LAN |
| Web application bundle | Focused on Android mobile and desktop companion |
| Full codebase TypeScript rewrite | Incremental typing to prevent regression of high-risk screens |

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
| OBS-01  | Phase 19 | Pending |
| OBS-02  | Phase 19 | Pending |

**Coverage:**
- Active requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-27*
*Last updated: 2026-09-27 after Milestone 2 scope definition*
