<!-- refreshed: 2026-10-12 -->
# Architecture

**Analysis Date:** 2026-10-12

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├──────────────────┬──────────────────┬───────────────────────┤
│  Screens (9)     │  Components (16) │  Navigation (Drawer)  │
│  `src/screens/`  │`src/components/` │ `src/navigation/`     │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    State / Context Layer                     │
│  `src/context/` — Task, Vault, Billing, Birthday, Habit      │
│  App.js root state (theme, timer, user, sync, notes mirror)  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Domain Logic Layer (pure, testable)             │
├──────────────┬───────────────┬──────────────┬───────────────┤
│ Behavior     │ AI pipeline   │ Commands     │ Mutation      │
│ `src/behavior/`│ `src/ai/`   │`src/commands/`│`src/utils/`   │
└──────────────┴───────────────┴──────────────┴───────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Store / Output / External                                   │
│  AsyncStorage (`kwestup_*` keys) + expo-file-system vaults   │
│  `widgets/` headless handler + `src/services/` notifications│
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root composition + boot | Owns app-level state (theme, timer, user, notes mirror, vault list), boot/migration orchestration, throttled persistence, widget push | `App.js` |
| Expo entry | Registers root component + headless widget task handler | `index.js` |
| Drawer navigation | 9-screen drawer, notification channel init, context→prop bridging, global TaskEditModal + WeeklyReviewModal + AIAssistant overlay | `src/navigation/AppNavigator.js` |
| Task state | Sole writer of tasks/taskLists/dailyTasks keys; debounced write-through persistence, foreground refresh, all task mutations | `src/context/TaskContext.js` |
| Habit state | Habit CRUD, midnight-rollover miss detection, recovery, rewards, behavior-event log (500 cap), isolated `kwestup_habits_*` keys | `src/context/HabitContext.js` |
| Vault state | Vault list + active vault + active note (thin mirror; filesystem is source of truth) | `src/context/VaultContext.js` |
| Billing state | Transactions/budgets/recurring bills, sole billing writer, bill lifecycle events | `src/context/BillingContext.js` |
| Birthday state | Birthday CRUD + notification scheduling, birthday lifecycle events | `src/context/BirthdayContext.js` |
| Event bus | Singleton typed+wildcard pub/sub, immutable frozen events, 100-event in-memory ring buffer | `src/behavior/eventBus.ts` |
| Habit engines | Pure habit math: completion/streak (`habitEngine.ts`), cues (`cueEngine.ts`), rules (`ruleEngine.ts`), recovery (`recoveryEngine.ts`), rewards (`rewardEngine.ts`), improvement (`improvementEngine.ts`), intervention planning (`interventionEngine.ts`) | `src/behavior/` |
| AI pipeline | Deterministic on-device intent → rule-packet → compiled plan → friction/weekly-review analysis | `src/ai/` |
| Command gateway | Validated, idempotent, sandboxed habit command execution with telemetry | `src/commands/` |
| Task mutation engine | Pure framework-agnostic task/list/subtask/recurrence transforms shared by app + widget | `src/utils/taskMutations.js` |
| Notes store | Vault-parameterized markdown file CRUD + scanner over `Notes/Vaults/<id>/` | `src/utils/fileStorage.js` |
| Vault store | Vault CRUD + active-vault tracking + one-time flat→vault migration | `src/utils/vaultService.js` |
| Widget runtime | Headless WIDGET_CLICK handler + render path for 5 Android widgets | `widgets/widget-task-handler.tsx` |
| Notification service | Channel init, permission, scheduling/cancel for birthdays, tasks, billing, system | `src/services/notificationService.ts` |

## Pattern Overview

**Overall:** Layered offline-first React Native (Expo) app with context-per-domain state, pure-function domain engines, and an event-bus telemetry backbone.

**Key Characteristics:**
- One React Context per domain owns its AsyncStorage keys; `App.js` owns only residual domains (theme/timer/user/birthdays-mirror/notes-mirror) and merges via read-modify-write so contexts never clobber each other.
- All habit/task transforms are pure functions in `src/behavior/` and `src/utils/taskMutations.js` — contexts and the headless widget handler both call the same functions, then persist.
- Cross-cutting telemetry flows through the `eventBus` singleton (`src/behavior/eventBus.ts`), never through direct cross-domain imports (`src/domains/README.md` rule).
- 4.0 behavior subsystem (habits/interventions/AI/commands) is TypeScript with strict domain types; 3.x productivity subsystem (screens/contexts/utils) is JavaScript.

## Layers

**Presentation:**
- Purpose: Render screens, dialogs, overlays; collect user input; never persist directly
- Location: `src/screens/`, `src/components/`, `src/navigation/`, `widgets/*.tsx` (render components)
- Contains: 9 screens (`DashboardScreen`, `DailyTasksScreen`, `BirthdaysScreen`, `BillingScreen`, `TaskListScreen`, `NotesScreen`, `FocusTimerScreen`, `SettingsScreen`, `SearchScreen`), 16 shared components (`TaskCard`, `TaskEditModal`, `AIAssistant`, `WeeklyReviewModal`, `ErrorBoundary`, `LiquidGlass*`, `Custom*`, `QRScannerModal`, `TimerLockoutOverlay`), drawer navigator + custom drawer content, 5 widget render components
- Depends on: Context layer (hooks like `useTasks`, `useVaults`, `useBilling`, `useBirthdays`, `useHabits`), theme objects, pure engines for display math
- Used by: `App.js` composes providers + `NavigationContainer`; `widgets/widget-task-handler.tsx` renders widget components headlessly

**State / Context:**
- Purpose: Own in-memory domain state, expose mutation actions, persist to AsyncStorage, emit domain events
- Location: `src/context/`, plus residual state in `App.js`
- Contains: `TaskProvider` (`src/context/TaskContext.js`), `HabitProvider` (`src/context/HabitContext.js`), `VaultProvider` (`src/context/VaultContext.js`), `BillingProvider` (`src/context/BillingContext.js`), `BirthdayProvider` (`src/context/BirthdayContext.js`)
- Depends on: Pure engines (`src/utils/taskMutations.js`, `src/behavior/habitEngine.ts`, `src/behavior/recoveryEngine.ts`, `src/behavior/rewardEngine.ts`, `src/behavior/improvementEngine.ts`), `src/behavior/eventBus.ts`, storage utils
- Used by: Screens via hooks; `AppNavigator` bridges context values to screen props with App.js-state fallbacks

**Domain logic (pure engines):**
- Purpose: Deterministic, side-effect-free business rules; fully unit-testable without React or storage
- Location: `src/behavior/`, `src/ai/`, `src/commands/`, `src/utils/taskMutations.js`
- Contains: Habit lifecycle (`completeHabit`, streak/evidence votes), cue evaluation, JSON rule-engine (`loadMachineRules`/`evaluateRules` over `rulebook/`), recovery, factual rewards, intervention planning + widget touchpoint selection, intent parsing → rule-packet retrieval → behavior compilation, friction diagnosis, weekly-review generation, command validation/execution/idempotency
- Depends on: Domain types in `src/behavior/types.ts` and `src/commands/types.ts`, `rulebook/` JSON rules, date/id helpers
- Used by: Contexts, `widgets/widget-task-handler.tsx`, `src/components/AIAssistant.js`, `src/components/WeeklyReviewModal.js`

**Persistence / Services:**
- Purpose: Durable storage and OS integration (notifications, filesystem, widgets, sync, AI model)
- Location: `src/utils/storage.js`, `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/billingStorage.js`, `src/services/notificationService.ts`, `src/utils/aiService.js`, `src/utils/syncService.js`, `src/utils/exportService.js`
- Contains: Versioned AsyncStorage keys (`kwestup_*`), markdown vault filesystem (`Notes/Vaults/<vaultId>/`), notification channels/scheduling, llama.rn model lifecycle, LAN sync, export/import
- Depends on: `@react-native-async-storage/async-storage`, `expo-file-system`, `expo-notifications`, `llama.rn`
- Used by: Contexts, `App.js` boot/load/save, widget handler (direct AsyncStorage reads/writes)

## Data Flow

### Primary Request Path

1. User interaction in screen/component → calls context action hook (`src/context/TaskContext.js:196`, `src/context/HabitContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`)
2. Context action computes next state via pure engine outside the React updater (`src/utils/taskMutations.js`, `src/behavior/habitEngine.ts`) → `setState` with computed snapshot
3. Context debounced write-through persists via read-modify-write merge to `kwestup_data_<STORAGE_VERSION>` (`src/context/TaskContext.js:78`) — never blind overwrite
4. Context emits immutable domain event on `eventBus` (`src/context/TaskContext.js:222`, `src/context/HabitContext.js:337`) for telemetry/intervention subscribers
5. App-level throttled effects push derived slices to Android widgets (`App.js:592`) or schedule/cancel notifications (`src/services/notificationService.ts`)

### Boot / Init Flow

1. Expo registers root (`index.js:10`) → `App` mounts (`App.js:102`)
2. `initializeApp` (`App.js:176`) reads version/username/vaults/active-vault/telemetry in parallel, inits vault folder (`src/utils/fileStorage.js:11`), fires fire-and-forget background migration + cache clear (`src/utils/vaultService.js:181`, `src/utils/storage.js:31`)
3. `loadData` (`App.js:261`) runs storage-version migration (`src/utils/storage.js:74`), reads merged data + timer + theme keys, resets daily-task streaks, scans vault filesystem (`src/utils/fileStorage.js:165`), reschedules birthday notifications
4. Providers hydrate from `initial*` props (`src/context/TaskContext.js:44`); `TaskContext` boot-guard prevents empty in-memory state from wiping real storage (`src/context/TaskContext.js:103`)

### Widget (Headless) Flow

1. OS invokes `widgetTaskHandler` (`widgets/widget-task-handler.tsx:90`) in a separate JS environment with `WIDGET_CLICK` / `WIDGET_ADDED` / `WIDGET_UPDATE` / `WIDGET_RESIZED`
2. Handler reads AsyncStorage directly (`kwestup_data_<version>`, `HABITS_STORAGE_KEY`), applies the same pure engine (`toggleTask` from `src/utils/taskMutations.js:77`, `completeHabit` from `src/behavior/habitEngine.ts`), writes back immediately
3. Handler emits `WIDGET_ACTION` + lifecycle events on its process-local `eventBus` and appends bounded behavior-event log (500 cap)
4. Handler re-renders affected widgets via `safeRequestWidgetUpdate`; foreground `TaskContext`/`HabitContext` pick up changes on next `AppState: active` refresh (`src/context/TaskContext.js:131`, `App.js:437`)

### AI Command Flow

1. `AIAssistant` (`src/components/AIAssistant.js`) or note-screen extraction calls heuristic/intent parser (`src/ai/heuristicParser.ts`, `src/ai/intentParser.ts`) → rule packets (`src/ai/rulePacketRetriever.ts`) → compiled plan (`src/ai/behaviorCompiler.ts`)
2. Plan becomes a `DispatchedCommand` validated by `validateCommand` (`src/commands/commandValidator.ts`), deduplicated by in-memory + durable idempotency cache (`src/commands/commandExecutor.ts:142`, `src/commands/idempotencyStore.ts`), dispatched to registered handlers (`src/commands/habitCommandHandlers.ts`)
3. Outcome emits `COMMAND_EXECUTED` / `COMMAND_FAILED` on `eventBus` (`src/commands/commandExecutor.ts:248`); sandbox (`src/commands/aiSandbox.ts`) bounds what AI may execute

### Notes / Vault Flow

1. Vault CRUD via `src/utils/vaultService.js` (AsyncStorage `kwestup_vaults_<version>` + `Notes/Vaults/<id>/` directories); active vault tracked separately
2. Note CRUD via `src/utils/fileStorage.js` markdown files (`<vault>/<folder>/<title>.md`); `getAllNotesFromFilesystem` scans one level deep and extracts `#hashtags`
3. `VaultContext` (`src/context/VaultContext.js`) mirrors list/active/note only; `App.js:758` `handleSetActiveVault` persists + rescans; sync (`src/utils/syncService.js`, `App.js:765`) wipes and rewrites active-vault files from merged payload

**State Management:**
- Per-domain React Context is the single writer per key-range; no global store (no Redux/Zustand). Residual App.js state covers theme/timer/user/sync/notes-mirror. Cross-domain communication is events-only per `src/domains/README.md`. Foreground/background sync is via AsyncStorage reads on `AppState: active`, not via shared memory (widget runs headless).

## Key Abstractions

**DomainEvent / BehaviorEvent:**
- Purpose: Immutable telemetry + decoupling contract for every lifecycle transition
- Examples: `src/behavior/types.ts`, `src/behavior/eventBus.ts`
- Pattern: `DomainEventInput<T>` (id/timestamp optional) → `emit` deep-clones, deep-freezes, ring-buffers, then fans out to typed + wildcard listeners with per-listener error isolation

**Pure mutation engines:**
- Purpose: Framework-agnostic transforms returning `{ updatedX, result }` tuples so callers stay thin
- Examples: `src/utils/taskMutations.js` (`toggleTask`, `saveTask`, `completeTask`, `toggleSubtask`, `createTaskList`), `src/behavior/habitEngine.ts` (`completeHabit`), `src/behavior/recoveryEngine.ts`, `src/behavior/rewardEngine.ts`
- Pattern: `(currentArray, id, options) => ({ updatedArray, affectedEntity })` — compute outside updater, `setState` with result

**Context providers:**
- Purpose: Own persistence + actions + event emission behind `useX()` hooks
- Examples: `src/context/TaskContext.js`, `src/context/HabitContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`, `src/context/VaultContext.js`
- Pattern: `createContext(null)` + `Provider({ initial* })` + syncing `useEffect` on prop change + debounced write-through + `useX()` accessor; `AppNavigator` adds prop-fallback bridging (`src/navigation/AppNavigator.js:84`)

**Compiled habit plan:**
- Purpose: Deterministic AI output contract (identity/behavior/cue/intervention/recovery/reward + rulesApplied trace)
- Examples: `src/ai/behaviorCompiler.ts`, `src/behavior/types.ts:234`, `src/ai/types.ts`
- Pattern: `intent → rulePackets → CompiledHabitPlan` with rule-ID traceability

**DispatchedCommand:**
- Purpose: Idempotent, validated, actor-tagged habit mutation from any surface (AI/user/widget/engine)
- Examples: `src/commands/types.ts:117`, `src/commands/commandExecutor.ts`, `src/commands/commandValidator.ts`, `src/commands/idempotencyStore.ts`, `src/commands/useCommandGateway.ts`
- Pattern: `{ action, payload, idempotencyKey, actor }` → validate → dedup (200-entry LRU + 15-min TTL, durable fallback) → handler → `COMMAND_EXECUTED` event

**Widget touchpoint / Intervention:**
- Purpose: Decide what the home-screen widget and notifications should show next
- Examples: `src/behavior/interventionEngine.ts` (`selectWidgetTouchpoint`), `src/behavior/types.ts:75`, `widgets/HabitWidget.tsx`
- Pattern: Pure selector over habits + machine rules → `{ type: recovery|today_due|next_action|standby, actionLabel, actionType }`

## Entry Points

**Expo root:**
- Location: `index.js`
- Triggers: Expo `registerRootComponent`
- Responsibilities: Mount `App`, register headless `widgetTaskHandler` for `react-native-android-widget`

**App root component:**
- Location: `App.js:102`
- Triggers: App cold start / foreground reload
- Responsibilities: Font loading, boot/migration, data load/save orchestration, provider composition (`Task→Vault→Billing→Birthday→Habit`), timer engine, widget push effects, confirmation/name/telemetry modals, error boundary + theming shell

**Drawer navigator:**
- Location: `src/navigation/AppNavigator.js:32`
- Triggers: Navigation state changes inside `NavigationContainer` (`App.js:911`)
- Responsibilities: Route table (Dashboard/Daily/Birthdays/Billing/Tasks/Notes/Focus/Settings/Search), drawer chrome, notification channel init, global modals (`TaskEditModal`, `WeeklyReviewModal`), `AIAssistant` overlay (hidden on note-focus and Settings)

**Headless widget handler:**
- Location: `widgets/widget-task-handler.tsx:90`
- Triggers: Android OS widget lifecycle + click actions (`TOGGLE_TASK`, `COMPLETE_TASK`, `SWITCH_TAB`, `COMPLETE_HABIT`, `START_HABIT_ACTION`)
- Responsibilities: Direct-storage read/mutate/write with pure engines, bounded event-log append, widget re-render; no React state access

**AI assistant overlay:**
- Location: `src/components/AIAssistant.js`
- Triggers: Floating button on every route except note-editing and Settings (`src/navigation/AppNavigator.js:386`)
- Responsibilities: On-device inference via `src/utils/aiService.js` (llama.rn), task/birthday/transaction extraction callbacks into contexts

## Architectural Constraints

- **Threading:** Single-threaded React Native JS + one separate headless JS environment for widgets. No shared memory between them — AsyncStorage is the IPC channel. Never assume `eventBus` crosses the app/widget boundary (`widgets/widget-task-handler.tsx:27`).
- **Global state:** Module-level singletons: `eventBus` (`src/behavior/eventBus.ts:272`), command handler registry + idempotency LRU (`src/commands/commandExecutor.ts:42`), `eventCounter` sequence (`src/behavior/eventBus.ts:12`). No other mutable module globals; engines are stateless.
- **Circular imports:** `src/utils/fileStorage.js` ↔ `src/utils/vaultService.js` is intentionally broken with dynamic `await import("./vaultService")` inside active-vault wrappers (`src/utils/fileStorage.js:271`). Do not convert these to static imports. `AppNavigator` ↔ screens is one-directional (screens never import the navigator).
- **Persistence merge rule:** Every writer must read-modify-write its key-range (`{ ...stored, ...mySlice }`). Blind `setItem` of a full object from stale state clobbers sibling domains — this caused W-01/W-02/W-03 races; `TaskContext` and `BillingContext` are now sole writers of their slices.
- **TDZ ordering:** In `App.js`, the `AppState` foreground effect must stay below the `loadData` declaration or first render throws (`App.js:432`).
- **Binder budget:** Widget pushes are throttled (5 s), staggered (250–500 ms), sliced (top-5/top-8), and gated on `appState === 'active'` (`App.js:592`). Do not add unthrottled `requestWidgetUpdate` calls.

## Anti-Patterns

### Blind full-object AsyncStorage overwrite

**What happens:** Reading one domain slice and writing the whole `kwestup_data_*` object back, wiping fresher sibling-domain writes made in between.
**Why it's wrong:** Causes lost tasks/billing/daily-tasks under concurrent saves (documented W-01/W-02/W-03).
**Do this instead:** Read-modify-write merge limited to owned keys, as in `src/context/TaskContext.js:78` (`writeTaskSnapshot`) and `App.js:474`.

### Duplicated hand-rolled mutation logic in components

**What happens:** Copying toggle/save/delete math into screens or `App.js` instead of calling the shared engine.
**Why it's wrong:** Divergent recurrence/streak/notification behavior between app and widget paths.
**Do this instead:** Call `src/utils/taskMutations.js` (tasks) or `src/behavior/habitEngine.ts` et al. (habits) from every caller — see `src/context/TaskContext.js:206` and `widgets/widget-task-handler.tsx:158`.

### Cross-domain direct imports

**What happens:** Importing another domain's internals (e.g., habit code importing billing internals).
**Why it's wrong:** Violates the `src/domains/README.md` isolation rule; creates cycles and untestable coupling.
**Do this instead:** Communicate via `eventBus.emit`/`subscribe` with types from `src/behavior/types.ts`, as contexts do (`src/context/BillingContext.js:53`).

## Error Handling

**Strategy:** Localize failures: isolated listener/command execution, graceful boot degradation, silent persistence retries with logging.

**Patterns:**
- `ErrorBoundary` (`src/components/ErrorBoundary.js`) wraps the whole tree inside theming (`App.js:890`); boot `try/catch` still marks initialized so the app never hangs on splash (`App.js:243`).
- `eventBus.emit` (`src/behavior/eventBus.ts:144`) snapshots listeners and catches sync throws + async rejections per listener via `logger.error`, never disrupting siblings or the emitter.
- `executeCommand` (`src/commands/commandExecutor.ts:214`) isolates handler throws into `{ success: false, error }` + `COMMAND_FAILED` telemetry; missing-handler and validation failures return without throwing.
- Storage/filesystem helpers return `{ success, error }` or safe defaults (`[]`/`""`) and log (`src/utils/fileStorage.js:33`, `src/utils/vaultService.js:41`).

## Cross-Cutting Concerns

**Logging:** Central `logger` (`src/utils/logger.js`) with debug/info/warn/error; used everywhere instead of raw `console`. Widget handler and engines log warn-only on hot paths.
**Validation:** Schema + capability validation for commands (`src/commands/commandValidator.ts`); rule-engine `when/then` evaluation for habits/interventions (`src/behavior/ruleEngine.ts`); theme resolvers with allowlist fallback (`App.js:72`).
**Authentication:** None — single-user offline-first app. LAN sync uses QR-shared config with no auth (`src/utils/syncService.js`, `src/components/QRScannerModal.js`); telemetry is explicit opt-in (`App.js:1030`).

---

*Architecture analysis: 2026-10-12*
