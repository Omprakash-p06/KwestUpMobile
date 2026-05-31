import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusTimerWidget } from './FocusTimerWidget';
import { DailyTasksWidget } from './DailyTasksWidget';
import { STORAGE_VERSION } from '../src/utils/storage';

/**
 * Widget name → component map.
 * Maps the widget name registered in app.json to its display component.
 */
const nameToWidget = {
  FocusTimer: FocusTimerWidget,
  DailyTasks: DailyTasksWidget,
} as const;

type WidgetName = keyof typeof nameToWidget;

interface AppData {
  timerState?: {
    duration?: number;
    remaining?: number;
    isRunning?: boolean;
  };
  dailyTasks?: Array<{ completed: boolean }>;
}

interface WidgetData {
  timerRemaining: number;
  isTimerRunning: boolean;
  dailyTaskCount: number;
  dailyTasksCompleted: number;
}

/**
 * widgetTaskHandler — lifecycle handler for all registered Android home-screen widgets.
 *
 * Reads app state from AsyncStorage (using the dynamic STORAGE_VERSION key to prevent
 * version mismatch — see RESEARCH.md Pitfall 5) and renders the appropriate widget.
 *
 * Handles:
 *   WIDGET_ADDED   — initial render when user adds widget to home screen
 *   WIDGET_UPDATE  — periodic update (every updatePeriodMillis configured in app.json)
 *   WIDGET_RESIZED — treat as update to re-render at new size
 *   WIDGET_DELETED — no-op (read-only widgets, nothing to clean up)
 *   WIDGET_CLICK   — no-op (no deep linking per requirements)
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo } = props;
  const widgetName = widgetInfo.widgetName as WidgetName;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      // Default widget data (shown on cold start if AsyncStorage is empty)
      let widgetData: WidgetData = {
        timerRemaining: 0,
        isTimerRunning: false,
        dailyTaskCount: 0,
        dailyTasksCompleted: 0,
      };

      try {
        // Read persisted app state from AsyncStorage using the dynamic version key.
        // IMPORTANT: Do NOT hard-code the storage key — use STORAGE_VERSION to prevent
        // version mismatch when the app upgrades storage schema (RESEARCH.md Pitfall 5).
        const raw = await AsyncStorage.getItem(`kwestup_data_${STORAGE_VERSION}`);
        if (raw) {
          const parsed: AppData = JSON.parse(raw);
          widgetData = {
            timerRemaining: parsed.timerState?.remaining ?? 0,
            isTimerRunning: parsed.timerState?.isRunning ?? false,
            dailyTaskCount: (parsed.dailyTasks || []).length,
            dailyTasksCompleted: (parsed.dailyTasks || []).filter((t) => t.completed).length,
          };
        }
      } catch (err) {
        // On read/parse failure, fall back to defaults (widget still renders rather than crashing)
        console.warn('[WidgetTaskHandler] Failed to read AsyncStorage:', err);
      }

      // Look up the component for this widget name and render it
      const Widget = nameToWidget[widgetName];
      if (Widget) {
        props.renderWidget(<Widget {...widgetData} />);
      }
      break;
    }

    case 'WIDGET_DELETED':
      // No cleanup needed — widgets are read-only, no subscriptions or scheduled tasks to cancel
      break;

    case 'WIDGET_CLICK':
      // No deep linking — clicking a widget does nothing per WIDG-01 requirements
      break;

    default:
      break;
  }
}
