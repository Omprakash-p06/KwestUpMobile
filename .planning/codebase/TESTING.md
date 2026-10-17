# Testing Patterns

**Analysis Date:** 2026-10-18

## Test Framework

**Runner:**
- Jest `^29.7.0`
- Config: `jest.config.js`
- Preset: `jest-expo/android` (`react-native` 0.86 / Expo SDK 57)
- `testMatch`: `**/__tests__/**/*.test.[jt]s?(x)`
- `moduleFileExtensions` prioritizes Android/TS variants: `android.js`, `android.jsx`, `android.ts`, `android.tsx`, then `js/jsx/ts/tsx/json/node`.

**Assertion Library:**
- Jest built-in `expect` (no Chai/Testing Library).

**Property-Based Testing:**
- `fast-check` `^4.10.2` (`__tests__/unit/propertyBased.test.ts`).

**Mutation Testing:**
- Stryker `@stryker-mutator/core` + `@stryker-mutator/jest-runner` `^8.7.1`
- Config: `stryker.config.json` (mutates only `src/utils/taskMutations.js`).
- Target documented in `README.md`: >87% mutation score. Report at `reports/mutation/mutation.html`.

**Run Commands:**
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report (enforces thresholds)
npm run test:property       # Property-based invariants only
npm run test:mutation:critical   # Stryker on taskMutations.js
npm run typecheck           # tsc --noEmit
npm run lint                # ESLint (zero errors required)
```

CI (`.github/workflows/ci.yml`) runs, in order: `npm run lint`, `npm run lint:report`, `npm run typecheck`, then `npx jest --ci --maxWorkers=2 --coverage`. A separate report-only Semgrep workflow lives in `.github/workflows/semgrep.yml`.

## Current Suite Size

- 34 test files under `__tests__/` (33 unit suites + 1 setup smoke suite).
- 496 `it`/`test` blocks across 177 `describe` blocks.
- README badge: "496 passed"; `jest.config.js` comment records 30 suites / 457 tests as of 2026-10-12.
- Largest suites: `__tests__/unit/notificationService.test.ts` (907 lines), `aiService.test.js` (659), `commandGateway.test.ts` (591), `habitContext.test.js` (570), `behavioralPipelineE2E.test.ts` (557).

## Test File Organization

**Location:**
- All tests live under `__tests__/`; there is no `src/**/__tests__` co-location.
- `__tests__/unit/` — unit and integration-style suites.
- `__tests__/setup/jest.setup.js` — global native-module mock harness (loaded via `setupFiles`, not a test).
- `__tests__/setup/jest.setup.test.js` — smoke test that the mocks themselves work.

**Naming:**
- `<subject>.test.ts` / `<subject>.test.tsx` / `<subject>.test.js`, camelCase subject (`eventBus.test.ts`, `taskMutations.test.js`, `logicDefectFixes.test.tsx`).
- Requirements-oriented suites embed the phase/defect in the name (`behavioralPipelineE2E.test.ts`, `logicDefectFixes.test.tsx`, `phase12-widget-logic.test.js`).

**Structure:**
```
__tests__/
├── setup/
│   ├── jest.setup.js          # Global mocks (native/Expo/LLM)
│   └── jest.setup.test.js     # Mock harness smoke test
└── unit/
    ├── <module>.test.ts|x|js
    └── ...
```

**Imports in tests:** Always relative, reaching into source with `../../src/...` (e.g. `import { eventBus } from '../../src/behavior/eventBus';`). Do not add a path alias just for tests.

## Test Structure

**Suite Organization (actual pattern):**
```typescript
/**
 * Unit Test Suite: Command Gateway Validation & Execution Layer
 *
 * Requirements Covered: [CMD-01]
 * Codebase Alignment: ARCHITECTURE.md, CONCERNS.md, CONVENTIONS.md, TESTING.md
 */

import { validateCommand } from '../../src/commands/commandValidator';
import { eventBus } from '../../src/behavior/eventBus';

describe('commandGateway', () => {
  beforeEach(() => {
    clearCommandHandlers();
    clearIdempotencyCache();
    eventBus.clearListeners();
    eventBus.clearBuffer();
  });

  describe('Command Validator (validateCommand & checkCommandCapability)', () => {
    it('rejects null or non-object commands', () => {
      const res = validateCommand(null as any);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toMatch(/non-null object/i);
    });
  });
});
```

**Patterns:**
- Top-level `describe` names the module or feature under test, often the source path (`describe('src/behavior/eventBus', ...)`) or a phase/defect label.
- Nested `describe` blocks group by behavior or requirement, frequently using `TC-XXX-NN` traceability IDs (`TC-EVT-01`, `TC-OBS-06`, `TC-OBS-09`).
- Test names read as behavior statements: `"dispatches emitted event to registered type-specific listener"`, `"returns false when model file does not exist"`.
- `beforeEach` resets all singleton state and mocks; `afterEach` restores spies and unmounts renderers.
- Use `it` or `test` interchangeably — both appear (`errorBoundary.test.js` uses `test`, most others use `it`).

## Mocking

**Framework:** Jest built-ins (`jest.mock`, `jest.fn`, `jest.spyOn`).

**Core convention — mocks live in the global setup, not in each test:**
- `__tests__/setup/jest.setup.js` mocks every native/Expo dependency once:
  - `@react-native-async-storage/async-storage` → official in-memory mock.
  - `expo-file-system` and `expo-file-system/legacy` → a shared in-memory `Map` filesystem with helpers `FileSystem.__inMemoryFS` and `FileSystem.__resetFS()` (`jest.setup.js:15-123`).
  - `llama.rn` → `initLlama` resolves to an object with `completion`/`release`/`tokenize`/`detokenize`; `releaseAllLlama`.
  - `react-native-android-widget` → `requestWidgetUpdate`, `registerWidgetTaskHandler`, widget primitives.
  - `expo-notifications`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-camera`, `expo-clipboard`, `@expo/vector-icons`, `react-native-reanimated`.
- Consequently, unit tests contain **no `jest.mock(...)` calls** (zero matches in `__tests__/unit`). They import the already-mocked module and assert on its `jest.fn()`s:
  ```js
  import * as FileSystem from 'expo-file-system';

  FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });
  const isValid = await verifyModelIntegrity(MODEL_PATH);
  expect(isValid).toBe(false);
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  ```
  (`__tests__/unit/aiService.test.js:76-97`)

**Spy pattern for side-effectful collaborators:**
```typescript
beforeEach(() => {
  loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
});
afterEach(() => {
  loggerErrorSpy.mockRestore();
});
```
(`__tests__/unit/eventBus.test.ts:18-28`)

Other spy targets: `jest.spyOn(Date, 'now')` for deterministic IDs/timestamps (`generateId.test.js:25`, `commandGateway.test.ts:469`), `jest.spyOn(aiService, 'loadModel')` / `isModelDownloaded` to force LLM vs heuristic paths (`frictionAnalyzer.test.ts:161-222`), `jest.spyOn(Animated, 'loop')` (`domainEventInstrumentation.test.js:405`).

**Network mocking:** Replace `global.fetch` per test and restore it in `afterAll`:
```js
const originalFetch = global.fetch;
afterAll(() => { global.fetch = originalFetch; });
global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'online' }) });
```
(`__tests__/unit/syncService.test.js:4-12, 90-100`)

**What to Mock:**
- All native/Expo modules (already global).
- Filesystem (use the in-memory FS; call `FileSystem.__resetFS()` in `beforeEach` when writing files).
- Network (`global.fetch`).
- LLM (`llama.rn` is global; force heuristic paths via `forceHeuristic: true` or spies).
- Logging (`logger.error`/`logger.debug`) when asserting errors without console noise.
- Time (`Date.now`, Jest fake timers) for deterministic ID/timer tests.

**What NOT to Mock:**
- Pure domain engines (`src/behavior/*`, `src/utils/taskMutations.js`, `src/ai/*`) — these are tested directly.
- `eventBus` — use the real singleton and reset it (`clearListeners()`, `clearBuffer()`).
- The command gateway/idempotency store — use real implementations and reset (`clearCommandHandlers()`, `clearIdempotencyCache()`).
- AsyncStorage — use the official in-memory mock rather than a hand-rolled one.

## Fixtures and Factories

**Test Data:**
- Fixtures are inline constants or factory objects defined at the top of a suite:
  ```typescript
  const baseHabit: Habit = {
    id: 'habit_1', identityId: 'id_1', title: 'Morning Meditation',
    behavior: 'Meditate for 10 minutes', frequency: 'daily', status: 'active',
    minimumAction: '1 conscious breath', normalTarget: '10 minutes sitting',
    stretchTarget: '20 minutes sitting', streakCount: 3, bestStreak: 5,
    totalEvidenceVotes: 10, createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
  ```
  (`__tests__/unit/behavioralWidget.test.ts:49-64`)
- Deterministic dates are hard-coded (`fixedNow = '2026-06-15T10:00:00.000Z'`) and injected through options (`now`, `todayDate`) instead of relying on the wall clock.
- In-memory arrays act as repositories for integration tests (`inMemoryHabits`, `inMemoryIdentities`, `inMemoryEvents` in `behavioralPipelineE2E.test.ts:38-42`).
- Context tests use a tiny consumer component that captures the hook value into a module-level variable:
  ```js
  let contextValue = null;
  const TestTaskConsumer = () => { contextValue = useTasks(); return <View><Text>Test Consumer</Text></View>; };
  ```
  (`__tests__/unit/taskContext.test.js:9-18`, same pattern in `habitContext.test.js`)

**Location:**
- No shared fixtures directory. Locality per suite is the convention; create factory helpers inside the test file that needs them.

## Component Testing

- Renderer: `react-test-renderer` (`renderer.create`, `renderer.act`).
- **No `@testing-library/react-native`** dependency and no `render`/`screen` usage.
- Query by props, not accessibility roles: `root.findByProps({ testID: 'healthy-child' })`, `root.findAllByType(Text)` (`__tests__/unit/errorBoundary.test.js:48-66`).
- For hooks/lifecycle, wrap renders and emits in `act`, and unmount explicitly:
  ```js
  await act(async () => {
    renderer.create(<TaskProvider initialTasks={initialTasks}><TestTaskConsumer /></TaskProvider>);
  });
  ```
- Snapshot tests: none (`toMatchSnapshot` count = 0). Assertions are explicit value/behavior checks.

## Async Testing

- Async suites use `async`/`await` with `act(async () => { ... })` for React updates.
- Flush promise rejections/event-loop work with a short real-timer wait:
  ```typescript
  eventBus.emit({ type: 'BILL_CREATED', entityId: 'bill-99', source: 'app' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(loggerErrorSpy).toHaveBeenCalledWith('EventBus async listener error:', expect.objectContaining({ error: 'Async failure' }));
  ```
  (`__tests__/unit/eventBus.test.ts:203-224`)
- Fake timers are used sparingly and always restored: 2 suites (`aiService.test.js`, `errorBoundary.test.js`) call `jest.useFakeTimers()`; `errorBoundary.test.js` also uses `jest.runOnlyPendingTimers()` and `jest.useRealTimers()` in `afterEach`.
- Default is real timers; if you enable fake timers, restore them in `afterEach`.

## Error Testing

- Synchronous throws: `expect(() => validateSyncConfig(...)).toThrow('is malformed')` (`__tests__/unit/syncService.test.js:43-60`).
- Non-throwing validation: inspect `{ valid, errors }` and match messages with regex — `expect(res.errors[0]).toMatch(/idempotencyKey/i)` (`__tests__/unit/commandGateway.test.ts:56-74`).
- Async rejections: `await expect(loadModel()).rejects.toThrow('...')` (`aiService.test.js:155`, `exportImportService.test.js:176`, `notificationService.test.ts:826`).
- Error isolation is asserted explicitly — a throwing listener must not break siblings or `emit` (`eventBus.test.ts:172-225`).
- Suppress React's expected console noise by stubbing `console.error = jest.fn()` in `beforeEach` and restoring in `afterEach` (`errorBoundary.test.js:17-35`).

## Property-Based Testing

`__tests__/unit/propertyBased.test.ts` uses `fast-check` to fuzz invariants:

```typescript
fc.assert(
  fc.property(fc.string({ minLength: 1, maxLength: 20 }), fc.boolean(), (title, completed) => {
    // ...invariant assertions...
  }),
  { numRuns: 100 }
);
```

- `numRuns` is typically 100; expensive cases use 50.
- Targets pure functions: `taskMutations`, `habitEngine`, `commandValidator`.
- Assert invariants (uniqueness, non-negativity, idempotency, recency dominance, non-interference) rather than specific outputs.

## Coverage

**Requirements (ratchet — do not lower):**
- `jest.config.js:35-42` enforces global thresholds:
  - statements: 47%
  - branches: 38%
  - functions: 35%
  - lines: 50%
- Collected from `src/**/*.{js,jsx,ts,tsx}`, excluding `*.styles.js` and `node_modules`.
- Latest generated report (`coverage/lcov.info`) measures: lines 50.8% (2955/5817), branches 40.8% (2020/4949), functions 37.2% (408/1097).
- Documented aspirational targets: 70/90/95 (jest config comment referencing §24). Raise floors only after adding suites; never lower them.

**View Coverage:**
```bash
npm run test:coverage
# HTML report: coverage/lcov-report/index.html
```

## Test Types

**Unit Tests:**
- Most suites. Pure engines, utils, validators, logger, date utils, ID generation, storage migration.
- Direct imports, real domain code, globally mocked natives.

**Integration Tests:**
- Live in `__tests__/unit/` but exercise multiple modules end-to-end: `behavioralPipelineE2E.test.ts` (intent → compiler → sandbox → gateway → habit ops → events), `commandIntegration.test.ts`, `domainEventInstrumentation.test.js`, `statefulSequences.test.ts`, `taskConcurrencyAndRecurrence.test.js`.
- Context/provider suites (`taskContext.test.js`, `habitContext.test.js`) integrate React state, AsyncStorage, and eventBus.

**Property Tests:**
- `propertyBased.test.ts`; run via `npm run test:property`.

**Mutation Tests:**
- Stryker on `src/utils/taskMutations.js` only; run via `npm run test:mutation:critical`.

**E2E / Device Tests:**
- Not present. No Detox/Maestro/Appium. Widget rendering is tested headlessly via `react-test-renderer` and the mocked `react-native-android-widget` (`behavioralWidget.test.ts`).

## Common Patterns

**Reset singletons at the start of every suite:**
```typescript
beforeEach(() => {
  clearCommandHandlers();
  clearIdempotencyCache();
  eventBus.clearListeners();
  eventBus.clearBuffer();
  jest.clearAllMocks();
});
```

**Async storage reset:**
```js
beforeEach(async () => {
  await AsyncStorage.clear();
  if (FileSystem.__resetFS) FileSystem.__resetFS();
});
```

**Deterministic IDs/time:** inject `now`/`todayDate` into pure functions, or `jest.spyOn(Date, 'now').mockReturnValue(...)` with `mockRestore()` in `finally`/`afterEach` (`generateId.test.js:25-35`).

**Traceability:** Requirement IDs and codebase-map references go in the suite header comment (`[CMD-01]`, `Codebase Alignment: ...`) and `TC-XXX-NN` tags on individual tests.

**Prefer behavior assertions over implementation details**, but do assert call counts and payloads on mocked boundaries (`expect(FileSystem.deleteAsync).toHaveBeenCalledWith(MODEL_PATH, { idempotent: true })`).

---

*Testing analysis: 2026-10-18*
