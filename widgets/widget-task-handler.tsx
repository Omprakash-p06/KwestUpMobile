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
  const widgetId = widgetInfo.widgetId;
  const widgetName = widgetInfo.widgetName as WidgetName;

  if (props.widgetAction === 'WIDGET_CLICK') {
    // 1. SWITCH_TAB action
    if (props.clickAction === 'SWITCH_TAB' && props.clickActionData?.tab) {
      const targetTab = props.clickActionData.tab as 'tasks' | 'daily' | 'timer';
      try {
        const tabKey = `kwestup_widget_tab_${widgetId}`;
        await Promise.all([
          AsyncStorage.setItem(tabKey, targetTab),
          AsyncStorage.setItem('kwestup_widget_active_tab', targetTab),
        ]);
        console.log('[WidgetTaskHandler] Tab switched to:', targetTab);
      } catch (err) {
        console.warn('[WidgetTaskHandler] Failed to save active tab:', err);
      }
    }

    // 2. TOGGLE_TASK or COMPLETE_TASK action
    if ((props.clickAction === 'TOGGLE_TASK' || props.clickAction === 'COMPLETE_TASK') && props.clickActionData?.taskId) {
      const taskId = props.clickActionData.taskId as string;
      try {
        const storageKey = `kwestup_data_${STORAGE_VERSION}`;
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const parsed: AppData = JSON.parse(raw);
          if (parsed.tasks) {
            const now = new Date().toISOString();
            let isToggled = false;
            parsed.tasks = parsed.tasks.map((task: any) => {
              if (task.id === taskId) {
                isToggled = true;
                const nextCompletedState = !task.completed;
                return {
                  ...task,
                  completed: nextCompletedState,
                  completedDate: nextCompletedState ? now.slice(0, 10) : undefined,
                  completedAt: nextCompletedState ? now : undefined,
                };
              }
              return task;
            });

            if (isToggled) {
              await AsyncStorage.setItem(storageKey, JSON.stringify(parsed));
              console.log('[WidgetTaskHandler] Task completion status toggled:', taskId);

              // Update other widgets in the background so everything stays in sync
              const importantUnfinished = parsed.tasks
                .filter((t) => t.important && !t.completed)
                .slice(0, 5);

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

              // Find current timer state for the update broadcast
              const timerKey = `kwestup_timer_state_${STORAGE_VERSION}`;
              const timerRaw = await AsyncStorage.getItem(timerKey);
              let timerRemaining = 0;
              let isTimerRunning = false;
              if (timerRaw) {
                const timerParsed: TimerState = JSON.parse(timerRaw);
                if (timerParsed.isRunning && timerParsed.startTime) {
                  const elapsed = Math.floor((Date.now() - timerParsed.startTime) / 1000);
                  timerRemaining = Math.max(0, timerParsed.duration - elapsed);
                  isTimerRunning = timerRemaining > 0;
                } else {
                  timerRemaining = timerParsed.remaining;
                  isTimerRunning = false;
                }
              }

              const sortedTasks = [...parsed.tasks].sort((a, b) => {
                if (a.completed && !b.completed) return 1;
                if (!a.completed && b.completed) return -1;
                return 0;
              }).slice(0, 8);

              const globalTab = (await AsyncStorage.getItem('kwestup_widget_active_tab')) as 'tasks' | 'daily' | 'timer' || 'tasks';

              requestWidgetUpdate({
                widgetName: 'TasksList',
                renderWidget: () => (
                  <TasksListWidget
                    activeTab={globalTab}
                    tasks={sortedTasks}
                    dailyTaskCount={dailyTasksCount}
                    dailyTasksCompleted={dailyTasksCompletedCount}
                    timerRemaining={timerRemaining}
                    isTimerRunning={isTimerRunning}
                  />
                ),
              });
            }
          }
        }
      } catch (err) {
        console.warn('[WidgetTaskHandler] Failed to toggle task state:', err);
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

    let activeTab: 'tasks' | 'daily' | 'timer' = 'tasks';

    try {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      const timerKey = `kwestup_timer_state_${STORAGE_VERSION}`;
      const tabKey = `kwestup_widget_tab_${widgetId}`;
      
      const [raw, timerRaw, storedTab] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(timerKey),
        AsyncStorage.getItem(tabKey),
      ]);

      if (storedTab === 'tasks' || storedTab === 'daily' || storedTab === 'timer') {
        activeTab = storedTab;
      } else {
        const globalTab = await AsyncStorage.getItem('kwestup_widget_active_tab');
        if (globalTab === 'tasks' || globalTab === 'daily' || globalTab === 'timer') {
          activeTab = globalTab;
        }
      }

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
        const sortedTasks = [...widgetData.tasks].sort((a, b) => {
          if (a.completed && !b.completed) return 1;
          if (!a.completed && b.completed) return -1;
          return 0;
        }).slice(0, 8);
        
        props.renderWidget(
          <Widget
            activeTab={activeTab}
            tasks={sortedTasks}
            dailyTaskCount={widgetData.dailyTaskCount}
            dailyTasksCompleted={widgetData.dailyTasksCompleted}
            timerRemaining={widgetData.timerRemaining}
            isTimerRunning={widgetData.isTimerRunning}
          />
        );
      }
    }
  }
}
