# Structure

**Analysis Date:** 2026-10-11

## Directory Tree

```
KwestUpMobile/                  # Expo SDK 57 / RN 0.86 / React 19 repo root
├── App.js                      # Root composition (~1118 lines): boot, state, providers, sync, widgets
├── index.js                    # JS entry: registerRootComponent(App) + widget task handler
├── app.json / eas.json         # Expo + EAS build config
├── src/                        # All app source (JS legacy + 4.0 TS behavior core)
│   ├── behavior/               # Pure TS deterministic engines (habit, cue, recovery, reward, intervention, eventBus, ruleEngine, types)
│   ├── commands/               # Command registry types only (sandbox planned Phase 26)
│   ├── components/             # 15 shared RN components (TaskCard, modals, ErrorBoundary, LiquidGlass*)
│   ├── context/                # 5 domain providers (Task, Vault, Billing, Birthday, Habit)
│   ├── domains/                # Placeholder: README only, per-domain isolation planned
│   ├── navigation/             # Drawer navigator + custom drawer content
│   ├── screens/                # 9 drawer screens (Dashboard, Notes, Tasks, Birthdays, Timer, Billing, …)
│   ├── services/               # notificationService.ts + types (channels, policy gates)
│   ├── theme/                  # colors.js (5 themes × 3 modes) + styles.js
│   └── utils/                  # 14 modules: storage, vault/FS, sync, export, AI, date, logger, …
├── widgets/                    # 5 Android widgets (TSX) + headless widget-task-handler.tsx
│   ├── FocusTimerWidget.tsx / DailyTasksWidget.tsx / ImportantTasksWidget.tsx
│   ├── TasksListWidget.tsx / HabitWidget.tsx (behavioral cues: Today/Next/Recovery)
│   └── widget-task-handler.tsx  # Headless tap actions (512 lines, AsyncStorage-synced)
├── android/                    # Native shell (2 levels: app/, gradle/; src/ for widget receivers)
│   ├── app/                    # build.gradle, proguard-rules.pro, src/, debug.keystore
│   └── gradle/ + gradlew(.bat), settings.gradle, build.gradle
├── rulebook/                   # Behavioral governance (human MD + machine JSON)
│   ├── atomic-habits/          # 24 law/pattern docs (habit-loop, 2-min rule, never-miss-twice, …)
│   ├── rules/                  # 8 enforcement docs (creation, missed-habit, overload, privacy, widgets, …)
│   ├── ai/                     # 5 AI docs (intent-parser, habit-compiler, adaptation, …)
│   ├── machine/                # 5 JSON contracts (habitRules, interventionRules, recoveryRules, …)
│   └── examples/               # 7 worked examples (sleep, study, exercise, …)
├── __tests__/                  # Jest suites (2 levels: setup/, unit/)
│   ├── setup/                  # jest.setup.js + self-test
│   └── unit/                   # aiService, dateUtils, behaviorRuleEngine, behavioralWidget, … tests
├── .planning/                  # GSD planning (PROJECT.md, ROADMAP.md, phases/20-25, codebase/)
├── 4.0/                        # KwestUp 4.0 master plan docs
└── assets/ build/ coverage/    # Static assets + local build/test output (ignored)
```

## Key Files

| Path | Purpose |
|---|---|
| `index.js` | JS entry: registers `App` and headless `widgetTaskHandler` |
| `App.js` | Boot/migrate/load/save, 5 providers, drawer nav host, timer loop, LAN sync, widget pushes |
| `src/navigation/AppNavigator.js` | Drawer routes (9 screens), notification channel init, context wiring |
| `src/context/HabitContext.js` | Habit/identity/event/reward state; `kwestup_habits_v1` + `kwestup_behavior_events_v1` (cap 500); emits bus events |
| `src/context/TaskContext.js` | Sole task-mutation path wrapping `src/utils/taskMutations.js` |
| `src/context/VaultContext.js` / `BirthdayContext.js` / `BillingContext.js` | Notes-vault FS state / birthday alarms / billing persistence |
| `src/behavior/eventBus.ts` | Singleton typed bus: monotonic IDs, deep-freeze, 100-event buffer, React hook |
| `src/behavior/types.ts` | Habit/Cue/BehaviorEvent/Intervention/WidgetTouchpoint domain types |
| `src/behavior/interventionEngine.ts` | Multi-surface arbitration: quiet-hours, anti-spam, `selectWidgetTouchpoint` |
| `src/behavior/habitEngine.ts` / `cueEngine.ts` / `recoveryEngine.ts` / `rewardEngine.ts` / `improvementEngine.ts` / `ruleEngine.ts` | Habit CRUD/compile/complete; cue matching; never-miss-twice recovery; factual rewards; consistency/streak/automaticity; JSON rule evaluation |
| `src/commands/types.ts` | `CommandAction` union + typed payloads (AI sandbox contract, Phase 26) |
| `src/services/notificationService.ts` | Unified channels, priority, quiet-hours deferral, dedup/rate limits |
| `src/utils/storage.js` | `STORAGE_VERSION="v7.0"`, versioned keys, `migrateUserDataIfNeeded`, `clearAllCaches` |
| `src/utils/dateUtils.js` | `getLocalDateString()` central date engine |
| `src/utils/taskMutations.js` | Authoritative task toggle/recurrence shared by app + widgets |
| `src/utils/syncService.js` | LAN P2P sync (`performSync`) with PC companion |
| `src/utils/fileStorage.js` / `vaultService.js` | Per-vault markdown FS (`initNotesFolder`, `getAllNotesFromFilesystem`); vault registry |
| `src/utils/aiService.js` | llama.rn lifecycle: pinned SHA-256, memory mgmt, heuristic fallback |
| `src/utils/logger.js` | Structured ring-buffer logger, release console stripping |
| `widgets/widget-task-handler.tsx` | Headless widget actions reusing engines via AsyncStorage |
| `widgets/HabitWidget.tsx` | Behavioral widget (Today/Next/Recovery touchpoint) |
| `rulebook/manifest.json` + `machine/*.json` | Machine-readable behavior contracts consumed by `ruleEngine.ts` |
| `app.json` / `eas.json` / `babel.config.js` / `metro.config.js` | Expo/EAS/bundler config |
| `jest.config.js` / `__tests__/setup/jest.setup.js` | Jest + native-mock setup |

## Module Map

| Domain | Files |
|---|---|
| Habits / behavior core | `src/behavior/habitEngine.ts`, `cueEngine.ts`, `recoveryEngine.ts`, `rewardEngine.ts`, `improvementEngine.ts`, `ruleEngine.ts`, `types.ts`; `src/context/HabitContext.js`; `rulebook/atomic-habits/*`, `rulebook/rules/habit-*.md`, `rulebook/machine/habitRules.json` + `recoveryRules.json` + `rewardRules.json` |
| Behavior events / telemetry | `src/behavior/eventBus.ts`; `BEHAVIOR_EVENTS_STORAGE_KEY` in `src/context/HabitContext.js`; `IDENTITIES/REWARDS_STORAGE_KEY` |
| Interventions (notify/widget/in-app) | `src/behavior/interventionEngine.ts`; `src/services/notificationService.ts`; `rulebook/machine/interventionRules.json`; `rulebook/rules/reminders.md` + `widgets.md`; `widgets/HabitWidget.tsx` |
| Widgets / headless | `widgets/*.tsx` (5 widgets); `widgets/widget-task-handler.tsx`; `App.js` widget effects + `HabitWidgetSync`; `android/app/src/` receivers |
| Tasks | `src/context/TaskContext.js`; `src/utils/taskMutations.js`; `src/screens/TaskListScreen.js` + `DailyTasksScreen.js`; `src/components/TaskCard.js` + `TaskEditModal.js`; `widgets/TasksListWidget.tsx` + `ImportantTasksWidget.tsx` + `DailyTasksWidget.tsx` |
| Notes / vaults | `src/context/VaultContext.js`; `src/utils/fileStorage.js` + `vaultService.js` + `vaultImport.js`; `src/screens/NotesScreen.js`; FS vault dirs per `activeVaultId` |
| Birthdays / reminders | `src/context/BirthdayContext.js`; `src/screens/BirthdaysScreen.js`; `src/utils/notifications.js` + `billingNotifications.js`; `scheduleCustomBirthdayReminders` call sites in `App.js` |
| Billing / finance | `src/context/BillingContext.js`; `src/utils/billingStorage.js` + `billingNotifications.js`; `src/screens/BillingScreen.js` |
| Focus timer | `App.js` timer state/loop; `src/screens/FocusTimerScreen.js`; `src/components/TimerLockoutOverlay.js`; `widgets/FocusTimerWidget.tsx`; `FOCUS_COMPLETED` bus event |
| Sync / export | `src/utils/syncService.js`; `src/components/QRScannerModal.js`; `src/utils/exportService.js` (AES-256 `.kwestup`); `App.js:handleExecuteSync` |
| On-device AI | `src/utils/aiService.js`; `src/components/AIAssistant.js`; `src/commands/types.ts`; `rulebook/ai/*` (intent-parser, habit-compiler, …) |
| Theming / UI shell | `src/theme/colors.js` + `styles.js`; `src/components/LiquidGlass*.js`, `Custom*.js`; `src/navigation/CustomDrawerContent.js`; `src/screens/DashboardScreen.js` + `SettingsScreen.js` + `SearchScreen.js` |
| Cross-cutting | `src/utils/logger.js`; `src/components/ErrorBoundary.js`; `src/utils/diagnostics.js`; `src/utils/dateUtils.js` |

## Generated/Build Artifacts

| Path | Ignore? | Notes |
|---|---|---|
| `node_modules/` | Yes — never edit | Restored via `npm ci` (Node ≥22.13) |
| `android/build/`, `android/app/build/`, `build/` | Yes — never edit/commit | Gradle + EAS outputs; see `.gitignore` |
| `coverage/` | Yes | Jest `--coverage` output |
| `*.kwestup` exports | Yes (user data) | Encrypted backups produced by `exportService.js` |
| `expo/` caches, `.expo/` | Yes | `expo start -c` clears |
| `eslint-report.json` | Yes | `npm run lint:report` output, gitignored |
| `android/app/debug.keystore` | Committed debug key only | Do not replace with release keys |
| `patch-llama-gradle.js` output | N/A | `postinstall` patch; edit the script, not patched Gradle files |
| `src/domains/` contents (when scaffolded) | No — source | Currently README-only; future per-domain modules live here |

---
*Structure analysis: 2026-10-11*
