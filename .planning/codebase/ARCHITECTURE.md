# Architecture

**Analysis Date:** 2026-09-28 — Phase 19 of 19 complete (Milestone 2 complete, 100%).

## Overview

KwestUpMobile is a local-first, privacy-preserving personal productivity app built on React Native / Expo (managed workflow, `registerRootComponent` in `index.js`). All user data lives on-device: structured state in `AsyncStorage` under versioned keys (`kwestup_*_${STORAGE_VERSION}`, currently `v7.0` in `src/utils/storage.js`), note markdown as real files under `Notes/Vaults/<vaultId>/` via `expo-file-system`, and an optional on-device LLM (Qwen2.5-0.5B GGUF via `llama.rn`) for summarization/task extraction. There are no cloud accounts or third-party backends; the only network paths are opt-in LAN sync to a user-run PC server (`src/utils/syncService.js`), an opt-in anonymous launch telemetry event, a GitHub-releases update check, and the one-time HuggingFace model download — diagnostics probes are dev-gated (`__DEV__`).

Composition root is `App.js` (1067 lines): it bootstraps fonts/theme/vaults/telemetry, owns non-task domains (birthdays, notes handles, theme, timer, userName, `lastSynced`), and mounts providers in strict nesting order `TaskProvider > VaultProvider > BillingProvider > BirthdayProvider > NavigationContainer(AppNavigator)`. `src/components/ErrorBoundary.js` wraps the entire provider+navigation tree inside `LiquidGlassBackground`, receiving `currentTheme` + explicit `isDark={resolvedThemeMode !== "light"}` so the crash fallback renders correctly even when theme objects are unavailable.

## Layers

**UI (`src/screens/`, `src/components/`, `src/navigation/`, `src/theme/`):**
- 9 drawer screens (`DashboardScreen`, `DailyTasksScreen`, `TaskListScreen`, `NotesScreen`, `BirthdaysScreen`, `BillingScreen`, `FocusTimerScreen`, `SearchScreen`, `SettingsScreen`) registered in `src/navigation/AppNavigator.js` via `createDrawerNavigator`, with `CustomDrawerContent` (`src/navigation/CustomDrawerContent.js`) and transparent glass headers.
- Reusable primitives in `src/components/` (`CustomButton`, `CustomCard`, `CustomTextInput`, `CustomDateTimePicker`, `CustomSegmentedButtons`, `CustomSwitch`, `CustomBadge`, `TaskCard`, `TaskEditModal`, `TimerLockoutOverlay`, `LiquidGlassBackground`, `LiquidGlassCard`, `QRScannerModal`, `AIAssistant`, `ErrorBoundary`).
- `TaskEditModal` is mounted once in `AppNavigator` (not per-screen) and bound to the shared `TaskContext` selection state (`selectedTask`/`modalVisible`); `AIAssistant` floating entry is also mounted in `AppNavigator` and hidden while a note is open or on Settings.
- Theming: `src/theme/colors.js` (`themes[name][mode]`, modes `light|dark|amoled`, names `clean|blue|green|purple|dribbble`) + `src/theme/styles.js`; resolved with `resolveThemeMode`/`resolveThemeName` fallbacks in `App.js`.

**State (`src/context/` + `App.js` local state):**
- `TaskContext` (`src/context/TaskContext.js`) — sole writer of `tasks`/`taskLists`/`dailyTasks`. Thin React wrapper over the pure engine `src/utils/taskMutations.js`; exposes `toggleTaskComplete`, `handleCompleteTask`, `handleSaveTask`, `deleteTask`, `handleToggleSubtask`, `handleCreateList/RenameList/DeleteList`, plus `refreshTasksFromStorage` on AppState `active`. Persists via 500 ms debounced read-modify-write (`writeTaskSnapshot`) with a boot guard (`tasksHydratedRef`) so empty boot state can never wipe real storage.
- `VaultContext` (`src/context/VaultContext.js`) — `vaults`, `activeVaultId`, `notes`, `activeNote`; `handleSetActiveVault` persists + reloads notes from filesystem; `loadVaultNotes`/`refreshVaults`.
- `BillingContext` (`src/context/BillingContext.js`) — sole writer of billing state via `updateBillingDataState` (which calls `saveBillingData`); action wrappers (`addTransactionAction`, `upsertBudgetAction`, `addRecurringBillAction`, …) over `src/utils/billingStorage.js`.
- `BirthdayContext` (`src/context/BirthdayContext.js`) — `birthdays` + `handleSaveBirthday`/`handleDeleteBirthday`, each cancelling/rescheduling `expo-notifications` IDs via `src/utils/notifications.js`.
- `App.js` retains ownership of non-task domains (`birthdays` array itself is still App state passed as `initialBirthdays`, plus `notes` handles, theme, timer, `userName`, billing boot load, sync/reset handlers) and merges its periodic save onto stored JSON (`{...stored, ...dataToSave}`) so it never clobbers TaskContext's eager task writes. Timer state is decoupled to its own key (`kwestup_timer_state_*`).

**Services (`src/utils/` domain engines):**
- `taskMutations.js` — pure, framework-agnostic mutation engine (`toggleTask`, `completeTask`, `saveTask`, `deleteTask`, `toggleSubtask`, `createTaskList`, `renameTaskList`, `deleteTaskList`, `calculateNextRecurrence`). Shared verbatim by `TaskContext` and the headless widget handler. Recurrence modes: `daily|weekly|monthly|progressive` (progressive also increments trailing number in title).
- `dateUtils.js` — centralized local-date engine (`getLocalDateString`, `parseLocalDate` strict `YYYY-MM-DD`→local-midnight, `getYesterday/TomorrowLocalDateString`, `getLocalMonthString`, `getLocalMonthDayString`, `isSameLocalDay`). Eliminates UTC-slicing bugs; used by mutations, streak reset, AI fallbacks, sync payloads.
- `aiService.js` — on-device LLM lifecycle (`llama.rn` `initLlama`/`releaseAllLlama`, 2048 ctx, 2 threads, CPU-only), pinned model (`MODEL_PINNED_COMMIT`, `MODEL_EXPECTED_SHA256`, `MODEL_EXPECTED_SIZE` 491400032) downloaded resumably from HuggingFace with post-download SHA-256 gate, 5-min idle unload, AppState auto-unload (`subscribeAppState`/`unsubscribeAppState` wired from `App.js`), generation counter against unload-while-inflight races, plus heuristic fallbacks (`extractTasksFromNoteHeuristic`, `summarizeNoteHeuristic`, keyword/regex `parseGlobalCommand` fallback) so every AI entry works offline.
- `notifications.js` / `billingNotifications.js` — `expo-notifications` scheduling for due-date, daily-task, custom birthday (rescheduled for this+next year on boot/sync), and recurring-bill reminders.
- `diagnostics.js` — dev-gated probes (`runDeviceDiagnostics`, `runNetworkDiagnostics` against httpbin, skipped in release), GitHub-releases `checkForUpdates` (prompts via App confirmation modal), opt-in `sendTelemetryEvent("launch")`.

**Storage (`src/utils/storage.js`, `fileStorage.js`, `vaultService.js`, `billingStorage.js`, `exportService.js`, `vaultImport.js`):**
- `storage.js` — `APP_VERSION v3.5.0`, `STORAGE_VERSION v7.0`; `isUserDataKey` allowlist (never wiped by `clearAllCaches`); `migrateUserDataIfNeeded` copies highest legacy `kwestup_data_v*` + related keys forward; version-change cache clear preserves telemetry/AI-model keys.
- `vaultService.js` — vault registry in AsyncStorage (`kwestup_vaults_*`, `kwestup_activeVault_*` with legacy `v5.0` fallback); path helper `getVaultPath` → `<documentDirectory>Notes/Vaults/<vaultId>/`; `createVault`/`renameVault`/`deleteVault`; one-time `migrateToVaultSystem` (flat `Notes/` → `Notes/Vaults/default/`).
- `fileStorage.js` — vault-parameterized markdown file CRUD (`saveNoteFile`, `readNoteFile`, `deleteNoteFile`, `getAllNotesFromFilesystem` non-recursive scan with hashtag extraction, `wipeNotesFilesystem`) + active-vault wrappers. Notes are deliberately excluded from the monolithic AsyncStorage blob.
- `billingStorage.js` — isolated billing key (`kwestup_billing_*`): transactions/budgets/recurringBills/currency + month analytics (`getSpendingByCategory`, `getMonthlyTotals`).
- `exportService.js` — encrypted backup pipeline: `collectAsyncStorageData` + `packVaults` + billing → AES-256/PBKDF2-SHA256-100k per-archive salt+IV v2 envelope (`encryptBackup`/`decryptBackup` with legacy v1 fallback) → temp `.kwestup` in cache → `expo-sharing` share sheet → cleanup; `importArchive` read→decrypt→clear→`multiSet`→rewrite vault files→reschedule bill reminders.

**Sync (`src/utils/syncService.js` + `App.js#handleExecuteSync`):**
- LAN-only REST to user PC: `validateSyncConfig` (strict IPv4/hostname/IPv6, port 1–65535, ≥6-char token) → `pingSyncServer` (`GET /ping`) → `POST /sync` Bearer token (4 s/10 s abort timeouts) → `validateSyncPayload` (requires `notes`/`tasks`/`birthdays` arrays). `App.js` then wipes active-vault FS, rewrites synced markdown, cancels+reschedules birthday notifications, overwrites React state, stamps `lastSynced`. No cloud intermediary.

**Observability (`src/utils/logger.js`, `src/components/ErrorBoundary.js`):**
- `logger.js` — environment-aware structured logger + 50-entry frozen FIFO breadcrumb ring-buffer. `debug`/`info` are fully gated on `isDevelopment()` (neither console nor buffer in production); `warn`/`error` always buffer + passthrough. Key-based PII redaction (`content|body|note|title|text|message|passphrase|token|key|secret|password` → `[Redacted]`), string/array caps, `WeakSet` cycle guard, deep-freeze at record time, `getRecentLogs`/`clearLogs`.
- `ErrorBoundary` — class component mounted in `App.js` around providers+navigation; `getDerivedStateFromError` + `componentDidCatch` (logs via `logger.error`); fallback card honors explicit `isDark` prop with hex-heuristic fallback; actions Try Again (reset state), Copy Error Report (clipboard→Share fallback, 8000-char cap over PII-redacted breadcrumbs), Restart Application (manual-restart hint — `expo-updates` not installed), collapsible stack/component-stack details.

## Data Flow

**Mutation path (tasks):** Screen/widget → `TaskContext` handler → pure `taskMutations.js` function computes `updatedTasks` → `setTasks` → 500 ms debounced `writeTaskSnapshot` (read-modify-write merge of task keys onto stored blob). Side effects (schedule/cancel due-date notification, haptics, push toast) fire alongside; recurrence toggle spawns the next occurrence via `calculateNextRecurrence`. Headless widgets bypass React and call `toggleTask` directly on the stored blob (`widgets/widget-task-handler.tsx`), then `TaskContext.refreshTasksFromStorage` + App foreground `loadData` converge on next `active`.

**Persistence:** Two writers, disjoint keys — `TaskContext` owns `tasks/taskLists/dailyTasks` (eager, debounced ≤1 s); `App.js` `saveData` owns `birthdays/notes-meta/theme/userName/lastSynced` (15 s throttled merge, never overwrites task keys); timer isolated (`saveTimerState`); billing isolated (`BillingContext.updateBillingDataState`); vault registry + active ID isolated. Boot: `initializeApp` (version/username/vaults/telemetry in parallel → `initNotesFolder` → fire-and-forget `migrateToVaultSystem` + cache clear) → `loadData` (`migrateUserDataIfNeeded`, parse blob, daily-streak reset via `dateUtils`, FS note scan, theme/timer resolution) → providers hydrate via `initial*` props.

**Backup:** `exportArchive` (Settings) collects storage + packs vault FS + billing → encrypts → shares `.kwestup`; `importArchive` reverses with full wipe-then-restore. **Sync:** LAN handshake described above. **Logging:** every layer calls `logger.{debug,info,warn,error}`; breadcrumbs accumulate in-memory and are attached (redacted, capped) to the ErrorBoundary crash report.

## Key Patterns

- **Unified mutation layer:** all task writes flow through `taskMutations.js` (pure, tested) — `TaskContext` in-app, `widget-task-handler` headless. No duplicated hand-rolled mutation copies (removed per C-02).
- **Sole-writer persistence:** each storage key has exactly one writer (TaskContext / App / BillingContext), using read-modify-write merges; fixes stale-snapshot clobbering (W-01/W-02/W-03).
- **Local-first privacy:** on-device AsyncStorage + filesystem + on-device LLM; network is opt-in/explicit only; diagnostics dev-gated; telemetry opt-in with consent persisted across cache wipes.
- **Centralized date engine:** all calendar logic via `dateUtils.js` local-timezone helpers; strict `parseLocalDate` never returns "today" for garbage (Invalid Date instead).
- **Filesystem-as-database for notes:** markdown files are source of truth per vault; AsyncStorage holds only registry + app state; sync/backup operate on files, not embedded blobs.
- **Graceful AI degradation:** every LLM call (`summarizeNote`, `extractTasksFromNote`, `parseGlobalCommand`, `assistWriting*`) clamps input to context budget and falls back to deterministic heuristics when the model is absent/fails.
- **Binder-safe Android integration:** widget pushes throttled (5 s), staggered (250–500 ms), app-active-gated, payload-sliced (top-5 important / top-8 sorted); main save decoupled from timer writes.
- **Forensic observability:** frozen, redacted, bounded breadcrumb buffer feeding the crash-report copy action; ErrorBoundary at the composition root with explicit dark-mode signal.

## Module Map

| Module | Path | Responsibility |
|---|---|---|
| Composition root | `App.js` | Boot, theme, non-task state, save/merge, sync/reset handlers, provider nesting, `ErrorBoundary` mount (`currentTheme` + `isDark`) |
| Expo entry | `index.js` | `registerRootComponent(App)` + `registerWidgetTaskHandler` |
| Navigation | `src/navigation/AppNavigator.js` | Drawer registry (9 screens), context→prop bridging, `TaskEditModal` + `AIAssistant` mounts |
| Drawer chrome | `src/navigation/CustomDrawerContent.js` | Drawer UI, theme switch |
| Task state | `src/context/TaskContext.js` | Sole task writer, debounced persistence, foreground re-sync, notification side effects |
| Vault state | `src/context/VaultContext.js` | Vaults/active ID/notes/active note, FS-backed switching |
| Billing state | `src/context/BillingContext.js` | Sole billing writer, storage-backed actions |
| Birthday state | `src/context/BirthdayContext.js` | Birthday CRUD + notification lifecycle |
| Mutation engine | `src/utils/taskMutations.js` | Pure task/list/recurrence transforms shared app+widget |
| Date engine | `src/utils/dateUtils.js` | Authoritative local-timezone date helpers |
| Structured logging | `src/utils/logger.js` | Gated levels, redacted frozen 50-entry breadcrumb buffer |
| Crash boundary | `src/components/ErrorBoundary.js` | Root fallback UI, redacted capped error report |
| AI service | `src/utils/aiService.js` | On-device LLM lifecycle, integrity-pinned model, heuristic fallbacks |
| AI UI | `src/components/AIAssistant.js` | Floating assistant, command parsing → task/birthday/transaction creation |
| LAN sync | `src/utils/syncService.js` | Config/payload validation, ping + `/sync` exchange |
| Encrypted backup | `src/utils/exportService.js` | AES-256 v2 backup export/import pipeline |
| Vault registry | `src/utils/vaultService.js` | Vault CRUD, paths, one-time flat→vault migration |
| Note files | `src/utils/fileStorage.js` | Vault-scoped markdown file CRUD + FS scan |
| Billing store | `src/utils/billingStorage.js` | Isolated billing persistence + month analytics |
| Vault import | `src/utils/vaultImport.js` | External vault/folder import helpers |
| Notifications | `src/utils/notifications.js` | Due-date/daily/birthday scheduling |
| Bill reminders | `src/utils/billingNotifications.js` | Recurring-bill notification scheduling |
| Storage core | `src/utils/storage.js` | Versions, user-data allowlist, cache clear, legacy migration |
| Diagnostics | `src/utils/diagnostics.js` | Dev-gated probes, update check, opt-in telemetry |
| Theming | `src/theme/colors.js`, `src/theme/styles.js` | Theme matrices + shared styles |
| Widget handlers | `widgets/widget-task-handler.tsx` | Headless toggle/tab/render via `taskMutations` + AsyncStorage |
| Widget views | `widgets/FocusTimerWidget.tsx`, `widgets/DailyTasksWidget.tsx`, `widgets/ImportantTasksWidget.tsx`, `widgets/TasksListWidget.tsx` | Glanceable Android widget UIs |
