# Codebase Structure

**Analysis Date:** 2026-10-18

## Directory Layout

```text
KwestUpMobile/
├── index.js                     # Expo root registration + widget task handler registration
├── App.js                       # Root component: boot init, legacy global state, provider tree
├── app.json                     # Expo config (name, version 3.5.0, plugins, widget declarations)
├── eas.json                     # EAS build profiles (development / preview / production)
├── package.json                 # Scripts, deps, engines (node >=22.13)
├── babel.config.js              # babel-preset-expo, NODE_ENV-keyed cache, prod console strip
├── metro.config.js              # Expo default Metro config
├── jest.config.js               # jest-expo/android preset, coverage ratchet thresholds
├── tsconfig.json                # strict TS, allowJs, checkJs:false, jest+node types
├── eslint.config.js             # Flat ESLint config
├── .eslintrc.js                 # Legacy ESLint config
├── patch-llama-gradle.js        # postinstall native gradle patch for llama.rn
├── stryker.config.json          # Mutation testing config
├── GEMINI.md                    # Workspace agent standards (codebase-map-before-planning)
├── README.md
├── App source:
│   ├── src/                     # Application source (see below)
│   ├── widgets/                 # Android home-screen widget components + headless handler
│   ├── rulebook/                # Behavioral rulebook: human markdown + machine JSON rules
│   ├── assets/                  # Icons, splash, widget previews
│   └── __tests__/               # Jest test suites (setup/ and unit/)
├── Native / build:
│   ├── android/                 # Prebuild native Android project (app/, gradle/)
│   ├── build/                   # APK artifacts (kwestup-v3.0.1.apk)
│   └── reports/                 # Mutation test reports (reports/mutation/)
├── Planning / governance:
│   ├── .planning/               # GSD state: PROJECT.md, ROADMAP.md, REQUIREMENTS.md, STATE.md, phases/
│   ├── 4.0/                     # KwestUp_4.0_Master_Plan.md (target architecture spec)
│   └── .github/workflows/       # ci.yml (lint/typecheck/test), semgrep.yml
└── node_modules/                # Dependencies
```

### `src/` subtree

```text
src/
├── ai/                 # 4.0 on-device AI: intent parsing, behavior compilation, friction, review
│   ├── index.ts        # Barrel export
│   ├── types.ts        # ExtractedIntent, RulePacket, CompilationResult, FrictionAnalysisResult…
│   ├── intentParser.ts
│   ├── heuristicParser.ts
│   ├── behaviorCompiler.ts
│   ├── frictionAnalyzer.ts
│   ├── rulePacketRetriever.ts
│   └── weeklyReviewEngine.ts
├── behavior/           # 4.0 deterministic behavior engines + event bus
│   ├── types.ts        # Habit, Cue, Intervention, BehaviorEvent, BehaviorRule, WidgetTouchpoint…
│   ├── eventBus.ts     # Singleton typed pub/sub + 100-event ring buffer
│   ├── ruleEngine.ts   # Loads rulebook/machine/*.json, evaluates when/then
│   ├── habitEngine.ts
│   ├── recoveryEngine.ts
│   ├── rewardEngine.ts
│   ├── improvementEngine.ts
│   ├── cueEngine.ts
│   └── interventionEngine.ts
├── commands/           # 4.0 safe command gateway
│   ├── index.ts        # Barrel export
│   ├── types.ts        # CommandAction, DispatchedCommand, results
│   ├── commandValidator.ts
│   ├── commandExecutor.ts
│   ├── habitCommandHandlers.ts
│   ├── aiSandbox.ts
│   ├── idempotencyStore.ts
│   └── useCommandGateway.ts
├── components/         # Shared UI components (16)
│   ├── AIAssistant.js
│   ├── TaskEditModal.js, TaskCard.js, WeeklyReviewModal.js, TimerLockoutOverlay.js
│   ├── ErrorBoundary.js, LiquidGlassBackground.js, LiquidGlassCard.js
│   ├── CustomButton.js, CustomTextInput.js, CustomCard.js, CustomBadge.js
│   ├── CustomSwitch.js, CustomSegmentedButtons.js, CustomDateTimePicker.js
│   └── QRScannerModal.js
├── context/            # State providers (5)
│   ├── TaskContext.js
│   ├── VaultContext.js
│   ├── BillingContext.js
│   ├── BirthdayContext.js
│   └── HabitContext.js
├── domains/            # 4.0 domain isolation scaffolding
│   └── README.md       # Planned per-domain modules (habits, identity, events, interventions, ai)
├── navigation/         # Navigation
│   ├── AppNavigator.js
│   └── CustomDrawerContent.js
├── screens/            # Drawer screens (9)
│   ├── DashboardScreen.js
│   ├── DailyTasksScreen.js
│   ├── BirthdaysScreen.js
│   ├── BillingScreen.js
│   ├── TaskListScreen.js
│   ├── NotesScreen.js
│   ├── FocusTimerScreen.js
│   ├── SettingsScreen.js
│   └── SearchScreen.js
├── services/           # 4.0 unified services
│   ├── notificationService.ts
│   └── types.ts        # NotificationDispatchRequest, BehavioralNotificationPolicy…
├── theme/              # Theme system
│   ├── colors.js       # themes[name][mode] palettes
│   └── styles.js       # Shared StyleSheet definitions
└── utils/              # Utilities & persistence (15)
    ├── logger.js, diagnostics.js
    ├── storage.js, vaultService.js, fileStorage.js, vaultImport.js
    ├── billingStorage.js, billingNotifications.js
    ├── notifications.js, exportService.js, syncService.js
    ├── taskMutations.js, dateUtils.js, generateId.js
    └── aiService.js
```

### `widgets/` subtree

```text
widgets/
├── widget-task-handler.tsx    # Headless Android widget entry (separate JS VM)
├── FocusTimerWidget.tsx
├── DailyTasksWidget.tsx
├── ImportantTasksWidget.tsx
├── TasksListWidget.tsx
└── HabitWidget.tsx
```

### `rulebook/` subtree

```text
rulebook/
├── manifest.json              # Index of 44 spec documents + review dates
├── README.md                  # Two-layer rulebook + 3-layer intelligence architecture
├── CHANGELOG.md
├── atomic-habits/             # James Clear principle specs (25 docs)
├── ai/                        # AI interaction policy specs (5 docs)
├── rules/                     # Deterministic business rules (8 docs)
├── examples/                  # Domain workflow examples (7 docs)
└── machine/                   # Machine-executable JSON rules
    ├── rules.json             # System rules
    ├── habitRules.json
    ├── recoveryRules.json
    ├── rewardRules.json
    └── interventionRules.json
```

### `__tests__/` subtree

```text
__tests__/
├── phase12-widget-logic.test.js
├── setup/
│   ├── jest.setup.js
│   └── jest.setup.test.js
└── unit/                      # ~34 suites: engines, contexts, services, utilities
```

## Directory Purposes

**`src/behavior/`:**
- Purpose: Deterministic behavioral policy engines.
- Contains: Pure TypeScript state machines and the event bus.
- Key files: `eventBus.ts`, `ruleEngine.ts`, `habitEngine.ts`, `interventionEngine.ts`, `types.ts`.

**`src/ai/`:**
- Purpose: On-device LLM semantic layer (intent → compiled plan).
- Contains: Parser, compiler, friction analyzer, weekly review engine, rule packet retriever.
- Key files: `intentParser.ts`, `behaviorCompiler.ts`, `frictionAnalyzer.ts`.

**`src/commands/`:**
- Purpose: Safe, validated, idempotent action execution (the only AI write path).
- Contains: Validator, executor, habit handlers, AI sandbox, idempotency store, React hook.
- Key files: `commandExecutor.ts`, `aiSandbox.ts`, `useCommandGateway.ts`.

**`src/context/`:**
- Purpose: Per-domain React state + mutations.
- Contains: 5 providers, each exported as `useX()` hook.
- Key files: `TaskContext.js`, `HabitContext.js`.

**`src/screens/`:**
- Purpose: One file per drawer route.
- Contains: Screen UI + local state orchestration.
- Key files: `NotesScreen.js`, `DashboardScreen.js`.

**`src/components/`:**
- Purpose: Reusable UI primitives and modals.
- Contains: Custom styled inputs/buttons/cards, modals, glass background, error boundary.

**`src/utils/`:**
- Purpose: Framework/IO utilities and persistence.
- Contains: Storage services, filesystem, date engine, export/import, sync, logger, AI service.

**`src/services/`:**
- Purpose: 4.0 unified cross-cutting services.
- Contains: `notificationService.ts` (the authoritative notification dispatch path) + `types.ts`.

**`src/domains/`:**
- Purpose: Placeholder for fully-isolated domain modules (Phase 22-28).
- Contains: Only `README.md` — documents the planned layout and isolation rules.

**`widgets/`:**
- Purpose: Android home-screen widgets and their headless handler.
- Contains: 5 widget components + 1 task handler.

**`rulebook/`:**
- Purpose: Immutable behavioral specification (philosophy + machine rules).
- Contains: Markdown specs and machine JSON imported by `ruleEngine.ts`.

## Key File Locations

**Entry Points:**
- `index.js`: Expo root + widget handler registration.
- `App.js`: Root component with boot init and provider tree.
- `widgets/widget-task-handler.tsx`: Headless widget JS entry.

**Configuration:**
- `app.json`: Expo config, widget declarations, plugins.
- `eas.json`: Build profiles.
- `tsconfig.json`: TypeScript strictness and include paths.
- `jest.config.js`: Test preset + coverage gates.
- `babel.config.js`: Babel presets/plugins.
- `.github/workflows/ci.yml`: Lint + typecheck + test pipeline (Node 22).

**Core Logic:**
- `App.js`: Legacy global state + persistence orchestration.
- `src/context/TaskContext.js`: Authoritative task mutation path.
- `src/context/HabitContext.js`: Authoritative habit domain + isolated storage.
- `src/utils/taskMutations.js`: Pure task engine shared with widgets.
- `src/behavior/ruleEngine.ts`: Machine rule evaluator.
- `src/behavior/interventionEngine.ts`: Surface arbitration.
- `src/services/notificationService.ts`: Notification policy + scheduling.
- `src/utils/storage.js`: Storage versioning + migration + cache clear.
- `src/commands/commandExecutor.ts`: Command dispatch + idempotency.

**Testing:**
- `__tests__/unit/`: Engine/context/service suites.
- `__tests__/setup/jest.setup.js`: Native module mocks.
- `jest.config.js`: `jest-expo/android` preset, `testMatch: **/__tests__/**/*.test.[jt]s?(x)`.

## Naming Conventions

**Files:**
- React components / contexts / screens / widgets: `PascalCase.{js,tsx}` — e.g. `TaskContext.js`, `HabitWidget.tsx`, `DashboardScreen.js`.
- Engines / utilities / services: `camelCase.{js,ts}` — e.g. `taskMutations.js`, `eventBus.ts`, `notificationService.ts`.
- Type-only modules: `types.ts` inside each subsystem (`src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts`, `src/ai/types.ts`).
- Barrel files: `index.{ts}` only in `src/ai/index.ts` and `src/commands/index.ts`.
- Tests: `<subject>.test.{js,ts,tsx}` under `__tests__/unit/`.

**Directories:**
- Lowercase, plural domain nouns: `behavior/`, `commands/`, `screens/`, `components/`, `utils/`, `context/` (singular `context` is the one exception — historical).

**Exports:**
- `src/behavior/*.ts` and `src/ai/*.ts` mostly export named functions plus a default object of the same functions.
- Contexts export a named `Provider`, a `useX` hook, and `default` (the context object).
- Engines export pure functions only (no classes) except `EventBus` in `eventBus.ts`.

**Storage Keys:**
- Prefix `kwestup_`, suffix storage version — e.g. `kwestup_data_v7.0`, `kwestup_timer_state_v7.0`.
- Habit domain uses fixed versioned keys: `kwestup_habits_v1`, `kwestup_behavior_events_v1`, `kwestup_identities_v1`, `kwestup_rewards_v1`, `kwestup_notification_history_v1`, `kwestup_idempotency_v1`.
- New persistent prefixes MUST be registered in `isUserDataKey` (`src/utils/storage.js:8-28`).

**Event Types:**
- `SCREAMING_SNAKE_CASE` — e.g. `TASK_COMPLETED`, `HABIT_MISSED`, `RECOVERY_STARTED`, `WIDGET_ACTION` (`src/behavior/types.ts:130-163`).

**Rule IDs:**
- `SCREAMING_SNAKE` suffixed with `_NNN` — e.g. `HABIT_CONCURRENT_CAP_001`, `MINIMUM_ACTION_001`, `QUIET_HOURS_001`, `WIDGET_PRIORITY_001` (`rulebook/machine/*.json`).

## Where to Add New Code

**New Feature (screen-visible):**
- Screen: `src/screens/<Name>Screen.js` (or `.tsx` for new typed screens).
- Route registration: `src/navigation/AppNavigator.js` (add `Drawer.Screen`) and drawer item in `src/navigation/CustomDrawerContent.js:12-22`.
- Tests: `__tests__/unit/<name>.test.{js,ts}`.

**New Domain:**
- Create a provider at `src/context/<Domain>Context.js` (or `.tsx`) following `HabitContext.js`: named `Provider`, `useX` hook that **throws** when unmounted, isolated versioned storage keys, debounced write-through, AppState re-hydration.
- Register its storage prefix in `src/utils/storage.js:isUserDataKey`.
- For 4.0 isolation, place engine-free domain logic under `src/domains/<domain>/` (see `src/domains/README.md`).
- Wire cross-domain effects through `eventBus` — never import another domain's internals.

**New Deterministic Rule / Engine:**
- Add machine rules to `rulebook/machine/{habit,recovery,reward,intervention,rules}.json` with a unique `_NNN` ID.
- Add/extend evaluation in `src/behavior/<engine>.ts`; export named pure functions.
- Types go in `src/behavior/types.ts`.
- Tests: `__tests__/unit/<engine>.test.ts`.

**New Command Action:**
- Add the action + payload type to `src/commands/types.ts` (`CommandAction` union, `CommandPayload` map).
- Register it in `SUPPORTED_COMMAND_ACTIONS` (`src/commands/commandValidator.ts:19`), add a handler in `src/commands/habitCommandHandlers.ts` (or a new handler module), and expose via `useCommandGateway`.

**New AI Capability:**
- Add parser/compiler logic under `src/ai/*.ts`, export from `src/ai/index.ts`.
- Never let AI write storage directly — route through `src/commands/aiSandbox.ts`.

**New Notification:**
- Use `scheduleNotification()` from `src/services/notificationService.ts` with a `NotificationDispatchRequest`; do not call `expo-notifications` directly except inside the service.

**New Utility:**
- Shared helpers: `src/utils/<name>.js` (prefer `.ts` for new code).

**New Widget:**
- Component: `widgets/<Name>Widget.tsx`; register in `app.json` `android` plugin `widgets[]` and in `nameToWidget` (`widgets/widget-task-handler.tsx:38-44`), then handle its action branches in the handler.

## Special Directories

**`android/`:**
- Purpose: Prebuild native Android project (generated via Expo prebuild).
- Generated: Yes.
- Committed: Yes (`android/app/`, `android/gradle/`, wrappers tracked).

**`.planning/`:**
- Purpose: GSD workflow state — codebase maps, phases, project/roadmap/requirements.
- Generated: No (authored).
- Committed: Yes.

**`4.0/`:**
- Purpose: Target architecture specification (`KwestUp_4.0_Master_Plan.md`).
- Generated: No.
- Committed: Yes.

**`build/` and `reports/`:**
- Purpose: APK artifacts and mutation test reports.
- Generated: Yes.
- Committed: Present in working tree (should be build outputs).

**`.freebuff/` and `coverage/`:**
- Purpose: Tool caches / coverage output.
- Generated: Yes.
- Committed: No (ignored/generated).

---

*Structure analysis: 2026-10-18*
