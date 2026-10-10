# Architecture

**Analysis Date:** 2026-10-11

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              Provider Shell + Navigation Layer               │
│  `App.js` → `src/navigation/AppNavigator.js`                 │
│  (Drawer: 9 screens + global TaskEditModal + AIAssistant)    │
├──────────────────┬──────────────────┬───────────────────────┤
│  Presentation    │  Domain State    │  Headless / External  │
│  `src/screens/`  │  `src/context/`  │  `widgets/` +         │
│  `src/components/`│ + `src/utils/`  │  `src/services/`      │
│                  │  pure engines    │  `src/utils/aiService`│
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Event + Policy Backbone (KwestUp 4.0)           │
│  `src/behavior/eventBus.ts` + `src/behavior/types.ts`        │
│  `src/commands/types.ts` + `src/services/types.ts`           │
│  (`src/domains/` — placeholder, README only)                 │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Persistence (versioned AsyncStorage + vault markdown files) │
│  `src/utils/storage.js` (`kwestup_*_v7.0` keys)               │
│  `src/utils/fileStorage.js` + `src/utils/vaultService.js`    │
│  (`FileSystem.documentDirectory/Notes/Vaults/<vaultId>/`)    │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App root | Boot sequence, provider nesting, theme resolution, timer loop, sync orchestration, widget refresh | `App.js` |
| JS entry | Registers root component + headless widget task handler | `index.js` |
| Drawer navigator | 9 routes, context-to-prop bridging, global `TaskEditModal` + `AIAssistant` overlays | `src/navigation/AppNavigator.js` |
| Drawer UI | Drawer items, user header, light/dark/amoled cycle toggle | `src/navigation/CustomDrawerContent.js` |
| Task state | Sole writer of `tasks`/`taskLists`/`dailyTasks` keys; debounced write-through persistence; emits `TASK_*` events | `src/context/TaskContext.js` |
| Vault state | Vault list + active vault + active note; reads markdown files via `fileStorage` | `src/context/VaultContext.js` |
| Billing state | Transactions/budgets/recurring bills; emits `BILL_*` events | `src/context/BillingContext.js` |
| Birthday state | Birthday CRUD + reminder scheduling; emits `BIRTHDAY_*` events | `src/context/BirthdayContext.js` |
| Pure task engine | Framework-agnostic mutations + recurrence math, shared by app and widget handler | `src/utils/taskMutations.js` |
| Domain event bus | Typed + wildcard pub/sub, frozen events, 100-event ring buffer, `useDomainEvent` hook | `src/behavior/eventBus.ts` |
| Notification service | Channel init, scheduling, behavioral policy gate (cap 3/day, 90-min gap, quiet hours) | `src/services/notificationService.ts` |
| On-device AI | llama.rn lifecycle (Qwen2.5-0.5B), idle unload, task/birthday/transaction extraction | `src/utils/aiService.js` |
| LAN sync | Ping + `POST /sync` handshake with desktop server, payload validation | `src/utils/syncService.js` |
| Widget handler | Headless entry for 4 Android widgets; toggles tasks via `taskMutations` + AsyncStorage | `widgets/widget-task-handler.tsx` |
| Theming | 5 theme names × 3 modes (`light`/`dark`/`amoled`); `currentTheme` object prop-drilled to every screen | `src/theme/colors.js` |
| Shared styles | Central `StyleSheet` factory consumed by screens/components | `src/theme/styles.js` |
| Logging | Env-aware logger + 50-entry PII-redacted forensic ring buffer | `src/utils/logger.js` |
| Crash containment | Class-component boundary wrapping the whole provider tree | `src/components/ErrorBoundary.js` |

## Pattern Overview

**Overall:** Context-Provider state management over a Drawer-navigated Expo app, with pure-function engines shared between the foreground app and a headless widget runtime, plus an event-sourced 4.0 backbone (event bus + command types + policy types) being built underneath the existing context layer.

**Key Characteristics:**
- Single `App.js` composition root owns boot, theme, timer, and cross-cutting UI state; four domain contexts own entity state.
- All task transformations are pure functions in `src/utils/taskMutations.js` so the headless widget process (separate JS environment, no React state) reuses identical logic.
- Cross-domain communication for new 4.0 behavior flows through `eventBus` (`src/behavior/eventBus.ts`); legacy flows still use direct imports and prop callbacks.
- Persistence is versioned (`STORAGE_VERSION = "v7.0"` in `src/utils/storage.js`); structured data lives in AsyncStorage under `kwestup_*` keys, note bodies live as markdown files under `Notes/Vaults/<vaultId>/`.
- `src/domains/` is a reserved boundary placeholder — only `src/domains/README.md` exists; all domain types currently live in `src/behavior/types.ts` and `src/commands/types.ts`.

## Layers

**Presentation (screens + components):**
- Purpose: Render routes and reusable UI; screens are thin and receive state/handlers via props from `AppNavigator`.
- Location: `src/screens/`, `src/components/`
- Contains: 9 screens (`DashboardScreen`, `DailyTasksScreen`, `BirthdaysScreen`, `BillingScreen`, `TaskListScreen`, `NotesScreen` at `src/screens/NotesScreen.js` — largest at ~2013 lines, `FocusTimerScreen`, `SettingsScreen`, `SearchScreen`); 14 components including `AIAssistant`, `Task EditModal`, `TaskCard`, `QRScannerModal`, liquid-glass visuals.
- Depends on: `src/context/*` (via `AppNavigator` prop bridging), `src/theme/*`, `src/utils/*`, `src/services/*`.
- Used by: `src/navigation/AppNavigator.js` exclusively.

**Navigation:**
- Purpose: Drawer routing plus bridging context values into screen props and hosting global overlays.
- Location: `src/navigation/`
- Contains: `AppNavigator.js` (route table, `onTaskCreated`/`onBirthdayCreated`/`onTransactionCreated` bridges, `TaskEditModal` + `AIAssistant` overlays), `CustomDrawerContent.js` (drawer items, theme cycler).
- Depends on: All four contexts, `src/services/notificationService.ts`, `src/utils/dateUtils.js`, `src/utils/billingStorage.js`.
- Used by: `App.js`.

**Domain state (contexts):**
- Purpose: Own one entity domain each; sole persistence writers for their keys; emit domain events.
- Location: `src/context/`
- Contains: `TaskContext.js`, `VaultContext.js`, `BillingContext.js`, `BirthdayContext.js` — each exposes a `*Provider` plus a `use*` hook.
- Depends on: Pure engines in `src/utils/` (`taskMutations`, `billingStorage`, `vaultService`, `fileStorage`), `src/services/notificationService.ts`, `src/behavior/eventBus.ts`.
- Used by: `App.js` (providers) and `src/navigation/AppNavigator.js` (consumers).

**Pure engines + side-effect services (utils + services):**
- Purpose: Framework-agnostic business logic (`taskMutations`, `dateUtils`, `storage`, `vaultService`, `billingStorage`, `fileStorage`, `exportService`, `syncService`, `diagnostics`, `billingNotifications`, `notifications`, `vaultImport`) plus the typed notification dispatch engine (`src/services/notificationService.ts`, `src/services/types.ts`).
- Location: `src/utils/`, `src/services/`
- Contains: Stateless transforms (no React imports — safe for headless use) alongside Expo side-effect wrappers (FileSystem, Sharing, DocumentPicker, Notifications).
- Depends on: `src/utils/logger.js`, `src/utils/dateUtils.js`, `expo-*` SDKs, `@react-native-async-storage/async-storage`.
- Used by: Contexts, screens (via context), widgets, `App.js`.

**Event/policy backbone (4.0):**
- Purpose: Decouple future habit/AI domains via events and idempotent commands; enforce notification policy centrally.
- Location: `src/behavior/`, `src/commands/`, `src/services/types.ts`, `src/domains/` (reserved)
- Contains: `eventBus.ts` (singleton `eventBus`, `generateEventId`, `useDomainEvent`), `types.ts` (Identity, Habit, Cue, Intervention, BehaviorEvent, FactualReward, BehaviorRule), `src/commands/types.ts` (`CommandAction` union of 12 actions, `CommandPayload`, `DispatchedCommand` with required `idempotencyKey`), `DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY` (max 3/day, 90-min gap, quiet 22:00–08:00, 30-min dedup, kill-switch).
- Depends on: `src/utils/logger.js` only (intentionally dependency-light).
- Used by: Contexts emit events today (`TASK_*`, `BILL_*`, `BIRTHDAY_*`, `FOCUS_*`, `WIDGET_ACTION`); no subscribers in production paths yet — habit/intervention consumers arrive with Phases 22–28.

**Persistence:**
- Purpose: Versioned key-value store plus vault-scoped markdown files; migration across storage versions.
- Location: AsyncStorage keys + `FileSystem.documentDirectory`, accessed via `src/utils/storage.js`, `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/billingStorage.js`.
- Contains: `kwestup_data_v7.0` aggregate blob, `kwestup_userName/theme/timer/activeVault/vaults/billing/widget/telemetry/ai_model` keys, per-vault markdown trees, AES-256 backup envelopes (`src/utils/exportService.js`).
- Depends on: `@react-native-async-storage/async-storage`, `expo-file-system`.
- Used by: Contexts and `App.js` boot/migration; widget handler reads/writes the same keys headlessly.

**Headless widget surface:**
- Purpose: Four Android home-screen widgets operable while the app is killed.
- Location: `widgets/`
- Contains: `FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx`, `widget-task-handler.tsx` (registered from `index.js` via `registerWidgetTaskHandler`).
- Depends on: `src/utils/taskMutations.js`, `src/utils/storage.js`, `src/utils/dateUtils.js`, `src/utils/logger.js`, `src/behavior/eventBus.ts` (local-buffer only — separate JS env, sync via AsyncStorage).
- Used by: Android host; never imported by screens.

## Data Flow

### Primary Request Path

1. User acts in a screen — e.g. toggling a task in `src/screens/TaskListScreen.js` calls `toggleTaskComplete` received as props (`src/navigation/AppNavigator.js:280`).
2. `AppNavigator` resolves the handler from `TaskContext` (`src/navigation/AppNavigator.js:89`) — context is required, no prop fallbacks.
3. `TaskContext` applies the pure transform from `src/utils/taskMutations.js`, emits a frozen domain event via `eventBus.emit` (`src/context/TaskContext.js` imports `src/behavior/eventBus.ts`), and schedules a debounced write-through to `kwestup_data_v7.0`.
4. React state update re-renders subscribed screens; `App.js` effects request a widget refresh (`requestWidgetUpdate` in `App.js:56-60`) and `notificationService` cancels/reschedules the task's reminder.

### Boot / Initialization Flow

1. `index.js` registers `App` + `widgetTaskHandler` with Expo and `react-native-android-widget`.
2. `App.js:initializeApp` (`App.js:148`) runs: `migrateUserDataIfNeeded` → load aggregate blob + settings + vaults + billing → `initNotesFolder` / `migrateToVaultSystem` → `initNotificationChannels` + permission request → diagnostics/telemetry opt-in check.
3. Hydrated values flow into `useState` hooks and then as `initial*` props into the four providers (`App.js:866-883`); `TaskContext` syncs `initial*` into live state via effects (`src/context/TaskContext.js:46-62`).
4. `NavigationContainer` mounts `AppNavigator` on `initialRouteName="Dashboard"` (`src/navigation/AppNavigator.js:223`).

### Headless Widget Mutation Flow

1. User taps a widget action; Android invokes `widgetTaskHandler` (`widgets/widget-task-handler.tsx:77`) in a separate JS environment.
2. Handler reads `kwestup_data_v7.0` from AsyncStorage directly, applies `toggleTask` from `src/utils/taskMutations.js` (imported at `widgets/widget-task-handler.tsx:11`), writes back, and emits a `WIDGET_ACTION` event into its process-local `eventBus` buffer.
3. Handler calls `requestWidgetUpdate` to re-render; the foreground app picks up the change on next foreground read — there is no live bridge between the two JS environments.

### AI Extraction Flow

1. `AIAssistant` overlay (`src/components/AIAssistant.js`, mounted in `AppNavigator.js:377-394`) captures note content and calls `src/utils/aiService.js` (llama.rn, on-device Qwen2.5-0.5B, 5-min idle unload).
2. Extracted titles/dates invoke `onTaskCreated` / `onBirthdayCreated` / `onTransactionCreated` bridges (`src/navigation/AppNavigator.js:120-178`), which delegate to `taskCtx.handleSaveTask`, `birthdayCtx.handleSaveBirthday`, or `billingCtx.addTransactionAction`.
3. Each context persists, schedules notifications, and emits the corresponding domain event.

### LAN Sync Flow

1. `SettingsScreen` (`src/screens/SettingsScreen.js`) scans a QR code (`src/components/QRScannerModal.js`) to obtain `{ ip, port, token }`.
2. `performSync` (`src/utils/syncService.js:135`) validates config, pings `/ping`, then `POST`s `{ notes, tasks, taskLists, birthdays, themeMode, selectedThemeName, userName }` to `/sync` with `Bearer` auth.
3. `validateSyncPayload` (`src/utils/syncService.js:82`) rejects responses missing `notes`/`tasks`/`birthdays` arrays to prevent accidental wipes; validated data replaces context state and persists.

**State Management:**
- Four React contexts own entity state; `App.js` owns cross-cutting UI state (theme mode/name, timer, confirmation/confetti dialogs, `userName`, `searchQuery`, sync status, telemetry flag) and passes it down as ~30 props to `AppNavigator`.
- No Redux/Zustand/MobX; no server state — AsyncStorage + markdown files are the source of truth, contexts are the in-memory cache, `eventBus` is the append-only observation channel (100-event ring buffer via `getRecentEvents`).

## Key Abstractions

**Context-as-repository:**
- Purpose: Each domain context is the exclusive mutation path and sole persistence writer for its keys.
- Examples: `src/context/TaskContext.js`, `src/context/BillingContext.js`, `src/context/BirthdayContext.js`, `src/context/VaultContext.js`
- Pattern: `createContext` + `*Provider({ initial* })` + `use*()` hook + `showConfirmationDialog` injection; mutations = pure transform → `setState` → debounced AsyncStorage write → `eventBus.emit` → notification side-effect.

**Pure mutation engine:**
- Purpose: Testable, headless-safe transforms with zero React/Expo dependencies.
- Examples: `src/utils/taskMutations.js` (`toggleTask`, `completeTask`, `saveTask`, `calculateNextRecurrence`, list CRUD)
- Pattern: `(currentState, args) => newState`; callers own persistence and events.

**Frozen domain events:**
- Purpose: Tamper-proof observation records with deep-cloned, deep-frozen payloads and isolated listener execution (a throwing listener never breaks siblings or the emitter).
- Examples: `src/behavior/eventBus.ts:144-223`, `src/behavior/types.ts:88-133`
- Pattern: `eventBus.emit({ type, entityId, source, metadata?, payload? })`; subscribe via `eventBus.subscribe(type, fn)` or `useDomainEvent(type, fn)`; history via `getRecentEvents(limit)` capped at `MAX_EVENT_BUFFER_SIZE = 100`.

**Idempotent commands (4.0 forward-contract):**
- Purpose: AI/widget callers dispatch intent; executor dedups on `idempotencyKey`.
- Examples: `src/commands/types.ts:13-118` (`CREATE_HABIT` … `RESUME_HABIT`, `CommandPayload<A>` conditional, `CommandExecutionResult` with `requestId` echo)
- Pattern: `DispatchedCommand<A> = { action, payload, idempotencyKey }` → validate → execute → `CommandExecutionResult`. No executor implementation exists yet — types only.

**Vault-scoped notes:**
- Purpose: Obsidian-style multi-vault markdown notes on the device filesystem.
- Examples: `src/utils/vaultService.js` (`getVaultPath`, `ensureVaultsDir`, vault CRUD), `src/utils/fileStorage.js` (`initNotesFolder`, `saveNoteFile`, `getAllNotesFromFilesystem`), `src/utils/vaultImport.js`
- Pattern: Config in AsyncStorage (`kwestup_vaults_v7.0`), bodies as `.md` files under `Notes/Vaults/<vaultId>/`; `VaultContext` is the read/write façade.

**Theme object:**
- Purpose: Single `currentTheme` object drives every color in the app.
- Examples: `src/theme/colors.js` (`themes[name][mode]`, 5 names × 3 modes), resolved with fallback in `App.js:143-146`
- Pattern: `resolveThemeMode`/`resolveThemeName` guards → `themes[x][y] ?? themes.dribbble.light` → prop-drill `currentTheme` into every screen/component.

## Entry Points

**Expo root component:**
- Location: `App.js` (registered by `index.js:10`)
- Triggers: App cold start / reload.
- Responsibilities: Font loading, boot migration + hydration, provider nesting, theme resolution, focus-timer interval, birthday reschedule, widget refresh, sync handlers, confirmation/confetti/timer-lockout overlays.

**Headless widget handler:**
- Location: `widgets/widget-task-handler.tsx:77` (registered by `index.js:11`)
- Triggers: Android widget lifecycle events and widget button taps while the app may be killed.
- Responsibilities: Read AsyncStorage snapshot, apply `taskMutations`, write back, re-render widget. Must stay dependency-light (no React state, no Navigation).

**Drawer routes (9):**
- Location: `src/navigation/AppNavigator.js:221-362`
- Triggers: Drawer taps, deep navigation state changes.
- Responsibilities: `Dashboard`, `Daily`, `Birthdays`, `Billing`, `Tasks`, `Notes`, `Focus`, `Settings`, `Search` — each a full screen module under `src/screens/`.

**Notification tap / background delivery:**
- Location: `src/services/notificationService.ts` (channels init in `AppNavigator.js:74-77`, scheduling from contexts)
- Triggers: OS alarm fires, user taps notification.
- Responsibilities: Route to channel handlers; birthday/billing/task reminders rehydrate from AsyncStorage payloads.

**LAN sync server (inbound client side):**
- Location: `src/utils/syncService.js:135` (`performSync`), invoked from `SettingsScreen` via `App.js:handleExecuteSync`
- Triggers: User initiates sync after QR scan.
- Responsibilities: Ping, authenticated push/pull, payload validation, state replacement.

## Architectural Constraints

- **Threading:** Single JS thread for the foreground app; widget handler runs in a separate headless JS environment on Android — never share in-memory singletons across the boundary, only AsyncStorage.
- **Global state:** Module-level singletons exist — `eventBus` (`src/behavior/eventBus.ts:272`), `_llamaContext`/`_initPromise`/`_loadGeneration` (`src/utils/aiService.js:34-40`), `logBuffer` (`src/utils/logger.js`), timer/confirmation refs (`App.js:104-136`). Treat them as process-local.
- **Circular imports:** None detected between layers; the enforced direction is screens → navigation → contexts → utils/services → storage, with `src/behavior/` depended upon but depending on nothing except `src/utils/logger.js`. `src/domains/README.md` mandates future domains communicate via events, never direct cross-domain imports.
- **Type checking:** `checkJs` is `false` (`tsconfig.json:12`) — `.js` files are untyped at compile time; only `.ts`/`.tsx` (`src/behavior/`, `src/commands/`, `src/services/`, `widgets/`) are strictly checked. New 4.0 contracts must be TypeScript.
- **JS-only platform path:** Primary target is Android via Expo + dev-client + EAS (`app.json`, `eas.json`); iOS is `supportsTablet`-only with no widget surface; web is `expo start --web` fallback.
- **Storage version coupling:** Every persistence key embeds `STORAGE_VERSION` (`v7.0`); bump requires a migration path in `migrateUserDataIfNeeded` (`src/utils/storage.js:69`).

## Anti-Patterns

### Prop-drilling from App root through Navigator

**What happens:** `App.js` holds ~30 pieces of UI state and passes them one-by-one into `AppNavigator` (`App.js:884-921`), which re-forwards them into each screen (`src/navigation/AppNavigator.js:221-362`).
**Why it's wrong:** Every new cross-cutting prop touches two files and all nine screen call-sites; stale mirrors (e.g. `tasks` in both `App.js` state and `TaskContext`) risk divergence.
**Do this instead:** Follow the established `TaskContext` precedent (`src/navigation/AppNavigator.js:79-94` — context-required, no prop fallbacks) and migrate remaining App-level state into contexts or small hooks.

### God-component App root

**What happens:** `App.js` is 1085 lines covering boot, theme, timer loop, sync, widgets, telemetry, dialogs, and effects.
**Why it's wrong:** Unrelated concerns share render scope and effect ordering; a timer-loop regression can block boot readability and vice versa.
**Do this instead:** Extract cohesive hooks alongside existing service modules — e.g. `useFocusTimer` over `src/services/notificationService.ts` scheduling, `useBootSequence` over `src/utils/storage.js` + `src/utils/vaultService.js` — keeping `App.js` as composition only.

### Mixed JS/TS without a migration path documented in code

**What happens:** Legacy layers are untyped `.js` while 4.0 contracts are strict `.ts`; `tsconfig.json` excludes `App.js`, `index.js`, and `widgets/` from type-checking with inline rationale.
**Why it's wrong:** Type errors in the largest files (`NotesScreen`, `App.js`, widget surface) are invisible to `npm run typecheck`.
**Do this instead:** Keep all new code TypeScript under `src/behavior/`, `src/commands/`, `src/services/`, `src/domains/` per the `src/domains/README.md` rule that domain types live in `src/behavior/types.ts` and `src/commands/types.ts`; convert high-risk JS utilities first (as noted in `tsconfig.json:10-12`).

## Error Handling

**Strategy:** Contain at the boundary, log with forensics, never lose user data on failure paths.

**Patterns:**
- `ErrorBoundary` (`src/components/ErrorBoundary.js`) wraps the provider tree — crash shows a themed fallback with copyable diagnostics built from the logger ring buffer, plus restart hint.
- `eventBus` isolates listeners: sync throws and async rejections are caught, logged via `logger.error`, and never propagate to the emitter or sibling listeners (`src/behavior/eventBus.ts:179-220`).
- Sync and storage paths fail closed: `validateSyncPayload` throws on missing arrays to prevent wipes (`src/utils/syncService.js:82-102`); migration functions return `false` and log instead of throwing (`src/utils/storage.js:183-186`).
- `logger.error`/`logger.warn` always reach the native console even in production; `debug`/`info` are `__DEV__`-gated but always buffered (`src/utils/logger.js`).

## Cross-Cutting Concerns

**Logging:** Use `logger` from `src/utils/logger.js` (`debug`/`info`/`warn`/`error`); never raw `console.*` (stripped in production via `babel-plugin-transform-remove-console`). Sensitive values are key-pattern redacted before buffering — never log note bodies, passphrases, or tokens verbatim.
**Validation:** Validate at trust boundaries — `validateSyncConfig`/`validateSyncPayload` (`src/utils/syncService.js`), theme guards (`App.js:68-72`), command payloads per `CommandValidationResult` (`src/commands/types.ts:100-103`), notification policy gate (`PolicyEvaluationResult` in `src/services/types.ts:48-54`).
**Authentication:** No user auth; LAN sync uses a QR-provisioned bearer token (`Authorization: Bearer` in `src/utils/syncService.js:169`) with minimum-length enforcement; backups use AES-256 + PBKDF2 passphrases (`src/utils/exportService.js`).

---

*Architecture analysis: 2026-10-11*
