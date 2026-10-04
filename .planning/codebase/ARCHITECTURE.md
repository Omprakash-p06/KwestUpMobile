<!-- refreshed: 2026-10-04 -->
# Architecture

**Analysis Date:** 2026-10-04

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├──────────────────┬──────────────────┬───────────────────────┤
│  Screens (9)     │  Components (15) │  Navigation (Drawer)  │
│  `src/screens/`  │ `src/components/`│ `src/navigation/`     │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    State / Context Layer                     │
│  `src/context/TaskContext.js` `src/context/VaultContext.js`  │
│  `src/context/BillingContext.js` `src/context/BirthdayContext.js` │
│  Root owner: `App.js` (boot, theme, timer, sync orchestration) │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Domain Logic / Pure Engine Layer                 │
│  `src/utils/taskMutations.js` (pure task engine)             │
│  `src/utils/vaultService.js` + `src/utils/fileStorage.js`    │
│  `src/utils/aiService.js` (llama.rn) + `src/utils/notifications.js` │
│  Future: `src/domains/*` + `src/behavior/types.ts`           │
│         `src/commands/types.ts` + `src/services/types.ts`    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Persistence / Platform Bridge (Old Arch + JSI)              │
│  AsyncStorage (`src/utils/storage.js`) + expo-file-system     │
│  Headless widgets `widgets/widget-task-handler.tsx`          │
│  Android widgets `widgets/*.tsx` + `app.json` plugin config  │
│  `android/gradle.properties` (newArchEnabled=false)          │
└─────────────────────────────────────────────────────────────┘
```

Governance sits above all layers: `rulebook/` containing both **human philosophy specifications** (Markdown) and **machine-executable rules** (`rulebook/machine/*.json` with explicit Rule IDs) plus the 4.0 plan in `4.0/KwestUp_4.0_Master_Plan.md`.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root composition | Boot sequence, theme resolution, timer loop, persistence orchestration, provider nesting, widget push | `App.js` |
| Expo entry | Registers root component + headless widget task handler | `index.js` |
| Drawer router | 9-screen drawer, resolves context-vs-prop precedence, hosts `TaskEditModal` + `AIAssistant` overlays | `src/navigation/AppNavigator.js` |
| Drawer chrome | Sidebar UI, theme toggle, user header | `src/navigation/CustomDrawerContent.js` |
| Task state | Sole writer of tasks/taskLists/dailyTasks; debounced read-modify-write persistence; foreground re-sync | `src/context/TaskContext.js` |
| Vault state | Active vault id, vault list, notes mirror, filesystem reload on switch | `src/context/VaultContext.js` |
| Billing state | Transactions/budgets/recurring bills, exclusive billing writer | `src/context/BillingContext.js` |
| Birthday state | Birthday CRUD + notification (re)scheduling | `src/context/BirthdayContext.js` |
| Pure task engine | Framework-agnostic toggle/complete/save/delete/subtask/list/recurrence math; shared by app + widgets | `src/utils/taskMutations.js` |
| Vault metadata | Vault registry + active-vault id in AsyncStorage, path resolution | `src/utils/vaultService.js` |
| Notes filesystem | Vault-parameterized markdown CRUD under `FileSystem.documentDirectory` | `src/utils/fileStorage.js` |
| On-device AI Specialist | llama.rn lifecycle (Qwen 2.5 0.5B GGUF), idle/background unload; specialist for intent extraction, friction diagnosis, plan explanation | `src/utils/aiService.js` |
| Notifications | Birthday/due-date/billing scheduling, permission requests, quiet-hour handling | `src/utils/notifications.js` |
| Billing persistence | Billing key CRUD, billing reminder scheduling | `src/utils/billingStorage.js`, `src/utils/billingNotifications.js` |
| Sync/export | LAN sync client, JSON export, diagnostics/telemetry gates | `src/utils/syncService.js`, `src/utils/exportService.js`, `src/utils/diagnostics.js` |
| Storage versioning | `APP_VERSION`/`STORAGE_VERSION`, cache clear, legacy `kwestup_data_v*` migration | `src/utils/storage.js` |
| Theming | 5 theme names × 3 modes palette + global StyleSheet | `src/theme/colors.js`, `src/theme/styles.js` |
| Headless widget runtime | Background `WIDGET_CLICK`/`WIDGET_UPDATE` handling, tab state, ticking animation, cross-widget refresh | `widgets/widget-task-handler.tsx` |
| Widget views | Four Android widget renderers (timer, daily progress, important, full list) | `widgets/FocusTimerWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/TasksListWidget.tsx` |
| Behavior contracts | 4.0 domain interfaces (Habit, Cue, Intervention, BehaviorEvent, Reward, Rule IDs) | `src/behavior/types.ts` |
| Command contracts & Gateway | Command Gateway actions, schema validation, capability checks, permissions, idempotency | `src/commands/types.ts` |
| Service contracts | Notification channels, descriptors, `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` | `src/services/types.ts` |
| Governance spec | Two-layer rulebook: human philosophy specs + machine executable rule sets (`rulebook/machine/*.json`) | `rulebook/README.md`, `rulebook/manifest.json`, `rulebook/rules/`, `rulebook/machine/` |

## Pattern Overview

**Overall:** Offline-first monolithic Expo app — Context + Pure-Engine + Filesystem persistence, with spec-first governance for the planned 4.0 Atomic Behavior Engine.

**Key Characteristics:**
- No backend: AsyncStorage is the system of record for tasks/birthdays/theme/billing; `expo-file-system` markdown files are the system of record for notes per vault.
- Single mutation path per domain: `TaskContext.js` wraps `taskMutations.js`; `VaultContext.js` wraps `fileStorage.js`/`vaultService.js`; billing writes live only in `BillingContext.js`.
- App-shell owns cross-cutting boot: `App.js` (`initializeApp` → `loadData`) hydrates all providers, then each context re-syncs from storage on foreground.
- Headless/platform duality: the same pure engine (`src/utils/taskMutations.js`) runs in-process (React state) and headless (widget handler directly on AsyncStorage).
- Spec-before-code for 4.0: `rulebook/` + `src/behavior/types.ts` + `src/commands/types.ts` + `src/services/types.ts` + `src/domains/README.md` define engines that do not exist yet (Phases 22–28).
- **Three-Layer Intelligence Architecture:**
  1. *Layer 1 (LLM Intelligence):* Small ~400 MB Qwen model handles semantic understanding (intent parsing, friction identification, natural-language explanation).
  2. *Layer 2 (Rule Intelligence):* Deterministic rule engine executes machine rules with unique Rule IDs (`HABIT_CREATE_001`, `MINIMUM_ACTION_001`, `RECOVERY_001`), emitting `rulesApplied` audit traces.
  3. *Layer 3 (Execution Intelligence):* Command Gateway validates schemas, capabilities, and permissions before dispatching to KwestUp executor and touchpoints (widgets, notifications, in-app).

## Layers

**Presentation (screens + components):**
- Purpose: Render 9 feature areas and shared UI primitives; screens are deliberately thin and receive state via props injected by `AppNavigator.js`.
- Location: `src/screens/`, `src/components/`
- Contains: `src/screens/DashboardScreen.js`, `src/screens/DailyTasksScreen.js`, `src/screens/BirthdaysScreen.js`, `src/screens/TaskListScreen.js`, `src/screens/FocusTimerScreen.js`, `src/screens/NotesScreen.js`, `src/screens/BillingScreen.js`, `src/screens/SearchScreen.js`, `src/screens/SettingsScreen.js`; primitives `src/components/CustomButton.js`, `src/components/CustomTextInput.js`, `src/components/TaskCard.js`, `src/components/TaskEditModal.js`, `src/components/AIAssistant.js`, `src/components/ErrorBoundary.js`, `src/components/LiquidGlassBackground.js`, `src/components/TimerLockoutOverlay.js`
- Depends on: Context hooks (`useTasks`, `useVaults`, `useBilling`, `useBirthdays`), `src/theme/colors.js`, `src/utils/dateUtils.js`
- Used by: `src/navigation/AppNavigator.js` (drawer route render callbacks)

**Navigation:**
- Purpose: Single drawer router; resolves effective state (context wins, props fallback) and mounts global overlays once.
- Location: `src/navigation/`
- Contains: `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`
- Depends on: All four contexts, all 9 screens, `src/components/TaskEditModal.js`, `src/components/AIAssistant.js`
- Used by: `App.js` (inside `NavigationContainer`)

**State / context:**
- Purpose: Own one domain slice, expose hooks + actions, persist eagerly with read-modify-write so sibling writers never clobber each other.
- Location: `src/context/`
- Contains: `src/context/TaskContext.js` (tasks/taskLists/dailyTasks, 500 ms debounced merge-write, boot-empty guard, `refreshTasksFromStorage` on `AppState active`), `src/context/VaultContext.js` (vaults/activeVaultId/notes/activeNote, `handleSetActiveVault`, `loadVaultNotes`), `src/context/BillingContext.js`, `src/context/BirthdayContext.js`
- Depends on: `src/utils/taskMutations.js`, `src/utils/notifications.js`, `src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/storage.js`
- Used by: `src/navigation/AppNavigator.js`, all screens via hooks

**Domain logic / pure engine:**
- Purpose: Side-effect-free transformations + device-service facades (notifications, AI, sync, export).
- Location: `src/utils/`, `src/behavior/`, `src/commands/`, `src/services/`
- Contains: `src/utils/taskMutations.js`, `src/utils/dateUtils.js`, `src/utils/logger.js`, `src/utils/aiService.js`, `src/utils/syncService.js`, `src/utils/exportService.js`; type contracts `src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts`
- Depends on: `expo-file-system`, `@react-native-async-storage/async-storage`, `llama.rn`, `expo-notifications`
- Used by: Contexts, `App.js`, `widgets/widget-task-handler.tsx`

**Persistence:**
- Purpose: Versioned AsyncStorage keys (`kwestup_data_v7.0`, `kwestup_timer_state_v7.0`, `kwestup_billing_v7.0`, etc.) + per-vault markdown tree; legacy migration on boot.
- Location: `src/utils/storage.js`, `src/utils/fileStorage.js`, `src/utils/vaultService.js`
- Contains: `isUserDataKey`, `clearAllCaches`, `migrateUserDataIfNeeded` in `src/utils/storage.js`; `initNotesFolder`, `saveNoteFile`, `getAllNotesFromFilesystem`, `wipeNotesFilesystem` in `src/utils/fileStorage.js`
- Depends on: AsyncStorage + `expo-file-system`
- Used by: `App.js` (`initializeApp`/`loadData`/`saveData`), all contexts, widget handler

**Platform bridge (widgets + native — Old Architecture + JSI):**
- Purpose: Push throttled widget renders from app process; handle taps headlessly without launching the app. Runs on the Old Architecture bridge (`newArchEnabled=false`) with JSI used by llama.rn via the CatalystInstance path.
- Location: `widgets/`, `app.json`, `android/`
- Contains: `widgets/widget-task-handler.tsx`, `widgets/TasksListWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/FocusTimerWidget.tsx`; widget plugin block in `app.json`; native flags in `android/gradle.properties`, `android/app/build.gradle`, `android/build.gradle`
- Native bridge choice: Old Architecture — `newArchEnabled=false` in `android/gradle.properties:60` (deliberate; Fabric `DefaultNewArchitectureEntryPoint.load()` crashes on NothingOS NtOnlineConfigImpl injection on Nothing Phone 3a — see inline comment `android/gradle.properties:42-60`). `hermesEnabled=true` (`android/gradle.properties:64`). llama.rn `0.12.4` installs JSI bindings through `RNLlamaModule.install()` → `getCatalystInstance().getJSCallInvokerHolder()`, i.e. the Old-Arch bridge API — no Fabric/TurboModules required. Re-enable New Arch only after non-NothingOS validation AND llama.rn migrates to `ReactContext.getJSCallInvoker()`.
- Android 16 / 16 KB page-size support: `-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` injected into cmake args (`android/build.gradle:47-48`); `expo.useLegacyPackaging=true` (`android/gradle.properties:79`, honored in `android/app/build.gradle:122`) so native libs extract at install time. ABIs: `armeabi-v7a,arm64-v8a,x86,x86_64` (`android/gradle.properties:34`).
- Depends on: `react-native-android-widget`, `src/utils/taskMutations.js`, `src/utils/storage.js`
- Used by: `index.js` (`registerWidgetTaskHandler`), `App.js` (`requestWidgetUpdate` effects)

**Governance (non-runtime):**
- Purpose: Immutable behavioral spec + future domain boundaries; constrains what engines/AI may do.
- Location: `rulebook/`, `src/domains/`, `4.0/`
- Contains: `rulebook/README.md`, `rulebook/manifest.json`, `rulebook/CHANGELOG.md`, `rulebook/rules/*.md` (8 rules), `rulebook/ai/*.md` (5 policies), `rulebook/atomic-habits/*.md` (24 principles), `rulebook/examples/*.md` (7 workflows); `src/domains/README.md` (Phases 22–28 plan); `4.0/KwestUp_4.0_Master_Plan.md`
- Depends on: Nothing at runtime (referenced by types only)
- Used by: Future `src/domains/habits|identity|events|interventions|ai` engines; `src/behavior/types.ts` and `src/commands/types.ts` already import from it conceptually

## Data Flow

### Primary Request Path

1. Boot — `index.js:10` registers root + widget handler; `App.js:170` (`initializeApp`) reads version/username/vaults/active-vault/telemetry in parallel, calls `initNotesFolder`, then fire-and-forget vault migration/cache clear (`App.js:170-244`).
2. Hydration — `App.js:257` (`loadData`) runs `migrateUserDataIfNeeded`, reads `kwestup_data_v7.0` + timer/theme/widget keys, resets daily-task streaks by local date, loads vault notes from filesystem, restores timer with elapsed compensation (`App.js:343-356`).
3. Render — `App.js:848-908` nests `TaskProvider` → `VaultProvider` → `BillingProvider` → `BirthdayProvider` → `NavigationContainer` → `AppNavigator`; `src/navigation/AppNavigator.js:72-102` resolves effective state (context first, props fallback) and injects into each drawer screen (`src/navigation/AppNavigator.js:214-355`).
4. Mutation — Screen calls e.g. `taskCtx.handleSaveTask` → `src/context/TaskContext.js:251` schedules notification via `src/utils/notifications.js`, applies pure `saveTask` from `src/utils/taskMutations.js:149`, `setTasks` triggers 500 ms debounced read-modify-write merge in `src/context/TaskContext.js:94-126`.
5. Persistence — `App.js:421` (`saveData`) merges birthdays/notes/theme/username (never tasks — owned by `TaskContext`) onto stored blob; timer persists separately via `App.js:461` (`saveTimerState`); notes persist as `.md` files via `src/utils/fileStorage.js:33`.

### Widget Tap Flow (headless)

1. Tap on `TasksList` widget → `widgets/widget-task-handler.tsx:86` (`TOGGLE_TASK`/`COMPLETE_TASK`) reads `kwestup_data_v7.0` + tab keys directly from AsyncStorage.
2. Optimistic ticking render (600 ms) via `requestWidgetUpdate` with `isTicking`, then pure `toggleTask` from `src/utils/taskMutations.js:76` (`widgets/widget-task-handler.tsx:126`).
3. Write-back to AsyncStorage, then fan-out refresh to `ImportantTasks`, `DailyTasks`, `TasksList` widgets (`widgets/widget-task-handler.tsx:140-168`).
4. On next foreground, `App.js:146-162` (`AppState active` → `loadData`) and `src/context/TaskContext.js:173-191` (`refreshTasksFromStorage`) pull the widget-mutated state into React.

### AI Assist Flow

1. `src/navigation/AppNavigator.js:370` mounts `src/components/AIAssistant.js` (hidden when a note is open or on Settings).
2. `src/components/AIAssistant.js` calls `src/utils/aiService.js` (model at `FileSystem.documentDirectory + models/qwen2.5-0.5b-instruct-q4_k_m.gguf`, SHA-pinned, 5-min idle unload, background unload via `subscribeAppState` wired in `App.js:157`).
3. Extracted tasks/birthdays/transactions route back through `onTaskCreated` / `onBirthdayCreated` / `onTransactionCreated` in `src/navigation/AppNavigator.js:113-171`, which delegate to context actions — AI never writes storage directly (per `rulebook/README.md` invariant 2).

**State Management:**
- Four React contexts own disjoint slices; `App.js` retains legacy parallel `useState` mirrors for birthdays/notes/theme and passes them as props, but contexts win wherever both exist (`src/navigation/AppNavigator.js:74-102`). Timer/theme/userName/sync state stay in `App.js` local state. No Redux/MobX/Zustand.

## Key Abstractions

**Pure mutation engine:**
- Purpose: Testable, UI- and storage-free task math reused by app and headless widgets.
- Examples: `src/utils/taskMutations.js`, consumed by `src/context/TaskContext.js` and `widgets/widget-task-handler.tsx`
- Pattern: Functions take `(state, args, { now, todayDate })` and return `{ updatedX, ...sidecar }`; callers handle effects (notifications, persistence).

**Vault-scoped filesystem notes:**
- Purpose: Notes live as markdown files so vaults are portable/syncable; AsyncStorage holds only vault registry + active id.
- Examples: `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/vaultImport.js`, `src/context/VaultContext.js`
- Pattern: Every file op takes `vaultId` first; `getVaultPath(vaultId)` roots the tree; switching vault = persist id + reload tree.

**Versioned key-space with migration:**
- Purpose: Bump `STORAGE_VERSION` without losing users; caches can be wiped without touching user data.
- Examples: `src/utils/storage.js` (`APP_VERSION = v3.5.0`, `STORAGE_VERSION = v7.0`, `isUserDataKey`, `clearAllCaches`, `migrateUserDataIfNeeded`)
- Pattern: All keys are `kwestup_<domain>_<STORAGE_VERSION>`; migration copies highest legacy `v*` blob forward once.

**Contract-first 4.0 domains (spec only, no runtime yet):**
- Purpose: Isolate future habit/identity/event/intervention/AI engines behind events, never direct imports.
- Examples: `src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts`, `src/domains/README.md`
- Pattern: TypeScript interfaces + `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY`; rule `rulebook/README.md` §3 grandfathers legacy schedulers until Phase 22.

**Throttled platform fan-out:**
- Purpose: Avoid Android Binder flooding (`-22` transaction failures) on sensitive devices.
- Examples: `App.js:558-648` (5 s throttle, 250–500 ms stagger, `active`-only guard, top-5/top-8 slicing), `App.js:490-509` (15 s main-save throttle)
- Pattern: Guard on `AppState`, throttle by timestamp ref, stagger with `setTimeout`, slice payloads.

## Entry Points

**Expo root:**
- Location: `index.js`
- Triggers: Expo `registerRootComponent`
- Responsibilities: Mount `App`, register headless `widgetTaskHandler` for all widget lifecycle actions

**App shell:**
- Location: `App.js`
- Triggers: App cold start / reload
- Responsibilities: Font load, `initializeApp` → `loadData`, provider nesting, timer loop (`App.js:677-704`), save effects, widget push effects, confirmation/name/telemetry modals, sync + reset handlers

**Drawer router:**
- Location: `src/navigation/AppNavigator.js`
- Triggers: Navigation state changes
- Responsibilities: Route table (Dashboard, Daily, Birthdays, Billing, Tasks, Notes, Focus, Settings, Search), state resolution, global `TaskEditModal` + `AIAssistant` overlays

**Headless widget handler:**
- Location: `widgets/widget-task-handler.tsx`
- Triggers: `WIDGET_ADDED` / `WIDGET_UPDATE` / `WIDGET_RESIZED` / `WIDGET_CLICK` from Android host
- Responsibilities: Serve renders from AsyncStorage without mounting React tree; apply task toggles headlessly

**Native / config entry:**
- Location: `app.json`, `eas.json`, `android/`, `babel.config.js`, `metro.config.js`
- Triggers: Build (EAS/npx expo), bundler
- Responsibilities: App id (`com.omprakashp06.kwestupmobile`), 4 widget registrations, plugin list (`llama.rn`, `expo-camera`, `react-native-android-widget`), EAS project id

## Build Flavors

**EAS profiles (`eas.json`):**
- `development` — dev-client, `distribution: internal`, Android `buildType: apk` (sideloadable debug loop).
- `preview` — `distribution: internal` (internal sharing, no store submit).
- `production` — Android `buildType: apk` with `NODE_OPTIONS=--max-old-space-size=4096` for the Hermes/llama.rn link step.

**Versioning:**
- App version `3.5.0` / Android `versionCode 7` (`app.json`, `android/app/build.gradle:95`, `package.json`, `src/utils/storage.js:4` `APP_VERSION`). Storage namespace `STORAGE_VERSION = v7.0` (`src/utils/storage.js:5`).
- Platform baseline (Phase 21): Expo SDK `~57.0.0`, RN `0.86.0`, React `19.2.3`, Node `>=22.13` (`package.json`); native pins `llama.rn 0.12.4`, `react-native-android-widget ^0.16.1` (postinstall hardened by `patch-llama-gradle.js`).

## Architectural Constraints

- **Threading:** Single-threaded JS event loop; native work (llama.rn inference, expo-file-system, notifications) is async-bridged. Timer uses `setInterval` in `App.js:677`; AI idle unload on 5-min timer in `src/utils/aiService.js:46`; widget stagger via `setTimeout` in `App.js:582-643`.
- **Native bridge:** Old Architecture only (`newArchEnabled=false`, `hermesEnabled=true`). No Fabric renderers, no TurboModules — `react-native-android-widget` renders through the headless task handler, and llama.rn binds JSI over the Old-Arch CatalystInstance. Do not add New-Arch-only libraries without revisiting `android/gradle.properties:42-60`.
- **Global state:** Module singletons `_llamaContext`/`_initPromise`/`_loadGeneration` in `src/utils/aiService.js:34-40`; timer/widget throttle refs in `App.js:111-140`; `lastPersistedJsonRef`/`tasksHydratedRef` in `src/context/TaskContext.js:73-74`. No global Redux store.
- **Circular imports:** None detected between layers. `App.js` ↔ contexts is parent→child props only; `AppNavigator.js` re-imports `../utils/billingStorage` lazily (`src/navigation/AppNavigator.js:157`) to avoid a static cycle with `BillingContext`.
- **Binder budget:** Widget payloads and save frequency are hard-constrained (slice to 5/8 items, 5 s widget throttle, 15 s save throttle) — see `App.js:558-648`. New widget surfaces must follow the same slice + stagger pattern.
- **Rulebook precedence:** Android constraints > privacy/zero-cloud > deterministic behavior policy > AI proposals > UI prefs (`rulebook/README.md` §2). AI code must never write storage/schedule directly; engines own policy (`rulebook/README.md` §1).
- **Offline-only:** No cloud backend; `syncService.js` is LAN-only, telemetry is opt-in launch events only, `__DEV__`-gated diagnostics (`App.js:226-229`).

## Anti-Patterns

### God-component App shell

**What happens:** `App.js` (1067 lines) owns boot, theme, timer, persistence, sync, reset, widgets, and three modal dialogs alongside the provider tree.
**Why it's wrong:** Any change to timer/sync/theme risks touching boot/persistence; the file is the merge-conflict hotspot and hard to test headlessly.
**Do this instead:** Follow the `TaskContext.js` precedent — extract timer into a `TimerContext`/`useTimer` hook and sync/reset into `src/utils/` callers wired via Settings, leaving `App.js` as pure composition like `src/navigation/AppNavigator.js:173-213`.

### Dual state ownership (props + context mirrors)

**What happens:** `App.js` keeps `tasks`/`birthdays`/`notes`/`billingData` in `useState` and passes them as props while contexts hold the same slices; `AppNavigator.js:74-102` reconciles with context-wins fallbacks.
**Why it's wrong:** Stale-props clobber risk is already documented (`App.js:427-429` W-01 comment, `TaskContext.js:69-71` Phase-18 micro-window); every new domain must remember the merge discipline.
**Do this instead:** Make contexts the sole owners (as billing already is per `App.js:511-513` W-03) and remove the `App.js` mirrors; pass only context hooks down, never parallel props.

## Error Handling

**Strategy:** Local try/catch with graceful degradation to empty/default state; fatal UI crashes caught by boundary; background init failures are logged and swallowed.

**Patterns:**
- Boot/load fallbacks: `App.js:240-244` and `App.js:404-418` reset to empty lists + default theme on failure; `src/context/VaultContext.js:43-50` returns `[]` on filesystem error.
- Fire-and-forget background init: `App.js:214-234` (`backgroundInit`) wraps migration/cache/diagnostics so slow/failed steps never block first paint.
- UI boundary: `src/components/ErrorBoundary.js` wraps the whole tree inside `App.js:846`; confirmation modals surface sync failures (`App.js:791-796`).
- Logging: `src/utils/logger.js` with `logger.debug/info/warn/error`; privacy rule redacts habit/note content (`rulebook/rules/privacy.md`).

## Cross-Cutting Concerns

**Logging:** `src/utils/logger.js` facade over console; `DEBUG_MODE` gate in `src/utils/diagnostics.js`; telemetry opt-in launch events only via `sendTelemetryEvent` (`App.js:205`, `App.js:1004`).
**Validation:** Inline guards (`resolveThemeMode/resolveThemeName` in `App.js:76-77`, `isUserDataKey` in `src/utils/storage.js:8`, `default_inbox` undeletable in `src/utils/taskMutations.js:286`); 4.0 command validation is spec'd (`CommandValidationResult` in `src/commands/types.ts:100`) but not yet implemented.
**Authentication:** None — single-user offline app; vaults are local namespaces, sync is LAN QR-based (`src/components/QRScannerModal.js`, `src/utils/syncService.js`).

---

*Architecture analysis: 2026-10-04*
