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
    startTime?: number;
  };
  dailyTasks?: Array<{ completed: boolean }>;
  tasks?: Array<{ title: string; important: boolean; completed: boolean }>;
}

interface TimerState {
  duration: number;
  remaining: number;
  isRunning: boolean;
  startTime: number | null;
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
        const storageKey = `kwestup_data_${STORAGE_VERSION}`;
        const timerKey = `kwestup_timer_state_${STORAGE_VERSION}`;
        
        // Fetch both. Timer state is now decoupled for high-frequency updates.
        const [raw, timerRaw] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          AsyncStorage.getItem(timerKey),
        ]);

        if (raw) {
          const parsed: AppData = JSON.parse(raw);
          widgetData.dailyTaskCount = (parsed.dailyTasks || []).length;
          widgetData.dailyTasksCompleted = (parsed.dailyTasks || []).filter((t) => t.completed).length;
          widgetData.tasks = parsed.tasks || [];
          
          // Legacy fallback for timer state
          if (!timerRaw && parsed.timerState) {
            widgetData.timerRemaining = parsed.timerState.remaining ?? 0;
            widgetData.isTimerRunning = parsed.timerState.isRunning ?? false;
          }
        }

        if (timerRaw) {
          const timerParsed: TimerState = JSON.parse(timerRaw);
          
          if (timerParsed.isRunning && timerParsed.startTime) {
            const elapsed = Math.floor((Date.now() - timerParsed.startTime) / 1000);
            widgetData.timerRemaining = Math.max(0, timerParsed.duration - elapsed);
            widgetData.isTimerRunning = widgetData.timerRemaining > 0;
          } else {
            widgetData.timerRemaining = timerParsed.remaining;
            widgetData.isTimerRunning = false;
          }
        }
      } catch (err) {
        console.warn('[WidgetTaskHandler] Failed to read AsyncStorage:', err);
      }

      const Widget = nameToWidget[widgetName];
      if (Widget) {
        // SURGICAL PROPS: Only pass what each specific widget actually needs.
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
