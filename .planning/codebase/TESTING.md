# Testing Patterns

**Analysis Date:** 2026-10-12

## Test Framework

**Runner:**
- Jest 29.7.0 with `jest-expo/android` preset
- Config: `jest.config.js`
- Key config facts: `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` (only `__tests__` dirs count); `setupFiles` chains the expo android preset plus `<rootDir>/__tests__/setup/jest.setup.js`; `moduleFileExtensions` resolves `android.js/ts/tsx` first; `transformIgnorePatterns` whitelists RN/Expo libs (`react-native`, `expo*`, `llama.rn`, `react-native-reanimated`, `react-native-paper`, etc.); `collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.styles.js']`
- No global `coverageThreshold` — intentionally absent until coverage rises (documented in `jest.config.js:30-33`: ~28% lines / ~17% functions, target 70/90/95 tracked for future phases). Do not add a gate without raising coverage first.

**Assertion Library:**
- Built-in Jest `expect` (no chai/sinon). Extended matchers used: `toBe`, `toEqual`, `toContain`, `toMatch`, `toThrow`, `rejects.toThrow`, `toHaveBeenCalledWith`, `toHaveBeenCalledTimes`, `toHaveLength`, `toBeDefined/Null/Truthy`, `toBeInstanceOf`, `toBeGreaterThan`

**Run Commands:**
```bash
npm test               # Run all tests (jest)
npm run test:watch     # Watch mode (jest --watch)
npm run test:coverage  # Coverage (jest --coverage)
```

## Test File Organization

**Location:**
- All tests live under `__tests__/` — never co-located with `src/`. Suites: `__tests__/unit/*.test.{js,ts}` (one file per module under test), `__tests__/setup/jest.setup.js` (global harness), `__tests__/setup/jest.setup.test.js` (harness self-test), `__tests__/phase12-widget-logic.test.js` (cross-module widget parity suite at root).

**Naming:**
- Mirror the module under test: `src/utils/dateUtils.js` → `__tests__/unit/dateUtils.test.js`; `src/components/ErrorBoundary.js` → `__tests__/unit/errorBoundary.test.js`; `src/utils/taskMutations.js` → `__tests__/unit/taskMutations.test.js`; TS modules keep `.test.ts` (`__tests__/unit/eventBus.test.ts`, `__tests__/unit/commandGateway.test.ts`, `__tests__/unit/behaviorCompiler.test.ts`)
- Import with explicit relative paths: `import { ... } from '../../src/utils/dateUtils'` (JS), `from '../../src/behavior/eventBus'` (TS)

**Structure:**
```
__tests__/
├── phase12-widget-logic.test.js   # cross-module widget parity
├── setup/
│   ├── jest.setup.js              # global native mocks (auto-loaded)
│   └── jest.setup.test.js         # harness self-test
└── unit/
    ├── dateUtils.test.js
    ├── logger.test.js
    ├── taskMutations.test.js
    ├── taskContext.test.js
    ├── syncService.test.js
    ├── storageMigration.test.js
    ├── vaultAndFileStorage.test.js
    ├── exportImportService.test.js
    ├── errorBoundary.test.js
    ├── *.test.ts                  # behavior/AI/command suites
    └── ...
```

## Test Structure

**Suite Organization:**
```javascript
describe('dateUtils', () => {
  describe('getLocalDateString', () => {
    it('returns today in YYYY-MM-DD format by default', () => {
      const today = getLocalDateString();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(today)).toBe(true);
    });
    it('rejects invalid date strings and non-existent calendar dates', () => {
      expect(getLocalDateString('2023-02-29')).toBe('');
    });
  });
  describe('parseLocalDate', () => { /* ... */ });
});
```
(`__tests__/unit/dateUtils.test.js:17-59`) — one top-level `describe` per module, nested `describe` per function, `it` sentences describe observable behavior, not implementation.

**Patterns:**
- Setup pattern: reset all shared state in `beforeEach` — this exact trio is the norm for storage/filesystem suites:
```javascript
beforeEach(async () => {
  await AsyncStorage.clear();
  if (FileSystem.__resetFS) {
    FileSystem.__resetFS();
  }
  jest.clearAllMocks();
});
```
(`__tests__/unit/vaultAndFileStorage.test.js:23-29`, identical in `exportImportService.test.js:41-47`; context suites add `eventBus.clearListeners(); eventBus.clearBuffer();` — see `__tests__/unit/taskContext.test.js:21-27`)
- Deterministic-time pattern: define `fixedNow`/`fixedToday` constants and inject via the options bag the source supports — never mock `Date`:
```javascript
const fixedNow = "2026-09-27T12:00:00.000Z";
const fixedToday = "2026-09-27";
const { updatedTasks, toggledTask } = toggleTask(tasks, "task-1", {
  now: fixedNow,
  todayDate: fixedToday,
});
```
(`__tests__/unit/taskMutations.test.js:14-27`)
- Console-silencing pattern for noisy suites: capture originals, replace with `jest.fn()` in `beforeEach`, restore in `afterEach` (plus `__DEV__`/`NODE_ENV` save/restore when testing env gating):
```javascript
beforeEach(() => {
  clearLogs();
  originalConsoleError = console.error;
  console.error = jest.fn();
  loggerErrorSpy = jest.spyOn(logger, 'error');
});
afterEach(() => {
  console.error = originalConsoleError;
  loggerErrorSpy.mockRestore();
});
```
(`__tests__/unit/errorBoundary.test.js:20-36`; fuller variant with `__DEV__`/`NODE_ENV` in `__tests__/unit/logger.test.js:20-42`)
- Traceability-ID pattern: prefix test names with the requirement ID they verify (`TC-OBS-06`, `TC-EVT-01`, `WR-04`, `CR-01`) so failures map back to review findings:
```javascript
test('TC-OBS-06 & TC-OBS-07: Catches render exception and displays recovery UI ...', ...)
test('CR-01: sensitive keys are redacted before buffering', ...)
```
(`__tests__/unit/errorBoundary.test.js:53`, `__tests__/unit/logger.test.js:181`)

## Mocking

**Framework:** Built-in `jest.mock` / `jest.fn` / `jest.spyOn` only. No sinon, no MSW — `global.fetch` is stubbed directly per test.

**Patterns:**
- Prefer the global harness — `__tests__/setup/jest.setup.js` (auto-loaded via `setupFiles`, do not import it manually) already mocks: `@react-native-async-storage/async-storage` (official in-memory mock), `expo-file-system` (full in-memory `Map` FS exposing `__inMemoryFS`/`__resetFS` test hooks), `llama.rn`, `react-native-android-widget`, `expo-notifications`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-camera`, `expo-clipboard`, `@expo/vector-icons` (renders `Text`), `react-native-reanimated/mock`:
```javascript
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-file-system', () => ({ /* in-memory Map FS */ __resetFS: () => {...} }));
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));
```
(`__tests__/setup/jest.setup.js:9-11,28-117,190-195`)
- Stub `fetch` per network test with chained one-shot responses (ping → sync) and restore the original afterward:
```javascript
const originalFetch = global.fetch;
afterAll(() => { global.fetch = originalFetch; });
// ...
global.fetch = jest
  .fn()
  .mockResolvedValueOnce({ ok: true, status: 200, json: jest.fn().mockResolvedValue({ status: 'online' }) })
  .mockResolvedValueOnce({ ok: true, status: 200, json: jest.fn().mockResolvedValue(mockSyncedResult) });
```
(`__tests__/unit/syncService.test.js:4-12,150-161`)
- Spy on the logger instead of asserting console output: `jest.spyOn(logger, 'error')` then `expect(loggerErrorSpy).toHaveBeenCalledWith('Unhandled React Error:', 'Corrupt Note Tree', expect.any(String))` (`__tests__/unit/errorBoundary.test.js:25,76-80`); silence the spy implementation when the log itself is noise: `jest.spyOn(logger, 'error').mockImplementation(() => {})` (`__tests__/unit/eventBus.test.ts:21`)
- Simulate failure paths with one-shot rejections: `Clipboard.setStringAsync.mockRejectedValueOnce(new Error('clipboard denied'))` + `Share.share = jest.fn().mockRejectedValueOnce(...)` (`__tests__/unit/errorBoundary.test.js:212,236-237`)

```typescript
// TS suites: type the spy explicitly
let loggerErrorSpy: jest.SpyInstance;
loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
```
(`__tests__/unit/eventBus.test.ts:15-22`)

**What to Mock:**
- All native/Expo modules (via the global harness — never import real native code in tests)
- `global.fetch` for every `syncService` network path
- `Clipboard`/`Share` for error-report flows; `console.*` only to silence React/Jest noise
- `logger` methods when asserting telemetry emission without polluting the ring buffer

**What NOT to Mock:**
- Do not mock the module under test or its pure collaborators (`dateUtils`, `taskMutations`, `eventBus`, real `AsyncStorage` mock semantics) — tests assert real behavior including storage round-trips and FS writes
- Do not mock `Date` globally — inject `now`/`todayDate` via the options bag the source functions accept
- Do not re-mock anything the harness already provides unless overriding a single method's resolved value for one test

## Fixtures and Factories

**Test Data:**
- Define fixtures inline at the top of each suite — there is no shared factories directory. Keep payloads small but realistic:
```javascript
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
(`__tests__/unit/syncService.test.js:20-28`); crypto suites build a full `samplePayload` with `metadata/storage/vaults` (`__tests__/unit/exportImportService.test.js:13-39`); context suites pass `initialTasks`/`initialTaskLists` props into the real provider (`__tests__/unit/taskContext.test.js:30-48`)
- Rebuild legacy wire formats inline when testing backward compatibility (legacy v1 AES envelope constructed with `crypto-js` directly in `__tests__/unit/exportImportService.test.js:92-102`)

**Location:**
- Fixtures live inside the test file that uses them (top-of-file `const`). Shared reset helpers live in the harness (`__resetFS`, `__inMemoryFS` on the mocked `expo-file-system`). Do not create a new `__tests__/fixtures/` directory — follow the existing inline pattern.

## Coverage

**Requirements:** None enforced (no `coverageThreshold` in `jest.config.js` — see note above). CI collects `--coverage` for tracking only.

**View Coverage:**
```bash
npm run test:coverage
```
- Coverage collects from `src/**/*.{js,jsx,ts,tsx}` excluding `src/**/*.styles.js`. Note the gap: `src/theme/styles.js` and per-file `StyleSheet.create` blocks are excluded, so UI styling is intentionally out of coverage scope.

## Test Types

**Unit Tests:**
- Scope: pure engines and validators — every exported function gets happy-path + boundary + invalid-input cases. Exemplars: `__tests__/unit/dateUtils.test.js` (leap years, month/year rollovers, `Invalid Date`-never-today contract), `__tests__/unit/taskMutations.test.js` (recurrence spawning daily/weekly/monthly/progressive, list protection for `default_inbox`), `__tests__/unit/syncService.test.js` (config/payload validation matrices), `__tests__/unit/storageMigration.test.js` (version migration, cache key protection), `__tests__/unit/vaultAndFileStorage.test.js` + `__tests__/unit/exportImportService.test.js` (real AsyncStorage + in-memory FS round-trips)
- Approach: import real module, call with fixed inputs, assert return shape and content; for storage suites, assert via re-reading `AsyncStorage`/`FileSystem` after the operation

**Integration Tests:**
- Scope: provider + side-effect wiring — render the real `TaskProvider` with `react-test-renderer`, drive handlers through `act`, assert state + `eventBus` telemetry + `AsyncStorage` sync (`__tests__/unit/taskContext.test.js`, `__tests__/unit/habitContext.test.js`); service-level pipelines (`exportArchive` → `Sharing.shareAsync` called with `*.kwestup` URI + temp cleanup; `importArchive` → storage + note files restored — `__tests__/unit/exportImportService.test.js:127-180`); cross-module widget parity (`__tests__/phase12-widget-logic.test.js`, foreground `refreshTasksFromStorage` in `__tests__/unit/taskContext.test.js:119-152`)
- Component pattern with `react-test-renderer` (not React Native Testing Library — it is not installed; do not add it without discussion):
```javascript
import renderer, { act } from 'react-test-renderer';
let tree;
act(() => {
  tree = renderer.create(
    <ErrorBoundary>
      <ThrowingComponent shouldThrow={true} message="Corrupt Note Tree" />
    </ErrorBoundary>
  );
});
const textNodes = tree.root.findAllByType(Text);
const combinedText = textNodes.map((n) => n.props.children).flat().join(' ');
expect(combinedText).toContain('Something Went Wrong');
```
(`__tests__/unit/errorBoundary.test.js:3,55-71`); TS suites add `// @ts-ignore - react-test-renderer types not installed` on the import (`__tests__/unit/eventBus.test.ts:1-3`)
- Timer pattern: wrap in `jest.useFakeTimers()` in `beforeEach`, flush with `act(() => { jest.runOnlyPendingTimers(); })` / `jest.advanceTimersByTime(3500)` and restore real timers in `afterEach` (`__tests__/unit/errorBoundary.test.js:21,29-36,153-156`)

**E2E Tests:** Not used — no Detox/Maestro/Appium config in repo. Device-level verification is manual. Do not add an E2E framework as part of a feature phase.

## Common Patterns

**Async Testing:**
```javascript
await act(async () => {
  renderer.create(
    <TaskProvider initialTasks={initialTasks}>
      <TestTaskConsumer />
    </TaskProvider>
  );
});
await act(async () => {
  await contextValue.handleSaveTask({ title: "New Context Task" });
});
expect(contextValue.tasks).toHaveLength(1);
```
(`__tests__/unit/taskContext.test.js:35-48,83-90`) — always `await act(async ...)` around renders and async handler calls so state settles before assertions; plain (non-async) `act(() => {...})` suffices for sync render-only cases (`__tests__/unit/errorBoundary.test.js:41-46`).

**Error Testing:**
```javascript
// Sync validators: exact-message substring matching
expect(() => validateSyncConfig({ ...validConfig, port: 0 })).toThrow('out of bounds');
expect(() => validateSyncPayload(null)).toThrow('Malformed server response');
// Async rejection: rejects.toThrow, plus asserting no side effects happened
global.fetch = jest.fn();
await expect(performSync({ ip: 'invalid/path', port: 8080, token: 'tok' }, sampleLocalData)).rejects.toThrow('is malformed');
expect(global.fetch).not.toHaveBeenCalled();
```
(`__tests__/unit/syncService.test.js:50-54,75-79,126-132`); crypto suites assert the user-facing envelope message: `.rejects.toThrow('INVALID PASSPHRASE OR CORRUPTED ARCHIVE')` (`__tests__/unit/exportImportService.test.js:176-178`)
- For PII-sensitive error paths, assert both redaction and preservation: `expect(copiedText).toContain('[Redacted]'); expect(copiedText).not.toContain('Secret note #42');` (`__tests__/unit/errorBoundary.test.js:141-144`)

---

*Testing analysis: 2026-10-12*
