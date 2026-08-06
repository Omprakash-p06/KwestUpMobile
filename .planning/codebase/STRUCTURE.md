# Codebase Structure

**Analysis Date:** 2026-08-06

## Directory Layout

```
kwestupmobile/  (project root)
├── App.js                    # Root component — owns ALL state & boot logic (monolith)
├── index.js                  # Expo root registration + widget handler registration (~11 lines)
├── app.json                  # Expo app config; android package, plugins, widget definitions
├── package.json              # Scripts + dependencies (Expo 53, RN 0.79, React 19)
├── eas.json                  # EAS Build profiles (development/preview/production)
├── babel.config.js           # babel-preset-expo + react-native-reanimated/plugin
├── metro.config.js           # Expo metro default config
├── eslint.config.js          # ESLint flat config (babel parser, react/react-native/react-hooks)
├── tsconfig.json             # Extends expo/tsconfig.base; compilerOptions empty
├── .eslintrc.js              # Legacy ESLint config (superseded by eslint.config.js)
├── patch-llama-gradle.js     # postinstall script patching llama.rn gradle
├── CHECKOP.BAT / check.bat   # Dev helper scripts (root)
├── src/                      # Primary app source
│   ├── screens/              # 9 feature screens
│   ├── components/           # 14 shared UI components
│   ├── navigation/           # Drawer navigator + custom drawer content
│   ├── theme/                # color palettes + shared styles
│   └── utils/                # service modules (11 files)
├── widgets/                  # Android home-screen widgets (.tsx)
├── assets/                   # Images: app-logo, splash-icon, favicon, widget previews
├── android/                  # Native Android project (Expo prebuild output)
├── __tests__/                # Jest tests (phase12-widget-logic.test.js)
├── .github/                  # CI workflows
└── .planning/                # GSD planning artifacts (this document lives here/codebase/)
```

## Directory Purposes

**`src/`** — Primary source tree.
- Purpose: All React app code (screens, components, navigation, theme, utils).
- Key files: `App.js` is the container and is REQUIRED alongside `src/`.

**`src/screens/`**
- Purpose: One file per feature screen.
- Contains: `DashboardScreen.js`, `DailyTasksScreen.js`, `BirthdaysScreen.js`, `BillingScreen.js`, `TaskListScreen.js`, `NotesScreen.js`, `FocusTimerScreen.js`, `SettingsScreen.js`, `SearchScreen.js` (9 screens).
- Key files: `SettingsScreen.js` (~1100 lines, includes diagnostics/AI model/backup/sync/theme), `NotesScreen.js` (~2000 lines, vault file explorer + inline editor).

**`src/components/`**
- Purpose: Reusable UI primitives, consumed by screens and `App.js`.
- Contains: `CustomButton.js`, `CustomTextInput.js`, `CustomCard.js`, `CustomBadge.js`, `CustomSwitch.js`, `CustomSegmentedButtons.js`, `CustomDateTimePicker.js`, `LiquidGlassCard.js`, `LiquidGlassBackground.js`, `TaskCard.js`, `TaskEditModal.js`, `TimerLockoutOverlay.js`, `QRScannerModal.js`, `AIAssistant.js` (14 files).
- Most exports are named exports (see `App.js` import style `import { CustomButton } from "./src/components/CustomButton"`).

**`src/navigation/`**
- `AppNavigator.js` — Drawer navigator wiring all 9 screens and prop-drilling from `App.js`.
- `CustomDrawerContent.js` — custom styled drawer with theme toggle.

**`src/theme/`**
- `colors.js` — exports `themes` (5 palette names × 3 modes).
- `styles.js` — shared global `StyleSheet` + `injectFontFamily()` mutation helper.

**`src/utils/`**
- Purpose: Stateless service modules for side effects (see table below).
- 11 files: `storage.js`, `notifications.js`, `fileStorage.js`, `vaultService.js`, `vaultImport.js`, `syncService.js`, `exportService.js`, `aiService.js`, `diagnostics.js`, `billingStorage.js`, `billingNotifications.js`.

| Util | Responsibility |
|------|----------------|
| `src/utils/storage.js` | Versioned keys, `clearAllCaches`, `migrateUserDataIfNeeded`, `isUserDataKey`. |
| `src/utils/notifications.js` | Permissions; schedule due-date, daily, push, birthday reminders. |
| `src/utils/fileStorage.js` | Vault-parameterized `.md` note read/write/delete/scan/wipe + hashtag extraction. |
| `src/utils/vaultService.js` | Vault CRUD, active-vault path/ID resolution, migrations. |
| `src/utils/vaultImport.js` | `importMDFilesAsVault` via document picker. |
| `src/utils/syncService.js` | LAN REST sync client (`pingSyncServer`, `performSync`). |
| `src/utils/exportService.js` | AES-256 encrypted backup export/import. |
| `src/utils/aiService.js` | llama.rn model lifecycle + inference (summarize/extract/parse/assist). |
| `src/utils/diagnostics.js` | Device/network diagnostics, GitHub release update check, telemetry. |
| `src/utils/billingStorage.js` | Billing transactions/budgets/recurring bills AsyncStorage CRUD. |
| `src/utils/billingNotifications.js` | Recurring bill reminder scheduling. |

**`widgets/`**
- Purpose: Android home-screen widgets (render + shared data reader).
- Contains: `FocusTimerWidget.tsx`, `DailyTasksWidget.tsx`, `ImportantTasksWidget.tsx`, `TasksListWidget.tsx`, `widget-task-handler.tsx`.
- Widgets use `.tsx` while the rest of the app uses `.js`; they import from `src/utils/storage.js` (JS) so shared source is duplicated across TS/JS boundaries.

**`android/`** — Prebuild native Android project (Gradle). Contains `app/`, `build.gradle`, `gradlew`, `settings.gradle`. Not hand-authored; regenerated from Expo prebuild when `app.json` changes. `.gitignore` present to exclude build outputs.

**`assets/`** — App logo, splash icon, favicon, template fonts, widget preview images.

**`__tests__/`** — Jest test folder (currently one file: `phase12-widget-logic.test.js`).

**`build/`** — Build artifacts (from EAS/native and/or `dist`) — the repo root also lists a `build/` dir (not source; exclusions may vary).

## Key File Locations

**Entry Points:**
- `index.js`: app + widget bootstrap (`registerRootComponent`, `registerWidgetTaskHandler`).
- `App.js`: root React component; mount point for providers and `AppNavigator`.

**Configuration:**
- `app.json`: Expo app config; contains the `react-native-android-widget` plugin config listing the 4 widgets.
- `eas.json`: EAS build profiles.
- `babel.config.js` / `metro.config.js` / `tsconfig.json`: bundler/compiler config.
- `eslint.config.js`: flat lint config; legacy `.eslintrc.js` still present but ignored.
- `patch-llama-gradle.js`: `postinstall` hook that patches llama.rn's gradle file after install.

**Core Logic:**
- `App.js`: state ownership, load/save, recurrence-spawning, sync orchestration, widget update push.
- `src/navigation/AppNavigator.js`: route wiring + prop plumbing.
- `src/utils/*.js`: services (storage, notifications, sync, AI, vault, billing, export).

**Testing:**
- `__tests__/phase12-widget-logic.test.js`: the single Jest test.

## Naming Conventions

**Files:**
- `.js` for all app source (screens, components, utils, navigation, theme).
- `.tsx` only under `widgets/` (Android widget renderers).
- PascalCase file name per screen/component (e.g. `DashboardScreen.js`, `CustomButton.js`).
- Lowercase for service/theme wiring files where unambiguous: `storage.js`, `colors.js`, `styles.js`, `AppNavigator.js`/`CustomDrawerContent.js` (PascalCase for navigation).
- Test files: `phase12-<feature>-logic.test.js` pattern in `__tests__/`.

**Export style:**
- Screens/components/navigation export **named** members (`export const DashboardScreen = () => {}`).
- Root `App.js` has `export default App`.
- Utils mix named `export const fn` / `export async function fn` same files (e.g. `notifications.js` uses `export async function`, `storage.js` uses `export const`).
- Widgets export default components where convenient (e.g. `FocusTimerWidget`), but `FocusTimerWidget` imported as named in `App.js`.

## Where to Add New Code

**New Feature / Screen:**
- Add a screen in `src/screens/<FeatureScreen>.js` and register it in `src/navigation/AppNavigator.js` (add `<Drawer.Screen>` + prop plumbing). Any new persisted state slice should be added to the `App.js` state buckets and mentioned in the `saveData`/`loadData`/`STORAGE_VERSION`-key set so it persists.

**New Shared UI Component:**
- `src/components/<ComponentName>.js`, using named export, consistent with existing primitives. If global styles are needed, add to `src/theme/styles.js` `rawStyles` (the `injectFontFamily` mutation will run).

**New Service / Side-Effect Module:**
- `src/utils/<name>.js`. Import the version/context utilities from `src/utils/storage.js` (`STORAGE_VERSION`, `APP_VERSION`, `isUserDataKey`) rather than hardcoding keys.

**New Widget:**
- Add the renderer under `widgets/<Name>Widget.tsx`, wire it into `nameToWidget` in `widgets/widget-task-handler.tsx`, register it in `app.json` under the `react-native-android-widget` plugin widgets list, and push updates from `App.js`.

**Complex route/screen logic:**
- Keep computation in screens but add any shared, picky business logic (e.g. recurrence, streak/streak reset) to `src/utils/` — DRY is a struggle because `App.js` and widget handler duplicate it.

## Special Directories

| Directory | Purpose | Generated | Committed |
|-----------|---------|-----------|-----------|
| `.planning/` | GSD planning, codebase docs (`codebase/`), phases, milestones | No | Yes |
| `android/` | Native Android project (Expo prebuild output) | Yes | Partially (`.gitignore` present) |
| `assets/` | Static images/fonts | No | Yes |
| `build/` | Build/dist artifacts | Yes | No |
| `__tests__/` | Jest tests | No | Yes |
| `.github/` | CI/workflows | No | Yes |

---

*Structure analysis: 2026-08-06*