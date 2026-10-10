import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventBus } from '../../src/behavior/eventBus';
import { TaskProvider, useTasks } from '../../src/context/TaskContext';
import { BillingProvider, useBilling } from '../../src/context/BillingContext';
import { BirthdayProvider, useBirthdays } from '../../src/context/BirthdayContext';
import { FocusTimerScreen } from '../../src/screens/FocusTimerScreen';
import { STORAGE_VERSION } from '../../src/utils/storage';

// Dynamic require with computed path prevents tsc from statically traversing widget TSX dependencies excluded by tsconfig.json
const widgetModulePath = ['..', '..', 'widgets', 'widget-task-handler'].join('/');
const { widgetTaskHandler } = require(widgetModulePath);

describe('Domain Event Instrumentation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    eventBus.clearListeners();
    eventBus.clearBuffer();
    jest.clearAllMocks();
  });

  describe('Task Domain Events (TC-EVT-09)', () => {
    let taskContextValue = null;
    const TaskConsumer = () => {
      taskContextValue = useTasks();
      return (
        <View>
          <Text>TaskConsumer</Text>
        </View>
      );
    };

    it('emits TASK_CREATED on creating a new task via handleSaveTask', async () => {
      await act(async () => {
        renderer.create(
          <TaskProvider initialTasks={[]}>
            <TaskConsumer />
          </TaskProvider>
        );
      });

      await act(async () => {
        await taskContextValue.handleSaveTask({
          title: 'Implement Domain Bus',
          listId: 'default_inbox',
        });
      });

      const events = eventBus.getRecentEvents();
      const createdEvent = events.find((e) => e.type === 'TASK_CREATED');
      expect(createdEvent).toBeDefined();
      expect(createdEvent?.payload?.title).toBe('Implement Domain Bus');
      expect(createdEvent?.source).toBe('app');
    });

    it('emits TASK_UPDATED on editing an existing task via handleSaveTask', async () => {
      const initial = [{ id: 'task-orig', title: 'Original Task', completed: false }];
      await act(async () => {
        renderer.create(
          <TaskProvider initialTasks={initial}>
            <TaskConsumer />
          </TaskProvider>
        );
      });

      await act(async () => {
        await taskContextValue.handleSaveTask({
          id: 'task-orig',
          title: 'Updated Task Title',
        });
      });

      const events = eventBus.getRecentEvents();
      const updatedEvent = events.find(
        (e) => e.type === 'TASK_UPDATED' && e.entityId === 'task-orig'
      );
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent?.payload?.title).toBe('Updated Task Title');
    });

    it('emits TASK_COMPLETED when toggling an incomplete task to complete', async () => {
      const initial = [{ id: 'task-toggle', title: 'Toggle Task', completed: false }];
      await act(async () => {
        renderer.create(
          <TaskProvider initialTasks={initial}>
            <TaskConsumer />
          </TaskProvider>
        );
      });

      await act(async () => {
        taskContextValue.toggleTaskComplete('task-toggle');
      });

      const events = eventBus.getRecentEvents();
      const completedEvent = events.find(
        (e) => e.type === 'TASK_COMPLETED' && e.entityId === 'task-toggle'
      );
      expect(completedEvent).toBeDefined();
      expect(completedEvent?.payload?.completed).toBe(true);
    });

    it('emits TASK_UPDATED when untoggling a completed task to incomplete', async () => {
      const initial = [{ id: 'task-untoggle', title: 'Untoggle Task', completed: true }];
      await act(async () => {
        renderer.create(
          <TaskProvider initialTasks={initial}>
            <TaskConsumer />
          </TaskProvider>
        );
      });

      await act(async () => {
        taskContextValue.toggleTaskComplete('task-untoggle');
      });

      const events = eventBus.getRecentEvents();
      const updatedEvent = events.find(
        (e) => e.type === 'TASK_UPDATED' && e.entityId === 'task-untoggle'
      );
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent?.payload?.completed).toBe(false);
    });

    it('emits TASK_DELETED when deleteTask is invoked', async () => {
      const initial = [{ id: 'task-del', title: 'Delete Task', completed: false }];
      await act(async () => {
        renderer.create(
          <TaskProvider initialTasks={initial}>
            <TaskConsumer />
          </TaskProvider>
        );
      });

      await act(async () => {
        taskContextValue.deleteTask('task-del');
      });

      const events = eventBus.getRecentEvents();
      const deletedEvent = events.find(
        (e) => e.type === 'TASK_DELETED' && e.entityId === 'task-del'
      );
      expect(deletedEvent).toBeDefined();
    });
  });

  describe('Billing Domain Events (TC-EVT-10)', () => {
    let billingContextValue = null;
    const BillingConsumer = () => {
      billingContextValue = useBilling();
      return (
        <View>
          <Text>BillingConsumer</Text>
        </View>
      );
    };

    it('emits BILL_CREATED on addRecurringBillAction', async () => {
      await act(async () => {
        renderer.create(
          <BillingProvider>
            <BillingConsumer />
          </BillingProvider>
        );
      });

      await act(async () => {
        await billingContextValue.addRecurringBillAction({
          id: 'bill-rent-1',
          name: 'Apartment Rent',
          amount: 25000,
          category: 'Housing',
          dueDate: '2026-11-01',
        });
      });

      const events = eventBus.getRecentEvents();
      const createdEvent = events.find(
        (e) => e.type === 'BILL_CREATED' && e.entityId === 'bill-rent-1'
      );
      expect(createdEvent).toBeDefined();
      expect(createdEvent?.payload?.amount).toBe(25000);
      expect(createdEvent?.payload?.category).toBe('Housing');
    });

    it('emits BILL_PAID on addTransactionAction', async () => {
      await act(async () => {
        renderer.create(
          <BillingProvider>
            <BillingConsumer />
          </BillingProvider>
        );
      });

      await act(async () => {
        await billingContextValue.addTransactionAction({
          id: 'tx-groceries-1',
          amount: 1250,
          category: 'Food',
          date: '2026-10-10',
        });
      });

      const events = eventBus.getRecentEvents();
      const paidEvent = events.find(
        (e) => e.type === 'BILL_PAID' && e.entityId === 'tx-groceries-1'
      );
      expect(paidEvent).toBeDefined();
      expect(paidEvent?.payload?.amount).toBe(1250);
      expect(paidEvent?.payload?.category).toBe('Food');
    });

    it('emits BILL_DELETED on deleteRecurringBillAction', async () => {
      await act(async () => {
        renderer.create(
          <BillingProvider>
            <BillingConsumer />
          </BillingProvider>
        );
      });

      await act(async () => {
        await billingContextValue.deleteRecurringBillAction('bill-del-1');
      });

      const events = eventBus.getRecentEvents();
      const deletedEvent = events.find(
        (e) => e.type === 'BILL_DELETED' && e.entityId === 'bill-del-1'
      );
      expect(deletedEvent).toBeDefined();
    });
  });

  describe('Birthday Domain Events (TC-EVT-11)', () => {
    let birthdayContextValue = null;
    const BirthdayConsumer = () => {
      birthdayContextValue = useBirthdays();
      return (
        <View>
          <Text>BirthdayConsumer</Text>
        </View>
      );
    };

    it('emits BIRTHDAY_CREATED on saving a new birthday', async () => {
      await act(async () => {
        renderer.create(
          <BirthdayProvider>
            <BirthdayConsumer />
          </BirthdayProvider>
        );
      });

      await act(async () => {
        await birthdayContextValue.handleSaveBirthday({
          id: 'bday-alice',
          name: 'Alice',
          date: '1995-10-15',
        });
      });

      const events = eventBus.getRecentEvents();
      const createdEvent = events.find(
        (e) => e.type === 'BIRTHDAY_CREATED' && e.entityId === 'bday-alice'
      );
      expect(createdEvent).toBeDefined();
      expect(createdEvent?.payload?.name).toBe('Alice');
      expect(createdEvent?.payload?.date).toBe('1995-10-15');
    });

    it('emits BIRTHDAY_UPDATED on updating an existing birthday', async () => {
      const initial = [{ id: 'bday-bob', name: 'Bob', date: '1992-05-20' }];
      await act(async () => {
        renderer.create(
          <BirthdayProvider initialBirthdays={initial}>
            <BirthdayConsumer />
          </BirthdayProvider>
        );
      });

      await act(async () => {
        await birthdayContextValue.handleSaveBirthday({
          id: 'bday-bob',
          name: 'Robert',
          date: '1992-05-20',
        });
      });

      const events = eventBus.getRecentEvents();
      const updatedEvent = events.find(
        (e) => e.type === 'BIRTHDAY_UPDATED' && e.entityId === 'bday-bob'
      );
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent?.payload?.name).toBe('Robert');
    });

    it('emits BIRTHDAY_DELETED on handleDeleteBirthday', async () => {
      const initial = [{ id: 'bday-charlie', name: 'Charlie', date: '1990-01-01' }];
      await act(async () => {
        renderer.create(
          <BirthdayProvider initialBirthdays={initial}>
            <BirthdayConsumer />
          </BirthdayProvider>
        );
      });

      await act(async () => {
        birthdayContextValue.handleDeleteBirthday('bday-charlie');
      });

      const events = eventBus.getRecentEvents();
      const deletedEvent = events.find(
        (e) => e.type === 'BIRTHDAY_DELETED' && e.entityId === 'bday-charlie'
      );
      expect(deletedEvent).toBeDefined();
    });
  });

  describe('Focus Timer Domain Events (TC-EVT-12)', () => {
    let loopSpy;

    beforeEach(() => {
      loopSpy = jest.spyOn(Animated, 'loop').mockReturnValue({
        start: jest.fn(),
        stop: jest.fn(),
      });
    });

    afterEach(() => {
      if (loopSpy) loopSpy.mockRestore();
    });

    it('emits FOCUS_STARTED when timer start is triggered in FocusTimerScreen', async () => {
      const setIsTimerRunning = jest.fn();
      let tree = null;

      try {
        await act(async () => {
          tree = renderer.create(
            <FocusTimerScreen
              currentTheme={{
                background: '#000',
                text: '#fff',
                primary: '#6200ee',
                card: '#111',
                border: '#333',
                error: '#f00',
                success: '#0f0',
              }}
              timerDuration={1500}
              timerRemaining={1500}
              isTimerRunning={false}
              setIsTimerRunning={setIsTimerRunning}
              setTimerRemaining={jest.fn()}
              setTimerDuration={jest.fn()}
              setShowTimerLockout={jest.fn()}
              showConfirmation={jest.fn()}
            />
          );
        });

        const touchables = tree.root.findAllByType(TouchableOpacity);
        const startTouchable = touchables.find((t) => {
          const texts = t.findAllByType(Text);
          return texts.some((txt) => txt.props.children === 'START');
        });
        expect(startTouchable).toBeDefined();

        await act(async () => {
          startTouchable.props.onPress();
        });

        const events = eventBus.getRecentEvents();
        const startedEvent = events.find((e) => e.type === 'FOCUS_STARTED');
        expect(startedEvent).toBeDefined();
        expect(startedEvent?.payload?.duration).toBe(1500);
        expect(startedEvent?.payload?.remaining).toBe(1500);
      } finally {
        if (tree) {
          act(() => {
            tree.unmount();
          });
        }
      }
    });
  });

  describe('Widget Domain Events (TC-EVT-13)', () => {
    it('emits WIDGET_ACTION on SWITCH_TAB in widgetTaskHandler', async () => {
      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'SWITCH_TAB',
        clickActionData: { tab: 'tasks' },
        widgetInfo: { widgetId: 42, widgetName: 'TasksList', width: 300, height: 200 },
        renderWidget: jest.fn(),
      });

      const events = eventBus.getRecentEvents();
      const actionEvent = events.find((e) => e.type === 'WIDGET_ACTION');
      expect(actionEvent).toBeDefined();
      expect(actionEvent?.entityId).toBe('widget_42');
      expect(actionEvent?.source).toBe('widget');
      expect(actionEvent?.payload?.action).toBe('SWITCH_TAB');
      expect(actionEvent?.payload?.tab).toBe('tasks');
    });

    it('emits WIDGET_ACTION and TASK_COMPLETED on TOGGLE_TASK in widgetTaskHandler', async () => {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      const initialData = {
        tasks: [
          {
            id: 'widget-task-1',
            title: 'Widget Toggle Test',
            completed: false,
            important: false,
          },
        ],
        taskLists: [{ id: 'default_inbox', name: 'My Tasks' }],
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify(initialData));

      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'TOGGLE_TASK',
        clickActionData: { taskId: 'widget-task-1' },
        widgetInfo: { widgetId: 99, widgetName: 'TasksList', width: 300, height: 200 },
        renderWidget: jest.fn(),
      });

      const events = eventBus.getRecentEvents();
      const actionEvent = events.find(
        (e) => e.type === 'WIDGET_ACTION' && e.payload?.taskId === 'widget-task-1'
      );
      expect(actionEvent).toBeDefined();
      expect(actionEvent?.source).toBe('widget');

      const completedEvent = events.find(
        (e) => e.type === 'TASK_COMPLETED' && e.entityId === 'widget-task-1'
      );
      expect(completedEvent).toBeDefined();
      expect(completedEvent?.source).toBe('widget');
      expect(completedEvent?.payload?.completed).toBe(true);
    });
  });
});
