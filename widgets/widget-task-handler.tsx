import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusTimerWidget } from './FocusTimerWidget';
import { DailyTasksWidget } from './DailyTasksWidget';
import { ImportantTasksWidget } from './ImportantTasksWidget';
import { TasksListWidget } from './TasksListWidget';
import { HabitWidget } from './HabitWidget';
import { selectWidgetTouchpoint } from '../src/behavior/interventionEngine';
import { completeHabit } from '../src/behavior/habitEngine';
import {
  HABITS_STORAGE_KEY,
  BEHAVIOR_EVENTS_STORAGE_KEY,
  MAX_PERSISTED_BEHAVIOR_EVENTS,
} from '../src/context/HabitContext';
import type { Habit, BehaviorEvent } from '../src/behavior/types';
import { STORAGE_VERSION } from '../src/utils/storage';
import { getLocalDateString } from '../src/utils/dateUtils';
import { toggleTask } from '../src/utils/taskMutations';
import { logger } from '../src/utils/logger';
import { eventBus } from '../src/behavior/eventBus';

// Note (WR-07): On Android, headless widget task handlers execute in a separate JS environment
// from the main app. In-memory eventBus events emitted here populate the widget process's local ring
// buffer and notify any headless listeners. Persistent state synchronization is achieved through AsyncStorage.
const safeRequestWidgetUpdate = async (options: Parameters<typeof requestWidgetUpdate>[0]): Promise<void> => {
  try {
    await requestWidgetUpdate(options);
  } catch (err) {
    logger.warn('[WidgetTaskHandler] requestWidgetUpdate failed:', err);
  }
};

const nameToWidget = {
  FocusTimer: FocusTimerWidget,
  DailyTasks: DailyTasksWidget,
  ImportantTasks: ImportantTasksWidget,
  TasksList: TasksListWidget,
  HabitWidget: HabitWidget,
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
      const rawTab = props.clickActionData.tab as string;
      if (rawTab !== 'all' && rawTab !== 'persistent') {
        logger.warn('[WidgetTaskHandler] Ignoring invalid tab value:', rawTab);
      } else {
      const targetTab = rawTab as 'all' | 'persistent';
      try {
        const tabKey = `kwestup_widget_tab_${widgetId}`;
        await Promise.all([
          AsyncStorage.setItem(tabKey, targetTab),
          AsyncStorage.setItem('kwestup_widget_active_tab', targetTab),
        ]);
        eventBus.emit({
          type: 'WIDGET_ACTION',
          entityId: `widget_${widgetId}`,
          source: 'widget',
          payload: {
            action: 'SWITCH_TAB',
            tab: targetTab,
            widgetName,
          },
        });
        logger.info('[WidgetTaskHandler] Tab switched to:', targetTab);
      } catch (err) {
        logger.warn('[WidgetTaskHandler] Failed to save active tab:', err);
      }
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

              // Write to storage immediately to minimize the lost-update race window
              const { updatedTasks } = toggleTask(parsed.tasks, taskId, {
                now,
                todayDate: getLocalDateString(),
              });
              parsed.tasks = updatedTasks as TaskItemType[];

              await AsyncStorage.setItem(storageKey, JSON.stringify(parsed));
              logger.info('[WidgetTaskHandler] Task completion status toggled:', taskId);

              eventBus.emit({
                type: 'WIDGET_ACTION',
                entityId: `widget_${widgetId}`,
                source: 'widget',
                payload: {
                  action: props.clickAction,
                  taskId,
                  widgetName,
                },
              });

              if (nextCompletedState) {
                eventBus.emit({
                  type: 'TASK_COMPLETED',
                  entityId: taskId,
                  source: 'widget',
                  payload: {
                    completed: true,
                  },
                });
              } else {
                eventBus.emit({
                  type: 'TASK_UPDATED',
                  entityId: taskId,
                  source: 'widget',
                  payload: {
                    completed: false,
                  },
                });
              }

              // Update sibling widgets in a single pass (no intermediate
              // ticking frame: it was overwritten by the updates below and
              // the 600ms headless sleep risked OS task termination).
              const importantUnfinished = parsed.tasks
                .filter((t) => t.important && !t.completed)
                .slice(0, 5);

              await safeRequestWidgetUpdate({
                widgetName: 'ImportantTasks',
                renderWidget: () => <ImportantTasksWidget tasks={importantUnfinished} />,
              });

              const dailyTasksCount = parsed.dailyTasks ? parsed.dailyTasks.length : 0;
              const dailyTasksCompletedCount = parsed.dailyTasks
                ? parsed.dailyTasks.filter((t) => t.completed).length
                : 0;

              await safeRequestWidgetUpdate({
                widgetName: 'DailyTasks',
                renderWidget: () => (
                  <DailyTasksWidget
                    dailyTaskCount={dailyTasksCount}
                    dailyTasksCompleted={dailyTasksCompletedCount}
                  />
                ),
              });

              await safeRequestWidgetUpdate({
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
        logger.warn('[WidgetTaskHandler] Failed to toggle task state:', err);
      }
    }

    // 3. COMPLETE_HABIT or START_HABIT_ACTION action
    if (
      (props.clickAction === 'COMPLETE_HABIT' || props.clickAction === 'START_HABIT_ACTION') &&
      props.clickActionData?.habitId
    ) {
      const habitId = props.clickActionData.habitId as string;
      try {
        const [rawHabits, rawEvents] = await Promise.all([
          AsyncStorage.getItem(HABITS_STORAGE_KEY),
          AsyncStorage.getItem(BEHAVIOR_EVENTS_STORAGE_KEY),
        ]);

        if (rawHabits) {
          const parsedHabits: Habit[] = JSON.parse(rawHabits);
          const targetHabit = parsedHabits.find((h) => h.id === habitId);

          if (targetHabit) {
            const now = new Date().toISOString();
            const todayDate = getLocalDateString(now);

            // Execute pure completeHabit
            const completionResult = completeHabit(targetHabit, {
              now,
              todayDate,
            });

            // Idempotency guard: completeHabit returns completedToday=false
            // when lastCompletedDate is already today. A rapid double-tap
            // must not fabricate a duplicate HABIT_COMPLETED event.
            if (!completionResult.completedToday) {
              logger.debug('[WidgetTaskHandler] Habit already completed today, ignoring:', habitId);
              const nextTouchpoint = selectWidgetTouchpoint(parsedHabits);
              await safeRequestWidgetUpdate({
                widgetName: 'HabitWidget',
                renderWidget: () => <HabitWidget touchpoint={nextTouchpoint} />,
              });
              return;
            }

            const updatedHabits = parsedHabits.map((h) =>
              h.id === habitId ? completionResult.updatedHabit : h
            );

            // Write back to isolated habit storage
            await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(updatedHabits));
            logger.info('[WidgetTaskHandler] Habit completed via widget click:', habitId);

            // Bounded behavior event log FIFO cap (max 500)
            let existingEvents: BehaviorEvent[] = [];
            if (rawEvents) {
              try {
                const parsed = JSON.parse(rawEvents);
                if (Array.isArray(parsed)) existingEvents = parsed;
              } catch (e) {
                logger.warn('[WidgetTaskHandler] Failed to parse existing behavior events:', e);
              }
            }

            const habitCompletedEvent: BehaviorEvent = {
              id: `bevt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              type: 'HABIT_COMPLETED',
              entityId: habitId,
              timestamp: now,
              source: 'widget',
              payload: {
                habitId,
                completedToday: completionResult.completedToday,
                streakCount: completionResult.updatedHabit.streakCount,
                totalEvidenceVotes: completionResult.updatedHabit.totalEvidenceVotes,
                rulesApplied: completionResult.rulesApplied,
              },
            };

            const boundedEvents = [...existingEvents, habitCompletedEvent].slice(
              -MAX_PERSISTED_BEHAVIOR_EVENTS
            );
            await AsyncStorage.setItem(
              BEHAVIOR_EVENTS_STORAGE_KEY,
              JSON.stringify(boundedEvents)
            );

            // Emit telemetry on local eventBus
            eventBus.emit({
              type: 'WIDGET_ACTION',
              entityId: `widget_${widgetId}`,
              source: 'widget',
              payload: {
                action: props.clickAction,
                habitId,
                widgetName,
              },
            });
            eventBus.emit(habitCompletedEvent);

            // Re-render HabitWidget with the next touchpoint
            const nextTouchpoint = selectWidgetTouchpoint(updatedHabits);
            await safeRequestWidgetUpdate({
              widgetName: 'HabitWidget',
              renderWidget: () => <HabitWidget touchpoint={nextTouchpoint} />,
            });
          }
        }
      } catch (err) {
        logger.warn('[WidgetTaskHandler] Failed to process habit widget click:', err);
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
      logger.warn('[WidgetTaskHandler] Failed to read AsyncStorage:', err);
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
      } else if (widgetName === 'HabitWidget') {
        let habitTouchpoint = undefined;
        try {
          const rawHabits = await AsyncStorage.getItem(HABITS_STORAGE_KEY);
          if (rawHabits) {
            const parsedHabits: Habit[] = JSON.parse(rawHabits);
            habitTouchpoint = selectWidgetTouchpoint(parsedHabits);
          } else {
            habitTouchpoint = selectWidgetTouchpoint([]);
          }
        } catch (err) {
          logger.warn('[WidgetTaskHandler] Failed to prepare HabitWidget data:', err);
        }
        props.renderWidget(<WidgetComponent touchpoint={habitTouchpoint} />);
      }
    }
  }
}
