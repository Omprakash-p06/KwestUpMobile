# Codebase Structure

**Analysis Date:** 2026-10-12

## Directory Layout

```
KwestUpMobile/
├── index.js                # Expo entry: registerRootComponent + widget handler
├── App.js                  # Root component: boot, state, providers, timer, widgets
├── app.json                # Expo config: name, package, 5 Android widgets, plugins
├── package.json            # Deps (Expo 57, RN 0.86, React 19) + jest/lint scripts
├── eas.json                # EAS build profiles
├── metro.config.js         # Metro bundler config
├── babel.config.js         # Babel config
├── tsconfig.json           # TypeScript config (4.0 TS subsystem)
├── jest.config.js          # Jest config (jest-expo preset)
├── eslint.config.js / .eslintrc.js  # Lint configs
├── assets/                 # App icons, splash, fonts, widget previews
├── src/
│   ├── screens/            # 9 drawer screens (JS)
│   ├── components/         # 16 shared UI components (JS)
│   ├── navigation/         # Drawer navigator + custom drawer content
│   ├── context/            # 5 domain providers (JS)
│   ├── behavior/           # Habit/behavior engines + event bus (TS)
│   ├── ai/                 # On-device AI pipeline (TS)
│   ├── commands/           # Command gateway + sandbox (TS)
│   ├── domains/            # 4.0 domain-boundary placeholder (README only)
│   ├── services/           # Notification service (TS)
│   ├── theme/              # Theme palettes + global styles (JS)
│   └── utils/              # Storage, files, vaults, tasks, AI service, sync (JS)
├── widgets/                # 5 Android widgets + headless task handler (TSX)
├── __tests__/             # Jest suites: unit/ + widget-logic + setup
├── android/                # Native Android shell (Expo prebuild)
├── build/                  # Local build output (generated, not committed)
├── coverage/               # Jest coverage output (generated, not committed)
├── rulebook/               # Habit/AI/machine rules (JSON + MD, source of truth)
├── 4.0/                    # 4.0 master plan + phase docs
├── .planning/              # GSD planning state + codebase maps
├── .github/                # CI workflows
└── patch-llama-gradle.js   # postinstall native patch for llama.rn
```

## Directory Purposes

**`src/screens/`:**
- Purpose: One file per drawer route; screen-level composition + list rendering + dialogs
- Contains: `DashboardScreen.js`, `DailyTasksScreen.js`, `BirthdaysScreen.js`, `BirthdaysScreen.js`, `BillingScreen.js`, `TaskListScreen.js`, `NotesScreen.js` (largest, ~74k), `FocusTimerScreen.js`, `SearchScreen.js`, `SettingsScreen.js`
- Key files: `NotesScreen.js` (vault explorer + markdown editor + extraction callbacks), `BillingScreen.js` (transactions/budgets/bills), `DashboardScreen.js` (aggregated overview + weekly-review entry)

**`src/components/`:**
- Purpose: Reusable UI primitives, cards, modals, overlays, AI assistant
- Contains: Primitives (`CustomButton.js`, `CustomTextInput.js`, `CustomCard.js`, `CustomBadge.js`, `CustomSwitch.js`, `CustomSegmentedButtons.js`, `CustomDateTimePicker.js`), domain cards (`TaskCard.js`, `LiquidGlassCard.js`), shells (`LiquidGlassBackground.js`, `ErrorBoundary.js`, `TimerLockoutOverlay.js`), feature modals (`TaskEditModal.js`, `WeeklyReviewModal.js`, `QRScannerModal.js`), `AIAssistant.js`
- Key files: `AIAssistant.js` (on-device chat + extraction), `TaskEditModal.js` (single global instance in `AppNavigator`), `ErrorBoundary.js` (root crash guard)

**`src/navigation/`:**
- Purpose: Drawer route table + drawer chrome
- Contains: `AppNavigator.js` (9 `Drawer.Screen` entries, context→prop bridging, global modals), `CustomDrawerContent.js` (themed drawer UI)
- Key files: `src/navigation/AppNavigator.js`

**`src/context/`:**
- Purpose: Per-domain state ownership + persistence + event emission
- Contains: `TaskContext.js` (tasks/lists/daily + write-through), `HabitContext.js` (habits/events/rewards/interventions), `VaultContext.js` (vault list/active/note mirror), `BillingContext.js` (billing sole-writer), `BirthdayContext.js` (birthdays + reminders)
- Key files: `src/context/TaskContext.js`, `src/context/HabitContext.js`

**`src/behavior/`:**
- Purpose: Pure habit/behavior engines + typed event bus (TypeScript)
- Contains: `eventBus.ts`, `types.ts`, `habitEngine.ts`, `cueEngine.ts`, `ruleEngine.ts`, `recoveryEngine.ts`, `rewardEngine.ts`, `improvementEngine.ts`, `interventionEngine.ts`
- Key files: `src/behavior/eventBus.ts`, `src/behavior/types.ts`, `src/behavior/interventionEngine.ts`

**`src/ai/`:**
- Purpose: Deterministic on-device AI pipeline stages (TypeScript, barrel via `index.ts`)
- Contains: `index.ts`, `types.ts`, `intentParser.ts`, `heuristicParser.ts`, `rulePacketRetriever.ts`, `behaviorCompiler.ts`, `frictionAnalyzer.ts`, `weeklyReviewEngine.ts`
- Key files: `src/ai/index.ts`, `src/ai/behaviorCompiler.ts`, `src/ai/weeklyReviewEngine.ts`

**`src/commands/`:**
- Purpose: Validated idempotent command gateway + AI sandbox (TypeScript, barrel via `index.ts`)
- Contains: `index.ts`, `types.ts`, `commandValidator.ts`, `commandExecutor.ts`, `habitCommandHandlers.ts`, `idempotencyStore.ts`, `aiSandbox.ts`, `useCommandGateway.ts`
- Key files: `src/commands/commandExecutor.ts`, `src/commands/types.ts`

**`src/domains/`:**
- Purpose: Reserved 4.0 per-domain isolation boundary (scaffold only)
- Contains: `README.md` (planned `habits/`, `identity/`, `events/`, `interventions/`, `ai/` subdomains + isolation rules)
- Key files: `src/domains/README.md`

**`src/services/`:**
- Purpose: OS-facing services with strict types (TypeScript)
- Contains: `notificationService.ts` (channels, scheduling, cancel), `types.ts`
- Key files: `src/services/notificationService.ts`

**`src/theme/`:**
- Purpose: Theming source of truth
- Contains: `colors.js` (`themes.{clean,blue,green,purple,dribbble}.{light,dark,amoled}`), `styles.js` (global StyleSheet)
- Key files: `src/theme/colors.js`, `src/theme/styles.js`

**`src/utils/`:**
- Purpose: Framework-agnostic helpers + persistence + platform bridges (JavaScript)
- Contains: `storage.js` (version keys, cache clear, migration), `fileStorage.js` (vault markdown FS), `vaultService.js` (vault CRUD/migration), `taskMutations.js` (pure task engine), `aiService.js` (llama.rn lifecycle), `notifications.js` + `billingNotifications.js` (legacy/specialized scheduling), `billingStorage.js`, `dateUtils.js`, `generateId.js`, `logger.js`, `diagnostics.js`, `syncService.js`, `exportService.js`, `vaultImport.js`
- Key files: `src/utils/storage.js`, `src/utils/taskMutations.js`, `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/aiService.js`

**`widgets/`:**
- Purpose: Android home-screen widgets (render components + headless logic)
- Contains: `FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx`, `HabitWidget.tsx`, `widget-task-handler.tsx` (OS entry: click handling + render dispatch + direct-storage mutation)
- Key files: `widgets/widget-task-handler.tsx`

**`__tests__/`:**
- Purpose: Jest suites mirroring `src/` engines + contexts + services
- Contains: `unit/` (30 suites: `taskMutations`, `taskContext`, `habitContext`, `eventBus`, `interventionEngine`, `behaviorCompiler`, `commandGateway`, `aiService`, `vaultAndFileStorage`, …), `phase12-widget-logic.test.js`, `setup/jest.setup.js`
- Key files: `jest.config.js` (root config, jest-expo preset), `__tests__/setup/jest.setup.js`

**`rulebook/` + `4.0/`:**
- Purpose: Product source of truth — atomic-habit rules, AI specs, machine `rules.json`, master plan
- Contains: `rulebook/atomic-habits/`, `rulebook/ai/`, `rulebook/machine/rules.json`, `rulebook/rules/`; `4.0/KwestUp_4.0_Master_Plan.md` + phase docs
- Key files: Check `rulebook/` directly; engines cite these as `Source:` headers

## Key File Locations

**Entry Points:**
- `index.js`: Expo `registerRootComponent(App)` + `registerWidgetTaskHandler(widgetTaskHandler)`
- `App.js`: Root component (1114 lines) — boot, providers, timer, widgets, modals
- `src/navigation/AppNavigator.js`: Drawer route table + global overlays
- `widgets/widget-task-handler.tsx`: Headless widget OS entry

**Configuration:**
- `app.json`: Expo name/slug/version, Android package `com.omprakashp06.kwestupmobile`, 5 widget registrations, `llama.rn` + camera + build-properties plugins
- `package.json`: Scripts (`start`, `android`, `lint`, `typecheck`, `test`), Expo 57 / RN 0.86 / React 19 dependency pins
- `tsconfig.json`: TypeScript config for `src/behavior|ai|commands|services` + `widgets`
- `jest.config.js` + `__tests__/setup/jest.setup.js`: Test runner config + setup
- `eslint.config.js`, `.eslintrc.js`: Lint configs
- `metro.config.js`, `babel.config.js`: Bundler/transform config
- `eas.json`: EAS build profiles

**Core Logic:**
- `src/utils/taskMutations.js`: Pure task/list engine shared by app + widget
- `src/behavior/habitEngine.ts` + `recoveryEngine.ts` + `rewardEngine.ts` + `interventionEngine.ts`: Habit lifecycle
- `src/commands/commandExecutor.ts` + `commandValidator.ts` + `idempotencyStore.ts`: Command gateway
- `src/ai/behaviorCompiler.ts` + `intentParser.ts` + `weeklyReviewEngine.ts`: AI pipeline
- `src/behavior/eventBus.ts`: Telemetry backbone singleton

**Testing:**
- `__tests__/unit/`: Per-engine suites (e.g., `taskMutations.test.js`, `interventionEngine.test.ts`, `commandGateway.test.ts`)
- `__tests__/phase12-widget-logic.test.js`: Widget pure-logic suite
- `coverage/`: Generated coverage output (do not edit)

## Naming Conventions

**Files:**
- Screens: `<Domain>Screen.js` (PascalCase + `Screen` suffix) — e.g., `src/screens/TaskListScreen.js`
- Shared UI: `Custom*.js` for primitives (`CustomButton.js`), `<Domain><Kind>.js` for feature UI (`TaskCard.js`, `TaskEditModal.js`, `WeeklyReviewModal.js`, `QRScannerModal.js`)
- Contexts: `<Domain>Context.js` exporting `<Domain>Provider` + `use<Domain>s` hook — e.g., `src/context/TaskContext.js` → `TaskProvider`/`useTasks`
- Behavior engines: `<concern>Engine.ts` (e.g., `habitEngine.ts`, `ruleEngine.ts`); pipeline stages keep functional names (`intentParser.ts`, `behaviorCompiler.ts`, `frictionAnalyzer.ts`)
- Commands: `command<Noun>.ts` (`commandExecutor.ts`, `commandValidator.ts`) + `habitCommandHandlers.ts` + `aiSandbox.ts`
- Utils: `<concern>[Service|Storage].js` (`vaultService.js`, `fileStorage.js`, `syncService.js`, `aiService.js`, `billingStorage.js`)
- Widgets: `<Name>Widget.tsx` + lowercase `widget-task-handler.tsx` (only kebab-case file in repo)
- Tests: `<unit> .test.{js,ts}` mirroring source name (`taskMutations.test.js`, `eventBus.test.ts`); setup in `__tests__/setup/`
- Types: `types.ts` per TS subsystem (`src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts`, `src/ai/types.ts`); barrels named `index.ts` (`src/ai/index.ts`, `src/commands/index.ts`)

**Directories:**
- Lowercase plural nouns for code groups: `screens/`, `components/`, `context/`, `utils/`, `services/`, `widgets/`, `domains/`
- Lowercase singular nouns for concept subsystems: `behavior/`, `ai/`, `commands/`, `navigation/`, `theme/`
- `__tests__/` (dunder) for suites with `unit/` + `setup/` inside; `rulebook/` + `4.0/` for product specs; `.planning/` for GSD state (never import from it)

## Where to Add New Code

**New Feature:**
- Primary code: Screen in `src/screens/<Domain>Screen.js` + route entry in `src/navigation/AppNavigator.js` + state in matching `src/context/<Domain>Context.js` (or extend existing domain)
- Tests: `__tests__/unit/<domain>.test.js` mirroring the engine/context name

**New Component/Module:**
- Implementation: Reusable UI → `src/components/`; pure business rule → `src/behavior/<concern>Engine.ts` (habits) or `src/utils/<concern>.js` (productivity); AI stage → `src/ai/<stage>.ts` + re-export in `src/ai/index.ts`; command → handler in `src/commands/habitCommandHandlers.ts` + action in `src/commands/types.ts`
- Widget: Render component `widgets/<Name>Widget.tsx` + registration in `app.json` (`expo.plugins → react-native-android-widget → widgets[]`) + render/click branches in `widgets/widget-task-handler.tsx`

**Utilities:**
- Shared helpers: Date → `src/utils/dateUtils.js`; IDs → `src/utils/generateId.js`; logging → `src/utils/logger.js` (never add new ad-hoc loggers); theme tokens → `src/theme/colors.js`, shared styles → `src/theme/styles.js`; new domain types → `src/behavior/types.ts` (behavior) or `src/commands/types.ts` (commands)

## Special Directories

**`android/`:**
- Purpose: Native Android shell from Expo prebuild (manifest, Gradle, widget native glue)
- Generated: Yes (via `expo prebuild` / `expo run:android`)
- Committed: Yes (needed for `react-native-android-widget` + `llama.rn` native config)

**`build/` and `coverage/`:**
- Purpose: Local build artifacts and Jest coverage HTML/LCOV
- Generated: Yes
- Committed: No (gitignored outputs; safe to delete)

**`rulebook/` and `4.0/`:**
- Purpose: Normative product specs engines implement (rule JSON/MD + master plan); engine file headers cite their `Source:` rule here
- Generated: No (hand-authored source of truth)
- Committed: Yes — read before changing any `src/behavior|ai|commands` logic

**`src/domains/`:**
- Purpose: Reserved isolation boundary for Phase 22–28 per-domain modules (currently `README.md` only)
- Generated: No
- Committed: Yes — do not place implementation here until the corresponding phase scaffolds it

**`.planning/`:**
- Purpose: GSD agent state (roadmap, phases, codebase maps); never imported by app code
- Generated: Partially (agent-written)
- Committed: Yes (planning history)

---

*Structure analysis: 2026-10-12*
