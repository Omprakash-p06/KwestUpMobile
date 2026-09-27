# Architecture

**Analysis Date:** 2026-09-28

## Overview

KwestUp Mobile is a local-first, privacy-preserving productivity app built on React Native / Expo SDK 53. All user data lives on-device — tasks, habits, birthdays, billing, and markdown notes in per-vault folders under `documentDirectory/Notes/Vaults/` — with no mandatory cloud account or remote backend. The only network paths are opt-in and device-local: LAN sync to a user-run PC sync server (`POST /sync` over HTTP with bearer token), optional anonymous telemetry (opt-in gated), GitHub release checks, and a one-time HuggingFace GGUF model download for fully on-device LLM inference.

State is in a Phase 17 transition. The planned unified mutation layer is **partially implemented**: pure task transformations now live in `src/utils/taskMutations.js` (9 exported pure functions) and are shared by both `src/context/TaskContext.js` (React provider with notification side-effects) and `widgets/widget-task-handler.tsx` (headless widget writer, now imports `toggleTask` from the shared module). Four context providers (`TaskContext`, `VaultContext`, `BillingContext`, `BirthdayContext`) wrap the tree in `App.js` and `src/navigation/AppNavigator.js` prefers context values with prop fallbacks (`taskCtx?.x ?? props`). However `App.js` (~1293 lines) still owns ~15 root `useState` slices plus its own duplicate mutation handlers (`toggleTaskComplete`, `handleSaveTask`, `handleExecuteSync`, etc.) that are still passed as props — so two parallel write paths (legacy `App.js` handlers vs. context actions) coexist until the legacy handlers are removed. Persistence remains split: structured data as a single JSON blob in AsyncStorage (`kwestup_data_<STORAGE_VERSION>`), notes as `.md` files on `expo-file-system`, billing under its own key, timer state under a decoupled key.

## Layers

### UI — Screens + Components + Navigation + Theme

- Drawer navigation (`@react-navigation/drawer` v6, `front` type) defined in `src/navigation/AppNavigator.js`; 9 routes: Dashboard, Daily, Birthdays, Billing, Tasks, Notes, Focus, Settings, Search. Custom drawer chrome in `src/navigation/CustomDrawerContent.js` (themed header, avatar initials, light/dark/amoled cycle toggle). `AppNavigator` resolves every domain slice as context-first with prop fallback (`src/navigation/AppNavigator.js:86-114`), so screens work whether state comes from providers or legacy props.
- 9 screens in `src/screens/`: `DashboardScreen.js`, `DailyTasksScreen.js`, `BirthdaysScreen.js`, `BillingScreen.js`, `TaskListScreen.js`, `NotesScreen.js`, `FocusTimerScreen.js`, `SettingsScreen.js`, `SearchScreen.js`. Screens are presentational + callback-driven; they receive state and setters as props and own no persistence.
- 14 reusable components in `src/components/`: primitives (`CustomButton.js`, `CustomTextInput.js`, `CustomCard.js`, `CustomBadge.js`, `CustomSwitch.js`, `CustomSegmentedButtons.js`, `CustomDateTimePicker.js`), domain (`TaskCard.js`, `TaskEditModal.js`, `TimerLockoutOverlay.js`), AI (`AIAssistant.js`, `QRScannerModal.js` for sync-token scan), theming (`LiquidGlassBackground.js`, `LiquidGlassCard.js`).
- Theming via `src/theme/colors.js` (`themes[name][mode]`, 5 names × 3 modes) and `src/theme/styles.js`. Fonts loaded in `App.js` (`expo-font` + `@expo-google-fonts/*`): Inter, HankenGrotesk, JetBrainsMono. Provider stack in `App.js:1048-1128`: `GestureHandlerRootView` → `StatusBar` → `SafeAreaProvider` → `PaperProvider` → `LiquidGlassBackground` → `TaskProvider` → `VaultProvider` → `BillingProvider` → `BirthdayProvider` → `NavigationContainer` → `AppNavigator`, plus global modals (confirmation, name onboarding, telemetry opt-in, `TaskEditModal`, `TimerLockoutOverlay`, confetti).
- Floating `AIAssistant` overlay rendered by `AppNavigator.js:391-417` on every route except Settings and when no note is open; prefers context actions (`taskCtx.handleSaveTask`, `birthdayCtx.handleSaveBirthday`, `billingCtx.addTransactionAction`) with legacy prop-callback fallbacks.

### State — Four contexts over `App.js` root state (Phase 17 partial)

- `src/context/TaskContext.js` (271 lines): owns `tasks`, `taskLists`, `dailyTasks`, `selectedTask`, `modalVisible`. Seeds from `initialTasks/initialTaskLists/initialDailyTasks` props passed by `App.js:1054-1059` and re-syncs when those props change. Exposes `toggleTaskComplete`, `handleCompleteTask`, `deleteTask`, `handleSaveTask`, `handleToggleSubtask`, `handleCreateList/RenameList/DeleteList`, plus `refreshTasksFromStorage` (JSON-compare re-read of `kwestup_data_*` on `AppState` foreground). All task math delegates to `src/utils/taskMutations.js`; notification scheduling (`scheduleDueDateNotification`, `cancelDueDateNotification`, push on complete) and haptics stay in the context layer.
- `src/context/VaultContext.js` (99 lines): owns `vaults`, `activeVaultId`, `notes`, `activeNote`. Exposes `handleSetActiveVault` (persist + reload notes via `src/utils/fileStorage.js`), `loadVaultNotes`, `refreshVaults` (via `src/utils/vaultService.js`).
- `src/context/BillingContext.js` (133 lines): owns `billingData`; wraps every `src/utils/billingStorage.js` helper (`add/deleteTransaction`, `upsert/deleteBudget`, `add/deleteRecurringBill`) as persist-and-set actions; `setBillingData` auto-persists via `saveBillingData`.
- `src/context/BirthdayContext.js` (97 lines): owns `birthdays`; `handleSaveBirthday` / `handleDeleteBirthday` pair notification cancel/re-schedule (`expo-notifications` + `src/utils/notifications.js`) with state update, accepting an injected confirmation dialog.
- Legacy owner `App.js` still holds the same slices in `useState` (`App.js:97-136`) and its own handlers (`toggleTaskComplete` with inline recurring-spawn at `App.js:704`, `handleSaveTask` at `App.js:818`, list/subtask handlers, `handleSetActiveVault`, `handleExecuteSync`, `handleResetData`). Until screens consume contexts directly, the effective path is `App` state → provider `initial*` props → context state → `AppNavigator` effective-value resolution → screens. `dailyTasks` mutations have no shared pure module yet (streak-reset logic still inline in `App.js:loadData`).
- Persistence triggers stay in `App.js`: 15-second throttled `saveData` effect (Binder-flooding guard for NothingOS), decoupled high-frequency `saveTimerState` effect, immediate theme-key saves, billing save-on-change, foreground-reload via `AppState` listener (mirrored by `TaskContext.refreshTasksFromStorage`).

### Services — Domain logic in `src/utils/`

- `src/utils/taskMutations.js` — Phase 17 pure engine, zero imports except `getLocalDateString`: `calculateNextRecurrence` (daily/weekly/monthly/progressive with title-number increment), `toggleTask` (recurring completion spawns replacement, returns `{ updatedTasks, toggledTask, spawnedTask }`), `completeTask`, `saveTask` (upsert), `deleteTask`, `toggleSubtask`, `createTaskList` / `renameTaskList` / `deleteTaskList` (`default_inbox` protected). Deterministic via injectable `options.now` / `options.todayDate` for tests.
- `src/utils/notifications.js` — `expo-notifications` handler config, permission request, daily/due-date/birthday/custom schedulers and cancellers.
- `src/utils/billingNotifications.js` — recurring-bill reminder scheduling.
- `src/utils/dateUtils.js` — authoritative local-timezone date engine (7 exports: `getLocalDateString`, `parseLocalDate`, `getYesterday/TomorrowLocalDateString`, `getLocalMonthString`, `getLocalMonthDayString`, `isSameLocalDay`); eliminates UTC-slicing bugs.
- `src/utils/aiService.js` — on-device LLM via `llama.rn`: model download with resume + 10-retry backoff (`qwen2.5-0.5b-instruct-q4_k_m.gguf`, ~468 MB, `documentDirectory/models/`), mutex-guarded `loadModel` (n_ctx 2048, CPU-only), `summarizeNote`, `extractTasksFromNote`, `parseGlobalCommand` (with keyword-regex fallback), `assistWriting` / `assistWritingCustom`.
- `src/utils/diagnostics.js` — `runDeviceDiagnostics`, `runNetworkDiagnostics` (httpbin ping), `checkForUpdates` (GitHub releases `Omprakash-p06/KwestUpMobile`), opt-in-gated `sendTelemetryEvent`.
- `src/utils/vaultImport.js` — `importMDFilesAsVault` via `expo-document-picker` → `createVault` + file copy.

### Storage — AsyncStorage (JSON) + expo-file-system (markdown) + versioned migration

- `src/utils/storage.js` — `APP_VERSION = "v3.5.0"`, `STORAGE_VERSION = "v7.0"`; `isUserDataKey()` allowlist (`kwestup_data_`, `userName_`, `theme_mode_`, `theme_name_`, `timer_state_`, `activeVault_`, `vaults_`, `billing_`, `widget_`, `telemetry_`, `ai_model_`); `clearAllCaches()` (preserves user keys, stamps `kwestup_last_version`); `migrateUserDataIfNeeded()` (highest-version `kwestup_data_v*` promotion plus vault/billing key carry-over).
- Structured blob `kwestup_data_<STORAGE_VERSION>` holds `{ dailyTasks, birthdays, tasks, taskLists, notes, themeMode, selectedThemeName, userName, lastSynced }`. Decoupled keys: `kwestup_timer_state_*` (minimal payload, avoids Binder -22 on large saves), `kwestup_theme_mode_*/name_*`, `kwestup_userName_*`, `kwestup_billing_*` (`src/utils/billingStorage.js`: transactions/budgets/recurringBills/currency + analytics helpers), `kwestup_vaults_*/activeVault_*` (`src/utils/vaultService.js`), `kwestup_widget_active_tab` + per-widget tab keys, `kwestup_telemetry_optin`, `kwestup_ai_model_download_resumable`.
- Notes are files, not blob rows: `src/utils/fileStorage.js` — `initNotesFolder`, `saveNoteFile/readNoteFile/deleteNoteFile/deleteFolderFile` (sanitized `folder/title → .md`), `getAllNotesFromFilesystem` (one-level scan, hashtag extraction, mtime → createdAt/updatedAt), `wipeNotesFilesystem`, plus active-vault wrappers. Vaults in `src/utils/vaultService.js` — path `Notes/Vaults/<vaultId>/`, CRUD (`createVault/renameVault/deleteVault`), active-ID tracking with legacy `v5.0` fallback, one-time flat-`Notes/` → `Notes/Vaults/default/` migration.
- Backup/encryption in `src/utils/exportService.js` — v2 envelope (AES-256, per-archive 128-bit salt/IV, PBKDF2-SHA256 100k iterations, auto-fallback to v1 static-salt/1k-iteration decrypt); `packVaults` (parallel folder reads), `collectAsyncStorageData` (allowlist-filtered), `exportArchive` (collect → pack → encrypt → cache write → `expo-sharing` sheet → cleanup), `importArchive` (read → decrypt → clear user keys → `multiSet` restore → vault file restore → billing restore + bill-reminder reschedule).

### Sync — LAN REST + Android widgets (secondary writers)

- `src/utils/syncService.js` — `validateSyncConfig` (strict IPv4/hostname/IPv6 + port 1–65535 + ≥6-char token), `validateSyncPayload` (requires `notes/tasks/birthdays` arrays), `pingSyncServer` (`GET /ping`, 3 s timeout), `performSync` (`POST /sync` with `Authorization: Bearer`, 10 s timeout, 401/403 → re-scan error). `App.js:handleExecuteSync` orchestrates: sync → `wipeNotesFilesystem` → rewrite note files → cancel/reschedule birthday notifications → overwrite React state → stamp `lastSynced`.
- Android widgets (`widgets/`, `react-native-android-widget`): `FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx` (interactive, tab + toggle actions), `widget-task-handler.tsx` (headless handler: `SWITCH_TAB` persists tab keys; `TOGGLE_TASK/COMPLETE_TASK` applies shared `toggleTask` from `src/utils/taskMutations.js` directly to `kwestup_data_*` JSON with ticking animation; `WIDGET_ADDED/UPDATE/RESIZED/CLICK` re-renders from AsyncStorage). `App.js` pushes updates with active-only + 5 s throttle + staggered/sliced payloads (top-5 important, top-8 sorted tasks) to avoid Binder flooding; `index.js` registers both root component and widget handler. Foreground reload (`App.js` + `TaskContext`) picks up widget-side writes.

## Data Flow

### Mutation path (in-app, Phase 17 transitional)

1. User action in screen/component (e.g. toggle in `src/screens/TaskListScreen.js` via `TaskCard.js`) calls a prop callback resolved in `AppNavigator` to the context action first (`taskCtx?.toggleTaskComplete ?? toggleTaskComplete`, `src/navigation/AppNavigator.js:86-99`).
2. Context handler in `src/context/TaskContext.js` (e.g. `toggleTaskComplete`, `TaskContext.js:126`) delegates math to the pure function (`toggleTask(currentTasks, id)` in `src/utils/taskMutations.js:76`), applies notification side-effects (schedule alarm for spawned recurrence), then `setState`.
3. Legacy fallback: if context is absent, the `App.js` handler (`App.js:704`) computes the same transition inline. Both paths converge on the same persistence effects below.
4. `setState` updates React tree; effects persist: throttled blob save → `AsyncStorage(kwestup_data_v7.0)`; notes go through `fileStorage` markdown writes; billing through `billingStorage` (auto-persist in `BillingContext`); timer through its own key.
5. Widget-push effects (`App.js:557-646`) mirror a sliced projection to home-screen widgets (throttled, staggered, active-only).

### Persistence

- Cold start: `initializeApp` (`App.js:167`) loads version/username/vaults/active-ID/telemetry in parallel → `initNotesFolder` → fire-and-forget `migrateToVaultSystem` + cache clear + diagnostics. Then `loadData` (`App.js:250`): legacy migration scan → blob parse with daily-task streak reset (local-date compare via `dateUtils`) → `getAllNotesFromFilesystem(activeVault)` → theme resolution (dedicated keys win over blob) → timer rebase from `startTime` → birthday notification reschedule. Billing loads separately via `loadBillingData`. Provider `initial*` props then seed the four contexts.
- Hot foreground: `AppState` listeners in both `App.js` and `TaskContext.refreshTasksFromStorage` reload from AsyncStorage to absorb widget-side writes (JSON-compare guard avoids redundant renders).

### Backup (export/import)

`SettingsScreen` → `exportArchive(passphrase)` (`src/utils/exportService.js:208`): collect allowlisted AsyncStorage → `packVaults` → payload `{ metadata, storage, vaults, billing }` → v2 encrypt → temp `.kwestup` in cache → share sheet → delete temp. Import reverses it and reschedules bill reminders fresh on the restoring device. `importMDFilesAsVault` (`src/utils/vaultImport.js`) offers a lighter path: pick `.md/.txt` → new vault.

### Sync (LAN)

`SettingsScreen` (QR via `QRScannerModal.js` or manual IP/port/token) → `handleExecuteSync(config)` (`App.js:928`) → `performSync` (`src/utils/syncService.js:133`) → server-merged `{ notes, tasks, taskLists, birthdays, theme, userName }` validated → local filesystem wiped + rewritten, birthday alarms rebuilt, React state overwritten, `lastSynced` stamped. Sync still writes through legacy `App.js` state setters, not the contexts — a remaining Phase 17+ migration item.

**State management note (Phase 17 actual vs plan):** per `.planning/STATE.md` Phase 17 (plans 17-01, 17-02) is marked complete, and the shared pure layer plus four providers exist and are wired. What is *not* yet done: removing the duplicate `App.js` handlers, moving `dailyTasks` streak logic and birthday/billing/vault writes into shared pure modules, routing `handleExecuteSync`/widget-tab state through contexts, and having screens consume `useTasks`/`useVaults`/`useBilling`/`useBirthdays` directly instead of via `AppNavigator` prop fan-out. Any follow-up must subsume the `App.js` handlers, `AppNavigator.js` creator fallbacks, and the widget handler's direct-AsyncStorage path without breaking the dual-writer contract.

## Key Patterns

- **Local-first privacy:** on-device JSON + markdown + versioned keys; network is opt-in LAN sync / telemetry / update check / model download only. No cloud SDK, no auth provider.
- **Transitional state (context-over-god-component):** `App.js` remains the persistence owner and provider seeder while `src/context/*` + `src/utils/taskMutations.js` form the new mutation authority; `AppNavigator` bridges both via context-first-with-fallback resolution. Do not add new `App.js` handlers — add pure functions in `taskMutations.js` (or a sibling module) plus a context action.
- **Pure mutation core:** `src/utils/taskMutations.js` is framework-agnostic with injectable `now`/`todayDate`; it is imported by both React (`TaskContext.js`) and headless (`widget-task-handler.tsx`) runtimes — keep it free of React, AsyncStorage, and notification imports (only `dateUtils`).
- **Decoupled hot-path persistence:** timer state and theme keys saved separately from the large blob to avoid Binder transaction failures; 15 s save throttle + 5 s widget throttle + staggered widget updates + payload slicing.
- **Vault-scoped filesystem:** every note op takes `vaultId`; active-vault wrappers resolve via dynamic import to avoid cycles; one-level directory scan with filename sanitization.
- **Versioned storage with legacy fallback:** dynamic `STORAGE_VERSION` keys everywhere; migration promotes highest legacy `v*` blob; vault keys fall back to hardcoded `v5.0` legacy keys.
- **Hardened sync/backup envelope:** strict config + payload validators on sync; v2 encrypted backup with v1 auto-detect fallback; destructive ops (wipe-then-rewrite on sync, clear-then-restore on import) guarded by schema checks.
- **On-device AI with graceful degradation:** mutex-guarded singleton `llama.rn` context, size-checked model cache, clamped prompt budgets (~5–6k chars for 2048 ctx), keyword-regex fallback when LLM JSON parsing fails.
- **Local-date authority:** all calendar logic funnels through `src/utils/dateUtils.js`; UTC `toISOString().slice` is banned by convention.

## Module Map

| Module | Path | Responsibility |
|---|---|---|
| App root / persistence owner | `App.js` | Root `useState` slices, legacy mutation handlers, init/load/save effects, widget push, provider seeding, global modals |
| Expo entry | `index.js` | `registerRootComponent(App)` + `registerWidgetTaskHandler` |
| Task state + actions | `src/context/TaskContext.js` | `tasks/taskLists/dailyTasks` state, context actions delegating to `taskMutations`, notification side-effects, foreground re-sync |
| Vault/notes state | `src/context/VaultContext.js` | `vaults/activeVaultId/notes/activeNote`, vault switching + note loading |
| Billing state | `src/context/BillingContext.js` | `billingData` with auto-persisting actions over `billingStorage` helpers |
| Birthday state | `src/context/BirthdayContext.js` | `birthdays` with alarm-coupled save/delete actions |
| Pure task engine | `src/utils/taskMutations.js` | Framework-agnostic task/list/recurrence/subtask transforms shared by app + widgets |
| Navigation shell | `src/navigation/AppNavigator.js` | Drawer navigator (9 screens), context-first/prop-fallback resolution, AI overlay mount + creators |
| Drawer chrome | `src/navigation/CustomDrawerContent.js` | Themed drawer items, user header, theme-mode cycler |
| Dashboard | `src/screens/DashboardScreen.js` | Aggregated tasks/notes/birthdays overview |
| Daily tasks | `src/screens/DailyTasksScreen.js` | Habit loop with streak reset |
| Birthdays | `src/screens/BirthdaysScreen.js` | Birthday CRUD + custom reminders |
| Billing | `src/screens/BillingScreen.js` | Transactions, budgets, recurring bills UI |
| Task list | `src/screens/TaskListScreen.js` | Multi-list tasks, subtasks, recurrence, due dates |
| Notes | `src/screens/NotesScreen.js` | Vault browser, markdown editor, AI assist entry |
| Focus timer | `src/screens/FocusTimerScreen.js` | Focus session timer + lockout trigger |
| Settings | `src/screens/SettingsScreen.js` | Theme, user, backup export/import, LAN sync, telemetry, reset |
| Search | `src/screens/SearchScreen.js` | Cross-domain (tasks/daily/birthdays/notes) search |
| AI overlay | `src/components/AIAssistant.js` | Global NL command bar → task/birthday/tx extraction |
| QR sync scanner | `src/components/QRScannerModal.js` | Scan LAN sync config (`expo-camera`) |
| Task UI | `src/components/TaskCard.js`, `src/components/TaskEditModal.js` | Task row + edit sheet (due date, list, recurrence, subtasks) |
| Primitives | `src/components/CustomButton.js`, `CustomTextInput.js`, `CustomCard.js`, `CustomBadge.js`, `CustomSwitch.js`, `CustomSegmentedButtons.js`, `CustomDateTimePicker.js` | Shared themed controls |
| Glass theme | `src/components/LiquidGlassBackground.js`, `LiquidGlassCard.js`, `src/theme/colors.js`, `src/theme/styles.js` | Gradient/glass surfaces, 5-theme × 3-mode palette, shared styles |
| Focus lockout | `src/components/TimerLockoutOverlay.js` | Full-screen focus-session guard |
| Storage versioning | `src/utils/storage.js` | `APP/STORAGE_VERSION`, user-key allowlist, cache clear, legacy migration |
| Notes filesystem | `src/utils/fileStorage.js` | Vault-parameterized `.md` CRUD, FS scan, wipe, hashtag parse |
| Vault registry | `src/utils/vaultService.js` | Vault CRUD, active-ID tracking, flat→vault migration |
| Backup crypto | `src/utils/exportService.js` | v2 encrypt/decrypt, pack/collect, export/import pipelines |
| MD import | `src/utils/vaultImport.js` | DocumentPicker `.md/.txt` → new vault |
| LAN sync client | `src/utils/syncService.js` | Config/payload validators, ping, `POST /sync` |
| Billing store | `src/utils/billingStorage.js` | Billing load/save, tx/budget/bill helpers, monthly analytics |
| Bill alarms | `src/utils/billingNotifications.js` | Recurring-bill reminder scheduling |
| Notifications | `src/utils/notifications.js` | Permission + daily/due-date/birthday scheduling |
| Date engine | `src/utils/dateUtils.js` | Local-timezone date parse/format authority (7 exports) |
| On-device AI | `src/utils/aiService.js` | GGUF download/resume, `llama.rn` lifecycle, summarize/extract/parse/assist |
| Diagnostics | `src/utils/diagnostics.js` | Device/network logs, GitHub update check, opt-in telemetry |
| Widget handler | `widgets/widget-task-handler.tsx` | Headless widget actions + re-render; task writes via shared `toggleTask` |
| Home widgets | `widgets/FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx` | Android home-screen projections (tasks list is interactive) |
