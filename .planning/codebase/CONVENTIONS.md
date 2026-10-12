# Coding Conventions

**Analysis Date:** 2026-10-12

## Naming Patterns

**Files:**
- Use `camelCase.js` for utilities, services, and screens: `src/utils/dateUtils.js`, `src/utils/fileStorage.js`, `src/utils/syncService.js`, `src/utils/vaultService.js`, `src/utils/billingStorage.js`
- Use `PascalCase.js` for React components (one component per file, matching the export name): `src/components/ErrorBoundary.js`, `src/components/CustomButton.js`, `src/components/TaskCard.js`, `src/components/AIAssistant.js`, `src/components/QRScannerModal.js`
- Use `camelCase.ts` for typed domains with colocated `types.ts` contracts: `src/ai/intentParser.ts`, `src/ai/behaviorCompiler.ts`, `src/behavior/eventBus.ts`, `src/commands/commandExecutor.ts`, `src/commands/commandValidator.ts`, `src/commands/types.ts`, `src/behavior/types.ts`, `src/ai/types.ts`
- Use `*.test.js` / `*.test.ts` for tests mirroring the module name: `__tests__/unit/logger.test.js`, `__tests__/unit/dateUtils.test.js`, `__tests__/unit/syncService.test.js`, `__tests__/unit/commandGateway.test.ts`
- Use `UPPER_SNAKE` for exported constants: `MAX_LOG_BUFFER_SIZE` in `src/utils/logger.js`, `APP_VERSION` / `STORAGE_VERSION` in `src/utils/storage.js`, `MAX_IDEMPOTENCY_CACHE_SIZE` / `IDEMPOTENCY_TTL_MS` in `src/commands/commandExecutor.ts`
- Use `kwestup_*` snake prefix for all AsyncStorage keys, never bare keys: `kwestup_data_*`, `kwestup_vaults_*`, `kwestup_activeVault_*`, `kwestup_billing_*` (see `src/utils/storage.js`)

**Functions:**
- Use `camelCase` arrow-function consts for all exported utilities: `getLocalDateString`, `parseLocalDate`, `isSameLocalDay` in `src/utils/dateUtils.js`; `generateId` in `src/utils/generateId.js`; `saveNoteFile`, `readNoteFile` in `src/utils/fileStorage.js`
- Use `get*` / `set*` / `ensure*` / `init*` / `validate*` / `perform*` verbs for storage and service operations: `getVaults`, `setActiveVaultId`, `ensureVaultsDir` in `src/utils/vaultService.js`; `validateSyncConfig`, `validateSyncPayload`, `pingSyncServer`, `performSync` in `src/utils/syncService.js`; `initNotesFolder` in `src/utils/fileStorage.js`
- Use `handle*` for component event handlers: `handleRetry`, `handleCopyReport`, `handleRestartPrompt` in `src/components/ErrorBoundary.js`; `handlePress` in `src/components/CustomButton.js`
- Use `is*` / `has*` boolean predicates returning strict `boolean`: `isDevelopment` in `src/utils/logger.js`, `isUserDataKey` in `src/utils/storage.js`, `isSameLocalDay` in `src/utils/dateUtils.js`

**Variables:**
- Use `camelCase` for locals and state fields: `vaultPath`, `sanitizedTitle`, `folderPath` in `src/utils/fileStorage.js`; `hasError`, `errorInfo`, `showDetails`, `copiedToast` in `src/components/ErrorBoundary.js`
- Prefix unused function args with underscore (enforced by lint): `argsIgnorePattern: '^_'` in `eslint.config.js` — e.g. `(_value)`, `(_index)`
- Use emoji-prefixed log message strings for operational observability (debug/info/warn only, stripped in prod): `"🧹 STARTING COMPREHENSIVE CACHE CLEAR..."`, `"✅ CACHE CLEAR COMPLETED"` in `src/utils/storage.js`

**Types:**
- Use `PascalCase` `interface` / `type` with descriptive suffixes in TypeScript domains: `ExtractedIntent`, `IntentParserOptions`, `RulePacket`, `CompilationResult` in `src/ai/types.ts`; `DispatchedCommand<'CREATE_IDENTITY'>` in `src/commands/types.ts`
- Use `UPPER_SNAKE` string-literal rule IDs for traceable validation failures: `'SYS_COMMAND_CAPABILITY_CHECK_001'` asserted in `__tests__/unit/commandGateway.test.ts`
- Never parse or compare opaque IDs numerically — treat `generateId()` output as an opaque string (contract documented in `src/utils/generateId.js`)

## Code Style

**Formatting:**
- No Prettier or Biome config — formatting is by convention, not enforced by a formatter (no `.prettierrc`, `biome.json` detected)
- Use 2-space indentation, single statement per line, trailing semicolons everywhere
- Use double quotes for strings in `src/` (`"expo-file-system"`, `"KwestUp Diagnostics..."` in `src/components/ErrorBoundary.js`); single quotes are tolerated in `__tests__/` (`'vault-xyz'` in `__tests__/unit/vaultAndFileStorage.test.js`) — match the surrounding file, do not mix within a file
- Keep lines under ~120 chars; break long JSX props one-per-line as in `src/components/CustomButton.js`
- `ecmaVersion: 2021`, `sourceType: 'module'`, JSX enabled via `@babel/eslint-parser` with `babel.config.js` (see `eslint.config.js`, `.eslintrc.js`)

**Linting:**
- Use ESLint 9 flat config in `eslint.config.js` (authoritative); legacy `.eslintrc.js` is retained for editor fallback — keep both in sync when adding rules
- Enabled plugins: `react` (recommended), `react-native`, `react-hooks`
- Key rules to obey:
  - `'react-hooks/rules-of-hooks': 'error'` — hooks only at top level
  - `'react-hooks/exhaustive-deps': 'warn'` — fix missing deps
  - `'react-native/no-inline-styles': 'warn'` and `'react-native/no-color-literals': 'warn'` — use `StyleSheet.create`, hoist colors to theme
  - `'react-native/no-unused-styles': 'warn'` — delete dead style keys
  - `'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]` — prefix intentionally-unused args with `_`
  - `'no-console': 'warn'` — never call raw `console.*` in `src/`; use `src/utils/logger.js` (only `src/utils/logger.js` itself carries `/* eslint-disable no-console */`)
  - `'react/prop-types': 'off'`, `'react/react-in-jsx-scope': 'off'`, `'react-native/no-raw-text': 'off'`
- Run `npm run lint` (errors fail CI) and `npm run typecheck` (`tsc --noEmit`, `strict: true`, `checkJs: false`) before every commit per `GEMINI.md` §3

**Styling (React Native):**
- Always define styles with `StyleSheet.create` at the bottom of the file, never inline objects in JSX: `const styles = StyleSheet.create({...})` in `src/components/CustomButton.js:68`, `src/components/ErrorBoundary.js:301`, `src/components/TaskCard.js:243`
- Screens build a theme-aware `rawStyles` object then freeze it: `const styles = StyleSheet.create(rawStyles)` in `src/screens/TaskListScreen.js:804`, `src/screens/SettingsScreen.js:1101`, `src/screens/NotesScreen.js:2014`, `src/screens/BillingScreen.js:859`
- Shared theme tokens live in `src/theme/styles.js` (`export const styles = StyleSheet.create(rawStyles)` at `src/theme/styles.js:895`); prefer theme values over hardcoded hex (the `no-color-literals` warn exists to push this direction)
- Reanimated plugin must stay last in `babel.config.js` plugins array

## Import Organization

**Order:**
1. `react` / `react-native` core (`import React from "react"`, `import { View, Text, StyleSheet } from "react-native"`)
2. Expo / React Navigation / third-party (`@expo/vector-icons`, `expo-clipboard`, `expo-file-system`, `@react-native-async-storage/async-storage`)
3. Absolute-then-relative local modules, logger immediately after external deps (`import { logger } from "./logger"`, `import { getVaultPath } from "./vaultService"`)
4. Type-only imports in `.ts` files after value imports (`import { CommandAction, DispatchedCommand } from '../commands/types'` in `src/ai/types.ts`)

```javascript
// Canonical header — src/utils/fileStorage.js:1-3
import * as FileSystem from "expo-file-system";
import { getVaultPath } from "./vaultService";
import { logger } from "./logger";
```

```javascript
// Canonical component header — src/components/ErrorBoundary.js:1-16
import React, { Component } from "react";
import { View, Text, StyleSheet, ScrollView, Platform, Share, SafeAreaView, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { logger } from "../utils/logger";
import { APP_VERSION, STORAGE_VERSION } from "../utils/storage";
import { CustomButton } from "./CustomButton";
```

**Path Aliases:**
- None configured — always use explicit relative paths (`./logger`, `../utils/storage`, `../../src/utils/dateUtils`). Do not introduce `@/` aliases without updating `tsconfig.json`, `babel.config.js`, and `jest.config.js` together.

## Error Handling

**Patterns:**
- Wrap every async I/O boundary in `try/catch`, log via `logger.error`, and return a safe fallback — never let a storage/filesystem rejection propagate to the UI thread:

```javascript
// src/utils/fileStorage.js:33-60
export const saveNoteFile = async (vaultId, folder, title, content) => {
  try {
    // ... filesystem writes ...
    return { success: true, filePath };
  } catch (error) {
    logger.error("❌ Failed to save note file:", error);
    return { success: false, error };
  }
};
```

- Swallow-and-default for non-critical reads (folder init, cache clear): log and continue, return `false` or `''` rather than throwing — see `initNotesFolder` in `src/utils/fileStorage.js:11-22` and `clearAllCaches` in `src/utils/storage.js:30-71` (returns `true`/`false`)
- Throw `new Error(...)` with a machine-matchable prefixed message only from pure validation functions, and assert on the fragment in tests:

```javascript
// src/utils/syncService.js:36-68 — each message starts with a category prefix
throw new Error("Invalid sync configuration: config must be an object.");
throw new Error(`Invalid sync configuration: port "${port}" is out of bounds (1-65535).`);
throw new Error("Sync API error: Malformed server response. Expected JSON object.");
```

```javascript
// __tests__/unit/syncService.test.js:44 — match the fragment, not the full string
expect(() => validateSyncConfig({ ...validConfig, ip: '192.168.1.50/malicious' })).toThrow('is malformed');
```

- Never throw from React render paths — contain render crashes in `src/components/ErrorBoundary.js` (`getDerivedStateFromError` + `componentDidCatch` → `logger.error("Unhandled React Error:", ...)` at `src/components/ErrorBoundary.js:37-40`), then offer retry / copy-report / restart-prompt recovery actions
- Provide degraded-path fallbacks for clipboard/share failures: clipboard → `Share.share` → failure UI, never a success toast on failure (see `handleCopyReport` in `src/components/ErrorBoundary.js:70+`, covered by `WR-04` tests in `__tests__/unit/errorBoundary.test.js`)
- Serialize `Error` instances explicitly before buffering or displaying — `logger.js:50-59` converts to `{ name, message, stack, cause }`; `sanitizeEntry` in `src/utils/logger.js:86-107` stringifies non-string messages so `JSON.stringify` never throws

## Logging

**Framework:** `src/utils/logger.js` — the only sanctioned logging surface. Raw `console.*` is lint-warned and Babel-stripped in production.

**Patterns:**
- Import the named functions, not `console`: `import { logger } from "../utils/logger"` then call `logger.debug/info/warn/error` — see `src/utils/storage.js:2`, `src/utils/fileStorage.js:3`, `src/utils/vaultService.js:5`, `src/components/ErrorBoundary.js:14`
- Respect level gating: `debug`/`info` emit AND buffer only when `isDevelopment()` (`__DEV__` or `NODE_ENV !== 'production'`); `warn`/`error` always buffer + passthrough — see `src/utils/logger.js:142-162`. Do not use `debug` for operational signal that must survive in production
- Never log user content under raw keys — the `SENSITIVE_KEYS` regex in `src/utils/logger.js:37-38` redacts `content|body|note|title|text|message|passphrase|token|key|secret|password|habitTitle|cueText` to `'[Redacted]'` before buffering. Safe operational strings pass through verbatim
- Keep the ring-buffer bounded: max 50 entries, FIFO eviction (`MAX_LOG_BUFFER_SIZE` in `src/utils/logger.js:13`); entries are deep-frozen at record time so consumers cannot mutate the live buffer via `getRecentLogs()` snapshots
- Production bundles strip `console.log/info/debug` via `babel-plugin-transform-remove-console` (`exclude: ['error','warn']`), with `react-native-reanimated/plugin` always last — see `babel.config.js:12-23`

## Comments

**When to Comment:**
- Open every utility module with a block header stating ownership and the invariant it protects:

```javascript
// src/utils/dateUtils.js:1-6
/**
 * Centralized Local Date Utility Engine
 * =====================================
 * Single authoritative source of date/time calculation for calendar dates.
 * Eliminates UTC slicing bugs by strictly operating on device-local calendar units.
 */
```

- Document strict input contracts on every exported function with `@param` / `@returns`, including the invalid-input behavior (`''` vs `Invalid Date` vs `throw`) — see `getLocalDateString` and `parseLocalDate` in `src/utils/dateUtils.js:8-86`
- Tag cross-cutting decisions with stable IDs so tests and plans can cite them: `CR-01`/`CR-02` (correctness), `WR-01…WR-06` (weak-review follow-ups), `OBS-01`, `TC-OBS-06…` — e.g. `// CR-02 decision (documented): debug AND info are fully gated...` in `src/utils/logger.js:136-141`, `// WR-05: spec'd "Restart Application" tertiary action...` in `src/components/ErrorBoundary.js:60-62`
- Explain WHY a workaround exists and what the proper fix is, not just WHAT: `// WR-01: cache keyed on NODE_ENV (not api.cache(true)) so a long-lived Metro/babel daemon never serves a config evaluated for the wrong env` in `babel.config.js:2-10`

**JSDoc/TSDoc:**
- Use JSDoc on all exported JS functions (`@param {type} name - description`, `@returns {type} description`) — enforced by convention, see `src/utils/fileStorage.js:7-32`, `src/utils/generateId.js:24-28`
- Use TypeScript `interface` + inline `//` range comments for typed contracts (`customWeekdays?: number[]; // [0..6]`, `time?: string; // HH:mm format`, `confidence: number; // 0..1` in `src/ai/types.ts:13-28`)
- Cite the rulebook source on domain types: `* Source: rulebook/ai/intent-parser.md, ...` header in `src/ai/types.ts:1-8`

## Function Design

**Size:** Keep functions single-purpose and under ~60 lines; extract sanitization, serialization, and validation helpers (`sanitizeEntry`, `serializeItem`, `deepFreeze`, `recordBreadcrumb` are module-private in `src/utils/logger.js`; `truncateString` caps strings at 1000 chars, arrays at 50 items).

**Parameters:** Accept plain positional args for ≤3 params (`saveNoteFile(vaultId, folder, title, content)` in `src/utils/fileStorage.js`); accept/return an options object for wider configs (`IntentParserOptions { forceHeuristic?, temperature?, contextPrompt?, timeoutMs? }` in `src/ai/types.ts:30-35`). Default defensively at the signature: `(input = new Date())`, `(vaultId || "default")`, `(folder || "Uncategorized")`.

**Return Values:** Use one of three shapes consistently:
- `{ success: true, filePath }` / `{ success: false, error }` result objects for fallible writes (`saveNoteFile` in `src/utils/fileStorage.js:56-59`)
- `boolean` for health probes (`pingSyncServer`), `''` for invalid date strings, `Invalid Date` (never today) for invalid date parses — see strict contract in `src/utils/dateUtils.js:53-58`
- `{ valid, errors, rulesApplied }` for validators (`validateCommand` asserted in `__tests__/unit/commandGateway.test.ts:47-54`)

## Module Design

**Exports:** Export named arrow-function consts for every public function AND a default bag object for namespace import compatibility. Both styles are live — prefer named imports in new code:

```javascript
// src/utils/dateUtils.js:166-174 and src/utils/logger.js:183-194
export const getRecentLogs = () => { return [...logBuffer]; };
export const logger = { debug, info, warn, error, getRecentLogs, clearLogs, MAX_LOG_BUFFER_SIZE, isDevelopment };
export default logger;
```

**Barrel Files:** Used sparingly — `src/ai/index.ts` re-exports the AI domain; `src/utils/*.js` modules are imported directly by path (`../../src/utils/logger`). Do not add new barrel files; import from the defining module so Jest `testMatch` and coverage attribution stay precise.

---

*Convention analysis: 2026-10-12*
