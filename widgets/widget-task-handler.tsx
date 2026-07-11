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

interface TaskItemType {
  id: string;
  title: string;
  name?: string;
  important: boolean;
  completed: boolean;
  recurrence?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  notificationId?: string | null;
  completedAt?: string | null;
  completedDate?: string | null;
  isTicking?: boolean;
}

interface AppData {
  timerState?: {
    duration?: number;
    remaining?: number;
    isRunning?: boolean;
    startTime?: number;
  };
  dailyTasks?: Array<{ completed: boolean }>;
  tasks?: Array<TaskItemType>;
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
  tasks: Array<TaskItemType>;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo } = props;
  const widgetId = widgetInfo.widgetId;
  const widgetName = widgetInfo.widgetName as WidgetName;

  if (props.widgetAction === 'WIDGET_CLICK') {
    // 1. SWITCH_TAB action
    if (props.clickAction === 'SWITCH_TAB' && props.clickActionData?.tab) {
      const targetTab = props.clickActionData.tab as 'tasks' | 'daily' | 'timer' | 'all' | 'persistent';
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
        const tabKey = `kwestup_widget_tab_${widgetId}`;
        const [raw, storedTab] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          AsyncStorage.getItem(tabKey),
        ]);

        let activeTab: 'all' | 'persistent' = 'all';
        if (storedTab === 'persistent' || storedTab === 'all') {
          activeTab = storedTab as any;
        } else {
          const globalTab = await AsyncStorage.getItem('kwestup_widget_active_tab');
          if (globalTab === 'persistent' || globalTab === 'all') {
            activeTab = globalTab as any;
          }
        }

        if (raw) {
          const parsed: AppData = JSON.parse(raw);
          if (parsed.tasks) {
            const now = new Date().toISOString();
            const taskToToggle = parsed.tasks.find(t => t.id === taskId);
            
            if (taskToToggle) {
              const nextCompletedState = !taskToToggle.completed;
              
              // --- TICKING ANIMATION ---
              if (nextCompletedState) {
                const tempTasks = parsed.tasks.map(t => t.id === taskId ? { ...t, isTicking: true } : t);
                requestWidgetUpdate({
                  widgetName: 'TasksList',
                  renderWidget: () => <TasksListWidget tasks={tempTasks as any} activeTab={activeTab} />,
                });
                await new Promise(r => setTimeout(r, 600)); // wait for animation
              }
              // -------------------------

              const updatedTasks = [];
              for (const task of parsed.tasks) {
                if (task.id === taskId) {
                  updatedTasks.push({
                    ...task,
                    completed: nextCompletedState,
                    completedDate: nextCompletedState ? now.slice(0, 10) : undefined,
                    completedAt: nextCompletedState ? now : undefined,
                  });

                  if (nextCompletedState && task.recurrence && task.recurrence !== "none") {
                    const date = new Date(task.dueDate || now);
                    if (isNaN(date.getTime())) {
                      date.setTime(Date.now());
                    }

                    let newTitle = task.title || (task as any).name;
                    if (task.recurrence === "daily") {
                      date.setDate(date.getDate() + 1);
                    } else if (task.recurrence === "weekly") {
                      date.setDate(date.getDate() + 7);
                    } else if (task.recurrence === "monthly") {
                      date.setMonth(date.getMonth() + 1);
                    } else if (task.recurrence === "progressive") {
                      date.setDate(date.getDate() + 1);
                      const match = newTitle.match(/\d+(?!.*\d)/);
                      if (match) {
                        const num = parseInt(match[0], 10);
                        newTitle = newTitle.substring(0, match.index) + (num + 1) + newTitle.substring(match.index + match[0].length);
                      } else {
                        newTitle += " - 2";
                      }
                    }

                    const spawnedTask = {
                      ...task,
                      id: Date.now().toString() + Math.random().toString(36).slice(2),
                      title: newTitle,
                      completed: false,
                      completedDate: null,
                      completedAt: null,
                      dueDate: date.toISOString(),
                      createdAt: now,
                      updatedAt: now,
                      notificationId: null,
                    };
                    // Instead of pushing the completed parent and the spawned task,
                    // we actually want the parent to be pushed (it will be filtered out by UI anyway, but we need it for history)
                    // Wait, App.js removes it. For widget parity, let's also NOT push the parent if it's recurring.
                    updatedTasks.pop(); // remove the completed parent we just pushed
                    updatedTasks.push(spawnedTask);
                  }
                } else {
                  updatedTasks.push(task);
                }
              }
              parsed.tasks = updatedTasks;

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

              requestWidgetUpdate({
                widgetName: 'TasksList',
                renderWidget: () => (
                  <TasksListWidget
                    tasks={parsed.tasks as any}
                    activeTab={activeTab}
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

    let activeTab: 'tasks' | 'daily' | 'timer' | 'all' | 'persistent' = 'all';

    try {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      const timerKey = `kwestup_timer_state_${STORAGE_VERSION}`;
      const tabKey = `kwestup_widget_tab_${widgetId}`;
      
      const [raw, timerRaw, storedTab] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(timerKey),
        AsyncStorage.getItem(tabKey),
      ]);

      if (['tasks', 'daily', 'timer', 'all', 'persistent'].includes(storedTab || '')) {
        activeTab = storedTab as any;
      } else {
        const globalTab = await AsyncStorage.getItem('kwestup_widget_active_tab');
        if (['tasks', 'daily', 'timer', 'all', 'persistent'].includes(globalTab || '')) {
          activeTab = globalTab as any;
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

    const WidgetComponent = nameToWidget[widgetName] as any;
    if (WidgetComponent) {
      if (widgetName === 'FocusTimer') {
        props.renderWidget(
          <WidgetComponent
            remaining={widgetData.timerRemaining}
            isRunning={widgetData.isTimerRunning}
          />
        );
      } else if (widgetName === 'DailyTasks') {
        props.renderWidget(
          <WidgetComponent
            dailyTaskCount={widgetData.dailyTaskCount}
            dailyTasksCompleted={widgetData.dailyTasksCompleted}
          />
        );
      } else if (widgetName === 'ImportantTasks') {
        const importantUnfinished = widgetData.tasks
          .filter((t) => t.important && !t.completed)
          .slice(0, 5);
        props.renderWidget(<WidgetComponent tasks={importantUnfinished} />);
      } else if (widgetName === 'TasksList') {
        props.renderWidget(
          <WidgetComponent
            tasks={widgetData.tasks as any}
            activeTab={activeTab === 'persistent' ? 'persistent' : 'all'}
          />
        );
      }
    }
  }
}
