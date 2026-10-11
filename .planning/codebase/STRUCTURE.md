# Codebase Structure

**Analysis Date:** 2026-10-12

## Directory Layout

```
KwestUpMobile/
├── index.js                # Expo entry: registerRootComponent + widget handler
├── App.js                  # Composition root (1118 lines): boot, providers, timer, sync
├── app.json                # Expo config: name/slug/version, 5 Android widgets, plugins
├── package.json            # Expo ~57, RN 0.86, React 19.2.3, jest-expo
├── eas.json                # EAS build profiles
├── jest.config.js          # jest-expo preset, __tests__ match
├── babel.config.js / metro.config.js  # Babel + Metro bundler config
├── tsconfig.json           # TS (behavior/ai/commands/services are .ts)
├── eslint.config.js / .eslintrc.js    # Lint config (legacy + flat)
├── assets/                 # App icon, splash, widget preview images
├── android/                # Native Android shell (widget host config)
├── build/                  # Local build output (generated, not committed)
├── coverage/               # Jest coverage output (generated, not committed)
├── src/
│   ├── ai/                 # On-device AI: intent → compiler → review (7 .ts files)
│   ├── behavior/           # Habit domain engines + eventBus + types (9 .ts files)
│   ├── commands/           # Validated command gateway + AI sandbox (7 .ts files)
│   ├── components/         # 16 reusable UI components (.js)
│   ├── context/            # 5 domain providers (.js)
│   ├── domains/            # README placeholder only (no code yet)
│   ├── navigation/         # Drawer navigator + custom drawer content (2 files)
│   ├── screens/            # 9 feature screens (.js)
│   ├── services/           # Notification policy engine + types (2 .ts files)
│   ├── theme/              # colors.js (5×3 palettes) + styles.js
│   └── utils/              # 14 modules: storage, files, vault, AI, sync, etc. (.js)
├── widgets/                # 5 Android widgets + headless task handler (.tsx)
├── __tests__/              # unit/ + setup + phase12-widget-logic.test.js
├── rulebook/               # Atomic-habits machine rules consumed by ruleEngine
├── 4.0/                    # Master plan + specs (engine source docs)
├── .planning/              # GSD planning state + codebase maps (this file lives here)
├── .github/                # CI workflows
└── patch-llama-gradle.js   # postinstall native patch for llama.rn
```

## Directory Purposes

**`src/screens/`:**
- Purpose: One full route per feature; receives state via props resolved in `AppNavigator` + direct context hooks.
- Contains: `DashboardScreen.js`, `DailyTasksScreen.js`, `BirthdaysScreen.js`, `TaskListScreen.js`, `NotesScreen.js`, `FocusTimerScreen.js`, `BillingScreen.js`, `SettingsScreen.js`, `SearchScreen.js`.
- Key files: `DashboardScreen.js` (aggregates tasks/notes/birthdays + weekly-review entry), `NotesScreen.js` (vault-aware editor, heaviest screen), `SettingsScreen.js` (theme, sync, telemetry, reset).

**`src/components/`:**
- Purpose: Reusable presentational + modal components; no route logic.
- Contains: 16 `.js` files — primitives (`CustomButton`, `CustomTextInput`, `CustomCard`, `CustomBadge`, `CustomSwitch`, `CustomSegmentedButtons`, `CustomDateTimePicker`), domain cards (`TaskCard`, `TaskEditModal`), overlays (`TimerLockoutOverlay`, `QRScannerModal`, `WeeklyReviewModal`), app chrome (`AIAssistant`, `ErrorBoundary`, `LiquidGlassBackground`, `LiquidGlassCard`).
- Key files: `ErrorBoundary.js` (root crash fallback), `AIAssistant.js` (floating AI entry), `TaskEditModal.js` (mounted once in `AppNavigator`, not per screen).

**`src/context/`:**
- Purpose: Authoritative per-domain state + persistence + side-effects. The only place with `setState` for its domain.
- Contains: `TaskContext.js`, `VaultContext.js`, `HabitContext.js`, `BillingContext.js`, `BirthdayContext.js`.
- Key files: `TaskContext.js` (424 lines — task authority + write-through persistence + notification + `eventBus` wiring); `HabitContext.js` (648 lines — 4 isolated storage keys, recovery machine, debounced writes).

**`src/behavior/`:**
- Purpose: Pure habit-domain engines + immutable domain event bus. No React, no I/O (except `ruleEngine` loading `rulebook/` JSON).
- Contains: `types.ts` (all domain + event + intervention types), `eventBus.ts` (singleton), `habitEngine.ts`, `cueEngine.ts`, `recoveryEngine.ts`, `rewardEngine.ts`, `interventionEngine.ts` (incl. `selectWidgetTouchpoint`), `improvementEngine.ts`, `ruleEngine.ts`.
- Key files: `eventBus.ts` (pub/sub + ring buffer + `useDomainEvent` hook), `types.ts` (event union `TASK_* / HABIT_* / BILL_* / BIRTHDAY_* / FOCUS_* / WIDGET_ACTION / COMMAND_*`).

**`src/ai/`:**
- Purpose: Deterministic on-device AI pipeline stages; barred-exported via `index.ts`.
- Contains: `types.ts`, `intentParser.ts`, `heuristicParser.ts`, `rulePacketRetriever.ts`, `behaviorCompiler.ts`, `frictionAnalyzer.ts`, `weeklyReviewEngine.ts`, `index.ts` (barrel).
- Key files: `behaviorCompiler.ts` (547 lines — natural-language → `CompiledHabitPlan`), `weeklyReviewEngine.ts` (review generation for `WeeklyReviewModal`).

**`src/commands/`:**
- Purpose: Validated mutation gateway shielding UI/widgets/AI from raw engine calls.
- Contains: `types.ts`, `commandValidator.ts`, `commandExecutor.ts`, `habitCommandHandlers.ts`, `aiSandbox.ts` (untrusted-output fence), `useCommandGateway.ts` (React binding), `index.ts` (barrel).
- Key files: `useCommandGateway.ts` (`dispatchCommand` / `dispatchAiCommand`), `commandExecutor.ts` (idempotency + `COMMAND_EXECUTED/FAILED` emission).

**`src/services/`:**
- Purpose: OS notification policy + dispatch; the only module that talks to `expo-notifications` for scheduling.
- Contains: `notificationService.ts` (767 lines — channels, policy evaluation, task/birthday/bill schedulers, cancellation), `types.ts` (channels, policy, dispatch request/history types).
- Key files: `notificationService.ts` — every schedule/cancel flows through here (`scheduleNotification`, `scheduleDailyTaskReminder`, `scheduleDueDateReminder`, `scheduleBirthdayReminders`, `scheduleBillReminder`).

**`src/utils/`:**
- Purpose: Platform adapters, persistence, and shared pure helpers.
- Contains: `storage.js` (versions, `isUserDataKey`, cache clear, cross-version migration), `fileStorage.js` (vault-parameterized markdown CRUD), `vaultService.js` (vault CRUD + migration), `taskMutations.js` (pure task engine shared with widgets), `aiService.js` (1064 lines — `llama.rn` lifecycle), `syncService.js` (LAN sync client), `notifications.js` (legacy birthday helpers), `billingStorage.js` + `billingNotifications.js`, `dateUtils.js` (`getLocalDateString` used everywhere for streaks), `diagnostics.js`, `exportService.js`, `logger.js`, `vaultImport.js`.
- Key files: `storage.js` (`STORAGE_VERSION=v7.0`, `APP_VERSION=v3.5.0`), `aiService.js` (model path, SHA pin, idle unload), `syncService.js` (`validateSyncConfig`, `performSync`).

**`src/navigation/`:**
- Purpose: Drawer routing + shared modal hosting.
- Contains: `AppNavigator.js` (9 `Drawer.Screen`s, `effectiveX = ctx ?? props` resolution, `TaskEditModal` + `WeeklyReviewModal` + `AIAssistant` mounts), `CustomDrawerContent.js`.
- Key files: `AppNavigator.js` (406 lines).

**`src/theme/`:**
- Purpose: All visual tokens; screens/components take `currentTheme` as a prop, never hardcode colors.
- Contains: `colors.js` (`dribbbleColors` + `themes`: clean/blue/green/purple/dribbble × light/dark/amoled), `styles.js` (shared `StyleSheet` incl. `dialogContent`, `modalOverlay` used by `App.js` modals).
- Key files: `colors.js`, `styles.js`.

**`widgets/`:**
- Purpose: Android home-screen widgets + headless JS handler (separate runtime, storage-coupled to app).
- Contains: `FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx`, `HabitWidget.tsx`, `widget-task-handler.tsx` (513 lines — click actions, re-render, tab state).
- Key files: `widget-task-handler.tsx` (imports pure engines + habit keys from `src/context/HabitContext.js` but never the providers themselves).

**`__tests__/`:**
- Purpose: Jest suites (`jest-expo` preset). Mirrors `src/` domains for unit tests plus widget-logic coverage.
- Contains: `unit/` (per-engine specs), `setup/` (mocks for Expo/native modules), `phase12-widget-logic.test.js`.
- Key files: `jest.config.js` (root config), `__tests__/setup/*` (required for any new native-dependent test).

**`src/domains/`:**
- Purpose: Reserved placeholder for future domain slices; currently `README.md` only — do not place code here yet.

**`rulebook/` + `4.0/`:**
- Purpose: Product source-of-truth: `rulebook/machine/*.json` (rules evaluated by `src/behavior/ruleEngine.ts`), `rulebook/ai/*.md`, `4.0/KwestUp_4.0_Master_Plan.md` + specs. Engines cite their source section in file headers.
- Generated: No. Committed: Yes (read when changing behavior/AI logic).

## Key File Locations

**Entry Points:**
- `index.js`: Expo registration (`registerRootComponent(App)`, `registerWidgetTaskHandler`).
- `App.js`: Boot (`initializeApp`, `loadData`), provider stack, timer loop, widget fan-out, sync/reset, global modals.
- `widgets/widget-task-handler.tsx`: Headless OS entry for all widget actions/render.

**Configuration:**
- `app.json`: Expo slug/version, icon/splash, `llama.rn` + camera + build-properties plugins, 5 `react-native-android-widget` widget registrations, EAS project ID.
- `package.json`: Deps + `start/android/ios/lint/typecheck/test` scripts + `postinstall: node patch-llama-gradle.js`.
- `eas.json`: EAS build profiles. `jest.config.js`: test preset/match. `tsconfig.json`: TS for `.ts/.tsx` layers. `eslint.config.js` + `.eslintrc.js`: lint (flat + legacy). `babel.config.js` + `metro.config.js`: bundler. `patch-llama-gradle.js`: native patch applied on install.

**Core Logic:**
- Task authority: `src/context/TaskContext.js` + `src/utils/taskMutations.js`.
- Notes/vaults: `src/context/VaultContext.js` + `src/utils/vaultService.js` + `src/utils/fileStorage.js`.
- Habits/behavior: `src/context/HabitContext.js` + `src/behavior/*.ts`.
- Commands/AI: `src/commands/*` + `src/ai/*` + `src/utils/aiService.js`.
- Notifications: `src/services/notificationService.ts`.
- Sync: `src/utils/syncService.js` (client) + `App.js:769-847 handleExecuteSync` (apply).

**Testing:**
- Config: `jest.config.js`. Setup/mocks: `__tests__/setup/`. Unit suites: `__tests__/unit/`. Widget-logic suite: `__tests__/phase12-widget-logic.test.js`.

## Naming Conventions

**Files:**
- Screens: `<Feature>Screen.js` — e.g. `TaskListScreen.js`, `DailyTasksScreen.js` (note: drawer route is `Daily`, `Tasks`, `Focus` — not the filename). Screens are `.js`, never `.tsx`.
- Reusable UI: `Custom*.js` for design-system primitives (`CustomButton`, `CustomCard`, `CustomTextInput`, `CustomSwitch`, `CustomSegmentedButtons`, `CustomDateTimePicker`, `CustomBadge`); domain components use plain names (`TaskCard`, `TaskEditModal`, `TimerLockoutOverlay`, `WeeklyReviewModal`, `QRScannerModal`, `AIAssistant`, `ErrorBoundary`, `LiquidGlass*`).
- Contexts: `<Domain>Context.js` exporting `<Domain>Provider` + `use<Domain>s` hook — e.g. `TaskContext.js` → `TaskProvider` + `useTasks`.
- Pure engines: `<domain><Concern>.ts` camelCase — `habitEngine.ts`, `interventionEngine.ts` (`src/behavior/`); `<feature><Concern>.ts` in AI (`behaviorCompiler.ts`, `frictionAnalyzer.ts`). JS utils are camelCase `.js` — `taskMutations.js`, `fileStorage.js`, `vaultService.js`.
- Widgets: `<Name>Widget.tsx` + lowercase `widget-task-handler.tsx` (only kebab-case file in repo — do not copy the style).
- Storage keys: `kwestup_<domain>_<version>` — e.g. `kwestup_data_v7.0`, `kwestup_habits_v1`, `kwestup_widget_active_tab`. New keys must be added to `isUserDataKey` in `src/utils/storage.js` or cache-clear will delete them.
- Behavior events: `SCREAMING_SNAKE` lifecycle verbs — `TASK_COMPLETED`, `HABIT_MISSED`, `WIDGET_ACTION`, `COMMAND_EXECUTED` (`src/behavior/types.ts`).

**Directories:**
- Lowercase plural nouns for code collections: `screens/`, `components/`, `utils/`, `services/`, `widgets/`. Singular for conceptual layers: `behavior/`, `ai/`, `theme/`, `navigation/`, `context/`, `commands/`, `domains/`.

## Where to Add New Code

**New Feature:**
- Primary code: Screen in `src/screens/<Feature>Screen.js` + route in `src/navigation/AppNavigator.js` + state in the owning `src/context/<Domain>Context.js` (or a new context if it is a new domain — mirror the provider + hook + storage-key + `isUserDataKey` pattern).
- Tests: `__tests__/unit/<feature>.test.js` reusing `__tests__/setup/*` mocks.

**New Component/Module:**
- Implementation: Reusable UI → `src/components/<Name>.js` (accept `currentTheme` prop, add to no barrel — import by path like `AppNavigator.js` does). Pure domain logic → `src/behavior/<name>.ts` (habits) or `src/utils/<name>.js` (platform/persistence) so the headless widget can import it without React.

**Utilities:**
- Shared helpers: `src/utils/<name>.js` for platform/persistence/date code; `src/behavior/<name>Engine.ts` for pure habit-domain math; AI stages → `src/ai/<stage>.ts` + re-export from `src/ai/index.ts`; commands → `src/commands/*` + gateway dispatch, never direct engine calls from screens.

## Special Directories

**`android/`:**
- Purpose: Native Android project (widget host declarations, permissions).
- Generated: Partially (Expo prebuild output + hand edits). Committed: Yes.

**`build/` and `coverage/`:**
- Purpose: Local build artifacts and Jest coverage HTML/LCOV.
- Generated: Yes. Committed: No (regenerate with EAS/`jest --coverage`).

**`assets/`:**
- Purpose: Icons, splash, `widget-preview/*` images referenced by `app.json`.
- Generated: No. Committed: Yes — keep `widget-preview/<name>-preview.png` in sync when adding a widget.

**`4.0/`:**
- Purpose: Master plan + phase specs (`KwestUp_4.0_Master_Plan.md`); normative for behavior/AI work.
- Generated: No. Committed: Yes.

**`.planning/`:**
- Purpose: GSD state (`codebase/` maps incl. this file, phase plans, roadmap).
- Generated: Yes (by GSD commands). Committed: Yes.

---

*Structure analysis: 2026-10-12*
