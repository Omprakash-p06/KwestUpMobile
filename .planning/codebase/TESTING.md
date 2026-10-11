# Testing Patterns

**Analysis Date:** 2026-10-11

## Test Framework

**Runner:**
- Jest `^29.7.0` with the `jest-expo/android` preset (Android-first module resolution)
- Config: `jest.config.js`
- Transform: `babel-jest` via `babel-preset-expo`; `babel.config.js` (must keep `react-native-reanimated/plugin` last)
- Types available in tests: `@types/jest ^29.5.14`, `@types/react ~19.2.0`

**Assertion Library:**
- Jest built-in `expect` (no Chai/Sinon). Async component rendering via `react-test-renderer` + `act`

**Run Commands:**
```bash
npm test               # Run all tests (jest)
npm run test:watch     # Watch mode (jest --watch)
npm run test:coverage  # Coverage (jest --coverage)
```

**Quality gate (mandatory per `GEMINI.md` §3, enforced by `check.bat`):**
```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # jest
```
All three must pass before a task counts as verified. `check.bat` runs lint + tests and fails the commit on red.

## Test File Organization

**Location:**
- All tests live under `__tests__/` — never colocated with source
- `__tests__/unit/` — 16 unit suites (pure utils, engines, services, contexts, components)
- `__tests__/phase12-widget-logic.test.js` — widget render-path contract suite at the `__tests__/` root
- `__tests__/setup/jest.setup.js` — global native-mocks harness (loaded via `setupFiles` in `jest.config.js:4-8`)
- `__tests__/setup/jest.setup.test.js` — smoke test proving the harness mocks actually work

**Naming:**
- `__tests__/unit/<module>.test.js` for JavaScript sources, `<module>.test.ts` for TypeScript sources — filename mirrors the source module: `logger.test.js` ↔ `src/utils/logger.js`, `eventBus.test.ts` ↔ `src/behavior/eventBus.ts`, `notificationService.test.ts` ↔ `src/services/notificationService.ts`
- `jest.config.js:24` enforces `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` — any test placed outside `__tests__/` is silently ignored

**Structure:**
```
__tests__/
├── phase12-widget-logic.test.js   # widget contract suite (root level)
├── setup/
│   ├── jest.setup.js              # global mocks harness
│   └── jest.setup.test.js         # harness smoke test
└── unit/
    ├── aiAssistant-smoke.test.js
    ├── aiService.test.js
    ├── behaviorRuleEngine.test.ts
    ├── dateUtils.test.js
    ├── domainEventInstrumentation.test.js
    ├── errorBoundary.test.js
    ├── eventBus.test.ts
    ├── exportImportService.test.js
    ├── habitContext.test.js
    ├── logger.test.js
    ├── notificationService.test.ts
    ├── storageMigration.test.js
    ├── syncService.test.js
    ├── taskContext.test.js
    ├── taskMutations.test.js
    └── vaultAndFileStorage.test.js
```

## Test Structure

**Suite Organization:**
```javascript
// Pattern from __tests__/unit/taskMutations.test.js:1-36
import { toggleTask, calculateNextRecurrence, /* ... */ } from "../../src/utils/taskMutations";

describe("taskMutations Unit Tests", () => {
  const fixedNow = "2026-09-27T12:00:00.000Z";
  const fixedToday = "2026-09-27";

  describe("toggleTask & calculateNextRecurrence", () => {
    it("toggles non-recurring task from incomplete to complete with timestamps", () => {
      const tasks = [
        { id: "task-1", title: "Buy Groceries", completed: false },
        { id: "task-2", title: "Read Book", completed: false },
      ];
      const { updatedTasks, toggledTask } = toggleTask(tasks, "task-1", {
        now: fixedNow,
        todayDate: fixedToday,
      });
      expect(updatedTasks).toHaveLength(2);
      expect(toggledTask.completed).toBe(true);
      expect(toggledTask.completedDate).toBe(fixedToday);
      expect(toggledTask.completedAt).toBe(fixedNow);
    });
  });
});
```
- Outer `describe` names the module under test (`"taskMutations Unit Tests"`, `'src/utils/logger'`, `'src/behavior/eventBus'`, `'notificationService'`)
- Inner `describe` groups one behavior area; `it`/`test` names state the behavior in plain language (`"spawns next occurrence for daily recurring task (+1 day) and removes parent"`)
- Prefix test names with traceability IDs when covering spec/review items: `TC-EVT-01…TC-EVT-08` (`__tests__/unit/eventBus.test.ts`), `TC-OBS-06`/`TC-OBS-07` (`__tests__/unit/errorBoundary.test.js:38,53`), `CR-01`/`CR-02`/`WR-02` (`__tests__/unit/logger.test.js:81,99,165,181`)

**Patterns:**
- Fixed-clock fixtures: declare `const fixedNow = "2026-09-27T12:00:00.000Z"` / `const fixedToday = "2026-09-27"` at suite top and inject via the `options` bag (`{ now: fixedNow, todayDate: fixedToday }`) instead of fake timers for pure logic — see `__tests__/unit/taskMutations.test.js:14-15`
- Setup pattern — reset all shared state in `beforeEach` so suites are order-independent:
```javascript
// Pattern from __tests__/unit/taskContext.test.js:21-27
beforeEach(async () => {
  await AsyncStorage.clear();
  eventBus.clearListeners();
  eventBus.clearBuffer();
  jest.clearAllMocks();
  contextValue = null;
});
```
- Teardown pattern — restore everything the suite borrowed (`__tests__/unit/logger.test.js:20-42`, `__tests__/unit/errorBoundary.test.js:20-36`):
```javascript
beforeEach(() => {
  clearLogs();
  console.log = jest.fn(); console.info = jest.fn();
  console.warn = jest.fn(); console.error = jest.fn();
});
afterEach(() => {
  console.log = originalConsoleLog; /* ... restore all ... */
  global.__DEV__ = originalDev;
  process.env.NODE_ENV = originalNodeEnv;
});
```
- Component/context tests use a minimal consumer harness + `act` (`__tests__/unit/taskContext.test.js:9-18`):
```javascript
let contextValue = null;
const TestTaskConsumer = () => {
  contextValue = useTasks();
  return (<View><Text>Test Consumer</Text></View>);
};
await act(async () => {
  renderer.create(<TaskProvider initialTasks={initialTasks}><TestTaskConsumer /></TaskProvider>);
});
expect(contextValue.tasks).toHaveLength(2);
```

## Mocking

**Framework:** Jest built-ins only (`jest.fn()`, `jest.spyOn`, `jest.mock`, `jest.useFakeTimers`) plus the global harness in `__tests__/setup/jest.setup.js`. No `msw`, `nock`, or standalone Sinon.

**Patterns:**
```javascript
// Logger spy that silences output but records calls — __tests__/unit/eventBus.test.ts:18-28
loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
loggerDebugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
afterEach(() => { loggerErrorSpy.mockRestore(); loggerDebugSpy.mockRestore(); });

// Network stub per-test — __tests__/unit/syncService.test.js:89-105
global.fetch = jest.fn().mockResolvedValue({
  ok: true, status: 200,
  json: jest.fn().mockResolvedValue({ status: 'online' }),
});
// ... and failure paths:
global.fetch = jest.fn().mockRejectedValue(new Error('Network unreachable'));

// Fake timers for toast/timeout UI — __tests__/unit/errorBoundary.test.js:20-36
beforeEach(() => { jest.useFakeTimers(); /* ... */ jest.clearAllMocks(); });
afterEach(() => { act(() => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

// AsyncStorage + in-memory FS reset — __tests__/setup/jest.setup.test.js:9-13
await AsyncStorage.clear();
if (FileSystem.__resetFS) { FileSystem.__resetFS(); }
```
- Global harness (`__tests__/setup/jest.setup.js`, wired in `jest.config.js:4-8`) pre-mocks every native/Expo surface so suites never touch native code: official `AsyncStorage` in-memory mock; `expo-file-system` backed by a `Map` virtual FS exposing `__inMemoryFS`/`__resetFS`; `llama.rn` (`initLlama` → canned completion); `react-native-android-widget`; `expo-notifications` / `expo-haptics` / `expo-sharing` / `expo-document-picker` / `expo-camera` / `expo-clipboard`; `@expo/vector-icons` → `Text` stub; `react-native-reanimated/mock`
- `Platform.OS` override per suite for channel logic: `Platform.OS = 'android'` in `beforeEach`, restored in `afterEach` (`__tests__/unit/notificationService.test.ts:29-39`)

**What to Mock:**
- All native/Expo modules (already handled globally — never re-mock them per test unless asserting call args, e.g. `expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled...`)
- Network: assign `global.fetch = jest.fn()...` per test; restore `originalFetch` in `afterAll` (`__tests__/unit/syncService.test.js:4-12`)
- `logger` methods under test-adjacent assertions via `jest.spyOn(logger, 'error')` so assertions on error paths don't pollute output
- `console.*` when asserting emission/suppression behavior (`__tests__/unit/logger.test.js:29-32`)
- Timers only for timeout/toast UI (`errorBoundary.test.js`); prefer fixed-clock `options`-bag injection for pure time logic

**What NOT to Mock:**
- The module under test or its pure collaborators — `__tests__/phase12-widget-logic.test.js:1-24` documents this as `WR-07`: toggle assertions run against the production `toggleTask` from `src/utils/taskMutations.js`, not a local re-implementation, so a production regression fails the suite
- `AsyncStorage` behavior — use the real official mock (set/get/remove/clear) rather than stubbing return values, except when simulating quota/IO failures
- `babel.config.js` in `__tests__/unit/logger.test.js:227-262` — it `require`s the real config and asserts plugin wiring for production vs test envs

## Fixtures and Factories

**Test Data:**
```javascript
// Inline literals + fixed timestamps — __tests__/unit/syncService.test.js:14-28
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
```
- No factory libraries (no `faker`, `fishery`, builders) — construct plain-object literals inline per test with stable IDs (`task-1`, `t1`, `rec-daily`, `bill-99`)
- Time-sensitive tests inject `now`/`todayDate` through the production `options` bag rather than freezing the clock
- React-harness fixtures: `TestTaskConsumer` captures context value to a module-let (`__tests__/unit/taskContext.test.js`); `ThrowingComponent({ shouldThrow, message })` triggers boundaries on demand (`__tests__/unit/errorBoundary.test.js:9-14`)

**Location:**
- Fixtures are inline in each suite file — there is no shared `__tests__/fixtures/` or `factories/` directory. Do not create one without updating this document
- Cross-test storage state is seeded through the real mocks (`AsyncStorage.setItem`, virtual FS writes) and torn down with `AsyncStorage.clear()` + `FileSystem.__resetFS()` in `beforeEach`

## Coverage

**Requirements:** No global `coverageThreshold` gate. `jest.config.js:30-33` documents this as a deliberate `CR-09` deferral: current coverage is ~28% lines / ~17% functions (26 suites, 358 tests passing as of 2026-10-01), so a 70% gate would fail CI. Phase targets (§24: 70/90/95) apply as engine suites land. Keep the comment in sync when thresholds change.

**View Coverage:**
```bash
npm run test:coverage   # jest --coverage; HTML at coverage/lcov-report/index.html
```
- `collectCoverageFrom` covers `src/**/*.{js,jsx,ts,tsx}` excluding `src/**/*.styles.js` and `node_modules` (`jest.config.js:25-29`)
- Committed `coverage/` artifacts (`clover.xml`, `coverage-final.json`, `lcov.info`, `lcov-report/`) exist for tracking — CI still collects `--coverage` for trend visibility

## Test Types

**Unit Tests:**
- Scope: every suite in `__tests__/unit/` is a unit test — pure functions (`dateUtils`, `taskMutations`, `habitEngine`/`behaviorRuleEngine`), services with mocked IO (`syncService`, `notificationService`, `exportImportService`, `vaultAndFileStorage`, `aiService`), providers via `react-test-renderer` (`taskContext`, `habitContext`), components via renderer (`errorBoundary`, `aiAssistant-smoke`), and cross-cutting engines (`eventBus`, `domainEventInstrumentation`, `logger`, `storageMigration`)
- Approach: arrange with inline literals + fixed clocks, act on the real production unit, assert return shapes and emitted domain events (`eventBus.getRecentEvents()` + `.some(e => e.type === 'TASK_CREATED' ...)` in `__tests__/unit/taskContext.test.js:69-70,92-93`)

**Integration Tests:**
- No dedicated integration-test directory or runner. The closest coverage is renderer-level provider tests (`taskContext`, `habitContext`) exercising real `taskMutations` + real `eventBus` + mocked `AsyncStorage` together, and `exportImportService` / `vaultAndFileStorage` exercising real service code against the mocked FS. Name new files `*.test.js` under `__tests__/unit/` to match `testMatch`

**E2E Tests:**
- Not used. No Detox, Maestro, Playwright, or Cypress config detected in `package.json` or repo root

## Common Patterns

**Async Testing:**
```javascript
// Await act for provider mutations — __tests__/unit/taskContext.test.js:63-67
await act(async () => {
  contextValue.toggleTaskComplete("t1");
});
expect(contextValue.tasks[0].completed).toBe(true);

// Settle async listener rejections before asserting — __tests__/unit/eventBus.test.ts:203-224
const asyncCrashingListener = jest.fn().mockRejectedValue(new Error('Async failure'));
eventBus.subscribe('BILL_CREATED', asyncCrashingListener);
eventBus.emit({ type: 'BILL_CREATED', entityId: 'bill-99', source: 'app' });
await new Promise((resolve) => setTimeout(resolve, 20));
expect(loggerErrorSpy).toHaveBeenCalledWith(
  'EventBus async listener error:',
  expect.objectContaining({ error: 'Async failure', eventType: 'BILL_CREATED' })
);
```

**Error Testing:**
```javascript
// Sync validators: match on message substring — __tests__/unit/syncService.test.js:43-60
expect(() => validateSyncConfig({ ...validConfig, ip: '192.168.1.50/malicious' })).toThrow('is malformed');
expect(() => validateSyncConfig({ ...validConfig, port: 70000 })).toThrow('out of bounds');
expect(() => validateSyncPayload(null)).toThrow('Malformed server response');

// Listener isolation: emit must not throw, error must be logged — __tests__/unit/eventBus.test.ts:173-201
const brokenListener = jest.fn().mockImplementation(() => { throw new Error('Fatal listener crash'); });
expect(() => { returnedEvent = eventBus.emit({ type: 'TASK_COMPLETED', entityId: 'task-99', source: 'app' }); }).not.toThrow();
expect(healthyListener).toHaveBeenCalledTimes(1);
expect(loggerErrorSpy).toHaveBeenCalledWith('EventBus listener error:', expect.objectContaining({ error: 'Fatal listener crash' }));

// Network failure degrades to false, never throws — __tests__/unit/syncService.test.js:117-120
global.fetch = jest.fn().mockRejectedValue(new Error('Network unreachable'));
const isOnline = await pingSyncServer(validConfig);
expect(isOnline).toBe(false);
```

---

*Testing analysis: 2026-10-11*
