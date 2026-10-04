# Testing Patterns

**Analysis Date:** 2026-10-04

## Test Framework

**Runner:**
- Jest 29 (`jest@^29.7.0`) with preset `jest-expo/android` (`jest.config.js`)
- Transform: `babel-jest` via `babel-preset-expo` (`babel.config.js`)
- Component rendering: `react-test-renderer` + `act` (`__tests__/unit/errorBoundary.test.js`, `__tests__/unit/taskContext.test.js`)
- Config: `jest.config.js`

**Assertion Library:**
- Jest built-in `expect` (no Chai/Sinon). Extended matchers used: `toBe`, `toEqual`, `toContain`, `toHaveLength`, `toHaveBeenCalledWith`, `toThrow`, `toBeDefined`, `toBeNull`, `toBeTruthy`.

**Run Commands:**
```bash
npm test                 # Run all tests (plain `jest`, no --passWithNoTests — empty suite fails)
npm run test:watch       # Watch mode (jest --watch)
npm run test:coverage    # Coverage (jest --coverage)
npx jest --ci --maxWorkers=2 --coverage   # CI invocation (.github/workflows/ci.yml)
```

## Test File Organization

**Location:**
- Separate `__tests__/` tree, never co-located: `__tests__/unit/*.test.js`, `__tests__/setup/jest.setup.js`, `__tests__/phase12-widget-logic.test.js`.
- `jest.config.js` `testMatch` is `**/__tests__/**/*.test.[jt]s?(x)` — any test outside `__tests__/` is invisible to the runner. Always place new tests under `__tests__/`.

**Naming:**
- `__tests__/unit/<module>.test.js` mirrors `src/` module: `logger.test.js` → `src/utils/logger.js`, `taskMutations.test.js` → `src/utils/taskMutations.js`, `syncService.test.js` → `src/utils/syncService.js`, `dateUtils.test.js` → `src/utils/dateUtils.js`, `errorBoundary.test.js` → `src/components/ErrorBoundary.js`, `taskContext.test.js` → `src/context/TaskContext.js`.
- `__tests__/setup/jest.setup.test.js` is the mock-harness smoke test; `__tests__/phase12-widget-logic.test.js` is the legacy widget-logic suite.

**Structure:**
```
__tests__/
├── setup/
│   ├── jest.setup.js        # Global native mocks (loaded via setupFiles)
│   └── jest.setup.test.js   # Smoke test proving the mocks work
├── unit/
│   ├── aiAssistant-smoke.test.js
│   ├── aiService.test.js
│   ├── dateUtils.test.js
│   ├── errorBoundary.test.js
│   ├── exportImportService.test.js
│   ├── logger.test.js
│   ├── storageMigration.test.js
│   ├── syncService.test.js
│   ├── taskContext.test.js
│   ├── taskMutations.test.js
│   └── vaultAndFileStorage.test.js
└── phase12-widget-logic.test.js
```

## Test Structure

**Suite Organization:**
```javascript
import { toggleTask, saveTask } from "../../src/utils/taskMutations";

describe("taskMutations Unit Tests", () => {
  const fixedNow = "2026-09-27T12:00:00.000Z";
  const fixedToday = "2026-09-27";

  describe("toggleTask & calculateNextRecurrence", () => {
    it("toggles non-recurring task from incomplete to complete with timestamps", () => {
      const tasks = [{ id: "task-1", title: "Buy Groceries", completed: false }];
      const { updatedTasks, toggledTask } = toggleTask(tasks, "task-1", {
        now: fixedNow,
        todayDate: fixedToday,
      });
      expect(toggledTask.completed).toBe(true);
      expect(toggledTask.completedAt).toBe(fixedNow);
    });
  });
});
```

**Patterns:**
- Top `describe` names the unit (`describe('src/utils/logger', ...)` in `__tests__/unit/logger.test.js`, `describe('syncService Unit Tests', ...)` in `__tests__/unit/syncService.test.js`); nested `describe` groups one function or behavior area.
- Both `test(...)` (`__tests__/unit/logger.test.js`) and `it(...)` (`__tests__/unit/taskMutations.test.js`) are accepted — match the surrounding file.
- Pin time with `fixedNow` / `fixedToday` constants passed via the `options` bag (`__tests__/unit/taskMutations.test.js`). Never assert against live `Date.now()` output.
- Tag regression tests with review IDs in the title: `TC-OBS-06`, `TC-OBS-08`, `CR-01`, `CR-02`, `WR-02`, `WR-04` (`__tests__/unit/errorBoundary.test.js`, `__tests__/unit/logger.test.js`).
- Setup pattern: `beforeEach` clears state (`clearLogs()`, `AsyncStorage.clear()`, `FileSystem.__resetFS()`, `jest.clearAllMocks()`). Teardown pattern: `afterEach` restores globals (`console.*`, `global.__DEV__`, `process.env.NODE_ENV`, `global.fetch`) and drains timers (`jest.runOnlyPendingTimers()` + `jest.useRealTimers()`).

## Mocking

**Framework:** Jest built-ins only (`jest.mock`, `jest.fn`, `jest.spyOn`, `jest.useFakeTimers` / `jest.useRealTimers`). No Sinon, no MSW.

**Patterns:**
```javascript
// Global native mocks live in __tests__/setup/jest.setup.js (auto-loaded):
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-file-system', () => ({ /* in-memory Map FS */ __resetFS: ... }));
jest.mock('llama.rn', () => ({
  initLlama: jest.fn().mockResolvedValue({ completion: jest.fn(), release: jest.fn() }),
}));

// Per-test console capture (__tests__/unit/logger.test.js):
beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});
afterEach(() => {
  console.log = originalConsoleLog; // always restore
});

// Logger observation without side effects (__tests__/unit/errorBoundary.test.js):
loggerErrorSpy = jest.spyOn(logger, 'error');

// One-shot failure injection:
Clipboard.setStringAsync.mockRejectedValueOnce(new Error('clipboard denied'));
Share.share = jest.fn().mockResolvedValue({ action: 'sharedAction' });
```

**What to Mock:**
- All native/Expo modules — pre-mocked globally in `__tests__/setup/jest.setup.js`: AsyncStorage, `expo-file-system` (in-memory `Map` FS with `__resetFS`), `llama.rn`, `react-native-android-widget`, `expo-notifications`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-camera`, `expo-clipboard`, `@expo/vector-icons`, `react-native-reanimated`.
- `global.fetch` for network services — save/restore around the suite (`__tests__/unit/syncService.test.js`).
- `console.*` when asserting emission/suppression, and `global.__DEV__` / `process.env.NODE_ENV` when testing env gating (`__tests__/unit/logger.test.js`).
- Timers with `jest.useFakeTimers()` + `jest.advanceTimersByTime(3500)` for toast/debounce behavior (`__tests__/unit/errorBoundary.test.js`).

**What NOT to Mock:**
- The unit under test or its pure helpers — import the real `src/utils/taskMutations.js`, `src/utils/dateUtils.js`, `src/utils/logger.js`.
- `babel.config.js` behavior — invoke the real config function with a stubbed `api` and assert plugin lists (`__tests__/unit/logger.test.js` babel describe block).
- `react-native-reanimated/mock` is already wired globally; do not re-mock per test.

## Fixtures and Factories

**Test Data:**
```javascript
// Inline literals per test — no shared factories (__tests__/unit/syncService.test.js):
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

// Consumer-probe pattern for context tests (__tests__/unit/taskContext.test.js):
let contextValue = null;
const TestTaskConsumer = () => {
  contextValue = useTasks();
  return (<View><Text>Test Consumer</Text></View>);
};
```

**Location:**
- Fixtures are inline in each test file. There is no `__tests__/fixtures/` or factory library — keep it that way; small inline objects beat shared fixtures for this codebase.

## Coverage

**Requirements:** No global `coverageThreshold` enforced (`jest.config.js`). The file documents why (CR-09 partial): current coverage is ~28% lines / ~17% functions across 13 suites / 180 tests passing (2026-10-04, Phase 21 per `.planning/STATE.md`), so a 70% gate would red CI. Targets step up toward 70/90/95 as engine suites land. CI still runs `--coverage` for tracking and uploads `coverage/` as an artifact (`.github/workflows/ci.yml`).

**View Coverage:**
```bash
npm run test:coverage
```

**Collection:** `collectCoverageFrom` covers `src/**/*.{js,jsx,ts,tsx}` excluding `src/**/*.styles.js` and `node_modules` (`jest.config.js`).

## Test Types

**Unit Tests:**
- Scope: pure logic and service units. 11 suites in `__tests__/unit/` plus the setup smoke test and the legacy widget-logic suite (13 suites / 180 tests total, 2026-10-04): logger ring-buffer/PII gating, date boundary math, task mutation/recurrence, sync validation, storage migration, vault/file storage against the in-memory FS mock, export/import, AI service pipeline, TaskContext provider, ErrorBoundary recovery.
- Approach: deterministic inputs, pinned clocks, real module + mocked platform boundary.

**Integration Tests:**
- Scope: provider + storage + FS mock exercised together: `__tests__/unit/taskContext.test.js` (provider render → AsyncStorage persistence), `__tests__/unit/vaultAndFileStorage.test.js` (vaultService + fileStorage over mocked FS), `__tests__/unit/storageMigration.test.js` (migration across `STORAGE_VERSION`), `__tests__/unit/exportImportService.test.js`.
- Approach: `await AsyncStorage.clear()` + `FileSystem.__resetFS()` in `beforeEach`, then drive the real APIs end to end within the mock environment.

**E2E Tests:**
- Not used. No Detox/Maestro config in repo. Closest equivalents are the component-level `react-test-renderer` suites (`__tests__/unit/errorBoundary.test.js`, `__tests__/unit/taskContext.test.js`) and the LLM smoke test (`__tests__/unit/aiAssistant-smoke.test.js`).

## Common Patterns

**Async Testing:**
```javascript
// Await the real async API; reset between tests (__tests__/setup/jest.setup.test.js):
beforeEach(async () => {
  await AsyncStorage.clear();
  if (FileSystem.__resetFS) FileSystem.__resetFS();
});

it('persists and retrieves values cleanly', async () => {
  await AsyncStorage.setItem('kwestup_test_key', 'test_value_123');
  expect(await AsyncStorage.getItem('kwestup_test_key')).toBe('test_value_123');
});

// Component async actions inside act (__tests__/unit/errorBoundary.test.js):
await act(async () => {
  await instance.handleCopyReport();
});
expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
```

**Error Testing:**
```javascript
// Validation throws asserted by message fragment (__tests__/unit/syncService.test.js):
expect(() => validateSyncConfig({ ...validConfig, port: 70000 })).toThrow('out of bounds');
expect(() => validateSyncPayload(null)).toThrow('Malformed server response');

// Render-failure path via throwing child + error-state assertions (__tests__/unit/errorBoundary.test.js):
const ThrowingComponent = ({ shouldThrow, message }) => {
  if (shouldThrow) throw new Error(message || 'Simulated Render Failure');
  return <Text testID="healthy-child">Healthy Component Content</Text>;
};
act(() => { tree = renderer.create(
  <ErrorBoundary><ThrowingComponent shouldThrow={true} message="Corrupt Note Tree" /></ErrorBoundary>
);});
expect(tree.root.instance.state.hasError).toBe(true);
expect(loggerErrorSpy).toHaveBeenCalledWith('Unhandled React Error:', 'Corrupt Note Tree', expect.any(String));

// Date sentinels instead of throws (__tests__/unit/dateUtils.test.js):
expect(getLocalDateString('2023-02-29')).toBe('');
expect(isNaN(parseLocalDate('random-junk').getTime())).toBe(true);
expect(isSameLocalDay(null, '2026-04-01')).toBe(false);
```

## CI Gates

**Pipeline:** `.github/workflows/ci.yml` (`lint-and-test` on `ubuntu-latest`, Node 22, `npm ci`), triggers on push/PR to `main` and `development`, with `cancel-in-progress` concurrency.
1. `npm run lint` — plain `eslint .`, no `--max-warnings=0` (WR-10 partial until ~849 warnings triaged).
2. `npm run typecheck` — `tsc --noEmit`.
3. `npx jest --ci --maxWorkers=2 --coverage` — full suite (13 suites / 180 tests); `coverage/` uploaded as an artifact alongside the ESLint report.
4. Semgrep security scan runs as a separate job with `continue-on-error: true`.

**Local mirror:** `check.bat` runs `npm run lint` then `npm test` (plain `jest`); both must pass before committing on Windows.

---

*Testing analysis: 2026-10-04*
