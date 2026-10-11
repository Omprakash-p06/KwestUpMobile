# Codebase Structure

**Analysis Date:** 2026-10-11

## Directory Layout

```
KwestUpMobile/
├── index.js                # Expo root entry (app + widget handler registration)
├── App.js                  # Root component: boot, global state, providers, timer, widgets
├── app.json                # Expo config: package id, plugins, 4 widget declarations
├── eas.json                # EAS build profiles
├── package.json            # Deps + scripts (start, android/ios, lint, typecheck, test)
├── tsconfig.json           # TypeScript config (behavior/services/commands/widgets)
├── babel.config.js         # Babel (incl. release console stripping)
├── metro.config.js         # Metro bundler config
├── jest.config.js          # Jest config (jest-expo preset)
├── eslint.config.js        # Flat config (+ legacy .eslintrc.js)
├── patch-llama-gradle.js   # Postinstall native patch for llama.rn (run via postinstall)
├── src/
│   ├── behavior/           # Pure 4.0 behavior engines + event bus + domain types (TS)
│   ├── commands/           # AI command-sandbox action/payload contracts (TS)
│   ├── components/         # Reusable UI: controls, cards, modals, AI surface, boundary
│   ├── context/            # Domain state owners: Task, Vault, Billing, Birthday, Habit
│   ├── domains/            # Planned 4.0 domain isolation dir (README placeholder only)
│   ├── navigation/         # Drawer navigator + custom drawer content
│   ├── screens/            # 9 feature screens (one per drawer route)
│   ├── services/           # Unified notification service + policy types (TS)
│   ├── theme/              # Palette matrix (5 names × 3 modes) + global styles
│   └── utils/              # Persistence, AI, sync, dates, logging, import/export (JS)
├── widgets/                # Android widget renders + headless task handler (TSX)
├── android/                # Native Android project (prebuild output, gradle)
├── assets/                 # App icon, splash, fonts-adjacent art, widget previews
├── rulebook/               # 4.0 behavioural spec: atomic-habits/, machine/*.json, rules/, ai/
├── 4.0/                    # KwestUp_4.0_Master_Plan.md (source of behavior/command design)
├── __tests__/             # Jest suites: unit/ (17 files) + setup/
├── .planning/              # GSD planning docs (including this codebase map)
├── coverage/               # Jest coverage output (generated, not committed logic)
├── build/                  # Local build output (generated)
└── GEMINI.md               # Repo agent instructions
```

## Directory Purposes

**`src/behavior/`:**
- Purpose: Deterministic, React-free 4.0 behavior domain — habit lifecycle, cues, recovery, rewards, improvement scoring, machine-rule evaluation, and the domain event bus.
- Contains: TypeScript modules only (`*.ts`).
- Key files: `src/behavior/eventBus.ts` (singleton bus + `useDomainEvent`), `src/behavior/types.ts` (Identity/Habit/Cue/Intervention/BehaviorEvent/Rule types), `src/behavior/habitEngine.ts`, `src/behavior/ruleEngine.ts`, `src/behavior/cueEngine.ts`, `src/behavior/recoveryEngine.ts`, `src/behavior/rewardEngine.ts`, `src/behavior/improvementEngine.ts`

**`src/commands/`:**
- Purpose: AI command-sandbox contract — the only actions the assistant may execute, with discriminated payloads and idempotency.
- Contains: `src/commands/types.ts` (11 `CommandAction`s: `CREATE_HABIT`, `UPDATE_HABIT`, `DELETE_HABIT`, `LOG_HABIT`, `START_RECOVERY`, `DISMISS_INTERVENTION`, `ADJUST_DIFFICULTY`, `CREATE_IDENTITY`, `PAUSE_HABIT`, `ARCHIVE_HABIT`, `RESUME_HABIT`).

**`src/components/`:**
- Purpose: Shared presentational components consumed by screens, navigator, and `App.js` overlays.
- Contains: Plain JS React components (`PascalCase.js`), one per file.
- Key files: `src/components/AIAssistant.js` (floating AI surface), `src/components/TaskEditModal.js` (global editor, mounted in `AppNavigator`), `src/components/ErrorBoundary.js`, `src/components/TaskCard.js`, `src/components/CustomButton.js`, `src/components/CustomTextInput.js`, `src/components/CustomDateTimePicker.js`, `src/components/TimerLockoutOverlay.js`, `src/components/LiquidGlassBackground.js`, `src/components/LiquidGlassCard.js`, `src/components/QRScannerModal.js`, `src/components/CustomBadge.js`, `src/components/CustomCard.js`, `src/components/CustomSegmentedButtons.js`, `src/components/CustomSwitch.js`

**`src/context/`:**
- Purpose: One exclusive state-owner provider per domain (state + hydration + persistence + side effects + hook).
- Contains: `*Context.js` providers, one per domain.
- Key files: `src/context/TaskContext.js` (sole task writer), `src/context/VaultContext.js` (vault + notes), `src/context/HabitContext.js` (habits/identities/events/rewards, own `*_v1` keys), `src/context/BillingContext.js`, `src/context/BirthdayContext.js`

**`src/domains/`:**
- Purpose: Reserved isolation boundary for future per-domain modules (Phase 22–28: `habits/`, `identity/`, `events/`, `interventions/`, `ai/`).
- Contains: Currently `src/domains/README.md` only — no code yet. Do not place new engine code in `src/behavior/` when it belongs to a listed domain; create the subdomain directory.

**`src/navigation/`:**
- Purpose: Drawer routing + context/prop resolution + global modal/AI mounting.
- Contains: `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`

**`src/screens/`:**
- Purpose: One full-screen feature surface per drawer route; screens never import each other.
- Contains: `*Screen.js` (9 files).
- Key files: `src/screens/DashboardScreen.js`, `src/screens/DailyTasksScreen.js`, `src/screens/BirthdaysScreen.js`, `src/screens/TaskListScreen.js`, `src/screens/FocusTimerScreen.js`, `src/screens/NotesScreen.js` (vault explorer + editor, largest screen), `src/screens/BillingScreen.js`, `src/screens/SearchScreen.js`, `src/screens/SettingsScreen.js` (sync, reset, telemetry, diagnostics)

**`src/services/`:**
- Purpose: Unified notification + behavioral dispatch engine with policy types.
- Contains: TypeScript only.
- Key files: `src/services/notificationService.ts` (channels, scheduling, policy gate, history), `src/services/types.ts` (`NotificationDispatchRequest`, `BehavioralNotificationPolicy`, `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY`)

**`src/theme/`:**
- Purpose: Single theme object + global stylesheet consumed as the `currentTheme` prop.
- Contains: `src/theme/colors.js` (`themes[name][mode]`, 5 names × `light`/`dark`/`amoled`), `src/theme/styles.js`

**`src/utils/`:**
- Purpose: Persistence, device integrations, and shared helpers (all plain JS).
- Contains: `camelCase.js` utility modules.
- Key files: `src/utils/storage.js` (`APP_VERSION`, `STORAGE_VERSION=v7.0`, cache clear, legacy migration), `src/utils/vaultService.js` (vault CRUD + paths), `src/utils/fileStorage.js` (markdown FS ops + hashtag extraction), `src/utils/taskMutations.js` (pure task engine shared with widgets), `src/utils/aiService.js` (`llama.rn` lifecycle + heuristic fallbacks), `src/utils/syncService.js` (LAN sync), `src/utils/billingStorage.js`, `src/utils/billingNotifications.js`, `src/utils/notifications.js` (legacy helpers), `src/utils/dateUtils.js` (local wall-clock dates — always use these), `src/utils/logger.js` (central logger), `src/utils/diagnostics.js`, `src/utils/exportService.js`, `src/utils/vaultImport.js`

**`widgets/`:**
- Purpose: Android home-screen widgets + headless tap handler (runs with the app killed).
- Contains: `PascalCaseWidget.tsx` renders + handler.
- Key files: `widgets/widget-task-handler.tsx`, `widgets/FocusTimerWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/TasksListWidget.tsx`

**`rulebook/`:**
- Purpose: Human/machine-readable 4.0 behaviour specification that the engines implement.
- Contains: `rulebook/atomic-habits/*.md` (22 habit-loop concept docs), `rulebook/machine/*.json` (`habitRules.json`, `recoveryRules.json`, `rewardRules.json`, `rules.json`, `interventionRules.json`), `rulebook/rules/`, `rulebook/ai/`, `rulebook/manifest.json`, `rulebook/README.md`, `rulebook/CHANGELOG.md`

**`__tests__/`:**
- Purpose: Jest suites mirroring `src` layers.
- Contains: `__tests__/unit/*.test.{js,ts}` (17 files: `aiService`, `aiAssistant-smoke`, `behaviorRuleEngine`, `dateUtils`, `domainEventInstrumentation`, `errorBoundary`, `eventBus`, `exportImportService`, `habitContext`, `logger`, `notificationService`, `storageMigration`, `syncService`, `taskContext`, `taskMutations`, `vaultAndFileStorage`), `__tests__/setup/jest.setup.js`, `__tests__/phase12-widget-logic.test.js`

## Key File Locations

**Entry Points:**
- `index.js`: Expo registration (`registerRootComponent(App)` + `registerWidgetTaskHandler`).
- `App.js`: Root component (~1088 lines) — boot, providers, timer, widgets, dialogs.
- `widgets/widget-task-handler.tsx`: Headless widget entry (native host callbacks).
- `android/app/build.gradle` + `app.json`: Native package/widget/plugin wiring.

**Configuration:**
- `package.json`: Deps (Expo ~57, React 19, RN 0.86, `llama.rn` 0.12.4, drawer/gesture/paper/reanimated, AsyncStorage), scripts (`start`, `android`, `ios`, `lint`, `typecheck`, `test`, `postinstall`).
- `app.json`: App id/slug/version, `llama.rn` + camera + build-properties + `react-native-android-widget` plugins, 4 widget specs, EAS project id.
- `eas.json`: EAS build profiles.
- `tsconfig.json`: TS for `src/behavior`, `src/commands`, `src/services`, `widgets`.
- `babel.config.js`, `metro.config.js`: Bundler config.
- `jest.config.js` (+ `__tests__/setup/jest.setup.js`): `jest-expo` preset, test match, setup.
- `eslint.config.js` (+ legacy `.eslintrc.js`): Lint rules.
- `patch-llama-gradle.js`: Postinstall native patch (do not delete; `postinstall` runs it).
- `.npmrc`: Registry auth scoping (existence only — never read contents).

**Core Logic:**
- Task writes: `src/context/TaskContext.js` → `src/utils/taskMutations.js`
- Habit intelligence: `src/behavior/*.ts` + `src/context/HabitContext.js` + `rulebook/machine/*.json`
- AI: `src/utils/aiService.js` + `src/components/AIAssistant.js`
- Notifications: `src/services/notificationService.ts` + `src/services/types.ts`
- Notes at rest: `src/utils/fileStorage.js` + `src/utils/vaultService.js`
- Sync: `src/utils/syncService.js` (called from `App.js:740`)

**Testing:**
- `jest.config.js`: Runner config.
- `__tests__/unit/`: Per-module suites.
- `__tests__/phase12-widget-logic.test.js`: Widget mutation logic suite.
- `coverage/`: Generated coverage output.

## Naming Conventions

**Files:**
- Screens: `PascalCase` + `Screen` suffix — e.g. `src/screens/DailyTasksScreen.js`, `src/screens/TaskListScreen.js`
- Shared UI: `PascalCase.js` matching the exported component — e.g. `src/components/TaskEditModal.js`, `src/components/LiquidGlassCard.js`
- Contexts: `PascalCase` domain + `Context` suffix — e.g. `src/context/TaskContext.js`, `src/context/HabitContext.js`
- Behavior/services/commands: `camelCase.ts` (+ `types.ts` per boundary) — e.g. `src/behavior/habitEngine.ts`, `src/behavior/eventBus.ts`, `src/services/notificationService.ts`, `src/commands/types.ts`
- Utils: `camelCase.js` verb/noun helpers — e.g. `src/utils/taskMutations.js`, `src/utils/fileStorage.js`, `src/utils/dateUtils.js`
- Widgets: `PascalCase` + `Widget` suffix (`.tsx`), handler as `widget-task-handler.tsx` — e.g. `widgets/TasksListWidget.tsx`
- Tests: `<module>.test.{js,ts}` mirroring source names — e.g. `__tests__/unit/taskMutations.test.js`, `__tests__/unit/eventBus.test.ts`
- Rulebook machine rules: `camelRules.json` — e.g. `rulebook/machine/habitRules.json`
- Storage keys: `kwestup_<domain>_<STORAGE_VERSION>` — e.g. `` `kwestup_data_v7.0` ``, `kwestup_habits_v1` (see `src/utils/storage.js`, `src/context/HabitContext.js`)

**Directories:**
- Lowercase singular/plural nouns: `src/behavior`, `src/commands`, `src/components`, `src/context`, `src/domains`, `src/navigation`, `src/screens`, `src/services`, `src/theme`, `src/utils`, `widgets`, `rulebook`, `assets`, `__tests__`.
- Vault content on device: `Notes/Vaults/<vaultId>/` with `<Folder>/<Title>.md` files (sanitised, see `src/utils/fileStorage.js:33`).

## Where to Add New Code

**New Feature:**
- Primary code: New screen in `src/screens/<Name>Screen.js` + route entry in `src/navigation/AppNavigator.js` (copy an existing `Drawer.Screen` block, `src/navigation/AppNavigator.js:221`).
- State: New or extended provider in `src/context/` (one owner per domain — never split a domain across two providers).
- Tests: `__tests__/unit/<name>.test.js`

**New Component/Module:**
- Implementation: `src/components/<PascalCase>.js` for UI (export the named component, import by name as in `App.js:32`); pure logic goes in `src/utils/<camelCase>.js` (JS) or `src/behavior/<camelEngine>.ts` (4.0 deterministic logic).
- 4.0 domain module: Create `src/domains/<domain>/` per `src/domains/README.md` (isolated state/mutations/service calls; cross-domain via `eventBus` event types in `src/behavior/types.ts` — never direct imports).
- AI command: Extend `CommandAction` + `CommandPayload` in `src/commands/types.ts`, implement handling in `src/utils/aiService.js` / `src/components/AIAssistant.js`, bridge creation through `AppNavigator`'s `on*Created` callbacks.

**Utilities:**
- Shared helpers: `src/utils/` — dates via `src/utils/dateUtils.js` (never raw `new Date` formatting), logging via `src/utils/logger.js` (never `console`), storage keys versioned per `src/utils/storage.js`.
- Notification scheduling: Add functions in `src/services/notificationService.ts` using the `NotificationDispatchRequest` contract in `src/services/types.ts`; respect the behavioral policy gate.
- Widget surface: New `widgets/<Name>Widget.tsx` + `nameToWidget` entry + render branch in `widgets/widget-task-handler.tsx` + declaration in the `react-native-android-widget` plugin block in `app.json`; reuse `src/utils/taskMutations.js` — never import contexts or screens (separate JS env, storage-only coupling).

## Special Directories

**`android/`:**
- Purpose: Expo prebuild native output (gradle project, manifests, widget host wiring).
- Generated: Yes (via `expo prebuild` / `expo run:android`).
- Committed: Yes (includes `android/` + `android/app` + gradle wrapper).

**`assets/` (+ `assets/widget-preview/`):**
- Purpose: App icon, splash, favicon, widget preview images referenced by `app.json`.
- Generated: No.
- Committed: Yes.

**`rulebook/` + `4.0/`:**
- Purpose: Normative 4.0 behaviour spec (`4.0/KwestUp_4.0_Master_Plan.md` is the design source cited at the top of every `src/behavior/*.ts` file); engines must cite the section they implement.
- Generated: No.
- Committed: Yes.

**`__tests__/`:**
- Purpose: Jest suites + setup; run with `npm test` (`jest`), watch with `npm run test:watch`, coverage with `npm run test:coverage`.
- Generated: No (only `coverage/` output is generated).
- Committed: Yes (suites); `coverage/` is generated output.

**`coverage/`, `build/`:**
- Purpose: Generated Jest coverage report and local build artifacts.
- Generated: Yes.
- Committed: No (build outputs; do not place source here).

**`.planning/`:**
- Purpose: GSD planning state, roadmaps, phase artefacts, and this codebase map (`.planning/codebase/`).
- Generated: No (working docs).
- Committed: Yes (planning history).

---

*Structure analysis: 2026-10-11*
