# Coding Conventions

**Analysis Date:** 2026-10-18

## Language Split

The codebase is intentionally bi-lingual and split by directory:

| Area | Language | Files |
|------|----------|-------|
| UI, screens, components, context, theme | JavaScript (ES2021 + JSX) | `src/screens/*.js`, `src/components/*.js`, `src/context/*.js`, `src/navigation/*.js`, `src/theme/*.js` |
| Domain engines, AI, commands, services, widget logic | TypeScript | `src/ai/*.ts`, `src/behavior/*.ts`, `src/commands/*.ts`, `src/services/*.ts`, `widgets/*.tsx` |
| Utilities | Mixed (legacy JS + migrated TS) | `src/utils/*.js` |

- TypeScript is `strict: true` with `noEmit: true` (`tsconfig.json`), but `checkJs: false` — JS files are not type-checked.
- New domain/engine code belongs in TypeScript. New screens/components/contexts follow the existing JS pattern unless a migration is explicitly planned.

## Naming Patterns

**Files:**
- Components, screens, contexts: `PascalCase.js` — `src/components/TaskCard.js`, `src/screens/DashboardScreen.js`, `src/context/TaskContext.js`.
- Domain modules, utils, services: `camelCase.ts/js` — `src/behavior/eventBus.ts`, `src/utils/taskMutations.js`, `src/services/notificationService.ts`.
- Widgets: `PascalCase.tsx` — `widgets/HabitWidget.tsx`.
- Tests: `<subject>.test.ts(x)` / `<subject>.test.js` — `__tests__/unit/eventBus.test.ts`.

**Functions and variables:**
- `camelCase` for functions and variables: `toggleTask`, `generateId`, `writeTaskSnapshot`.
- `PascalCase` for React components: `CustomButton`, `TaskProvider`, `HabitWidget`.
- `use` prefix for hooks: `useTasks` (`src/context/TaskContext.js:441`), `useHabits` (`src/context/HabitContext.js:632`), `useDomainEvent` (`src/behavior/eventBus.ts:278`).
- `handle` prefix for event handlers: `handlePress`, `handleSaveBirthday`, `handleAppStateChange`.
- `UPPER_SNAKE_CASE` for module constants: `MAX_EVENT_BUFFER_SIZE`, `STORAGE_VERSION`, `IDEMPOTENCY_TTL_MS`, `MODEL_EXPECTED_SHA256`.
- Boolean locals use `is`/`has` prefixes: `isOutlined`, `isDevelopment`, `tasksHydratedRef`.

**Types (TypeScript):**
- `PascalCase` interfaces and type aliases: `DomainEvent`, `DispatchedCommand`, `HabitFrequency`.
- Union string literals rather than enums: `type HabitStatus = 'active' | 'paused' | 'archived' | 'recovery'` (`src/behavior/types.ts`).
- Options objects are interfaces suffixed `Options`: `IntentParserOptions`, `CompilerOptions`, `WeeklyReviewOptions` (`src/ai/types.ts`).
- Use `import type { ... }` for type-only imports (see `__tests__/unit/behavioralPipelineE2E.test.ts:35`).

## Code Style

**Formatting:**
- No Prettier config exists. Formatting is not mechanically enforced.
- Semicolons are always used; 2-space indentation throughout.
- Quote style is mixed by area: double quotes dominate screens/components/context/theme (`src/context/TaskContext.js`, `src/theme/colors.js`, `src/screens/DashboardScreen.js`); single quotes dominate TypeScript modules and most tests (`src/behavior/eventBus.ts`, `src/commands/commandExecutor.ts`, `__tests__/unit/eventBus.test.ts`). Follow the dominant style of the file you are editing.
- Trailing commas are common in multi-line object/array literals.
- Long files are acceptable (e.g. `App.js` ~44 KB, `src/services/notificationService.ts` 767 lines) but pure logic should be extracted into testable modules.

**Linting:**
- Flat config: `eslint.config.js` (ESLint 9). A legacy `.eslintrc.js` also exists; the flat config is the active one.
- Applies to `**/*.{js,jsx}` only; TypeScript is checked by `tsc`, not ESLint.
- Key rules (`eslint.config.js`):
  - `react-hooks/rules-of-hooks: error`
  - `react-hooks/exhaustive-deps: warn`
  - `react/prop-types: off` (no PropTypes used)
  - `no-unused-vars: warn` with `argsIgnorePattern: '^_'`
  - `no-console: warn` (phased escalation documented inline)
  - `react-native/no-inline-styles: warn`
  - `react-native/no-color-literals: warn`
  - `react-native/no-unused-styles: warn`
- Zero-error lint is a CI gate (`npm run lint`, `.github/workflows/ci.yml:36`). Warnings are tolerated.

**Path Aliases:**
- None. All imports are relative (`../../src/utils/logger`). Do not introduce aliases without updating Metro/Jest/tsconfig together.

## Import Organization

**Observed order (not lint-enforced):**
1. React and React Native — `import React, { useState } from "react";`, `import { View, Text } from "react-native";`
2. Third-party libraries — `expo-*`, `@react-navigation/*`, `@react-native-async-storage/async-storage`, `react-native-paper`.
3. Local modules — components, contexts, services, utils, behavior.
4. Types last (TypeScript) — often `import type { Habit } from '../../src/behavior/types';`.

Import local modules by their concrete file path, not through barrels. Only `src/ai/index.ts` and `src/commands/index.ts` exist as barrels; most code imports the source file directly.

## Export Patterns

- Components are **named exports of arrow functions**, with a matching default export only for the top-level boundary/context:
  - `export const CustomButton = ({ ... }) => { ... }` (`src/components/CustomButton.js:6`)
  - `export const DashboardScreen = ({ ... }) => { ... }` (`src/screens/DashboardScreen.js:94`)
  - `export const ErrorBoundary = ...` + `export default ErrorBoundary` (`src/components/ErrorBoundary.js`)
- Contexts export `Provider`, a `useX` hook, and the raw context as default — `src/context/TaskContext.js:441-446`.
- Domain engines export named functions **and** a default object aggregating them (e.g. `src/behavior/eventBus.ts:299`, `src/context/HabitContext.js:640`).
- Utilities export the function as named and default: `export const generateId` + `export default generateId` (`src/utils/generateId.js`).

## Error Handling

**Strategy:** Fail safely at module boundaries; log and recover rather than crash; throw only for programmer/config errors.

**Patterns:**
- `try/catch` around all persistence, filesystem, notification, and network operations. Log via `logger.error` and return a safe fallback:
  ```js
  try {
    await AsyncStorage.setItem(...);
  } catch (err) {
    logger.error("❌ Failed to persist tasks to storage:", err);
  }
  ```
  (`src/context/TaskContext.js:84-105`)
- Validation of command payloads returns a result object, not throws: `validateCommand()` → `{ valid, errors, rulesApplied }` (`src/commands/commandValidator.ts`, tested in `__tests__/unit/commandGateway.test.ts`).
- Config/input validation throws descriptive errors: `validateSyncConfig` / `validateSyncPayload` throw (`src/utils/syncService.js`, tested in `__tests__/unit/syncService.test.js`).
- Component render failures are caught by `src/components/ErrorBoundary.js`; it logs `"Unhandled React Error:"` and renders a recovery UI with Try Again / Copy Error Report.
- User-facing failures use `Alert.alert(title, message)` in screens/components (`src/screens/NotesScreen.js`, `src/components/AIAssistant.js`).
- EventBus isolates listener failures: sync throws and async rejections are caught and logged (`src/behavior/eventBus.ts:179-220`).
- Never let a caught error be silently swallowed without at least a `logger.error`/`logger.warn`, unless the comment explains why (e.g. "If storage is unreadable, fall through").

## Logging

**Framework:** `src/utils/logger.js` — do NOT use raw `console.*` in app code.

- Import `{ logger }` and call `logger.debug/info/warn/error`.
- `debug`/`info` are development-only and do not buffer in production; `warn`/`error` always buffer.
- A 50-entry FIFO ring buffer supports crash forensics via `getRecentLogs()` / `clearLogs()`.
- PII is key-based redacted (`content|body|note|title|text|message|passphrase|token|key|secret|password|habitTitle|cueText` → `[Redacted]`), strings truncated at 1000 chars, depth capped at 4, cycles guarded.
- Pass structured details as additional arguments: `logger.error('EventBus listener error:', { error: message, eventType: event.type })`.

## Comments

- Heavy explanatory comments are the norm, especially in TypeScript domain code and security-sensitive paths. Comments cite requirement/issue IDs and the codebase map:
  - `WR-02`, `CR-01`, `OBS-01`, `SYS_IDEMPOTENT_COMMAND_001`, `[CMD-01]`.
  - References to `.planning/codebase/CONCERNS.md`, `ARCHITECTURE.md`, `rulebook/…`.
- Section banners use `====` underlines for file-level overviews (e.g. `__tests__/setup/jest.setup.js:1-6`).
- JSDoc is used on utility/domain functions with `@param` and `@returns` — e.g. `src/utils/taskMutations.js:15-21`, `src/utils/generateId.js:24-27`. TypeScript files rely more on interfaces than JSDoc.
- Inline comments explain *why* (design decisions, rejected alternatives, edge cases), not *what*. Preserve this style when modifying.

## Function Design

**Size:** Pure domain functions are preferred and kept small; React contexts/screens can be large, but all task transformations live in `src/utils/taskMutations.js` rather than inline in providers.

**Parameters:**
- Options-object pattern for optional behavior: `toggleTask(tasks, taskId, options = {})` with `options.now` / `options.todayDate` injected for testability (`src/utils/taskMutations.js:83-85`).
- Inject time/dates instead of reading the clock inside pure functions; defaults fall back to `new Date().toISOString()` / `getLocalDateString()`.
- Callbacks are passed in rather than imported when testing needs them (e.g. `habitOperations` interface in command handlers).

**Return Values:**
- Pure transformations return new arrays/objects; they never mutate inputs (`completeTask`, `toggleSubtask`, `mergeTasksByUpdatedAt`).
- Multi-result mutations return a named object: `{ updatedTasks, toggledTask, spawnedTask }`.
- Async operations return booleans or result objects; failures are logged and indicated, not thrown, where callers must continue.

## Module Design

**Exports:** Named for everything except contexts (default context object) and engine aggregates (default object).

**Barrel Files:** Only `src/ai/index.ts` and `src/commands/index.ts`. Do not add barrels; import concrete modules.

**Domain isolation:** `src/domains/README.md` mandates that domains are isolated — cross-domain communication goes through `eventBus` events, never direct imports. Types live in `src/behavior/types.ts` and `src/commands/types.ts`.

**State management:**
- One React Context per domain (`TaskContext`, `HabitContext`, `BillingContext`, `BirthdayContext`, `VaultContext`), each with a `useX()` hook.
- Persistence uses AsyncStorage keys of the form `kwestup_<domain>_v<version>`; writes are debounced and read-modify-write to avoid clobbering sibling domains.
- IDs always come from `generateId()` (`src/utils/generateId.js`), never `Date.now()`/`Math.random()` directly.

## TypeScript Conventions

- `strict: true`, `noEmit: true`, `types: ["jest", "node"]` (`tsconfig.json`).
- Prefer discriminated unions and mapped conditional types for command payloads (`src/commands/types.ts:26-70`).
- `unknown` is preferred over `any` in catch blocks (`catch (err: unknown)`) — see `src/behavior/eventBus.ts`.
- `any` appears in test files and some handler maps (`Map<CommandAction, CommandHandler<any>>`); avoid adding new `any` in domain code.
- Include `src/**/*`, `widgets/**/*`, `__tests__/**/*` and root config JS in `tsconfig.json` includes.

---

*Convention analysis: 2026-10-18*
