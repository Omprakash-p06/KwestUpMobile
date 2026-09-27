# Conventions

**Analysis Date:** 2026-09-27

## Code Style (lint, formatting, TS strictness)

**Linter — ESLint 9 flat config (`eslint.config.js`), legacy shim (`.eslintrc.js`):**
- Parser: `@babel/eslint-parser` with `babel.config.js` (`babel-preset-expo` + `react-native-reanimated/plugin`); `ecmaVersion: 2021`, `sourceType: module`, JSX on.
- Plugins: `react`, `react-native`, `react-hooks`; extends `eslint:recommended` + `plugin:react/recommended`.
- Active rules (`eslint.config.js:31-44`): `react/react-in-jsx-scope: off`, `react/prop-types: off`, `react-native/no-unused-styles: warn`, `react-native/no-inline-styles: warn`, `react-native/no-color-literals: warn`, `react-native/no-raw-text: off`, `react-native/sort-styles: off`, `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn`, `no-unused-vars: warn` (with `argsIgnorePattern: ^_`), `no-console: warn`.
- Test override (`eslint.config.js:46-61`): `__tests__/**/*` and `*.test.js` get Jest globals (`describe/it/expect/beforeEach/...`) as readonly.
- Ignores: `node_modules/`, `.expo/`, `dist/`, `web-build/`, `android/`, `ios/`, `assets/`, `KwestUpPC/`.
- Gate: `npm run lint` → `eslint .`; enforced in `check.bat:44-49` (blocks commit flow on failure) and `.github/workflows/ci.yml:26-27`.

**Formatting — no Prettier:**
- No `.prettierrc*` / `prettier.config.*` in repo root. Style is enforced by convention + the `no-inline-styles` / `no-unused-styles` / `no-color-literals` warnings, not an auto-formatter.
- Observed style: double quotes, semicolons, 2-space indent, trailing commas in multiline literals (see `src/components/CustomButton.js`, `src/utils/storage.js`).

**TypeScript strictness — effectively off:**
- `tsconfig.json` is just `{ "compilerOptions": {}, "extends": "expo/tsconfig.base" }`. No `strict` flag set locally.
- All production code under `src/` is plain `.js` (no `.ts`/`.tsx` files); JSDoc `@param`/`@returns` blocks act as the type contract (e.g. `src/utils/dateUtils.js:9-13`, `src/utils/syncService.js:24-31`).

**Import order (observed, not enforced by a plugin):**
1. `react` / react hooks first — `src/components/TaskCard.js:1`, `src/screens/DashboardScreen.js:1`.
2. `react-native` primitives — `src/components/CustomButton.js:2`.
3. Third-party / Expo (`@expo/vector-icons`, `expo-haptics`, `react-native-paper`, `react-native-modal`) — `src/components/CustomButton.js:3-4`.
4. Relative imports last: sibling components (`./LiquidGlassCard`), then parent dirs (`../theme/styles`, `../utils/dateUtils`) — `src/components/TaskCard.js:6`, `src/screens/DashboardScreen.js:6-8`.
- No path aliases; all relative (`./`, `../`). No barrel (`index.js`) files in `src/` subdirs.

## Naming (files, components, services, tests)

**Files — PascalCase for components/screens, camelCase for services:**
- Components: `src/components/TaskCard.js`, `src/components/CustomButton.js`, `src/components/LiquidGlassCard.js`, `src/components/QRScannerModal.js`, `src/components/TimerLockoutOverlay.js`.
- Screens: `src/screens/DashboardScreen.js`, `src/screens/TaskListScreen.js`, `src/screens/FocusTimerScreen.js` (all `*Screen.js`).
- Services/utils: `src/utils/syncService.js`, `src/utils/dateUtils.js`, `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/exportService.js`, `src/utils/aiService.js`, `src/utils/billingStorage.js`, `src/utils/storage.js`.
- Theme/nav: `src/theme/colors.js`, `src/theme/styles.js`, `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`.
- Entry/config at root: `App.js`, `index.js`, `app.json`, `babel.config.js`, `metro.config.js`, `eas.json`.

**Components — named exports, PascalCase:**
- `export const TaskCard = ({ task, onPress, ... }) => {...}` (`src/components/TaskCard.js:8`); `export const CustomButton = ({ title, onPress, ... }) => {...}` (`src/components/CustomButton.js:6`). Destron destructured-props signature with optional callbacks guarded (`onPress && onPress(task.id)`).

**Services — camelCase named exports + module constants:**
- Validators/handlers: `validateSyncConfig`, `validateSyncPayload`, `pingSyncServer`, `performSync` (`src/utils/syncService.js`); `getLocalDateString`, `parseLocalDate`, `isSameLocalDay` (`src/utils/dateUtils.js`); `isModelDownloaded`, `downloadModel` (`src/utils/aiService.js`).
- Version/key constants in SCREAMING_SNAKE: `APP_VERSION`, `STORAGE_VERSION` (`src/utils/storage.js:3-4`); storage keys namespaced `kwestup_<domain>_<version>` (e.g. `kwestup_data_v7.0`, `kwestup_billing_...`) — see `isUserDataKey` (`src/utils/storage.js:7-21`).
- Module-level singletons with underscore prefix: `_llamaContext`, `_isInitializing` mutex flag (`src/utils/aiService.js:23-24`).

**Tests — `*.test.js`, co-located under `__tests__/`:**
- Unit suites: `__tests__/unit/dateUtils.test.js`, `__tests__/unit/syncService.test.js`, `__tests__/unit/storageMigration.test.js`, `__tests__/unit/exportImportService.test.js`, `__tests__/unit/vaultAndFileStorage.test.js`.
- Logic/contract suites at root: `__tests__/phase12-widget-logic.test.js` (IDs `[12-P1]`–`[12-P10]` per `it` title); harness smoke test `__tests__/setup/jest.setup.test.js`; global mocks in `__tests__/setup/jest.setup.js` (not a suite — loaded via `setupFiles` in `jest.config.js:4-8`).

## File Organization

- `src/components/` — 14 presentational components; `Custom*` prefix = themed primitives (`CustomButton`, `CustomCard`, `CustomTextInput`, `CustomSwitch`, `CustomDateTimePicker`, `CustomSegmentedButtons`, `CustomBadge`); domain components (`TaskCard`, `TaskEditModal`, `AIAssistant`, `QRScannerModal`, `TimerLockoutOverlay`, `LiquidGlassCard`, `LiquidGlassBackground`).
- `src/screens/` — 9 screens, one per route (`*Screen.js`); heavy screens colocate pure helpers at module top (e.g. `getDailyCompletions`, `computeBirthdayDaysRemaining` in `src/screens/DashboardScreen.js:13-58`) instead of a separate lib.
- `src/utils/` — 12 service modules; pure/date logic (`dateUtils.js`) vs. side-effectful storage/network services (`storage.js`, `syncService.js`, `fileStorage.js`, `vaultService.js`, `exportService.js`, `aiService.js`).
- `src/theme/` — `colors.js` (palettes), `styles.js` (~895-line shared `StyleSheet` + `injectFontFamily` helper imported by screens/components).
- `src/navigation/` — `AppNavigator.js`, `CustomDrawerContent.js`.
- Components keep a file-local `StyleSheet.create` at the bottom named `localStyles` (e.g. `src/components/TaskCard.js:243-294`, `src/components/CustomButton.js` uses `styles.baseButton` from theme + local overrides); emoji-prefixed `console.log` breadcrumbs (`🧹`, `📦`, `✅`) mark lifecycle steps in `src/utils/storage.js:25-60`.

## Error Handling & Validation Patterns

**Pattern 1 — Validate-then-throw with descriptive prefixes (sync/config/payload):**
- `validateSyncConfig` / `validateSyncPayload` throw `Error("Invalid sync configuration: ...")` / `Error("Malformed server response ...")` for bad shape, path injection, out-of-range ports, short tokens (`src/utils/syncService.js:32-70`); callers (`performSync`) validate *before* any `fetch` so tests assert `fetch` was not called on invalid config (`__tests__/unit/syncService.test.js:126-132`).
- Fetch guarded by `fetchWithTimeout` + `AbortController` (4s default) with `clearTimeout` in both paths (`src/utils/syncService.js:7-22`); network failures surface as domain errors (`Unable to connect to the PC Sync Server`, `Authorization Forbidden...`).

**Pattern 2 — try/catch → `console.error`/`console.warn` → safe fallback (storage/AI/files):**
- Storage/AI functions catch, log, and return `false`/`null`/default instead of throwing: `clearAllCaches` → `return true/false` (`src/utils/storage.js:24-65`); `migrateUserDataIfNeeded` → `return true/false` (`src/utils/storage.js:68-186`); `isModelDownloaded` → `return false` on error, and deletes undersized (<450MB) model files as corrupt (`src/utils/aiService.js:29-47`); LLM JSON parse failure falls back to keyword extraction with `console.warn` (`src/utils/aiService.js:383-395`).
- Note: `no-console: warn` fires on all of these — warnings are accepted as breadcrumbs, not failures (CI runs plain `eslint .` with no `--max-warnings`, so warns do not fail the gate).

**Pattern 3 — Defensive input normalization (date utils as exemplar):**
- `getLocalDateString` returns `''` for `null`/`undefined`/`''`/invalid and validates `YYYY-MM-DD` round-trip (rejects `2023-02-29`, `2026-04-31`); `parseLocalDate` never throws — falls back to `new Date()` (`src/utils/dateUtils.js:14-79`).

**Comments/JSDoc:**
- Every `src/utils/*.js` module opens with a banner block (`/** KwestUp Mobile ... */` + `===` underline) and each export carries `@param`/`@returns`/`@throws` JSDoc (`src/utils/dateUtils.js:1-13`, `src/utils/syncService.js:24-31`). Inline `//` comments explain *why* (UTC-shift avoidance, wipe-prevention, mutex flags), not *what*.

## Git / Commit Patterns (if detectable)

- Conventional Commits with scope: `feat(ci): ...`, `feat(test): ...`, `feat(date): ...`, `fix(widgets): ...`, `style(widgets): ...`, `docs(plan): ...`, `docs(audit): ...`, `chore: ...` (recent log: `7ec2493 docs(audit): ...`, `ba2be1b feat(phase-16): ...`, `160984f feat(date): ...`, `762524a feat(ci): ...`, `af1285c feat(test): ...`).
- Phase-gated history: test-harness commits land as pairs (`99de278 feat(test): configure Jest... (14-01)` → `af1285c feat(test): add unit test suites... (14-02)`), then `feat(ci)` for the workflow; plan/audit docs commit alongside code (`docs(plan): establish phase 16...`).
- Human gate before commit: `check.bat` runs `npm run lint` then `npm test` sequentially and aborts on either failure (`check.bat:44-61`).

---

*Convention analysis: 2026-09-27*
