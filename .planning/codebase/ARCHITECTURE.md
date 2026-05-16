# Architecture

**Analysis Date:** 2025-05-17

## Pattern Overview

**Overall:** Monolithic "Single-File" Architecture.

**Key Characteristics:**
- **Monolithic Entry:** Almost all UI components, business logic, state management, and navigation routes are contained within `App.js`.
- **Hook-based State Management:** Uses React's `useState`, `useCallback`, and `useRef` for local and quasi-global state.
- **Drawer Navigation:** Uses `@react-navigation/drawer` to manage top-level navigation between screens defined as components within `App.js`.

## Layers

**UI Layer:**
- Purpose: Provides the user interface using React Native components and `react-native-paper` for theming.
- Location: `App.js` (Components like `CustomButton`, `TaskCard`, `DashboardScreen`, etc.)
- Contains: Functional components with inline styles or `StyleSheet.create`.
- Depends on: React, React Native, React Navigation.
- Used by: React Native runtime.

**Business Logic Layer:**
- Purpose: Handles task management, birthday tracking, and notification scheduling.
- Location: `App.js` (Internal functions within the `App` component).
- Contains: Functions like `toggleTaskComplete`, `scheduleDueDateNotification`, `calculateRemainingTime`.
- Depends on: `expo-notifications`, `AsyncStorage`.
- Used by: UI Layer.

**Persistence Layer:**
- Purpose: Persists application state (tasks, settings, user name) across sessions.
- Location: `App.js` (`loadData` and `saveData` functions).
- Contains: `AsyncStorage` calls wrapped in `useCallback` and triggered by `useEffect`.
- Depends on: `@react-native-async-storage/async-storage`.
- Used by: Business Logic Layer.

## Data Flow

**Standard Task Update Flow:**

1. User interacts with a UI component (e.g., `TaskCard` toggle).
2. Event handler in `App.js` (e.g., `toggleTaskComplete`) updates the local state (`tasks`).
3. State update triggers a re-render of the UI.
4. An `useEffect` hook observing the `tasks` state triggers `saveData`.
5. `saveData` persists the updated state to `AsyncStorage`.

**State Management:**
- Application state is managed centrally within the `App` component in `App.js`.
- Data is passed down to "Route" components (like `DashboardScreen`, `TaskListScreen`) via props.

## Key Abstractions

**Custom Components:**
- Purpose: Reusable UI elements to maintain visual consistency.
- Examples: `CustomButton`, `CustomTextInput`, `CustomCard` in `App.js`.
- Pattern: Functional components accepting props for styling and behavior.

**Route Components:**
- Purpose: Represent different screens in the app's drawer navigation.
- Examples: `DashboardScreen`, `DailyTasksRoute`, `BirthdaysRoute`, `SettingsRoute` in `App.js`.
- Pattern: Prop-drilling for state and action handlers.

## Entry Points

**registerRootComponent:**
- Location: `index.js`
- Triggers: Application startup.
- Responsibilities: Boots the Expo environment and registers the `App` component.

**Main App Component:**
- Location: `App.js`
- Triggers: Mounted by `index.js`.
- Responsibilities: Initializes state, loads persisted data, sets up notification listeners, and renders the `NavigationContainer`.

## Error Handling

**Strategy:** Inline error catching and `Alert` feedback.

**Patterns:**
- `try...catch` blocks around asynchronous operations like `AsyncStorage` access and Notification permission requests.
- `Alert.alert` for user-facing error messages.

## Cross-Cutting Concerns

**Logging:** Uses standard `console.log` for debugging and tracking flow (e.g., `console.log("Drawer created successfully")`).
**Validation:** Basic validation within event handlers (e.g., checking for empty strings before adding a task).
**Authentication:** Not detected (local-only app based on current code).
**Notifications:** Managed via `expo-notifications` with centralized scheduling logic in `App.js`.

---

*Architecture analysis: 2025-05-17*
