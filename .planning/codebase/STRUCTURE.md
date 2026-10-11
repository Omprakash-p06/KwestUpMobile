# Structure

**Analysis Date:** 2026-10-11

## Directory Tree

```
KwestUpMobile/                  # Expo SDK 57 / RN 0.86 / React 19 repo root
├── App.js                      # Root composition (~1118 lines): boot, providers, timer, sync, widgets
├── index.js                    # JS entry: registerRootComponent(App) + widget task handler
├── app.json / eas.json         # Expo + EAS build config
├── package.json / jest.config.js / tsconfig.json
├── src/
│   ├── ai/                     # Phase 27: types, heuristicParser, intentParser,
│   │                           #   rulePacketRetriever, behaviorCompiler, index (barrel)
│   ├── behavior/               # Pure engines: habitEngine, cueEngine, recoveryEngine,
│   │                           #   rewardEngine, ruleEngine, interventionEngine,
│   │                           #   improvementEngine, eventBus, types
│   ├── commands/               # Phase 26 gateway: types, commandValidator, commandExecutor,
│   │                           #   aiSandbox, habitCommandHandlers, useCommandGateway, index
│   ├── context/                # 5 providers: Task, Vault, Billing, Birthday, HabitContext
│   ├── navigation/             # AppNavigator.js (drawer + modals), CustomDrawerContent.js
│   ├── screens/                # 9 screens: Dashboard, Notes, TaskList, DailyTasks,
│   │                           #   Birthdays, Billing, FocusTimer, Search, Settings
│   ├── components/             # 15 comps: AIAssistant, TaskEditModal, TimerLockoutOverlay,
│   │                           #   ErrorBoundary, LiquidGlass*, primitives
│   ├── services/               # notificationService.ts, types.ts (channels + policy dispatch)
│   ├── utils/                  # 14 legacy JS: storage, taskMutations, fileStorage,
│   │                           #   vaultService, syncService, aiService, dateUtils, logger…
│   ├── domains/                # Scaffold only: README.md boundary rules (Phases 22–28)
│   └── theme/                  # colors.js (5 themes × 3 modes), styles.js
├── widgets/                    # 5 render widgets + widget-task-handler.tsx (headless)
├── rulebook/                   # atomic-habits/ (24 docs), ai/ (5), rules/ (7),
│                               #   machine/*.json (5), examples/ (7), manifest.json
├── android/                    # Native shell: app/, gradle/, settings.gradle
├── __tests__/                  # unit/ (23 suites), phase12-widget-logic, setup/
├── .planning/                  # PROJECT.md, ROADMAP.md, phases/, codebase/ (this doc)
└── 4.0/                        # KwestUp_4.0_Master_Plan.md (4.0 architecture source)
```

## Key Files

| Path | Purpose |
|---|---|
| `index.js` | Dual registration: `registerRootComponent(App)` + `registerWidgetTaskHandler(widgetTaskHandler)` |
| `App.js` | Boot/migrate, global state (theme/vault/timer/birthdays), 5 nested providers, `NavigationContainer`, save throttles, widget pushes, `HabitWidgetSync` |
| `src/navigation/AppNavigator.js` | Drawer (9 routes), notification channel init, context-vs-prop resolution, mounts `AIAssistant` + `TaskEditModal` |
| `src/context/HabitContext.js` | Habit domain store; keys `kwestup_habits_v1`, `kwestup_behavior_events_v1` (cap 500), `kwestup_identities_v1`, `kwestup_rewards_v1`; emits bus telemetry |
| `src/context/TaskContext.js` | Sole task-mutation path (wraps `src/utils/taskMutations.js`); write-through persistence |
| `src/context/VaultContext.js` + `src/utils/fileStorage.js` + `src/utils/vaultService.js` | Multi-vault `.md` filesystem notes |
| `src/behavior/eventBus.ts` | Singleton typed event bus, 100-event FIFO, `useDomainEvent` hook |
| `src/behavior/habitEngine.ts` | Habit CRUD/complete/plan compile, cap + 2-min rules, entity IDs |
| `src/behavior/interventionEngine.ts` | 3-surface arbitration; `WIDGET_SUBTITLE_MAX_LENGTH = 80` |
| `src/behavior/ruleEngine.ts` | Loads `rulebook/machine/*.json`, evaluates contexts → `rulesApplied` |
| `src/commands/types.ts` | 11-action `CommandAction` union + per-action payload map, `DispatchedCommand` (requires `idempotencyKey`) |
| `src/commands/commandExecutor.ts` | Gateway: validate → idempotency dedup (200 entries / 15-min TTL) → handler → bus emit |
| `src/commands/commandValidator.ts` | Schema + capability validation (AI barred from engine-owned `status`) |
| `src/commands/aiSandbox.ts` | `sanitizeAiPayload` + `executeAiCommand`; destructive gate `SYS_AI_CONFIRMATION_GATE_001` |
| `src/commands/habitCommandHandlers.ts` | Bridges gateway actions → `HabitContext` ops + pure engines |
| `src/commands/useCommandGateway.ts` | React hook: registers handlers on mount; `dispatchCommand` / `dispatchAiCommand` |
| `src/ai/types.ts` | `ExtractedIntent`, `RulePacket`, `CompilationResult`, parser/compiler options |
| `src/ai/rulePacketRetriever.ts` | Keyword RAG: ≤3 rules, 200-char prompt packet |
| `src/ai/heuristicParser.ts` | Offline regex parser (`normalizeTimeString`, action/frequency/cue/anchor extraction) |
| `src/ai/intentParser.ts` | Qwen via `aiService.loadModel` (500-char clamp, 120 tokens, 15 s timeout) with heuristic fallback on every failure |
| `src/ai/behaviorCompiler.ts` | `compileIntentToHabitPlan` / `compileIntentToCommand` / `compileAndExecuteIntent`; identity archetypes, cap + confirmation gates |
| `src/services/notificationService.ts` | Channel init, permission, scheduled dispatch consumed by engines |
| `src/utils/aiService.js` | LLM lifecycle: download, SHA-256 verify, `loadModel`/`unloadModel`, idle timer, AppState subscribe |
| `src/utils/storage.js` | `APP_VERSION`, `STORAGE_VERSION v7.0`, `isUserDataKey`, cache clear, cross-version migration |
| `src/utils/taskMutations.js` | Authoritative task recurrence/completion shared by app + widgets |
| `src/utils/dateUtils.js` | Local-date engine (`getLocalDateString`) — no UTC slicing |
| `widgets/widget-task-handler.tsx` | Headless runtime: reads/writes `AsyncStorage` directly, runs engines, re-renders widgets |
| `widgets/HabitWidget.tsx` | Behavioral cue widget (recovery → today → next-action → standby) |
| `rulebook/manifest.json` | 44 human docs + 5 machine JSON rule sets, versions + review dates |
| `rulebook/machine/rules.json` + `habitRules.json` + `interventionRules.json` + `recoveryRules.json` + `rewardRules.json` | Machine-enforced policy consumed by `ruleEngine` |
| `.planning/PROJECT.md` | Product intent, validated/active requirements (GOV/AI/CMD/BEH phases), constraints |
| `.planning/ROADMAP.md` | 28 phases across 3 milestones; Phase 26 (gateway) + 27 (intent parser) + 25/28 in progress |

## Module Map

| Domain | Files |
|---|---|
| App shell | `index.js`, `App.js`, `src/navigation/AppNavigator.js`, `src/navigation/CustomDrawerContent.js` |
| Habits + behavior | `src/behavior/*.ts` (9), `src/context/HabitContext.js`, `widgets/HabitWidget.tsx` |
| AI intent chain | `src/ai/*.ts` (6), `src/utils/aiService.js`, `src/components/AIAssistant.js` |
| Command gateway | `src/commands/*.ts` (7) |
| Interventions | `src/behavior/interventionEngine.ts`, `src/services/notificationService.ts`, `widgets/*.tsx` |
| Tasks | `src/context/TaskContext.js`, `src/utils/taskMutations.js`, `src/screens/TaskListScreen.js`, `src/screens/DailyTasksScreen.js`, `src/components/TaskCard.js`, `src/components/TaskEditModal.js`, `widgets/TasksListWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx` |
| Notes / vaults | `src/context/VaultContext.js`, `src/screens/NotesScreen.js`, `src/utils/fileStorage.js`, `src/utils/vaultService.js`, `src/utils/vaultImport.js` |
| Birthdays / reminders | `src/context/BirthdayContext.js`, `src/screens/BirthdaysScreen.js`, `src/utils/notifications.js`, `src/utils/billingNotifications.js` |
| Billing | `src/context/BillingContext.js`, `src/screens/BillingScreen.js`, `src/utils/billingStorage.js` |
| Focus timer | `src/screens/FocusTimerScreen.js`, `src/components/TimerLockoutOverlay.js`, `widgets/FocusTimerWidget.tsx` (+ `App.js` timer loop) |
| Sync / export | `src/utils/syncService.js`, `src/utils/exportService.js`, `src/components/QRScannerModal.js` |
| Search / dashboard / settings | `src/screens/SearchScreen.js`, `src/screens/DashboardScreen.js`, `src/screens/SettingsScreen.js` |
| Cross-cutting | `src/theme/colors.js`, `src/theme/styles.js`, `src/utils/logger.js`, `src/utils/dateUtils.js`, `src/utils/diagnostics.js`, `src/components/ErrorBoundary.js` |
| Rules / policy | `rulebook/**`, `4.0/KwestUp_4.0_Master_Plan.md` |
| Future isolation | `src/domains/README.md` (no code yet — boundary rules only) |

## Generated/Build Artifacts

| Path | Ignore? | Notes |
|---|---|---|
| `node_modules/` | Yes — never edit | RN/Expo deps; `llama.rn`, `react-native-android-widget` native bridges |
| `android/build/`, `android/app/build/` | Yes — generated | Gradle outputs; `patch-llama-gradle.js` re-applies native patch on build |
| `build/` | Yes — generated | EAS/local build output |
| `coverage/` | Yes — generated | Jest coverage report output |
| `.freebuff/` | Yes — scratch | Local tooling scratch space |
| `assets/` (fonts/images) | No — committed source | Bundled fonts (`Inter`, `HankenGrotesk`, `JetBrainsMono` loaded in `App.js`) |
| `rulebook/machine/*.json` | No — source of truth | Policy; edits change runtime behavior via `ruleEngine` — review date in `manifest.json` |
| `__tests__/unit/*` | No — source | 23 suites incl. `aiSandbox`, `behaviorCompiler`, `commandGateway`, `commandIntegration`, `intentParser`, `eventBus` |
| `.planning/**` | No — committed docs | `PROJECT.md` / `ROADMAP.md` / `phases/` are planning source; this map lives in `.planning/codebase/` |

---
*Structure analysis: 2026-10-11*
