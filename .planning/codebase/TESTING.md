# Testing Patterns

**Analysis Date:** 2026-10-11

## Test Framework

**Runner:**
- Jest 29.7.0 via `jest-expo/android` preset (`preset: 'jest-expo/android'` in `jest.config.js:4`)
- Config: `jest.config.js`
- Assertion Library: Jest's built-in `expect` (no Chai/Jasmine). `@types/jest@^29.5.14` provides types.

**Run Commands:**
```bash
npm test               # Run all tests (jest)
npm run test:watch     # Watch mode (jest --watch)
npm run test:coverage  # Coverage (jest --coverage)
```

## Test File Organization

**Location:**
- All tests live under `__tests__/` — never co-located with source. Unit suites in `__tests__/unit/`, harness in `__tests__/setup/`.

**Naming:**
- Pattern: `__tests__/unit/<module>.test.js` for JS modules, `__tests__/unit/<module>.test.ts` for TS modules. Examples: `__tests__/unit/dateUtils.test.js`, `__tests__/unit/logger.test.js`, `__tests__/unit/eventBus.test.ts`, `__tests__/unit/notificationService.test.ts`.
- One outlier at `__tests__/phase12-widget-logic.test.js` (phase-scoped suite, not per-module) — do not copy this pattern for new code; place new suites in `__tests__/unit/`.

**Structure:**
```
__tests__/
├── setup/
│   ├── jest.setup.js        # Global native/Expo mocks (loaded via setupFiles)
│   └── jest.setup.test.js   # Smoke test proving the mocks work
├── unit/
│   ├── aiAssistant-smoke.test.js
│   ├── aiService.test.js
│   ├── dateUtils.test.js
│   ├── domainEventInstrumentation.test.js
│   ├── errorBoundary.test.js
│   ├── eventBus.test.ts
│   ├── exportImportService.test.js
│   ├── logger.test.js
│   ├── notificationService.test.ts
│   ├── storageMigration.test.js
│   ├── syncService.test.js
│   ├── taskContext.test.js
│   ├── taskMutations.test.js
│   └── vaultAndFileStorage.test.js
└── phase12-widget-logic.test.js
```
- `jest.config.js:24` enforces `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` — a test outside `__tests__/` or without `.test.` in the name will silently not run.

## Test Structure

**Suite Organization:**
```javascript
// Canonical shape — copy from __tests__/unit/dateUtils.test.js:1-19
import {
  getLocalDateString,
  parseLocalDate,
  // ...
} from '../../src/utils/dateUtils';

describe('dateUtils', () => {
  describe('getLocalDateString', () => {
    it('returns today in YYYY-MM-DD format by default', () => {
      const today = getLocalDateString();
      expect(typeof today).toBe('string');
      expect(/^\d{4}-\d{2}-\d{2}$/.test(today)).toBe(true);
      // ...
    });

    it('rejects invalid date strings and non-existent calendar dates', () => {
      expect(getLocalDateString('2023-02-29')).toBe('');
    });
  });

  describe('parseLocalDate', () => {
    it('returns Invalid Date (never today) for invalid inputs', () => {
      for (const bad of [null, undefined, '', '   ', 'random-junk', '2023-02-29', true, {}, NaN]) {
        const result = parseLocalDate(bad);
        expect(result).toBeInstanceOf(Date);
        expect(isNaN(result.getTime())).toBe(true);
      }
    });
  });
});
```
- Both `describe`/`it` and `describe`/`test` are accepted (`logger.test.js` uses `test`, `dateUtils.test.js` uses `it`). Prefer `it('<behavior>')` phrased as behavior for new suites.
- Requirement IDs are embedded in test names where they exist: `'TC-EVT-01: Subscription & Dispatch'`, `'TC-EVT-04: ...'`, `'TC-OBS-06: ...'`, `'CR-01: ...'`, `'WR-02: ...'` (see `__tests__/unit/eventBus.test.ts:40-94`, `__tests__/unit/logger.test.js:81-107`, `__tests__/unit/errorBoundary.test.js`). Keep the `TC-*`/`CR-*`/`WR-*` prefix when covering a spec'd requirement.

**Patterns:**
- Setup pattern: `beforeEach` resets all shared state — `clearLogs()` + console stub capture (`__tests__/unit/logger.test.js:20-33`), `eventBus.clearListeners(); eventBus.clearBuffer()` (`__tests__/unit/eventBus.test.ts:19-23`), `await AsyncStorage.clear()` (`__tests__/unit/taskContext.test.js:29-35`), `jest.clearAllMocks()` in most suites.
- Teardown pattern: `afterEach` restores everything captured in `beforeEach` — console methods, `global.__DEV__`, `process.env.NODE_ENV` (`__tests__/unit/logger.test.js:35-42`), `loggerErrorSpy.mockRestore()` (`__tests__/unit/eventBus.test.ts:25-28`), `jest.useRealTimers()` after fake-timer suites (`__tests__/unit/errorBoundary.test.js:32-39`), `global.fetch = originalFetch` (`__tests__/unit/syncService.test.js:11-13`).
- Assertion pattern: behavioral `expect(actual).toBe(expected)` / `toEqual` / `toContain` / `toMatch(/^evt_.../)` / `toThrow('<fragment>')`. Immutability is asserted with `Object.isFrozen(...)` (`__tests__/unit/eventBus.test.ts:300-302`, `__tests__/unit/logger.test.js:168-170`).

## Mocking

**Framework:** Jest built-in (`jest.mock`, `jest.fn()`, `jest.spyOn`) only. No Sinon, no MSW, no Testing Library.

**Patterns:**
```javascript
// 1. Global native mocks live ONLY in __tests__/setup/jest.setup.js — never re-mock these per-test:
// AsyncStorage (official in-memory mock), expo-file-system (Map-backed virtual FS with
// __inMemoryFS/__resetFS helpers), llama.rn, react-native-android-widget,
// expo-notifications, expo-haptics, expo-sharing, expo-document-picker,
// expo-camera, expo-clipboard, @expo/vector-icons, react-native-reanimated/mock.

// 2. Console capture — copy from __tests__/unit/logger.test.js:20-42
beforeEach(() => {
  clearLogs();
  originalConsoleLog = console.log;
  // ...
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});
afterEach(() => {
  console.log = originalConsoleLog;
  // ... restore __DEV__ and NODE_ENV too
});

// 3. Logger spy (non-destructive) — copy from __tests__/unit/eventBus.test.ts:18-28
loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
loggerDebugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
// ...
loggerErrorSpy.mockRestore();

// 4. Global flag flip for env-gated code — copy from __tests__/unit/logger.test.js:44-47,70-74
global.__DEV__ = true;                    // development expectations
global.__DEV__ = false;
process.env.NODE_ENV = 'production';      // production-silencing expectations

// 5. Fake timers for toast/timeout UI — copy from __tests__/unit/errorBoundary.test.js:27-39
jest.useFakeTimers();
// ...
act(() => { jest.runOnlyPendingTimers(); });
jest.useRealTimers();

// 6. Async rejection settling — copy from __tests__/unit/eventBus.test.ts:203-224
eventBus.emit({ type: 'BILL_CREATED', entityId: 'bill-99', source: 'app' });
await new Promise((resolve) => setTimeout(resolve, 20));
expect(loggerErrorSpy).toHaveBeenCalledWith(
  'EventBus async listener error:',
  expect.objectContaining({ error: 'Async failure', eventType: 'BILL_CREATED' }),
);
```

**What to Mock:**
- All native/Expo modules — already handled globally by `__tests__/setup/jest.setup.js` (wired via `setupFiles` in `jest.config.js:5-8`). Never import a real native module in a test.
- `logger.*` via `jest.spyOn(...).mockImplementation(() => {})` when asserting error isolation without console noise.
- `console.*` via `jest.fn()` when asserting emission/suppression.
- `global.fetch` by save/stub/restore for sync tests; time via injected `{ now, todayDate }` options (not via clock mocks) for `taskMutations`.
- React rendering via `react-test-renderer` + `act(...)` for providers, hooks, and `ErrorBoundary` — see `__tests__/unit/taskContext.test.js:33-53` and `__tests__/unit/eventBus.test.ts:407-452`.

**What NOT to Mock:**
- Do not mock the module under test or its pure JS dependencies (`dateUtils`, `taskMutations`, `eventBus`, `logger` internals) — tests import the real implementations.
- Do not re-mock anything already covered by `jest.setup.js` (AsyncStorage, FileSystem, notifications, haptics, clipboard, icons). If a new native module is added to `src/`, add its mock to `__tests__/setup/jest.setup.js` and cover it with a case in `__tests__/setup/jest.setup.test.js` instead of mocking per-suite.
- Do not mock `react-native-reanimated` per-test — the global `require('react-native-reanimated/mock')` mapping applies.

## Fixtures and Factories

**Test Data:**
```javascript
// Deterministic clock injection — copy from __tests__/unit/taskMutations.test.js:13-14
const fixedNow = "2026-09-27T12:00:00.000Z";
const fixedToday = "2026-09-27";
const { updatedTasks, toggledTask } = toggleTask(tasks, "task-1", {
  now: fixedNow,
  todayDate: fixedToday,
});

// Representative domain payloads — copy from __tests__/unit/syncService.test.js:14-25
const validConfig = { ip: '192.168.1.50', port: 8080, token: 'test-secure-token-abc-123' };
const sampleLocalData = {
  notes: [{ title: 'Sync Note', content: 'Sync Content' }],
  tasks: [{ id: 'task-1', title: 'Task to sync' }],
  taskLists: [{ id: 'list-1', name: 'Work' }],
  birthdays: [{ name: 'Bob', date: '1990-01-01' }],
  themeMode: 'dark',
  selectedThemeName: 'industrial',
  userName: 'Omprakash',
};

// Minimal render consumer for context/hook tests — copy from __tests__/unit/taskContext.test.js:17-24
let contextValue = null;
const TestTaskConsumer = () => {
  contextValue = useTasks();
  return (<View><Text>Test Consumer</Text></View>);
};
```
- Table-driven invalid inputs via `for (const bad of [...])` loops — see `__tests__/unit/dateUtils.test.js:89-95`.

**Location:**
- No shared `__tests__/fixtures/` or factory helpers exist. Fixtures are declared inline at the top of each suite's `describe` block. Keep them inline; do not create a fixtures directory unless three or more suites need the same payload.

## Coverage

**Requirements:** No global `coverageThreshold` enforced — intentionally. `jest.config.js:30-33` documents why: coverage sits at ~28% lines / ~17% functions (26 suites, 358 tests passing as of 2026-10-01), so a 70% gate would fail CI. Collection covers `src/**/*.{js,jsx,ts,tsx}` excluding `*.styles.js` (`jest.config.js:25-29`). Targets (§24: 70/90/95) are tracked for future engine suites — do not add a threshold until coverage actually meets it.

**View Coverage:**
```bash
npm run test:coverage   # jest --coverage; HTML report in coverage/
```
- `coverage/` is git-ignored and also in the ESLint `ignores` list. CI collects `--coverage` for tracking only.

## Test Types

**Unit Tests:**
- Scope: pure logic (`dateUtils`, `taskMutations`, `logger` ring-buffer, `syncService` validators, `eventBus` dispatch/buffer/immutability), services (`aiService`, export/import, vault/file-storage, storage migration), and provider/hook behavior (`taskContext`, `useDomainEvent`).
- Approach: deterministic inputs (fixed timestamps), sentinel assertions (`''`, `Invalid Date`, `false`, `null`), throw-fragment assertions for validators, frozen-object assertions for immutability contracts.

**Integration Tests:**
- Scope: provider + real AsyncStorage mock + real EventBus (`__tests__/unit/taskContext.test.js` — emits `TASK_COMPLETED` through the bus), `exportImportService` round-trips through the mocked virtual FS, `vaultAndFileStorage` through AsyncStorage + virtual FS, `domainEventInstrumentation` wiring. There is no separate `__tests__/integration/` directory; integration coverage lives inside `__tests__/unit/` suites that compose two or more real modules.
- Approach: `await act(async () => { renderer.create(<Provider>...) })`, real `AsyncStorage` mock (cleared per test), `FileSystem.__resetFS()` between FS tests (`__tests__/setup/jest.setup.test.js:4-9`).

**E2E Tests:**
- Not used. No Detox, Maestro, or Appium config exists. Device-level verification is manual via `expo run:android` / dev-client builds. Do not add E2E scaffolding without a phase plan.

## Common Patterns

**Async Testing:**
```javascript
// Provider + storage pattern — from __tests__/unit/taskContext.test.js:29-53
beforeEach(async () => {
  await AsyncStorage.clear();
  eventBus.clearListeners();
  eventBus.clearBuffer();
  jest.clearAllMocks();
  contextValue = null;
});

it("provides initial tasks and renders correctly", async () => {
  await act(async () => {
    renderer.create(
      <TaskProvider initialTasks={initialTasks}>
        <TestTaskConsumer />
      </TaskProvider>
    );
  });
  expect(contextValue.tasks).toHaveLength(2);
});
```

**Error Testing:**
```javascript
// Validator rejection — from __tests__/unit/syncService.test.js:46-48
expect(() => validateSyncConfig({ ...validConfig, ip: '192.168.1.50/malicious' })).toThrow('is malformed');
expect(() => validateSyncConfig({ ...validConfig, port: 70000 })).toThrow('out of bounds');

// Listener isolation — from __tests__/unit/eventBus.test.ts:173-201
const brokenListener = jest.fn().mockImplementation(() => { throw new Error('Fatal listener crash'); });
eventBus.subscribe('TASK_COMPLETED', brokenListener);
eventBus.subscribe('TASK_COMPLETED', healthyListener);
expect(() => {
  eventBus.emit({ type: 'TASK_COMPLETED', entityId: 'task-99', source: 'app' });
}).not.toThrow();
expect(healthyListener).toHaveBeenCalledTimes(1);
expect(loggerErrorSpy).toHaveBeenCalledWith(
  'EventBus listener error:',
  expect.objectContaining({ error: 'Fatal listener crash', eventType: 'TASK_COMPLETED' })
);

// Render-crash recovery — from __tests__/unit/errorBoundary.test.js:42-55
act(() => {
  tree = renderer.create(
    <ErrorBoundary>
      <ThrowingComponent shouldThrow={true} message="Corrupt Note Tree" />
    </ErrorBoundary>
  );
});
// assert recovery UI ("Something Went Wrong", "Try Again") appears and logger.error fired
```

**Quality gates before commit (per `GEMINI.md`):** all three must pass — `npm run typecheck` (`tsc --noEmit`, `checkJs:false` so only TS files are checked), `npm run lint` (`eslint .`), `npm test`. Note `tsconfig.json` intentionally excludes `App.js`/`index.js`/`widgets/` from typechecking (pre-existing errors tracked for Phase 25) — do not widen `include` until those are triaged.

---

*Testing analysis: 2026-10-11*
