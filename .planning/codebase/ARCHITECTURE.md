<!-- refreshed: 2026-10-11 -->
# Architecture

**Analysis Date:** 2026-10-11

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Root Composition (App)                    │
│  `index.js` → `App.js` (boot, global useState, providers)   │
├──────────────────┬──────────────────┬───────────────────────┤
│  Navigation      │   Screens        │  Presentation         │
│  `src/navigation/`│ `src/screens/`  │ `src/components/`     │
│  `AppNavigator.js`│ 9 drawer screens│ 15 shared components  │
│  `CustomDrawerContent.js` │         │ `src/theme/`          │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              State + Pure Domain Engines                     │
│  `src/context/` (5 providers)  `src/behavior/` (7 engines)  │
│  `src/utils/taskMutations.js`  `src/commands/types.ts`      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Persistence / Device Services / Headless                    │
│  `src/utils/storage.js` `src/utils/vaultService.js`         │
│  `src/utils/fileStorage.js` `src/services/notificationService.ts` │
│  `src/utils/aiService.js` (`llama.rn`)                      │
│  `widgets/widget-task-handler.tsx` (headless JS env)        │
│  Stores: AsyncStorage + `expo-file-system` + notifications  │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root entry | Registers app + headless widget handler with Expo | `index.js` |
| App orchestrator | Boot sequence, global `useState`, provider nesting, timer loop, widget push, sync orchestration, dialogs | `App.js` |
| Drawer navigator | 9-screen drawer routing, context-over-props resolution (`effective*`), `TaskEditModal` + `AIAssistant` mounting | `src/navigation/AppNavigator.js` |
| Drawer chrome | Themed drawer content, user/theme controls | `src/navigation/CustomDrawerContent.js` |
| Task state | Sole task mutation path, debounced write-through persistence, foreground re-sync | `src/context/TaskContext.js` |
| Vault/notes state | Active-vault tracking, filesystem note loading | `src/context/VaultContext.js` |
| Habit state | Habit/identity/event/reward store, hydration, recovery + reward evaluation, event emission | `src/context/HabitContext.js` |
| Billing state | Billing transactions/budgets persistence (exclusive writer) | `src/context/BillingContext.js` |
| Birthday state | Birthday CRUD + reminder scheduling | `src/context/BirthdayContext.js` |
| Pure task engine | Framework-agnostic task/list/recurrence/subtask transforms shared by app + widgets | `src/utils/taskMutations.js` |
| Behavior engines | Deterministic habit/cue/recovery/reward/improvement/rule evaluation | `src/behavior/habitEngine.ts`, `src/behavior/cueEngine.ts`, `src/behavior/recoveryEngine.ts`, `src/behavior/rewardEngine.ts`, `src/behavior/improvementEngine.ts`, `src/behavior/ruleEngine.ts` |
| Domain event bus | Typed + wildcard pub/sub, frozen events, 100-event ring buffer | `src/behavior/eventBus.ts` |
| Command contract | AI sandbox command actions/payloads, idempotency keys | `src/commands/types.ts` |
| Notification engine | Channel init, policy-gated dispatch, birthday/billing/due-date scheduling, history | `src/services/notificationService.ts` |
| On-device AI | `llama.rn` model download/verify/load, summarise/extract/parse/rewrite with heuristic fallbacks | `src/utils/aiService.js` |
| AI surface | Floating assistant, command parsing, task/birthday/transaction creation callbacks | `src/components/AIAssistant.js` |
| Notes persistence | Vault-parameterised markdown CRUD over `expo-file-system` | `src/utils/fileStorage.js` |
| Vault config | Vault paths, CRUD, active-vault pointer, legacy migration | `src/utils/vaultService.js` |
| LAN sync | Config validation, ping, bidirectional REST handshake | `src/utils/syncService.js` |
| Headless widgets | Offline widget render + tap actions (`TOGGLE_TASK`, `SWITCH_TAB`) in separate JS env | `widgets/widget-task-handler.tsx`, `widgets/FocusTimerWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/TasksListWidget.tsx` |
| Theming | 5 theme names × 3 modes (`light`/`dark`/`amoled`) + global styles | `src/theme/colors.js`, `src/theme/styles.js` |
| Error containment | Top-level React error boundary around provider tree | `src/components/ErrorBoundary.js` |

## Pattern Overview

**Overall:** Offline-first local monolith — layered React Native (Expo) app with Context-held state, pure deterministic domain engines, and an event-sourced telemetry side-channel.

**Key Characteristics:**
- State lives in 5 nested Context providers; pure functions in `src/behavior/` and `src/utils/taskMutations.js` own all transitions so the headless widget process can reuse them without React.
- Cross-domain communication goes through `eventBus` (`src/behavior/eventBus.ts`), never direct domain-to-domain imports — enforced by the rule in `src/domains/README.md`.
- Deterministic rules are data, not code: `rulebook/machine/*.json` evaluated by `src/behavior/ruleEngine.ts`.
- Persistence is version-keyed AsyncStorage (`kwestup_*_${STORAGE_VERSION}`, currently `v7.0` in `src/utils/storage.js`) plus markdown files on disk (`Notes/Vaults/<vaultId>/`); notes are filesystem-authoritative, everything else is AsyncStorage-authoritative.
- AI is a progressive enhancement: every `llama.rn` call in `src/utils/aiService.js` has a zero-dependency regex/heuristic fallback, so the app works with no model downloaded.

## Layers

**Entry / Root composition:**
- Purpose: Boot, global state initialisation, provider nesting, background wiring (AppState, widgets, diagnostics, update check).
- Location: `index.js`, `App.js`
- Contains: `useState` for tasks/lists/daily/birthdays/notes/timer/theme/user/vaults/billing/telemetry, `initializeApp` + `loadData` + `saveData`/`saveTimerState`, timer `setInterval` loop, throttled `requestWidgetUpdate` effects, `handleExecuteSync`/`handleResetData`.
- Depends on: All contexts, all utils/services below it.
- Used by: Expo runtime (`registerRootComponent`).

**Navigation:**
- Purpose: Drawer routing + dependency resolution between legacy props and contexts.
- Location: `src/navigation/`
- Contains: `AppNavigator.js` (9 `Drawer.Screen` render-prop bindings, `effective*` selectors, `onTaskCreated`/`onBirthdayCreated`/`onTransactionCreated` bridges, global `TaskEditModal` + `AIAssistant`), `CustomDrawerContent.js`.
- Depends on: `src/context/*`, `src/screens/*`, `src/components/AIAssistant.js`, `src/components/TaskEditModal.js`, `src/services/notificationService.ts`.
- Used by: `App.js`.

**Screens (feature surfaces):**
- Purpose: One screen per domain; no cross-screen imports.
- Location: `src/screens/`
- Contains: `DashboardScreen.js`, `DailyTasksScreen.js`, `BirthdaysScreen.js`, `TaskListScreen.js`, `FocusTimerScreen.js`, `NotesScreen.js` (largest at ~2013 lines — vault explorer + editor + AI hooks), `BillingScreen.js`, `SearchScreen.js`, `SettingsScreen.js`.
- Depends on: Context hooks, `src/components/*`, `src/utils/*`, `src/services/notificationService.ts`.
- Used by: `src/navigation/AppNavigator.js`.

**State (Context providers):**
- Purpose: Own one domain's state, hydration, persistence, and side effects (notifications + events).
- Location: `src/context/`
- Contains: `TaskContext.js` (sole task writer, 500 ms debounced read-modify-write, boot-empty guard, `AppState` refresh), `VaultContext.js`, `BillingContext.js`, `BirthdayContext.js`, `HabitContext.js` (own `kwestup_habits_v1`/`kwestup_behavior_events_v1`/`kwestup_identities_v1`/`kwestup_rewards_v1` keys, 400 ms debounce, 500-event FIFO cap).
- Depends on: Pure engines (`src/utils/taskMutations.js`, `src/behavior/*`), `src/services/notificationService.ts`, `src/behavior/eventBus.ts`.
- Used by: Screens via hooks (`useTasks`, `useVaults`, `useBilling`, `useBirthdays`); `AppNavigator.js` resolves `effective*` from these with prop fallbacks.

**Pure domain engines:**
- Purpose: Deterministic, testable, React-free business logic shared between app and headless widgets.
- Location: `src/behavior/`, `src/commands/`, `src/utils/taskMutations.js`
- Contains: `habitEngine.ts` (creation validation, 2-minute minimum, streak/evidence), `ruleEngine.ts` (JSON rule loading, dot-path + operator condition evaluation), `cueEngine.ts`, `recoveryEngine.ts` ("Never Miss Twice" state machine), `rewardEngine.ts`, `improvementEngine.ts` (rolling consistency, automaticity), `eventBus.ts`, `commands/types.ts` (11 `CommandAction`s with discriminated payloads + `idempotencyKey`).
- Depends on: `rulebook/machine/*.json`, `src/utils/dateUtils.js`, `src/utils/logger.js`.
- Used by: Contexts, widgets, tests in `__tests__/unit/`.

**Device services:**
- Purpose: Side-effecting integrations (notifications, LLM, LAN sync, diagnostics, import/export).
- Location: `src/services/`, `src/utils/aiService.js`, `src/utils/syncService.js`, `src/utils/diagnostics.js`, `src/utils/exportService.js`, `src/utils/billingNotifications.js`, `src/utils/notifications.js`
- Contains: Policy-gated notification dispatch (`src/services/notificationService.ts` + `src/services/types.ts`), `llama.rn` lifecycle (`src/utils/aiService.js`), fetch-with-timeout LAN handshake (`src/utils/syncService.js`).
- Depends on: Expo SDK modules, AsyncStorage, filesystem.
- Used by: Contexts, `App.js`, screens.

**Persistence:**
- Purpose: Versioned local storage with migration.
- Location: `src/utils/storage.js`, `src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/billingStorage.js`, `src/utils/vaultImport.js`
- Contains: `APP_VERSION`/`STORAGE_VERSION` constants, `clearAllCaches` (preserves `isUserDataKey`), `migrateUserDataIfNeeded` (highest-legacy-version promotion), vault path helpers (`Notes/Vaults/<vaultId>/`), hashtag extraction.
- Depends on: `@react-native-async-storage/async-storage`, `expo-file-system`.
- Used by: `App.js`, all contexts, widgets.

**Presentation / theme:**
- Purpose: Reusable controls + single theme object plumbed as `currentTheme` prop.
- Location: `src/components/`, `src/theme/`
- Contains: `CustomButton.js`, `CustomTextInput.js`, `CustomCard.js`, `CustomBadge.js`, `CustomDateTimePicker.js`, `CustomSegmentedButtons.js`, `CustomSwitch.js`, `TaskCard.js`, `TaskEditModal.js`, `TimerLockoutOverlay.js`, `LiquidGlassBackground.js`, `LiquidGlassCard.js`, `QRScannerModal.js`, `ErrorBoundary.js`, `AIAssistant.js`; `theme/colors.js` (5 names × 3 modes), `theme/styles.js`.
- Depends on: Theme object only; stateless except `AIAssistant.js` and `ErrorBoundary.js`.
- Used by: Screens, `App.js`, `AppNavigator.js`.

**Headless / native bridge:**
- Purpose: Android home-screen widgets operable with the app killed.
- Location: `widgets/`, `android/`, `app.json` (widget plugin block)
- Contains: 4 widget render components + `widget-task-handler.tsx` (reads AsyncStorage directly, reuses `toggleTask`, emits `WIDGET_ACTION`/`TASK_COMPLETED`/`TASK_UPDATED` into its own bus copy, re-renders via `requestWidgetUpdate`).
- Depends on: `src/utils/storage.js`, `src/utils/taskMutations.js`, `src/utils/dateUtils.js`, `src/behavior/eventBus.ts` — never on contexts or screens.
- Used by: `react-native-android-widget` native host; pushed from `App.js` effects while the app is in the foreground.

## Data Flow

### Primary Request Path

1. Boot — Expo loads entry (`index.js:10`), registers `App` + `widgetTaskHandler`; `App.js:initializeApp` (`App.js:149`) reads version/username/vaults/active-vault/telemetry in parallel, calls `initNotesFolder`, fires vault migration + cache clear in the background, then unblocks UI (`App.js:216`).
2. Hydrate — `App.js:loadData` (`App.js:236`) runs `migrateUserDataIfNeeded`, reads the versioned data blob + timer/theme/widget-tab keys, resets daily-task streaks against `getLocalDateString()`, scans notes from the active vault filesystem (`getAllNotesFromFilesystem`), restores timer with wall-clock elapsed compensation; each Context hydrates its own keys on top (`src/context/HabitContext.js:68`, `src/context/TaskContext.js` effects).
3. Render — `App.js:867` nests `TaskProvider > VaultProvider > BillingProvider > BirthdayProvider > HabitProvider > NavigationContainer > AppNavigator`; `AppNavigator.js:81` resolves `effective*` values (context-first, props fallback) and binds them into the 9 drawer screens.

### Task mutation path (sole-writer pattern)

1. Screen calls a `TaskContext` action, e.g. `toggleTaskComplete` (`src/context/TaskContext.js:196`) or `handleSaveTask` (`src/context/TaskContext.js:295`).
2. The pure engine computes the next state outside the React updater — `toggleTask` / `saveTask` / `deleteTask` in `src/utils/taskMutations.js` (recurrence spawning in `calculateNextRecurrence`).
3. Side effects run outside the setter: `scheduleDueDateReminder`/`cancelNotification` (`src/services/notificationService.ts`) and `eventBus.emit({type: 'TASK_*'})` (`src/behavior/eventBus.ts:144`).
4. State is set, then a 500 ms debounced read-modify-write merges only the task keys back onto the stored blob (`src/context/TaskContext.js:77`) so sibling domains persisted by `App.js:saveData` (`App.js:429`) are never clobbered.
5. Foreground return re-syncs via `refreshTasksFromStorage` (`src/context/TaskContext.js:130`) on `AppState === 'active'`.

### Notes / vault path (filesystem-authoritative)

1. `VaultContext.loadVaultNotes` / `App.js:handleSetActiveVault` (`App.js:733`) persists the active id (`src/utils/vaultService.js`) and rescans with `getAllNotesFromFilesystem` (`src/utils/fileStorage.js:165`).
2. Edits write markdown files (`saveNoteFile`, `src/utils/fileStorage.js:33`) with sanitised folder/title; deletes clean up empty folders; `wipeNotesFilesystem` supports reset + sync overwrite.
3. Hashtags are derived at scan time (`extractHashtags`, `src/utils/fileStorage.js:260`); note `id` is the absolute file path.

### Widget path (separate JS environment)

1. `App.js` pushes widget renders while `active` with 5 s throttle + 250–500 ms staggering to avoid Binder flooding (`App.js:567`).
2. Taps run headlessly in `widgets/widget-task-handler.tsx:77`: read AsyncStorage directly, `toggleTask` from `src/utils/taskMutations.js`, write back immediately, emit `WIDGET_ACTION` + `TASK_COMPLETED`/`TASK_UPDATED` into the headless process's own bus copy, then `requestWidgetUpdate` for `TasksList` (with 600 ms ticking animation), `ImportantTasks`, and `DailyTasks`.
3. On next foreground, `App.js:412` (`loadData`) and `TaskContext.refreshTasksFromStorage` converge on the widget-written storage.

### AI inference path (progressive enhancement)

1. `src/components/AIAssistant.js` invokes `src/utils/aiService.js`: `isModelDownloaded` (fast size-only check) → `loadModel` (coalesced `initLlama`, `n_ctx: 2048`, CPU-only) → `summarizeNote` / `extractTasksFromNote` / `parseGlobalCommand` / `assistWriting`.
2. Every call resets a 5-minute idle timer (`resetIdleTimer`) and unloads on background (`subscribeAppState`, also called from `App.js:422`); unload-while-inflight is guarded by `_loadGeneration`.
3. Any load/inference failure falls back to pure heuristics (`extractTasksFromNoteHeuristic`, `summarizeNoteHeuristic`, keyword command parser) — offline behaviour is preserved with zero native memory.
4. Parsed commands flow back through `AppNavigator` bridges (`onTaskCreated`, `onBirthdayCreated`, `onTransactionCreated`, `src/navigation/AppNavigator.js:120`) into the owning context.

### Notification path (policy-gated)

1. Contexts and `App.js` schedule via `src/services/notificationService.ts` (`scheduleNotification`, `scheduleDueDateReminder`, `scheduleBirthdayReminders`, billing reminders in `src/utils/billingNotifications.js`).
2. One-shot `category === 'behavior'` requests pass the `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` gate (quiet hours `[22:00, 08:00)`, cap 3/day, 90-min gap, 30-min dedup, opt-out kill-switch in `src/services/types.ts:90`); recurring native triggers are exempt from cap/gap/dedup but still get quiet-hours shifting + `exempt` history marking.
3. Channels are created at navigator mount (`initNotificationChannels`, `AppNavigator.js:74`); history is recorded per dispatch.

### LAN sync path

1. `SettingsScreen` collects `{ip, port, token}` → `App.js:handleExecuteSync` (`App.js:740`) → `performSync` (`src/utils/syncService.js`) with `fetchWithTimeout` (4 s) and strict config validation (`validateSyncConfig`).
2. On success: wipe active-vault filesystem, rewrite returned markdown files, cancel + reschedule all birthday reminders, overwrite React state, stamp `lastSynced`.

**State Management:**
- Local `useState` in `App.js` (timer, theme, user, sync status) + 5 domain Contexts; no Redux/MobX/Zustand. Persistence is eager debounced write-through per domain, converged on foreground via storage re-reads. Telemetry/behavioral state flows one-way through the frozen-event bus into the bounded `HabitContext` event log.

## Key Abstractions

**Domain Context (state owner):**
- Purpose: The only writer for its domain's storage keys, exposing state + actions via hook.
- Examples: `src/context/TaskContext.js`, `src/context/HabitContext.js`, `src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`
- Pattern: `createContext` + provider with `initial*` props for boot/sync injection, `useRef`-debounced persistence, `eventBus.emit` on every mutation, `useX` hook for consumers.

**Pure mutation engine:**
- Purpose: React-free `(state, args) → {updated, result}` transforms reusable from any JS environment.
- Examples: `src/utils/taskMutations.js`, `src/behavior/habitEngine.ts`, `src/behavior/recoveryEngine.ts`, `src/behavior/rewardEngine.ts`, `src/behavior/improvementEngine.ts`
- Pattern: No imports from contexts/screens/services (only `dateUtils`, `logger`, rule JSON); deterministic with injectable `now`/`todayDate` options for tests.

**DomainEventBus:**
- Purpose: Decoupled cross-domain telemetry and reactive hooks without import cycles.
- Examples: `src/behavior/eventBus.ts`, `src/behavior/types.ts` (`BehaviorEvent`, `DomainEventInput`, `DomainEventListener`)
- Pattern: Singleton `eventBus`; `subscribe(type)` + `subscribeAll` with idempotent unsubscribers; `emit` deep-clones + deep-freezes, buffers the last 100 events FIFO, isolates listener faults (sync throws and async rejections only hit `logger.error`); `useDomainEvent(type, listener)` hook for declarative subscription.

**Machine-rule evaluation:**
- Purpose: Behaviour policy as versioned JSON data evaluated deterministically.
- Examples: `src/behavior/ruleEngine.ts`, `rulebook/machine/habitRules.json`, `rulebook/machine/recoveryRules.json`, `rulebook/machine/rewardRules.json`, `rulebook/machine/rules.json`, `rulebook/machine/interventionRules.json`
- Pattern: `loadMachineRules(category)` → `evaluateRules(rules, context)` with dot-path lookup (`getNestedValue`), operator strings (`>=3`), array membership, first-match priority ordering; engines return `{valid, rulesApplied}` / `{rejected}` alongside results.

**Vault:**
- Purpose: Isolates a notes namespace (config in AsyncStorage, content on disk).
- Examples: `src/utils/vaultService.js`, `src/utils/fileStorage.js`
- Pattern: `getVaultPath(vaultId)` → `<documentDirectory>Notes/Vaults/<vaultId>/`; active pointer `kwestup_activeVault_<version>`; all file ops take explicit `vaultId`, with `*FromActiveVault` dynamic-import wrappers for unmigrated callers.

**Notification dispatch contract:**
- Purpose: Single shape for every scheduled notification with policy metadata.
- Examples: `src/services/types.ts` (`NotificationDispatchRequest`, `BehavioralNotificationPolicy`, `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY`), `src/services/notificationService.ts`
- Pattern: `{category, payloadKey, recurrence, triggerDate (local wall-clock ISO), channelId, title, body}` → policy evaluation (`{allowed, adjustedTriggerDate, reason}`) → schedule + history entry.

**Theme object:**
- Purpose: One `currentTheme` prop drives every styled surface.
- Examples: `src/theme/colors.js` (`themes[name][mode]`), `src/theme/styles.js`
- Pattern: `resolveThemeMode`/`resolveThemeName` whitelists in `App.js:72` with `dribbble.light` fallback; screens/components never import palettes directly.

## Entry Points

**Expo app root:**
- Location: `index.js`
- Triggers: Expo runtime launch (`expo start`, `expo run:android/ios`, EAS build).
- Responsibilities: `registerRootComponent(App)` + `registerWidgetTaskHandler(widgetTaskHandler)` — the only place app and headless entry are bound together.

**App component:**
- Location: `App.js`
- Triggers: Root render after native splash; `AppState` foreground transitions.
- Responsibilities: Font loading, two-phase init (blocking essentials, fire-and-forget migration/diagnostics), data load/save, timer engine, widget push, confirmation/name/telemetry dialogs, provider nesting, global overlays (`TimerLockoutOverlay`, confetti, `ErrorBoundary`, `LiquidGlassBackground`).

**Drawer navigator:**
- Location: `src/navigation/AppNavigator.js`
- Triggers: Inside `NavigationContainer` once providers are mounted.
- Responsibilities: Route table (initial `Dashboard`), notification channel init + permission request, context/prop resolution, global modal + AI assistant mounting.

**Headless widget handler:**
- Location: `widgets/widget-task-handler.tsx`
- Triggers: Native widget host events (`WIDGET_ADDED`, `WIDGET_UPDATE`, `WIDGET_RESIZED`, `WIDGET_CLICK` with `SWITCH_TAB`/`TOGGLE_TASK`/`COMPLETE_TASK`).
- Responsibilities: Storage-direct read/mutate/write + widget re-render without waking the app UI.

**Native projects:**
- Location: `android/` (`app/build.gradle`, manifests), `app.json` (Expo config + 4 widget declarations: `FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList`)
- Triggers: `expo run:android` / `expo prebuild` / EAS cloud builds (`eas.json`).
- Responsibilities: Package id `com.omprakashp06.kwestupmobile`, camera/build-property permissions, widget host registration, `llama.rn` native module linkage (patched postinstall by `patch-llama-gradle.js`).

## Architectural Constraints

- **Threading:** Single-threaded JS per environment (app + headless widget are isolated JS VMs sharing nothing but AsyncStorage). Native inference runs in `llama.rn` (`src/utils/aiService.js`) behind a coalescing `_initPromise` lock with generation-guarded unload; idle unload at 5 min and forced unload on background/inactive. Timer is a 1 s `setInterval` in `App.js:686` — no workers, no background daemon (a deliberate decision documented in `src/services/notificationService.ts:13` to preserve Feb-29/advance reminders without waking JS).
- **Global state:** `App.js` module holds ~20 `useState` domains plus throttle refs (`lastSaveTimeRef`, `lastWidgetUpdateTimeRef`); module singletons: `eventBus` (`src/behavior/eventBus.ts:272`), `_llamaContext`/`_initPromise`/`_loadGeneration` (`src/utils/aiService.js:34`), `eventCounter`. Widget writes and app writes converge only via AsyncStorage re-reads — no shared memory.
- **Circular imports:** `src/utils/fileStorage.js` statically imports `getVaultPath` from `src/utils/vaultService.js` but reaches back for the active-vault id only through dynamic `await import("./vaultService")` in the `*FromActiveVault` wrappers (`src/utils/fileStorage.js:271`) — keep this one-way; never add a static `fileStorage` import inside `vaultService.js`. `AppNavigator.js:164` likewise lazy-imports `billingStorage` inside the transaction fallback.
- **Storage versioning:** Every AsyncStorage key is suffixed (`_v7.0` app blob, `_v1` habit/notification keys). New persisted fields must go through `migrateUserDataIfNeeded` (`src/utils/storage.js:74`) and `isUserDataKey` (`src/utils/storage.js:8`) or version bumps will orphan them and `clearAllCaches` may delete them.
- **Binder budget (Android):** Widget payloads are sliced (top-5 important, top-8 sorted tasks), updates throttled (5 s) and staggered (250–500 ms), main saves throttled (15 s), timer state kept in a separate small key — see `App.js:429`, `App.js:567`. Do not push full collections to widgets or merge timer state back into the main blob.
- **Domain isolation:** Per `src/domains/README.md`, no domain imports another domain's internals; cross-domain calls go through `eventBus` event types in `src/behavior/types.ts`. `src/domains/` itself is still a placeholder (README only) — new 4.0 domains must be created there, not inside `src/behavior/`.
- **Local wall-clock dates:** All stored/trigger dates are device-local `YYYY-MM-DD` / ISO wall-clock strings via `src/utils/dateUtils.js` (`getLocalDateString`, `getTomorrowLocalDateString`, `parseLocalDate`); never interpret them as UTC instants (see `src/services/types.ts:33`).

## Anti-Patterns

### Prop-drilling alongside contexts (transitional duplication)

**What happens:** `App.js:886` passes ~30 props (`notes`, `setNotes`, `birthdays`, `tasks`, `billingData`, vault fields…) into `AppNavigator`, which re-resolves each one against its context (`effectiveTasks = taskCtx?.tasks ?? []`, `src/navigation/AppNavigator.js:81`) before binding screens.
**Why it's wrong:** Two sources of truth per domain invite stale-prop bugs; every new screen prop must be threaded through three layers.
**Do this instead:** Consume the owning hook directly in the screen (`useTasks()` in `src/context/TaskContext.js:419`, `useVaults()`, `useBilling()`, `useBirthdays()`), following the `C-02` cleanup that already removed duplicated task mutations from `App.js:725`. Leave `AppNavigator`'s `effective*` fallbacks as the migration shim, not the pattern to extend.

### Splitting persistence across App and contexts

**What happens:** `App.js:saveData` (`App.js:429`) persists birthdays/notes/theme while `TaskContext` (`src/context/TaskContext.js:77`) and `HabitContext` persist their own keys on independent debounce timers, coordinated only by read-modify-write merges.
**Why it's wrong:** Independent writers on one AsyncStorage blob create lost-update windows (documented residual risk: a mutation <500 ms before a foreground refresh can be overwritten); the merge code is subtle and must be replicated per writer.
**Do this instead:** Keep the current direction — one exclusive writer per key range (`TaskContext` owns `tasks/taskLists/dailyTasks`, `BillingContext` owns billing per the `W-03` note at `App.js:520`) — and never add a second writer for an owned key; new domains get their own key + context following `src/context/HabitContext.js`.

## Error Handling

**Strategy:** Contain at the boundary, degrade to offline heuristics, log centrally, never crash the JS runtime.

**Patterns:**
- `ErrorBoundary` (`src/components/ErrorBoundary.js`) wraps the whole provider tree in `App.js:865`; `isLoading`/font-gate splash covers boot failures (`App.js:848`).
- All storage/filesystem/notification/AI calls are `try/catch` with typed fallbacks: empty arrays, `""` content, heuristic AI output, reschedule-next-launch for birthdays (`App.js:370`).
- `eventBus.emit` (`src/behavior/eventBus.ts:144`) snapshots listener sets and swallows both sync throws and async rejections into `logger.error` so one bad subscriber never breaks dispatch.
- `llama.rn` lifecycle is fail-closed: size + SHA-256 integrity (`verifyModelIntegrity`, `src/utils/aiService.js:206`) deletes corrupt models; `loadModel` maps OOM/GWML errors to user-readable messages; unload-while-inflight is generation-guarded.
- Sync uses `fetchWithTimeout` (4 s abort, `src/utils/syncService.js:9`) with strict `validateSyncConfig` rejecting path injection/malformed hosts; failures surface through the confirmation modal, never silently.

## Cross-Cutting Concerns

**Logging:** Central `logger` (`src/utils/logger.js`) with `debug/info/warn/error` levels used by every layer (`App`, contexts, engines, services, widgets); release builds strip `console` via `babel-plugin-transform-remove-console` (`package.json`). Log through `logger`, never raw `console` (the remaining `console.warn` calls in `AppNavigator.js:125` are migration-shim warnings, not the pattern).
**Validation:** Pure validators at trust boundaries — `validateSyncConfig` (`src/utils/syncService.js:35`), `validateHabitCreation`/`compileHabitPlan` (`src/behavior/habitEngine.ts`), command payload typing (`src/commands/types.ts`), `resolveThemeMode`/`resolveThemeName` whitelists (`App.js:72`), notification policy evaluation (`src/services/notificationService.ts`).
**Authentication:** None — single-user offline app. Identity is a local `userName` string (`kwestup_userName_*`); sync uses a bearer `token` field validated for non-emptiness only. No remote auth flow exists.

---

*Architecture analysis: 2026-10-11*
