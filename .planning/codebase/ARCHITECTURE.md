<!-- refreshed: 2026-10-18 -->
# Architecture

**Analysis Date:** 2026-10-18

## System Overview

KwestUp Mobile is a **privacy-first, offline-first Expo / React Native app** with two coexisting architectural generations in one tree:

1. **Legacy v3.5 core** — a single `App.js` god component that holds timer, theme, notes, birthdays and user state and prop-drills them into `AppNavigator.js`.
2. **KwestUp 4.0 "Atomic Behavior Engine"** — an incrementally-migrating TypeScript layer (`src/behavior/`, `src/commands/`, `src/ai/`, `src/services/`, `src/domains/`) that adds a deterministic rule engine, domain event bus, habit state machine, command gateway with AI sandboxing, and a unified notification policy service.

```text
┌───────────────────────────────────────────────────────────────────────┐
│                         Platform Entry Points                          │
│  index.js (registerRootComponent + registerWidgetTaskHandler)          │
│  App.js (root component / legacy state owner)                          │
│  widgets/widget-task-handler.tsx (headless Android widget JS context)  │
└───────────────┬───────────────────────────────┬───────────────────────┘
                │                               │
                ▼                               ▼
┌─────────────────────────────┐   ┌───────────────────────────────────────┐
│   Navigation & UI Layer      │   │      Headless Widget Execution        │
│  src/navigation/             │   │  widgets/*.tsx + widget-task-handler  │
│   AppNavigator.js (Drawer)   │   │  (separate JS VM; AsyncStorage only)  │
│  src/screens/*.js (9)        │   └───────────────┬───────────────────────┘
│  src/components/*.js (16)    │                   │
└───────────────┬─────────────┘                   │
                │                                 │
                ▼                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│                State Providers (src/context/*.js)                      │
│  TaskContext · VaultContext · BillingContext · BirthdayContext         │
│  HabitContext (4.0)                                                    │
└───────────────┬───────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────┐
│        4.0 Deterministic Engines & Services (TypeScript)               │
│  behavior/ (eventBus, ruleEngine, habitEngine, recoveryEngine,         │
│             rewardEngine, improvementEngine, cueEngine,                │
│             interventionEngine)                                        │
│  services/notificationService.ts   commands/ (validator, executor,     │
│             aiSandbox, idempotencyStore, useCommandGateway)            │
│  ai/ (intentParser, behaviorCompiler, frictionAnalyzer,                │
│             weeklyReviewEngine, rulePacketRetriever)                   │
│  Source of truth: rulebook/machine/*.json                              │
└───────────────┬───────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                          Persistence Layer                             │
│  AsyncStorage (versioned keys, see src/utils/storage.js)               │
│  expo-file-system `documentDirectory/Notes/Vaults/<id>/` (Markdown)    │
│  On-device GGUF model: documentDirectory/models/*.gguf (llama.rn)      │
└───────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root component | Boot init, legacy global state (timer/theme/notes/birthdays/user), provider tree, confirmation/name/telemetry modals, widget push effects | `App.js` |
| Drawer navigator | 9 drawer routes, mounts `TaskEditModal`/`WeeklyReviewModal`/`AIAssistant`, resolves context-vs-prop fallbacks | `src/navigation/AppNavigator.js` |
| Drawer UI | Sidebar nav, user avatar, theme cycle control | `src/navigation/CustomDrawerContent.js` |
| Task domain | Sole mutation path for tasks/taskLists/dailyTasks; eager write-through persistence; emits domain events | `src/context/TaskContext.js` |
| Vault domain | Vault list, active vault, notes filesystem loading/switching | `src/context/VaultContext.js` |
| Billing domain | Transactions, budgets, recurring bills; persistence owner | `src/context/BillingContext.js` |
| Birthday domain | Birthday CRUD + reminder scheduling/cancellation | `src/context/BirthdayContext.js` |
| Habit domain (4.0) | Habits, identities, behavior events, rewards; isolated versioned storage; recovery state machine | `src/context/HabitContext.js` |
| Pure task engine | Framework-agnostic task transforms, recurrence spawn, merges — shared by context and widget handler | `src/utils/taskMutations.js` |
| Behavior rule engine | Loads `rulebook/machine/*.json`, evaluates `when`/`then` conditions, produces execution traces | `src/behavior/ruleEngine.ts` |
| Domain event bus | Typed pub/sub singleton with 100-event ring buffer, deep-freeze isolation | `src/behavior/eventBus.ts` |
| Habit engine | Habit validation, 2-minute minimum-action compilation, completion, progression | `src/behavior/habitEngine.ts` |
| Recovery engine | "Never Miss Twice" transition + overload risk | `src/behavior/recoveryEngine.ts` |
| Reward engine | Factual milestone rewards (no gamified XP) | `src/behavior/rewardEngine.ts` |
| Improvement engine | Rolling consistency, streak, automaticity scoring | `src/behavior/improvementEngine.ts` |
| Cue engine | Cue validation + habit-stack linking | `src/behavior/cueEngine.ts` |
| Intervention engine | Arbitrates notification vs widget vs in-app surfaces; quiet hours, anti-spam | `src/behavior/interventionEngine.ts` |
| Notification service | Android channels, behavioral policy (cap/gap/dedup/quiet), scheduling + history | `src/services/notificationService.ts` |
| Command gateway | Type-safe dispatch, validation, idempotency, registration | `src/commands/commandExecutor.ts`, `src/commands/commandValidator.ts`, `src/commands/useCommandGateway.ts` |
| AI sandbox | Sanitizes untrusted LLM output before command execution | `src/commands/aiSandbox.ts` |
| On-device AI service | llama.rn context lifecycle, model download + SHA-256 verify, inference helpers | `src/utils/aiService.js` |
| AI intent layer | Intent parsing, behavior compilation, friction analysis, weekly review | `src/ai/*.ts` |
| Logger | Env-aware structured logging + 50-entry forensic ring buffer with PII redaction | `src/utils/logger.js` |
| Error boundary | Root React error catcher with crash-report copy/share | `src/components/ErrorBoundary.js` |

## Pattern Overview

**Overall:** Layered hybrid — **legacy centralized state + prop-drilling** progressively wrapped by a **provider/context domain model** and a **pure deterministic engine + command/event** core.

**Key Characteristics:**
- **Offline-first & local-only**: No cloud backend. Persistence is AsyncStorage + device filesystem. The only network peers are HuggingFace (model download) and LAN sync (`src/utils/syncService.js`).
- **Determinism over AI autonomy**: Behavioral policy lives in machine-readable JSON (`rulebook/machine/*.json`) evaluated by `ruleEngine.ts`; the LLM only extracts intent (`rulebook/README.md` invariants 1–5).
- **Pure engines shared across JS VMs**: `taskMutations.js`, `habitEngine.ts`, `interventionEngine.ts` are imported both by the foreground app and the headless widget handler.
- **Single-writer ownership**: Each domain names exactly one persistence writer (comments in `App.js`, `TaskContext.js`, `HabitContext.js` document the race-elimination rules).
- **Incremental TS migration**: New architecture code is TypeScript-first; screens/contexts remain `.js` with `checkJs: false` (`tsconfig.json`).

## Layers

**Entry / Bootstrap Layer:**
- Purpose: Register root + widget handler, run one-time init and migrations.
- Location: `index.js`, `App.js` (`initializeApp`, `loadData`, `saveData`).
- Contains: Font loading, storage migration, cache clearing, diagnostics.
- Depends on: `src/utils/storage.js`, `src/utils/vaultService.js`, `src/utils/fileStorage.js`.
- Used by: Nothing (root).

**Navigation / Presentation Layer:**
- Purpose: Render drawer routes and screens.
- Location: `src/navigation/`, `src/screens/`, `src/components/`.
- Contains: 9 screens, 16 shared components, drawer content.
- Depends on: Contexts and legacy props passed down from `App.js`.
- Used by: End user.

**State Provider Layer:**
- Purpose: Own per-domain state + mutations.
- Location: `src/context/`.
- Contains: `TaskContext`, `VaultContext`, `BillingContext`, `BirthdayContext`, `HabitContext`.
- Depends on: `src/utils/` persistence helpers, `src/services/`, `src/behavior/`.
- Used by: Screens, `AppNavigator.js`, widget sync components.

**Domain Engine Layer (4.0):**
- Purpose: Deterministic behavioral policy.
- Location: `src/behavior/`, `src/commands/`, `src/ai/`, `src/services/`.
- Contains: Pure engines, event bus, command gateway, notification policy, AI intent/compile.
- Depends on: `rulebook/machine/*.json`, `src/utils/dateUtils.js`, `src/utils/logger.js`.
- Used by: Contexts, widget handler, `AIAssistant`.

**Utilities / Persistence Layer:**
- Purpose: Storage, filesystem, date, crypto, diagnostics, export/import, LAN sync.
- Location: `src/utils/`.
- Contains: Storage migrations, vault/file storage, billing storage, notification helpers, export service, sync service, logger, ID generation.
- Depends on: Expo native modules (`expo-file-system/legacy`, AsyncStorage).
- Used by: All upper layers.

## Data Flow

### Primary Request Path (App boot → Dashboard render)

1. `index.js` calls `registerRootComponent(App)` and `registerWidgetTaskHandler(widgetTaskHandler)` (`index.js:10-11`).
2. `App.js` `initializeApp()` runs a `Promise.all` of version/user/vault/telemetry reads, then sets `isInitialized` and unblocks UI (`App.js:176-248`).
3. Background init fires-and-forgets vault migration + version cache-clear, and dev-only diagnostics (`App.js:220-238`).
4. `loadData()` loads `kwestup_data_${STORAGE_VERSION}`, timer key, theme keys, resets stale daily-task streaks, loads notes from filesystem (`App.js:261-430`).
5. Providers mount: `TaskProvider` → `VaultProvider` → `BillingProvider` → `BirthdayProvider` → `HabitProvider` (`App.js:892-909`).
6. `NavigationContainer` renders `AppNavigator`, which resolves `effectiveX = ctx?.x ?? propX` for each domain (`src/navigation/AppNavigator.js:84-112`).
7. Drawer initially routes to `Dashboard` (`src/navigation/AppNavigator.js:186`, `224-237`).

### Task Mutation & Persistence Path

1. UI calls a context handler, e.g. `toggleTaskComplete(id)` (`src/context/TaskContext.js:208-252`).
2. Handler computes the new array through a pure engine in `src/utils/taskMutations.js` inside a functional `setTasks` updater.
3. `eventBus.emit({ type: 'TASK_COMPLETED', ... })` publishes to subscribers + ring buffer (`src/context/TaskContext.js:238-251`).
4. A 500 ms-debounced write-through effect read-modify-writes the merged snapshot into `kwestup_data_${STORAGE_VERSION}` so sibling domains aren't clobbered (`src/context/TaskContext.js:84-139`).
5. AppState `active` triggers `refreshTasksFromStorage()` to converge with headless widget writes (`src/context/TaskContext.js:142-204`).

### Habit Completion Path (foreground)

1. `HabitContext.completeHabit(id)` calls the pure `completeHabitEngine` (`src/behavior/habitEngine.ts:192`).
2. If the habit was in `recovery`, `handleRecoveryCompletion` restores `active` (`src/behavior/recoveryEngine.ts:73`).
3. `evaluateRewards` grants factual milestones (`src/behavior/rewardEngine.ts:22`).
4. A `HABIT_COMPLETED` behavior event is appended (FIFO-capped at 500) and emitted on the bus (`src/context/HabitContext.js:400-485`).
5. Debounced (400 ms) persistence writes isolated keys: `kwestup_habits_v1`, `kwestup_identities_v1`, `kwestup_behavior_events_v1`, `kwestup_rewards_v1` (`src/context/HabitContext.js:216-256`).

### Headless Widget Action Path

1. Android wakes `widgetTaskHandler` in a **separate JS VM** from the main app (`widgets/widget-task-handler.tsx:27-29`).
2. On `WIDGET_CLICK`, it reads/writes AsyncStorage directly and reuses pure engines (`toggleTask`, `completeHabit`, `evaluateRewards`, `selectWidgetTouchpoint`) (`widgets/widget-task-handler.tsx:128-401`).
3. It emits local `eventBus` events (process-local ring buffer only) and calls `requestWidgetUpdate` to re-render sibling widgets (`widgets/widget-task-handler.tsx:374-395`).
4. Synchronization back to the foreground is achieved through AsyncStorage contents, not shared memory.

### Notification Dispatch Path

1. Callers build a `NotificationDispatchRequest` and call `scheduleNotification()` (`src/services/notificationService.ts:328`).
2. `evaluateNotificationPolicy()` enforces: critical bypass → opt-out → quiet hours (defer) → recurring/non-behavior exemption → daily cap (3) → 90-min min gap → 30-min dedup (`src/services/notificationService.ts:233-321`).
3. On approval `Notifications.scheduleNotificationAsync` fires; history is recorded **only after native success** (`src/services/notificationService.ts:367-378`).

### AI Command Path

1. `AIAssistant` calls `parseGlobalCommand` in `src/utils/aiService.js` (llama.rn).
2. Untrusted model output is sanitized by `sanitizeAiPayload` and executed via `executeAiCommand` (`src/commands/aiSandbox.ts:101,118`).
3. `useCommandGateway` registers default habit handlers and dispatches through `executeCommand` with idempotency keys (`src/commands/useCommandGateway.ts:30-77`, `src/commands/commandExecutor.ts:142`).
4. `commandValidator.ts` enforces capability/schema; execution mutates only via registered handlers (never direct storage from AI).

**State Management:**
- Legacy global state in `App.js` (`useState` + throttled AsyncStorage writes).
- Domain state in React Context providers.
- Cross-domain signaling via singleton `eventBus` (`src/behavior/eventBus.ts:272`).
- Persistence is read-modify-write on versioned AsyncStorage keys plus filesystem vaults.

## Key Abstractions

**Domain Event (`BehaviorEvent` / `DomainEvent`):**
- Purpose: Typed, immutable cross-domain telemetry.
- Examples: `src/behavior/types.ts:167-192`, emitted in `src/context/TaskContext.js`, `src/context/HabitContext.js`, `widgets/widget-task-handler.tsx`.
- Pattern: `{ id, type, entityId, timestamp, payload, source }`, deep-cloned + deep-frozen on emit.

**Machine Behavior Rule (`BehaviorRule`):**
- Purpose: JSON-declared `when`/`then` deterministic constraints with priority + rule IDs.
- Examples: `rulebook/machine/habitRules.json`, `recoveryRules.json`, `rewardRules.json`, `interventionRules.json`, `rules.json`; evaluated in `src/behavior/ruleEngine.ts`.
- Pattern: dot-path condition matching (`evaluateCondition`) supporting arrays, `>=3`, `<0.80`, equality.

**Widget Touchpoint:**
- Purpose: Selected single actionable surface for the home-screen widget.
- Examples: `selectWidgetTouchpoint()` in `src/behavior/interventionEngine.ts:251-336`; consumed by `widgets/HabitWidget.tsx`.
- Pattern: Priority hierarchy recovery → today_due → next_action → standby.

**Command (`DispatchedCommand`):**
- Purpose: Type-safe, validated, idempotent action envelope.
- Examples: `src/commands/types.ts:13-123`, executed in `src/commands/commandExecutor.ts`.
- Pattern: `{ action, payload, idempotencyKey, actor: 'ai'|'user'|'widget'|'engine', confirmed }`.

**Vault:**
- Purpose: Isolated note namespace (AsyncStorage config + filesystem path).
- Examples: `src/utils/vaultService.js` (`getVaultPath` → `documentDirectory/Notes/Vaults/<id>/`), `src/context/VaultContext.js`.
- Pattern: Per-vault Markdown folders/files under sanitized directory names.

**Storage Versioning:**
- Purpose: Safe schema evolution without data loss.
- Examples: `STORAGE_VERSION = "v7.0"`, `APP_VERSION = "v3.5.0"` in `src/utils/storage.js:4-5`; `migrateUserDataIfNeeded` migrates legacy `kwestup_data_v*` keys.
- Pattern: all user data keys prefixed `kwestup_*_<version>`; `isUserDataKey` protects them from cache clears.

## Entry Points

**Native Root:**
- Location: `index.js`
- Triggers: Expo/Metro app launch + Android widget broadcast.
- Responsibilities: Register `App` and `widgetTaskHandler`.

**Application Root:**
- Location: `App.js`
- Triggers: `registerRootComponent(App)`.
- Responsibilities: Boot init, provider tree, legacy domains, confirmation modals.

**Headless Widget Handler:**
- Location: `widgets/widget-task-handler.tsx`
- Triggers: Android widget add/update/resize/click (separate JS VM).
- Responsibilities: Render widgets, mutate storage, complete habits, emit local events.

**Drawer Navigation Root:**
- Location: `src/navigation/AppNavigator.js`
- Triggers: `NavigationContainer` mount.
- Responsibilities: Route registration (`Dashboard`, `Daily`, `Birthdays`, `Billing`, `Tasks`, `Notes`, `Focus`, `Settings`, `Search`), global modals.

## Architectural Constraints

- **Threading:** Single JS thread for the app. Android widget handler runs in a **separate JavaScript runtime** (`widgets/widget-task-handler.tsx:27-29`) — no shared in-memory state; only AsyncStorage is shared.
- **Global state:** Module-level singletons exist in `src/behavior/eventBus.ts` (`export const eventBus = new EventBus()`), `src/utils/logger.js` (`logBuffer`), `src/utils/aiService.js` (`_llamaContext`, `_initPromise`, `_idleTimer`, `_loadGeneration`).
- **Storage keys are versioned**: any new persistent state should add its prefix to `isUserDataKey` in `src/utils/storage.js:8-28` or it will be wiped by `clearAllCaches`.
- **AI cannot mutate storage directly**: all AI actions must route through `src/commands/aiSandbox.ts` → `commandExecutor.ts` (`rulebook/README.md` invariant 2).
- **Cross-domain isolation rule**: `src/domains/README.md` mandates cross-domain communication via events, never direct imports.
- **Babel env-cache**: `babel.config.js` keys its cache on `NODE_ENV` and strips `console.log/info/debug` in production (`babel.config.js:6-17`).
- **Native patches**: `postinstall` runs `patch-llama-gradle.js` (`package.json:18`).

## Anti-Patterns

### Prop-Drilling Through the Navigator

**What happens:** `App.js` passes ~40 individual props into `AppNavigator` (`App.js:912-949`), which then re-resolves each as `ctx?.field ?? propField` (`src/navigation/AppNavigator.js:84-112`).
**Why it's wrong:** Every new domain field requires edits in `App.js`, `AppNavigator` signature, and every screen — a large blast radius and a source of `undefined` fallbacks.
**Do this instead:** Consume context directly inside screens (`useTasks()`, `useVaults()`); keep `AppNavigator` free of domain state. New domains should follow the `HabitContext` pattern rather than extending the prop list.

### Dual State Ownership Between App.js and Contexts

**What happens:** `App.js` still owns timer, theme, notes and birthdays state while `TaskContext`/`VaultContext`/`BillingContext`/`BirthdayContext` own their domains. Several comments document past duplicate writers (e.g. `App.js:750-753`, `App.js:545-547`).
**Why it's wrong:** Two writers on one storage key cause stale-write races and clobbering (the W-01/W-03/DEF-01 fixes).
**Do this instead:** Keep a single writer per storage key; migrate remaining `App.js` domains (timer, notes, theme) into their own contexts.

### God Components / Screens

**What happens:** `src/screens/NotesScreen.js` (2014 lines), `SettingsScreen.js` (1101), `AIAssistant.js` (1096) concentrate many responsibilities.
**Why it's wrong:** Hard to test, review, and safely modify.
**Do this instead:** Extract subcomponents and move logic into `src/utils/` or domain engines as already done for tasks (`taskMutations.js`) and habits (`habitEngine.ts`).

### Optional-Chained Context With Silent Fallbacks

**What happens:** `AppNavigator` uses `taskCtx?.handleSaveTask` and logs `console.warn` when missing (`src/navigation/AppNavigator.js:123-129, 391-399`).
**Why it's wrong:** Missing providers fail silently at runtime instead of loudly at development time.
**Do this instead:** Require the context (throw in the `useX` hook, as `useHabits` does in `src/context/HabitContext.js:632-638`) rather than fall back.

### Mixed `.js` / `.ts` Without `checkJs`

**What happens:** TypeScript is `strict: true` but `checkJs: false` (`tsconfig.json:18`), so ~1152 pre-existing JS errors are unchecked across screens/contexts.
**Why it's wrong:** Type errors in `.js` files are invisible to `npm run typecheck`.
**Do this instead:** Place new logic in `.ts` files under the 4.0 layer; migrate high-risk utilities to `.ts` incrementally.

## Error Handling

**Strategy:** Defensive — never crash, degrade gracefully, log safely.

**Patterns:**
- Root React error catch + crash-report copy/share in `src/components/ErrorBoundary.js` (wraps the whole app in `App.js:890-1106`).
- Try/catch with `logger.warn`/`logger.error` in every storage/service call (e.g. `src/utils/vaultService.js:56-59`, `src/services/notificationService.ts:166-169`).
- Event-listener isolation: `eventBus.emit` catches sync throws and async rejections so one bad subscriber can't break dispatch (`src/behavior/eventBus.ts:179-220`).
- Atomic rollback on partial native scheduling failure (`scheduleBirthdayReminders`, `src/services/notificationService.ts:595-605`).
- Notification history pruned to 48 h and corrupt JSON resets to `[]` (`src/services/notificationService.ts:151-170`).

## Cross-Cutting Concerns

**Logging:** `src/utils/logger.js` — env-aware (`debug`/`info` silenced in production), 50-entry FIFO ring buffer, recursive PII redaction on `SENSITIVE_KEYS` regex, string truncation, WeakSet cycle guard.

**Validation:** Schema/condition validation at the boundaries — `commandValidator.ts`, `evaluateCondition` in `ruleEngine.ts`, `validateSyncConfig` in `src/utils/syncService.js`, `validateHabitCreation` in `habitEngine.ts`.

**Authentication:** No accounts. LAN sync uses a shared token validated in `src/utils/syncService.js:67-69`; backups use PBKDF2-HMAC-SHA256 (100k iterations) AES-256 envelopes in `src/utils/exportService.js:21-40`.

**Date handling:** All calendar logic funnels through `src/utils/dateUtils.js` (`getLocalDateString`, `parseLocalDate`, etc.) to avoid UTC slicing bugs.

**Privacy:** Rulebook invariant — zero cloud transmission of user content; telemetry is opt-in launch/platform counters only (`App.js:150-153`, `src/utils/diagnostics.js`).

---

*Architecture analysis: 2026-10-18*
