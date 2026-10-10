<!-- refreshed: 2026-10-10 -->
# Architecture

**Analysis Date:** 2026-10-10

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              App Shell / Composition Root                    │
│  `index.js` → `App.js` (state, init, persistence, theming)   │
├──────────────────┬──────────────────┬───────────────────────┤
│  Context Layer   │  Navigation      │  Headless Widgets     │
│  `src/context/`  │  `src/navigation/` │  `widgets/`         │
│  Task/Vault/     │  Drawer + 9      │  4 Android widgets    │
│  Billing/Birthday│  screen routes   │  + task handler       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Domain Logic / Services Layer                   │
│  `src/utils/taskMutations.js` (pure engine)                  │
│  `src/services/notificationService.ts` (dispatch + policy)   │
│  `src/utils/aiService.js` (llama.rn singleton)               │
│  `src/utils/vaultService.js` + `src/utils/fileStorage.js`    │
│  `src/utils/syncService.js` `src/utils/storage.js`           │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Persistence (offline-first, no backend)                      │
│  AsyncStorage JSON (`kwestup_*` keys) + expo-file-system      │
│  markdown vaults (`Notes/Vaults/<vaultId>/`) + OS alarms      │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Composition root | Registers app + widget handler with Expo | `index.js` |
| App shell | Owns all top-level `useState`, boot init, load/save, timer loop, theme resolution, widget pushes, sync orchestration, dialogs | `App.js` |
| Drawer navigator | Declares 9 routes, resolves context-vs-prop state, mounts `TaskEditModal` + `AIAssistant` globally | `src/navigation/AppNavigator.js` |
| Drawer chrome | Drawer item list, theme cycler, user header | `src/navigation/CustomDrawerContent.js` |
| Task state | Sole writer of tasks/taskLists/dailyTasks with debounced write-through persistence; all task mutations | `src/context/TaskContext.js` |
| Vault state | Active vault id, vault list, notes mirror, vault switching | `src/context/VaultContext.js` |
| Billing state | Billing data ownership (sole persistence writer) | `src/context/BillingContext.js` |
| Birthday state | Birthday list + reminder wiring | `src/context/BirthdayContext.js` |
| Pure task engine | Framework-agnostic toggles, recurrence, subtask/list ops shared by app and widgets | `src/utils/taskMutations.js` |
| Notification engine | Channel init, schedule/cancel, behavioral policy gate, history ledger | `src/services/notificationService.ts` |
| On-device AI | llama.rn model download/verify/load/infer/unload, idle + AppState lifecycle | `src/utils/aiService.js` |
| Notes filesystem | Vault-scoped markdown CRUD under `documentDirectory` | `src/utils/fileStorage.js` |
| Vault registry | Vault configs + active id in AsyncStorage, path helpers, migration | `src/utils/vaultService.js` |
| LAN sync | Config validation, ping, bidirectional REST handshake | `src/utils/syncService.js` |
| Headless widgets | Background render + tap actions without mounting the app | `widgets/widget-task-handler.tsx` |
| 4.0 type contracts | Habit/identity/intervention/event types; AI command registry types | `src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts` |

## Pattern Overview

**Overall:** Offline-first monolithic Expo app with layered Context + Drawer navigation, a pure shared mutation engine, and headless widget extensions. Planned 4.0 domains are event-isolated (types only, no implementation yet).

**Key Characteristics:**
- Single-process React Native: one JS runtime owns UI, persistence, notifications, AI, and widget pushes.
- Context-per-domain over Redux/MobX/Zustand: each of the 4 providers owns one domain's state and persistence slice.
- Pure engine shared across surfaces: `src/utils/taskMutations.js` is imported by both `src/context/TaskContext.js` and `widgets/widget-task-handler.tsx` so in-app and headless taps apply identical transitions.
- Dual persistence split by access pattern: small structured state in AsyncStorage JSON, large note bodies as markdown files on disk.
- Policy-gated side effects: notification dispatch passes through a behavioral policy (`src/services/types.ts`) before reaching `expo-notifications`.

## Layers

**Entry / Shell:**
- Purpose: Boot, compose providers, own cross-cutting state (theme, user, timer, sync status, dialogs).
- Location: `index.js`, `App.js`
- Contains: `useState`/`useEffect` orchestration, font loading, init/load/save effects, widget-push effects, confirmation/name/telemetry modals, `ErrorBoundary` + `PaperProvider` + `NavigationContainer` composition.
- Depends on: Every layer below (contexts, navigation, utils, services, widgets).
- Used by: Expo runtime only.

**State (Context providers):**
- Purpose: Own one domain's state; expose mutations + persistence so screens never touch AsyncStorage directly.
- Location: `src/context/TaskContext.js`, `src/context/VaultContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`
- Contains: `createContext` + `useState` + `useCallback` mutations + hydration-from-`initial*` props + debounced AsyncStorage writers.
- Depends on: `src/utils/*` engines and `src/services/notificationService.ts`.
- Used by: `App.js` (mounts providers), `src/navigation/AppNavigator.js` (reads via hooks), all screens.

**Navigation:**
- Purpose: Route table and drawer chrome; resolve effective state (context wins, App props are fallback).
- Location: `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js`
- Contains: `createDrawerNavigator` with 9 screens, `useNavigationState` route tracking, global `TaskEditModal` + `AIAssistant` mounts.
- Depends on: Contexts, screens, notification init.
- Used by: `App.js` inside `NavigationContainer`.

**Presentation (Screens + Components):**
- Purpose: One screen per feature; shared presentational primitives.
- Location: `src/screens/` (9 files), `src/components/` (15 files)
- Contains: Screen containers (`DashboardScreen`, `TaskListScreen`, `DailyTasksScreen`, `BirthdaysScreen`, `BillingScreen`, `NotesScreen`, `FocusTimerScreen`, `SearchScreen`, `SettingsScreen`) and reusable UI (`CustomButton`, `CustomTextInput`, `CustomCard`, `TaskCard`, `TaskEditModal`, `AIAssistant`, `TimerLockoutOverlay`, `ErrorBoundary`, `LiquidGlassBackground`, `QRScannerModal`, etc.).
- Depends on: Context hooks, `src/theme/*`, utils/services for actions.
- Used by: `AppNavigator`.

**Services / Engines (horizontal):**
- Purpose: Side effects and pure logic callable from any layer.
- Location: `src/services/notificationService.ts`, `src/utils/aiService.js`, `src/utils/taskMutations.js`, `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/syncService.js`, `src/utils/storage.js`, `src/utils/notifications.js`, `src/utils/billingStorage.js`, `src/utils/billingNotifications.js`, `src/utils/exportService.js`, `src/utils/dateUtils.js`, `src/utils/diagnostics.js`, `src/utils/logger.js`, `src/utils/vaultImport.js`
- Contains: Pure functions (mutations, dates, validation) and effectful singletons (notifications, AI context, filesystem).
- Depends on: `expo-*` SDKs, `AsyncStorage`, `src/services/types.ts`, `src/behavior/types.ts`.
- Used by: Contexts, `App.js`, screens, widget handler.

**Theming:**
- Purpose: Single source of color truth; 5 names × 3 modes.
- Location: `src/theme/colors.js`, `src/theme/styles.js`
- Contains: `themes` map (`clean`/`blue`/`green`/`purple`/`dribbble` × `light`/`dark`/`amoled`), shared `StyleSheet`.
- Depends on: Nothing.
- Used by: `App.js` (resolves `currentTheme`), every screen/component via props.

**Headless widget surface:**
- Purpose: Android home-screen widgets that work when the app is killed.
- Location: `widgets/FocusTimerWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/TasksListWidget.tsx`, `widgets/widget-task-handler.tsx`
- Contains: Pure render components + async task handler (tab switch, task toggle with ticking animation, re-render fan-out).
- Depends on: `AsyncStorage`, `src/utils/taskMutations.js`, `src/utils/storage.js` (for `STORAGE_VERSION`), `src/utils/dateUtils.js`.
- Used by: OS via `registerWidgetTaskHandler` in `index.js`; pushed to by `App.js` via `requestWidgetUpdate`.

**Future domain contracts (types only):**
- Purpose: Freeze 4.0 habit/AI/command shapes before implementation.
- Location: `src/behavior/types.ts`, `src/commands/types.ts`, `src/services/types.ts`, `src/domains/README.md`
- Contains: Interfaces only — no runtime code, no domain subdirectories yet.
- Depends on: Nothing.
- Used by: `src/services/notificationService.ts` (notification types); rulebook/master-plan references.

## Data Flow

### Primary Request Path

1. Process start — `index.js` registers root component + widget handler (`index.js:10-11`).
2. Shell mount — `App.js` loads fonts, reads user/vault/telemetry keys, runs `initNotesFolder` + fire-and-forget vault migration (`App.js:146-224`).
3. Data hydration — `loadData` reads `kwestup_data_<STORAGE_VERSION>` + timer/theme/tab keys, resets daily streaks, loads notes from filesystem, reschedules birthday alarms (`App.js:233-402`).
4. Provider hydration — `initialTasks`/`initialVaults`/`initialBillingData`/`initialBirthdays` flow into the 4 contexts (`App.js:852-911`).
5. Navigation render — `AppNavigator` reads contexts via hooks (context wins over App props), mounts Drawer + global modals (`src/navigation/AppNavigator.js:68-109`).
6. Mutation + persist — Screen calls context mutation → pure engine in `src/utils/taskMutations.js` computes snapshot → context debounced writer does read-modify-write to AsyncStorage (`src/context/TaskContext.js:76-~130`).

### Boot / Persistence Flow

1. `initializeApp` (blocking, minimal): version key + username + vaults + active id + telemetry opt-in → unblock UI (`App.js:146-224`).
2. `loadData` (after `isInitialized`): `migrateUserDataIfNeeded` legacy scan → parse main blob → daily-streak rollover → filesystem notes → theme/timer restoration (`App.js:233-402`).
3. Periodic save (15 s throttle): `saveData` merges birthdays/notes/theme/user/lastSynced onto the stored blob so task keys owned by `TaskContext` are never clobbered (`App.js:426-464`).
4. Timer fast path: `saveTimerState` writes only `kwestup_timer_state_*` on every tick (`App.js:466-483`).
5. Foreground refresh: `AppState` listener reloads from AsyncStorage when returning from background (`App.js:409-424`).

### Widget Push / Pull Flow

1. Push (app alive): `App.js` effects call `requestWidgetUpdate` for `FocusTimer`/`DailyTasks` (5 s throttle + 500 ms stagger), `ImportantTasks` (top-5 slice), `TasksList` (sorted top-8, 250 ms stagger) (`App.js:562-652`).
2. Pull (app dead): OS invokes `widgetTaskHandler` → reads AsyncStorage + per-widget tab key → computes timer elapsed → `props.renderWidget` (`widgets/widget-task-handler.tsx:178-272`).
3. Tap-back: `TOGGLE_TASK` reads blob → optimistic ticking render → 600 ms delay → `toggleTask` engine → write-back → fan-out refresh of the other three widgets (`widgets/widget-task-handler.tsx:86-175`).

### Notification Scheduling Flow

1. Caller builds `NotificationDispatchRequest` (category + payloadKey + recurrence + channel + trigger) — e.g. focus-complete in `App.js:696-703`.
2. `scheduleNotification` in `src/services/notificationService.ts` routes by category: `behavior` one-shots get quiet-hours shift + cap/gap/dedup gate; recurring (daily/birthday/billing) get quiet-hours shift only and are recorded exempt.
3. Channel ensured via `ANDROID_NOTIFICATION_CHANNELS` (behavior/daily/birthdays/billing/system/critical), history appended to `kwestup_notification_history_v1`.
4. Birthday reschedule on boot iterates loaded birthdays, cancels old ids, schedules covering this year + next (`App.js:365-386`).

### Vault / Notes Flow

1. Vault switch: `handleSetActiveVault` persists id → reloads notes from new vault path (`App.js:718-723`; canonical version in `src/context/VaultContext.js:54-64`).
2. Note write: `saveNoteFile(vaultId, folder, title, content)` sanitizes title → ensures subfolder → writes `<Title>.md` (`src/utils/fileStorage.js:33-60`).
3. LAN sync replace: `handleExecuteSync` runs `performSync` → wipes vault filesystem → rewrites returned markdown → cancels + reschedules birthday alarms → overwrites state (`App.js:725-803`).

### AI Inference Flow

1. `AIAssistant` component (`src/components/AIAssistant.js`) calls into `src/utils/aiService.js`.
2. Service checks SHA-256/size-pinned GGUF at `documentDirectory/models/`; resumable download if missing.
3. `loadModel` acquires init lock with generation guard; `resetIdleTimer` unloads after 5 min idle; `handleAppStateChange` unloads on background (`src/utils/aiService.js:46-~90`).
4. Inference builds context from tasks/birthdays/notes via date helpers, calls `llama.rn`, returns completion.

**State Management:**
- No global store library. `App.js` `useState` is the boot/hydration owner; each `src/context/*` provider is the runtime owner of its slice. Rule: tasks/taskLists/dailyTasks writes go only through `TaskContext`; billing writes only through `BillingContext`; all other domains merge onto the stored blob. Widget handler bypasses React entirely and reads/writes AsyncStorage directly, reconciled on next foreground `loadData`.

## Key Abstractions

**Pure mutation engine:**
- Purpose: Single deterministic transition function for tasks usable without React.
- Examples: `src/utils/taskMutations.js`, `src/context/TaskContext.js`, `widgets/widget-task-handler.tsx`
- Pattern: `toggleTask(tasks, id, { now, todayDate }) → { updatedTasks }`; recurrence spawner `calculateNextRecurrence`; list ops `createTaskList`/`renameTaskList`/`deleteTaskList`. Callers persist the returned snapshot; never mutate in place.

**Context provider with initial-prop hydration:**
- Purpose: Let `App.js` boot-load once, then hand ownership to context without a second fetch.
- Examples: `src/context/TaskContext.js:29-61`, `src/context/VaultContext.js:10-38`
- Pattern: `initialX` props seed `useState`; `useEffect` on each `initialX` re-syncs (unconditional for tasks so reset-to-empty propagates; length-guarded for vaults/notes).

**Vault-scoped filesystem:**
- Purpose: Multi-tenant notes isolation on disk.
- Examples: `src/utils/vaultService.js:18-32`, `src/utils/fileStorage.js`
- Pattern: `getVaultPath(vaultId)` → `<documentDirectory>Notes/Vaults/<vaultId>/`; every file op takes `vaultId` first. Registry (id/name/config) lives in AsyncStorage; bodies live on disk.

**Policy-gated notification dispatch:**
- Purpose: Centralize quiet-hours/cap/dedup/opt-out so every feature schedules identically.
- Examples: `src/services/notificationService.ts`, `src/services/types.ts`, `src/utils/billingNotifications.js`, `src/utils/notifications.js`
- Pattern: Build `NotificationDispatchRequest` → `scheduleNotification()` evaluates `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` → channel route → history ledger entry.

**Liquid-glass theming:**
- Purpose: Theme is data: `themes[name][mode]` object passed as `currentTheme` prop + `PaperProvider` theme.
- Examples: `src/theme/colors.js`, `src/theme/styles.js`, `src/components/LiquidGlassBackground.js`, `src/components/LiquidGlassCard.js`
- Pattern: `resolveThemeMode`/`resolveThemeName` validators in `App.js:70-71` guarantee fallback to `dribbble.light`; screens style from `currentTheme` tokens only.

## Entry Points

**Expo root:**
- Location: `index.js`
- Triggers: OS process start (Expo Go, dev client, native build).
- Responsibilities: `registerRootComponent(App)`; `registerWidgetTaskHandler(widgetTaskHandler)`.

**App shell:**
- Location: `App.js`
- Triggers: React mount after `registerRootComponent`.
- Responsibilities: Font gate + splash (`isLoading`), two-phase init, all persistence effects, timer interval, widget pushes, update check, global dialogs (confirmation / name / telemetry / lockout / confetti).

**Headless widget handler:**
- Location: `widgets/widget-task-handler.tsx`
- Triggers: OS widget events (`WIDGET_ADDED`/`WIDGET_UPDATE`/`WIDGET_RESIZED`/`WIDGET_CLICK`).
- Responsibilities: Serve renders from AsyncStorage with no React tree; handle `SWITCH_TAB` and `TOGGLE_TASK`/`COMPLETE_TASK` actions.

**Drawer routes (9):**
- Location: `src/navigation/AppNavigator.js`
- Triggers: Drawer tap / deep navigation state change.
- Responsibilities: Mount the matching screen with effective state: `Dashboard` (`src/screens/DashboardScreen.js`), `Daily` (`src/screens/DailyTasksScreen.js`), `Birthdays` (`src/screens/BirthdaysScreen.js`), `Billing` (`src/screens/BillingScreen.js`), `Tasks` (`src/screens/TaskListScreen.js`), `Notes` (`src/screens/NotesScreen.js:2013` lines, largest screen), `Focus` (`src/screens/FocusTimerScreen.js`), `Search` (`src/screens/SearchScreen.js`), `Settings` (`src/screens/SettingsScreen.js`).

**Notification fire:**
- Location: OS alarm → `expo-notifications` listener (initialized in `src/navigation/AppNavigator.js:74-77` via `initNotificationChannels` + `requestNotificationPermissions`).
- Triggers: Due-date, birthday, billing, focus-complete, behavior-cue triggers.
- Responsibilities: Surface alert; history already recorded at schedule time.

## Architectural Constraints

- **Threading:** Single JS thread. Timer ticks, saves, widget pushes, and AI inference share it — hence the 15 s save throttle, 5 s widget throttle, staggered pushes, and AI idle-unload. No workers or background fetch daemon (explicitly rejected in `src/services/notificationService.ts:1-17` to preserve Feb-29/advance reminders without a live runtime).
- **Global state:** Module singletons in `src/utils/aiService.js` (`_llamaContext`, `_initPromise`, `_idleTimer`, `_loadGeneration`, `_appStateSubscription`); write-debounce refs in `src/context/TaskContext.js` (`storageWriteTimerRef`, `lastPersistedJsonRef`); save/widget throttle refs in `App.js` (`lastSaveTimeRef`, `lastWidgetUpdateTimeRef`, `birthdaysRef`, `lastBirthdayRescheduleRef`). No Redux store.
- **Circular imports:** None detected. Dependency direction is acyclic: screens/components → contexts → utils/services → expo SDKs; widgets → utils only (never import contexts/screens). `App.js` ↔ `AppNavigator` is parent→child props only.
- **Binder transaction budget (Android):** Large AsyncStorage writes + widget IPC share the Binder buffer. Mitigations are architectural: decoupled timer key, sliced widget payloads (top-5/top-8), staggered `setTimeout` fan-out, AppState-guarded pushes (`App.js:562-652`).
- **Type boundary:** `allowJs` + `checkJs: false` (`tsconfig.json`); only `src/services/*.ts`, `src/behavior/types.ts`, `src/commands/types.ts`, `widgets/*.tsx` are type-checked. JS layers are dynamically typed by design until phased `checkJs` enablement.
- **Offline-only:** No remote backend. Sync is LAN REST to a user-provided host (`src/utils/syncService.js`); telemetry is opt-in anonymous launch counting only.

## Anti-Patterns

### God-component App shell

**What happens:** `App.js` (1071 lines) owns ~20 `useState` slices, all persistence effects, timer loop, widget pushes, sync, and three dialogs, while also passing ~30 props into `AppNavigator` that largely duplicate live context values.
**Why it's wrong:** Two sources of truth for the same slice (e.g. `notes` in App state and `VaultContext`) invite stale-prop overwrites; every new feature touches the same file, raising merge conflict and regression risk.
**Do this instead:** Follow the `TaskContext` precedent (`src/context/TaskContext.js` — sole writer with write-through persistence): move each slice's load/save/mutation into its provider and shrink `App.js` to init + provider composition + dialogs. `AppNavigator` already prefers context over props (`src/navigation/AppNavigator.js:81-109`) — delete the prop fallbacks once providers are authoritative.

### Dual-owned notes state

**What happens:** `App.js` holds `notes`/`setNotes` and persists them in `saveData`, while `VaultContext` holds a parallel `notes` copy with its own loader/switcher.
**Why it's wrong:** A vault switch or sync that updates one copy but not the other renders stale notes until the next foreground reload.
**Do this instead:** Make `VaultContext.loadVaultNotes`/`handleSetActiveVault` (`src/context/VaultContext.js:41-64`) the only notes writer (mirroring the W-01/W-02 task fix); `App.js` keeps only the initial filesystem read for hydration.

## Error Handling

**Strategy:** `ErrorBoundary` at the shell + local try/catch with `logger` + user-facing confirmation modal. No crash reporting backend.

**Patterns:**
- Shell crash isolation: `<ErrorBoundary currentTheme isDark>` wraps the whole tree inside `LiquidGlassBackground` (`App.js:850`), implementation in `src/components/ErrorBoundary.js` (409 lines — full-screen fallback).
- Best-effort background init: vault migration + cache clear + dev diagnostics run fire-and-forget with inner try/catch so failures only warn (`App.js:189-210`).
- Storage-tolerant hydration: every `loadData` branch falls back to empty defaults + filesystem notes on parse failure (`App.js:387-401`); vault/file ops return `{ success, filePath }` or `[]` instead of throwing (`src/utils/fileStorage.js:55-60`, `src/utils/vaultService.js:50-56`).
- User surfacing: sync failures, focus-complete, and destructive resets all route through the single `showConfirmation` modal (`App.js:654-673`); timer completion additionally fires haptics + system notification.

## Cross-Cutting Concerns

**Logging:** Central `logger` (`src/utils/logger.js`, 194 lines) with `debug`/`info`/`warn`/`error` levels; `babel-plugin-transform-remove-console` strips raw `console.*` in release. Widget handler still uses raw `console.log/warn` (`widgets/widget-task-handler.tsx`) since it runs outside the app runtime.
**Validation:** `resolveThemeMode`/`resolveThemeName` coercion (`App.js:70-71`); strict LAN sync config validation (IPv4/hostname/IPv6 regex, port bounds, path-injection rejection) in `src/utils/syncService.js:34-50`; notification payload + policy types in `src/services/types.ts`.
**Authentication:** None — single-user offline app. LAN sync uses a user-supplied bearer token per config; AI model download is pinned by commit + SHA-256 (`src/utils/aiService.js:23-28`).

---

*Architecture analysis: 2026-10-10*
