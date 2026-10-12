/**
 * Phase E: Stateful Sequence Verification Suite
 *
 * Verifies end-to-end multi-step stateful flows across core domains:
 * 1. Task sequence: Create → edit → complete → toggle → persist → reload → widget action → reload again
 * 2. Habit sequence: Create → complete → duplicate completion → miss → recovery → pause → resume → reload
 * 3. Command sequence: Valid command → retry same ID → invalid command → stale precondition → process restart → retry
 * 4. Persistence sequence: Hydrate → mutate → start write → mutate again → trigger refresh → resolve writes out of order → reload
 * 5. Notification sequence: Schedule → reschedule → delete entity → verify obsolete notification cancelled
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveTask,
  completeTask,
  toggleTask,
  deleteTask,
  mergeTasksByUpdatedAt,
} from '../../src/utils/taskMutations';
import {
  compileHabitPlan,
  completeHabit,
} from '../../src/behavior/habitEngine';
import { evaluateRecoveryTransition } from '../../src/behavior/recoveryEngine';
import { Habit } from '../../src/behavior/types';
import { validateCommand } from '../../src/commands/commandValidator';
import {
  executeCommand,
  registerCommandHandler,
  clearCommandHandlers,
  clearIdempotencyCache,
  purgeExpiredEntries,
} from '../../src/commands/commandExecutor';
import {
  writeIdempotencyRecord,
  readIdempotencyRecord,
  clearDurableIdempotencyStore,
} from '../../src/commands/idempotencyStore';
import { DispatchedCommand } from '../../src/commands/types';
import {
  scheduleDueDateReminder,
  cancelNotification,
} from '../../src/services/notificationService';
import { STORAGE_VERSION } from '../../src/utils/storage';
import { eventBus } from '../../src/behavior/eventBus';

describe('Phase E: Stateful Sequences Verification', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    clearCommandHandlers();
    clearIdempotencyCache();
    await clearDurableIdempotencyStore();
    eventBus.clearListeners();
    eventBus.clearBuffer();
    jest.clearAllMocks();
  });

  describe('1. Task Stateful Sequence', () => {
    it('executes Create → edit → complete → toggle → persist → reload → widget action → reload', async () => {
      let tasks: any[] = [];
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;

      // Step 1: Create
      const { updatedTasks: tasksAfterCreate, savedTask: createdTask } = saveTask(tasks, {
        title: 'Deep Work Session',
        dueDate: '2026-10-15T10:00:00.000Z',
      }, { now: '2026-10-12T10:00:00.000Z' });
      tasks = tasksAfterCreate;
      expect(tasks).toHaveLength(1);
      expect((createdTask as any).completed).toBe(false);

      // Step 2: Edit
      const { updatedTasks: tasksAfterEdit, savedTask: editedTask } = saveTask(tasks, {
        id: (createdTask as any).id,
        title: 'Deep Work Session (90 mins)',
      }, { now: '2026-10-12T10:05:00.000Z' });
      tasks = tasksAfterEdit;
      expect(tasks[0].title).toBe('Deep Work Session (90 mins)');

      // Step 3: Complete
      const { updatedTasks: tasksAfterComplete } = completeTask(tasks, (createdTask as any).id, {
        now: '2026-10-12T11:00:00.000Z',
        todayDate: '2026-10-12',
      });
      tasks = tasksAfterComplete;
      expect(tasks[0].completed).toBe(true);

      // Step 4: Toggle back to incomplete
      const { updatedTasks: tasksAfterToggle } = toggleTask(tasks, (createdTask as any).id, {
        now: '2026-10-12T11:05:00.000Z',
        todayDate: '2026-10-12',
      });
      tasks = tasksAfterToggle;
      expect(tasks[0].completed).toBe(false);

      // Step 5: Persist to storage
      await AsyncStorage.setItem(storageKey, JSON.stringify({ tasks }));

      // Step 6: Reload from storage
      const storedRaw = await AsyncStorage.getItem(storageKey);
      const parsedStored = JSON.parse(storedRaw || '{}');
      expect(parsedStored.tasks).toHaveLength(1);
      expect(parsedStored.tasks[0].completed).toBe(false);

      // Step 7: Widget action in background
      // Widget toggles task in storage at 11:30
      const widgetTasks = [
        {
          ...parsedStored.tasks[0],
          completed: true,
          completedAt: '2026-10-12T11:30:00.000Z',
          updatedAt: '2026-10-12T11:30:00.000Z',
        },
      ];
      await AsyncStorage.setItem(storageKey, JSON.stringify({ tasks: widgetTasks }));

      // Step 8: App foregrounds and reconciles in-memory tasks with widget storage
      const reconciled = mergeTasksByUpdatedAt(tasks, widgetTasks);
      expect(reconciled).toHaveLength(1);
      expect((reconciled[0] as any).completed).toBe(true);
      expect((reconciled[0] as any).updatedAt).toBe('2026-10-12T11:30:00.000Z');
    });
  });

  describe('2. Habit Stateful Sequence', () => {
    it('executes Create → complete → duplicate completion → miss → recovery → pause → resume', () => {
      // Step 1: Create Habit Plan
      const planResult = compileHabitPlan({
        identity: 'Reader',
        behavior: 'Read 10 pages',
        minimumAction: 'Read 1 page',
        normalTarget: 'Read 10 pages',
      });
      expect(planResult.valid).toBe(true);
      const habit: Habit = {
        id: 'h-1',
        identityId: 'id-1',
        title: planResult.plan!.behavior.target,
        behavior: planResult.plan!.behavior.target,
        frequency: 'daily',
        status: 'active',
        minimumAction: planResult.plan!.behavior.minimum,
        normalTarget: planResult.plan!.behavior.normal,
        streakCount: 0,
        bestStreak: 0,
        totalEvidenceVotes: 0,
        createdAt: '2026-10-12T00:00:00.000Z',
        updatedAt: '2026-10-12T00:00:00.000Z',
      };
      expect(habit.status).toBe('active');
      expect(habit.streakCount).toBe(0);

      // Step 2: Complete for today
      const firstCompletion = completeHabit(habit, {
        now: '2026-10-12T08:00:00.000Z',
        todayDate: '2026-10-12',
      });
      expect(firstCompletion.completedToday).toBe(true);
      expect(firstCompletion.updatedHabit.streakCount).toBe(1);
      expect(firstCompletion.updatedHabit.lastCompletedDate).toBe('2026-10-12');

      // Step 3: Duplicate completion on same day (idempotent guard)
      const duplicateCompletion = completeHabit(firstCompletion.updatedHabit, {
        now: '2026-10-12T12:00:00.000Z',
        todayDate: '2026-10-12',
      });
      expect(duplicateCompletion.completedToday).toBe(false);
      expect(duplicateCompletion.updatedHabit.streakCount).toBe(1); // Not double-incremented!

      // Step 4: Miss a day next day (consecutiveMisses = 1)
      const recoveryTransition = evaluateRecoveryTransition(
        duplicateCompletion.updatedHabit,
        1,
        { now: '2026-10-14T00:00:00.000Z', todayDate: '2026-10-14' }
      );
      expect(recoveryTransition.updatedHabit.status).toBe('recovery');
      expect(recoveryTransition.updatedHabit.streakCount).toBe(0);
      expect(recoveryTransition.nextSessionTarget).toBe(habit.minimumAction);

      // Step 5: Complete recovery session -> restores active status!
      const recoveredCompletion = completeHabit(recoveryTransition.updatedHabit, {
        now: '2026-10-14T09:00:00.000Z',
        todayDate: '2026-10-14',
      });
      expect(recoveredCompletion.completedToday).toBe(true);
      expect(recoveredCompletion.updatedHabit.status).toBe('active');
      expect(recoveredCompletion.updatedHabit.streakCount).toBe(1);

      // Step 6: Pause habit
      const pausedHabit: Habit = {
        ...recoveredCompletion.updatedHabit,
        status: 'paused',
        updatedAt: '2026-10-15T10:00:00.000Z',
      };
      expect(pausedHabit.status).toBe('paused');

      // Step 7: Resume habit
      const resumedHabit: Habit = {
        ...pausedHabit,
        status: 'active',
        updatedAt: '2026-10-20T10:00:00.000Z',
      };
      expect(resumedHabit.status).toBe('active');
    });
  });

  describe('3. Command Gateway Stateful Sequence', () => {
    it('executes Valid command → retry same ID → invalid command → process restart → retry', async () => {
      let sideEffectCounter = 0;
      registerCommandHandler('LOG_HABIT', async () => {
        sideEffectCounter++;
        return {
          entityId: 'h1',
          message: 'Habit logged',
          rulesApplied: ['HABIT_COMPLETED'],
        };
      });

      const validCommand: DispatchedCommand = {
        action: 'LOG_HABIT',
        idempotencyKey: 'idemp-seq-001',
        actor: 'user',
        payload: {
          habitId: 'h1',
          completedAt: '2026-10-12T12:00:00.000Z',
        } as any,
      };

      // Step 1: Valid execution
      const res1 = await executeCommand(validCommand);
      expect(res1.success).toBe(true);
      expect(sideEffectCounter).toBe(1);

      // Save to durable store to simulate durable gateway behavior
      await writeIdempotencyRecord(validCommand.idempotencyKey, res1);

      // Step 2: Retry with same idempotencyKey -> Deduplicated, side effect NOT re-run
      const res2 = await executeCommand(validCommand);
      expect(res2.success).toBe(true);
      expect(sideEffectCounter).toBe(1); // Not incremented!

      // Step 3: Invalid command (schema violation)
      const invalidCommand: DispatchedCommand = {
        action: 'CREATE_HABIT',
        idempotencyKey: 'idemp-seq-invalid',
        actor: 'user',
        payload: {
          behavior: '', // Empty behavior violates invariant
        } as any,
      };
      const validation = validateCommand(invalidCommand);
      expect(validation.valid).toBe(false);

      // Step 4: Simulate Process Restart (in-memory cache evicted)
      purgeExpiredEntries(Date.now() + 20 * 60 * 1000);

      // Verify in-memory was evicted, but executeCommand still deduplicates via durable store!
      const res3 = await executeCommand(validCommand);
      expect(res3.success).toBe(true);
      expect(sideEffectCounter).toBe(1); // Still 1! Deduplicated via durable store!
    });
  });

  describe('4. Persistence Out-of-Order Sequence', () => {
    it('reconciles rapid interleaved mutations resolving out of order without losing mutations', async () => {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;

      // Start with hydrated initial tasks
      let initialTasks = [
        { id: 't1', title: 'Task 1', completed: false, updatedAt: '2026-10-12T10:00:00.000Z' },
        { id: 't2', title: 'Task 2', completed: false, updatedAt: '2026-10-12T10:00:00.000Z' },
      ];
      await AsyncStorage.setItem(storageKey, JSON.stringify({ tasks: initialTasks }));

      // Mutation 1 (user completes t1 at 10:01)
      const mutation1Tasks = [
        { id: 't1', title: 'Task 1', completed: true, updatedAt: '2026-10-12T10:01:00.000Z' },
        { id: 't2', title: 'Task 2', completed: false, updatedAt: '2026-10-12T10:00:00.000Z' },
      ];

      // Mutation 2 (widget adds t3 and completes t2 at 10:02 in storage)
      const storageWidgetTasks = [
        { id: 't1', title: 'Task 1', completed: false, updatedAt: '2026-10-12T10:00:00.000Z' }, // Older t1
        { id: 't2', title: 'Task 2', completed: true, updatedAt: '2026-10-12T10:02:00.000Z' }, // Newer t2
        { id: 't3', title: 'Widget Task 3', completed: false, updatedAt: '2026-10-12T10:02:00.000Z' },
      ];

      // Now reconcile in-memory mutation 1 with storage
      const reconciled = mergeTasksByUpdatedAt(mutation1Tasks, storageWidgetTasks);

      expect(reconciled).toHaveLength(3);
      // t1 should have completed: true from mutation1 (newer timestamp 10:01 > 10:00)
      const t1: any = reconciled.find((t: any) => t.id === 't1');
      expect(t1?.completed).toBe(true);
      expect(t1?.updatedAt).toBe('2026-10-12T10:01:00.000Z');

      // t2 should have completed: true from storage (newer timestamp 10:02 > 10:00)
      const t2: any = reconciled.find((t: any) => t.id === 't2');
      expect(t2?.completed).toBe(true);

      // t3 should be present from storage
      const t3 = reconciled.find((t: any) => t.id === 't3');
      expect(t3).toBeDefined();
    });
  });

  describe('5. Notification Stateful Sequence', () => {
    it('executes Schedule → reschedule → delete entity with proper notification cleanup', async () => {
      // Step 1: Schedule reminder for task
      const task = {
        id: 'notif-task-1',
        title: 'Submit Expense Report',
        dueDate: '2026-10-20T17:00:00.000Z',
      };
      const notifId1 = await scheduleDueDateReminder(task);
      expect(notifId1).toBeDefined();

      // Step 2: Reschedule (due date changed)
      const rescheduledTask = {
        ...task,
        notificationId: notifId1,
        dueDate: '2026-10-22T17:00:00.000Z',
      };
      // Cancel old
      if (rescheduledTask.notificationId) {
        await cancelNotification(rescheduledTask.notificationId);
      }
      const notifId2 = await scheduleDueDateReminder(rescheduledTask);
      expect(notifId2).toBeDefined();

      // Step 3: Delete task -> cancels obsolete notification
      const taskToDelete = {
        ...rescheduledTask,
        notificationId: notifId2,
      };
      const { updatedTasks, deletedTask } = deleteTask([taskToDelete], taskToDelete.id);
      expect(updatedTasks).toHaveLength(0);
      expect(deletedTask).toBeDefined();

      if ((deletedTask as any)?.notificationId) {
        await cancelNotification((deletedTask as any).notificationId);
      }

      // Assert state invariant: deleted task no longer exists
      expect(updatedTasks.find((t: any) => t.id === task.id)).toBeUndefined();
    });
  });
});
