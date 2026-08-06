<!-- refreshed: 2026-08-06 -->
# Architecture

**Analysis Date:** 2026-08-06

## System Overview

KwestUp is a productivity mobile app built with **Expo / React Native**. It is a JavaScript (`.js`) codebase (not TypeScript despite a `tsconfig.json` existing; `src/` is `.js`, the widget layer mixes `.tsx`).

```text
┌────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                         │
│   Screens (`src/screens/*`)  +  Shared UI (`src/components/*`)  │
├──────────────┬───────────────────────────────┬─────────────────┤
│  Navigation  │        State Container        │   Android Widgets │
│  `AppNavigator` │  `App.js` (monolithic)     │  `widgets/*.tsx`  │
│  (Drawer)      │  (all useState here)       │  (home-screen)    │
└──────┬───────┴──────────────┬───────────────┴────────┬─────────┘
       │   props + callbacks  │                        │  read/write
       ▼                      ▼                        ▼
┌────────────────────────────────────────────────────────────────┐
│                        Service / Utils Layer                    │
│  `src/utils/*`  (notifications, sync, vault, ai, storage,       │
│  billing, export, diagnostics, fileStorage)                     │
└──────────┬──────────────────────────┬───────────────────────────┘
           ▼                          ▼
┌─────────────────────┐   ┌───────────────────────────────────────┐
│  AsyncStorage (KV)   │   │  FileSystem (notes .md vaults)        │
│  `kwestup_*` keys     │   │  `<docDir>/Notes/Vaults/<id>/*.md`    │
└─────────────────────┘   └───────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App (root) | Owns ALL application state, lifecycles, providers, dialogs, persistence orchestration | `App.js` |
| AppNavigator | Renders drawer navigation and wires props from `App.js` to every screen | `src/navigation/AppNavigator.js` |
| CustomDrawerContent | Drawer navigation UI, theme-mode toggle footer | `src/navigation/CustomDrawerContent.js` |
| Screens (9) | Presentational feature screens; receive data + callbacks via props | `src/screens/*.js` |
| Shared components (14) | Reusable UI atoms (Button, Card, Input, Switch, Badge, TimerLockoutOverlay, LiquidGlassCard) | `src/components/*.js` |
| AIAssistant | Floating bottom-sheet AI assistant powered by on-device LLM | `src/components/AIAssistant.js` |
| Widgets (5) | Android home-screen widgets and their task handler | `widgets/*.tsx` |
| Utils layer | Services: storage, notifications, sync, AI, vault, billing, export | `src/utils/*.js` |
| Theme | Color palettes (5 names × 3 modes) and shared StyleSheet with runtime font injection | `src/theme/*.js` |

## Pattern Overview

**Overall:** Monolithic state container (`App.js`) with **prop-drilling** into a navigation tree. There is **no state-management library** (no Redux/Context/Zustand). All application data lives in `useState` within `App.js` and is passed down to screens. Persistence is out-of-band through direct `AsyncStorage` writes wired to `useEffect` hooks.

This is a "container/presentational" split: `App.js` is the single stateful container; screens are presentational (they adopt undesired mutable state locally only for ephemeral UI, e.g. `SettingsScreen` uses a local `tempUserName`).

**Key Characteristics:**
- Single state-owner container in `App.js` (~1270 lines).
- ~50 contexs passed by name through `AppNavigator` into 9 screens.
- Persistence is delegated to `src/utils/storage.js` versioned keys (`STORAGE_VERSION = "v7.0"`).
- Notes live on the **filesystem** (`.md` files) per vault — they are NOT in AsyncStorage; AsyncStorage stores tasks/birthdays/billing/theme/timer metadata.
- Data-recovery patterns use background fire-and-forget for non-critical init (migration, cache clear, diagnostics).
- Extensive throttling/staggering of AsyncStorage writes and Android widget updates to avoid Binder flooding on sensitive hardware.
- On-device LLM (`llama.rn`) for AI features.

## Layers

**Presentation / Screens:**
- Purpose: Render each feature view
- Location: `src/screens/`
- Contains: `DashboardScreen.js`, `DailyTasksScreen.js`, `BirthdaysScreen.js`, `BillingScreen.js`, `TaskListScreen.js`, `NotesScreen.js`, `FocusTimerScreen.js`, `SettingsScreen.js`, `SearchScreen.js`
- Depends on: `src/components/*`, `src/utils/*`, `src/theme/*`, `src/navigation/`
- Used by: `AppNavigator.js`

**Navigation:**
- Purpose: Drawer-based routing and screen wiring
- Location: `src/navigation/`
- Contains: `AppNavigator.js`, `CustomDrawerContent.js`
- Depends on: `src/screens/*`, `src/components/*`, `src/utils/notifications.js`
- Used by: `App.js`

**Shared UI / Components:**
- Purpose: Reusable presentational building blocks
- Location: `src/components/`
- Contains: `CustomButton.js`, `CustomTextInput.js`, `CustomCard.js`, `CustomBadge.js`, `CustomSwitch.js`, `CustomSegmentedButtons.js`, `CustomDateTimePicker.js`, `LiquidGlassCard.js`, `TaskCard.js`, `TaskEditModal.js`, `TimerLockoutOverlay.js`, `AIAssistant.js`, `QRScannerModal.js`, `LiquidGlassBackground.js`
- Depends on: `src/theme/*`
- Used by: `src/screens/*`, `App.js`

**Service / Utils Layer:**
- Purpose: State-free service modules for side-effects (persistence, notifications, network, AI, filesystem)
- Location: `src/utils/`
- Contains: `storage.js`, `notifications.js`, `fileStorage.js`, `vaultService.js`, `vaultImport.js`, `syncService.js`, `aiService.js`, `exportService.js`, `diagnostics.js`, `billingStorage.js`, `billingNotifications.js`
- Depends on: `@react-native-async-storage/async-storage`, `expo-file-system`, `expo-notifications`, `expo-camera`, `expo-document-picker`, `expo-sharing`, `llama.rn`, `crypto-js`, `react-native-paper`
- Used by: `App.js`, screens, components

**Theme Layer:**
- Purpose: Centralized color & style definitions with runtime font-family injection
- Location: `src/theme/`
- Contains: `colors.js` (exports `themes` object), `styles.js` (`injectFontFamily()` mutates a raw styles object, then `StyleSheet.create`)

**Widget Layer:**
- Purpose: Android home-screen widgets (FocusTimer, DailyTasks, ImportantTasks, TasksList)
- Location: `widgets/`
- Contains: `FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx`, `widget-task-handler.tsx`
- Depends on: `react-native-android-widget`, `@react-native-async-storage/async-storage` (reads `kwestup_data_*`, `kwestup_timer_state_*`, `kwestup_widget_*` keys), `src/utils/storage.js`
- Used by: registered in `index.js` and `app.json`

## Data Flow

State flows **down** from `App.js` and side-effects flow **down/out** through utils.

### Primary Request/State Path (Startup)

1. `index.js` → `registerRootComponent(App)` + `registerWidgetTaskHandler(widgetTaskHandler)` (`index.js`)
2. `App.js` mounts, loads fonts via `useFonts` (blocks UI until loaded) (`App.js`)
3. `initializeApp()` runs: reads userName/vaults/telemetry opt-in from AsyncStorage, calls `initNotesFolder`, and in background fires `migrateToVaultSystem()` + `clearAllCaches()` on version change + `runDeviceDiagnostics()`/`runNetworkDiagnostics()` (`App.js`)
4. After init, `loadData()` loads main state slice from `AsyncStorage`, resolves active vault, resets overdue daily-task streaks, reads notes from filesystem, and re-schedules daily/birthday notifications (`App.js`)
5. Screens render from props; user interactions call callbacks that update `App.js` state (`App.js`)
6. State changes persist via `useEffect`-driven throttled `saveData()` (15s) + immediate `saveTimerState()` / `saveBillingData()` / theme keys (`App.js`)

### Crypto/Backup Flow
- `exportService.js` `encryptBackup()`/`decryptBackup()` use AES-256 (crypto-js) with a fixed salt and user passphrase to produce/re-load encrypted archives (`src/utils/exportService.js`)

### Widget Remote/Read Flow
- Widgets own their data reads: `widget-task-handler.tsx` directly reads `STORAGE_VERSION`-keyed AsyncStorage at widget render time; `App.js` pushes active updates via `requestWidgetUpdate` (throttled/staggered) (`widgets/widget-task-handler.tsx`, `App.js`)

### Sync Flow
- `SettingsScreen` → `handleExecuteSync(config)` → `performSync(config, localData)` → `pingSyncServer` then `POST /sync` to `http://<ip>:<port>` with Bearer token; on success wipes filesystem notes, writes returned `.md` files, reschedules birthday notifications, overwrites React state (`App.js`, `src/utils/syncService.js`)

**State Management:**
- No global store. `App.js` owns ALL persisted slices as `useState` buckets (dailyTasks, birthdays, tasks, taskLists, notes, themeMode, selectedThemeName, userName, lastSynced, vaults, activeVaultId, billingData, telemetryEnabled).
- Persistence is split by key: main data in `kwestup_data_${STORAGE_VERSION}`; timer in its own `kwestup_timer_state_*`; theme in `kwestup_theme_mode_*` & `kwestup_theme_name_*`; billing in `kwestup_billing_*`; widgets in `kwestup_widget_*`; vaults in `kwestup_vaults_*` / active in `kwestup_activeVault_*`.
- Migration across versions: `storage.js` `migrateUserDataIfNeeded()` scans `kwestup_data_v*` keys and promotes highest-version data; `clearIfChecks` protects user-data keys via `isUserDataKey()`.

## Key Abstractions

- **Theme matrix** — `themes` object in `src/theme/colors.js` is a 2D map of 5 names (`clean`, `blue`, `green`, `purple`, `dribbble`) × 3 modes (`light`, `dark`, `amoled`), each a palette of primitives (`primary`, `onPrimary`, `background`, `cardBackground`, `text`, `secondaryText`, `border`, `accent`, `success`, `error`, `warning`, plus Dribbble `cardBlue/Pink/Orange/Green`). A resolved `currentTheme` (`themes[name][mode]`) propagates to every screen/web as theme prop.
- **Vault service** — `src/utils/fileStorage.js` + `src/utils/vaultService.js` model Notes as filesystem-backed "vaults" (`getVaults`, `createVault`, active-vault resolution); notes are read/written as `.md` in `NFC/@@ documentDirectory/Notes/Vaults/{vaultId}/`.
- **Keyed storage abstraction** — `src/utils/storage.js` centralizes key naming, cache clearing, and legacy migration.
- **Sync connector** — `src/utils/syncService.js` wraps a local-network REST server: `pingSyncServer` then `performSync` exchanges tasks/notes/birthdays/themes/user config over Bearer-authenticated `POST /sync`.

## Entry Points

**JS Entry:**
- `index.js` — `registerRootComponent(App); registerWidgetTaskHandler(widgetTaskHandler);`
- `App.js` — top-level React component; sets up SafeArea/Paper/Navigation providers; owns boot & state; renders `AppNavigator`.

**Navigation entry:**
- `src/navigation/AppNavigator.js` — `createDrawerNavigator()`, initial route `"Dashboard"`, registers 9 screens.

**Android widget entry:**
- `index.js` registers `widgetTaskHandler` from `widgets/widget-task-handler.tsx`; widget definitions live in `app.json` under `expo.plugins` → `react-native-android-widget`.

## Architectural Constraints

- **Threading / state ownership:** Single-threaded JS; all state owned by `App.js`; there is no worker-thread model in the mobile runtime. UI cannot be unblocked separately from loads because `loadData` is awaited inside `useEffect`.
- **Global mutable module singletons:** `src/utils/aiService.js` keeps module-level `_llamaContext` and `_isInitializing` mutex (`let _llamaContext = null`). `App.js` holds numerous `useRef` throttle-mutex holders (timers, save-time guard).
- **Circular import risk:** `src/utils/fileStorage.js` and `src/theme/styles.js` mutually import the same barrel (`src/utils/storage.js`?) — verify; style imports `styles.js` from theme while `components` import from `styles`. `App.js` imports both `utils` and `components`.
- **Multiple React instances / stale closures:** Heavy dependency on `useCallback`+deps arrays across screens and `App.js`; `loadData/saveData/apply-theme` rely on capturing initial state, which can go stale if storage migrations mutate key data while an effect depends on the container callback list.
- **No test for sub-screens' internal reducers** — logic duplicated between `App.js` `toggleCompleteTask`/recurrence spawning and the widget `widget-task-handler.tsx` recurrence spawner (both implement recurring-task next-occurrence logic independently; risk of divergence).

## Error Handling

**Strategy:** Defensive try/catch in every util; on catch they `console.error`/`console.warn` and return safe default (`[]`, `{}`, `false`).
- Every storage getter (`getItem`/`getStorage`) wraps with try/catch and returns a default.
- AI/service calls translate native/network errors to user-facing messages (e.g. `src/utils/aiService.js` OOM/cert warnings).
- Network failures surface as `showConfirmation` dialogs in `App.js`.

## Cross-Cutting Concerns

**Logging:** `console.log`/`warn`/`error` throughout with emoji + function prefixes; `lint` disallows console but these are pervasive (warn-level in eslint config).
**Validation:** Lightweight, in-place guards in `App.js` (`VALID_THEME_MODES`, `resolveThemeMode/Name`) and compute helpers per screen; no formal validation layer.
**Permissions:** `requestNotificationPermissions`, camera permission via `expo-camera`, telemetry opt-in flag persisted in AsyncStorage.

---

*Architecture analysis: 2026-08-06*