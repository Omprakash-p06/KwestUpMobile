# Codebase Structure

**Analysis Date:** 2026-10-10

## Directory Layout

```
KwestUpMobile/
├── index.js                # Expo root: registers App + widget handler
├── App.js                  # App shell: state, init, persistence, dialogs (1071 lines)
├── app.json                # Expo config: name, icons, 4 Android widgets, EAS id
├── package.json            # Deps + scripts (expo ~57, react 19, jest, eslint)
├── tsconfig.json           # strict+allowJs, checkJs OFF, widgets excluded
├── babel.config.js         # Babel preset (+ remove-console in release)
├── metro.config.js         # Metro bundler config
├── jest.config.js          # jest-expo preset
├── eslint.config.js / .eslintrc.js  # Lint configs (flat + legacy)
├── eas.json                # EAS build profiles
├── patch-llama-gradle.js   # Postinstall native patch for llama.rn
├── assets/                 # App logo, splash, favicon, widget previews, fonts
├── android/                # Native Android shell (prebuild output)
├── build/                  # Local build artifacts
├── coverage/               # Jest coverage output
├── src/
│   ├── screens/            # 9 feature screens (largest: NotesScreen 2013 lines)
│   ├── components/         # 15 reusable UI primitives + modals
│   ├── context/            # 4 domain providers (Task/Vault/Billing/Birthday)
│   ├── navigation/         # Drawer navigator + custom drawer chrome
│   ├── services/           # Typed notification engine + policy types
│   ├── utils/              # 15 modules: engines, storage, AI, sync, helpers
│   ├── theme/              # colors.js (5×3 tokens) + styles.js (shared sheet)
│   ├── behavior/           # 4.0 habit/identity/intervention types only
│   ├── commands/           # 4.0 AI command registry types only
│   └── domains/            # 4.0 placeholder (README only, no code yet)
├── widgets/                # 4 Android widgets + headless task handler (.tsx)
├── __tests__/              # Jest suites (unit/ + widget-logic + setup)
├── rulebook/               # Product rules: ai/, atomic-habits/, rules/, machine/
├── 4.0/                    # KwestUp_4.0_Master_Plan.md (Phase 22-28 roadmap)
├── .planning/              # GSD planning docs (this codebase map lives here)
├── .github/                # CI workflows
└── Gemfile-free zone: no ios/ dir (Android-first; iOS via Expo prebuild)
```

## Directory Purposes

**`src/screens`:**
- Purpose: One full-screen feature surface per route; containers that compose components + context hooks.
- Contains: 9 `*Screen.js` files, all `PascalCase` + `Screen` suffix.
- Key files: `src/screens/NotesScreen.js` (2013 lines — vault browser + markdown editor, the largest file in the repo), `src/screens/SettingsScreen.js` (1101 lines — theme/sync/telemetry/reset), `src/screens/BillingScreen.js` (823), `src/screens/TaskListScreen.js` (803), `src/screens/DailyTasksScreen.js` (698), `src/screens/BirthdaysScreen.js` (575), `src/screens/FocusTimerScreen.js` (496), `src/screens/DashboardScreen.js` (445), `src/screens/SearchScreen.js` (265).

**`src/components`:**
- Purpose: Reusable presentational primitives and globally-mounted modals/overlays.
- Contains: 15 `PascalCase.js` files; dumb UI + two stateful islands (`AIAssistant`, `TaskEditModal`).
- Key files: `src/components/AIAssistant.js` (1096 lines — chat UI over `aiService`), `src/components/TaskEditModal.js` (519 — mounted once in `AppNavigator`, bound to `TaskContext`), `src/components/QRScannerModal.js` (512 — LAN-sync pairing), `src/components/ErrorBoundary.js` (409), `src/components/CustomDateTimePicker.js` (397), `src/components/TaskCard.js` (294), `src/components/LiquidGlassCard.js` (210), `src/components/CustomButton.js` (105), `src/components/LiquidGlassBackground.js` (73), `src/components/TimerLockoutOverlay.js` (40), plus `CustomBadge`/`CustomCard`/`CustomSegmentedButtons`/`CustomSwitch`/`CustomTextInput`.

**`src/context`:**
- Purpose: Runtime owner of each domain slice; the only sanctioned mutation + persistence path for its keys.
- Contains: 4 `*Context.js` providers, each exporting `XProvider` + `useX` hook.
- Key files: `src/context/TaskContext.js` (370 lines — sole writer of tasks/taskLists/dailyTasks), `src/context/BillingContext.js` (133), `src/context/VaultContext.js` (99), `src/context/BirthdayContext.js` (91).

**`src/navigation`:**
- Purpose: Route table + drawer chrome.
- Contains: Exactly 2 files.
- Key files: `src/navigation/AppNavigator.js` (397 lines — `createDrawerNavigator` with 9 routes, context-vs-prop resolution, global modal mounts, notification channel init), `src/navigation/CustomDrawerContent.js` (279 lines — 9 drawer items, theme cycler, user header).

**`src/services`:**
- Purpose: Typed service layer (the only fully TypeScript-checked runtime code besides widgets).
- Contains: 2 `.ts` files.
- Key files: `src/services/notificationService.ts` (767 lines — unified dispatch engine + behavioral policy), `src/services/types.ts` (99 lines — channels, categories, policy, history types).

**`src/utils`:**
- Purpose: Engines, persistence adapters, and cross-cutting helpers callable from any layer.
- Contains: 15 flat `.js` modules (no subdirectories).
- Key files: `src/utils/aiService.js` (1064 lines — llama.rn lifecycle), `src/utils/exportService.js` (385), `src/utils/fileStorage.js` (299 — vault markdown CRUD), `src/utils/taskMutations.js` (293 — pure engine), `src/utils/vaultService.js` (237 — vault registry), `src/utils/syncService.js` (195 — LAN sync), `src/utils/logger.js` (194), `src/utils/storage.js` (188 — version keys + migration), `src/utils/dateUtils.js` (174 — local wall-clock helpers), `src/utils/billingStorage.js` (158), `src/utils/diagnostics.js` (150), `src/utils/notifications.js` (134 — legacy/task helpers), `src/utils/vaultImport.js` (113), `src/utils/billingNotifications.js` (106).

**`src/theme`:**
- Purpose: Single theming source of truth.
- Contains: 2 files.
- Key files: `src/theme/colors.js` (81 lines — `themes` 5 names × 3 modes), `src/theme/styles.js` (895 lines — shared `StyleSheet`).

**`src/behavior`, `src/commands`:**
- Purpose: Frozen 4.0 type contracts; no runtime code.
- Contains: One `types.ts` each.
- Key files: `src/behavior/types.ts` (180 lines — Habit/Identity/Cue/Intervention/BehaviorEvent/Reward), `src/commands/types.ts` (118 lines — CommandAction union + per-action payloads + idempotency).

**`src/domains`:**
- Purpose: Reserved directory for Phase 22-28 domain isolation (habits/identity/events/interventions/ai).
- Contains: `src/domains/README.md` only — boundary rules documented, no code yet.

**`widgets`:**
- Purpose: Android home-screen surface + headless background logic (TypeScript/TSX only).
- Contains: 5 `.tsx` files.
- Key files: `widgets/widget-task-handler.tsx` (273 lines — tab switch, task toggle, render fan-out), `widgets/TasksListWidget.tsx` (275 — interactive list, the richest widget), `widgets/ImportantTasksWidget.tsx` (163), `widgets/DailyTasksWidget.tsx` (95), `widgets/FocusTimerWidget.tsx` (80).

**`__tests__`:**
- Purpose: Jest suites run under the `jest-expo` preset.
- Contains: `__tests__/unit/` (per-module unit tests), `__tests__/phase12-widget-logic.test.js` (widget engine tests), `__tests__/setup/` (test bootstrap).
- Key files: `jest.config.js` (preset + setup mapping), `coverage/` (generated output, not committed source).

**`rulebook`, `4.0`:**
- Purpose: Product specification, not code. `rulebook/rules/`, `rulebook/ai/`, `rulebook/atomic-habits/`, `rulebook/machine/`, `rulebook/manifest.json` define reminder/behavior/AI rules cited by type comments; `4.0/KwestUp_4.0_Master_Plan.md` is the Phase 22-28 roadmap.
- Generated: No. Committed: Yes.

**`assets`, `android`, `build`:**
- Purpose: `assets/` holds bundled images/fonts consumed via `app.json` (`app-logo`, `splash-icon`, `favicon`, `widget-preview/*`); `android/` is the Expo prebuild native shell; `build/` holds local build outputs.

## Key File Locations

**Entry Points:**
- `index.js`: Expo root — `registerRootComponent(App)` + `registerWidgetTaskHandler`.
- `App.js`: Shell mount — init, hydration, providers, dialogs.
- `widgets/widget-task-handler.tsx`: Headless OS entry — widget render + tap actions.
- `src/navigation/AppNavigator.js`: Navigation entry — route table + global mounts.

**Configuration:**
- `app.json`: Expo/app identity, icons/splash, camera/build-properties/widget plugins, EAS project id.
- `package.json`: Deps, scripts (`start`, `android`, `lint`, `typecheck`, `test`), node `>=22.13`.
- `tsconfig.json`: `strict`, `allowJs`, `checkJs: false`; includes `src/**`, `__tests__/**`, root configs; excludes `widgets/**` from program (still type-checked on direct open).
- `babel.config.js` / `metro.config.js`: Transpile + bundler config.
- `jest.config.js`: `jest-expo` preset, test match, setup files.
- `eslint.config.js` + `.eslintrc.js`: Flat (current) + legacy (compat) lint configs.
- `eas.json`: EAS build profiles.

**Core Logic:**
- `src/utils/taskMutations.js`: Authoritative task transitions — start here for any task behavior change.
- `src/services/notificationService.ts`: Authoritative scheduling/policy — start here for any reminder change.
- `src/utils/aiService.js`: Authoritative AI lifecycle — start here for any assistant/model change.
- `src/utils/fileStorage.js` + `src/utils/vaultService.js`: Authoritative notes persistence — start here for any notes/vault change.
- `src/context/TaskContext.js`: Authoritative runtime task state — start here for state-shape changes.

**Testing:**
- `__tests__/unit/`: Per-module unit suites.
- `__tests__/phase12-widget-logic.test.js`: Widget engine suite.
- `__tests__/setup/`: Jest bootstrap (mocks for native modules).
- `jest.config.js`: Runner config.

## Naming Conventions

**Files:**
- Screens: `PascalCase` + `Screen` suffix — e.g. `src/screens/TaskListScreen.js`, `src/screens/BirthdaysScreen.js`.
- Components: Bare `PascalCase` — e.g. `src/components/TaskCard.js`, `src/components/LiquidGlassBackground.js`.
- Contexts: Domain + `Context` suffix — e.g. `src/context/TaskContext.js`, `src/context/VaultContext.js`.
- Utils/services: `camelCase` domain nouns — e.g. `src/utils/taskMutations.js`, `src/utils/fileStorage.js`, `src/services/notificationService.ts`.
- Type contracts: Always `types.ts` — `src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts`.
- Widgets: `PascalCase` + `Widget` suffix + one kebab handler — `widgets/TasksListWidget.tsx`, `widgets/widget-task-handler.tsx`.
- Tests: Mirror source name + `.test.js` — e.g. `__tests__/phase12-widget-logic.test.js`.

**Directories:**
- All lowercase plural nouns: `screens`, `components`, `context`, `utils`, `services`, `widgets`, `assets`, `theme`, `navigation`, `behavior`, `commands`, `domains`. Exception: `__tests__` (jest convention, dunder-wrapped).

## Where to Add New Code

**New Feature:**
- Primary code: New screen in `src/screens/<Name>Screen.js` + route entry in `src/navigation/AppNavigator.js` + drawer item in `src/navigation/CustomDrawerContent.js`.
- Tests: New suite in `__tests__/unit/<name>.test.js` mirroring the engine file under test.

**New Component/Module:**
- Implementation: Reusable UI → `src/components/<PascalCase>.js`; pure logic → `src/utils/<camelCase>.js`; typed service → `src/services/<camelCase>.ts` with types in `src/services/types.ts`.
- Globally-mounted UI (modals/assistants): Mount once in `src/navigation/AppNavigator.js` following the `TaskEditModal`/`AIAssistant` precedent — never per-screen.

**Utilities:**
- Shared helpers: Flat in `src/utils/` (no subfolders by convention). Date/wall-clock helpers → `src/utils/dateUtils.js`; storage keys/migration → `src/utils/storage.js`; logging → `src/utils/logger.js` (never raw `console` in app runtime).

**New 4.0 Domain (Phase 22+):**
- Implementation: New folder `src/domains/<name>/` per `src/domains/README.md` rules — isolated state/mutations/services, cross-domain calls via `BehaviorEvent`s (`src/behavior/types.ts`) only, never direct imports; command surface via `src/commands/types.ts`.

**New Widget:**
- Implementation: Render component `widgets/<Name>Widget.tsx` + `nameToWidget` entry + render branch in `widgets/widget-task-handler.tsx` + `widgets` array entry in `app.json` (name/label/description/sizing/preview). Keep payloads sliced (top-N) per the Binder budget.

## Special Directories

**`node_modules`:**
- Purpose: Installed dependencies.
- Generated: Yes (npm install).
- Committed: No (gitignored).

**`android`:**
- Purpose: Expo prebuild native shell for custom dev client + widgets.
- Generated: Yes (via `expo prebuild`), then hand-patched by `patch-llama-gradle.js` on postinstall.
- Committed: Yes (checked in for reproducible native builds).

**`build`, `coverage`:**
- Purpose: Local build outputs / jest coverage reports.
- Generated: Yes.
- Committed: No.

**`rulebook`, `4.0`:**
- Purpose: Normative product specs (reminder policy, habit rules, AI contracts, master plan) referenced by code comments as `Source:`.
- Generated: No.
- Committed: Yes — treat as read-only requirements, not implementation.

**`.planning`:**
- Purpose: GSD planning state (roadmap, phases, this codebase map).
- Generated: Partially (agent-written docs).
- Committed: Yes.

---

*Structure analysis: 2026-10-10*
