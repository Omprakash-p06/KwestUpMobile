# Testing Patterns

**Analysis Date:** 2026-10-12

## Test Framework

**Runner:**
- Jest 29.7.0 with `jest-expo/android` preset (Android-first: `preset: 'jest-expo/android'`)
- Config: `jest.config.js`

**Assertion Library:**
- Jest built-in `expect` (no Chai/Sinon). Extended matchers used: `toBe`, `toEqual`, `toContain`, `toMatch`, `toThrow`, `toBeDefined`, `toBeInstanceOf`, `toHaveBeenCalledWith`, `toHaveLength`, `toBeGreaterThan`

**Run Commands:**
```bash
npm test              # Run all tests (jest)
npm run test:watch    # Watch mode (jest --watch)
npm run test:coverage # Coverage (jest --coverage)
npx jest --ci --maxWorkers=2 --coverage   # CI invocation (.github/workflows/ci.yml:50)
npm run lint          # ESLint gate — must pass before tests count as verified
npm run typecheck     # tsc --noEmit — must pass before tests count as verified
```

## Test File Organization

**Location:**
- Separate top-level `__tests__/` tree, never colocated with `src/`. Jest only picks up this tree: `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` in `jest.config.js:24`
- Suites grouped by kind: `__tests__/unit/` (28 suites: services, utils, engines, contexts), `__tests__/setup/` (harness + its self-test), `__tests__/phase12-widget-logic.test.js` (widget-logic suite at root)

**Naming:**
- `<moduleName>.test.js` for plain-JS units: `__tests__/unit/logger.test.js`, `__tests__/unit/dateUtils.test.js`, `__tests__/unit/syncService.test.js`, `__tests__/unit/vaultAndFileStorage.test.js`, `__tests__/unit/generateId.test.js`
- `<moduleName>.test.ts` for typed domains (enables `as any` negative-path casts): `__tests__/unit/commandGateway.test.ts`, `__tests__/unit/eventBus.test.ts`, `__tests__/unit/idempotencyStore.test.ts`, `__tests__/unit/behavioralPipelineE2E.test.ts`
- `*.test.js(x)` only — `*.spec.*` files are ignored by `testMatch`

**Structure:**
```
__tests__/
├── setup/
│   ├── jest.setup.js         # Global native/Expo mocks (loaded via setupFiles)
│   └── jest.setup.test.js    # Self-test proving the harness works
├── unit/
│   ├── logger.test.js
│   ├── dateUtils.test.js
│   ├── generateId.test.js
│   ├── syncService.test.js
│   ├── vaultAndFileStorage.test.js
│   ├── errorBoundary.test.js
│   ├── commandGateway.test.ts
│   └── ... (28 suites total)
└── phase12-widget-logic.test.js
```

## Test Structure

**Suite Organization:**
```javascript
// Canonical shape — __tests__/unit/dateUtils.test.js:17-27
import { getLocalDateString, parseLocalDate, /* ... */ } from '../../src/utils/dateUtils';

describe('dateUtils', () => {
  describe('getLocalDateString', () => {
    it('returns today in YYYY-MM-DD format by default', () => {
      const today = getLocalDateString();
      expect(typeof today).toBe('string');
      expect(/^\d{4}-\d{2}-\d{2}$/.test(today)).toBe(true);
    });
  });
});
```

**Patterns:**
- Nest `describe` per module → per function/feature, `it`/`test` per behavior (both verbs are live; `it` dominates in newer suites, `test` in `logger`/`errorBoundary` suites). Prefix traceability IDs on spec-linked cases: `test('TC-OBS-06: Renders children normally...')`, `test('CR-02: debug/info neither emit nor buffer in production')` in `__tests__/unit/logger.test.js:81`, `__tests__/unit/errorBoundary.test.js:38`
- Set up in `beforeEach`, always restore in `afterEach`/`afterAll`: save/restore `console.*`, `global.__DEV__`, `process.env.NODE_ENV` (`__tests__/unit/logger.test.js:20-42`); `AsyncStorage.clear()` + `FileSystem.__resetFS()` + `jest.clearAllMocks()` (`__tests__/unit/vaultAndFileStorage.test.js:23-29`); `clearCommandHandlers()` + `clearIdempotencyCache()` + `eventBus.clearListeners()` + `eventBus.clearBuffer()` (`__tests__/unit/commandGateway.test.ts:28-33`); save/restore `global.fetch` (`__tests__/unit/syncService.test.js:4-12`)
- Isolate time with fake timers only where needed: `jest.useFakeTimers()` + `jest.advanceTimersByTime(3500)` + `jest.runOnlyPendingTimers()` + `jest.useRealTimers()` for toast timeouts in `__tests__/unit/errorBoundary.test.js:21-36,153-155`; `jest.spyOn(Date, 'now').mockReturnValue(...)` with `mockRestore()` in `finally` for ID/timestamp determinism in `__tests__/unit/generateId.test.js:25-35`
- Assert snapshots immutably: `getRecentLogs()` returns frozen entries — tests prove outside mutation cannot corrupt the buffer (`__tests__/unit/logger.test.js:141-179`)

## Mocking

**Framework:** Jest built-ins only (`jest.fn()`, `jest.mock()`, `jest.spyOn()`, `jest.useFakeTimers()`). No `__mocks__/` directories, no MSW, no Sinon.

**Patterns:**
```javascript
// Global module mocks hoisted in __tests__/setup/jest.setup.js:9-11 — never re-declare per suite
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

```javascript
// Per-test fetch stub — __tests__/unit/syncService.test.js:90-94
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({ status: 'online' }),
});
```

```javascript
// Console suppression + logger spy — __tests__/unit/errorBoundary.test.js:20-27
console.error = jest.fn(); // Suppress React error logging in tests
loggerErrorSpy = jest.spyOn(logger, 'error');
// ... afterEach: loggerErrorSpy.mockRestore();
```

```javascript
// One-shot failure injection — __tests__/unit/errorBoundary.test.js:212
Clipboard.setStringAsync.mockRejectedValueOnce(new Error('clipboard denied'));
Share.share = jest.fn().mockResolvedValue({ action: 'sharedAction' });
```

- Centralize native mocks in `__tests__/setup/jest.setup.js` (wired via `setupFiles` in `jest.config.js:4-8`): in-memory `expo-file-system` virtual FS (`__inMemoryFS` Map + `__resetFS()`), `llama.rn` (`initLlama` → canned completion), `react-native-android-widget`, `expo-notifications` / `expo-haptics` / `expo-sharing` / `expo-document-picker` / `expo-camera` / `expo-clipboard`, `@expo/vector-icons` (renders `Text`), `react-native-reanimated/mock`
- Reset via the harness helpers, not by re-mocking: call `FileSystem.__resetFS()` and `AsyncStorage.clear()` in `beforeEach` (`__tests__/unit/vaultAndFileStorage.test.js:23-29`); call `jest.clearAllMocks()` to reset call counts while keeping implementations
- Mock timers and clocks, not sleeps: `jest.useFakeTimers()` for debounce/toast paths; `jest.spyOn(Date, 'now')` for collision/timestamp tests

**What to Mock:**
- All native/Expo bindings (already mocked globally — just use them): `expo-file-system`, `expo-notifications`, `expo-haptics`, `expo-clipboard`, `expo-camera`, `llama.rn`, `react-native-android-widget`
- Network (`global.fetch`) per test with canned `{ ok, status, json }` payloads — see `pingSyncServer` / `performSync` blocks in `__tests__/unit/syncService.test.js:88-217`
- `console.*` when asserting emission/suppression, `Clipboard.setStringAsync` / `Share.share` for failure-fallback paths

**What NOT to Mock:**
- The module under test and its pure helpers — import the real `src/utils/dateUtils`, `src/utils/generateId`, `src/utils/logger`; exercise real serialization, redaction, and FIFO eviction
- The in-memory FS behavior — write through the real `saveNoteFile`/`readNoteFile` against the virtual FS and assert via `getInfoAsync` round-trips (`__tests__/unit/vaultAndFileStorage.test.js:31-88`)
- Timer/ordering logic — use fake timers + `advanceTimersByTime` rather than mocking the handler

## Fixtures and Factories

**Test Data:**
```javascript
// Inline consts at describe scope — __tests__/unit/syncService.test.js:14-28
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

```typescript
// Typed command fixtures with intentional invalid values — __tests__/unit/commandGateway.test.ts:57-74
const shortKeyCmd: DispatchedCommand<'CREATE_IDENTITY'> = {
  action: 'CREATE_IDENTITY',
  idempotencyKey: 'abc', // < 4 chars
  payload: { statement: 'I am a reader' },
};
```

- No shared `fixtures/` or factory helpers — each suite declares its own inline consts (config objects, payload arrays, `ThrowingComponent` in `__tests__/unit/errorBoundary.test.js:9-14`). Loop invalid inputs inline: `for (const bad of [null, undefined, '', '   ', 'random-junk', ...])` in `__tests__/unit/dateUtils.test.js:90`
- Loop-generated stress data for invariants: 10,000-ID collision set in `__tests__/unit/generateId.test.js:16-22`, 60-entry FIFO overflow in `__tests__/unit/logger.test.js:126-139`

**Location:**
- Inline in each `*.test.js(x)` file. The only shared fixture surface is the virtual FS seed (`/mock-docs/`, `/mock-cache/`) in `__tests__/setup/jest.setup.js:25-26`

## Coverage

**Requirements:** Ratchet gate enforced — floor set just below measured coverage so it cannot silently regress (comment block in `jest.config.js:30-34`). Current thresholds in `jest.config.js:35-42`:

```javascript
coverageThreshold: {
  global: { statements: 47, branches: 38, functions: 35, lines: 50 },
}
```

- Collect from `src/**/*.{js,jsx,ts,tsx}` excluding `src/**/*.styles.js` (`collectCoverageFrom` in `jest.config.js:25-29`); raise toward §24 targets (70/90/95) as engine suites land — do not lower the numbers
- CI runs `npx jest --ci --maxWorkers=2 --coverage` and uploads `coverage/` as an artifact (`.github/workflows/ci.yml:49-66`); a local `coverage/` directory is git-ignored output, not a source

**View Coverage:**
```bash
npm run test:coverage      # jest --coverage, text summary + coverage/ HTML
npx jest --coverage --collectCoverageFrom='src/utils/logger.js'
```

## Test Types

**Unit Tests:**
- Scope: pure utils, services, engines, validators, contexts — the entire `__tests__/unit/` tree (28 suites, ~457 tests). Assert return values, validation fragments, buffer/state transitions, and redaction invariants. Examples: `logger.test.js` (level gating, ring-buffer, PII redaction, babel config contract), `dateUtils.test.js` (local-timezone math, leap years, boundary rollovers), `generateId.test.js` (format regex, 10k-call uniqueness), `syncService.test.js` (config/payload validation, ping/sync flows), `vaultAndFileStorage.test.js` (vault CRUD + filename sanitization)

**Integration Tests:**
- Scope: multi-module command/behavior pipelines using real collaborators with mocked edges: `commandGateway.test.ts` (validator + executor + idempotency cache + eventBus, 591 lines), `commandIntegration.test.ts`, `behavioralPipelineE2E.test.ts`, `exportImportService.test.js`, `storageMigration.test.js`, `aiAssistant-smoke.test.js`. Pattern: clear all registries/buffers in `beforeEach`, dispatch typed commands, assert state + emitted events + idempotency dedupe

**E2E Tests:**
- Not used — no Detox/Maestro/Appium config detected. Device-level verification is manual via `expo run:android` / Expo dev client (`npm run android`, `npm start`). The closest coverage is `behavioralPipelineE2E.test.ts` (in-Jest pipeline test, not on-device) and `phase12-widget-logic.test.js` (headless widget logic)

## Common Patterns

**Async Testing:**
```javascript
// Await the real async API, assert the resolved value — __tests__/unit/vaultAndFileStorage.test.js:46-59
it('creates a new vault with generated id, adds it to storage, and creates its folder', async () => {
  const newVault = await createVault('Project Alpha');
  expect(newVault.name).toBe('Project Alpha');
  const vaults = await getVaults();
  expect(vaults.length).toBe(1);
});

// Flush pending promises inside React act() — __tests__/unit/errorBoundary.test.js:132-134
await act(async () => {
  await instance.handleCopyReport();
});
expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
```

**Error Testing:**
```javascript
// Validator throws — match the message fragment — __tests__/unit/syncService.test.js:50-54
expect(() => validateSyncConfig({ ...validConfig, port: 0 })).toThrow('out of bounds');
expect(() => validateSyncPayload(null)).toThrow('Malformed server response');

// Async rejection injection — __tests__/unit/errorBoundary.test.js:235-253
Clipboard.setStringAsync.mockRejectedValueOnce(new Error('clipboard denied'));
Share.share = jest.fn().mockRejectedValueOnce(new Error('share denied'));
// ... assert failure UI, not success toast:
expect(instance.state.copiedToast).toBe(false);
expect(instance.state.copyFailed).toBe(true);
expect(combinedText).toContain('Copy failed — please screenshot this screen');
```

**Render/Component Testing:**
- Use `react-test-renderer` + `act()` for `ErrorBoundary` flows (`__tests__/unit/errorBoundary.test.js`): `renderer.create(<ErrorBoundary>...)` inside `act`, query via `root.findByProps({ testID })` / `root.findAllByType(Text)`, drive instance methods (`handleRetry`, `toggleDetails`, `handleCopyReport`, `handleRestartPrompt`), assert `instance.state.*` transitions and `combinedText` copy contracts

**Quality Gates (CI — `.github/workflows/ci.yml`):**
1. `npm ci` → `npm run lint` (blocking; warnings tolerated, errors fail) → always generate `eslint-report.json` artifact
2. `npm run typecheck` (blocking `tsc --noEmit`)
3. `npx jest --ci --maxWorkers=2 --coverage` (blocking, incl. coverage ratchet) → upload `coverage/` artifact
- Per `GEMINI.md` §3, all three must pass before any task counts as verified; Semgrep runs separately via `.github/workflows/semgrep.yml`

---

*Testing analysis: 2026-10-12*
