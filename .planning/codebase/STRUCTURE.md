# Repository Structure

**Analysis Date:** 2026-09-28

## Root Layout

```
KwestUpMobile/
├── App.js                  # Root component: state, handlers, persistence, providers (~1293 lines)
├── index.js                # Expo entry: registerRootComponent + widget task handler (11 lines)
├── app.json                # Expo config: name/slug/version, Android package, plugins, 4 widgets, EAS id
├── package.json            # Deps (Expo 53, RN 0.79.5, llama.rn, android-widget) + jest/eslint scripts
├── babel.config.js         # Babel preset (expo) + reanimated plugin
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
├── __tests__/              # Jest suites (unit/ + widget logic + setup/) — 10 suites, 138 tests
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
| `src/context/` | dir | 4 domain context providers (Task, Vault, Billing, Birthday) |
| `widgets/` | dir | 4 Android widgets + `widget-task-handler.tsx` |
| `android/` | dir | Native Android project (package `com.omprakashp06.kwestupmobile`) |
| `assets/` | dir | Icons, splash, `widget-preview/` images |
| `__tests__/` | dir | 8 unit suites + widget-logic suite + setup smoke test (10 total suites) |
| `.planning/` | dir | Project memory: `STATE.md`, phase summaries, roadmap, codebase maps |
| `coverage/` | dir | Generated coverage report |
| `build/` | dir | Generated build artifacts |
| `app.json`, `package.json`, `eas.json` | files | Expo / npm / EAS build configuration |
| `jest.config.js`, `eslint.config.js`, `.eslintrc.js` | files | Test + lint configuration |
| `patch-llama-gradle.js` | file | `postinstall` native-build fixup for `llama.rn` |

## src/ Breakdown

```
src/
├── components/   # 14 reusable UI pieces (primitives + domain + AI + glass)
├── context/      # 4 state providers (Task, Vault, Billing, Birthday)
├── navigation/   # Drawer navigator + custom drawer content (2 files)
├── screens/      # 9 route screens (Dashboard … Search)
├── theme/        # colors.js (palette) + styles.js (shared StyleSheet)
└── utils/        # 13 domain services (storage, sync, AI, notifications… + taskMutations)
```

### `src/components/`
- `CustomButton.js`, `CustomTextInput.js`, `CustomCard.js`, `CustomBadge.js`, `CustomSwitch.js`, `CustomSegmentedButtons.js`, `CustomDateTimePicker.js` — reusable UI primitives.
- `TaskCard.js`, `TaskEditModal.js` — task list items, checkbox interactions, edit modal.
- `TimerLockoutOverlay.js` — focus timer strict lockout overlay.
- `LiquidGlassBackground.js`, `LiquidGlassCard.js` — glassmorphic theme styling.
- `AIAssistant.js` — floating action button & bottom sheet modal for on-device AI operations with unmount memory cleanup.
- `QRScannerModal.js` — camera modal for scanning LAN sync connection tokens.

### `src/context/`
- `TaskContext.js` — tasks, task lists, daily tasks state; delegates mutations to pure `taskMutations.js`.
- `VaultContext.js` — vault list, active vault selection, note file scanning.
- `BillingContext.js` — transactions, budgets, recurring bills state.
- `BirthdayContext.js` — birthdays state with notification synchronization.

### `src/navigation/`
- `AppNavigator.js` — drawer navigation shell with context-first and prop fallback resolution.
- `CustomDrawerContent.js` — sidebar header, theme switcher, navigation links.

### `src/screens/`
- `DashboardScreen.js` — daily overview, quick stats, active vaults.
- `DailyTasksScreen.js` — daily recurring tasks and habit tracking with streak counters.
- `TaskListScreen.js` — task management, lists, filters, subtask hierarchy.
- `NotesScreen.js` — markdown note editor with syntax highlighting and vault scoping.
- `BillingScreen.js` — expense and budget tracking with offline analytics.
- `BirthdaysScreen.js` — birthday reminders and calendar countdowns.
- `FocusTimerScreen.js` — Pomodoro and strict lockout timer.
- `SearchScreen.js` — global search across tasks, notes, and birthdays.
- `SettingsScreen.js` — backup/export, LAN sync setup, diagnostics, theme preferences.

### `src/utils/`
- `taskMutations.js` — pure, framework-agnostic task mutation engine with recurrence calculation.
- `dateUtils.js` — centralized local-timezone calendar date calculation engine.
- `aiService.js` — on-device GGUF LLM service with pinned release, integrity verification, memory lifecycle, and heuristic fallback.
- `storage.js` — storage versioning, user data key allowlisting, and legacy migration.
- `fileStorage.js` — markdown filesystem operations under vault directories.
- `vaultService.js` — vault folder creation and directory indexing.
- `syncService.js` — LAN peer-to-peer sync client with strict validation.
- `exportService.js` — encrypted `.kwestup` backup packaging and restoration (v2 PBKDF2).
- `notifications.js` — local notification scheduling and cancellation.
- `billingStorage.js` — billing transactions and budget calculations.
- `billingNotifications.js` — bill reminder alarms.
- `diagnostics.js` — system diagnostics, network checks, update check.
- `vaultImport.js` — external markdown file batch importer.

## `__tests__/` Breakdown

```
__tests__/
├── phase12-widget-logic.test.js    # 10 tests: widget logic & array slicing
├── setup/
│   ├── jest.setup.js               # Global test harness and native module mocks
│   └── jest.setup.test.js          # 5 tests: mock integrity verification
└── unit/
    ├── aiService.test.js           # 29 tests: model pinning, integrity, memory lifecycle, fallbacks
    ├── dateUtils.test.js           # 28 tests: timezone-safe local date operations
    ├── exportImportService.test.js # 10 tests: v2 encryption envelope and backup import/export
    ├── storageMigration.test.js    # 9 tests: version keys, migration, and cache clearing
    ├── syncService.test.js         # 16 tests: LAN handshake and payload schema validation
    ├── taskContext.test.js         # 5 tests: TaskContext provider and foreground sync
    ├── taskMutations.test.js       # 15 tests: pure task mutation engine and recurrence
    └── vaultAndFileStorage.test.js # 11 tests: filesystem note operations and vault CRUD
```
**Total:** 10 suites, 138 tests passing.
