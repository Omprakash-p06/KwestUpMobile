# Phase 25 Research: Intervention Engine & Behavioral Home-Screen Widgets

**Phase:** 25 of 28 (Milestone 3: KwestUp 4.0 — Atomic Behavior Engine)  
**Requirements Addressed:** `INTV-01`, `WIDG-03`  
**Domain:** Multi-Surface Behavioral Interventions, Anti-Spam & Quiet-Hour Policy, Behavioral Android Widgets, Headless Task Handler, TypeScript Hardening  
**Date:** 2026-10-11  

---

## 1. Executive Summary

Phase 25 operationalizes the behavioral models established in Phase 24 across multi-surface touchpoints: **Notifications**, **Home-Screen Widgets**, and **In-App Surfacing**.

As articulated in [`4.0/KwestUp_4.0_Master_Plan.md §9`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/4.0/KwestUp_4.0_Master_Plan.md#L503):
> *"Widgets become behavioral surfaces... The app must work even when the user does not voluntarily open it. Widgets, notifications and direct notification actions become behavioral surfaces."*

Crucially, behavioral prompts must never degrade into aggressive nagware. Under Atomic Habits principles, cues must make behavior obvious and friction-free, not irritating or guilt-inducing. All intervention dispatch and touchpoint prioritization must be strictly arbitrated by deterministic machine rules in [`rulebook/machine/interventionRules.json`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/rulebook/machine/interventionRules.json).

Phase 25 achieves this across two core workstreams:
1. **Multi-Surface `interventionEngine.ts` (`INTV-01`):**
   - Pure, deterministic arbitration engine evaluated via [`src/behavior/ruleEngine.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/behavior/ruleEngine.ts).
   - Enforces anti-spam limits (`REMINDER_ANTI_SPAM_001`: max $\le 3$ behavioral notifications/calendar day; falls back to widget surface).
   - Enforces quiet-hour gates (`QUIET_HOURS_001`: no non-critical notifications between 22:00 and 08:00 local time; defers to morning shift at 08:15).
   - Enforces minimum notification cooldown gap (`REMINDER_MIN_GAP_001`: 90-minute gap between notifications).
   - Enforces widget priority hierarchy (`WIDGET_PRIORITY_001`: Recovery > Today Habit > Next Action).
   - Outputs full execution audit traces (`rulesApplied: [...]`).

2. **Behavioral Home-Screen Widgets & Headless Handler Hardening (`WIDG-03`):**
   - Dedicated behavioral widget renderer ([`widgets/HabitWidget.tsx`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/widgets/HabitWidget.tsx)) rendering actionable behavioral states:
     - **Mode 1: Never Miss Twice Recovery Cue** (`DON'T MISS TWICE`, 2-min version starter).
     - **Mode 2: Today Habit Objective** (`TODAY DUE`, target behavior).
     - **Mode 3: Next Action Starter** (`2-MIN MINIMUM`, starter action).
   - Headless tap handling in [`widgets/widget-task-handler.tsx`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/widgets/widget-task-handler.tsx) executing against isolated storage ([`kwestup_habits_v1`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/context/HabitContext.js#L34)) using pure [`completeHabit`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/behavior/habitEngine.ts) without waking the main React UI.
   - App foreground state convergence in `HabitContext.js` listening for `AppState === 'active'`.
   - Resolution of pre-existing style-type errors in `TasksListWidget.tsx` (`flex` excess props) and inclusion of `widgets/` in [`tsconfig.json`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/tsconfig.json#L35).

---

## 2. Machine Rulebook Alignment (`rulebook/machine/interventionRules.json`)

The machine rulebook specifies 4 distinct rules governing intervention delivery:

```json
{
  "rules": [
    {
      "id": "REMINDER_ANTI_SPAM_001",
      "description": "Enforce hard cap of ≤3 behavioral notifications per calendar day to avoid nagware fatigue.",
      "when": {
        "surface": "notification",
        "behaviorNotificationsToday": ">=3"
      },
      "then": {
        "action": "BLOCK_BEHAVIOR_NOTIFICATION",
        "fallbackSurface": "widget"
      },
      "priority": 100
    },
    {
      "id": "QUIET_HOURS_001",
      "description": "Enforce quiet hours: no non-critical behavioral notifications between 22:00 and 08:00 local time.",
      "when": {
        "surface": "notification",
        "currentTime": "inQuietHours"
      },
      "then": {
        "action": "DEFER_NOTIFICATION_UNTIL_MORNING",
        "targetTime": "08:15"
      },
      "priority": 95
    },
    {
      "id": "REMINDER_MIN_GAP_001",
      "description": "Minimum 90-minute cooldown gap between consecutive behavioral notifications.",
      "when": {
        "surface": "notification",
        "minutesSinceLastNotification": "<90"
      },
      "then": {
        "action": "THROTTLE_NOTIFICATION"
      },
      "priority": 90
    },
    {
      "id": "WIDGET_PRIORITY_001",
      "description": "Android widget surface priority hierarchy: Recovery > Today Habit > Next Action.",
      "when": {
        "surface": "widget",
        "event": "RENDER_WIDGET"
      },
      "then": {
        "action": "SELECT_HIGHEST_PRIORITY_TOUCHPOINT",
        "order": ["recovery", "today_due", "next_action"]
      },
      "priority": 80
    }
  ]
}
```

### Analysis of Rule Mechanics:
1. **`REMINDER_ANTI_SPAM_001` (Priority 100):**
   - Condition: `surface === 'notification'`, `behaviorNotificationsToday >= 3`.
   - Consequence: Blocks notification dispatch. Crucially, sets `fallbackSurface = 'widget'`. Rather than silencing the prompt entirely, the intervention is redirected to the home-screen widget where it remains discoverable without disrupting the user via audio/haptic pushes.
2. **`QUIET_HOURS_001` (Priority 95):**
   - Condition: `surface === 'notification'`, `currentTime === 'inQuietHours'`.
   - Quiet window: local wall-clock time between 22:00 and 08:00 (i.e. `[22:00, 08:00)`).
   - Consequence: Defers notification until morning with target time `08:15`. If the trigger time is $\ge 22:00$, it shifts to 08:15 the following morning; if the trigger time is $< 08:00$, it shifts to 08:15 the same morning.
3. **`REMINDER_MIN_GAP_001` (Priority 90):**
   - Condition: `surface === 'notification'`, `minutesSinceLastNotification < 90`.
   - Consequence: Throttles dispatch to guarantee at least 90 minutes of silence between consecutive behavioral cues.
4. **`WIDGET_PRIORITY_001` (Priority 80):**
   - Condition: `surface === 'widget'`, `event === 'RENDER_WIDGET'`.
   - Consequence: Priority order: `["recovery", "today_due", "next_action"]`.
     - 1st: Any habit requiring recovery ("Never Miss Twice" state machine).
     - 2nd: Today's pending habits (due on current local day, not yet completed).
     - 3rd: Next available action (2-minute starter or habit stack next step).

---

## 3. Intervention Engine Architecture (`src/behavior/interventionEngine.ts`)

`interventionEngine.ts` is implemented as a pure, React-free, deterministic TypeScript module located in `src/behavior/`.

### 3.1 Type Contracts (`src/behavior/types.ts`)
```typescript
export interface InterventionCandidate {
  id?: string;
  habitId: string;
  type: InterventionType; // 'reminder' | 'recovery' | 'check-in' | etc.
  surface: InterventionSurface; // 'notification' | 'widget' | 'in-app'
  priority?: InterventionPriority;
  title: string;
  message: string;
  targetTime?: string; // ISO string
  metadata?: Record<string, unknown>;
}

export type InterventionAction =
  | 'DISPATCH_NOTIFICATION'
  | 'DEFER_NOTIFICATION_UNTIL_MORNING'
  | 'THROTTLE_NOTIFICATION'
  | 'BLOCK_BEHAVIOR_NOTIFICATION'
  | 'RENDER_WIDGET_TOUCHPOINT'
  | 'SHOW_IN_APP_BANNER'
  | 'DISMISS';

export interface InterventionDecision {
  approved: boolean;
  targetSurface: InterventionSurface;
  action: InterventionAction;
  scheduledFor?: string;
  reason: string;
  rulesApplied: string[];
}

export type WidgetTouchpointType = 'recovery' | 'today_due' | 'next_action' | 'standby';

export interface WidgetTouchpoint {
  type: WidgetTouchpointType;
  habitId?: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionType: 'COMPLETE_HABIT' | 'START_HABIT_ACTION' | 'STANDBY';
  rulesApplied: string[];
}
```

### 3.2 Pure Functions
1. `arbitrateNotificationIntervention(candidate, history, options)`:
   - Derives `behaviorNotificationsToday`, `currentTime`, and `minutesSinceLastNotification` using injected local wall-clock dates (`dateUtils.js`).
   - Evaluates machine rules via `evaluateRules`.
   - Returns immutable `InterventionDecision` with `rulesApplied`.
2. `selectWidgetTouchpoint(habits, behaviorEvents, options)`:
   - Scans active habits:
     - Check 1 (`recovery`): Any habit with `status === 'recovery'` $\rightarrow$ selects Recovery touchpoint (`DON'T MISS TWICE`, 2-min version).
     - Check 2 (`today_due`): Any habit due today (not completed today) $\rightarrow$ selects Today Due touchpoint (`TODAY DUE`, target behavior).
     - Check 3 (`next_action`): Next active habit $\rightarrow$ selects Next Action touchpoint (`2-MIN MINIMUM`, minimum action).
     - Check 4 (`standby`): All habits completed $\rightarrow$ Standby touchpoint.
   - Returns immutable `WidgetTouchpoint` with `rulesApplied: ['WIDGET_PRIORITY_001']`.
3. `arbitrateInAppIntervention(habits, behaviorEvents, options)`:
   - Evaluates whether an in-app prompt/banner should surface for high-priority recovery or overdue 2-minute starter.

---

## 4. Widget Surface & Headless Handler Hardening (`widgets/`)

### 4.1 Android Widget Layout (`widgets/HabitWidget.tsx`)
A new widget renderer `HabitWidget.tsx` built with `react-native-android-widget` primitives conforming to the tactile industrial design system:
- High-contrast skeuomorphic plate (`#1b1b1b` outer frame, `#121212` inner plate, bevel borders).
- Dynamic header:
  - Recovery: `[ RECOVERY PROTOCOL ]` in `#F44336` (high priority alert).
  - Today Due: `[ TODAY DUE ]` in `#8E7BEF` (focus cue).
  - Next Action: `[ 2-MIN MINIMUM ]` in `#80CBC4` (starter cue).
  - Standby: `[ SYS_STANDBY ]` in `#666666`.
- Interactive click actions:
  - `COMPLETE_HABIT`: Checkbox tap completes habit directly from the home screen.
  - `START_HABIT_ACTION`: Initiates the 2-minute minimum action.

### 4.2 Headless Handler Hardening (`widgets/widget-task-handler.tsx`)
Widgets run in an isolated Android headless process with no React context:
- Reads `kwestup_habits_v1` and `kwestup_behavior_events_v1` directly from `AsyncStorage`.
- When `COMPLETE_HABIT` is clicked:
  - Mutates habit state using pure `completeHabit` from `src/behavior/habitEngine.ts` (increments streaks, votes, updates `lastCompletedDate`).
  - Appends `HABIT_COMPLETED` domain event to `kwestup_behavior_events_v1` (enforcing 500-item FIFO cap).
  - Emits `WIDGET_ACTION` and `HABIT_COMPLETED` to local `eventBus`.
  - Re-renders `HabitWidget` via `safeRequestWidgetUpdate`.
- On widget render (`WIDGET_ADDED`, `WIDGET_UPDATE`, etc.):
  - Evaluates `selectWidgetTouchpoint` from `src/behavior/interventionEngine.ts`.
  - Renders `<HabitWidget touchpoint={touchpoint} />`.

### 4.3 App State Convergence
- In `src/context/HabitContext.js`:
  - Wire an `AppState` change listener: when `nextAppState === 'active'`, re-hydrate `habits`, `behaviorEvents`, and `rewards` from storage.
  - Ensures seamless synchronization when returning to the app after completing habits on the home screen.

### 4.4 Resolving Pre-Existing Widget Typecheck Errors (`tsconfig.json`)
In `CONCERNS.md:8` and `tsconfig.json:31-36`, `widgets/**/*` was excluded due to 2 pre-existing style errors in `TasksListWidget.tsx`:
- Line 182: `<ListWidget style={{ flex: 1, ... }}>` $\rightarrow$ `ListWidgetStyle` does not permit `flex`. Fixed by replacing `flex: 1` with `height: 'match_parent'`.
- Line 245: `<TextWidget style={{ flex: 1, ... }}>` $\rightarrow$ `TextWidgetStyle` does not permit `flex`. Fixed by wrapping the `TextWidget` in a `<FlexWidget style={{ flex: 1 }}>` with `<TextWidget style={{ width: 'match_parent' }} />`.
- Once resolved, remove `"widgets/**/*"` from `exclude` and add `"widgets/**/*"` to `include` in `tsconfig.json`.
- Verify `npm run typecheck` passes cleanly across the entire repository.

---

## 5. Verification & Testing Strategy

1. **Unit Testing (`__tests__/unit/interventionEngine.test.ts`):**
   - `REMINDER_ANTI_SPAM_001`: $\ge 3$ notifications triggers block and redirects to widget fallback.
   - `QUIET_HOURS_001`: Notifications triggered during 22:00–08:00 defer to 08:15 next/same morning.
   - `REMINDER_MIN_GAP_001`: Notifications triggered within 90 minutes of the previous notification are throttled.
   - `WIDGET_PRIORITY_001`: Recovery habit selected over today-due habit; today-due habit selected over next action.
   - Clock injection testing with fixed timestamps.
2. **Widget Logic Testing (`__tests__/unit/behavioralWidget.test.ts`):**
   - Tests headless tap handling for `COMPLETE_HABIT`.
   - Tests storage read/mutate/write with `completeHabit` engine.
   - Tests FIFO cap preservation (max 500 events) in headless process.
3. **Quality Gates:**
   - `npm run typecheck` (0 errors, with `widgets/` included).
   - `npm run lint` (0 errors).
   - `npm test` (100% passing across all 19+ test suites).
