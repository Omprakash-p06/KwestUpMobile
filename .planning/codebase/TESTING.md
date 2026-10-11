# Testing

**Analysis Date:** 2026-10-11

## Runner & Config

- **Runner:** Jest 29 (`jest@^29.7.0`, `package.json:65`) with preset `jest-expo/android` (`jest.config.js:4`).
- **Config:** `jest.config.js:1-35` — `setupFiles` chains the expo-android preset + `<rootDir>/__tests__/setup/jest.setup.js:5-7`; `transformIgnorePatterns` allowlists RN/Expo/`llama.rn`/`react-native-android-widget` (`jest.config.js:9-11`); `moduleFileExtensions` prioritises `android.*` variants (`jest.config.js:12-23`).
- **Scripts** (`package.json:13-15`): `npm test` → `jest`; `npm run test:watch` → `jest --watch`; `npm run test:coverage` → `jest --coverage`.
- **Collection:** `testMatch: ['**/__tests__/**/*.test.[jt]s?(x)']` (`jest.config.js:24`) — tests **only** run under `__tests__/`. `collectCoverageFrom: src/**/*.{js,jsx,ts,tsx}` excluding `*.styles.js` (`jest.config.js:25-29`).
- **Thresholds:** none — `jest.config.js:30-33` (CR-09 partial) documents ~28% lines / ~17% functions as of 2026-10-01, so a 70% gate would red CI. Do not add `coverageThreshold` until Phase 22/24 engine suites land.

## Test Layout

All tests live in `__tests__/` (zero `src/**/*.test.*` — verified by glob miss):
- `__tests__/setup/jest.setup.js:1-223` — global harness (see Mocks).
- `__tests__/setup/jest.setup.test.js` — meta-test asserting the harness itself.
- `__tests__/unit/` — 23 suites, all flat (no subfolders): `aiSandbox.test.ts`, `aiService.test.js`, `behaviorCompiler.test.ts`, `behaviorRuleEngine.test.ts`, `commandGateway.test.ts`, `commandIntegration.test.ts`, `dateUtils.test.js`, `domainEventInstrumentation.test.js`, `errorBoundary.test.js`, `eventBus.test.ts`, `exportImportService.test.js`, `habitContext.test.js`, `intentParser.test.ts`, `interventionEngine.test.ts`, `logger.test.js`, `notificationService.test.ts`, `storageMigration.test.js`, `syncService.test.js`, `taskContext.test.js`, `taskMutations.test.js`, `vaultAndFileStorage.test.js`, `aiAssistant-smoke.test.js`, `behavioralWidget.test.ts`.
- `__tests__/phase12-widget-logic.test.js` — top-level outlier (widget-logic suite, 12 tests).
- **Counts (measured 2026-10-11 via `it(|test(` grep):** 441 total — engine-heavy areas: `eventBus` 43, `aiService` 41, `notificationService` 38, `habitContext` 30, `dateUtils` 29, `behaviorRuleEngine` 27, `intentParser` 22, `interventionEngine` 22, `logger` 19, `commandGateway` 18, `domainEventInstrumentation` 17, `syncService` 16, `taskMutations` 15, `behaviorCompiler` 14, `aiSandbox` 12, `phase12-widget-logic` 12, `behavioralWidget` 11, `vaultAndFileStorage` 11, `errorBoundary` 10, `exportImportService` 10, `commandIntegration` 9, `storageMigration` 9, `taskContext` 5, `aiAssistant-smoke` 1.
- Canonical suite shapes: nested-`describe` + `it` for TS engine suites (`__tests__/unit/intentParser.test.ts:13-66`, `__tests__/unit/behaviorCompiler.test.ts:25-71`); flat `describe` + `test` for older JS suites (`__tests__/unit/logger.test.js:12-42`).

## Mocks & Fixtures

- **Global harness** (`__tests__/setup/jest.setup.js`): AsyncStorage → official in-memory mock (`:9-11`); `expo-file-system` → `Map`-backed virtual FS with `__inMemoryFS`/`__resetFS` helpers (`:15-117`); `llama.rn` → `initLlama` resolving `{ completion, release, tokenize, detokenize }` (`:120-128`); `react-native-android-widget`, `expo-notifications`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-camera`, `expo-clipboard`, `@expo/vector-icons`, `react-native-reanimated/mock` (`:131-223`). Nothing to import — harness loads via `setupFiles`.
- **Per-test LLM control** (`__tests__/unit/intentParser.test.ts:153-165`): build `mockLlamaContext = { completion: jest.fn() }`, `jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(()=>{})`, `jest.spyOn(aiService,'isModelDownloaded'|'loadModel')` per case; always `jest.restoreAllMocks()` in `afterEach`.
- **Gateway isolation** (`__tests__/unit/behaviorCompiler.test.ts:28-33`): `clearCommandHandlers(); clearIdempotencyCache(); eventBus.clearListeners(); eventBus.clearBuffer();` in `beforeEach`; register throwaway handlers via `registerCommandHandler('CREATE_HABIT', mockFn)` (`:269-273`).
- **Inline fixtures**, no fixture dir: `activeHabitsFixture: Habit[]` built literally in `beforeEach` (`__tests__/unit/behaviorCompiler.test.ts:26-51`); `ExtractedIntent` literals per case (`:73-82`); invalid-input probes use `null as any` (`__tests__/unit/intentParser.test.ts:61`). Console capture pattern: stash `console.*`, replace with `jest.fn()`, restore in `afterEach` (`__tests__/unit/logger.test.js:20-42`).

## Coverage

- **How to run:** `npm run test:coverage` (`jest --coverage`); CI runs `npx jest --ci --maxWorkers=2 --coverage` (`.github/workflows/ci.yml:43`) and uploads `coverage/` as an artifact (`:53-59`).
- **Current state:** no enforced threshold (`jest.config.js:30-33`); last recorded ~28% lines / ~17% functions across 26 suites / 358 tests (2026-10-01 comment). Local `coverage/` dir exists (`clover.xml`, `coverage-final.json`, `lcov.info`) but no `coverage-summary.json` — regenerate via `npm run test:coverage` for totals. `collectCoverageFrom` covers all of `src/` except `*.styles.js`.
- **Gaps (by inspection):** `src/screens/*`, `src/navigation/*`, `App.js` largely untested (also the reason `checkJs` stays off, `tsconfig.json:6-12`); `aiAssistant-smoke` has 1 test; `taskContext` has 5.

## CI Gate

- **Workflow:** `.github/workflows/ci.yml:16-59` — single `lint-and-test` job on `ubuntu-latest`, triggers on push/PR to `main`/`development` (`:3-7`), `contents: read` + `cancel-in-progress` concurrency (`:9-14`).
- **Steps in order:** `npm ci` → `npm run lint` (plain, no `--max-warnings=0` per WR-10 partial — ~849 pre-existing warnings, `ci.yml:33-37`) → `npm run typecheck` (`tsc --noEmit`, `:39-40`) → `npx jest --ci --maxWorkers=2 --coverage` (`:42-43`) → upload `eslint-report.json` + `coverage/` artifacts (`:45-59`).
- **Security:** separate `semgrep` job (`ci.yml:61-70`, config `auto` in `.github/workflows/semgrep.yml`) with `continue-on-error: true` — advisory only, never blocks merge.

## How to Add a Test

1. Create `__tests__/unit/<module>.test.ts` (TS for `src/**/*.ts`, `.js` for `src/**/*.js`) — must match `testMatch` (`jest.config.js:24`); never co-locate in `src/`.
2. Copy the header + import block from `__tests__/unit/intentParser.test.ts:1-11` (docblock with `Requirements Covered` + `Codebase Alignment`, then relative `../../src/...` imports).
3. Structure: `describe('<module>', ...)` → nested `describe('<unit>')` → `it('<expected behavior>', ...)` per `__tests__/unit/behaviorCompiler.test.ts:25-53`.
4. If touching gateway/AI: add the `beforeEach` isolation trio (`clearCommandHandlers/clearIdempotencyCache/eventBus.clear*`, `behaviorCompiler.test.ts:28-33`) or the `aiService` spy/`restoreAllMocks` pair (`intentParser.test.ts:156-165`).
5. Prefer deterministic paths: pass `{ forceHeuristic: true }` or `{ timeoutMs: 50 }` to avoid real LLM (`intentParser.test.ts:233,259`); assert `source: 'heuristic'` + `rulesApplied`/`rulesRetrieved` IDs.
6. Run `npx jest __tests__/unit/<module>.test.ts` then `npm run typecheck` and `npm run lint` — all three must pass for CI (`.github/workflows/ci.yml:36-43`).

---
*Testing analysis: 2026-10-11*
