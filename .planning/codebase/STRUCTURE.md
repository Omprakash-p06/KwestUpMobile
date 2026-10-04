# Codebase Structure

**Analysis Date:** 2026-10-04

## Directory Layout

```
KwestUpMobile/
├── index.js                # Expo root: registers App + headless widget handler
├── App.js                  # App shell: boot, theme, timer, persistence, providers (1078 lines)
├── app.json                # Expo config: app id, 4 widgets, plugins, EAS project id
├── eas.json                # EAS build profiles (development / preview / production)
├── package.json            # Deps: expo ~57, RN 0.86, react 19.2.3, llama.rn 0.12.4, android-widget
├── patch-llama-gradle.js   # Postinstall: idempotent llama.rn native patch + syntax assert
├── babel.config.js         # Babel preset chain
├── metro.config.js         # Metro bundler config
├── jest.config.js          # Jest + jest-expo preset
├── eslint.config.js / .eslintrc.js  # Lint (flat + legacy)
├── tsconfig.json           # TypeScript (covers src/behavior|commands|services)
├── assets/                 # Icons, splash, widget previews (incl. widget-preview/)
├── android/                # Native Android shell (gradle.properties, app/build.gradle)
├── src/                    # All application source
│   ├── screens/            # 9 feature screens (drawer routes)
│   ├── components/         # 15 shared UI primitives + overlays
│   ├── navigation/         # Drawer router + drawer chrome
│   ├── context/            # 4 domain state providers
│   ├── utils/              # 14 service/engine modules
│   ├── theme/              # Palette + global styles
│   ├── behavior/           # 4.0 behavior type contracts (spec)
│   ├── commands/           # 4.0 command type contracts (spec)
│   ├── services/           # 4.0 notification/service contracts (spec)
│   └── domains/            # 4.0 domain boundary placeholder (README only)
├── widgets/                # 4 Android widgets + headless task handler (5 .tsx files)
├── rulebook/               # 44-doc behavioral governance spec
│   ├── atomic-habits/      # 24 principle specs
│   ├── ai/                 # 5 AI interaction policies
│   ├── rules/              # 8 deterministic business rules
│   └── examples/           # 7 domain workflow examples
├── 4.0/                    # 4.0 master plan (Phases 22-28 roadmap)
├── __tests__/              # Jest suites (unit + widget logic)
├── .planning/              # GSD planning docs (incl. this codebase map)
├── .claude/ / .github/     # Agent + CI config
└── build/ / coverage/      # Build output / coverage (generated)
```

## Directory Purposes

**`src/screens/`:**
- Purpose: One file per drawer route; thin view layer fed by props from `AppNavigator`.
- Contains: 9 screens — `DashboardScreen.js`, `DailyTasksScreen.js`, `BirthdaysScreen.js`, `TaskListScreen.js`, `FocusTimerScreen.js`, `NotesScreen.js`, `BillingScreen.js`, `SearchScreen.js`, `SettingsScreen.js`
- Key files: `src/screens/NotesScreen.js` (vault-aware notes + task/birthday extraction callbacks), `src/screens/SettingsScreen.js` (theme, sync, telemetry, reset), `src/screens/DashboardScreen.js` (aggregated overview)

**`src/components/`:**
- Purpose: Reusable primitives + app-wide overlays/modals.
- Contains: 15 JS modules — buttons, inputs, cards, pickers, switches, badges, boundaries, backgrounds, task UI, AI overlay.
- Key files: `src/components/AIAssistant.js` (on-device AI chat overlay), `src/components/TaskEditModal.js` (single shared editor, mounted in `AppNavigator`), `src/components/ErrorBoundary.js`, `src/components/LiquidGlassBackground.js`, `src/components/QRScannerModal.js`, `src/components/TimerLockoutOverlay.js`

**`src/navigation/`:**
- Purpose: Routing only — no business logic beyond state resolution.
- Contains: Exactly 2 files.
- Key files: `src/navigation/AppNavigator.js` (drawer route table + effective-state resolution + global overlays), `src/navigation/CustomDrawerContent.js` (sidebar chrome)

**`src/context/`:**
- Purpose: One provider per domain slice; sole persistence writers for their keys.
- Contains: 4 providers, no nesting among themselves (nested only in `App.js`).
- Key files: `src/context/TaskContext.js` (tasks/taskLists/dailyTasks + debounced merge-write), `src/context/VaultContext.js` (vaults/activeVault/notes/activeNote), `src/context/BillingContext.js`, `src/context/BirthdayContext.js`

**`src/utils/`:**
- Purpose: Engines, device services, persistence — the largest layer (14 modules).
- Contains: Pure logic + Expo/AsyncStorage facades.
- Key files: `src/utils/taskMutations.js` (pure task engine shared with widgets), `src/utils/aiService.js` (llama.rn lifecycle), `src/utils/fileStorage.js` (vault markdown CRUD), `src/utils/vaultService.js` (vault registry), `src/utils/storage.js` (`APP_VERSION v3.5.0`, `STORAGE_VERSION v7.0`, migration), `src/utils/notifications.js`, `src/utils/billingStorage.js`, `src/utils/syncService.js`, `src/utils/exportService.js`, `src/utils/diagnostics.js`, `src/utils/dateUtils.js`, `src/utils/logger.js`, `src/utils/vaultImport.js`, `src/utils/billingNotifications.js`

**`src/theme/`:**
- Purpose: Design tokens + global stylesheet.
- Contains: 2 files.
- Key files: `src/theme/colors.js` (`themes`: 5 names × 3 modes), `src/theme/styles.js` (shared StyleSheet)

**`src/behavior/` + `src/commands/` + `src/services/`:**
- Purpose: 4.0 contract stubs — TypeScript interfaces only, zero runtime code, zero tests yet.
- Contains: One `types.ts` each.
- Key files: `src/behavior/types.ts` (Habit, Cue, Intervention, BehaviorEvent, FrictionDiagnosis, FactualReward), `src/commands/types.ts` (11 `CommandAction`s + idempotent `DispatchedCommand`), `src/services/types.ts` (`DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY`)

**`src/domains/`:**
- Purpose: Reserved boundary for Phases 22–28 engines; currently a README describing planned subfolders and the no-cross-import rule.
- Contains: `src/domains/README.md` only — `src/domains/habits|identity|events|interventions|ai` do not exist yet.
- Key files: `src/domains/README.md`

**`widgets/`:**
- Purpose: Android home-screen widgets + headless background handler (no dependency on React tree at runtime; Old Arch bridge, never imports contexts).
- Contains: 5 `.tsx` files.
- Key files: `widgets/widget-task-handler.tsx` (headless entry: tab switch, task toggle via `toggleTask` from `src/utils/taskMutations.js`, render fan-out), `widgets/TasksListWidget.tsx` (interactive list), `widgets/ImportantTasksWidget.tsx` (top-5 important unfinished slice), `widgets/DailyTasksWidget.tsx` (counts only), `widgets/FocusTimerWidget.tsx` (remaining + isRunning only)

**`android/`:**
- Purpose: Native Android shell (Expo prebuild output, checked in with deliberate hand-maintained flags).
- Contains: `android/gradle.properties` (`newArchEnabled=false`, `hermesEnabled=true`, `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`, `expo.useLegacyPackaging=true`, `expo.edgeToEdgeEnabled=true`), `android/app/build.gradle` (applicationId `com.omprakashp06.kwestupmobile`, versionCode 7, legacy-packaging wiring), `android/build.gradle` (`-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` for Android 16 16 KB page-size support), `android/settings.gradle`, `android/gradle/`, `android/gradlew(.bat)`
- Key files: `android/gradle.properties` (read before touching any native bridge choice — the `newArchEnabled=false` comment block is the decision record), `android/app/build.gradle`, `android/build.gradle`

**`rulebook/`:**
- Purpose: Immutable behavioral specification; every future engine path must trace to a doc here.
- Contains: `README.md` (invariants, precedence, grandfathering, compliance matrix), `manifest.json` (44-doc index), `CHANGELOG.md`, `rules/` (8), `ai/` (5), `atomic-habits/` (24), `examples/` (7).
- Key files: `rulebook/README.md`, `rulebook/manifest.json`, `rulebook/rules/reminders.md`, `rulebook/rules/privacy.md`, `rulebook/ai/intent-parser.md`

**`4.0/`:**
- Purpose: Single master-plan doc for the 4.0 Atomic Behavior Engine roadmap.
- Contains: `4.0/KwestUp_4.0_Master_Plan.md`
- Key files: `4.0/KwestUp_4.0_Master_Plan.md`

**`__tests__/`:**
- Purpose: Jest suites mirroring engines and widget logic.
- Contains: `__tests__/unit/`, `__tests__/phase12-widget-logic.test.js`, `__tests__/setup/`
- Key files: `__tests__/phase12-widget-logic.test.js`, `jest.config.js` (root config)

## Key File Locations

**Entry Points:**
- `index.js`: Expo root — `registerRootComponent(App)` + `registerWidgetTaskHandler(widgetTaskHandler)`
- `App.js`: App shell — boot/hydration/providers/timer/widgets/modals (start here for any app-wide change)
- `src/navigation/AppNavigator.js`: Route table — add/remove/reorder drawer screens here
- `widgets/widget-task-handler.tsx`: Headless widget runtime — all background widget logic lives here

**Configuration:**
- `app.json`: Expo + widget plugin registrations (4 widgets: FocusTimer, DailyTasks, ImportantTasks, TasksList), package `com.omprakashp06.kwestupmobile`, EAS project id
- `eas.json`: Build profiles — `development` (dev-client APK), `preview` (internal), `production` (APK + raised Node heap)
- `android/gradle.properties`: Native bridge + packaging flags — `newArchEnabled=false` (Old Arch + JSI), `hermesEnabled=true`, `expo.useLegacyPackaging=true` (Android 16 install-time lib extraction), ABIs, edge-to-edge
- `android/app/build.gradle` / `android/build.gradle`: App id/versionCode, legacy-packaging wiring, 16 KB page-size cmake flag
- `package.json`: Scripts (`start`, `android`, `lint`, `typecheck`, `test`), expo `~57.0.0` / RN `0.86.0` / react `19.2.3` / `llama.rn@0.12.4` / `react-native-android-widget`, `postinstall: node patch-llama-gradle.js`, `engines: node >=22.13`
- `tsconfig.json`: TS scope (covers the three `src/*/types.ts` contracts)
- `babel.config.js`, `metro.config.js`: Transpile/bundle
- `jest.config.js`: `jest-expo` preset, test match
- `eslint.config.js`, `.eslintrc.js`: Lint rules

**Core Logic:**
- `src/utils/taskMutations.js`: All task math — edit here to change toggle/recurrence/subtask/list behavior for both app and widgets
- `src/context/TaskContext.js`: Task state + persistence — edit here to change save cadence or foreground sync
- `src/utils/fileStorage.js` + `src/utils/vaultService.js`: Notes/vault persistence — edit here for vault layout or filename rules
- `src/utils/aiService.js`: Model lifecycle — edit here for model version, idle/background unload, inference params
- `src/utils/storage.js`: Key versioning/migration — bump `STORAGE_VERSION` here when the stored schema changes

**Testing:**
- `jest.config.js`: Runner config at repo root
- `__tests__/unit/`: Engine unit tests
- `__tests__/phase12-widget-logic.test.js`: Widget handler logic tests
- `__tests__/setup/`: Jest setup files

## Naming Conventions

**Files:**
- Screens: `<Feature>Screen.js` — e.g. `src/screens/TaskListScreen.js`, `src/screens/FocusTimerScreen.js` (note: Tasks route file is singular `TaskListScreen.js`)
- Shared UI: `Custom<Button|TextInput|Card|Badge|Switch|...>.js` or `<Purpose><Kind>.js` — e.g. `src/components/TaskCard.js`, `src/components/TaskEditModal.js`, `src/components/TimerLockoutOverlay.js`, `src/components/LiquidGlassBackground.js`
- Contexts: `<Domain>Context.js` exporting `<Domain>Provider` + `use<Domain>` — e.g. `src/context/TaskContext.js` → `TaskProvider`/`useTasks`
- Utils: `<domain><Concern>.js` camelCase — e.g. `src/utils/taskMutations.js`, `src/utils/fileStorage.js`, `src/utils/billingStorage.js`, `src/utils/dateUtils.js`
- Widgets: `<Name>Widget.tsx` + single `widget-task-handler.tsx` — e.g. `widgets/TasksListWidget.tsx`
- 4.0 contracts: Always `types.ts` inside `src/behavior/`, `src/commands/`, `src/services/`
- Rulebook: kebab-case `.md` grouped by folder — e.g. `rulebook/rules/missed-habit.md`, `rulebook/atomic-habits/two-minute-rule.md`
- Tests: `*.test.js(x)` / `*.test.ts` under `__tests__/` mirroring source names

**Directories:**
- Lowercase plural for code collections: `src/screens/`, `src/components/`, `src/utils/`, `src/context/`, `widgets/`
- Lowercase singular for concept groups: `src/behavior/`, `src/commands/`, `src/services/`, `src/domains/`, `src/navigation/`, `src/theme/`
- Lowercase with hyphens for spec groups: `rulebook/atomic-habits/`, `rulebook/ai/`, `rulebook/rules/`, `rulebook/examples/`

## Where to Add New Code

**New Feature (e.g. new drawer screen):**
- Primary code: New file `src/screens/<Feature>Screen.js`, register route in `src/navigation/AppNavigator.js:214-355`, add drawer label in `src/navigation/CustomDrawerContent.js`
- Tests: `__tests__/unit/<feature>.test.js` (mirror engine logic; keep screen files thin)

**New Component/Module:**
- Implementation: `src/components/<Name>.js` for UI; `src/utils/<domain><Concern>.js` for logic
- Overlay/modals shared across screens: Mount once in `src/navigation/AppNavigator.js:358-387` following the `TaskEditModal` precedent — never mount per-screen duplicates

**Utilities:**
- Shared helpers: `src/utils/` — pure functions in `src/utils/<domain>.js`; date helpers specifically in `src/utils/dateUtils.js`; logging only via `src/utils/logger.js` (never raw `console.*` in new code, per `rulebook/rules/privacy.md` redaction duty)
- Theming: Extend `src/theme/colors.js` (`themes` map) + `src/theme/styles.js`; resolve via `resolveThemeMode/resolveThemeName` pattern in `App.js:76-77`

**New 4.0 Domain Engine (Phases 22–28):**
- Implementation: `src/domains/<name>/` per `src/domains/README.md` (planned: `habits/`, `identity/`, `events/`, `interventions/`, `ai/`)
- Types: Extend `src/behavior/types.ts` / `src/commands/types.ts` / `src/services/types.ts` — never define domain types inline in engine files
- Rules: Cross-domain calls go through events, never direct domain-to-domain imports (`src/domains/README.md` rule); add/adjust spec in `rulebook/` + `rulebook/manifest.json` + `rulebook/CHANGELOG.md` before changing engine code

**New Widget:**
- Implementation: `widgets/<Name>Widget.tsx`, register in `app.json` plugin `widgets` array (copy a `FocusTimer` block: name/label/description/minWidth/minHeight/previewImage), map in `nameToWidget` in `widgets/widget-task-handler.tsx:13-18`, add render branch in `widgets/widget-task-handler.tsx:242-271`
- Follow the slice + stagger + `active`-only discipline in `App.js:558-648` and headless AsyncStorage reads (never import contexts into `widgets/`)

**Native / Build Changes:**
- Bridge flags: Edit `android/gradle.properties` only — read the `newArchEnabled=false` decision comment first; do not enable New Arch without the two gating conditions (non-NothingOS validation + llama.rn `getJSCallInvoker` migration)
- 16 KB / packaging flags: `android/build.gradle` (flexible page sizes) + `expo.useLegacyPackaging` in `android/gradle.properties`; verify via a release APK install on Android 16
- Build flavors: Edit `eas.json` profiles; version bumps touch `app.json` + `android/app/build.gradle` versionCode + `package.json` + `src/utils/storage.js` `APP_VERSION` together

## Special Directories

**`rulebook/`:**
- Purpose: Governance spec, not runtime code — do not import at runtime; reference in comments/specs only
- Generated: No (hand-authored, versioned via `rulebook/manifest.json` + `rulebook/CHANGELOG.md`)
- Committed: Yes

**`src/domains/`:**
- Purpose: Empty boundary placeholder (README only) reserving Phase 22–28 engine homes
- Generated: No
- Committed: Yes (`src/domains/README.md`)

**`android/`:**
- Purpose: Native shell with hand-maintained bridge/packaging flags (Old Arch, Hermes, 16 KB page-size, legacy packaging)
- Generated: Partially (Expo prebuild output + manual flag edits — treat `gradle.properties` comment block as decision record)
- Committed: Yes

**`build/` + `coverage/` + `node_modules/`:**
- Purpose: Build artifacts / coverage output / installed deps
- Generated: Yes
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: GSD roadmap, phases, and this codebase map (`.planning/codebase/`)
- Generated: Partially (agent-written docs)
- Committed: Yes (planning history)

---

*Structure analysis: 2026-10-04*
