# Coding Conventions

**Analysis Date:** 2026-10-10

## Naming Patterns

**Files:**
- Use PascalCase for React components: `CustomButton.js`, `TaskCard.js`, `ErrorBoundary.js` in `src/components/`, `*Screen.js` in `src/screens/` (e.g. `src/screens/BillingScreen.js`)
- Use camelCase for utilities, services, and contexts: `src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/utils/billingStorage.js`, `src/context/TaskContext.js`
- Use camelCase + `.test.` suffix for tests mirroring the module under test: `__tests__/unit/logger.test.js` → `src/utils/logger.js`, `__tests__/unit/notificationService.test.ts` → `src/services/notificationService.ts`
- Use UPPER_SNAKE_CASE for exported constants: `STORAGE_VERSION`, `APP_VERSION` in `src/utils/storage.js`, `MAX_LOG_BUFFER_SIZE` in `src/utils/logger.js`, `MODEL_EXPECTED_SHA256`, `VAULTS_KEY`, `ACTIVE_KEY` in `src/utils/vaultService.js`
- Use `useXxx` for hooks: `useTasks` in `src/context/TaskContext.js`, `useBilling` in `src/context/BillingContext.js`

**Functions:**
- Use camelCase arrow-function named exports for all utilities: `export const getLocalDateString = (...)` in `src/utils/dateUtils.js`, `export const toggleTask = (...)` in `src/utils/taskMutations.js`
- Use `getXxx` / `setXxx` / `ensureXxx` / `scheduleXxx` / `cancelXxx` verbs for accessors and side effects: `getVaults`, `ensureVaultsDir` (`src/utils/vaultService.js`), `scheduleDueDateReminder`, `cancelNotification` (`src/services/notificationService.ts`)
- Use `validateXxx` for throwing validators: `validateSyncConfig`, `validateSyncPayload` in `src/utils/syncService.js`
- Use `handleXxx` for event handlers in components: `handleRetry`, `handlePress` in `src/components/ErrorBoundary.js`, `src/components/CustomButton.js`
- Prefix intentionally-unused function args with underscore (enforced by lint): `argsIgnorePattern: '^_'` in `eslint.config.js`

**Variables:**
- Use camelCase for locals and state: `updatedTasks`, `toggledTask`, `spawnedTask` in `src/utils/taskMutations.js`; `isModalVisible`, `downloadProgress` in `src/components/AIAssistant.js`
- Use UPPER_SNAKE_CASE for module-level configuration: `DEFAULT_TASKS`, `DEFAULT_TASK_LISTS` in `src/context/TaskContext.js`, `SENSITIVE_KEYS`, `MAX_STRING_CHARS` in `src/utils/logger.js`

**Types:**
- TypeScript lives only in `src/services/notificationService.ts`, `src/services/types.ts`, `src/behavior/types.ts`, `src/commands/types.ts`
- Use PascalCase interfaces exported from `src/services/types.ts`: `NotificationDispatchRequest`, `NotificationHistoryEntry`, `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY`
- JSDoc `@param {Object}` / `@returns {Promise<...>}` documents shapes in `.js` files instead of TS types — see `src/utils/taskMutations.js`, `src/utils/vaultService.js`

## Code Style

**Formatting:**
- No Prettier, no `.editorconfig` — formatting is enforced by ESLint rules only
- Use 2-space indentation throughout `src/` and `__tests__/`
- Terminate statements with semicolons; use trailing commas in multiline literals
- Prefer double quotes in `src/` (`import React from "react"`); single quotes are common in `__tests__/` imports — either parses, but match the surrounding file
- Keep lines reasonably short; break long JSX props one-per-line as in `src/components/TaskCard.js`

**Linting:**
- Primary config: `eslint.config.js` (ESLint 9 flat config, `eslint@^9.39.4`); legacy `/.eslintrc.js` retained for older tooling — keep both in sync when changing rules
- Parser: `@babel/eslint-parser` with `babel.config.js`, `ecmaVersion: 2021`, JSX enabled
- Plugins: `eslint-plugin-react`, `eslint-plugin-react-native`, `eslint-plugin-react-hooks`
- Key rules (do not weaken without a tracked review ID):
  - `'react-hooks/rules-of-hooks': 'error'` — hooks only at top level
  - `'react-hooks/exhaustive-deps': 'warn'` — fix missing deps, never silence blindly
  - `'react/prop-types': 'off'` — props are untyped by design in `.js` components
  - `'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]` — prefix unused params with `_`
  - `'no-console': 'warn'` — never call raw `console.*` in `src/`; use `src/utils/logger.js` (WR-09 tracks the remaining pre-existing warnings)
  - `'react-native/no-inline-styles': 'warn'`, `'react-native/no-unused-styles': 'warn'`, `'react-native/no-color-literals': 'warn'` — put styles in `StyleSheet.create`, reuse `src/theme/colors.js`
  - `'react-native/no-raw-text': 'off'`, `'react-native/sort-styles': 'off'`
- Run `npm run lint` (and `npm run typecheck` → `tsc --noEmit`) before every commit per `GEMINI.md` §3

## Import Organization

**Order:**
1. `react` / `react-native` core (`import React, { ... } from "react"`)
2. Third-party and Expo packages (`@expo/vector-icons`, `expo-haptics`, `react-native-paper`)
3. Internal relative modules (`../utils/logger`, `../services/notificationService`, `./CustomButton`)

```javascript
import React, { Component } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { logger } from "../utils/logger";
import { APP_VERSION, STORAGE_VERSION } from "../utils/storage";
import { CustomButton } from "./CustomButton";
// src/components/ErrorBoundary.js
```

**Path Aliases:**
- None — always use explicit relative imports (`../utils/dateUtils`, `../../src/utils/logger`)
- Use namespace imports for Expo modules: `import * as FileSystem from "expo-file-system"` in `src/utils/exportService.js`, `src/utils/vaultService.js`; `import * as Clipboard from "expo-clipboard"` in `src/components/ErrorBoundary.js`
- Default-import third-party singletons where the package dictates: `import CryptoJS from "crypto-js"` in `src/utils/exportService.js`, `import AsyncStorage from "@react-native-async-storage/async-storage"` in storage-adjacent modules

## Error Handling

**Patterns:**
- Wrap every async boundary in `try/catch`, log with `logger.error`, then throw a user-safe generic `Error` — never leak internals to the UI:
```javascript
} catch (error) {
  logger.error("❌ Encryption failed:", error);
  throw new Error("Failed to encrypt data.");
}
// src/utils/exportService.js → encryptBackup
```
- Throw descriptive prefixed errors from validators so callers can match on them: `throw new Error("Invalid sync configuration: config must be an object.")` in `src/utils/syncService.js`; `throw new Error('billingStorage: persist failed — state not saved')` in `src/utils/billingStorage.js`
- Prefer safe fallbacks over throwing in hot paths: `calculateNextRecurrence` falls back to `now` on an invalid `dueDate` (`src/utils/taskMutations.js`); `parseLocalDate` returns `Invalid Date` (never today) for bad input (`src/utils/dateUtils.js`)
- Catch React tree crashes with the class `ErrorBoundary` (`src/components/ErrorBoundary.js`): implement `static getDerivedStateFromError` + `componentDidCatch`, log via `logger.error("Unhandled React Error:", ...)`, offer retry/restart UI — never leave a bare tree without it on new screens
- Guard fire-and-forget persistence writes so a storage failure cannot crash the UI thread:
```javascript
} catch (err) {
  logger.error("❌ Failed to persist tasks to storage:", err);
}
// src/context/TaskContext.js → writeTaskSnapshot
```

## Logging

**Framework:** `src/utils/logger.js` (`logger.debug/info/warn/error`) — never raw `console.*` in `src/`

**Patterns:**
- Start any file that must touch the console with `/* eslint-disable no-console */` (only `src/utils/logger.js` qualifies)
- Use `logger.debug`/`logger.info` for dev diagnostics (gated on `__DEV__`, fully silenced in production); use `logger.warn`/`logger.error` for operational signal (always buffered + passed through)
- Prefix messages with an emoji tag for greppability: `logger.info("🧹 STARTING COMPREHENSIVE CACHE CLEAR...")` (`src/utils/storage.js`), `logger.debug("🤖 AI Global Parsed result:", parsed)` (`src/components/AIAssistant.js`), `logger.warn("Daily reminder scheduling failed; adding task without reminder:", err?.message)` (`src/screens/DailyTasksScreen.js`)
- Never log user content verbatim — the `SENSITIVE_KEYS` redaction regex (`content|body|note|title|text|message|passphrase|token|key|secret|password|...`) replaces matches with `[Redacted]` before buffering in `src/utils/logger.js`
- Production bundles strip `console.log/info/debug` via `babel-plugin-transform-remove-console` (keep `error`/`warn`); `react-native-reanimated/plugin` must stay last in `babel.config.js`

## Comments

**When to Comment:**
- Add a file banner header (`/** ... === ... === */`) stating the module's single responsibility — see `src/utils/dateUtils.js`, `src/utils/taskMutations.js`, `src/utils/syncService.js`
- Document non-obvious contracts and residual risks inline (persistence micro-windows, dev-only probes, phased lint escalations) as in `src/context/TaskContext.js` (W-01/W-02 write-through note) and `src/utils/diagnostics.js` (WR-03 dev-only guard)
- Tag review-decision comments with their rule ID (`WR-01`, `CR-01`, `OBS-01`) so future agents can trace rationale — e.g. `// OBS-01: Strip console...` in `babel.config.js`
- Mark deprecated shims with `@deprecated` + pointer to the replacement, and route all new code to the replacement: `src/utils/notifications.js` delegates everything to `src/services/notificationService.ts`

**JSDoc/TSDoc:**
- Document every exported util in `src/utils/*.js` with `@param` and `@returns`, including the invalid-input contract:
```javascript
/**
 * Parses a `YYYY-MM-DD` string into a local Date instance set to midnight local time (00:00:00.000).
 * ...
 * @param {string|Date|number} dateStr
 * @returns {Date} Local-midnight Date, or Invalid Date for invalid inputs (never today)
 */
// src/utils/dateUtils.js → parseLocalDate
```

## Function Design

**Size:** Keep functions focused on one transformation; extract helpers (`fetchWithTimeout` in `src/utils/syncService.js`, `sanitizeEntry`/`serializeItem` in `src/utils/logger.js`) rather than growing bodies past ~60 lines.

**Parameters:** Use positional args for ≤2 required inputs; use a single `options` object with `now`/`todayDate` overrides for anything time-dependent so tests can inject determinism:
```javascript
export const toggleTask = (tasks = [], taskId, options = {}) => {
  const now = options.now || new Date().toISOString();
  const todayDate = options.todayDate || getLocalDateString();
  // src/utils/taskMutations.js
```
- Destructure React props with defaults at the signature: `({ visible, onClose, task, onSave, theme, taskLists = [] })` in `src/components/TaskEditModal.js`

**Return Values:** Return `{ updatedXxx, ... }` result objects from pure mutations so callers get both the new collection and the affected item: `{ updatedTasks, toggledTask, spawnedTask }` (`toggleTask`), `{ updatedTasks, savedTask }` (`saveTask`), `{ updatedTaskLists, createdList }` (`createTaskList`) in `src/utils/taskMutations.js`. Async storage functions return `Promise<...>` and resolve to the entity or `null` when protected/missing (`deleteTaskList` returns `deletedList: null` for `default_inbox`).

## Module Design

**Exports:** Prefer named arrow-function exports (`export const CustomButton = ...` in `src/components/CustomButton.js`, `export const getVaults = ...` in `src/utils/vaultService.js`); add `export default` only for the module singleton alongside its named API (`src/utils/logger.js`, `src/utils/dateUtils.js`, context providers). Export co-located constants from the module that owns them (`VAULTS_KEY`, `LEGACY_VAULTS_KEY` in `src/utils/vaultService.js`).

**Barrel Files:** None — import directly from the owning file (`import { toggleTask } from "../utils/taskMutations"` in `src/context/TaskContext.js`). Do not create `index.js` re-export barrels; keep the dependency direction `screens/context → utils/services → logger/storage` and keep pure engines (`src/utils/taskMutations.js`, `src/utils/dateUtils.js`) framework-agnostic so headless surfaces (`widgets/`) can share them.

---

*Convention analysis: 2026-10-10*
