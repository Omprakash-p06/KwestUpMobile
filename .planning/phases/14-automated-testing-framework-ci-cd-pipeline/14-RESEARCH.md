# Phase 14: Automated Testing Framework & CI/CD Pipeline - Research

**Date:** 2026-09-27
**Target:** React Native 0.79.5 / Expo 53 / React 19 / Node 20

## Executive Summary

Phase 14 transitions KwestUp from having zero automated test runners into a robust, automated test environment. The project previously had an orphaned test file (`__tests__/phase12-widget-logic.test.js`) that could not run without manual dependency installation and which reimplemented logic rather than importing production code.

To establish enterprise-grade test automation without triggering native C++ compilation or Android Gradle builds, we configure Jest with `jest-expo` (or `babel-jest` + `babel-preset-expo`), establish comprehensive mocks in `jest.setup.js`, implement unit test suites importing production modules directly, and wire up GitHub Actions CI to enforce automated verification on every PR and commit.

---

## 1. Technical Stack & Dependencies

### Required Packages
- `jest`: Test runner and assertion library
- `jest-expo`: Preset providing Expo and React Native defaults, compatible with Expo SDK 53
- `babel-jest`: Babel compiler integration for Jest
- `@types/jest`: TypeScript definitions for test files (matching existing `tsconfig.json`)

### Transpilation & Babel
Expo 53 apps use `babel-preset-expo`. `jest-expo` automatically configures transform rules for:
- `.js`, `.jsx`, `.ts`, `.tsx`
- Ignoring `node_modules` except for Expo / React Native packages (`@react-native`, `expo-.*`, `react-native-.*`, `@expo.*`)

---

## 2. Native Module Mocking Strategy

KwestUp contains native modules that will fail in a standard Node.js V8 runtime if not mocked:
1. `llama.rn` (native C++ llama bindings)
2. `react-native-android-widget` (Android AppWidget Java bridge)
3. `@react-native-async-storage/async-storage` (in-memory mock provided by `@react-native-async-storage/async-storage/jest/async-storage-mock`)
4. `expo-file-system` (in-memory directory and file mock for vault and note tests)
5. `expo-notifications`, `expo-haptics`, `expo-sharing` (standard no-op or spy mocks)
6. `react-native-reanimated` (`react-native-reanimated/mock`)

All mocks will be centralized in `__tests__/setup/jest.setup.js` and loaded via `setupFiles: ['./__tests__/setup/jest.setup.js']` in `jest.config.js`.

---

## 3. Test Suites & Production Imports

### Moving Away from Duplicated Logic
The existing `__tests__/phase12-widget-logic.test.js` reimplemented pure equivalents of functions in `widgets/widget-task-handler.tsx`.
In Phase 14:
- The tests will directly import production functions and classes.
- Tests will cover:
  1. `exportService.js` & `importService.js`: Archive serialization, AES encryption/decryption, JSON validation, and error handling.
  2. `fileStorage.js` & `vaultService.js`: Note filename sanitization, folder structure parsing, and vault path resolution.
  3. `syncService.js`: QR payload parsing, auth header construction, and sync response validation.

---

## 4. CI/CD Pipeline Design

### Workflow: `.github/workflows/ci.yml`
- Triggers on:
  - `push` to `main`, `development`
  - `pull_request` to `main`, `development`
- Runner: `ubuntu-latest`
- Steps:
  1. Checkout code (`actions/checkout@v4`)
  2. Setup Node.js 20 (`actions/setup-node@v4` with cache: `npm`)
  3. Install dependencies (`npm ci` or `npm install`)
  4. Run linter: `npm run lint`
  5. Run tests: `npm test -- --ci --maxWorkers=2 --coverage`
  6. Enforce zero failures before allowing branch integration.

---

## 5. Validation Architecture

### Quick Run Command
`npm test -- __tests__/unit/exportService.test.js`

### Full Suite Command
`npm test`

### Estimated Runtime
~3-5 seconds locally; ~20-30 seconds on GitHub Actions.
