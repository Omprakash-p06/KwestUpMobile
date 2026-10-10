# Testing Patterns

**Analysis Date:** 2026-10-10

## Test Framework

**Runner:**
- Jest `^29.7.0` with the `jest-expo/android` preset (`~57.0.0`)
- Config: `jest.config.js`

**Assertion Library:**
- Jest built-in `expect` (no external assertion library; `@types/jest@^29.5.14` for TS)

**Run Commands:**
```bash
npm test              # Run all tests (jest)
npm run test:watch    # Watch mode (jest --watch)
npm run test:coverage # Coverage (jest --coverage)
```

## Test File Organization

**Location:**
- All tests live under `__tests__/` — never co-located with `src/`
- Unit suites: `__tests__/unit/*.test.js` plus one TS suite `__tests__/unit/notificationService.test.ts`
- Contract suite at suite root: `__tests__/phase12-widget-logic.test.js`
- Global harness: `__tests__/setup/jest.setup.js` (wired via `setupFiles` in `jest.config.js`) with its own smoke test `__tests__/setup/jest.setup.test.js`

**Naming:**
- Mirror the module under test: `logger.test.js` → `src/utils/logger.js`, `taskMutations.test.js` → `src/utils/taskMutations.js`, `taskContext.test.js` → `src/context/TaskContext.js`, `notificationService.test.ts` → `src/services/notificationService.ts`
- Current suites: `aiAssistant-smoke`, `aiService`, `dateUtils`, `errorBoundary`, `exportImportService`, `logger`, `notificationService`, `storageMigration`, `syncService`, `taskContext`, `taskMutations`, `vaultAndFileStorage`, `phase12-widget-logic`, `jest.setup`

**Structure:**
```
__tests__/
├── setup/jest.setup.js        # Global native mocks (loaded for every suite)
├── setup/jest.setup.test.js   # Smoke test pinning the mock harness
├── unit/*.test.js(x)          # One file per module under test
├── unit/notificationService.test.ts  # TS suite (services layer)
└── phase12-widget-logic.test.js      # Widget render-path contract suite
```

## Test Structure

**Suite Organization:**
```javascript
describe('src/utils/logger', () => {
  let originalConsoleLog;
  // ... save globals ...

  beforeEach(() => {
    clearLogs();
    // save + stub console fns, __DEV__, NODE_ENV
    console.log = jest.fn();
  });

  afterEach(() => {
    // restore every stubbed global
    console.log = originalConsoleLog;
    global.__DEV__ = originalDev;
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Level emission in development mode', () => {
    beforeEach(() => { global.__DEV__ = true; });

    test('debug emits to console.log in development', () => {
      debug('Debug message test', { key: 'val' });
      expect(console.log).toHaveBeenCalledWith('Debug message test', { key: 'val' });
    });
  });
});
// __tests__/unit/logger.test.js
```
- Outer `describe` names the module path; nested `describe` blocks group by function or behavior area (`'toggleTask & calculateNextRecurrence'`, `'validateSyncConfig'`, `'Level suppression in production mode'`)
- Use `it(...)` or `test(...)` with a full behavior sentence; embed traceability IDs in names where they exist: `test('CR-02: debug/info neither emit nor buffer in production', ...)` in `__tests__/unit/logger.test.js`, `test('TC-OBS-06: Renders children normally when no error occurs', ...)` in `__tests__/unit/errorBoundary.test.js`

**Patterns:**
- Setup pattern: reset all shared state at the top of `beforeEach` — `await AsyncStorage.clear()`, `FileSystem.__resetFS?.()`, `jest.clearAllMocks()` (see `__tests__/unit/exportImportService.test.js`, `__tests__/unit/vaultAndFileStorage.test.js`, `__tests__/unit/storageMigration.test.js`)
- Deterministic-time pattern: inject fixed timestamps through the `options` argument instead of mocking `Date`: `toggleTask(tasks, "task-1", { now: fixedNow, todayDate: fixedToday })` with `const fixedNow = "2026-09-27T12:00:00.000Z"` (`__tests__/unit/taskMutations.test.js`)
- Timer pattern: `jest.useFakeTimers()` in `beforeEach` + drain with `jest.runOnlyPendingTimers()` inside `act()` and restore via `jest.useRealTimers()` in `afterEach` (`__tests__/unit/errorBoundary.test.js`); force `jest.useRealTimers()` around LLM lifecycle suites (`__tests__/unit/aiService.test.js`)
- Teardown pattern: always restore what you stub — console fns, `global.__DEV__`, `process.env.NODE_ENV`, `Platform.OS`, `global.fetch`, `loggerErrorSpy.mockRestore()` (see `__tests__/unit/logger.test.js`, `__tests__/unit/syncService.test.js`, `__tests__/unit/notificationService.test.ts`)

## Mocking

**Framework:** Jest built-ins (`jest.mock`, `jest.fn`, `jest.spyOn`) plus `react-test-renderer` + `act` for component/context rendering; no `@testing-library/react-native`

**Patterns:**
```javascript
// 1. Global native mocks — loaded once for every suite via setupFiles
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('llama.rn', () => ({
  initLlama: jest.fn().mockResolvedValue({
    completion: jest.fn().mockResolvedValue({ text: 'Mock LLM completion response' }),
    release: jest.fn().mockResolvedValue(true),
    // ...
  }),
  releaseAllLlama: jest.fn().mockResolvedValue(true),
}));
// __tests__/setup/jest.setup.js

// 2. Per-suite reset of native module mocks to a known baseline
initLlama.mockReset();
releaseAllLlama.mockReset();
initLlama.mockResolvedValue({ completion: jest.fn(), release: jest.fn() });
// __tests__/unit/aiService.test.js → beforeEach

// 3. Spy on the real logger instead of replacing it
loggerErrorSpy = jest.spyOn(logger, 'error');
// __tests__/unit/errorBoundary.test.js → beforeEach

// 4. Render providers with a capture-consumer probe
const TestTaskConsumer = () => {
  contextValue = useTasks();
  return (<View><Text>Test Consumer</Text></View>);
};
await act(async () => {
  renderer.create(
    <TaskProvider initialTasks={initialTasks}>
      <TestTaskConsumer />
    </TaskProvider>
  );
});
expect(contextValue.tasks).toHaveLength(2);
// __tests__/unit/taskContext.test.js

// 5. Save/restore globals around fetch stubbing
const originalFetch = global.fetch;
afterAll(() => { global.fetch = originalFetch; });
// __tests__/unit/syncService.test.js
```
- The `expo-file-system` mock in `__tests__/setup/jest.setup.js` is an in-memory `Map` virtual FS (`file:///mock-docs/`, `file:///mock-cache/` seeds) exposing `__inMemoryFS` and `__resetFS()` — call `FileSystem.__resetFS()` in `beforeEach` of every FS-touching suite
- Icon/native-view modules are stubbed to string components (`@expo/vector-icons` → `Text` mock, `expo-camera` → `'CameraView'`, `react-native-reanimated` → `require('react-native-reanimated/mock')`) so suites never need a native build

**What to Mock:**
- All native/Expo modules (AsyncStorage, FileSystem, Notifications, Haptics, Sharing, DocumentPicker, Camera, Clipboard, `llama.rn`, `react-native-android-widget`) — rely on `__tests__/setup/jest.setup.js`, do not re-mock per suite
- `console.*` when asserting emission/suppression (`__tests__/unit/logger.test.js`)
- Timers for debounce/toast/timeout logic (`jest.useFakeTimers`)
- `global.fetch` for sync/network paths; `initLlama`/`releaseAllLlama` per-test resolutions for AI paths

**What NOT to Mock:**
- Pure business logic — import the production function directly so regressions fail the suite. The widget suite pins this explicitly: `import { toggleTask } from '../src/utils/taskMutations'` with the comment "instead of a local re-implementation, so a production regression in toggle semantics fails this suite" (`__tests__/phase12-widget-logic.test.js`, WR-07)
- The real `logger` object — `jest.spyOn` it and assert, then `mockRestore()` (`__tests__/unit/errorBoundary.test.js`)
- Date math — pass `options.now`/`todayDate` rather than mocking `Date`

## Fixtures and Factories

**Test Data:**
```javascript
const samplePayload = {
  metadata: { appVersion: '3.5.0', storageVersion: 'v5.0', createdAt: '2026-09-27T12:00:00.000Z', vaultCount: 1, totalNotes: 2 },
  storage: {
    kwestup_tasks_v5: JSON.stringify([{ id: 'task-1', title: 'Buy milk', completed: false }]),
    kwestup_birthdays_v5: JSON.stringify([{ id: 'bday-1', name: 'Alice', date: '1995-10-15' }]),
  },
  vaults: [{ id: 'default', name: 'Personal', createdAt: '2026-01-01T00:00:00.000Z',
    notes: [{ folder: 'Work', title: 'Meeting Notes', content: '# Meeting\nDiscussed architecture and testing.' }] }],
};
const samplePassphrase = 'SuperSecretPassphrase123!';
// __tests__/unit/exportImportService.test.js

const validConfig = { ip: '192.168.1.50', port: 8080, token: 'test-secure-token-abc-123' };
// __tests__/unit/syncService.test.js
```
- Declare fixtures as inline `const` objects at the top of the `describe` block that owns them; build task/vault/note fixtures with literal IDs (`task-1`, `rec-daily`, `default_inbox`) so assertions can match exactly (`__tests__/unit/taskMutations.test.js`, `__tests__/unit/vaultAndFileStorage.test.js`)

**Location:**
- No shared fixtures directory — fixtures live inside the suite file that uses them
- Shared behavior lives in the harness, not fixtures: virtual FS seeds and `__resetFS()` in `__tests__/setup/jest.setup.js`

## Coverage

**Requirements:** No global `coverageThreshold` enforced yet — the `jest.config.js` comment (CR-09) records ~28% lines / ~17% functions as of 2026-10-01 and defers the 70/90/95 gate; CI collects `--coverage` for tracking only. Do not add a threshold that reds the suite without a phased plan.

**View Coverage:**
```bash
npm run test:coverage   # writes coverage/lcov-report/index.html + coverage/lcov.info
```
- `collectCoverageFrom` covers `src/**/*.{js,jsx,ts,tsx}` excluding `src/**/*.styles.js` and `node_modules`
- Coverage artifacts (`coverage/`) are git-ignored build output — never commit them

## Test Types

**Unit Tests:**
- The only test type in use: 13 suites covering utils (`dateUtils`, `taskMutations`, `logger`, `syncService`, `exportService`, `vaultService`/`fileStorage`, `storage` migration, `aiService`), context (`TaskContext`), components (`ErrorBoundary`, `AIAssistant` smoke), and services (`notificationService`)
- Scope rule: one suite per module, exercising public exports through valid/invalid/boundary inputs (leap-year rollovers in `__tests__/unit/dateUtils.test.js`, recurrence spawning in `__tests__/unit/taskMutations.test.js`, encrypt/decrypt round-trips in `__tests__/unit/exportImportService.test.js`)

**Integration Tests:**
- Approximated, not separated: suites that drive real module pairs against mocked natives — `TaskProvider` + `AsyncStorage` persistence (`__tests__/unit/taskContext.test.js`), `exportService` + `FileSystem` + `Sharing` (`__tests__/unit/exportImportService.test.js`), `vaultService` + `fileStorage` + `AsyncStorage` (`__tests__/unit/vaultAndFileStorage.test.js`)
- Harness contract suite `__tests__/setup/jest.setup.test.js` pins the mock layer itself (AsyncStorage round-trip, FS write/read/delete, `llama.rn` completion, widget update) — run it first when native-mock behavior is suspect

**E2E Tests:**
- Not used — no Detox/Maestro/Appium harness; do not add E2E tooling without a plan-phase decision

## Common Patterns

**Async Testing:**
```javascript
beforeEach(async () => {
  await AsyncStorage.clear();
  if (FileSystem.__resetFS) { FileSystem.__resetFS(); }
  jest.clearAllMocks();
});

it('ensures top-level Notes/Vaults/ directory exists', async () => {
  await ensureVaultsDir();
  const info = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}Notes/Vaults/`);
  expect(info.exists).toBe(true);
  expect(info.isDirectory).toBe(true);
});
// __tests__/unit/vaultAndFileStorage.test.js
```
- `await` every storage/FS/LLM call; wrap provider renders in `await act(async () => { ... })` (`__tests__/unit/taskContext.test.js`)

**Error Testing:**
```javascript
for (const bad of [null, undefined, '', '   ', 'random-junk', '2023-02-29', '2026-13-01', '2026-09-27T23:30:00.000Z', true, {}, NaN]) {
  const result = parseLocalDate(bad);
  expect(result).toBeInstanceOf(Date);
  expect(isNaN(result.getTime())).toBe(true);
}
// __tests__/unit/dateUtils.test.js — invalid-input matrix, Invalid Date contract

expect(() => validateSyncConfig({ ip: '999.999.999.999', port: 8080, token: 'x' })).toThrow(/malformed/);
// pattern: throwing validators in src/utils/syncService.js assert via expect(() => call).toThrow(...)

// Frozen-buffer immunity: mutation attempts must not corrupt live state
expect(Object.isFrozen(snapshot[0].details[0])).toBe(true);
try { snapshot[0].details[0].cause.nested.code = 999; } catch { /* strict-mode throw is fine */ }
const fresh = getRecentLogs();
expect(fresh[0].details[0].cause.nested.code).toBe(42);
// __tests__/unit/logger.test.js — WR-02 deep-freeze verification
```
- Assert both the throw and the safe fallback: `calculateNextRecurrence` with `"invalid-date-string"` must yield a valid `dueDate` on the 28th (`__tests__/unit/taskMutations.test.js`); deleting `default_inbox` must return `deletedList: null` with the list intact
- For component crashes, render a `ThrowingComponent` inside `ErrorBoundary` and assert the recovery UI plus `logger.error` spy (`__tests__/unit/errorBoundary.test.js`)

---

*Testing analysis: 2026-10-10*
