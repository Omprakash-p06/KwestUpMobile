# Phase 9: Android Home-Screen Widgets - Research

**Researched:** 2026-05-31
**Domain:** Android AppWidgets / Expo Managed Workflow / React Native
**Confidence:** HIGH

## Summary

Android home-screen widgets run in a separate process from the React Native app. They cannot directly access JS state. The standard solution for Expo managed apps is `react-native-android-widget` (v0.20.3), which provides JSX widget primitives that map to native Android `RemoteViews`, ships an Expo config plugin, and supports both foreground (`requestWidgetUpdate`) and system-driven (`updatePeriodMillis`) updates.

This phase implements **two read-only widgets** — a Focus Timer countdown display and a Daily Tasks completion counter. Data flows from React state → AsyncStorage (already persisted) → widget task handler (reads on system update) or direct props (on foreground update). No deep linking is required per the requirements.

**Primary recommendation:** Use `react-native-android-widget` v0.20.3 with its Expo config plugin.

**Key architectural challenge:** Timer widgets cannot show true real-time (every-second) countdown when the app is backgrounded — this is an Android OS limitation where `updatePeriodMillis` enforces a 30-minute minimum. The widget will show the last known timer state and update only when the app is foregrounded or during periodic system refreshes.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

**No CONTEXT.md exists for Phase 9 yet.** No locked decisions have been established. The following are researcher recommendations to inform the discuss-phase.

**Note:** The REQUIREMENTS.md (WIDG-01) mentions using `react-native-android-widget` or custom Java/Kotlin widget providers. Both approaches are evaluated below.
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Widget UI rendering | Native Android (AppWidgetManager) | — | Widgets render via RemoteViews in the launcher process, not in RN JS |
| Widget layout definition | React Native JS | — | JSX widget primitives (FlexWidget, TextWidget) → native RemoteViews via bridge |
| Data persistence | AsyncStorage (React Native) | — | Timer state and daily tasks already persisted to AsyncStorage in App.js |
| Data bridge to widget | React Native (widget task handler) | AsyncStorage | Foreground: data passed as props via requestWidgetUpdate. Background: read from AsyncStorage in task handler |
| Periodic background updates | Android AppWidget system | — | `updatePeriodMillis` fires system-driven widget updates (30 min minimum) |
| Foreground push updates | React Native JS | — | `requestWidgetUpdate` called from App.js when timer ticks or tasks change |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native-android-widget` | ^0.20.3 | Build Android widgets using JSX primitives mapped to native RemoteViews | Most mature option (864★, 43 releases, May 2026), has Expo config plugin, supports New Architecture, JS-only widget definition [VERIFIED: npm registry, GitHub] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-native-async-storage/async-storage` | 2.1.2 (already installed) | Persist widget data for background reads | Already the app's storage layer — widget task handler reads from same AsyncStorage key |
| `expo-build-properties` | ~0.14.8 (already installed) | Gradle config properties | Already present — may need to verify no conflicts with widget plugin |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-android-widget` | Custom Kotlin AppWidgetProvider + Expo config plugin + RN native module | Full control but requires Kotlin/Java expertise, manual config plugin, and native module bridge. 10-15x more effort. No existing native android directory in this project. |
| `react-native-android-widget` | `expo-android-targets` | Uses Jetpack Glance (Compose for widgets) but very immature — 6 commits, not on npm, single developer, not production-ready [VERIFIED: GitHub] |

### Installation
```bash
npx expo install react-native-android-widget
```

**Version verification:**
```bash
npm view react-native-android-widget version
# → 0.20.3 (verified 2026-05-31)
```

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Native JS Thread                       │
│                                                                     │
│  ┌──────────────┐     ┌──────────────────┐     ┌────────────────┐  │
│  │  App.js       │     │  index.js         │     │ widget-task-   │  │
│  │  (useState)   │────>│  (entry point)    │────>│ handler.tsx    │  │
│  │               │     │                   │     │                │  │
│  │ timerRemaining│     │ registerRootComp- │     │ reads          │  │
│  │ isTimerRunning│     │ onent(App)        │     │ AsyncStorage   │  │
│  │ dailyTasks[]  │     │ registerWidget-   │     │ for cold-start │  │
│  │               │     │ TaskHandler(...)  │     │ or uses props  │  │
│  └──────┬───────┘     └──────────────────┘     └───────┬────────┘  │
│         │                                               │          │
│         │ requestWidgetUpdate({                         │          │
│         │   widgetName, renderWidget })                 │          │
└─────────┼───────────────────────────────────────────┬───┘──────────┘
          │                                           │
          ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Native Bridge (react-native-android-widget)        │
│                                                                       │
│  ┌──────────────┐        ┌────────────────────┐                      │
│  │  RN Widget   │        │ Widget Task Service │                      │
│  │  Module      │───────>│ (background JS      │                      │
│  │              │        │  execution)          │                      │
│  └──────────────┘        └──────────┬─────────┘                      │
│                                     │                                │
└─────────────────────────────────────┼────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Android AppWidget System                           │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  AppWidgetProvider (auto-generated by config plugin)              │  │
│  │  - Reads RemoteViews from bridge                                 │  │
│  │  - updatePeriodMillis (system-driven, 30 min min)                │  │
│  │  - Exposed via AndroidManifest <receiver>                        │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
│                             │                                         │
│                             ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Android Home Screen (Launcher)                                  │ │
│  │  ┌────────────────┐  ┌──────────────────┐                        │ │
│  │  │ Timer Widget   │  │ Daily Tasks      │                        │ │
│  │  │ ┌────────────┐ │  │ Widget            │                        │ │
│  │  │ │ 25:00      │ │  │ ┌──────────────┐  │                        │ │
│  │  │ │ Running    │ │  │ │ 3/5 completed│  │                        │ │
│  │  │ └────────────┘ │  │ └──────────────┘  │                        │ │
│  │  └────────────────┘  └──────────────────┘                         │ │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

**Data flow — Foreground (app visible):**
1. Timer ticks every 1s in App.js → `setTimerRemaining`
2. App.js calls `requestWidgetUpdate({ widgetName: 'FocusTimer', renderWidget: () => <FocusTimerWidget remaining={timerRemaining} isRunning={isTimerRunning} /> })`
3. Library bridges JSX → RemoteViews → AppWidgetManager → Launcher displays updated widget

**Data flow — Background (system update, every 30 min):**
1. Android AppWidget system fires `WIDGET_UPDATE`
2. Library calls registered `widgetTaskHandler` with `widgetAction = 'WIDGET_UPDATE'`
3. Handler reads `kwestup_data_v5.0` from AsyncStorage to get latest persisted state
4. Handler calls `props.renderWidget(<FocusTimerWidget remaining={stored.timerState.remaining} ... />)`
5. Library bridges JSX → RemoteViews → Launcher

### Recommended Project Structure
```
kwestup-mobile/
├── widgets/
│   ├── FocusTimerWidget.tsx          # Timer widget component (primitives)
│   ├── DailyTasksWidget.tsx          # Daily tasks widget component (primitives)
│   └── widget-task-handler.tsx       # Task handler: maps widget name → component, handles lifecycles
├── src/
│   └── utils/
│       └── widgetDataBridge.ts       # Formats App.js state into widget-friendly data shapes
├── assets/
│   └── widget-preview/
│       ├── focus-timer-preview.png   # Preview images for widget picker
│       └── daily-tasks-preview.png
├── index.js                          # Entry point (modified: add registerWidgetTaskHandler)
├── app.json                          # Modified: add react-native-android-widget config plugin
└── package.json                      # Modified: update "main" field to "index.js"
```

### Pattern 1: Widget Component using Primitives
**What:** Define widget UI using `react-native-android-widget` primitives (FlexWidget, TextWidget, etc.) — these map to Android RemoteViews.
**When to use:** Every widget component. These are the only allowed JSX elements — cannot use React Native `View`, `Text`, or other RN components inside widget definitions.
**Example:**
```tsx
'use no memo'; // Required to prevent React Compiler from adding hooks

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function FocusTimerWidget({ remaining, isRunning }) {
  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: 16,
        padding: 16,
      }}
      accessibilityLabel={`Focus timer showing ${timeStr}`}
    >
      <TextWidget
        text={timeStr}
        style={{
          fontSize: 32,
          fontFamily: 'sans-serif-medium',
          color: '#ffffff',
        }}
      />
      <TextWidget
        text={isRunning ? '● Focus Active' : '○ Timer Paused'}
        style={{
          fontSize: 14,
          color: isRunning ? '#4ade80' : '#94a3b8',
          marginTop: 4,
        }}
      />
    </FlexWidget>
  );
}
```
Source: [VERIFIED: react-native-android-widget docs — Widget Design](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/widget-design)

### Pattern 2: Widget Task Handler Registration
**What:** Register a task handler that maps widget names to components and handles lifecycle events (added, update, resized, deleted, click).
**When to use:** Required for every widget. Registered once at app entry point.
**Example — widget-task-handler.tsx:**
```tsx
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusTimerWidget } from './widgets/FocusTimerWidget';
import { DailyTasksWidget } from './widgets/DailyTasksWidget';
import { STORAGE_VERSION } from './src/utils/storage';

const nameToWidget = {
  FocusTimer: FocusTimerWidget,
  DailyTasks: DailyTasksWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const widgetName = widgetInfo.widgetName as keyof typeof nameToWidget;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE': {
      // For cold starts and periodic updates, read from AsyncStorage
      const raw = await AsyncStorage.getItem(`kwestup_data_${STORAGE_VERSION}`);
      let widgetData = {};
      if (raw) {
        const parsed = JSON.parse(raw);
        widgetData = {
          timerRemaining: parsed.timerState?.remaining ?? 0,
          isTimerRunning: parsed.timerState?.isRunning ?? false,
          dailyTaskCount: (parsed.dailyTasks || []).length,
          dailyTasksCompleted: (parsed.dailyTasks || []).filter(t => t.completed).length,
        };
      }
      const Widget = nameToWidget[widgetName];
      if (Widget) {
        props.renderWidget(<Widget {...widgetData} />);
      }
      break;
    }
    case 'WIDGET_DELETED':
      // Cleanup if needed — generally no-op for read-only widgets
      break;
    case 'WIDGET_CLICK':
      // No deep linking required per requirements
      break;
    default:
      break;
  }
}
```
Source: [VERIFIED: react-native-android-widget docs — Register task handler](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-task-handler)

### Pattern 3: Foreground Widget Update from App State
**What:** When React state changes (timer ticks, task toggles), push updates to the widget via `requestWidgetUpdate`.
**When to use:** Called from App.js whenever `timerRemaining`, `isTimerRunning`, or `dailyTasks` change.
**Example:**
```tsx
import { requestWidgetUpdate } from 'react-native-android-widget';
import { FocusTimerWidget } from './widgets/FocusTimerWidget';

// Inside App.js, in the timer useEffect or task completion handlers:
useEffect(() => {
  requestWidgetUpdate({
    widgetName: 'FocusTimer',
    renderWidget: () => (
      <FocusTimerWidget remaining={timerRemaining} isRunning={isTimerRunning} />
    ),
    widgetNotFound: () => {
      // No widget added to home screen — nothing to update
    },
  });
}, [timerRemaining, isTimerRunning]);
```
Source: [VERIFIED: react-native-android-widget docs — requestWidgetUpdate](https://saleksovski.github.io/react-native-android-widget/docs/api/request-widget-update)

### Pattern 4: Expo Config Plugin Registration
**What:** Register the widget in `app.json` so the config plugin injects the necessary Android native code during `npx expo prebuild`.
**When to use:** Required setup step when using Expo managed workflow.
**Example:**
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-android-widget",
        {
          "fonts": [],
          "widgets": [
            {
              "name": "FocusTimer",
              "label": "Focus Timer",
              "description": "Shows your current focus session timer status",
              "minWidth": "250dp",
              "minHeight": "100dp",
              "targetCellWidth": 3,
              "targetCellHeight": 2,
              "previewImage": "./assets/widget-preview/focus-timer-preview.png",
              "updatePeriodMillis": 1800000
            },
            {
              "name": "DailyTasks",
              "label": "Daily Tasks",
              "description": "Shows your daily task completion progress",
              "minWidth": "250dp",
              "minHeight": "100dp",
              "targetCellWidth": 3,
              "targetCellHeight": 2,
              "previewImage": "./assets/widget-preview/daily-tasks-preview.png",
              "updatePeriodMillis": 1800000
            }
          ]
        }
      ]
    ]
  }
}
```
Source: [VERIFIED: react-native-android-widget docs — Register widget in Expo](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-widget-expo)

### Anti-Patterns to Avoid
- **Using React Native components inside widgets**: `View`, `Text` don't work. Use `FlexWidget`, `TextWidget`, etc.
- **Using hooks in widget components**: Widget components must be pure functions. The `'use no memo'` directive prevents React Compiler from adding hooks.
- **Calling `requestWidgetUpdate` on every timer tick unconditionally**: The widget should only update when the app is foregrounded — background timers won't trigger JS. Debounce updates to every 2-5 seconds to avoid excessive bridge traffic.
- **Assuming real-time timer updates in background**: Android's `updatePeriodMillis` is minimum 30 minutes. The widget will never show true real-time countdown when the app is closed. This is an OS limitation, not a bug.
- **Storing widget-specific data separately from main app data**: The app already persists all state to AsyncStorage via `saveData()`. Use the same data store — don't create a parallel SharedPreferences unless absolutely necessary.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Android widget native code (AppWidgetProvider, AndroidManifest, RemoteViews) | Custom Java/Kotlin AppWidgetProvider | `react-native-android-widget` config plugin | Config plugin auto-generates all native Android widget plumbing (receiver registration, manifest entries, layout XML, RemoteViews construction). Writing it manually requires deep Android widget expertise and an Expo config plugin anyway. |
| Native bridge to call requestWidgetUpdate from JS | Custom React Native module for widget communication | `requestWidgetUpdate()` from library | Library provides `requestWidgetUpdate` and `requestWidgetUpdateById` out of the box, handling the JS→Native bridge for RemoteViews composition. |
| Widget system lifecycle handling | Custom BroadcastReceiver for APPWIDGET_UPDATE | `registerWidgetTaskHandler` | Library handles native BroadcastReceiver registration and maps to JS task handler with lifecycle events (WIDGET_ADDED, WIDGET_UPDATE, WIDGET_DELETED, WIDGET_CLICK). |

**Key insight:** Android AppWidgets are fundamentally native components. The `react-native-android-widget` library already handles the hardest parts: mapping JSX to RemoteViews, managing the native bridge, handling widget lifecycle events, and providing an Expo config plugin. Hand-rolling any of these would duplicate significant effort with no benefit for read-only info widgets.

---

## Common Pitfalls

### Pitfall 1: Widget task handler not registered before app boot
**What goes wrong:** The widget doesn't appear in the home screen widget picker, or tapping it does nothing.
**Why it happens:** `registerWidgetTaskHandler` must be called at module load time (before the React root renders), not inside a component or async callback.
**How to avoid:** Call `registerWidgetTaskHandler(widgetTaskHandler)` at the top level of `index.js` immediately after `registerRootComponent(App)`. Update `package.json` "main" field to point to `index.js`.
**Warning signs:** Widget doesn't show up after dev client rebuild.

### Pitfall 2: Using hooks or React Native components in widget definitions
**What goes wrong:** Build errors or blank widgets.
**Why it happens:** Widgets render as RemoteViews, not React Native views. Hooks (`useState`, `useEffect`) and RN primitives (`View`, `Text`) are not supported in this context.
**How to avoid:** Only use library primitives (`FlexWidget`, `TextWidget`, `ImageWidget`, etc.). Add `'use no memo'` directive at top of widget files to prevent React Compiler auto-memoization.
**Warning signs:** Metro bundler errors about invalid component types, or runtime crashes.

### Pitfall 3: Real-time timer expectation in background
**What goes wrong:** Widget shows stale timer value when app is backgrounded.
**Why it happens:** Android's `updatePeriodMillis` enforces a 30-minute minimum between system-driven widget updates. JS does not run in the background, so `requestWidgetUpdate` cannot fire when the app is closed.
**How to avoid:** Document this as expected behavior. The widget shows the timer state from the last foreground update or the most recent periodic system refresh. For "live" countdown, the user must open the app.
**Warning signs:** Users report "widget is stuck" — this is by design.

### Pitfall 4: Dev client rebuild required after adding widget
**What goes wrong:** Widget code changes don't show up after Metro hot reload.
**Why it happens:** Native widget registration (AppWidgetProvider in AndroidManifest, widget info XML) is baked into the native binary at build time. A new dev client build is required after changing widget config in `app.json`.
**How to avoid:** Always run `npx expo run:android` (or `eas build --profile development`) after modifying widget registration config. Code-only changes to `*.tsx` widget files only need Metro reload.
**Warning signs:** Widget picker shows old widgets, or new widgets don't appear.

### Pitfall 5: AsyncStorage key version mismatch
**What goes wrong:** Widget reads empty or stale data from AsyncStorage.
**Why it happens:** The app uses versioned storage key `kwestup_data_${STORAGE_VERSION}`. If the widget hard-codes a storage key that doesn't match, it reads nothing.
**How to avoid:** Import `STORAGE_VERSION` from `src/utils/storage.js` in the widget task handler. Always use the same dynamic key construction as `App.js`.
**Warning signs:** Widget shows "0/0 tasks" or "00:00" when app clearly has data.

---

## Code Examples

### Entry point (index.js) with widget task handler registration
```js
// index.js — modified to register widget task handler
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './widgets/widget-task-handler';

registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
```
Source: [VERIFIED: react-native-android-widget docs — Register task handler (Expo)](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-task-handler)

### DailyTasksWidget component
```tsx
'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function DailyTasksWidget({ dailyTaskCount, dailyTasksCompleted }) {
  const progress = dailyTaskCount > 0
    ? Math.round((dailyTasksCompleted / dailyTaskCount) * 100)
    : 0;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        borderRadius: 16,
        padding: 16,
      }}
      accessibilityLabel={`Daily tasks: ${dailyTasksCompleted} of ${dailyTaskCount} completed`}
    >
      <TextWidget
        text="Daily Tasks"
        style={{
          fontSize: 14,
          color: '#94a3b8',
          marginBottom: 8,
        }}
      />
      <TextWidget
        text={`${dailyTasksCompleted} / ${dailyTaskCount}`}
        style={{
          fontSize: 36,
          fontWeight: 'bold',
          color: dailyTasksCompleted === dailyTaskCount && dailyTaskCount > 0
            ? '#4ade80'
            : '#ffffff',
        }}
      />
      {dailyTaskCount > 0 && (
        <TextWidget
          text={`${progress}% complete`}
          style={{
            fontSize: 12,
            color: progress === 100 ? '#4ade80' : '#94a3b8',
            marginTop: 4,
          }}
        />
      )}
    </FlexWidget>
  );
}
```

### Data bridge utility (widgetDataBridge.ts)
```ts
// Formats App.js state into stable widget data for foreground updates
export function buildWidgetData(state: {
  timerRemaining: number;
  isTimerRunning: boolean;
  dailyTasks: Array<{ completed: boolean }>;
}) {
  return {
    timerRemaining: state.timerRemaining,
    isTimerRunning: state.isTimerRunning,
    dailyTaskCount: state.dailyTasks.length,
    dailyTasksCompleted: state.dailyTasks.filter(t => t.completed).length,
  };
}
```

### App.js integration (foreground widget updates)
```js
// Add to App.js — debounced widget update effect
import { requestWidgetUpdate } from 'react-native-android-widget';

// One combined update effect for both widgets
useEffect(() => {
  if (!isInitialized) return;

  const widgetData = {
    remaining: timerRemaining,
    isRunning: isTimerRunning,
    dailyTasksCompleted: dailyTasks.filter(t => t.completed).length,
    dailyTaskCount: dailyTasks.length,
  };

  requestWidgetUpdate({
    widgetName: 'FocusTimer',
    renderWidget: () => (
      <FocusTimerWidget remaining={widgetData.remaining} isRunning={widgetData.isRunning} />
    ),
  });

  requestWidgetUpdate({
    widgetName: 'DailyTasks',
    renderWidget: () => (
      <DailyTasksWidget
        dailyTaskCount={widgetData.dailyTaskCount}
        dailyTasksCompleted={widgetData.dailyTasksCompleted}
      />
    ),
  });
}, [timerRemaining, isTimerRunning, dailyTasks, isInitialized]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bare React Native + manual Android widget setup | Expo managed + `react-native-android-widget` config plugin | 2024+ | Zero native code needed for widget definition. Expo config plugin handles Android Manifest, AppWidgetProvider generation, and prebuild compatibility. |
| Pure RemoteViews XML layout | JSX primitives → RemoteViews bridge | 2023+ | Widget UI defined in JSX with FlexWidget, TextWidget — same mental model as React Native layout. No XML layout files needed. |
| AlarmManager for widget updates | WorkManager-backed task service | 2023+ | Library handles native task scheduling. Background widget updates are battery-safe. |

**Deprecated/outdated:**
- Writing raw `RemoteViews` XML layouts and `AppWidgetProvider` Java/Kotlin classes for Expo projects: The `react-native-android-widget` config plugin handles this automatically. Only consider this if you need native widget features the library doesn't support (custom configuration activities, complex animations).
- Using `react-native-widget` (unrelated, unmaintained): Different library, last updated 2019.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-native-android-widget` v0.20.3 is compatible with Expo SDK 53 and React Native 0.79 | Standard Stack | LOW — library has 43 releases, supports all recent RN versions. If incompatible, may need to use an older/pinned version. |
| A2 | AsyncStorage is accessible from the widget task handler's background JS context | Code Examples | LOW — AsyncStorage uses native SQLite via JNI, accessible from any native thread. If not, would need SharedPreferences bridge. |
| A3 | No deep linking is required — info-only widgets acceptable | Architecture Patterns | MEDIUM — stated in additional context. If user wants tap-to-open-timer, would need `WIDGET_CLICK` handling and deep link setup. |
| A4 | Widget preview images need to be manually created | Code Examples | LOW — can use screenshots from the app with placeholder widget layouts. No image generation tooling exists. |

---

## Open Questions

1. **Widget update frequency for foreground timer**
   - What we know: `requestWidgetUpdate` can be called from JS on every timer tick
   - What's unclear: Whether calling it every second creates excessive bridge traffic or causes jank
   - Recommendation: Start with updating every 1 second (timer tick interval). If performance issues observed, debounce to 2-5 seconds. The timer display on widget will appear "slower" than the in-app one.

2. **Custom fonts in widgets**
   - What we know: The config plugin supports `fonts: []` array for custom TTF fonts
   - What's unclear: Whether the app uses custom fonts anywhere or standard system fonts suffice
   - Recommendation: Skip custom fonts for now. Use Android system fonts (sans-serif, sans-serif-medium, serif, monospace) which work without extra configuration.

3. **Dark mode widget support**
   - What we know: The library supports dark mode via `renderWidget: () => ({ light: <LightWidget />, dark: <DarkWidget /> })`
   - What's unclear: Whether the user wants dark mode aware widgets
   - Recommendation: Start with a dark background widget that works on both light and dark home screens. The widget's own background color (e.g., `#1a1a2e`) makes it visible regardless of wallpaper/theme. Add system dark mode support in a follow-up.

---

## Validation Architecture

> `workflow.nyquist_validation` is set to `true` in config.json — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No widget-specific test framework — manual widget testing on physical device/emulator |
| Config file | N/A |
| Quick run command | `npx expo run:android` (requires dev client rebuild after widget config changes) |
| Full suite command | Same — widget testing is exclusively device-side |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIDG-01 | Focus Timer widget shows MM:SS countdown with running/paused state | manual | N/A — verify widget renders on home screen | ❌ manual only |
| WIDG-01 | Daily Tasks widget shows completed/total count | manual | N/A — verify widget renders on home screen | ❌ manual only |
| WIDG-01 | Widget updates when timer ticks in foreground | manual | — | ❌ manual only |
| WIDG-01 | Widget is listed in Android widget picker | manual | — | ❌ manual only |

### Sampling Rate
- **Per task commit:** Verify `npx expo run:android` builds without errors
- **Per wave merge:** Install dev client build on device, add widgets to home screen, verify data shows correctly
- **Phase gate:** Both widgets rendering correctly on Android home screen with live data

### Wave 0 Gaps
- [ ] No widget test infrastructure exists — testing is 100% manual on Android device/emulator
- [ ] `widgets/FocusTimerWidget.tsx` — widget component
- [ ] `widgets/DailyTasksWidget.tsx` — widget component
- [ ] `widgets/widget-task-handler.tsx` — task handler with AsyncStorage reads

---

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Widget is read-only display, no authentication needed |
| V3 Session Management | no | Widget has no interactive session |
| V4 Access Control | no | Widget reads from app's own AsyncStorage (sandboxed) |
| V5 Input Validation | no | Widget is display-only — no user input accepted |
| V6 Cryptography | no | Widget reads from app's existing storage — no sensitive data exposure |

### Known Threat Patterns
No applicable threat patterns — widgets are read-only display surfaces with no user input, network access, or sensitive data exposure. Data read from AsyncStorage is the same data already accessible to the app.

---

## Sources

### Primary (HIGH confidence)
- [GitHub: sAleksovski/react-native-android-widget](https://github.com/sAleksovski/react-native-android-widget) — 864 stars, 43 releases, v0.20.3
- [Docs: react-native-android-widget — Widget Design](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/widget-design) — verified widget primitives and constraints
- [Docs: react-native-android-widget — Register task handler](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-task-handler) — verified task handler API and Expo integration
- [Docs: react-native-android-widget — Register widget in Expo](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-widget-expo) — verified config plugin usage
- [Docs: react-native-android-widget — Update Widget](https://saleksovski.github.io/react-native-android-widget/docs/update-widget) — verified update mechanisms
- [Docs: react-native-android-widget — requestWidgetUpdate](https://saleksovski.github.io/react-native-android-widget/docs/api/request-widget-update) — verified API signature
- [npm registry: react-native-android-widget](https://www.npmjs.com/package/react-native-android-widget) — verified version 0.20.3

### Secondary (MEDIUM confidence)
- [Blog: Building Home Screen Widgets in an Expo React Native App](https://www.amanmaharshi.com/blog/how-to-create-widget-react-native-app) — walkthrough confirms Expo + react-native-android-widget workflow, config plugin steps, and `requestWidgetUpdate` pattern
- [DEV: How to build a widget for Android using Expo-based React Native](https://dev.to/prajwalnp/how-to-build-a-widget-for-android-using-expo-based-react-native-41c8) — alternative approach using custom native module + SharedPreferences

### Tertiary (LOW confidence)
- [GitHub: franciskouaho/expo-android-targets](https://github.com/franciskouaho/expo-android-targets) — evaluated as alternative but too immature (6 commits, not on npm)
- [SDK 55 changelog](https://expo.dev/changelog/sdk-55) — mentions "Alpha release of expo-widgets for iOS" — not relevant for SDK 53/Android

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `react-native-android-widget` is verified as current/maintained, v0.20.3 confirmed on npm
- Architecture: HIGH — data flow pattern (AsyncStorage → widget task handler / requestWidgetUpdate) is well-documented and matches the app's existing architecture
- Pitfalls: HIGH — all identified from official docs (limitations page, update mechanism docs) and community experience
- `expo-android-targets` viability: MEDIUM — code exists on GitHub but not published to npm, only 6 commits

**Research date:** 2026-05-31
**Valid until:** 2026-07-31 (library is stable, monthly releases)
