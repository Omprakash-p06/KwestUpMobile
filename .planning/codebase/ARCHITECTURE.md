# Architecture

**Analysis Date:** 2026-10-11

## Overview

**Pattern: local-first offline-first monolith with pure deterministic domain engines + headless widget process.**

- All user data lives on-device (`AsyncStorage` + `expo-file-system`); network is only LAN peer sync (`src/utils/syncService.js`) and opt-in telemetry. No cloud DB/auth (`PROJECT.md` Core Value; `rulebook/rules/privacy.md`).
- `App.js` (~1118 lines) is the root composition: boot/migrate → global `useState` (theme, vault, timer, birthday) → nests 5 domain providers → `NavigationContainer` + `AppNavigator`. New 4.0 behavior stack (`src/behavior/*.ts`, `src/commands/types.ts`, `rulebook/`) is pure TypeScript with no React/storage imports — testable in Node/Jest.
- Cross-domain communication goes through a frozen in-memory event bus (`src/behavior/eventBus.ts`, 100-event ring buffer), never direct domain-to-domain imports (`src/domains/README.md` rule).
- Android widgets run in a **separate headless JS process** (`widgets/widget-task-handler.tsx` + `registerWidgetTaskHandler` in `index.js`); state sync with the app is via `AsyncStorage` only, with throttled/staggered `requestWidgetUpdate` pushes from `App.js` to avoid Binder flooding.

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Boot / composition root | `index.js`, `App.js` | Register root + widget task handler; font/theme init; versioned load/migrate/save; provider nesting; widget push effects; timer loop; sync orchestration |
| Navigation | `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js` | Drawer navigator over 9 screens; notification channel init; passes App-level state + callbacks as props |
| Screens (feature UI) | `src/screens/*.js` (9 files) | Dashboard, Notes, TaskList, DailyTasks, Birthdays, FocusTimer, Billing, Search, Settings — read contexts, render `src/components/*` |
| Presentation / theme | `src/components/*.js` (15 files), `src/theme/colors.js`, `src/theme/styles.js` | Reusable UI (TaskCard, TaskEditModal, ErrorBoundary, LiquidGlass*); 5 theme names × light/dark/amoled |
| Domain state providers | `src/context/TaskContext.js`, `VaultContext.js`, `BillingContext.js`, `BirthdayContext.js`, `HabitContext.js` | Own one domain's state + persistence; sole mutation path (e.g. tasks exclusively via `TaskContext` → `taskMutations.js`) |
| Pure behavior engines | `src/behavior/habitEngine.ts`, `cueEngine.ts`, `recoveryEngine.ts`, `rewardEngine.ts`, `improvementEngine.ts`, `ruleEngine.ts`, `interventionEngine.ts`, `types.ts` | Deterministic habit/cue/recovery/reward math governed by `rulebook/machine/*.json`; no I/O |
| Event bus / telemetry | `src/behavior/eventBus.ts` | Singleton `eventBus.emit/subscribe`, monotonic IDs, deep-freeze immutability, 100-event buffer, `useDomainEvents` hook |
| Command contract (future sandbox) | `src/commands/types.ts`, `src/domains/README.md` (placeholder) | `CommandAction` union (CREATE/LOG/PAUSE/…_HABIT), typed payloads; `src/domains/` not yet materialized |
| Device services | `src/services/notificationService.ts`, `src/utils/aiService.js`, `src/services/types.ts` | Unified notification channels/policy gates; on-device llama.rn lifecycle (SHA-256 pinned, heuristic fallback) |
| Persistence / utils | `src/utils/storage.js`, `vaultService.js`, `fileStorage.js`, `billingStorage.js`, `taskMutations.js`, `dateUtils.js`, `syncService.js`, `exportService.js`, `logger.js`, `diagnostics.js` | Versioned AsyncStorage keys (`STORAGE_VERSION="v7.0"`), vault FS, date engine, LAN sync, encrypted export, ring-buffer logger |
| Headless widgets | `widgets/*.tsx`, `widgets/widget-task-handler.tsx`, `android/` | 5 widgets (FocusTimer, DailyTasks, ImportantTasks, TasksList, HabitWidget); headless toggle/complete actions reusing engines + AsyncStorage |

## Data Flow

### Habit mutation → event → intervention → widget

1. Mutation originates in `HabitContext` (`src/context/HabitContext.js`) calling a pure engine (`completeHabit` in `src/behavior/habitEngine.ts`, recovery in `src/behavior/recoveryEngine.ts`) → computes new habit + `BehaviorEvent`.
2. Context persists to versioned keys (`kwestup_habits_v1`, `kwestup_behavior_events_v1` capped at 500) with 400 ms debounce, then emits typed event via `eventBus.emit({ type: 'HABIT_COMPLETED', … })` (`src/behavior/eventBus.ts`).
3. `interventionEngine.ts` (`selectWidgetTouchpoint`, `isInQuietHours`, `calculateQuietHoursDeferral`) arbitrates multi-surface delivery using `rulebook/machine/interventionRules.json` (anti-spam, quiet hours 22:00–08:00 → defer 08:15, max/day, dedup windows).
4. App-side `HabitWidgetSync` (`App.js:77-102`) calls `selectWidgetTouchpoint(habits)` → `requestWidgetUpdate({ widgetName: 'HabitWidget' })` rendering `widgets/HabitWidget.tsx` with Today/Next/Don't-Miss-Twice cue.
5. Headless path: widget tap → `widgets/widget-task-handler.tsx` (separate JS env) → re-reads `HABITS_STORAGE_KEY` from AsyncStorage, re-runs same engines (`completeHabit`, `evaluateRewards`, `handleRecoveryCompletion`), writes back, emits to local bus copy, pushes re-render. AsyncStorage is the sync point, not shared memory.

### Task mutation (unified path)

1. Screen/widget action → `TaskContext` (`src/context/TaskContext.js`) → authoritative `toggleTask`/recurrence in `src/utils/taskMutations.js` (single path; `App.js` duplicates removed per C-02 comment).
2. Eager write-through to `kwestup_data_v7.0`; `App.js:saveData` merges-only (`{...stored, ...dataToSave}`) so periodic saves never clobber fresh task data (W-01).
3. `App.js` staggered/throttled effects push slices to widgets: ImportantTasks = first 5 unfinished important; TasksList = sorted 8; 5 s throttle + 250–500 ms stagger + active-only guard.

### App boot / persistence

1. `index.js` → `registerRootComponent(App)` + `registerWidgetTaskHandler(widgetTaskHandler)`.
2. `App.js:initializeApp` — parallel reads (`kwestup_last_version`, userName, vaults, active vault, telemetry opt-in) → `initNotesFolder` → fire-and-forget `migrateToVaultSystem` + version-cache clear → `setIsInitialized`.
3. `loadData` — `migrateUserDataIfNeeded` → read `kwestup_data_v7.0` + timer/theme/widget-tab keys → daily-task streak rollover via `getLocalDateString()` (`src/utils/dateUtils.js`) → notes from FS per active vault (`getAllNotesFromFilesystem`).
4. Saves are decoupled: main data (15 s throttle), timer state (dedicated `kwestup_timer_state_v7.0` key), theme (separate keys), billing (owned by `BillingContext` only, W-03).

### Notification dispatch

`notificationService.ts` centralizes channels (`kwestup_system` etc.), priority rules, quiet-hours deferral and dedup; birthday reschedule-on-boot and focus-complete (`FOCUS_COMPLETED` event + `scheduleNotification`) originate in `App.js`.

## Entry Points

| Entry | File | Trigger → Responsibility |
|---|---|---|
| JS root | `index.js` | Expo launch → registers `App` + headless `widgetTaskHandler` |
| App composition | `App.js` (default export) | Cold start / foreground reload (`AppState` listener → `loadData`) → init, providers, timer loop, sync, widget pushes |
| Navigation root | `src/navigation/AppNavigator.js` | Inside providers → drawer routes to 9 screens; inits notification channels/permissions |
| Habit sync bridge | `HabitWidgetSync` in `App.js:77` | `useHabits()` change while active → HabitWidget push (350 ms debounce) |
| Headless widget runtime | `widgets/widget-task-handler.tsx` | Home-screen tap / OS widget refresh → AsyncStorage read → engine reuse → widget re-render |
| LAN sync | `handleExecuteSync` in `App.js:769` + `src/utils/syncService.js` | Settings action → `performSync` → wipe/rewrite vault FS notes, reschedule birthday alarms, overwrite state |

## Key Decisions

| Decision | Evidence | Rationale / Outcome |
|---|---|---|
| Local-first, no cloud | `PROJECT.md` Core Value + Constraints; `rulebook/rules/privacy.md` | Privacy differentiator; sync stays LAN P2P |
| Pure TS behavior engines, JS legacy shell | `src/behavior/*.ts` (no RN imports) vs `src/screens|context/*.js`; `PROJECT.md` Out-of-Scope (no full TS rewrite) | Incremental typing without disruptive rewrite |
| Single task-mutation path | `src/utils/taskMutations.js` + `TaskContext.js`; `App.js` C-02/W-01 comments | Fixes widget-vs-app divergence (ARCH-02) |
| Event bus over direct imports | `src/behavior/eventBus.ts` + `src/domains/README.md` isolation rule | Decouples habit/billing/birthday/timer telemetry |
| Rulebook-governed behavior (JSON + MD) | `rulebook/machine/*.json`, `rulebook/atomic-habits/`, `rulebook/rules/`; engines cite rule IDs | Auditable behavior contracts (GOV-01) |
| Versioned storage + migration | `src/utils/storage.js` (`STORAGE_VERSION="v7.0"`, `migrateUserDataIfNeeded`, `clearAllCaches`) | Safe upgrades across 13+ phases |
| Central local-date engine | `src/utils/dateUtils.js` (`getLocalDateString`) used in `App.js`, widgets, engines | Kills UTC calendar bugs (DATE-01/02) |
| Binder-flood guards | `App.js` throttles (15 s save, 5 s widget), slicing (5/8 tasks), stagger timers, active-only rule | Stability on NothingOS/sensitive devices |
| Structured logging + ErrorBoundary | `src/utils/logger.js` (ring buffer, strips console in release), `src/components/ErrorBoundary.js` | Production observability (OBS-01/02) |

---
*Architecture analysis: 2026-10-11*
