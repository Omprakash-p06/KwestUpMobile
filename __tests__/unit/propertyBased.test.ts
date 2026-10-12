/**
 * Phase C: Property-Based Verification Suite
 *
 * Utilizes fast-check to test pure domain invariants across generated inputs:
 * 1. Task transformations: non-interference, subtask bounds, mergeTasksByUpdatedAt uniqueness & recency
 * 2. Habit engine: streak non-negativity, same-day completion idempotency, recovery state restoration
 * 3. Command validator: fuzz safety, crash resistance, capability rejection gates
 */

import * as fc from 'fast-check';
import {
  completeTask,
  toggleTask,
  toggleSubtask,
  saveTask,
  mergeTasksByUpdatedAt,
} from '../../src/utils/taskMutations';
import {
  completeHabit,
} from '../../src/behavior/habitEngine';
import { Habit } from '../../src/behavior/types';
import { validateCommand } from '../../src/commands/commandValidator';
import { DispatchedCommand } from '../../src/commands/types';

describe('Phase C: Property-Based Testing Invariants', () => {
  describe('Task Mutations Invariants', () => {
    it('Property: completing task A never mutates or alters unrelated task B', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.boolean(),
          (titleA, titleB, initialCompletedB) => {
            const taskA = { id: 'id-A', title: titleA, completed: false, updatedAt: '2026-10-12T10:00:00.000Z' };
            const taskB = { id: 'id-B', title: titleB, completed: initialCompletedB, updatedAt: '2026-10-12T10:00:00.000Z' };
            const tasks = [taskA, taskB];

            const { updatedTasks } = completeTask(tasks, 'id-A', {
              now: '2026-10-12T11:00:00.000Z',
              todayDate: '2026-10-12',
            });

            const resultingB = updatedTasks.find((t: any) => t.id === 'id-B');
            expect(resultingB).toEqual(taskB);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: out-of-bounds subtask indices never mutate the task list', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: -1 }),
          (negativeIdx) => {
            const task = {
              id: 't-sub',
              title: 'Parent',
              subtasks: [{ title: 'Sub 1', completed: false }],
              updatedAt: '2026-10-12T10:00:00.000Z',
            };
            const tasks = [task];

            const { updatedTasks, updatedTask } = toggleSubtask(tasks, 't-sub', negativeIdx);
            expect(updatedTask).toBeNull();
            expect(updatedTasks).toBe(tasks);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: mergeTasksByUpdatedAt guarantees unique task IDs and recency dominance', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.constantFrom('task-1', 'task-2', 'task-3', 'task-4'),
              title: fc.string({ maxLength: 15 }),
              completed: fc.boolean(),
              updatedAt: fc.integer({ min: 1000, max: 9000 }).map((n) => `2026-10-12T10:${String(n % 60).padStart(2, '0')}:00.000Z`),
            }),
            { maxLength: 10 }
          ),
          fc.array(
            fc.record({
              id: fc.constantFrom('task-1', 'task-2', 'task-3', 'task-4'),
              title: fc.string({ maxLength: 15 }),
              completed: fc.boolean(),
              updatedAt: fc.integer({ min: 1000, max: 9000 }).map((n) => `2026-10-12T10:${String(n % 60).padStart(2, '0')}:00.000Z`),
            }),
            { maxLength: 10 }
          ),
          (tasksA, tasksB) => {
            const merged = mergeTasksByUpdatedAt(tasksA, tasksB);

            // Invariant 1: All IDs in merged list must be distinct
            const ids = merged.map((t: any) => t.id);
            const uniqueIds = new Set(ids);
            expect(ids.length).toBe(uniqueIds.size);

            // Invariant 2: For any task present, the merged version has the latest updatedAt across all candidate records with that ID
            for (const item of merged as any[]) {
              const allA = tasksA.filter((t: any) => t.id === item.id).map((t: any) => t.updatedAt);
              const allB = tasksB.filter((t: any) => t.id === item.id).map((t: any) => t.updatedAt);
              const allTimes = [...allA, ...allB];
              allTimes.sort();
              const maxExpected = allTimes[allTimes.length - 1];
              expect(item.updatedAt).toBe(maxExpected);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Habit Engine Invariants', () => {
    it('Property: streaks are strictly non-negative and identical date completions are idempotent', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 500 }),
          fc.integer({ min: 0, max: 500 }),
          (initialStreak, initialVotes) => {
            const habit: Habit = {
              id: 'h-prop',
              identityId: 'id-prop',
              title: 'Daily Exercise',
              behavior: 'Exercise 20 mins',
              frequency: 'daily',
              status: 'active',
              minimumAction: 'Exercise 2 mins',
              normalTarget: 'Exercise 20 mins',
              streakCount: initialStreak,
              bestStreak: Math.max(initialStreak, 10),
              totalEvidenceVotes: initialVotes,
              createdAt: '2026-10-12T00:00:00.000Z',
              updatedAt: '2026-10-12T00:00:00.000Z',
            };

            const day1 = '2026-10-12';
            const firstRun = completeHabit(habit, { todayDate: day1, now: '2026-10-12T08:00:00.000Z' });
            expect(firstRun.updatedHabit.streakCount).toBe(initialStreak + 1);
            expect(firstRun.updatedHabit.totalEvidenceVotes).toBe(initialVotes + 1);

            // Second run on same day must be a no-op
            const secondRun = completeHabit(firstRun.updatedHabit, { todayDate: day1, now: '2026-10-12T14:00:00.000Z' });
            expect(secondRun.completedToday).toBe(false);
            expect(secondRun.updatedHabit.streakCount).toBe(firstRun.updatedHabit.streakCount);
            expect(secondRun.updatedHabit.totalEvidenceVotes).toBe(firstRun.updatedHabit.totalEvidenceVotes);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: completing a habit in recovery status always restores active status', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (votes) => {
            const habitInRecovery: Habit = {
              id: 'h-rec',
              identityId: 'id-rec',
              title: 'Meditation',
              behavior: 'Meditate 10 mins',
              frequency: 'daily',
              status: 'recovery',
              minimumAction: 'Meditate 2 mins',
              normalTarget: 'Meditate 10 mins',
              streakCount: 0,
              bestStreak: 5,
              totalEvidenceVotes: votes,
              createdAt: '2026-10-12T00:00:00.000Z',
              updatedAt: '2026-10-12T00:00:00.000Z',
            };

            const outcome = completeHabit(habitInRecovery, { todayDate: '2026-10-13', now: '2026-10-13T09:00:00.000Z' });
            expect(outcome.updatedHabit.status).toBe('active');
            expect(outcome.updatedHabit.streakCount).toBe(1);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Command Validator Invariants', () => {
    it('Property: validateCommand never throws on arbitrary malformed inputs (fuzz safety)', () => {
      fc.assert(
        fc.property(
          fc.anything(),
          (arbitraryInput) => {
            const result = validateCommand(arbitraryInput as any);
            expect(typeof result).toBe('object');
            expect(typeof result.valid).toBe('boolean');
            expect(Array.isArray(result.errors)).toBe(true);
          }
        ),
        { numRuns: 150 }
      );
    });

    it('Property: unsupported command actions are deterministically rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !['CREATE_HABIT', 'UPDATE_HABIT', 'DELETE_HABIT', 'LOG_HABIT', 'START_RECOVERY', 'DISMISS_INTERVENTION', 'ADJUST_DIFFICULTY', 'CREATE_IDENTITY', 'PAUSE_HABIT', 'ARCHIVE_HABIT', 'RESUME_HABIT'].includes(s)),
          (unsupportedAction) => {
            const command: DispatchedCommand = {
              action: unsupportedAction as any,
              idempotencyKey: 'idemp-random-1234',
              actor: 'user',
              payload: {} as any,
            };

            const result = validateCommand(command);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('Unsupported command action'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
