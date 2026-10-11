# Testing

**Analysis Date:** 2026-10-11

## Runner & Config

**Runner:** Jest 29 (`package.json:65`) via `jest-expo/android` preset (`jest.config.js:4`). Config: `jest.config.js:1-35`.

- `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` (`jest.config.js:24`) — only `__tests__/**/*.test.js|ts` run. `src/**/*.test.*` does NOT run; never colocate tests.
- `setupFiles` loads `__tests__/setup/jest.setup.js` after expo preset (`jest.config.js:5-8`).
- `transformIgnorePatterns` whitelists RN/Expo/native modules (`jest.config.js:9-11`); `moduleFileExtensions` prioritizes `android.*` (`jest.config.js:12-23`).
- `collectCoverageFrom: src/**/*.{js,jsx,ts,tsx}` excluding `*.styles.js` (`jest.config.js:25-29`). No `coverageThreshold` (deliberate — see Coverage).

**Scripts (`package.json:13-15`):**
```bash
npm test               # jest (all suites)
npm run test:watch     # jest --watch
npm run test:coverage  # jest --coverage
```

## Test Layout

```
__tests__/
├── setup/jest.setup.js       # global native mocks (223 lines)
├── setup/jest.setup.test.js  # self-test for the harness
├── phase12-widget-logic.test.js  # 11 tests, legacy top-level suite
└── unit/                     # 18 suites, one file per module
    ├── dateUtils.test.js / logger.test.js / taskMutations.test.js ...
    └── eventBus.test.ts / behaviorRuleEngine.test.ts / notificationService.test.ts ...
```

**Counts (measured 2026-10-11 via `it|test(` scan):** 19 unit files + 1 top-level = ~330 test cases. Largest: `aiService.test.js` (40), `notificationService.test.ts` (38), `dateUtils.test.js` (28), `behaviorRuleEngine.test.ts` (25), `interventionEngine.test.ts` (22), `eventBus.test.ts` (20), `logger.test.js` (19). Smallest: `aiAssistant-smoke.test.js` (1), `taskContext.test.js` (5).

**By area:** behavior engines (`behaviorRuleEngine`, `interventionEngine`, `eventBus`, `behavioralWidget`, `domainEventInstrumentation`) ~95 tests; services (`aiService`, `notificationService`, `exportImportService`, `syncService`) ~84; storage/vault (`vaultAndFileStorage`, `storageMigration`, `taskMutations`, `taskContext`, `habitContext`) ~59; foundations (`dateUtils`, `logger`, `errorBoundary`) ~57.

**Naming:** mirror source module — `src/utils/dateUtils.js` → `__tests__/unit/dateUtils.test.js`; `src/behavior/eventBus.ts` → `__tests__/unit/eventBus.test.ts`. TS sources get `.test.ts` suites.

## Mocks & Fixtures

**All mocking is centralized in `__tests__/setup/jest.setup.js:1-223`** — loaded for every suite, no per-file native setup needed:

- AsyncStorage → official in-memory mock (`jest.setup.js:9-11`)
- `expo-file-system` → in-memory `Map` FS with `__inMemoryFS` / `__resetFS` helpers (`jest.setup.js:16-117`)
- `llama.rn` → resolved `completion/tokenize/detokenize` stubs (`jest.setup.js:120-128`)
- `react-native-android-widget`, `expo-notifications`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-camera`, `expo-clipboard`, `@expo/vector-icons`, `react-native-reanimated/mock` (`jest.setup.js:131-223`)

**Patterns to copy:**
```js
// console capture + restore — __tests__/unit/logger.test.js:20-42
beforeEach(() => { clearLogs(); console.log = jest.fn(); /* ... */ global.__DEV__ = true; });
afterEach(() => { /* restore originals + __DEV__ + NODE_ENV */ });

// logger spy — __tests__/unit/eventBus.test.ts:21-28
loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
afterEach(() => { loggerErrorSpy.mockRestore(); });

// env toggle — __tests__/unit/logger.test.js:70-74
global.__DEV__ = false; process.env.NODE_ENV = 'production';

// async rejection settle — __tests__/unit/eventBus.test.ts:211-214
await new Promise((resolve) => setTimeout(resolve, 20));
```
**No fixture/factory layer** — tests construct literals inline (e.g. `__tests__/unit/eventBus.test.ts:45-50`). No `__mocks__/` dir, no shared builders. `jest.setup.test.js` self-verifies the harness itself.

## Coverage

**How to run:**
```bash
npm run test:coverage        # jest --coverage, reads jest.config.js:25-29
npx jest --ci --maxWorkers=2 --coverage   # CI invocation (.github/workflows/ci.yml:43)
```

**Current state (measured 2026-10-11 from `coverage/coverage-final.json`, 49 files):** ~27.7% lines (1161/4185), ~17.1% functions (137/802). Matches the `jest.config.js:30-33` comment (~28% lines / ~17% functions, 26 suites / 358 tests on 2026-10-01; suite count has since consolidated to 20 files / ~330 tests). Artifacts (`coverage/lcov-report/`, `lcov.info`, `clover.xml`) are committed in `coverage/` — uploaded as CI artifact, not gated.

**No thresholds enforced** — adding `coverageThreshold: 70%` today reds CI by design (`jest.config.js:30-33`); targets (70/90/95) are tracked for future engine suites.

## CI Gate

**Pipeline: `.github/workflows/ci.yml:17-60`** — single `lint-and-test` job on `ubuntu-latest`, Node 22, `npm ci`, triggers on push/PR to `main` + `development` (`ci.yml:3-7`), `cancel-in-progress` (`ci.yml:12-14`):

1. `npm run lint` — plain `eslint .`, warnings allowed (`ci.yml:36-37`; `WR-10`: no `--max-warnings=0` until ~849 warnings triaged)
2. `npm run typecheck` — `tsc --noEmit`, must pass (`ci.yml:39-40`)
3. `npx jest --ci --maxWorkers=2 --coverage` — all tests must pass (`ci.yml:42-43`)
4. Upload `eslint-report.json` + `coverage/` artifacts `if: always()` (`ci.yml:45-60`)

**Second gate:** Semgrep (`ci.yml:61-70` + `.github/workflows/semgrep.yml`) with `continue-on-error: true` — advisory only, never blocks merge.

**Net:** lint warnings OK / lint errors fail; type errors fail; any test failure fails; coverage + semgrep informational.

## How to Add a Test

1. **Create** `__tests__/unit/<module>.test.js` (or `.test.ts` if source is `.ts`). Must match `testMatch` (`jest.config.js:24`) — top-level `__tests__/` or `__tests__/unit/` only, never colocated in `src/`.
2. **Import** from `../../src/<path>` (e.g. `__tests__/unit/dateUtils.test.js:7-15`). Native/Expo modules are already mocked — do not re-mock them.
3. **Isolate state** in `beforeEach`: `clearLogs()` for logger, `eventBus.clearListeners(); eventBus.clearBuffer()` for bus, `__resetFS()` if touching the virtual FS. Save/restore `console.*`, `global.__DEV__`, `process.env.NODE_ENV` per `__tests__/unit/logger.test.js:20-42`.
4. **Structure:** `describe('<src/path>')` → nested `describe` per function (or `TC-XXX` ID for engine specs, cf. `__tests__/unit/eventBus.test.ts:40,96,123`) → `it('<behavior>')` with one behavior per case.
5. **Mock external deps** with `jest.fn()` / `jest.spyOn(...).mockImplementation(() => {})` + `mockRestore` in `afterEach`; use fake timers or `setTimeout` settle for async (`__tests__/unit/eventBus.test.ts:214`).
6. **Run:** `npx jest __tests__/unit/<module>.test.js` (single file), then `npm run test:coverage` for full suite. Verify `npm run lint` and `npm run typecheck` still pass — CI runs all three.

---
*Testing analysis: 2026-10-11*
