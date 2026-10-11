# Conventions

**Analysis Date:** 2026-10-11

## Code Style

**Formatter:** No Prettier/Biome config detected — formatting is by hand (2-space indent, single quotes, trailing semicolons, ~100-col soft limit).

**Linter:** ESLint 9 flat config is authoritative — `eslint.config.js:6-65`. Legacy `.eslintrc.js:1-34` is a stale mirror (same rules); do not edit it for new rules.
- `npm run lint` → `eslint .` (`package.json:10`); `npm run lint:report` emits `eslint-report.json` (`package.json:11`).
- Key rules (`eslint.config.js:31-47`): `react/react-in-jsx-scope: off`, `react/prop-types: off`, `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn`, `react-native/no-unused-styles: warn`, `react-native/no-inline-styles: warn`, `react-native/no-color-literals: warn`, `react-native/no-raw-text: off`, `react-native/sort-styles: off`, `no-unused-vars: warn (argsIgnorePattern ^_)`, `no-console: warn` (kept at warn per WR-09 partial, `eslint.config.js:43-46` — ~100 pre-existing `console` calls untriaged).
- Ignores (`eslint.config.js:8`): `node_modules, .expo, dist, web-build, android, ios, assets, KwestUpPC, coverage, eslint-report.json`.
- Test-file override (`eslint.config.js:49-64`): declares Jest globals (`describe/it/expect/beforeEach/...`) for `__tests__/**/*` and `*.test.js` — do not add `/* global */` comments in tests.
- Production `console` stripping is a Babel concern, not ESLint: `babel.config.js:15-17` pushes `transform-remove-console {exclude: [error, warn]}` only when `NODE_ENV=production`; verified by `__tests__/unit/logger.test.js:230-261`.

## Naming

**Files:**
- Components (JS): `PascalCase.js` — `src/components/AIAssistant.js`, `src/components/TaskCard.js`, `src/components/ErrorBoundary.js`, `src/components/LiquidGlassCard.js`.
- Engines / services / utils: `camelCase.{js,ts}` — `src/utils/aiService.js`, `src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/commands/commandExecutor.ts`, `src/behavior/habitEngine.ts` (inferred).
- New TypeScript modules: `camelCase.ts` — `src/ai/intentParser.ts:1`, `src/ai/behaviorCompiler.ts:1`, `src/commands/types.ts:1`, `src/commands/aiSandbox.ts:1`.
- Tests: `__tests__/unit/<module>.test.{js,ts}` matching source basename (`intentParser.test.ts`, `behaviorCompiler.test.ts`, `logger.test.js`); one outlier at `__tests__/phase12-widget-logic.test.js:1` (top-level, not under `unit/`).

**Components:** PascalCase function/const matching filename (`TaskCard`, `LiquidGlassCard`, `ErrorBoundary` in `src/components/`). Screens end in `Screen` (`src/screens/TaskListScreen.js`, `src/screens/SettingsScreen.js`).

**Functions:** `camelCase` verbs — `parseUserIntent` (`src/ai/intentParser.ts:33`), `compileIntentToHabitPlan` / `compileIntentToCommand` / `compileAndExecuteIntent` (`src/ai/behaviorCompiler.ts:78,192,510`), `executeAiCommand` / `sanitizeAiPayload` (`src/commands/aiSandbox.ts:100,117`), `registerCommandHandler` (`src/commands/commandExecutor.ts:43`). Pure derivations use `derive*` / `generate*` / `normalize*` / `retrieve*` prefixes (`deriveIdentityStatement` at `src/ai/behaviorCompiler.ts:63`, `normalizeTimeString` in `src/ai/heuristicParser.ts`).

**Variables:** `camelCase`; never-match factories return early with `heuristic` / `result` / `packet` locals (`src/ai/intentParser.ts:52-54`). Constants are `SCREAMING_SNAKE` with rule-ID values — `MAX_USER_INPUT_LENGTH = 500`, `MAX_OUTPUT_TOKENS = 120` (`src/ai/intentParser.ts:18-19`), `MAX_LOG_BUFFER_SIZE = 50` (`src/utils/logger.js:13`), `MAX_IDEMPOTENCY_CACHE_SIZE = 200` (`src/commands/commandExecutor.ts:22`). Rule IDs are string literals: `HABIT_IDENTITY_ANCHOR_001`, `SYS_AI_CONFIRMATION_GATE_001` (`src/ai/behaviorCompiler.ts:114,538`).

**Tests:** `describe('<module>')` → nested `describe('<unit>')` → `it('<behavior>', ...)` (`__tests__/unit/intentParser.test.ts:13-14`, `__tests__/unit/behaviorCompiler.test.ts:25,53`). Use `test(...)` interchangeably in older suites (`__tests__/unit/logger.test.js:49-67`); prefer `it` in new TS suites.

## Imports & Aliases

**No path aliases** — `tsconfig.json:1-28` extends `expo/tsconfig.base` with only `strict`/`allowJs`/`checkJs` overrides; `babel.config.js:1-26` defines zero `module-resolver`/`alias` plugins. Every import is relative.
- Same-folder: `./types`, `./heuristicParser` (`src/ai/intentParser.ts:12-13`).
- Cross-layer: `../utils/logger`, `../behavior/eventBus`, `../behavior/habitEngine` (`src/ai/behaviorCompiler.ts:13-23`, `src/commands/commandExecutor.ts:17-20`).
- Barrel re-exports per bounded context: `src/ai/index.ts:10-14` (`export * from './types'` etc.), `src/commands/index.ts` (mirror pattern).
- Import order convention (observed, not enforced): (1) type imports, (2) sibling modules, (3) cross-layer `../` modules, (4) no external-first grouping — follow `src/ai/intentParser.ts:12-16` and `src/ai/behaviorCompiler.ts:13-23` as the template. Do not introduce `@/` or `~/` aliases without a Babel+TS+Jest triple change.

## Error Handling & Logging

**Result objects, not throws, at module boundaries.** Return `{ success, errors?, rulesApplied }` / `{ success, message, error?, requestId, requiresConfirmation? }`:
- Compiler: `CompilationResult` (`src/ai/types.ts:43-50`); every failure branch returns `success: false` with a human-readable `errors[0]` (`src/ai/behaviorCompiler.ts:84-98,104-110`).
- Gateway/sandbox: `CommandExecutionResult` (`src/commands/types.ts:108-115`); malformed AI JSON → `success:false, message:'', error:'...'` (`src/commands/aiSandbox.ts:127-133,136-143`); unconfirmed destructive → `requiresConfirmation:true` + `rulesApplied:['SYS_AI_CONFIRMATION_GATE_001']` (`src/commands/aiSandbox.ts:178-187`, `src/ai/behaviorCompiler.ts:531-540`).
- `try/catch` is for **fallback, never propagation**: LLM unavailable/timeout/malformed → log at `debug` and return heuristic result (`src/ai/intentParser.ts:134-139,143-148,175-178`); sanitize rejection → `logger.warn` + failure result (`src/commands/aiSandbox.ts:157-167`).

**Logger:** Use `import { logger } from '../utils/logger'` (`src/ai/intentParser.ts:16`) — never raw `console.*` in `src/` (lint warns; Babel strips `log/info/debug` in prod).
- Levels (`src/utils/logger.js:142-162`): `logger.debug/info` emit + buffer **only in dev** (`__DEV__`/NODE_ENV gate, `src/utils/logger.js:21-26`); `logger.warn/error` always emit + buffer.
- File starts with `/* eslint-disable no-console */` (`src/utils/logger.js:1`) — that pragma is exclusive to the logger; do not copy it elsewhere.
- Buffer: 50-entry deep-frozen FIFO ring (`src/utils/logger.js:13,116-134`); PII keys redacted pre-buffer (`SENSITIVE_KEYS`, `src/utils/logger.js:37-38`).

## Type Safety

- `tsconfig.json:4` — `strict: true`; `checkJs: false` (1152 pre-existing JS errors untriaged per comment `tsconfig.json:6-12` — do not flip to `true`).
- New code is **TypeScript with explicit contracts**: `ExtractedIntent`, `CompilationResult` (`src/ai/types.ts:13-50`); generic `CommandPayload<A extends CommandAction>` discriminated union + `DispatchedCommand` with required `idempotencyKey` (`src/commands/types.ts:26-123`).
- Validate-then-narrow at trust boundaries: `sanitizeAiPayload` rejects non-plain objects, functions/symbols/undefined, prototype-pollution keys, `kwestup_*`/path-traversal patterns (`src/commands/aiSandbox.ts:15-18,32-106`); JSON extraction guards (`src/ai/intentParser.ts:150-156`).
- `npm run typecheck` → `tsc --noEmit` (`package.json:12`) — CI runs it after lint (`.github/workflows/ci.yml:39-40`).

## Do / Don't (from actual code)

- ✅ DO return `{ success:false, errors:[...], rulesApplied }` with the rule ID that fired — e.g. cap rejection carries `HABIT_CONCURRENT_CAP_001` (`src/ai/behaviorCompiler.ts:102-130`).
- ✅ DO gate destructive AI actions on `options.confirmed === true` and surface `requiresConfirmation` (`src/ai/behaviorCompiler.ts:530-540`, `src/commands/aiSandbox.ts:178-187`).
- ✅ DO clear `clearCommandHandlers()`, `clearIdempotencyCache()`, `eventBus.clearListeners()/clearBuffer()` in `beforeEach` for gateway-adjacent tests (`__tests__/unit/behaviorCompiler.test.ts:28-33`).
- ✅ DO `jest.spyOn(aiService, 'loadModel')` + `jest.restoreAllMocks()` in `afterEach` when testing LLM fallback paths (`__tests__/unit/intentParser.test.ts:156-165`).
- ❌ DON'T call `console.log/info/debug` in `src/` — use `logger.debug` (silenced + unbuffered in prod, `src/utils/logger.js:142-146`).
- ❌ DON'T pass `Date`/class instances/functions through the AI sandbox — only plain JSON values survive `sanitizeValue`, else `Security violation` (`src/commands/aiSandbox.ts:58-92`).
- ❌ DON'T let AI payloads self-authorize: `confirmed` comes from `options`, never from parsed input (`src/commands/aiSandbox.ts:169-175`).
- ❌ DON'T add `@/` imports — no alias exists in Babel/TS/Jest; use relative paths only.

---
*Convention analysis: 2026-10-11*
