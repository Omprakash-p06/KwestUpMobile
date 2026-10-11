/**
 * Integration Test Suite: Command Gateway End-to-End Execution & Domain Handlers
 *
 * Requirements Covered: [CMD-01]
 * Codebase Alignment: ARCHITECTURE.md, STRUCTURE.md, TESTING.md
 */

import {
  registerDefaultHabitHandlers,
  resetDefaultHabitHandlerRefCount,
  HabitOperations,
} from '../../src/commands/habitCommandHandlers';
import { executeCommand, clearCommandHandlers, clearIdempotencyCache } from '../../src/commands/commandExecutor';
import { executeAiCommand } from '../../src/commands/aiSandbox';
import { eventBus } from '../../src/behavior/eventBus';
import { DispatchedCommand } from '../../src/commands/types';

describe('commandIntegration', () => {
  let inMemoryHabits: any[] = [];
  let inMemoryIdentities: any[] = [];
  let habitOperations: HabitOperations;
  let unregisterHandlers: () => void;

  beforeEach(() => {
    resetDefaultHabitHandlerRefCount();
    clearCommandHandlers();
    clearIdempotencyCache();
    eventBus.clearListeners();
    eventBus.clearBuffer();

    inMemoryHabits = [
      {
        id: 'habit-101',
        identityId: 'id-1',
        title: 'Daily Pushups',
        behavior: 'Do 30 pushups',
        minimumAction: 'Do 1 pushup',
        normalTarget: 'Do 30 pushups',
        frequency: 'daily',
        status: 'active',
        streakCount: 3,
        bestStreak: 5,
        totalEvidenceVotes: 10,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ];

    inMemoryIdentities = [
      {
        id: 'id-1',
        statement: 'I am an athlete',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ];

    habitOperations = {
      habits: inMemoryHabits,
      createHabit: jest.fn().mockImplementation((input) => {
        const newHabit = {
          id: `habit-${Date.now()}`,
          identityId: input.identityId || 'id-default',
          title: input.title,
          behavior: input.behavior,
          minimumAction: input.minimumAction,
          normalTarget: input.normalTarget,
          frequency: input.frequency,
          status: 'active',
          streakCount: 0,
          bestStreak: 0,
          totalEvidenceVotes: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        inMemoryHabits.push(newHabit);
        return { habit: newHabit, rulesApplied: ['HABIT_CONCURRENT_CAP_001'] };
      }),
      updateHabit: jest.fn().mockImplementation((id, patch) => {
        const index = inMemoryHabits.findIndex((h) => h.id === id);
        if (index >= 0) {
          inMemoryHabits[index] = { ...inMemoryHabits[index], ...patch, updatedAt: new Date().toISOString() };
          return inMemoryHabits[index];
        }
        return null;
      }),
      deleteHabit: jest.fn().mockImplementation((id) => {
        inMemoryHabits = inMemoryHabits.filter((h) => h.id !== id);
      }),
      completeHabit: jest.fn().mockImplementation((id) => {
        const habit = inMemoryHabits.find((h) => h.id === id);
        if (habit) {
          habit.streakCount += 1;
          habit.totalEvidenceVotes += 1;
          habit.status = 'active';
        }
        return { updatedHabit: habit, rulesApplied: ['HABIT_EVIDENCE_VOTE_001'] };
      }),
      missHabit: jest.fn().mockImplementation((id) => {
        const habit = inMemoryHabits.find((h) => h.id === id);
        if (habit) {
          habit.status = 'recovery';
        }
        return { updatedHabit: habit, rulesApplied: ['NEVER_MISS_TWICE_001'] };
      }),
      createIdentity: jest.fn().mockImplementation((statement) => {
        const newIdentity = {
          id: `id-${Date.now()}`,
          statement,
        };
        inMemoryIdentities.push(newIdentity);
        return newIdentity;
      }),
    };

    unregisterHandlers = registerDefaultHabitHandlers(habitOperations);
  });

  afterEach(() => {
    if (unregisterHandlers) {
      unregisterHandlers();
    }
  });

  it('executes CREATE_HABIT end-to-end and emits COMMAND_EXECUTED event', async () => {
    const executedEvents: any[] = [];
    const unsub = eventBus.subscribe('COMMAND_EXECUTED', (evt) => {
      executedEvents.push(evt);
    });

    const createCmd: DispatchedCommand<'CREATE_HABIT'> = {
      action: 'CREATE_HABIT',
      idempotencyKey: 'cmd-create-e2e-001',
      payload: {
        identityId: 'id-1',
        title: 'Evening Reading',
        behavior: 'Read 20 pages',
        minimumAction: 'Read 1 page',
        normalTarget: 'Read 20 pages',
        frequency: 'daily',
        cueType: 'evening',
      },
    };

    const result = await executeCommand(createCmd);

    expect(result.success).toBe(true);
    expect(result.entityId).toMatch(/^habit-/);
    expect(result.rulesApplied).toContain('HABIT_CONCURRENT_CAP_001');
    expect(habitOperations.createHabit).toHaveBeenCalledTimes(1);
    expect(habitOperations.createHabit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Evening Reading',
        cue: {
          type: 'evening',
          time: undefined,
          location: undefined,
        },
      })
    );
    expect(inMemoryHabits).toHaveLength(2);

    expect(executedEvents).toHaveLength(1);
    expect(executedEvents[0].payload.action).toBe('CREATE_HABIT');

    unsub();
  });

  it('executes UPDATE_HABIT updating permitted fields', async () => {
    const updateCmd: DispatchedCommand<'UPDATE_HABIT'> = {
      action: 'UPDATE_HABIT',
      idempotencyKey: 'cmd-update-e2e-001',
      payload: {
        habitId: 'habit-101',
        updates: {
          title: 'Daily Power Pushups',
          minimumAction: 'Do 2 pushups',
        },
      },
    };

    const result = await executeCommand(updateCmd);

    expect(result.success).toBe(true);
    expect(result.entityId).toBe('habit-101');
    expect(habitOperations.updateHabit).toHaveBeenCalledWith('habit-101', {
      title: 'Daily Power Pushups',
      minimumAction: 'Do 2 pushups',
    });
    expect(inMemoryHabits[0].title).toBe('Daily Power Pushups');
    expect(inMemoryHabits[0].minimumAction).toBe('Do 2 pushups');
  });

  it('executes LOG_HABIT and updates streak / votes', async () => {
    const logCmd: DispatchedCommand<'LOG_HABIT'> = {
      action: 'LOG_HABIT',
      idempotencyKey: 'cmd-log-e2e-001',
      payload: {
        habitId: 'habit-101',
        completedAt: '2026-10-11T12:00:00.000Z',
      },
    };

    const result = await executeCommand(logCmd);

    expect(result.success).toBe(true);
    expect(result.rulesApplied).toContain('HABIT_EVIDENCE_VOTE_001');
    expect(habitOperations.completeHabit).toHaveBeenCalledTimes(1);
    expect(inMemoryHabits[0].streakCount).toBe(4);
    expect(inMemoryHabits[0].totalEvidenceVotes).toBe(11);
  });

  it('executes START_RECOVERY transitioning status to recovery', async () => {
    const recCmd: DispatchedCommand<'START_RECOVERY'> = {
      action: 'START_RECOVERY',
      idempotencyKey: 'cmd-rec-e2e-001',
      payload: {
        habitId: 'habit-101',
        reason: 'effort',
      },
    };

    const result = await executeCommand(recCmd);

    expect(result.success).toBe(true);
    expect(result.rulesApplied).toContain('NEVER_MISS_TWICE_001');
    expect(habitOperations.missHabit).toHaveBeenCalledTimes(1);
    expect(inMemoryHabits[0].status).toBe('recovery');
  });

  it('executes PAUSE_HABIT, ARCHIVE_HABIT, and RESUME_HABIT lifecycle transitions', async () => {
    // PAUSE_HABIT
    const pauseCmd: DispatchedCommand<'PAUSE_HABIT'> = {
      action: 'PAUSE_HABIT',
      idempotencyKey: 'cmd-pause-001',
      payload: { habitId: 'habit-101', actor: 'user', reason: 'Vacation' },
    };
    const resPause = await executeCommand(pauseCmd);
    expect(resPause.success).toBe(true);
    expect(inMemoryHabits[0].status).toBe('paused');

    // RESUME_HABIT
    const resumeCmd: DispatchedCommand<'RESUME_HABIT'> = {
      action: 'RESUME_HABIT',
      idempotencyKey: 'cmd-resume-001',
      payload: { habitId: 'habit-101', actor: 'user', reason: 'Returned from vacation' },
    };
    const resResume = await executeCommand(resumeCmd);
    expect(resResume.success).toBe(true);
    expect(inMemoryHabits[0].status).toBe('active');

    // ARCHIVE_HABIT
    const archiveCmd: DispatchedCommand<'ARCHIVE_HABIT'> = {
      action: 'ARCHIVE_HABIT',
      idempotencyKey: 'cmd-archive-001',
      payload: { habitId: 'habit-101', actor: 'user', reason: 'Goal fulfilled' },
    };
    const resArchive = await executeCommand(archiveCmd);
    expect(resArchive.success).toBe(true);
    expect(inMemoryHabits[0].status).toBe('archived');
  });

  it('executes DISMISS_INTERVENTION and emits REMINDER_DISMISSED domain event', async () => {
    const dismissedEvents: any[] = [];
    const unsub = eventBus.subscribe('REMINDER_DISMISSED', (evt) => {
      dismissedEvents.push(evt);
    });

    const dismissCmd: DispatchedCommand<'DISMISS_INTERVENTION'> = {
      action: 'DISMISS_INTERVENTION',
      idempotencyKey: 'cmd-dismiss-001',
      payload: { interventionId: 'int-pushup-reminder', reason: 'acted' },
    };

    const result = await executeCommand(dismissCmd);

    expect(result.success).toBe(true);
    expect(dismissedEvents).toHaveLength(1);
    expect(dismissedEvents[0].entityId).toBe('int-pushup-reminder');
    expect(dismissedEvents[0].payload.reason).toBe('acted');

    unsub();
  });

  it('executes DELETE_HABIT removing habit from collection', async () => {
    const deleteCmd: DispatchedCommand<'DELETE_HABIT'> = {
      action: 'DELETE_HABIT',
      idempotencyKey: 'cmd-delete-001',
      payload: { habitId: 'habit-101' },
    };

    const result = await executeCommand(deleteCmd);

    expect(result.success).toBe(true);
    expect(habitOperations.deleteHabit).toHaveBeenCalledWith('habit-101');
    expect(inMemoryHabits).toHaveLength(0);
  });

  it('executes full AI pipeline via executeAiCommand end-to-end', async () => {
    const aiJson = JSON.stringify({
      action: 'CREATE_HABIT',
      params: {
        identityId: 'id-1',
        title: 'Cold Water Hydration',
        behavior: 'Drink 500ml ice water',
        minimumAction: 'Drink 1 sip of water',
        normalTarget: 'Drink 500ml ice water',
        frequency: 'daily',
        cueType: 'morning',
      },
    });

    const result = await executeAiCommand(aiJson);

    expect(result.success).toBe(true);
    expect(result.entityId).toMatch(/^habit-/);
    expect(habitOperations.createHabit).toHaveBeenCalledTimes(1);
  });

  it('manages handler lifecycle with reference counting across multiple consumers', async () => {
    // Reset reference count and clear handlers
    resetDefaultHabitHandlerRefCount();
    clearCommandHandlers();

    // Consumer A mounts
    const unregisterA = registerDefaultHabitHandlers(habitOperations);
    // Consumer B mounts
    const unregisterB = registerDefaultHabitHandlers(habitOperations);

    // Command should succeed
    const cmd: DispatchedCommand<'PAUSE_HABIT'> = {
      action: 'PAUSE_HABIT',
      idempotencyKey: 'cmd-pause-ref-count-1',
      payload: { habitId: 'habit-101', actor: 'user', reason: 'Vacation' },
    };
    const resA = await executeCommand(cmd);
    expect(resA.success).toBe(true);

    // Consumer A unmounts
    unregisterA();

    // Consumer B is still mounted, so handler must still be active!
    const cmd2: DispatchedCommand<'RESUME_HABIT'> = {
      action: 'RESUME_HABIT',
      idempotencyKey: 'cmd-resume-ref-count-2',
      payload: { habitId: 'habit-101', actor: 'user', reason: 'Returned' },
    };
    const resB = await executeCommand(cmd2);
    expect(resB.success).toBe(true);

    // Consumer B unmounts, ref count drops to 0, handlers are finally unregistered
    unregisterB();

    const cmd3: DispatchedCommand<'PAUSE_HABIT'> = {
      action: 'PAUSE_HABIT',
      idempotencyKey: 'cmd-pause-ref-count-3',
      payload: { habitId: 'habit-101', actor: 'user', reason: 'Sick leave' },
    };
    const resC = await executeCommand(cmd3);
    expect(resC.success).toBe(false);
    expect(resC.error).toContain('No handler registered');
  });
});
