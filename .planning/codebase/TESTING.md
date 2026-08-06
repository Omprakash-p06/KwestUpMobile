# Testing Patterns

**Analysis Date:** 2026-08-06

## Current State

There is **no automated test framework configured** for this project.

- `package.json` has **no `test` script** and **no `jest`, `vitest`, `mocha`, or `@testing-library` dependencies**. Scripts are only `start`, `android`, `ios`, `web`, `lint`, `lint:report`, `postinstall`.
- **No `jest.config.*`** and no `setupFiles` / `testMatch` configuration anywhere.
- The only test file in the repo is `__tests__/phase12-widget-logic.test.js`, which is a **standalone manual runner** that executes with plain Node (no framework).
- CI (`.github/workflows/semgrep.yml`) runs only a Semgrep OSS security scan on push/PR to `main`/`develop`. There is **no unit/integration testing step** in CI.

The test file itself documents this: its header states *"As of Phase 12, KwestUp Mobile has no Jest runner configured."* and lists the install command to enable Jest:

```bash
npm install --save-dev jest babel-jest @babel/preset-env @babel/preset-react
```

**Recommendation for new tests today:** follow the existing manual-runner pattern below so tests run without a new build step. If a test harness is added later, migrate to `jest`/`@testing-library/react-native`, but keep the pure-function unit tests framework-agnostic.

## Current Runner (Manual, no framework)

The sole test file `__tests__/phase12-widget-logic.test.js` implements its own tiny assertion harness and can be executed with:

```bash
node __tests__/phase12-widget-logic.test.js
```

It is also intended to be optionally run via `npx jest __tests__/phase12-widget-logic.test.js` after installing Jest.

### Manual harness pattern

```js
const results = [];
let passed = 0;
let failed = 0;

function test(id, description, fn) {
  try {
    fn();
    results.push(`  ✅ [${id}] ${description}`);
    passed++;
  } catch (e) {
    results.push(`  ❌ [${id}] ${description}\n       → ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, label) {
  if (a !== b)
    throw new Error(`${label || 'Expected'} ${JSON.stringify(b)} but got ${JSON.stringify(a)}`);
}
```

The file ends with a report that prints totals and exits non-zero on any failure:

```js
console.log(`\n${passed + failed} total  |  ${passed} passed  |  ${failed} failed\n`);
if (failed > 0) process.exit(1);
```

## Test File Organization

**Location:** one directory at repo root: `__tests__/`. There is no mirror of `src/` — tests are not co-located with source.

**Naming:** `<phase>-<descriptive-name>.test.js`, matching the current file `phase12-widget-logic.test.js`.

**Structure (important — re-duplicated logic, not imports):** the test file defines **inline pure-function re-implementations** of the logic under test (`toggleTaskInList`, `isValidTab`, `sortAndSliceTasks`, `filterImportantTasks`) rather than importing from `src/`/`widgets/`. This is deliberate so tests run without a native/React environment (no AsyncStorage, no `react-native-android-widget`). It means the tests verify behavior parity, not the exact shipped function. For stricter testing, refactor shared pure logic out of `widgets/widget-task-handler.tsx` into an importable module and test that import directly.

## Test Suite Organization

Each core case is a desktop-delimited block: a numbered `test(id, description, fn)` call guarded by a `// [12-Pn] Description` separator comment, mapping back to a phase ID in a checklist at the top of the file (e.g. `[12-P8] Sort order: completed tasks sink to bottom`).

```js
test('12-P8', 'Sort: uncompleted tasks appear before completed tasks in widget payload', () => {
  const tasks = [ /* fixtures */ ];
  const sorted = sortAndSliceTasks(tasks, 8);
  assert(sorted[0].completed === false, 'First item must be uncompleted');
  // ...
});
```

## Fixtures

- Inline fixtures in test bodies: each test builds its small sample object (`tasks` arrays with `id`, `title`, `important`, `completed`, `completedAt`, `completedDate`) inline (`phase12-widget-logic.test.js:115`).
- Edge cases are covered explicitly: empty arrays, missing ids, `null` storage raw, invalid enum values (`phase12-widget-logic.test.js` `12-P3`, `12-P4`, `12-P5`).

## Mocking

- **None used.** No mocking framework exists. The test design avoids mocking by testing pure functions only.
- **What to mock when Jest is added:** the native/Expo modules — `@react-native-async-storage/async-storage` (`AsyncStorage`), `react-native-android-widget` (`requestWidgetUpdate`, `WidgetTaskHandlerProps`), `expo-*` (notifications, haptics, file-system, sharing). Jest would need `jest.mock(...)` stubs for these.
- **What to avoid mocking:** pure `toJSON()` / `slice(0, N)`-style requirements are the only stable surface; prefer real data phases.

## Coverage

- **No coverage tooling or thresholds configured.** No `coverage` script, no `collectCoverageFrom`, no coverage reports in CI.
- To view ad-hoc coverage once Jest is added: `npx jest --coverage`.

## Test Types

- **Unit tests:** present only for the widget reducer helpers (toggle / sort / slice / filter invariants). These are the main tested surface.
- **Integration tests:** none (UI/state/service integration is untested; `App.js` is a 1267-line monolith with no test).
- **E2E:** none (no Detox/Maestro/Appium setup).

## Logging / Reporting Convention

- Emoji result markers (`✅`/`❌`) are used per case, consistent with the app-wide emoji-prefixed logging convention (see `CONVENTIONS.md`).

## Planned Direction (from test header)

The file explicitly intends future migration to Jest; keep new pure functions and domain logic in plain importable modules so they remain framework-agnostic and trivially unit-testable.

## Running Checks

- **Lint only:** `npm run lint` (ESLint flat config) — this is the only automated quality check that ships with the repo.
- **Security:** the `.github/workflows/semgrep.yml` CI job runs a Semgrep OSS scan.

---

*Testing analysis: 2026-08-06*