# Codebase Structure

**Analysis Date:** 2026-10-11

## Directory Layout

```
KwestUpMobile/
├── App.js                  # Composition root: boot, providers, theme, timer, sync (1085 lines)
├── index.js                # Expo entry: registerRootComponent(App) + widget task handler
├── app.json                # Expo config: slug, version 3.5.0, plugins, 4 Android widgets
├── eas.json                # EAS build profiles
├── package.json            # Expo ~57, React 19, RN 0.86, llama.rn, paper, navigation
├── tsconfig.json           # Strict TS; checkJs false; widgets/App.js excluded (see notes)
├── babel.config.js         # Babel + console-strip in production
├── metro.config.js         # Metro bundler config
├── jest.config.js          # jest-expo preset
├── eslint.config.js / .eslintrc.js  # Lint configs (flat + legacy)
├── src/
│   ├── screens/            # 9 route screens (largest: NotesScreen ~2013 lines)
│   ├── components/         # 14 reusable UI pieces + ErrorBoundary + AIAssistant
│   ├── context/            # 4 domain providers (Task, Vault, Billing, Birthday)
│   ├── navigation/         # Drawer navigator + custom drawer content
│   ├── utils/              # 14 modules: pure engines + Expo side-effect services
│   ├── services/           # Typed notification dispatch engine (TS)
│   ├── behavior/           # 4.0 event bus + domain types (TS)
│   ├── commands/           # 4.0 command registry + sandbox types (TS)
│   ├── domains/            # Reserved per-domain boundary placeholder (README only)
│   └── theme/              # colors.js (5×3 themes) + styles.js
├── widgets/                # 4 Android widgets + headless task handler (TSX)
├── __tests__/             # setup + unit (14 files) + widget-logic test
├── android/                # Native Android shell (Expo prebuild output)
├── assets/                 # Icons, splash, widget previews
├── rulebook/               # 4.0 behavioral spec: ai/, atomic-habits/, rules/, machine/, examples/
├── 4.0/                    # KwestUp_4.0_Master_Plan.md
├── build/                  # Local build artifacts (not source)
├── coverage/               # Jest coverage output (generated)
├── .planning/              # GSD planning state + these codebase docs
├── .github/                # CI workflows
└── patch-llama-gradle.js   # postinstall native patch for llama.rn
```

## Directory Purposes

**`src/screens/`:**
- Purpose: One module per drawer route; thin render + interaction layer.
- Contains: `DashboardScreen.js`, `DailyTasksScreen.js`, `BirthdaysScreen.js`, `BillingScreen.js`, `TaskListScreen.js`, `NotesScreen.js`, `FocusTimerScreen.js`, `SettingsScreen.js`, `SearchScreen.js` — all `.js`, all PascalCase + `Screen` suffix.
- Key files: `NotesScreen.js` (~2013 lines, vault browser + editor + AI hooks), `SettingsScreen.js` (~1101 lines, sync QR + telemetry + reset), `BillingScreen.js` (~858 lines).

**`src/components/`:**
- Purpose: Reusable UI shared across screens plus app-wide overlays.
- Contains: `AIAssistant.js` (~1096 lines, floating AI entry), `TaskEditModal.js`, `TaskCard.js`, `QRScannerModal.js`, `CustomButton/TextInput/Switch/SegmentedButtons/DateTimePicker/Badge/Card`, `LiquidGlassBackground.js`, `LiquidGlassCard.js`, `TimerLockoutOverlay.js`, `ErrorBoundary.js`.
- Key files: `ErrorBoundary.js` (class component, whole-tree crash fallback), `AIAssistant.js` (mounted globally by `AppNavigator`, hidden on `Settings` route and while a note is open).

**`src/context/`:**
- Purpose: Domain state ownership — each file is one bounded context and its sole persistence writer.
- Contains: `TaskContext.js` (tasks/taskLists/dailyTasks + modal state), `VaultContext.js` (vaults/activeVault/notes/activeNote), `BillingContext.js` (transactions/budgets/recurringBills), `BirthdayContext.js` (birthdays + reminder scheduling).
- Key files: `TaskContext.js` (424 lines — the reference implementation: write-through persistence + event emission).

**`src/navigation/`:**
- Purpose: Routing + context-to-prop bridging + global overlays.
- Contains: `AppNavigator.js` (drawer route table, 9 screens, `TaskEditModal` + `AIAssistant` mounts), `CustomDrawerContent.js` (drawer items, theme cycler light→dark→amoled).
- Key files: `AppNavigator.js` — the only importer of all nine screens.

**`src/utils/`:**
- Purpose: Business logic and Expo side-effect services (14 modules, all `.js`).
- Contains: `taskMutations.js` (pure, headless-safe), `dateUtils.js` (local wall-clock helpers — authoritative for all trigger dates), `storage.js` (`APP_VERSION`, `STORAGE_VERSION`, migration), `fileStorage.js` + `vaultService.js` + `vaultImport.js` (notes persistence), `billingStorage.js` + `billingNotifications.js`, `syncService.js` (LAN sync), `exportService.js` (encrypted backup/restore + sharing), `aiService.js` (~1064 lines, llama.rn lifecycle), `notifications.js` (legacy helpers), `diagnostics.js` (telemetry-gated), `logger.js` (env-aware + ring buffer).
- Key files: `taskMutations.js`, `storage.js`, `aiService.js`, `syncService.js`, `logger.js`.

**`src/services/`:**
- Purpose: Strictly-typed service layer (all `.ts`).
- Contains: `notificationService.ts` (~767 lines: channels, scheduling, behavioral policy gate, history), `types.ts` (channels, dispatch requests, policy, history entries, `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY`).
- Key files: `notificationService.ts` — the only notification path new code should use.

**`src/behavior/` + `src/commands/`:**
- Purpose: KwestUp 4.0 contracts — event-sourced behavior domain and AI command sandbox (all `.ts`).
- Contains: `behavior/eventBus.ts` (bus + `useDomainEvent` + `generateEventId`), `behavior/types.ts` (Habit, Cue, Intervention, BehaviorEvent, rewards, rules), `commands/types.ts` (12 `CommandAction`s, conditional `CommandPayload`, idempotent `DispatchedCommand`).
- Key files: All three are load-bearing type contracts for Phases 22–28 — read before adding habit/AI code.

**`src/domains/`:**
- Purpose: Reserved per-domain isolation boundary for Phases 22–28 — currently placeholder only.
- Contains: `README.md` (planned `habits/`, `identity/`, `events/`, `interventions/`, `ai/` subdomains + isolation rules).
- Key files: `README.md` — follow its rules (events not direct imports; types live in `src/behavior/types.ts` / `src/commands/types.ts`) when creating the first domain.

**`src/theme/`:**
- Purpose: Centralized visual system.
- Contains: `colors.js` (`dribbbleColors` base + `themes` map: clean/blue/green/purple/dribbble × light/dark/amoled), `styles.js` (~895 lines shared `StyleSheet` factory).
- Key files: `colors.js` — every screen consumes `currentTheme` derived from it.

**`widgets/`:**
- Purpose: Android home-screen widget surface + headless runtime (all `.tsx`).
- Contains: `FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx`, `widget-task-handler.tsx`.
- Key files: `widget-task-handler.tsx` — headless entry; keep its imports to `taskMutations`, `storage`, `dateUtils`, `logger`, `eventBus` only.

## Key File Locations

**Entry Points:**
- `index.js`: Expo + widget-handler registration (11 lines — do not add logic here).
- `App.js`: Composition root and boot sequence (owns all providers, theme, timer, sync orchestration).
- `widgets/widget-task-handler.tsx`: Headless Android entry (separate JS env).
- `src/navigation/AppNavigator.js`: Route table and overlay mounts.

**Configuration:**
- `app.json`: Expo slug/version/plugins/widget declarations (4 widgets: FocusTimer, DailyTasks, ImportantTasks, TasksList).
- `eas.json`: EAS build profiles.
- `package.json`: Dependencies + scripts (`start`, `android`, `ios`, `lint`, `typecheck`, `test`, `test:coverage`).
- `tsconfig.json`: `extends expo/tsconfig.base`, `strict: true`, `checkJs: false`; includes `src/**` + `__tests__/**`; excludes `widgets/**`. Inline comments explain each exclusion — read them before changing scope.
- `babel.config.js` / `metro.config.js` / `jest.config.js` / `eslint.config.js` / `.eslintrc.js`: Build, bundle, test, lint wiring.
- `patch-llama-gradle.js`: `postinstall` native patch for `llama.rn` (run automatically; edit only when upgrading llama.rn).

**Core Logic:**
- `src/context/TaskContext.js`: Reference context implementation.
- `src/utils/taskMutations.js`: Pure task engine (shared app ↔ widget).
- `src/behavior/eventBus.ts`: Domain event backbone.
- `src/services/notificationService.ts`: Notification dispatch + policy.
- `src/utils/aiService.js`: On-device model lifecycle.

**Testing:**
- `__tests__/setup/jest.setup.js`: Global test setup.
- `__tests__/unit/`: 14 co-patterned unit tests (`eventBus.test.ts`, `notificationService.test.ts`, `aiService.test.js`, `taskMutations.test.js`, `taskContext.test.js`, `storageMigration.test.js`, `vaultAndFileStorage.test.js`, `syncService.test.js`, `exportImportService.test.js`, `domainEventInstrumentation.test.js`, `dateUtils.test.js`, `logger.test.js`, `errorBoundary.test.js`, `aiAssistant-smoke.test.js`).
- `__tests__/phase12-widget-logic.test.js`: Widget pure-logic coverage.
- `jest.config.js`: `jest-expo` preset, setup file, coverage settings.

## Naming Conventions

**Files:**
- Screens: PascalCase + `Screen` suffix — `src/screens/DashboardScreen.js`.
- Components: PascalCase matching export — `src/components/TaskCard.js` exports `TaskCard`.
- Contexts: `<Domain>Context.js` exporting `<Domain>Provider` + `use<Domain>s` hook — `src/context/TaskContext.js` → `TaskProvider` / `useTasks`.
- Services/utils: camelCase domain modules — `src/utils/billingStorage.js`, `src/services/notificationService.ts`.
- Behavior/commands: lowercase domain files — `src/behavior/eventBus.ts`, `src/behavior/types.ts`, `src/commands/types.ts`.
- Widgets: PascalCase + `Widget` suffix + headless handler — `widgets/FocusTimerWidget.tsx`, `widgets/widget-task-handler.tsx` (kebab-case handler).
- Tests: mirror source name + `.test.` — `__tests__/unit/taskMutations.test.js` ↔ `src/utils/taskMutations.js` (new TS tests use `.test.ts`).

**Directories:**
- Lowercase plural for code collections: `screens/`, `components/`, `utils/`, `services/`, `domains/`, `widgets/`, `assets/`.
- Singular for single-concern modules: `context/` (wait — actually `context/` is singular), `behavior/`, `navigation/`, `theme/`. Follow the existing name when adding inside; never rename these directories.

## Where to Add New Code

**New Feature (end-to-end screen):**
- Screen: `src/screens/<Name>Screen.js` (receive state via props from `AppNavigator`, never import contexts' internals directly).
- Route: register in `src/navigation/AppNavigator.js` drawer + add drawer item in `src/navigation/CustomDrawerContent.js`.
- State: extend the owning context in `src/context/` (or create one); emit a `BehaviorEvent` via `src/behavior/eventBus.ts`.
- Tests: `__tests__/unit/<name>.test.js`.

**New Component/Module:**
- Reusable UI: `src/components/<Name>.js` with a named export (`export const <Name>`).
- Pure logic: `src/utils/<domain><Thing>.js` as framework-free named-export functions (so widgets/tests can reuse without React).
- Typed service: `src/services/<name>.ts` with request/result interfaces in `src/services/types.ts`.

**New 4.0 Domain (habits/identity/events/interventions/ai):**
- Implementation: `src/domains/<name>/` per `src/domains/README.md` isolation rules.
- Types first: extend `src/behavior/types.ts` (events/entities) and `src/commands/types.ts` (actions/payloads) — never define domain types inside the domain folder.
- Cross-domain: go through `eventBus` (`src/behavior/eventBus.ts`), never direct imports from another domain.
- Policy-affecting notifications: route through `src/services/notificationService.ts` dispatch (one-shot `behavior` category is policy-gated; recurring is exempt but still channel-routed).

**Utilities:**
- Shared helpers: `src/utils/` — date handling must use `src/utils/dateUtils.js` (local wall-clock; never UTC-shift trigger dates).
- Logging: `src/utils/logger.js` — never `console.*` directly.
- Theming: extend `src/theme/colors.js` `themes` map; consume via `currentTheme` prop (no hardcoded colors in screens/components).

## Special Directories

**`android/`:**
- Purpose: Expo prebuild native shell (gradle, manifests).
- Generated: Yes (via `expo prebuild` / `expo run:android`).
- Committed: Yes (needed for dev-client + widget native modules). Edit native files only when Expo config plugins cannot express the change.

**`assets/` + `assets/widget-preview/`:**
- Purpose: App icon, splash, favicon, adaptive icon, widget preview images referenced by `app.json`.
- Generated: No.
- Committed: Yes. Keep filenames stable — `app.json` references them by relative path.

**`rulebook/` + `4.0/`:**
- Purpose: Behavioral specification source of truth — `4.0/KwestUp_4.0_Master_Plan.md`, `rulebook/rules/` (habit lifecycle, reminders, privacy, widgets…), `rulebook/ai/` (compiler, intent-parser, intervention-planner…), `rulebook/atomic-habits/`, `rulebook/machine/*.json` (deterministic rule tables), `rulebook/examples/`.
- Generated: No.
- Committed: Yes. `src/behavior/types.ts`, `src/commands/types.ts`, and `src/services/types.ts` header comments cite their rulebook sources — update code headers when the spec changes.

**`build/` + `coverage/`:**
- Purpose: Local build outputs and Jest coverage reports.
- Generated: Yes.
- Committed: No (git-ignored artifacts). Never import from these.

**`__tests__/`:**
- Purpose: Test suites mirroring `src/` modules.
- Generated: No.
- Committed: Yes. New production code ships with a mirror test file.

**`.planning/`:**
- Purpose: GSD planning state, phase artifacts, and these codebase maps (`.planning/codebase/`).
- Generated: Partially (agent-written docs + state).
- Committed: Yes (orchestrator manages git operations here — do not commit manually from mapper/executor roles).

---

*Structure analysis: 2026-10-11*
