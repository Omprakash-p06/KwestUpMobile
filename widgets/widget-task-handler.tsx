import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusTimerWidget } from './FocusTimerWidget';
import { DailyTasksWidget } from './DailyTasksWidget';
import { ImportantTasksWidget } from './ImportantTasksWidget';
import { STORAGE_VERSION } from '../src/utils/storage';

const nameToWidget = {
  FocusTimer: FocusTimerWidget,
  DailyTasks: DailyTasksWidget,
  ImportantTasks: ImportantTasksWidget,
} as const;

type WidgetName = keyof typeof nameToWidget;

interface AppData {
  timerState?: {
    duration?: number;
    remaining?: number;
    isRunning?: boolean;
  };
  dailyTasks?: Array<{ completed: boolean }>;
  tasks?: Array<{ title: string; important: boolean; completed: boolean }>;
}

interface WidgetData {
  timerRemaining: number;
  isTimerRunning: boolean;
  dailyTaskCount: number;
  dailyTasksCompleted: number;
  tasks: Array<{ title: string; important: boolean; completed: boolean }>;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo } = props;
  const widgetName = widgetInfo.widgetName as WidgetName;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      let widgetData: WidgetData = {
        timerRemaining: 0,
        isTimerRunning: false,
        dailyTaskCount: 0,
        dailyTasksCompleted: 0,
        tasks: [],
      };

      try {
        const raw = await AsyncStorage.getItem(`kwestup_data_${STORAGE_VERSION}`);
        if (raw) {
          const parsed: AppData = JSON.parse(raw);
          widgetData = {
            timerRemaining: parsed.timerState?.remaining ?? 0,
            isTimerRunning: parsed.timerState?.isRunning ?? false,
            dailyTaskCount: (parsed.dailyTasks || []).length,
            dailyTasksCompleted: (parsed.dailyTasks || []).filter((t) => t.completed).length,
            tasks: parsed.tasks || [],
          };
        }
      } catch (err) {
        console.warn('[WidgetTaskHandler] Failed to read AsyncStorage:', err);
      }

      const Widget = nameToWidget[widgetName];
      if (Widget) {
        // SURGICAL PROPS: Only pass what each specific widget actually needs.
        // This prevents the 'Binder transaction failure: -22 (Invalid argument)' error
        // caused by sending large unused arrays (like thousands of tasks) over the bridge.
        if (widgetName === 'FocusTimer') {
          props.renderWidget(
            <Widget
              remaining={widgetData.timerRemaining}
              isRunning={widgetData.isTimerRunning}
            />
          );
        } else if (widgetName === 'DailyTasks') {
          props.renderWidget(
            <Widget
              dailyTaskCount={widgetData.dailyTaskCount}
              dailyTasksCompleted={widgetData.dailyTasksCompleted}
            />
          );
        } else if (widgetName === 'ImportantTasks') {
          // SLICE DATA: Only send the first 5 important unfinished tasks.
          const importantUnfinished = widgetData.tasks
            .filter((t) => t.important && !t.completed)
            .slice(0, 5);
          props.renderWidget(<Widget tasks={importantUnfinished} />);
        }
      }
      break;
    }

    case 'WIDGET_DELETED':
      break;

    case 'WIDGET_CLICK':
      break;

    default:
      break;
  }
}
