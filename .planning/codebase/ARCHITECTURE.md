# Architecture

**Analysis Date:** 2026-10-11

## Overview

**Pattern: local-first offline-first monolith with deterministic pure-TS behavior core + gated AI command pipeline + headless widget process.**

- All user data stays on-device: `AsyncStorage` (structured state) + `expo-file-system` (vault `.md` notes). Network is LAN-only peer sync (`src/utils/syncService.js`) plus opt-in telemetry (`src/utils/diagnostics.js`). No cloud DB/auth — per `.planning/PROJECT.md` Core Value and `rulebook/rules/privacy.md`.
- `App.js` (~1118 lines) is the root composition: versioned boot/migrate → global `useState` (theme, vault, timer, birthdays) → nests 5 domain providers (`Task → Vault → Billing → Birthday → Habit`) → `NavigationContainer` + `AppNavigator`. Contexts own their domains; `App.js` still owns cross-cutting concerns (timer loop, widget pushes, sync orchestration, save throttles).
- 4.0 behavior stack is pure TypeScript with no React/storage imports: `src/behavior/*.ts` (engines), `src/commands/*.ts` (gateway + sandbox, Phase 26), `src/ai/*.ts` (intent → compile, Phase 27), governed by `rulebook/` contracts (`manifest.json`, `machine/*.json`). Testable in Node/Jest (`__tests__/unit/`).
- Two JS runtimes: main app process and Android headless widget process (`widgets/widget-task-handler.tsx`, registered in `index.js`). They share engine code and `AsyncStorage` keys but never share in-memory state (eventBus is per-process).

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Entry / composition | `index.js`, `App.js` | Register root + widget handler; boot, migrate, theme/fonts, providers, timer, sync, widget pushes |
| Navigation | `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js` | Drawer routes (9 screens), notification channel init, context-vs-prop resolution, `TaskEditModal` + `AIAssistant` mount |
| UI screens | `src/screens/*.js` (9 files) | Dashboard, Notes, TaskList, DailyTasks, Birthdays, Billing, FocusTimer, Search, Settings |
| UI components | `src/components/*.js` (15 files) | `AIAssistant`, `TaskEditModal`, `TimerLockoutOverlay`, `ErrorBoundary`, `LiquidGlassBackground`, primitives |
| Domain state | `src/context/*.js` (5 files) | `TaskContext`, `VaultContext`, `BillingContext`, `BirthdayContext`, `HabitContext.js` — owned mutations + versioned persistence |
| Behavior engines (pure) | `src/behavior/*.ts` (9 files) | `habitEngine`, `cueEngine`, `recoveryEngine`, `rewardEngine`, `ruleEngine`, `interventionEngine`, `improvementEngine`, `eventBus`, `types` |
| Command gateway (Phase 26) | `src/commands/*.ts` (7 files) | `types` (11-action registry), `commandValidator`, `commandExecutor` (idempotency + telemetry), `aiSandbox`, `habitCommandHandlers`, `useCommandGateway`, barrel `index` |
| AI intent chain (Phase 27) | `src/ai/*.ts` (6 files) | `types`, `rulePacketRetriever` (keyword RAG, ≤3 rules, 200-char cap), `heuristicParser` (offline regex), `intentParser` (Qwen via llama.rn + heuristic fallback), `behaviorCompiler` (plan + command + sandboxed execute), barrel `index` |
| Services | `src/services/notificationService.ts`, `src/services/types.ts`, `src/utils/aiService.js` | Notification channels/policy dispatch; LLM model lifecycle (download, SHA-256 verify, idle unload, AppState mgmt) |
| Legacy utils / mutations | `src/utils/*.js` (14 files) | `storage` (version keys), `taskMutations`, `fileStorage`, `vaultService`, `syncService`, `dateUtils`, `diagnostics`, `exportService`, `logger` |
| Theming | `src/theme/colors.js`, `src/theme/styles.js` | 5 themes × 3 modes, shared StyleSheet |
| Widgets (headless) | `widgets/*.tsx` (6 files) | 5 render widgets + `widget-task-handler.tsx` (separate JS env, AsyncStorage-sync) |
| Rules contracts | `rulebook/` (`atomic-habits/`, `ai/`, `rules/`, `machine/*.json`, `examples/`, `manifest.json`) | Human-readable law docs + machine-enforced JSON rules consumed by `ruleEngine` |
| Domain scaffold (future) | `src/domains/README.md` | Reserved per-domain isolation boundary (Phases 22–28); cross-domain via events only |

## Data Flow

### App boot → hydrate → render

1. `index.js` registers `App` + `widgetTaskHandler`.
2. `App.js:initializeApp` reads `kwestup_last_version`, `kwestup_userName_*`, vaults, telemetry opt-in; `initNotesFolder()`; fire-and-forget `migrateToVaultSystem()` + cache clear (`App.js:178-256`).
3. `App.js:loadData` reads `kwestup_data_v7.0` + timer/theme keys, resets daily-task streaks, loads notes from filesystem per active vault, reschedules birthday notifications (`App.js:265-434`).
4. Providers hydrate independently: `HabitContext.js` reads `kwestup_habits_v1` / `_behavior_events_v1` / `_identities_v1` / `_rewards_v1`; `TaskContext`/`BillingContext` own their keys. Renders `AppNavigator` drawer.

### Task mutation (unified path)

1. Screen calls `TaskContext` op → `src/utils/taskMutations.js` pure mutation + notification schedule.
2. Context write-through persists to `AsyncStorage`; `App.js:saveData` merge-writes only its owned domains (birthdays/notes/theme) so it never clobbers task data (`App.js:458-496`).
3. Relevant effects push throttled widget updates (`requestWidgetUpdate`, 5 s throttle, staggered 250–500 ms splits to avoid Binder overflow, `App.js:596-686`).

### Behavior event telemetry

1. Domain transitions emit via `eventBus.emit({type, entityId, source, payload})` — e.g. `FOCUS_COMPLETED` in `App.js:740-747`, `COMMAND_EXECUTED`/`COMMAND_FAILED` in `src/commands/commandExecutor.ts:217-249`.
2. `src/behavior/eventBus.ts`: singleton, typed + wildcard listeners, deep-clone + deep-freeze events, 100-event FIFO ring buffer, listener errors isolated/logged. Hook `useDomainEvent(type, listener)` for screens.
3. Headless caveat: widget process has its own in-memory bus (`widgets/widget-task-handler.tsx:27-29`); cross-process sync is `AsyncStorage` only.

### Intervention delivery (3 surfaces)

1. `src/behavior/interventionEngine.ts:arbitrateNotificationIntervention` evaluates `rulebook/machine/interventionRules.json` (priority: `REMINDER_ANTI_SPAM_001` ≥3/day → widget fallback; `QUIET_HOURS_001` 22:00–08:00 → defer 08:15; `REMINDER_MIN_GAP_001` <90 min → throttle).
2. `selectWidgetTouchpoint(habits)` hierarchy `WIDGET_PRIORITY_001`: recovery → today-due → next-action (2-min) → standby; subtitle truncated to 80 chars (`WIDGET_SUBTITLE_MAX_LENGTH`).
3. `arbitrateInAppIntervention` prompts only on recovery/today-due. Delivery via `src/services/notificationService.ts`, `requestWidgetUpdate`, in-app banners.

### AI intent → behavior compile → sandbox → gateway → event bus

1. **Retrieve:** `src/ai/rulePacketRetriever.ts:retrieveRulePacket` keyword-scans input, returns ≤3 rule snippets formatted to ≤200 chars for prompt injection.
2. **Parse:** `src/ai/intentParser.ts:parseUserIntent` clamps to 500 chars → `forceHeuristic` short-circuit → `isModelDownloaded()` check → Qwen2.5-0.5B via `src/utils/aiService.js:loadModel` (temp 0.1, 120 tokens, 15 s timeout) → JSON extract; **every** failure path falls back to `src/ai/heuristicParser.ts:parseIntentHeuristic` (regex action/frequency/time/cue/anchor/location/minimum-action extraction, confidence 0.85; LLM path 0.95).
3. **Compile:** `src/ai/behaviorCompiler.ts:compileIntentToCommand` maps `ExtractedIntent.action` (11-action union shared with `src/commands/types.ts`) to a typed `DispatchedCommand` with generated `idempotencyKey`, `actor:'ai'`; `compileIntentToHabitPlan` enforces `HABIT_CONCURRENT_CAP_001` (≤3), derives identity (`deriveIdentityStatement`), 2-min action (`habitEngine.generateMinimumAction`), cue struct. Destructive `DELETE/ARCHIVE_HABIT` flagged `requiresConfirmation`.
4. **Sandbox:** `src/commands/aiSandbox.ts:executeAiCommand` parses raw JSON → `sanitizeAiPayload` (drops `__proto__/constructor/prototype`, rejects `kwestup_*` key injection, path traversal, non-plain objects/functions) → destructive confirmation gate (`SYS_AI_CONFIRMATION_GATE_001`) → forwards to gateway with `actor:'ai'`. `compileAndExecuteIntent` adds the same gate before dispatch.
5. **Gateway:** `src/commands/commandExecutor.ts:executeCommand` validates (`commandValidator` schema + capability: AI cannot set engine-owned `status`), dedups via 200-entry/15-min TTL idempotency cache (`SYS_IDEMPOTENT_COMMAND_001`), dispatches to registered handler (`habitCommandHandlers.ts` bridges to `HabitContext` ops + pure engines), emits `COMMAND_EXECUTED`/`COMMAND_FAILED` on `eventBus`.
6. **UI entry:** `useCommandGateway()` (`src/commands/useCommandGateway.ts`) binds handlers to live `HabitContext` on mount; `dispatchCommand` (typed UI/widget path) vs `dispatchAiCommand` (untrusted path through sandbox). `AIAssistant.js` (legacy modal, `src/utils/aiService` direct calls) predates the gateway; new AI flows go through `parseUserIntent → compileIntentToCommand → executeAiCommand → executeCommand`.

### Widget headless flow

1. System event → `widgets/widget-task-handler.tsx` (own JS env) reads `AsyncStorage` directly (habits, tasks, timer), runs pure engines (`completeHabit`, `evaluateRewards`, `handleRecoveryCompletion`, `selectWidgetTouchpoint`, `toggleTask`), writes back, emits local `eventBus` (in-process only).
2. Re-renders via `requestWidgetUpdate({widgetName, renderWidget})` per widget (`FocusTimer`, `DailyTasks`, `ImportantTasks`, `TasksList`, `HabitWidget.tsx`).
3. Foreground reload: `App.js` AppState listener re-`loadData()` on active; `HabitWidgetSync` pushes `selectWidgetTouchpoint` render within 350 ms of habit change.

### Persistence keys (AsyncStorage)

- Legacy bundle: `kwestup_data_v7.0`, `kwestup_timer_state_v7.0`, `kwestup_userName_v7.0`, `kwestup_theme_mode/name_v7.0`, `kwestup_last_version`, `kwestup_widget_active_tab`, `kwestup_telemetry_optin`, `kwestup_billing_*`, `kwestup_vaults_*`, `kwestup_activeVault_*`, `kwestup_ai_model_*` (see `src/utils/storage.js:isUserDataKey`).
- Behavior domain (isolated, Phase 24): `kwestup_habits_v1`, `kwestup_behavior_events_v1` (capped 500), `kwestup_identities_v1`, `kwestup_rewards_v1`, `kwestup_interventions_*` (see `src/context/HabitContext.js:35-39`).
- Notes live in filesystem per vault (`src/utils/fileStorage.js`, `src/utils/vaultService.js`); sync (`src/utils/syncService.js`) wipes + rewrites active-vault files on pull.

## Entry Points

| Entry | Location | Trigger | Responsibility |
|---|---|---|---|
| JS root | `index.js:10-11` | Expo runtime | `registerRootComponent(App)` + `registerWidgetTaskHandler(widgetTaskHandler)` |
| App composition | `App.js:104` | App launch | Boot, providers, navigation, timer, sync, widgets |
| Drawer navigator | `src/navigation/AppNavigator.js:30-67` | Render after hydrate | 9-screen drawer + notification channel init + modal mounts |
| Widget headless | `widgets/widget-task-handler.tsx` | System widget tap/refresh | Offline task/habit toggles in isolated JS env |
| Command gateway (UI) | `src/commands/useCommandGateway.ts:29-76` | Any screen/AI UI with `HabitContext` | Typed `dispatchCommand` / sandboxed `dispatchAiCommand` |
| AI pipeline | `src/ai/index.ts` (barrel) | `AIAssistant` / future habit UI | `parseUserIntent` → `compileIntentToCommand`/`compileAndExecuteIntent` |
| Sync | `App.js:handleExecuteSync:769-847` via `src/utils/syncService.js:performSync` | Settings LAN sync | Pull → wipe vault FS → rewrite notes → reschedule birthdays |
| Notifications | `src/services/notificationService.ts` | Engines / contexts | Channel-priority dispatch with quiet-hours/rate policy |

## Key Decisions

| Decision | Source | Outcome |
|---|---|---|
| Local-first, no cloud accounts | `.planning/PROJECT.md` Constraints; `rulebook/rules/privacy.md` | All state on-device; sync is LAN peer only |
| Pure deterministic behavior engines | `src/behavior/*.ts` header comments; `4.0/` master plan §5 | Engines import no React/storage; Jest-testable, shared by app + headless widget |
| Machine rules as JSON evaluated at runtime | `rulebook/machine/*.json` + `src/behavior/ruleEngine.ts` | Policy changes without code edits; `rulesApplied` audit trail on every decision |
| Finite 11-action command registry + validator | `src/commands/types.ts`, `commandValidator.ts` (Phase 26) | Closed action set; AI can never invent storage/OS operations |
| AI sandbox between LLM and storage | `src/commands/aiSandbox.ts` (Phase 26) | Sanitization + confirmation gate; handlers are the only storage writers |
| Always-fallback intent parser | `src/ai/intentParser.ts` + `heuristicParser.ts` (Phase 27) | LLM optional; heuristics guarantee offline function with zero throws |
| Idempotent gateway with telemetry | `src/commands/commandExecutor.ts` | 200-entry/15-min dedup kills double-tap duplicates; every execution emits bus event |
| Isolated behavior storage keys (`*_v1`) | `src/context/HabitContext.js:35-39`; `src/utils/storage.js:8-27` | Habit domain survives legacy `clearAllCaches`; migration-safe |
| Headless widget duplicates engine logic via AsyncStorage | `widgets/widget-task-handler.tsx:27-29`, `App.js:441-456` | Widgets work with app killed; cost is dual code paths, no shared memory |
| Domains communicate via events, never imports | `src/domains/README.md` | Future boundary; current cross-domain calls still partly direct (migration in progress) |
| Incremental TS: new code TS, legacy stays JS | `.planning/PROJECT.md` Out of Scope | `src/behavior|commands|ai|services/*.ts` typed; screens/contexts remain `.js` |

---
*Architecture analysis: 2026-10-11*
