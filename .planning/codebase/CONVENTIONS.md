# Coding Conventions

**Analysis Date:** 2026-08-06

## Language & Runtime Overview

This is a **React Native** app built with **Expo SDK 53** and **React 19** (`react-native` 0.79.5). Two syntax populations coexist:

- **Plain JS (ECMAScript via Babel)** — all app source under `src/`, root `App.js`, `index.js`. No type annotations.
- **TypeScript (`.tsx`)** — only the Android home-screen widgets under `widgets/`, which render with `react-native-android-widget` (`@types/react` + `typescript` 5.8 installed but only widget files are typed).

New code in `src/` should be written as untyped JS unless it touches the widget pipeline (`widgets/`).

## Naming Patterns

**Files:**
- Components and screens use **PascalCase**: `src/components/CustomButton.js`, `src/screens/SettingsScreen.js`, `src/components/TaskEditModal.js`.
- Utility/service modules use **camelCase**: `src/utils/vaultService.js`, `src/utils/fileStorage.js`, `src/utils/storage.js`.
- Widget files use **PascalCase** (`FocusTimerWidget.tsx`) except the imperative handler `widgets/widget-task-handler.tsx`.
- Root entry files are lowercase: `index.js`, `App.js`, `babel.config.js`, `metro.config.js`.

**Components:**
- Exported as **named arrow constants**: `export const CustomButton = ({ ... }) => { ... }`.
- Widgets are exported as **named function declarations**: `export function FocusTimerWidget({ ... }: Props) { ... }` (`widgets/FocusTimerWidget.tsx`).

**Functions:**
- **camelCase**, prefixed with intent: `handleSaveTask`, `handleExecuteSync`, `toggleTaskComplete`, `saveData`, `loadData`, `initializeApp` (`App.js`).

**Variables/State:**
- **camelCase**; every piece of React state uses a `[value, setValue]` pair with a leading `set` (e.g. `const [tasks, setTasks] = useState([])` in `App.js`).
- `useRef` variables end in `Ref`: `confirmationActionRef`, `timerIntervalRef`, `lastSaveTimeRef` (`App.js`).

**Types (widgets only):**
- Interfaces are PascalCase and suffixed with `Props` for component props: `TasksListWidgetProps`, `WidgetTaskHandlerProps` (`widgets/TasksListWidget.tsx`, `widgets/widget-task-handler.tsx`). Domain models are plain interfaces like `TaskItemType`, `AppData`, `TimerState` (`widgets/widget-task-handler.tsx`).

**Constants:**
- Module-level immutable constants use **UPPER_SNAKE_CASE**: `APP_VERSION`, `STORAGE_VERSION` (`src/utils/storage.js`), `VALID_THEME_MODES`, `FORCE_CLEAR_ALL_STORAGE` (`App.js`).
- Smaller local (component-scope) constants are camelCase: `MODEL_PATH`, `localUri`, `tempUserName`.

## Code Style

**Formatting:** There is **no Prettier** config anywhere in the repo. Formatting is manual. Note the inconsistency and match the dominant style per file:
- Semicolons are used (almost) universally — keep them.
- **Quotes: mixed but predictable.** `src/` and `App.js` use **double quotes** predominantly (`import ... from "react"`). The `widgets/*.tsx` files, `index.js`, and built tool files (`patch-llama-gradle.js`) use **single quotes**. Follow the convention of the file you are editing.
- Indentation: 2 spaces.
- Imports are memo-sorted by library group (see Import Organization).

**Linting (flat config):**
- Tool: **ESLint 9** flat config, config file `eslint.config.js`. Run via `npm run lint` (`eslint .`).
- Parser: `@babel/eslint-parser` (JS), extending `plugin:react/recommended`.
- Plugins: `eslint-plugin-react`, `eslint-plugin-react-native`, `eslint-plugin-react-hooks`.
- Key rules (from `eslint.config.js`):
  - `react/react-in-jsx-scope`: **off** (React 19 no longer needs the import — in fact `App.js` imports React, but don't add `React` just for JSX).
  - `react/prop-types`: **off** (no PropTypes anywhere in the codebase).
  - `react-native/no-inline-styles`: **warn**.
  - `react-native/no-color-literals`: **warn**.
  - `react-native/sort-styles`: **off**.
  - `react-hooks/rules-of-hooks`: **error**.
  - `react-hooks/exhaustive-deps`: **warn**.
  - `no-unused-vars`: **warn** with `argsIgnorePattern: '^_'` (prefix intentionally-unused args with `_`).
  - `no-console`: **warn** (console usage is heavy here; see Logging).
- Ignored paths: `node_modules`, `.expo`, `dist`, `web-build`, `android`, `ios`, `KwestUpPC`, `assets`.
- `lint:report` emits a JSON report to `eslint-report.json`: `npm run lint:report`.
- A **duplicate legacy config** `.eslintrc.js` exists at the root. It is **not used** by ESL 9 (flat config wins) but kept — do not rely on it; make changes in `eslint.config.js`.

## Import Organization

Imports are grouped with `// ...` comment banders, consciously ordered:

1. React (`import React from "react"`).
2. `react-native` core primitives.
3. Third-party libs (React Native Paper, react-navigation, expo modules, AsyncStorage).
4. Local app modules (relative `./src/...`, `../`).

Example from `App.js`:

```js
import React from "react";
import { View, Text, Platform, ActivityIndicator } from "react-native";
import { PaperProvider } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Component imports
import { CustomButton } from "./src/components/CustomButton";
// Theme and Navigation imports
import { themes } from "./src/theme/colors";
// Utility imports
import { APP_VERSION, clearAllCaches } from "./src/utils/storage";
```

- **Expo modules are imported as namespace:** `import * as Notifications from "expo-notifications"`, `import * as Haptics from "expo-haptics"`, `import * as FileSystem from "expo-file-system"`, `import * as DocumentPicker from "expo-document-picker"`, `import * as Sharing from 'expo-sharing'`.
- **Path aliases: none.** Everything is relative (`./` or `../`); there is no `@/` alias. `tsconfig.json` simply extends `expo/tsconfig.base` with no `paths`.

## Component Conventions

- Destructure props in the function signature and provide a default value for lists/optional props (`tasks = []`, `onCancel = null`, `is24Hour = false` in `src/components/CustomDateTimePicker.js`).
- **Single default button entry point**: shared UI lives in `src/components/` as `Custom*` primitives (`CustomButton`, `CustomTextInput`, `CustomSwitch`, `CustomCard`, `CustomBadge`, `CustomDateTimePicker`, `CustomSegmentedButtons`).
- **Theme via prop drilling:** components receive `color` / `currentTheme` / `theme` props; global styles come from `src/theme/styles.js` (`styles` via JSX `StyleSheet.create`) and palettes from `src/theme/colors.js` (`themes`, `dribbbleColors`).
- **Inline style objects in JSX appear** (e.g. `style={{ flex: 1, backgroundColor: currentTheme.background }}` in `App.js`) — tolerated but flagged by lint (`no-inline-styles: warn`). Prefer `StyleSheet.create` + `styles.*` where reasonable.
- Haptics feedback is used on user actions: `Haptics.impactAsync(...)` and `Haptics.notificationAsync(...)` (`src/components/CustomButton.js`, `App.js`).

## State Management & Data Flow

- **State is lifted to `App`** and passed down to screens via `AppNavigator`/`App` props (`App.js`). No global store (no Redux/Zustand/Context provider). The `App` component is the singleton store.
- **Persistence:** AsyncStorage via `@react-native-async-storage/async-storage`. Keys are namespaced with the `kwestup_` prefix and often versioned with `STORAGE_VERSION`: `kwestup_data_${STORAGE_VERSION}`, `kwestup_timer_state_${STORAGE_VERSION}`, `kwestup_theme_mode_${STORAGE_VERSION}` (`App.js`, `src/utils/storage.js`).
- **Vault/note** reads go through `src/utils/fileStorage.js` (expo-file-system) using `getVaultPath()` from `src/utils/vaultService.js`.
- **Storage writes are version-aware** and gated behind a 1.5-second throttle to guard Binder buffer limits (`App.js saveData` effect). Widget updates are throttled/staggered (5s timer, 500ms/250ms stagger) and gated on app foreground — preserve these limits when touching `App.js`.

## Naming & Structure of Utilities

- Utility modules export **named** arrow functions and constants (no default).
- Error/failure signal is returned as boolean or `{ success: ..., error: ... }` object (`src/utils/fileStorage.js` `saveNoteFile`, `src/utils/exportService.js`).
- Pure-business logic is isolated for testability (`src/utils/billingStorage.js` exports pure helpers `getSpendingByCategory`, `getMonthlyTotals`).

## State / Effect Conventions

- async lifecycle and data-loading logic lives in `useCallback` (memoized) — `loadData`, `saveData`, `initializeApp` (`App.js`).
- `useEffect` triggers side effects and **cleans up** timers/subscriptions (`return () => clearTimeout(...)`, `AppState.remove()` in `App.js`).
- `useRef` for values that shouldn't trigger re-render (throttle bookkeeping, active confirmation actions, AppState).

## Error Handling

**Pattern:** permissive try/catch/finally with early graceful returns and functional safety.

```js
try {
  return await AsyncStorage.setItem(key, JSON.stringify(dataToSave));
} catch (error) {
  console.error("❌ Failed to save main data:", error);
}
```

- **Log-and-continue:** most errors are surfaced via `console.error`, and control flow falls back to sensible defaults (empty arrays, a default list, `null`) rather than exiting (`App.js loadData` catch block resets all state to defaults).
- **Return failure flags:** file handlers return `{ success: false, error }` and storage setters return early booleans (`src/utils/storage.js clearAllCaches`, `migrateUserDataIfNeeded`).
- **Fire-and-forget:** background/request init failures are isolated (`App.js backgroundInit`), logged at warn level, and never block UI.
- **User-facing** errors go through a `showConfirmation(...)` modal callback (`App.js`, `src/screens/SettingsScreen.js`) — used for confirmations and error toasts.
- Input-guard: functions `return` early on blank values (e.g. `handleCreateList` returns when `!name || !name.trim()`).

## Logging

- **Framework:** plain `console` — no logging library.
- **Levels:** `console.log` (success/info), `console.warn` (recoverable), `console.error` (failures). Only `no-console` is a warning in eslint.
- **Convention:** prefix messages with an emoji token (e.g. `🔄`, `✅`, `❌`, `🗑️`, `🤖`, `🧹`, `📊`, `⚠️`) and keep the first word UPPERCASE for the headline action:
  - `console.log("💾 Main data saved successfully to:", storageKey);`
  - `console.error("❌ APP INITIALIZATION FAILED:", error);`
  - `console.warn("⚠️ Background init step failed (non-critical):", bgErr);`
- The `[WidgetTaskHandler]` prefix is used for widget-side logs: `console.warn('[WidgetTaskHandler] Failed to toggle task state:', err);`.

## Comments

- **Inline/JSDoc:** JSDoc-style block comments are used on utilities/services: `/** ... */` with `@param {string} x` + occasional prose (`src/utils/fileStorage.js`, `src/utils/billingStorage.js`, `src/utils/syncService.js`). Components/screens use // `//` line comments only.
- **Section headers:** UPPERCASE or boxed divider comments:
  - `// COMPREHENSIVE CACHE CLEARING SYSTEM (Safely preserves user data)` (`src/utils/storage.js`).
  - `// NETWORK DIAGNOSTICS` (`src/utils/diagnostics.js`).
  - `// ─── Core Vault-Parameterized File Operations ────────` (`src/utils/fileStorage.js`).
- **intentional`** phase markers:** the top of a feature file may carry a large `/** ... */` header documenting intent (`src/components/AIAssistant.js`, `widgets/widget-task-handler.tsx`).
- **Comments explain non-obvious decisions:** `// THROTTLE` rules are commented with "THROTTLE NOTE" / "STAGGER" exemplars in `App.js` widget effects.

## Module Design

- **Exports:** named exports everywhere; `export default` is used only for `App.js` (the root component registered by `index.js`).
- **Barrel files:** none (`src/components/` has no index barrel; screens are imported directly per path).
- **Imports of local files** are always into path specifiers (e.g. `../screens/TaskListScreen`).
- Path imports in `src/` from sibling directories use `../` correctly.

---

*Convention analysis: 2026-08-06*