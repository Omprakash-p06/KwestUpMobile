# Testing Patterns

**Analysis Date:** 2026-05-17

## Global Standards

All development in this repository must adhere to the global standards defined in [GEMINI.md](../../GEMINI.md):
1. **Map Before Act:** Understand and map the codebase before making changes.
2. **Test Before Commit:** Run code quality and lint tests before committing changes.

## Test Framework

**Runner:**
- None detected. The project currently lacks a testing framework (no Jest, Vitest, Mocha, or Jasmine dependencies in `package.json`).
- Config: Not applicable.

**Assertion Library:**
- None detected.

**Run Commands:**
```bash
# No test commands are defined in package.json
```

## Test File Organization

**Location:**
- No test files (`*.test.js`, `*.spec.js`, `__tests__`) exist in the codebase.

**Naming:**
- Not applicable.

**Structure:**
```
# No testing directory structure currently exists.
```

## Test Structure

**Suite Organization:**
```javascript
// No tests implemented yet. 
// Standard pattern for React Native would be to use describe() and it() blocks via Jest.
```

**Patterns:**
- Not applicable.

## Mocking

**Framework:** None detected.

**What to Mock (Future Recommendation):**
- `AsyncStorage` calls.
- `expo-notifications` for permission requests and scheduling.
- `react-native-reanimated` for animation tests.

## Fixtures and Factories

**Test Data:**
- None currently implemented. (Initial dummy data exists directly in component state).

**Location:**
- Not applicable.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
# Not applicable.
```

## Test Types

**Unit Tests:**
- Not used.

**Integration Tests:**
- Not used.

**E2E Tests:**
- Not used. (No Detox or Maestro configuration found).

## Common Patterns

**Async Testing:**
```javascript
// Not applicable.
```

**Error Testing:**
```javascript
// Not applicable.
```

---

*Testing analysis: 2026-05-17*