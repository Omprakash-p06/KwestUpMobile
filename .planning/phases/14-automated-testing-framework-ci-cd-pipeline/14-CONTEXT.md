# Phase 14: Automated Testing Framework & CI/CD Pipeline - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish an automated unit and integration testing harness using Jest and React Native Testing Library, comprehensive native module mocks (so tests run headlessly in Node.js without native Android compilation), real unit tests importing production code for core utilities and state mutations, and a synchronized GitHub Actions CI pipeline executing tests and lint checks on pushes and pull requests.

</domain>

<decisions>
## Implementation Decisions

### Testing Infrastructure & Runner
- **D-01:** Standardize on **Jest** as the primary test runner, configured via `jest.config.js` with `babel-jest` for ES module and JSX transpilation compatible with Expo SDK 53 / React Native 0.79.5.
- **D-02:** Create `__tests__/setup/jest.setup.js` defining global mocks for all native and Expo modules (`llama.rn`, `react-native-android-widget`, `@react-native-async-storage/async-storage`, `expo-file-system`, `expo-notifications`, `expo-haptics`, `expo-sharing`, `react-native-reanimated`).
- **D-03:** Add standard `npm test` and `npm run test:watch` / `npm run test:coverage` scripts to `package.json`.

### Production Code Import vs Reimplemented Logic
- **D-04:** Eliminate the anti-pattern identified in the testing audit where `__tests__/phase12-widget-logic.test.js` duplicated functions instead of testing production exports. All tests must directly import source code from `src/utils/` and `src/services/`.
- **D-05:** Establish initial test coverage across core utility modules: `src/utils/exportService.js`, `src/utils/importService.js`, `src/utils/fileStorage.js`, `src/utils/vaultService.js`, and `src/utils/syncService.js`.

### CI/CD Automation
- **D-06:** Create `.github/workflows/ci.yml` that triggers on pull requests and pushes to `main` and `development`.
- **D-07:** The CI workflow must run `npm run lint` and `npm test -- --ci --maxWorkers=2` using Node.js 20 on `ubuntu-latest`.
- **D-08:** Ensure synchronization with user rules: all tests and lint checks must pass before PR merge.

### Claude's Discretion
- Choice of mock structure (in-line jest mocks vs `__mocks__/` directory).
- Test directory hierarchy (`__tests__/unit/` vs collocated).
- Thresholds for initial code coverage reports.

</decisions>

<specifics>
## Specific Ideas

- Ensure `patch-llama-gradle.js` does not interfere with headless test execution.
- Ensure the Jest environment can parse both TypeScript (`.tsx`) and JavaScript (`.js`) since widgets use TS and core uses JS.
- Mocks should provide in-memory state simulation for `AsyncStorage` and `expo-file-system` to allow testing state persistence and directory tree operations.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Codebase Audits
- `.planning/codebase/TESTING.md` — Current testing audit detailing missing Jest config and duplicate test implementations.
- `.planning/codebase/CONCERNS.md` § Tech Debt & Known Bugs — Monoliths, native patches, and crypto/date gaps.
- `.planning/codebase/INTEGRATIONS.md` — Third-party libraries, native plugins, and CI details.
- `.planning/codebase/STACK.md` — React Native 0.79, Expo 53, Babel, and TypeScript versions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `__tests__/phase12-widget-logic.test.js`: Contains test case scenarios [12-P1] through [12-P10] that should be refactored to import real widget and task logic.
- `package.json`: Contains existing scripts `lint` and `postinstall`. Needs `test` script and Jest devDependencies.
- `babel.config.js`: Needs babel preset configuration for Jest if required by Expo.

### Established Patterns
- Codebase uses ES module imports and JSX.
- AsyncStorage is accessed via `@react-native-async-storage/async-storage`.
- Filesystem uses `expo-file-system`.

### Integration Points
- `package.json` scripts: `npm test`
- `jest.config.js`
- `__tests__/setup/jest.setup.js`
- `.github/workflows/ci.yml`

</code_context>

<deferred>
## Deferred Ideas

- E2E testing with Detox or Maestro (deferred to post-v4.0 milestone).
- Snapshot testing of full Skia/Reanimated screens (deferred until state layer decoupling in Phase 17).

</deferred>

---

*Phase: 14-automated-testing-framework-ci-cd-pipeline*
*Context gathered: 2026-09-27*
