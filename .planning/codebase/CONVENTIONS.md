# Conventions

**Analysis Date:** 2026-10-11

## Code Style

**Formatter:** No Prettier config in repo (no `.prettierrc*` / `prettier.config.*`). Style is enforced by ESLint + human convention, not auto-format.

**Linter:** ESLint 9 flat config is authoritative — `eslint.config.js:6-48`. Legacy `.eslintrc.js:1-34` is retained for tooling compat; keep both in sync if you touch rules. Run via `package.json:10` (`npm run lint` → `eslint .`).

**Key rules (`eslint.config.js:31-46`):**
- `react-hooks/rules-of-hooks: error` — never call hooks conditionally.
- `react-hooks/exhaustive-deps: warn`, `react-native/no-unused-styles: warn`, `react-native/no-inline-styles: warn`, `react-native/no-color-literals: warn` — warnings, not errors; fix new ones, tolerate pre-existing (~849 warnings per `.github/workflows/ci.yml:33-35`).
- `react/prop-types: off`, `react-native/no-raw-text: off`, `react-native/sort-styles: off`.
- `no-unused-vars: warn` with `argsIgnorePattern: ^_` (`eslint.config.js:42`) — prefix intentionally unused args with `_`.
- `no-console: warn` (`eslint.config.js:46`, deferred escalation per WR-09 comment) — never add raw `console.*` in `src/`; use `src/utils/logger.js`.
- `babel.config.js:15-17` strips `console.log/info/debug` in production builds (keeps `error`/`warn`).

**JS/JSX idiom:** 2-space indent, double quotes, semicolons, CommonJS only in config files (`jest.config.js:1`, `babel.config.js:1`). `src/` is ESM (`import`/`export`). Functional components as arrow consts with named exports, e.g. `src/components/CustomButton.js:6`.

**Styles:** Every component defines `StyleSheet.create` at file bottom (e.g. `src/components/CustomButton.js:68-105`, `src/components/ErrorBoundary.js:301-407`). Inline style arrays for theme overrides only: `style={[styles.safeArea, { backgroundColor }]}` (`src/components/ErrorBoundary.js:164`).

## Naming

**Files:**
- Components: `PascalCase.js` matching export — `CustomButton.js`, `TaskCard.js`, `ErrorBoundary.js` in `src/components/`.
- Screens: `*Screen.js` — `src/screens/DashboardScreen.js`, `TaskListScreen.js`.
- Contexts: `*Context.js` — `src/context/TaskContext.js`, `HabitContext.js`.
- Utils/services: `camelCase.js` — `src/utils/dateUtils.js`, `taskMutations.js`, `vaultService.js`.
- Typed domains: `camelCase.ts` colocated — `src/behavior/eventBus.ts`, `cueEngine.ts`, `src/services/notificationService.ts`.
- Tests: `*.test.js` / `*.test.ts` mirroring module name — `dateUtils.test.js`, `eventBus.test.ts` (see TESTING.md).

**Components:** `PascalCase` (`CustomButton`, `ErrorBoundary`, `TaskCard`). Props destructured inline (`src/components/CustomButton.js:6`).

**Functions:** `camelCase` verbs — `getLocalDateString`, `parseLocalDate`, `isSameLocalDay` (`src/utils/dateUtils.js:14,63,157`), `clearAllCaches`, `migrateUserDataIfNeeded` (`src/utils/storage.js:30,74`), `generateEventId` (`src/behavior/eventBus.ts:17`).

**Variables/constants:** `camelCase` locals; `UPPER_SNAKE` for exported constants — `MAX_LOG_BUFFER_SIZE` (`src/utils/logger.js:13`), `APP_VERSION`/`STORAGE_VERSION` (`src/utils/storage.js:4-5`), `MAX_EVENT_BUFFER_SIZE` (`src/behavior/eventBus.ts:10`).

**Storage keys:** `kwestup_<domain>_<version>` prefix, guarded by `isUserDataKey` (`src/utils/storage.js:8-27`).

**Tests:** `describe('<module path>')` → nested `describe` per function/TC-ID → `it/test('<behavior>')`, e.g. `__tests__/unit/dateUtils.test.js:17-18`, `__tests__/unit/eventBus.test.ts:40` (`TC-EVT-01` tags).

## Imports & Aliases

**No path aliases.** No `tsconfig.json` `paths`/`baseUrl`, no `babel-plugin-module-resolver`. All imports are relative (`../`, `../../`).

**Order (observed, follow it):**
1. `react` / `react-native` (`src/components/ErrorBoundary.js:1-11`, `src/context/TaskContext.js:1-2`)
2. Third-party / Expo (`@expo/vector-icons`, `expo-clipboard`, `expo-haptics`, `@react-native-async-storage/async-storage`) (`src/components/ErrorBoundary.js:12-13`, `src/utils/storage.js:1`)
3. Internal relative (`../utils/logger`, `../utils/storage`, `./CustomButton`) (`src/components/ErrorBoundary.js:14-16`, `src/context/TaskContext.js:5-22`)

**Type imports:** TS domains import types from sibling `./types` (`src/behavior/eventBus.ts:3-8`). Tests import directly from `../../src/...` (`__tests__/unit/logger.test.js:1-10`).

## Error Handling & Logging

**Logger is mandatory** — `src/utils/logger.js:142-162` exports `debug/info/warn/error`, `getRecentLogs`, `clearLogs`, `logger` default. `/* eslint-disable no-console */` appears only in `src/utils/logger.js:1`; nowhere else.

- `debug`/`info` are dev-gated (no console, no buffer in prod) — `src/utils/logger.js:142-152`.
- `warn`/`error` always buffer + passthrough — `src/utils/logger.js:154-162`.
- PII redaction before buffering via `SENSITIVE_KEYS` regex (`src/utils/logger.js:37-38`); 50-entry deep-frozen FIFO ring buffer (`src/utils/logger.js:13,116-134`).
- `logger.test.js:181-204` pins redaction; `logger.test.js:81-87` pins prod silencing.

**Pattern:** `try/catch` at async boundaries, log + return safe fallback (`false`/`[]`/`null`), never rethrow to UI:
```js
// src/utils/storage.js:67-70
} catch (error) {
  logger.error("❌ CACHE CLEAR FAILED:", error);
  return false;
}
```
Highest `logger.*` density in `src/utils/diagnostics.js` (21), `src/utils/aiService.js` (15), `src/utils/vaultService.js` (15), `src/utils/storage.js` (13). Pure utils (`src/utils/dateUtils.js`) use zero logging — return `''` / `Invalid Date` instead (`src/utils/dateUtils.js:43,83`).

**UI errors:** `ErrorBoundary` (`src/components/ErrorBoundary.js:18-40`) catches via `getDerivedStateFromError` + `componentDidCatch` → `logger.error` (`src/components/ErrorBoundary.js:39`), renders retry/copy-report/restart UI with 8000-char capped report (`src/components/ErrorBoundary.js:93-97`).

**EventBus isolation:** listener throw/reject is caught + logged, never breaks dispatch (`__tests__/unit/eventBus.test.ts:172-225`).

**JSDoc contracts:** every `src/utils/*.js` public function carries `@param`/`@returns` (e.g. `src/utils/dateUtils.js:8-13`, `src/utils/logger.js:17-21`). Keep them; they substitute for TS types in JS files.

## Type Safety

- `tsconfig.json:4` — `strict: true`, `allowJs: true`, `checkJs: false` (deliberate; enabling surfaces ~1152 legacy JS errors per `tsconfig.json:6-11`). `npm run typecheck` (`tsc --noEmit`, `package.json:12`) covers `src/**/*`, `widgets/**/*`, `__tests__/**/*` (`tsconfig.json:15-24`).
- New typed code goes in `.ts` with explicit interfaces/unions — see `src/behavior/types.ts:22-39` (`Habit`), `src/behavior/types.ts:130-176` (`BehaviorEvent`), `src/behavior/types.ts:178-188` (`DomainEventInput`, `DomainEventListener`).
- Defensive TS idioms to copy: deep-freeze emitted events (`__tests__/unit/eventBus.test.ts:286-308`), `structuredClone`→JSON fallback (`src/behavior/eventBus.ts:31-43`), `// @ts-ignore` only for missing test-renderer types (`__tests__/unit/eventBus.test.ts:2`).
- Do not flip `checkJs: true` or add `coverageThreshold` without triaging the tracked debt (see comments in `tsconfig.json:6-11`, `jest.config.js:30-33`).

## Do/Don't

**Do:**
- Use `logger.debug/info/warn/error` from `src/utils/logger.js` — never raw `console.*` (production strip + PII redaction depend on it).
- Use `src/utils/dateUtils.js` (`getLocalDateString`, `parseLocalDate`, `isSameLocalDay`) for all calendar logic — never `toISOString().slice(0,10)` (UTC-shift bug the module exists to prevent).
- Put shared date/storage/sync logic in `src/utils/` as pure named exports with JSDoc; put typed domain logic in `src/behavior/*.ts` / `src/services/*.ts`.
- Prefix unused fn args with `_` (satisfies `no-unused-vars` + `argsIgnorePattern`).
- Emit domain changes through `eventBus.emit` with `{ type, entityId, source }` (`__tests__/unit/eventBus.test.ts:45-50`); spy on `logger` with `jest.spyOn(logger, 'error').mockImplementation(...)` + `mockRestore` (`__tests__/unit/eventBus.test.ts:21-28`).
- Clear module/global state in `beforeEach` (`clearLogs`, `eventBus.clearListeners/clearBuffer`) — copy `__tests__/unit/logger.test.js:20-33`.

**Don't:**
- Don't add path aliases, Prettier configs, or new lint plugins without updating both `eslint.config.js` and `.eslintrc.js` + CI.
- Don't use `console.log` for debugging in `src/` — it trips `no-console: warn` and ships noise (use `logger.debug`).
- Don't store user text/tokens in logs — `SENSITIVE_KEYS` redacts by key name, so name fields conventionally (`title`, `content`, `token`).
- Don't mutate `getRecentLogs()` / `getRecentEvents()` snapshots — entries are frozen; treat as readonly.
- Don't parse `YYYY-MM-DD` with `new Date(str)` (UTC midnight) — use `parseLocalDate` (`src/utils/dateUtils.js:63`).

---
*Convention analysis: 2026-10-11*
