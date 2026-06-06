import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusTimerWidget } from './FocusTimerWidget';
import { DailyTasksWidget } from './DailyTasksWidget';
import { ImportantTasksWidget } from './ImportantTasksWidget';
import { TasksListWidget } from './TasksListWidget';
import { STORAGE_VERSION } from '../src/utils/storage';

const nameToWidget = {
  FocusTimer: FocusTimerWidget,
  DailyTasks: DailyTasksWidget,
  ImportantTasks: ImportantTasksWidget,
  TasksList: TasksListWidget,
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
  tasks?: Array<{ id: string; title: string; important: boolean; completed: boolean }>;
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
  tasks: Array<{ id: string; title: string; important: boolean; completed: boolean }>;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo } = props;
  const widgetName = widgetInfo.widgetName as WidgetName;

  if (props.widgetAction === 'WIDGET_CLICK') {
    if (props.clickAction === 'COMPLETE_TASK' && props.clickActionData?.taskId) {
      const taskId = props.clickActionData.taskId as string;
      try {
        const storageKey = `kwestup_data_${STORAGE_VERSION}`;
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const parsed: AppData = JSON.parse(raw);
          if (parsed.tasks) {
            const now = new Date().toISOString();
            parsed.tasks = parsed.tasks.map((task: any) => {
              if (task.id === taskId) {
                return {
                  ...task,
                  completed: true,
                  completedDate: now.slice(0, 10),
                  completedAt: now,
                };
              }
              return task;
            });
            await AsyncStorage.setItem(storageKey, JSON.stringify(parsed));
            console.log('[WidgetTaskHandler] Task marked completed:', taskId);

            // Stagger and request update for the other widgets so everything stays in sync.
            const importantUnfinished = parsed.tasks
              .filter((t) => t.important && !t.completed)
              .slice(0, 5);

            // Update ImportantTasks, DailyTasks, and TasksList widgets
            requestWidgetUpdate({
              widgetName: 'ImportantTasks',
              renderWidget: () => <ImportantTasksWidget tasks={importantUnfinished} />,
            });

            const dailyTasksCount = parsed.dailyTasks ? parsed.dailyTasks.length : 0;
            const dailyTasksCompletedCount = parsed.dailyTasks
              ? parsed.dailyTasks.filter((t) => t.completed).length
              : 0;

            requestWidgetUpdate({
              widgetName: 'DailyTasks',
              renderWidget: () => (
                <DailyTasksWidget
                  dailyTaskCount={dailyTasksCount}
                  dailyTasksCompleted={dailyTasksCompletedCount}
                />
              ),
            });

            const tasksListUnfinished = parsed.tasks
              .filter((t) => !t.completed)
              .slice(0, 8);

            requestWidgetUpdate({
              widgetName: 'TasksList',
              renderWidget: () => <TasksListWidget tasks={tasksListUnfinished} />,
            });
          }
        }
      } catch (err) {
        console.warn('[WidgetTaskHandler] Failed to mark task complete:', err);
      }
    }
  }

  if (
    props.widgetAction === 'WIDGET_ADDED' ||
    props.widgetAction === 'WIDGET_UPDATE' ||
    props.widgetAction === 'WIDGET_RESIZED' ||
    props.widgetAction === 'WIDGET_CLICK'
  ) {
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
      
      const [raw, timerRaw] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(timerKey),
      ]);

      if (raw) {
        const parsed: AppData = JSON.parse(raw);
        widgetData.dailyTaskCount = (parsed.dailyTasks || []).length;
        widgetData.dailyTasksCompleted = (parsed.dailyTasks || []).filter((t) => t.completed).length;
        widgetData.tasks = parsed.tasks || [];
        
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
        const importantUnfinished = widgetData.tasks
          .filter((t) => t.important && !t.completed)
          .slice(0, 5);
        props.renderWidget(<Widget tasks={importantUnfinished} />);
      } else if (widgetName === 'TasksList') {
        const tasksListUnfinished = widgetData.tasks
          .filter((t) => !t.completed)
          .slice(0, 8);
        props.renderWidget(<Widget tasks={tasksListUnfinished} />);
      }
    }
  }
}
