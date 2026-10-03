# Phase 21 Validation: Technology Platform Upgrade (Expo SDK 57, RN 0.86, Node 22)

**Phase:** 21 of 28 (Milestone 3: KwestUp 4.0 Core Technology Platform)  
**Status:** In Planning  
**Validation Suites:** `npm run typecheck`, `npm run lint`, `npm test`  

---

## 1. Automated Validation Gates

### Test Execution Commands
```bash
npm run typecheck
npm run lint
npm test
```

### Gate Criteria
- **TypeScript Static Verification**: `npm run typecheck` (`tsc --noEmit`) compiles with 0 errors across `src/` and tooling configs.
- **ESLint Code Quality**: `npm run lint` (`eslint .`) passes with 0 errors.
- **Jest Test Suite**: Full Jest suite runs with `npm test` (without `--passWithNoTests`), achieving 100% pass rate across all 13 suites and 180+ unit tests.
- **Postinstall Patch Verification**: `node patch-llama-gradle.js` executes idempotently and outputs success confirmation for both `llama.rn` and `react-native-android-widget`.

---

## 2. Test Cases & Verification Matrix

| Test Case | Component / File | Expected Behavior |
|---|---|---|
| **TC-UPGD-01** | `package.json` | Dependencies upgraded to Expo SDK 57 supported pairings (`expo ~57.0.0`, `react-native 0.86.x`, `react 19.2.3`, `jest-expo ~57.0.0`). |
| **TC-UPGD-02** | `package.json` Test Script | `"test"` script updated from `"jest --passWithNoTests"` to `"jest"`, eliminating false positive passes on zero-test runs. |
| **TC-UPGD-03** | `patch-llama-gradle.js` | Hardened with idempotency checks and post-patch syntax validation, exiting non-zero if target files fail verification. |
| **TC-UPGD-04** | `android/gradle.properties` | `newArchEnabled=false` preserved to prevent NothingOS / Snapdragon 7s Gen 3 startup crashes; 16 KB page-size settings preserved. |
| **TC-UPGD-05** | `android/build.gradle` | Global CMake 16 KB page-size linker flags (`-Wl,-z,max-page-size=16384`) remain active across subprojects. |
| **TC-UPGD-06** | `babel.config.js` | Production log stripping plugin active; `react-native-reanimated/plugin` remains last in the plugin chain. |
| **TC-UPGD-07** | `__tests__/setup/jest.setup.js` | Native mocks (`llama.rn`, `react-native-android-widget`, `AsyncStorage`, `expo-file-system`) remain compatible with Node 22 and Jest 29. |
| **TC-UPGD-08** | Full Regression Suite | All existing test suites (taskMutations, dateUtils, logger, errorBoundary, syncService, exportImport, vault, billing, widgets) pass 100%. |

---

## 3. Failure Mode & Boundary Considerations

1. **Native Module Linking Failures:** `llama.rn 0.12.4` must remain pinned exactly. Any automated bump to unverified versions could break the Old Architecture CatalystInstance JSI bridge.
2. **Postinstall Regex Drift:** Upgrading package dependencies could alter upstream file formatting in `llama.rn` or `react-native-android-widget`. The hardened patch script must detect formatting changes and fail fast rather than silently producing broken native builds.
3. **Node 22 Engine Gate:** `package.json` enforces `"engines": { "node": ">=22.13" }` and CI pins Node 22; developers must not use Node 18 or 20.
