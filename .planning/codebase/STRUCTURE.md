# Repository Structure

**Analysis Date:** 2026-09-28 — Phase 19 of 19 complete (Milestone 2 complete, 100%).

## Root Layout

| Entry | Kind | Purpose |
|---|---|---|
| `App.js` | file | Composition root: boot, state, providers, `ErrorBoundary` mount, modals/overlays |
| `index.js` | file | Expo entry: `registerRootComponent(App)` + widget task handler registration |
| `src/` | dir | All first-party application code (components, context, navigation, screens, theme, utils) |
| `widgets/` | dir | Android home-screen widgets (4 views + headless task handler), `.tsx` |
| `android/` | dir | Native Android shell (Gradle, manifest, icons, widget host config) |
| `assets/` | dir | Fonts, icons, splash/adaptive-icon images |
| `app.json` | file | Expo app config (name, slug, version, plugins, Android package) |
| `eas.json` | file | EAS build profiles |
| `package.json` / `package-lock.json` | files | JS dependencies + scripts (`jest`, `eslint`) |
| `babel.config.js` / `metro.config.js` / `tsconfig.json` | files | Build/transform/type config |
| `jest.config.js` / `__tests__/` / `coverage/` | files+dirs | Jest config, suites, setup mocks, coverage output |
| `.eslintrc.js` / `eslint.config.js` | files | Lint config (legacy + flat) |
| `.github/workflows/` | dir | CI gate (ESLint + Jest + coverage) |
| `.planning/` | dir | GSD planning state (`PROJECT.md`, `ROADMAP.md`, `STATE.md`, `phases/`, `codebase/`, `debug/`) |
| `build/` | dir | Local build artifacts (generated, not source) |
| `patch-llama-gradle.js` | file | Post-install patch for `llama.rn` native Gradle wiring |
| `check.bat` | file | Windows helper to run checks |
| `README.md` / `GEMINI.md` | files | Human + agent project notes |

## src/ Breakdown

- `src/components/` (15 files) — reusable UI primitives and overlays. Presentational + self-contained logic: `CustomButton.js`, `CustomCard.js`, `CustomTextInput.js`, `CustomDateTimePicker.js`, `CustomSegmentedButtons.js`, `CustomSwitch.js`, `CustomBadge.js`, `TaskCard.js`, `TaskEditModal.js` (mounted once in `AppNavigator`), `TimerLockoutOverlay.js`, `LiquidGlassBackground.js`, `LiquidGlassCard.js`, `QRScannerModal.js` (LAN-sync token scan), `AIAssistant.js` (floating AI entry + command dispatch), `ErrorBoundary.js` (root crash fallback, `currentTheme` + `isDark` props).
- `src/context/` (4 files) — React state ownership layer. `TaskContext.js` (tasks/lists/daily + sole-writer debounced persistence + `taskMutations` wiring), `VaultContext.js` (vaults/active vault/notes/active note), `BillingContext.js` (sole billing writer over `billingStorage`), `BirthdayContext.js` (birthdays + notification lifecycle).
- `src/navigation/` (2 files) — `AppNavigator.js` (drawer with 9 screens, context→prop bridging, modal/assistant mounts) and `CustomDrawerContent.js` (drawer chrome + theme switch).
- `src/screens/` (9 files) — one per drawer route: `DashboardScreen.js` (aggregated overview), `DailyTasksScreen.js` (habits + streaks), `TaskListScreen.js` (lists + subtasks + recurrence), `NotesScreen.js` (vault explorer + markdown editor + AI assist hooks), `BirthdaysScreen.js`, `BillingScreen.js` (transactions/budgets/recurring bills), `FocusTimerScreen.js`, `SearchScreen.js` (cross-domain search), `SettingsScreen.js` (theme, backup/restore, LAN sync, telemetry, reset).
- `src/theme/` (2 files) — `colors.js` (`themes[themeName][mode]`, 5 names × 3 modes) and `styles.js` (shared StyleSheets).
- `src/utils/` (14 files) — domain engines and platform adapters: `taskMutations.js` (pure task engine), `dateUtils.js` (centralized local-date engine), `logger.js` (gated structured logging + breadcrumb buffer), `storage.js` (versions, allowlist, migration), `vaultService.js` (vault registry/paths/migration), `fileStorage.js` (note file CRUD), `billingStorage.js` (billing persistence/analytics), `billingNotifications.js`, `notifications.js`, `syncService.js` (LAN sync), `exportService.js` (encrypted backup), `vaultImport.js`, `aiService.js` (on-device LLM + heuristic fallbacks), `diagnostics.js` (dev-gated probes, update check, telemetry).

## Entry Points

| Entry | Path | Invoked by |
|---|---|---|
| JS root | `index.js` → `App.js` (default export) | Expo runtime via `registerRootComponent` |
| Navigation root | `src/navigation/AppNavigator.js` (`AppNavigator`) | `App.js` inside providers + `NavigationContainer` |
| Widget headless entry | `widgets/widget-task-handler.tsx` (`widgetTaskHandler`) | `react-native-android-widget` via `registerWidgetTaskHandler` in `index.js` |
| Patch script | `patch-llama-gradle.js` | Post-install (package.json script) for `llama.rn` native build |
| Checks | `check.bat`, `package.json` scripts | Developer / CI (`jest`, `eslint`) |

## Platform-specific (android/, widgets/)

- `android/` — native shell: `app/` (`build.gradle`, `debug.keystore`, `proguard-rules.pro`, `src/` with manifest, MainActivity/Application, drawable/mipmap resources, widget provider XML), plus root `build.gradle`, `settings.gradle`, `gradle.properties`, `gradlew`/`gradlew.bat`. No first-party Kotlin/Java app logic — rendering stays in JS/TSX; native side hosts widgets and Expo modules.
- `widgets/` (5 `.tsx` files) — `FocusTimerWidget.tsx` (remaining/running), `DailyTasksWidget.tsx` (counts), `ImportantTasksWidget.tsx` (top-5 important unfinished), `TasksListWidget.tsx` (sorted top-8, `all|persistent` tabs, tick animation), `widget-task-handler.tsx` (WIDGET_ADDED/UPDATE/RESIZED/CLICK dispatch, `SWITCH_TAB` + `TOGGLE_TASK`/`COMPLETE_TASK` via shared `toggleTask`, direct AsyncStorage read/write, `requestWidgetUpdate` fan-out). `App.js` pushes widget updates throttled (5 s), staggered, app-active-gated, payload-sliced.

## Tests & Planning (.planning/, __tests__/, coverage/)

- `__tests__/` — Jest suites: `phase12-widget-logic.test.js` plus `unit/` (per-module unit tests, e.g. `taskMutations`, `dateUtils`, `logger`, `syncService`, `exportService`, `aiService` heuristics) and `setup/` (native module mocks — AsyncStorage, expo-file-system, notifications, llama.rn — for Node execution under the `jest-expo/android` preset). Run via `package.json` scripts; gated in `.github/workflows/ci.yml` alongside ESLint.
- `coverage/` — generated Jest coverage output (not source; do not edit).
- `.planning/` — GSD state, not runtime code: `PROJECT.md` (vision/scope), `REQUIREMENTS.md`, `ROADMAP.md` (19 phases), `STATE.md` (Phase 19 complete, Milestone 2 complete — current position/velocity/decisions), `phases/` (per-phase plans/summaries, e.g. `19-01-SUMMARY.md`), `codebase/` (this map: `ARCHITECTURE.md`, `STRUCTURE.md`, plus stack/conventions/testing/concerns docs), `debug/` (forensic captures).
