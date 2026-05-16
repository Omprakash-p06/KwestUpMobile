# Codebase Concerns

**Analysis Date:** 2025-05-17

## Tech Debt

**Monolithic Entry Point:**
- Issue: The entire application (3200+ lines) is contained within a single file, including all components, screens, navigation logic, utility functions, and styles.
- Files: `App.js`
- Impact: Extremely difficult to maintain, navigate, and test. High risk of merge conflicts and regression when making changes.
- Fix approach: Implement a proper directory structure (`src/components`, `src/screens`, `src/navigation`, `src/styles`, `src/utils`). Break down `App.js` into smaller, reusable modules.

**Inefficient State Persistence:**
- Issue: The `saveData` function stringifies and saves the entire application state (tasks, birthdays, settings, timer) to `AsyncStorage` on almost every state change.
- Files: `App.js`
- Impact: Performance degradation as data grows. Frequent disk I/O can lead to UI lag and battery drain on mobile devices.
- Fix approach: Implement a more granular persistence strategy. Only save changed data or use a more robust database solution (e.g., SQLite) if data volume is high. Use a debounce or throttle on the save function.

**Manual Version Management & Cache Clearing:**
- Issue: Versioning and cache clearing are manually managed via constants and string-matching logic.
- Files: `App.js`
- Impact: Fragile and error-prone. Risk of losing user data unintentionally or failing to clear relevant caches when schema changes.
- Fix approach: Implement a formal migration strategy for storage schema changes. Use a library for versioned storage management.

## Known Bugs

**Fragile Cache Clearing:**
- Symptoms: `clearAllCaches` filters keys by partial string matches like "kwestup" or "medical".
- Files: `App.js`
- Trigger: If keys from other modules or future updates don't follow this naming convention, they won't be cleared. Conversely, it might clear unrelated keys if they happen to contain these substrings.
- Workaround: None.

## Security Considerations

**Unprotected Local Storage:**
- Risk: Sensitive user data (user name, tasks, birthdays) is stored in plain text in `AsyncStorage`.
- Files: `App.js`
- Current mitigation: None detected.
- Recommendations: For sensitive data, use `expo-secure-store` or encrypt the data before saving it to `AsyncStorage`.

## Performance Bottlenecks

**Large Component Tree Re-renders:**
- Problem: Since almost all state is managed in the root `App` component, most state changes trigger a re-render of the entire component tree.
- Files: `App.js`
- Cause: Lack of component memoization and state localization.
- Improvement path: Localize state to the components that need it. Use `React.memo`, `useMemo`, and `useCallback` strategically. Split the large `App` component into smaller, independent screens.

## Fragile Areas

**Data Initialization Flow:**
- Files: `App.js`
- Why fragile: The initialization sequence (`initializeApp`, `loadData`, `requestNotificationPermissions`) relies on multiple `useEffect` hooks and `isInitialized` flag. Race conditions could occur, leading to inconsistent app state on startup.
- Safe modification: Consolidate initialization logic into a single async flow or use a state machine/loading orchestrator.
- Test coverage: Zero coverage for initialization logic.

## Scaling Limits

**AsyncStorage Size Limits:**
- Current capacity: Total JSON blob size.
- Limit: Typically ~6MB on Android (depending on configuration).
- Scaling path: As users add more tasks and history, the JSON blob will grow. If it exceeds limits, `AsyncStorage.setItem` will fail. Migrate to a database like `expo-sqlite` for structured, scalable data.

## Dependencies at Risk

**Legacy Directory Structure:**
- Risk: The presence of a `test-app` directory in the root is confusing and suggests a non-standard project structure or leftover artifacts.
- Impact: Confusion for new developers; possible conflicts if scripts are run in the wrong directory.
- Migration plan: Remove `test-app` if it's not being used, or move it to a `packages/` directory if a monorepo is intended.

## Test Coverage Gaps

**Entire Codebase:**
- What's not tested: No unit tests, integration tests, or E2E tests are present in the codebase.
- Files: All files.
- Risk: High risk of regressions; bugs are only caught during manual testing; difficult to refactor safely.
- Priority: High. Implement a testing framework (Jest + React Native Testing Library) and start adding unit tests for critical business logic (task management, timer, data parsing).

---

*Concerns audit: 2025-05-17*
