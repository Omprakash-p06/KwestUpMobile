<!-- refreshed: 2026-10-12 -->
# Architecture

**Analysis Date:** 2026-10-12

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Entry / Composition Root                  │
│         `index.js` → `App.js` (providers, boot, dialogs)     │
├──────────────────┬──────────────────┬───────────────────────┤
│  Navigation      │  Screens         │  Reusable UI           │
│  `src/navigation/`│ `src/screens/`  │  `src/components/`    │
│  Drawer (9 routes)│ 9 feature screens│  16 components        │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 State / Domain Layer                         │
│  `src/context/` (Task, Vault, Habit, Billing, Birthday)     │
│  `src/behavior/` (pure engines + `eventBus.ts`)              │
│  `src/commands/` (gateway + executor + validators)           │
│  `src/ai/` (intent → behaviorCompiler → weeklyReview)       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│           Services + Persistence + Platform                  │
│  `src/services/notificationService.ts` (policy dispatch)    │
│  `src/utils/` (storage, fileStorage, vaultService,          │
│   taskMutations, aiService, syncService, diagnostics)        │
│  Stores: AsyncStorage (JSON blobs) + expo-file-system       │
│   (`Notes/Vaults/<id>/`) + expo-notifications + widgets/    │
│   (`widgets/` + `widgets/widget-task-handler.tsx`)          │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Composition root | Boot sequence, theme resolution, global state, timer loop, persistence orchestration, widget push, dialogs/overlays | `App.js` |
| JS entry | Registers root component + headless widget task handler | `index.js` |
| Navigator | Drawer with 9 routes; resolves context-vs-prop sources (`effectiveX = ctx ?? props`); hosts `TaskEditModal`, `WeeklyReviewModal`, `AIAssistant` | `src/navigation/AppNavigator.js` |
| Drawer chrome | Custom drawer content, user/theme display | `src/navigation/CustomDrawerContent.js` |
| Task state | Owns tasks/taskLists/dailyTasks; eager write-through persistence; notification scheduling side-effects; emits `TASK_*` events | `src/context/TaskContext.js` |
| Vault/notes state | Owns vault list, active vault, notes mirror of filesystem; vault switching + reload | `src/context/VaultContext.js` |
| Habit state | Owns habits/identities/behaviorEvents/rewards; isolated `kwestup_*_v1` keys; recovery state machine; debounced persistence | `src/context/HabitContext.js` |
| Billing state | Owns transactions/budgets/recurringBills; exclusive writer (W-03) | `src/context/BillingContext.js` |
| Birthday state | Owns birthdays + reminder (re)scheduling | `src/context/BirthdayContext.js` |
| Domain event bus | Singleton typed+wildcard pub/sub, frozen immutable events, 100-event ring buffer, `useDomainEvent` hook | `src/behavior/eventBus.ts` |
| Behavior engines | Pure functions: habit lifecycle, cues, recovery ("Never Miss Twice"), rewards, interventions, improvement metrics, rule evaluation | `src/behavior/habitEngine.ts`, `src/behavior/cueEngine.ts`, `src/behavior/recoveryEngine.ts`, `src/behavior/rewardEngine.ts`, `src/behavior/interventionEngine.ts`, `src/behavior/improvementEngine.ts`, `src/behavior/ruleEngine.ts` |
| Command gateway | Type-checked dispatch for UI/widget/AI; validator → executor → habit handlers; AI sandbox for untrusted output | `src/commands/useCommandGateway.ts`, `src/commands/commandExecutor.ts`, `src/commands/commandValidator.ts`, `src/commands/habitCommandHandlers.ts`, `src/commands/aiSandbox.ts` |
| AI subsystem | On-device intent parsing, rule-packet retrieval, deterministic behavior compilation, friction analysis, weekly review | `src/ai/index.ts`, `src/ai/intentParser.ts`, `src/ai/heuristicParser.ts`, `src/ai/rulePacketRetriever.ts`, `src/ai/behaviorCompiler.ts`, `src/ai/frictionAnalyzer.ts`, `src/ai/weeklyReviewEngine.ts` |
| Notification service | Policy-gated dispatch (quiet hours, 3/day cap, 90-min gap, 30-min dedup, opt-out); 5 Android channels; recurring-exempt rule; atomic history logging | `src/services/notificationService.ts` |
| Pure task engine | Framework-agnostic mutations shared by app + headless widget (toggle/save/delete/recurrence/subtask/list ops) | `src/utils/taskMutations.js` |
| Notes filesystem | Vault-parameterized markdown CRUD (`saveNoteFile`, `readNoteFile`, `getAllNotesFromFilesystem`, `wipeNotesFilesystem`) + active-vault wrappers | `src/utils/fileStorage.js` |
| Vault service | Vault CRUD, active-vault tracking, `Notes/` → `Notes/Vaults/default/` one-time migration | `src/utils/vaultService.js` |
| Storage keys/migration | `APP_VERSION`, `STORAGE_VERSION=v7.0`, `isUserDataKey`, cache clear, cross-version `migrateUserDataIfNeeded` | `src/utils/storage.js` |
| On-device LLM | `llama.rn` Qwen2.5-0.5B lifecycle (load/unload, SHA-256 verify, idle 5-min unload, AppState auto-unload) | `src/utils/aiService.js` |
| LAN sync | `validateSyncConfig` → ping → `POST /sync` → `validateSyncPayload`; caller applies result | `src/utils/syncService.js` |
| Theming | 5 theme names × 3 modes (`light`/`dark`/`amoled`); resolved with fallback to `dribbble.light` | `src/theme/colors.js`, `src/theme/styles.js` |
| Headless widgets | 5 Android widgets + task handler (click actions, re-render, tab state) running in separate JS env | `widgets/widget-task-handler.tsx`, `widgets/FocusTimerWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/TasksListWidget.tsx`, `widgets/HabitWidget.tsx` |

## Pattern Overview

**Overall:** Offline-first monolithic Expo/React-Native app with layered Context + pure-engine domain model, event-sourced behavior telemetry, and a headless-widget companion runtime.

**Key Characteristics:**
- Single `App.js` composition root owns boot, theme, timer, persistence orchestration, and all global dialogs; feature state is delegated to five stacked Context providers (`TaskProvider` → `VaultProvider` → `BillingProvider` → `BirthdayProvider` → `HabitProvider` in `App.js:896-913`).
- Domain logic is split into **pure, testable engines** (`src/behavior/*.ts`, `src/utils/taskMutations.js`, `src/ai/*.ts`) with React/Context as a thin stateful shell that adds persistence, notifications, and `eventBus` telemetry.
- Cross-cutting telemetry uses a singleton immutable `eventBus` (`src/behavior/eventBus.ts`); producers (`TaskContext`, `App.js` focus timer, widget handler) emit `TASK_*` / `HABIT_*` / `WIDGET_ACTION` / `FOCUS_COMPLETED` events consumed by behavior/intervention logic.
- Persistence is dual-backend: small structured domains in AsyncStorage JSON blobs, large user content (notes) as markdown files under `Notes/Vaults/<vaultId>/` via `expo-file-system`.

## Layers

**Presentation (screens + components):**
- Purpose: Render one feature per route; dumb reusable UI primitives.
- Location: `src/screens/`, `src/components/`
- Contains: 9 screens (`DashboardScreen`, `DailyTasksScreen`, `BirthdaysScreen`, `TaskListScreen`, `NotesScreen`, `FocusTimerScreen`, `BillingScreen`, `SettingsScreen`, `SearchScreen`), 16 components (`TaskCard`, `TaskEditModal`, `AIAssistant`, `WeeklyReviewModal`, `TimerLockoutOverlay`, `QRScannerModal`, `LiquidGlassBackground`, etc.).
- Depends on: `src/context/*` hooks, `src/theme/*`, `src/utils/dateUtils.js`, `src/services/notificationService.ts`.
- Used by: `src/navigation/AppNavigator.js` route render functions.

**Navigation:**
- Purpose: Drawer routing + shared-modal hosting + context/prop resolution.
- Location: `src/navigation/`
- Contains: `AppNavigator.js` (9 `Drawer.Screen` entries, `initialRouteName="Dashboard"`), `CustomDrawerContent.js`.
- Depends on: All contexts, `src/services/notificationService.ts` (`initNotificationChannels`, `requestNotificationPermissions` at `AppNavigator.js:76-79`).
- Used by: `App.js` inside `NavigationContainer`.

**State / domain:**
- Purpose: Authoritative in-memory state per domain with persistence + side-effects.
- Location: `src/context/`, `src/behavior/`, `src/commands/`, `src/ai/`
- Contains: 5 providers, 7 behavior engines + `eventBus.ts` + `types.ts`, 6 command files, 7 AI files.
- Depends on: `src/utils/*` engines, `src/services/notificationService.ts`, AsyncStorage.
- Used by: Screens, `App.js`, `widgets/widget-task-handler.tsx` (pure engines only, headless).

**Services / platform:**
- Purpose: OS integration (notifications, filesystem, LLM, widgets, sync, diagnostics).
- Location: `src/services/`, `src/utils/`, `widgets/`
- Contains: Notification policy engine, vault/file storage, AI model manager, sync client, export/diagnostics/loggers.
- Depends on: Expo SDK (`expo-notifications`, `expo-file-system`, `expo-font`, `expo-haptics`), `llama.rn`, `react-native-android-widget`, AsyncStorage.
- Used by: Contexts, `App.js` effects, headless widget handler.

## Data Flow

### Primary Request Path

1. Boot — `index.js:10` registers root + widget handler; `App.js:178-256` runs `initializeApp` (reads `kwestup_userName_*`, vaults, active vault, telemetry opt-in; `initNotesFolder`; fire-and-forget `migrateToVaultSystem` + cache clear + dev diagnostics) then sets `isInitialized` (`App.js:245-246`).
2. Hydration — `App.js:265-434` `loadData` runs `migrateUserDataIfNeeded`, reads `kwestup_data_v7.0` + timer/theme keys, resets daily-task streaks by local date, loads notes from filesystem via `getAllNotesFromFilesystem(activeId)` (`App.js:333`), reschedules birthday reminders; each Context also hydrates its own keys and syncs from `initial*` props.
3. Interaction — Screen calls Context action (e.g. `taskCtx.handleSaveTask` in `AppNavigator.js:122-128`); Context computes via pure engine (`saveTask(tasks, ...)` in `src/utils/taskMutations.js`), updates state, schedules/cancels notifications, emits `eventBus` event, and persists via debounced read-modify-write merge (`TaskContext.js:77-127`).
4. Response/side-effects — React re-renders screens; `App.js` throttled effects push widget updates (`requestWidgetUpdate` in `App.js:596-686`), persist sibling domains (`App.js:458-496`), and reschedule notifications; `HabitWidgetSync` (`App.js:77-102`) pushes behavior touchpoints.

### Task Mutation Flow (authoritative path)

1. UI or AI calls `TaskContext.handleSaveTask / toggleTaskComplete / deleteTask` (`src/context/TaskContext.js:196-344`).
2. Pure computation in `src/utils/taskMutations.js` (`toggleTask`, `saveTask`, `calculateNextRecurrence`) produces `{ updatedTasks, spawnedTask/savedTask }` with no I/O.
3. Context sets state, schedules `scheduleDueDateReminder` / `cancelNotification` outside updaters (WR-01/WR-02 comments at `TaskContext.js:195,317`), emits `TASK_CREATED/UPDATED/COMPLETED/DELETED` on `eventBus`.
4. Debounced (500 ms) writer merges `{ tasks, taskLists, dailyTasks }` onto the stored `kwestup_data_v7.0` blob so sibling domains are never clobbered (`TaskContext.js:77-127`); boot guard skips wiping storage with empty in-memory state.

### Notes / Vault Flow

1. `VaultContext.loadVaultNotes` / `App.js:762-767 handleSetActiveVault` persists active ID (`src/utils/vaultService.js:setActiveVaultId`) and calls `getAllNotesFromFilesystem(vaultId)` (`src/utils/fileStorage.js:165-231`) which scans `Notes/Vaults/<id>/` one level deep, reads `.md` files, extracts hashtags.
2. Writes go through `saveNoteFile(vaultId, folder, title, content)` with filename sanitization (`src/utils/fileStorage.js:33-61`); deletes clean up empty subfolders. Active-vault wrappers (`saveNoteToActiveVault`, etc. at `src/utils/fileStorage.js:271-299`) dynamically import `vaultService` to avoid a static import cycle.
3. Sync (`App.js:769-847 handleExecuteSync`) wipes the active vault filesystem, rewrites server-returned markdown files, then reloads state from disk.

### Habit / Behavior Event Flow

1. `HabitContext` hydrates four isolated keys (`HABITS_STORAGE_KEY`, `BEHAVIOR_EVENTS_STORAGE_KEY`, `IDENTITIES_STORAGE_KEY`, `REWARDS_STORAGE_KEY` in `src/context/HabitContext.js:35-39`) and exposes habit ops.
2. Mutations run pure engines (`completeHabit` in `src/behavior/habitEngine.ts`, recovery in `src/behavior/recoveryEngine.ts`, rewards in `src/behavior/rewardEngine.ts`), append bounded (500) behavior events, persist with debounce, and emit `HABIT_COMPLETED / HABIT_MISSED / RECOVERY_STARTED` on `eventBus`.
3. `selectWidgetTouchpoint(habits)` (`src/behavior/interventionEngine.ts`) picks recovery → today-due → next-action → standby for `HabitWidget`; notification dispatch for behavior cues is policy-gated in `src/services/notificationService.ts:233-321`.

### Headless Widget Flow (separate JS environment)

1. OS invokes `widgetTaskHandler` (`widgets/widget-task-handler.tsx:90`) for `WIDGET_ADDED/UPDATE/RESIZED/CLICK`.
2. Handler reads AsyncStorage directly (`kwestup_data_v7.0`, timer key, per-widget tab key, habit keys), reuses the **same pure engines** (`toggleTask` from `src/utils/taskMutations.js`, `completeHabit` from `src/behavior/habitEngine.ts`, `selectWidgetTouchpoint`, `evaluateRewards`, `handleRecoveryCompletion`).
3. Writes back to AsyncStorage immediately to shrink the lost-update window, emits `WIDGET_ACTION` / `TASK_COMPLETED` on its **local** `eventBus` copy (cross-process sync is via storage, not memory — see WR-07 note at `widgets/widget-task-handler.tsx:27-29`), then re-renders sibling widgets via `safeRequestWidgetUpdate`.
4. Foreground `TaskContext.refreshTasksFromStorage` (`src/context/TaskContext.js:130-172`) and `App.js` foreground reload pick up widget writes on next `AppState: active`.

### AI / Command Flow

1. `AIAssistant` (`src/components/AIAssistant.js`, mounted in `AppNavigator.js:385-403`) and note content feed `src/ai/intentParser.ts` / `heuristicParser.ts` → `rulePacketRetriever.ts` → `behaviorCompiler.ts` (deterministic plan) with `frictionAnalyzer.ts` and `weeklyReviewEngine.ts` for reviews.
2. `useCommandGateway` (`src/commands/useCommandGateway.ts`) registers habit handlers against `HabitContext`, then `commandValidator.ts` → `commandExecutor.ts` → `habitCommandHandlers.ts`; untrusted AI output is fenced through `aiSandbox.ts` (`dispatchAiCommand`).
3. On-device inference itself lives in `src/utils/aiService.js` (`llama.rn` context, `MODEL_PATH` under `documentDirectory/models/`, SHA-256/size verification, 5-min idle unload, AppState auto-unload at `aiService.js:46-114`).

**State Management:**
- Per-domain React Context is authoritative in-memory; AsyncStorage (JSON blobs) + `expo-file-system` (notes markdown + LLM GGUF) are the durable layer. No Redux/MobX/Zustand. Cross-domain communication is via `eventBus` telemetry events + storage reads, not direct context imports. `App.js` retains legacy top-level mirrors of birthdays/notes/theme/timer (persisted with merge-on-write) while `TaskContext`/`BillingContext` are the exclusive writers of their keys.

## Key Abstractions

**Context Provider (stateful shell + pure engine):**
- Purpose: Own one domain's state, persistence, OS side-effects, and telemetry.
- Examples: `src/context/TaskContext.js`, `src/context/HabitContext.js`, `src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`
- Pattern: `useState` + `useCallback` actions → pure engine call → `setState` → notification schedule → `eventBus.emit` → debounced AsyncStorage merge. Consumers use `useTasks()` / `useHabits()` / `useVaults()` / `useBilling()` / `useBirthdays()` hooks.

**Pure mutation engine:**
- Purpose: Deterministic, framework-free transformations shared between foreground and headless runtimes.
- Examples: `src/utils/taskMutations.js`, `src/behavior/habitEngine.ts`, `src/behavior/recoveryEngine.ts`, `src/behavior/rewardEngine.ts`
- Pattern: `(currentState, args, { now, todayDate }) => ({ updatedX, resultMeta })`; injectable clock/date options make them unit-testable without mocks.

**Immutable domain event (`eventBus`):**
- Purpose: Decoupled telemetry/behavior signal across app and widget processes.
- Examples: `src/behavior/eventBus.ts`, `src/behavior/types.ts` (`BehaviorEvent`, `DomainEventType` union of `TASK_*`, `HABIT_*`, `BILL_*`, `BIRTHDAY_*`, `FOCUS_*`, `WIDGET_ACTION`, `COMMAND_*`)
- Pattern: `eventBus.emit({ type, entityId, source, payload })` → deep-cloned + deep-frozen event → typed + wildcard listeners with error isolation; 100-event in-memory ring buffer (`MAX_EVENT_BUFFER_SIZE`), never persisted without redaction (IN-02 note at `eventBus.ts:162`).

**Policy-gated notification request:**
- Purpose: Single choke point for all OS notification scheduling with behavioral throttling.
- Examples: `src/services/notificationService.ts` (`scheduleNotification`, `evaluateNotificationPolicy`, `ANDROID_NOTIFICATION_CHANNELS`), `src/services/types.ts`
- Pattern: `NotificationDispatchRequest { category, payloadKey, recurrence, channelId, triggerDate, title, body }` → pure `evaluateNotificationPolicy` (quiet-hours shift, daily-cap 3, 90-min gap, 30-min dedup, opt-out; recurring/non-behavior exempt) → `Notifications.scheduleNotificationAsync` → history record only on native success.

**Vault-parameterized file store:**
- Purpose: Multi-vault markdown notes on device filesystem.
- Examples: `src/utils/vaultService.js` (`getVaultPath`, `createVault`, `migrateToVaultSystem`), `src/utils/fileStorage.js`
- Pattern: Every file op takes explicit `vaultId`; path is `documentDirectory/Notes/Vaults/<vaultId>/<Folder>/<Title>.md`; config (vault list, active ID) lives in AsyncStorage.

**Command (validated dispatch):**
- Purpose: Safe mutation entry for UI, widgets, and AI with a uniform envelope.
- Examples: `src/commands/types.ts`, `src/commands/commandValidator.ts`, `src/commands/commandExecutor.ts`, `src/commands/useCommandGateway.ts`
- Pattern: `dispatchCommand(action, payload, { confirmed, actor, idempotencyKey })` → validate → execute → emit `COMMAND_EXECUTED/FAILED`; AI output goes through `dispatchAiCommand` sandbox first.

## Entry Points

**Expo root (`index.js`):**
- Location: `index.js:1-11`
- Triggers: Expo/Native runtime launch; Android widget host for headless actions.
- Responsibilities: `registerRootComponent(App)`; `registerWidgetTaskHandler(widgetTaskHandler)`.

**App composition root (`App.js`):**
- Location: `App.js:104-1116` (`const App = () => {...}`, `export default App`)
- Triggers: Mounted by `index.js`; `AppState` foreground transitions; timer tick.
- Responsibilities: Font loading; `initializeApp`/`loadData` boot; theme resolution (`resolveThemeMode/Name` at `App.js:74-75`); provider stacking; timer interval + lockout overlay; throttled persistence; staggered Android widget pushes; confirmation/name/telemetry modals; sync + reset handlers.

**Headless widget handler:**
- Location: `widgets/widget-task-handler.tsx:90`
- Triggers: OS events `WIDGET_ADDED`, `WIDGET_UPDATE`, `WIDGET_RESIZED`, `WIDGET_CLICK` (with `clickAction` `SWITCH_TAB` / `TOGGLE_TASK` / `COMPLETE_TASK` / `COMPLETE_HABIT` / `START_HABIT_ACTION`).
- Responsibilities: Storage-direct reads/writes with pure engines; tab persistence; sibling widget re-render; local `eventBus` telemetry.

**Notification receivers:**
- Location: `src/navigation/AppNavigator.js:76-79` (`initNotificationChannels`, `requestNotificationPermissions` on mount); schedule sites in `TaskContext.js`, `BirthdayContext.js`, `src/utils/billingNotifications.js`, `App.js:732-740` (focus-complete).
- Triggers: OS notification delivery / user scheduling actions.
- Responsibilities: Channel setup, permission prompts, due-date/birthday/bill/focus/behavior reminder scheduling and cancellation.

**AI lifecycle:**
- Location: `src/utils/aiService.js:84-114` (`subscribeAppState`, module-load auto-register); consumed in `App.js:449-456`.
- Triggers: App background/inactive; 5-minute inference idle timeout.
- Responsibilities: Release native `llama.rn` context to free memory; guard against stale-generation init races (`_loadGeneration`).

## Architectural Constraints

- **Threading:** Single React-Native JS thread for foreground; headless widget handler runs in a **separate JS environment** on Android — no shared memory with the app. Cross-runtime coordination is AsyncStorage-only (`widgets/widget-task-handler.tsx:27-29`). Timer ticks via `setInterval` in `App.js:715-752`; widget pushes are throttled (5 s) and staggered (250–500 ms) to avoid Binder flooding (`App.js:596-686`).
- **Global state:** Module-level singletons: `eventBus` (`src/behavior/eventBus.ts:272`), `_llamaContext`/`_initPromise`/`_loadGeneration` + AppState subscription (`src/utils/aiService.js:34-40`), `lastSaveTimeRef`/`lastWidgetUpdateTimeRef`/`birthdaysRef` throttling refs in `App.js:161-166`. Persisted globals are versioned AsyncStorage keys (`kwestup_*`), never bare globals.
- **Circular imports:** Known `fileStorage.js` ↔ `vaultService.js` cycle is broken by **dynamic `import()`** inside active-vault wrappers (`src/utils/fileStorage.js:271-299`) so callers without an explicit `vaultId` resolve the active vault lazily.
- **Storage-write discipline:** `kwestup_data_v7.0` is a shared blob across domains; every writer must use read-modify-write merge, never blind overwrite. `TaskContext` (tasks/taskLists/dailyTasks) and `BillingContext` (billing) are exclusive writers of their keys (W-01/W-03); `App.js` merges only birthdays/notes/theme/userName/lastSynced. Residual <500 ms foreground-refresh race is documented in `TaskContext.js:70-72`.
- **Effect ordering:** `App.js` foreground-reload effect must stay below the `loadData` declaration or the `[loadData]` dep array throws a TDZ ReferenceError on first render (CR-01 note at `App.js:436-440`).

## Anti-Patterns

### God-component composition root

**What happens:** `App.js` (1118 lines) owns boot, theme resolution, timer loop, all persistence orchestration, widget fan-out, sync/reset handlers, and four global modals in one component.
**Why it's wrong:** Every domain change touches the highest-blast-radius file; effects interact through shared refs (save/widget throttles); hard to test boot vs. timer vs. sync in isolation.
**Do this instead:** Extract per-concern hooks alongside the Context they serve (e.g. `useFocusTimer`, `useWidgetSync`, `useBootSequence` in `src/utils/` or colocated `src/context/*`), leaving `App.js` as provider stacking + render only — the same shell/engine split already used by `src/context/TaskContext.js` + `src/utils/taskMutations.js`.

### Dual-source state (context + legacy props)

**What happens:** `AppNavigator.js:83-111` builds `effectiveX = contextValue ?? propValue` for tasks, birthdays, vaults, notes, and billing, so screens read from two possible owners and `App.js` keeps mirrors of state the Contexts already own.
**Why it's wrong:** Masks ownership bugs; a stale `App.js` snapshot can silently win over fresh Context state (the exact W-01 clobber race the merge-on-write discipline works around).
**Do this instead:** Consume the Context hook directly in each screen (`useTasks()` / `useVaults()` / … as `DashboardScreen` already does via props from `AppNavigator.js:223-235`) and delete the prop fallbacks, completing the C-02 migration noted at `App.js:754-757`.

## Error Handling

**Strategy:** Layered: `ErrorBoundary` UI fallback at root; per-call try/catch with `logger` in all async storage/filesystem/notification paths; pure policy validators that return `{ valid, reason }` / `{ allowed, reason }` instead of throwing; rollback on partial native failures.

**Patterns:**
- Root React fallback: `ErrorBoundary` wraps the whole tree (`App.js:894`) with retry, error details, copy/share diagnostics (`src/components/ErrorBoundary.js`).
- Non-fatal async containment: every `AsyncStorage`/`FileSystem`/`Notifications` call is try/catch returning safe defaults (`[]`, `""`, `null`, `{ success: false }`) — e.g. `getAllNotesFromFilesystem` returns `[]` on scan failure (`src/utils/fileStorage.js:228-231`), `getNotificationHistory` returns `[]` on corrupt JSON (`src/services/notificationService.ts:151-170`), widget updates go through `safeRequestWidgetUpdate` (`widgets/widget-task-handler.tsx:30-36`).
- Atomicity guards: birthday scheduling rolls back already-scheduled native IDs on partial failure (`src/services/notificationService.ts:595-608`); sync validates payload shape before applying (`validateSyncPayload` in `src/utils/syncService.js:82-102`) so a malformed server response can never wipe notes.
- Listener isolation: `eventBus.emit` snapshots listener sets and catches sync/async errors per listener so one bad subscriber never breaks dispatch or the caller (`src/behavior/eventBus.ts:178-222`).

## Cross-Cutting Concerns

**Logging:** Central `logger` (`src/utils/logger.js`) with `debug/info/warn/error` levels; `debug` for lifecycle/storage/widget traces, `warn` for non-fatal rollbacks and policy blocks, `error` for init/load/persist failures. Production strips `console.*` via `babel-plugin-transform-remove-console` (`package.json`); in-code `console.warn/error` remains only in fallback paths (`AppNavigator.js:127`, `VaultContext.js:48`).
**Validation:** Pure validators at boundaries: `validateSyncConfig`/`validateSyncPayload` (`src/utils/syncService.js`), `commandValidator.ts`, habit-creation rule check (`validateHabitCreation` in `src/behavior/habitEngine.ts`), notification `evaluateNotificationPolicy` (`src/services/notificationService.ts:233-321`), bill/due-date guards (`scheduleBillReminder`, `scheduleDueDateReminder`).
**Authentication:** No user auth provider. LAN sync uses a bearer token per request (`Authorization: Bearer` in `src/utils/syncService.js:167`) with strict config validation (IP/hostname, port 1–65535, token ≥ 6 chars); AI model download is pinned by commit + SHA-256 + byte size (`src/utils/aiService.js:23-30`); telemetry is explicit opt-in with a blocking dialog (`App.js:1034-1076`).

---

*Architecture analysis: 2026-10-12*
