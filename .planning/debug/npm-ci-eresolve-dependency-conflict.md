---
slug: npm-ci-eresolve-dependency-conflict
status: resolved
trigger: CI workflow failed on `npm ci` with ERESOLVE dependency conflict between react-native@0.86.0 and lockfile / peer dependencies
created: 2026-10-10
resolved: 2026-10-10
---

## Symptoms

1. GitHub Actions CI workflow `ci.yml` failed on step `Install Dependencies` running `npm ci`.
2. Exit error:
   ```
   npm error code ERESOLVE
   npm error ERESOLVE could not resolve
   npm error While resolving: kwestupmobile@3.5.0
   npm error Found: react-native@0.79.5
   npm error node_modules/react-native
   npm error   react-native@"0.86.0" from the root project
   ...
   npm error Conflicting peer dependency: @react-native/jest-preset@0.86.0
   npm error node_modules/@react-native/jest-preset
   npm error   peerOptional @react-native/jest-preset@"0.86.0" from react-native@0.86.0
   ```
3. Reproducible locally with `npm ci --dry-run`.

## Root Cause Analysis

1. **Lockfile Out-of-Sync:**
   In Phase 21 (`21-01`), `package.json` was upgraded to Expo SDK 57 dependencies (`expo@~57.0.0`, `react-native@0.86.0`, `react@19.2.3`, `jest-expo@~57.0.0`). However, `package-lock.json` was never regenerated or committed and was still pinned to `react-native@0.79.5` and `expo@53.0.20`.
2. **Npm strict peer dependency resolution (ERESOLVE):**
   When `npm ci` ran on a clean environment, npm detected that `package.json` requested `react-native@0.86.0` while `package-lock.json` had `0.79.5`. The strict peer resolver halted due to conflicting peer dependency requirements across `@expo/vector-icons` and `@react-native/jest-preset`.
3. **Missing `.npmrc` configuration:**
   The repository lacked `.npmrc` setting `legacy-peer-deps=true`.

## Resolution

1. Added `.npmrc` with `legacy-peer-deps=true` so that npm resolver uses standard legacy peer dependency semantics in both local and CI environments.
2. Regenerated `package-lock.json` via `npm i --package-lock-only`, synchronizing the lockfile with Expo SDK 57 / React Native 0.86.0.
3. Verified `npm ci --dry-run` completes cleanly with exit code 0.
4. Verified all quality gates pass:
   - `npm run typecheck` (0 errors)
   - `npm run lint` (0 errors)
   - `npm test` (14/14 suites, 218/218 tests passing)
