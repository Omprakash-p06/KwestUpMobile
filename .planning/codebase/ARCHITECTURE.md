# Architecture

**Analysis Date:** 2026-09-28

## Overview

KwestUp Mobile is a local-first, privacy-preserving productivity app built on React Native / Expo SDK 53. All user data lives on-device — tasks, habits, birthdays, billing, and markdown notes in per-vault folders under `documentDirectory/Notes/Vaults/` — with no mandatory cloud account or remote backend. The only network paths are opt-in and device-local: LAN sync to a user-run PC sync server (`POST /sync` over HTTP with bearer token), optional anonymous telemetry (opt-in gated), GitHub release checks, and a one-time HuggingFace GGUF model download for fully on-device LLM inference.

State architecture employs a modular domain provider layer: pure task transformations live in `src/utils/taskMutations.js` (exported pure functions) and are shared by both `src/context/TaskContext.js` (React provider with notification side-effects) and `widgets/widget-task-handler.tsx` (headless widget writer). Four domain context providers (`TaskContext`, `VaultContext`, `BillingContext`, `BirthdayContext`) wrap the tree in `App.js`, and `src/navigation/AppNavigator.js` wires screens to these contexts with backward-compatible prop fallbacks (`taskCtx?.x ?? props`). Persistence is cleanly segregated: structured data as a single JSON blob in AsyncStorage (`kwestup_data_<STORAGE_VERSION>`), notes as `.md` files on `expo-file-system`, billing under its own key, and timer state under a decoupled low-overhead key.

## Layers

### UI — Screens + Components + Navigation + Theme

- Drawer navigation (`@react-navigation/drawer` v6, `front` type) defined in `src/navigation/AppNavigator.js`; 9 routes: Dashboard, Daily, Birthdays, Billing, Tasks, Notes, Focus, Settings, Search. Custom drawer chrome in `src/navigation/CustomDrawerContent.js` (themed header, avatar initials, light/dark/amoled cycle toggle). `AppNavigator` resolves every domain slice as context-first with prop fallback (`src/navigation/AppNavigator.js`), so screens work seamlessly whether state comes from providers or legacy props.
- 9 screens in `src/screens/`: `DashboardScreen.js`, `DailyTasksScreen.js`, `BirthdaysScreen.js`, `BillingScreen.js`, `TaskListScreen.js`, `NotesScreen.js`, `FocusTimerScreen.js`, `SettingsScreen.js`, `SearchScreen.js`. Screens are presentational and callback-driven; they receive state and setters as props and own no persistence.
- 14 reusable components in `src/components/`: primitives (`CustomButton.js`, `CustomTextInput.js`, `CustomCard.js`, `CustomBadge.js`, `CustomSwitch.js`, `CustomSegmentedButtons.js`, `CustomDateTimePicker.js`), domain (`TaskCard.js`, `TaskEditModal.js`, `TimerLockoutOverlay.js`), AI (`AIAssistant.js`, `QRScannerModal.js` for sync-token scan), theming (`LiquidGlassBackground.js`, `LiquidGlassCard.js`).
- Theming via `src/theme/colors.js` (`themes[name][mode]`, 5 names × 3 modes) and `src/theme/styles.js`. Fonts loaded in `App.js` (`expo-font` + `@expo-google-fonts/*`): Inter, HankenGrotesk, JetBrainsMono. Provider stack in `App.js`: `GestureHandlerRootView` → `StatusBar` → `SafeAreaProvider` → `PaperProvider` → `LiquidGlassBackground` → `TaskProvider` → `VaultProvider` → `BillingProvider` → `BirthdayProvider` → `NavigationContainer` → `AppNavigator`, plus global modals (confirmation, name onboarding, telemetry opt-in, `TaskEditModal`, `TimerLockoutOverlay`, confetti).
- Floating `AIAssistant` overlay rendered by `AppNavigator.js` on every route except Settings and when no note is open; prefers context actions (`taskCtx.handleSaveTask`, `birthdayCtx.handleSaveBirthday`, `billingCtx.addTransactionAction`) with legacy prop-callback fallbacks. Unloads native model context upon unmount.

### State — Four Domain Contexts

- `src/context/TaskContext.js`: owns `tasks`, `taskLists`, `dailyTasks`, `selectedTask`, `modalVisible`. Seeds from `initialTasks/initialTaskLists/initialDailyTasks` props passed by `App.js` and re-syncs when those props change. Exposes `toggleTaskComplete`, `handleCompleteTask`, `deleteTask`, `handleSaveTask`, `handleToggleSubtask`, `handleCreateList/RenameList/DeleteList`, plus `refreshTasksFromStorage` (JSON-compare re-read of `kwestup_data_*` on `AppState` foreground). All task math delegates to `src/utils/taskMutations.js`; notification scheduling (`scheduleDueDateNotification`, `cancelDueDateNotification`, push on complete) and haptics stay in the context layer.
- `src/context/VaultContext.js`: owns `vaults`, `activeVaultId`, `notes`, `activeNote`. Exposes `handleSetActiveVault` (persist + reload notes via `src/utils/fileStorage.js`), `loadVaultNotes`, `refreshVaults` (via `src/utils/vaultService.js`).
- `src/context/BillingContext.js`: owns `billingData`; wraps `src/utils/billingStorage.js` helpers (`add/deleteTransaction`, `upsert/deleteBudget`, `add/deleteRecurringBill`) as persist-and-set actions; `setBillingData` auto-persists via `saveBillingData`.
- `src/context/BirthdayContext.js`: owns `birthdays`; `handleSaveBirthday` / `handleDeleteBirthday` pair notification cancel/re-schedule (`expo-notifications` + `src/utils/notifications.js`) with state update.
- Persistence triggers in `App.js`: 15-second throttled `saveData` effect (Binder-flooding guard for NothingOS), decoupled high-frequency `saveTimerState` effect, immediate theme-key saves, billing save-on-change, foreground-reload via `AppState` listener (mirrored by `TaskContext.refreshTasksFromStorage`).

### Services — Domain logic in `src/utils/`

- `src/utils/taskMutations.js` — pure engine, zero imports except `getLocalDateString`: `calculateNextRecurrence` (daily/weekly/monthly/progressive with title-number increment), `toggleTask` (recurring completion spawns replacement, returns `{ updatedTasks, toggledTask, spawnedTask }`), `completeTask`, `saveTask` (upsert), `deleteTask`, `toggleSubtask`, `createTaskList` / `renameTaskList` / `deleteTaskList` (`default_inbox` protected). Deterministic via injectable `options.now` / `options.todayDate` for tests.
- `src/utils/dateUtils.js` — authoritative local-timezone date engine (7 exports: `getLocalDateString`, `parseLocalDate`, `getYesterday/TomorrowLocalDateString`, `getLocalMonthString`, `getLocalMonthDayString`, `isSameLocalDay`); eliminates UTC-slicing bugs.
- `src/utils/aiService.js` — on-device LLM via `llama.rn`:
  - Immutable commit pinning: upstream download pinned to commit `9217f5db79a29953eb74d5343926648285ec7e67`, size `491400032` bytes, SHA-256 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`.
  - Integrity verification: `verifyModelIntegrity` purges corrupted/incomplete files before loading.
  - Mutex lock: Coalescing Promise lock `_initPromise` prevents parallel initialization races.
  - Active memory lifecycle: `handleAppStateChange` auto-unloads context on `background`/`inactive`; 5-minute idle timeout with timer unref support; component unmount cleanup in `AIAssistant.js`.
  - Deterministic fallbacks: `extractTasksFromNoteHeuristic`, `summarizeNoteHeuristic`, and regex command parser ensure continuous offline uptime without crashes.
- `src/utils/notifications.js` — `expo-notifications` handler config, permission request, daily/due-date/birthday/custom schedulers and cancellers.
- `src/utils/billingNotifications.js` — recurring-bill reminder scheduling.
- `src/utils/diagnostics.js` — `runDeviceDiagnostics`, `runNetworkDiagnostics` (httpbin ping), `checkForUpdates` (GitHub releases `Omprakash-p06/KwestUpMobile`), opt-in-gated `sendTelemetryEvent`.
- `src/utils/vaultImport.js` — `importMDFilesAsVault` via `expo-document-picker` → `createVault` + file copy.

### Storage — AsyncStorage (JSON) + expo-file-system (markdown) + versioned migration

- `src/utils/storage.js` — `APP_VERSION = "v3.5.0"`, `STORAGE_VERSION = "v7.0"`; `isUserDataKey()` allowlist (`kwestup_data_`, `userName_`, `theme_mode_`, `theme_name_`, `timer_state_`, `activeVault_`, `vaults_`, `billing_`, `widget_`, `telemetry_`, `ai_model_`); `clearAllCaches()` (preserves user keys, stamps `kwestup_last_version`); `migrateUserDataIfNeeded()` (highest-version `kwestup_data_v*` promotion plus vault/billing key carry-over).
- Structured blob `kwestup_data_<STORAGE_VERSION>` holds `{ dailyTasks, birthdays, tasks, taskLists, notes, themeMode, selectedThemeName, userName, lastSynced }`. Decoupled keys: `kwestup_timer_state_*` (minimal payload, avoids Binder -22 on large saves), `kwestup_theme_mode_*/name_*`, `kwestup_userName_*`, `kwestup_billing_*` (`src/utils/billingStorage.js`), `kwestup_vaults_*/activeVault_*` (`src/utils/vaultService.js`), `kwestup_widget_active_tab`, `kwestup_telemetry_optin`, `kwestup_ai_model_download_resumable`.
- Notes are files, not blob rows: `src/utils/fileStorage.js` — `initNotesFolder`, `saveNoteFile/readNoteFile/deleteNoteFile/deleteFolderFile`, `getAllNotesFromFilesystem`, `wipeNotesFilesystem`. Vaults in `src/utils/vaultService.js` — path `Notes/Vaults/<vaultId>/`, CRUD (`createVault/renameVault/deleteVault`), active-ID tracking with legacy `v5.0` fallback.
- Backup/encryption in `src/utils/exportService.js` — v2 envelope (AES-256, per-archive 128-bit salt/IV, PBKDF2-SHA256 100k iterations, auto-fallback to v1 static-salt/1k-iteration decrypt); `exportArchive` and `importArchive`.

### Sync — LAN REST + Android widgets (secondary writers)

- `src/utils/syncService.js` — `validateSyncConfig` (strict IPv4/hostname/IPv6 + port 1–65535 + ≥6-char token), `validateSyncPayload` (requires `notes/tasks/birthdays` arrays), `pingSyncServer` (`GET /ping`, 3 s timeout), `performSync` (`POST /sync` with `Authorization: Bearer`, 10 s timeout, 401/403 → re-scan error). `App.js:handleExecuteSync` orchestrates sync and state reconciliation.
- Android widgets (`widgets/`, `react-native-android-widget`): `FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx` (interactive, tab + toggle actions), `widget-task-handler.tsx` (headless handler: `SWITCH_TAB` persists tab keys; `TOGGLE_TASK/COMPLETE_TASK` applies shared `toggleTask` from `src/utils/taskMutations.js` directly to `kwestup_data_*` JSON with ticking animation; `WIDGET_ADDED/UPDATE/RESIZED/CLICK` re-renders from AsyncStorage). `App.js` pushes updates with active-only + 5 s throttle + staggered/sliced payloads to avoid Binder flooding. Foreground reload (`App.js` + `TaskContext`) picks up widget-side writes.

## Data Flow

### Mutation path (in-app)

1. User action in screen/component (e.g. toggle in `src/screens/TaskListScreen.js` via `TaskCard.js`) calls a prop callback resolved in `AppNavigator` to the context action first (`taskCtx?.toggleTaskComplete ?? toggleTaskComplete`).
2. Context handler in `src/context/TaskContext.js` delegates math to the pure function (`toggleTask(currentTasks, id)` in `src/utils/taskMutations.js`), applies notification side-effects (schedule alarm for spawned recurrence), then `setState`.
3. Legacy fallback: if context is absent, the `App.js` handler computes the same transition inline. Both paths converge on the persistence effects.
4. `setState` updates React tree; effects persist: throttled blob save → `AsyncStorage(kwestup_data_v7.0)`; notes go through `fileStorage` markdown writes; billing through `billingStorage` (auto-persist in `BillingContext`); timer through its own key.
5. Widget-push effects mirror a sliced projection to home-screen widgets (throttled, staggered, active-only).

### Persistence

- Cold start: `initializeApp` in `App.js` loads version/username/vaults/active-ID/telemetry in parallel → `initNotesFolder` → `migrateToVaultSystem` + cache clear + diagnostics. Then `loadData`: legacy migration scan → blob parse with daily-task streak reset (local-date compare via `dateUtils`) → `getAllNotesFromFilesystem(activeVault)` → theme resolution → timer rebase from `startTime` → birthday notification reschedule. Billing loads separately via `loadBillingData`. Provider `initial*` props seed the four contexts.
- Hot foreground: `AppState` listeners in both `App.js` and `TaskContext.refreshTasksFromStorage` reload from AsyncStorage to absorb widget-side writes (JSON-compare guard avoids redundant renders).

## Key Patterns

- **Local-first privacy:** on-device JSON + markdown + versioned keys; network is opt-in LAN sync / telemetry / update check / model download only. No cloud SDK, no auth provider.
- **Pure mutation core:** `src/utils/taskMutations.js` is framework-agnostic with injectable `now`/`todayDate`; it is imported by both React (`TaskContext.js`) and headless (`widget-task-handler.tsx`) runtimes.
- **Hardened on-device AI:** Immutable model commit pinning with pre-load SHA-256 and size verification, Promise mutex lock, active lifecycle (background unload + idle timeout), and pure rule-based fallback engines.
- **Decoupled hot-path persistence:** timer state and theme keys saved separately from the large blob to avoid Binder transaction failures; 15 s save throttle + 5 s widget throttle + staggered widget updates + payload slicing.
- **Vault-scoped filesystem:** every note op takes `vaultId`; active-vault wrappers resolve via dynamic import to avoid cycles; one-level directory scan with filename sanitization.
- **Versioned storage with legacy fallback:** dynamic `STORAGE_VERSION` keys; migration promotes highest legacy `v*` blob; vault keys fall back to hardcoded `v5.0` legacy keys.
- **Hardened sync/backup envelope:** strict config + payload validators on sync; v2 encrypted backup with v1 auto-detect fallback.
- **Local-date authority:** all calendar logic funnels through `src/utils/dateUtils.js`; UTC `toISOString().slice` is banned by convention.

## Module Map

| Module | Path | Responsibility |
|---|---|---|
| App root / persistence owner | `App.js` | Root `useState` slices, persistence/widget effects, provider seeding, global modals |
| Expo entry | `index.js` | `registerRootComponent(App)` + `registerWidgetTaskHandler` |
| Task state + actions | `src/context/TaskContext.js` | `tasks/taskLists/dailyTasks` state, context actions delegating to `taskMutations`, notification side-effects, foreground re-sync |
| Vault/notes state | `src/context/VaultContext.js` | `vaults/activeVaultId/notes/activeNote`, vault switching + note loading |
| Billing state | `src/context/BillingContext.js` | `billingData` with auto-persisting actions over `billingStorage` helpers |
| Birthday state | `src/context/BirthdayContext.js` | `birthdays` with alarm-coupled save/delete actions |
| Pure task engine | `src/utils/taskMutations.js` | Framework-agnostic task/list/recurrence/subtask transforms shared by app + widgets |
| On-device AI service | `src/utils/aiService.js` | Pinned model download, pre-load integrity check, Promise mutex, memory lifecycle, heuristic fallbacks |
| Local date engine | `src/utils/dateUtils.js` | Centralized timezone-aware date calculations and formatting |
| Navigation shell | `src/navigation/AppNavigator.js` | Drawer navigator (9 screens), context-first/prop-fallback resolution, AI overlay mount |
| Storage & migration | `src/utils/storage.js` | Storage version keys, user key allowlist, legacy data migration, cache clearing |
| Notes filesystem | `src/utils/fileStorage.js` | Markdown file CRUD, sanitized paths, directory scan |
| Vault management | `src/utils/vaultService.js` | Vault CRUD, directory creation, active vault ID persistence |
| Backup & crypto | `src/utils/exportService.js` | AES-256 v2 backup packaging, encryption, export share sheet, archive restore |
| LAN sync | `src/utils/syncService.js` | PC sync server handshake, strict config/payload validation, REST client |
| Notifications | `src/utils/notifications.js` | Local notification scheduling for due dates, reminders, and daily repeats |
| Widget task handler | `widgets/widget-task-handler.tsx` | Headless Android widget event receiver using `taskMutations.js` |
