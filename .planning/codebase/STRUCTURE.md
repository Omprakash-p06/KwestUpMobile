# Repository Structure

**Analysis Date:** 2026-09-28

## Root Layout

```
KwestUpMobile/
├── App.js                  # Root component: state, handlers, persistence, providers (~1293 lines)
├── index.js                # Expo entry: registerRootComponent + widget task handler (11 lines)
├── app.json                # Expo config: name/slug/version, Android package, plugins, 4 widgets, EAS id
├── package.json            # Deps (Expo 53, RN 0.79.5, llama.rn, android-widget) + jest/eslint scripts
├── babel.config.js         # Babel preset (expo)
├── metro.config.js         # Metro bundler config
├── tsconfig.json           # TypeScript config (widgets are .tsx)
├── jest.config.js          # jest-expo/android preset, setup file, transform allowlist
├── eslint.config.js / .eslintrc.js  # Flat + legacy lint configs
├── eas.json                # EAS build profiles
├── patch-llama-gradle.js   # postinstall native patch for llama.rn Android build
├── check.bat               # Local lint+test helper script
├── src/                    # All app source (components, context, navigation, screens, theme, utils)
├── widgets/                # Android home-screen widgets + headless task handler (.tsx)
├── android/                # Ejected/bare native shell (gradle, app/src, debug.keystore)
├── assets/                 # App icon, splash, fonts bundle refs, widget previews
├── build/                  # Local build output (generated, not source)
├── coverage/               # Jest coverage output (generated)
├── __tests__/              # Jest suites (unit/ + widget logic + setup/)
├── .planning/              # GSD planning: PROJECT/ROADMAP/STATE, phases/, codebase/, debug/
├── .github/workflows/      # CI gate (ESLint + Jest + coverage)
├── GEMINI.md / README.md   # Repo docs
└── node_modules/           # Installed deps (generated)
```

| Entry | Kind | Purpose |
|---|---|---|
| `App.js` | file | State owner + provider seeder + persistence/widget effects + global modals |
| `index.js` | file | Dual registration: UI root + widget handler |
| `src/` | dir | Screens, components, context providers, navigation, theme, service utils |
| `src/context/` | dir | NEW in Phase 17: 4 providers (Task, Vault, Billing, Birthday) |
| `widgets/` | dir | 4 Android widgets + `widget-task-handler.tsx` |
| `android/` | dir | Native Android project (package `com.omprakashp06.kwestupmobile`) |
| `assets/` | dir | Icons, splash, `widget-preview/` images |
| `__tests__/` | dir | 7 unit suites + widget-logic suite + setup (incl. new taskMutations/taskContext tests) |
| `.planning/` | dir | Project memory: `STATE.md` (Phase 17 complete, ready for Phase 18), phase summaries, roadmap, codebase maps |
| `coverage/` | dir | Generated coverage report |
| `build/` | dir | Generated build artifacts |
| `app.json`, `package.json`, `eas.json` | files | Expo / npm / EAS build configuration |
| `jest.config.js`, `eslint.config.js`, `.eslintrc.js` | files | Test + lint configuration |
| `patch-llama-gradle.js` | file | `postinstall` native-build fixup for `llama.rn` |

## src/ Breakdown

```
src/
├── components/   # 14 reusable UI pieces (primitives + domain + AI + glass)
├── context/      # 4 state providers (Task, Vault, Billing, Birthday) — Phase 17
├── navigation/   # Drawer navigator + custom drawer content (2 files)
├── screens/      # 9 route screens (Dashboard … Search)
├── theme/        # colors.js (palette) + styles.js (shared StyleSheet)
└── utils/        # 13 domain services (storage, sync, AI, notifications… + taskMutations)
```

**`src/components/` — reusable UI (14 files):**
- Purpose: themed primitives and domain sheets shared across screens.
- Contains: `CustomButton.js`, `CustomTextInput.js`, `CustomCard.js`, `CustomBadge.js`, `CustomSwitch.js`, `CustomSegmentedButtons.js`, `CustomDateTimePicker.js` (primitives); `TaskCard.js`, `TaskEditModal.js`, `TimerLockoutOverlay.js` (domain); `AIAssistant.js` (floating NL overlay), `QRScannerModal.js` (sync-config scan); `LiquidGlassBackground.js`, `LiquidGlassCard.js` (glass surfaces).
- Key files: `TaskEditModal.js` (task create/edit form used globally from `App.js`); `AIAssistant.js` (wired in `AppNavigator.js` with `onTaskCreated/onBirthdayCreated/onTransactionCreated/onTasksExtracted`).

**`src/context/` — state providers (4 files, NEW Phase 17):**
- Purpose: the new mutation/state authority; each provider owns one domain slice and exposes actions.
- Contains: `TaskContext.js` (271 lines: `tasks/taskLists/dailyTasks`, 8 actions over `taskMutations.js`, `refreshTasksFromStorage`), `VaultContext.js` (99 lines: `vaults/activeVaultId/notes/activeNote`, vault switching), `BillingContext.js` (133 lines: `billingData` with auto-persisting actions), `BirthdayContext.js` (97 lines: `birthdays` with alarm-coupled save/delete).
- Wiring: mounted in `App.js:1054-1070` seeded by `initial*` props; consumed context-first in `src/navigation/AppNavigator.js:81-114` (`taskCtx?.x ?? props` pattern). New state goes here, not in `App.js`.

**`src/navigation/` — navigation shell (2 files):**
- Purpose: drawer router + drawer chrome; the only place screens are composed.
- Contains: `AppNavigator.js` (Drawer.Navigator, 9 `Drawer.Screen` render-prop bindings, context-first/prop-fallback resolution, AI overlay mount, `onTaskCreated/onBirthdayCreated/onTransactionCreated` creators), `CustomDrawerContent.js` (9-item themed menu, avatar header, light→dark→amoled cycler).
- Key files: `src/navigation/AppNavigator.js` — add a new route here (new `Drawer.Screen` + drawer item in `CustomDrawerContent.js`).

**`src/screens/` — route screens (9 files):**
- Purpose: one file per drawer route; presentational, props-in/callbacks-out, no direct persistence.
- Contains: `DashboardScreen.js` (overview), `DailyTasksScreen.js` (habits/streaks), `BirthdaysScreen.js`, `BillingScreen.js` (transactions/budgets/bills), `TaskListScreen.js` (lists/subtasks/recurrence), `NotesScreen.js` (vault browser + editor), `FocusTimerScreen.js`, `SettingsScreen.js` (theme/backup/sync/telemetry/reset), `SearchScreen.js` (cross-domain search).
- Key files: `SettingsScreen.js` (entry to `exportArchive`/`importArchive`/`performSync`), `NotesScreen.js` (vault switching via `handleSetActiveVault`).

**`src/theme/` — theming (2 files):**
- Purpose: single source of palette + shared styles.
- Contains: `colors.js` (`themes[5 names][light|dark|amoled]`), `styles.js` (container, dialogs, inputs).
- Key files: `src/theme/colors.js` — add a theme name here and register it in `App.js` `VALID_THEME_NAMES`.

**`src/utils/` — domain services (13 files):**
- Purpose: all I/O and logic: storage, files, vaults, backup crypto, sync, billing, notifications, dates, AI, diagnostics, import, plus the new pure mutation engine.
- Contains: `storage.js` (versions, key allowlist, cache clear, migration), `fileStorage.js` (vault `.md` CRUD/scan/wipe), `vaultService.js` (vault registry + migration), `exportService.js` (backup pipelines), `vaultImport.js` (`.md` picker import), `syncService.js` (LAN client), `billingStorage.js` + `billingNotifications.js` (finance store + alarms), `notifications.js` (task/birthday alarms), `dateUtils.js` (local-date authority, 174 lines / 7 exports), `aiService.js` (on-device LLM), `diagnostics.js` (device/network/update/telemetry), `taskMutations.js` (NEW Phase 17: 293 lines, 9 pure exports — `calculateNextRecurrence`, `toggleTask`, `completeTask`, `saveTask`, `deleteTask`, `toggleSubtask`, `createTaskList`, `renameTaskList`, `deleteTaskList`).
- Key files: `storage.js` (`STORAGE_VERSION = "v7.0"` — bump + extend `migrateUserDataIfNeeded` when changing persisted shape); `taskMutations.js` (add new task transforms here so app + widgets share them); `syncService.js` (validators + `performSync`); `exportService.js` (v2 envelope).

## Entry Points

| Entry | Path | Triggers | Responsibility |
|---|---|---|---|
| JS root | `index.js` | Expo launch | Registers `App` + widget handler; nothing else |
| App root | `App.js` | Mount after font/init gate | Init (`initializeApp`), load (`loadData`), save effects, widget push, 4 providers, global modals |
| State providers | `src/context/TaskContext.js`, `VaultContext.js`, `BillingContext.js`, `BirthdayContext.js` | Mounted by `App` | Domain state + mutation actions; seeded from `App` `initial*` props |
| Pure mutations | `src/utils/taskMutations.js` | Imported by `TaskContext` + widget handler | Framework-agnostic task transforms (no React/storage imports) |
| Navigation root | `src/navigation/AppNavigator.js` | Rendered by `App` inside `NavigationContainer` | Route table (initial `Dashboard`), context-first prop resolution, AI overlay |
| Widget headless | `widgets/widget-task-handler.tsx` | `WIDGET_ADDED/UPDATE/RESIZED/CLICK` from launcher | Tab switch + shared-`toggleTask` AsyncStorage toggle + widget re-render |
| Native launch | `android/app/src/` | OS process start | Android activity/application wiring for the Expo run build |

Startup order: `index.js` → `App` mount → font load + `initializeApp` (AsyncStorage parallel read, `initNotesFolder`, background vault-migration/cache-clear/diagnostics) → loading gate (`isLoading || !fontsLoaded`) → `loadData` (blob + filesystem + billing + alarms) → providers seed from `initial*` props → `NavigationContainer/AppNavigator` render.

## Platform-specific (android/, widgets/)

**`android/` — bare native shell:**
- Purpose: Expo `run:android` / EAS native project; package `com.omprakashp06.kwestupmobile` (`app.json`), `versionCode 7`.
- Contains: `app/` (`build.gradle`, `proguard-rules.pro`, `debug.keystore`, `src/` with MainActivity/Application + manifest), `gradle/`, `gradlew[.bat]`, `settings.gradle`, `build.gradle`, `gradle.properties`.
- Notes: `patch-llama-gradle.js` (`package.json` `postinstall`) patches the `llama.rn` Gradle module so the on-device LLM builds; `expo-build-properties` plugin sets iOS `useFrameworks: static` (relevant if iOS target is re-added).
- Committed: yes (ejected shell is part of the repo); `android/app/build`-type outputs are generated.

**`widgets/` — Android home-screen widgets (5 `.tsx` files):**
- Purpose: launcher widgets driven by `react-native-android-widget` (declared in `app.json`: FocusTimer, DailyTasks, ImportantTasks, TasksList; each `updatePeriodMillis: 1800000`, with preview PNGs in `assets/widget-preview/`).
- Contains: `FocusTimerWidget.tsx` (remaining/running projection), `DailyTasksWidget.tsx` (count/completed ring), `ImportantTasksWidget.tsx` (top-5 important unfinished), `TasksListWidget.tsx` (interactive sorted top-8, tab filter, ticking animation), `widget-task-handler.tsx` (273 lines: action dispatch + AsyncStorage read/write + re-render; task toggles now go through shared `toggleTask` from `src/utils/taskMutations.js`).
- Data contract: widgets never call React state — they read `kwestup_data_<STORAGE_VERSION>` / `kwestup_timer_state_*` / `kwestup_widget_*` keys directly; `App.js` pushes, foreground reload (`App.js` + `TaskContext`) absorbs reverse writes. iOS has no widget target (Android-only).

## Tests & Planning (.planning/, __tests__/, coverage/)

**`__tests__/` — Jest suites (`jest-expo/android` preset):**
- Layout: `unit/` (7 files) + `phase12-widget-logic.test.js` + `setup/jest.setup.js` (native-module mocks for Node execution).
- Files: `__tests__/unit/dateUtils.test.js`, `exportImportService.test.js`, `storageMigration.test.js`, `syncService.test.js`, `vaultAndFileStorage.test.js`, `taskMutations.test.js` (NEW Phase 17: pure-engine unit tests), `taskContext.test.js` (NEW Phase 17: provider action tests); `__tests__/phase12-widget-logic.test.js` (widget toggle/recurrence parity).
- Commands: `npm test` (all), `npm run test:watch`, `npm run test:coverage` → `coverage/`. Per `.planning/STATE.md`: 100% pass across 9 suites (109 tests) after Phases 14–17.
- Where to add: colocate by domain — storage/versioning → `unit/storageMigration.test.js`; sync validators → `unit/syncService.test.js`; vault/FS ops → `unit/vaultAndFileStorage.test.js`; backup crypto → `unit/exportImportService.test.js`; task transforms → `unit/taskMutations.test.js`; provider actions → `unit/taskContext.test.js`; new widget behavior → extend `phase12-widget-logic.test.js` (auto-matched by `testMatch: **/__tests__/**/*.test.[jt]s?(x)`).

**`.planning/` — project memory (GSD):**
- Files: `PROJECT.md` (vision/constraints), `ROADMAP.md` (19 phases), `STATE.md` (Phase 17 of 19 complete — plans 17-01/17-02 executed, ready for Phase 18; 89% progress), `phases/` (per-phase `PLAN.md` + `*-SUMMARY.md`), `codebase/` (these maps), `debug/` (forensics sessions).
- Relevance: Phase 18 planning must account for the half-migrated state — `App.js` legacy handlers still live alongside the new providers. Do not regress the shared-mutation contract (`taskMutations.js` ↔ `widget-task-handler.tsx` ↔ `TaskContext.js`) or the dual-writer widget path without updating the corresponding tests.

**`coverage/` — generated Jest coverage:**
- Purpose: HTML/lcov output of `npm run test:coverage`; not source, safe to regenerate/delete.
