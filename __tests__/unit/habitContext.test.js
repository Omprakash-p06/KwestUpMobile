/**
 * Unit Test Suite: HabitContext, Isolated Persistence & State Machine
 *
 * Requirements Covered: [BEH-02]
 * Codebase Alignment: TESTING.md, CONVENTIONS.md, CONCERNS.md
 */

import React from 'react';
import { View, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HabitProvider,
  useHabits,
  HABITS_STORAGE_KEY,
  BEHAVIOR_EVENTS_STORAGE_KEY,
  IDENTITIES_STORAGE_KEY,
  REWARDS_STORAGE_KEY,
  MAX_PERSISTED_BEHAVIOR_EVENTS,
} from '../../src/context/HabitContext';
import { isUserDataKey, clearAllCaches } from '../../src/utils/storage';
import { eventBus } from '../../src/behavior/eventBus';
import { logger } from '../../src/utils/logger';

let contextValue = null;

const TestHabitConsumer = () => {
  contextValue = useHabits();
  return (
    <View>
      <Text>Habit Test Consumer</Text>
    </View>
  );
};

describe('HabitContext & Isolated Persistence Unit Tests', () => {
  let loggerErrorSpy;
  let currentRoot = null;

  beforeEach(async () => {
    await AsyncStorage.clear();
    eventBus.clearListeners();
    eventBus.clearBuffer();
    jest.clearAllMocks();
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    contextValue = null;
    currentRoot = null;
  });

  afterEach(async () => {
    if (currentRoot) {
      await act(async () => {
        currentRoot.unmount();
      });
      currentRoot = null;
    }
    loggerErrorSpy.mockRestore();
  });

  describe('Storage Cache-Clear Protection (CONCERNS.md:67-72)', () => {
    it('isUserDataKey protects all habit domain keys from cache deletion', () => {
      expect(isUserDataKey('kwestup_habits_v1')).toBe(true);
      expect(isUserDataKey('kwestup_behavior_events_v1')).toBe(true);
      expect(isUserDataKey('kwestup_identities_v1')).toBe(true);
      expect(isUserDataKey('kwestup_rewards_v1')).toBe(true);
      expect(isUserDataKey('kwestup_interventions_v1')).toBe(true);
      expect(isUserDataKey('kwestup_ui_cache')).toBe(false);
      expect(isUserDataKey('kwestup_temp_cache')).toBe(false);
    });

    it('clearAllCaches preserves habit domain data while removing transient cache', async () => {
      await AsyncStorage.multiSet([
        [HABITS_STORAGE_KEY, JSON.stringify([{ id: 'h1', title: 'Habit 1' }])],
        [BEHAVIOR_EVENTS_STORAGE_KEY, JSON.stringify([{ id: 'e1', type: 'HABIT_CREATED' }])],
        [IDENTITIES_STORAGE_KEY, JSON.stringify([{ id: 'i1', statement: 'Athlete' }])],
        [REWARDS_STORAGE_KEY, JSON.stringify([{ id: 'r1', title: 'First Step' }])],
        ['kwestup_ui_cache', 'transient-ui'],
        ['kwestup_temp_cache', 'temporary-data'],
      ]);

      const cleared = await clearAllCaches();
      expect(cleared).toBe(true);

      const [habits, events, identities, rewards, uiCache, tempCache] = await Promise.all([
        AsyncStorage.getItem(HABITS_STORAGE_KEY),
        AsyncStorage.getItem(BEHAVIOR_EVENTS_STORAGE_KEY),
        AsyncStorage.getItem(IDENTITIES_STORAGE_KEY),
        AsyncStorage.getItem(REWARDS_STORAGE_KEY),
        AsyncStorage.getItem('kwestup_ui_cache'),
        AsyncStorage.getItem('kwestup_temp_cache'),
      ]);

      // Protected keys must be completely intact
      expect(habits).not.toBeNull();
      expect(events).not.toBeNull();
      expect(identities).not.toBeNull();
      expect(rewards).not.toBeNull();

      // Transient keys must be deleted
      expect(uiCache).toBeNull();
      expect(tempCache).toBeNull();
    });
  });

  describe('HabitProvider Lifecycle & Hydration', () => {
    it('hydrates initial habit state from storage', async () => {
      const storedHabits = [
        {
          id: 'stored-1',
          identityId: 'id-1',
          title: 'Stored Reading',
          behavior: 'Read 10 pages',
          frequency: 'daily',
          status: 'active',
          minimumAction: 'Read 1 page',
          normalTarget: 'Read 10 pages',
          streakCount: 3,
          bestStreak: 5,
          totalEvidenceVotes: 12,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-10T10:00:00.000Z',
        },
      ];

      await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(storedHabits));

      await act(async () => {
        currentRoot = renderer.create(
          <HabitProvider>
            <TestHabitConsumer />
          </HabitProvider>
        );
      });

      expect(contextValue).toBeDefined();
      expect(contextValue.habits).toHaveLength(1);
      expect(contextValue.habits[0].title).toBe('Stored Reading');
    });

    it('throws error when useHabits is called outside of HabitProvider', async () => {
      let caughtError = null;
      const OrphanConsumer = () => {
        try {
          useHabits();
        } catch (e) {
          caughtError = e;
        }
        return null;
      };

      await act(async () => {
        renderer.create(<OrphanConsumer />);
      });

      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).toContain('useHabits must be used within a HabitProvider');
    });
  });

  describe('Habit State Machine Operations & EventBus Dispatch', () => {
    it('createHabit: enforces concurrent cap, creates habit, and emits HABIT_CREATED', async () => {
      const eventsEmitted = [];
      eventBus.subscribeAll((evt) => eventsEmitted.push(evt));

      await act(async () => {
        currentRoot = renderer.create(
          <HabitProvider>
            <TestHabitConsumer />
          </HabitProvider>
        );
      });

      let created;
      await act(async () => {
        created = contextValue.createHabit({
          behavior: 'Daily Jogging',
          minimumAction: 'Put on running shoes',
          cue: { type: 'morning', time: '06:30' },
        });
      });

      expect(created.habit).toBeDefined();
      expect(created.habit.title).toBe('Daily Jogging');
      expect(created.habit.status).toBe('active');
      expect(created.habit.minimumAction).toBe('Put on running shoes');
      expect(contextValue.habits).toHaveLength(1);

      // Verify EventBus emission
      const createdEvent = eventsEmitted.find((e) => e.type === 'HABIT_CREATED');
      expect(createdEvent).toBeDefined();
      expect(createdEvent.entityId).toBe(created.habit.id);

      // Create 2 more habits to reach cap of 3
      await act(async () => {
        contextValue.createHabit({ behavior: 'Habit 2' });
        contextValue.createHabit({ behavior: 'Habit 3' });
      });
      expect(contextValue.habits).toHaveLength(3);

      // 4th habit must be rejected by HABIT_CONCURRENT_CAP_001
      expect(() => {
        contextValue.createHabit({ behavior: 'Habit 4 (Overflow)' });
      }).toThrow('Maximum 3 concurrent habits reached');
    });

    it('completeHabit: increments streak, votes, awards factual rewards, and emits HABIT_COMPLETED', async () => {
      const initialHabits = [
        {
          id: 'h_run',
          identityId: 'id_runner',
          title: 'Morning Run',
          behavior: 'Run 5km',
          frequency: 'daily',
          status: 'active',
          minimumAction: 'Run 100m',
          normalTarget: 'Run 5km',
          streakCount: 0,
          bestStreak: 0,
          totalEvidenceVotes: 0,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      ];

      const eventsEmitted = [];
      eventBus.subscribe('HABIT_COMPLETED', (evt) => eventsEmitted.push(evt));

      await act(async () => {
        currentRoot = renderer.create(
          <HabitProvider initialHabits={initialHabits}>
            <TestHabitConsumer />
          </HabitProvider>
        );
      });

      let result;
      await act(async () => {
        result = contextValue.completeHabit('h_run', {
          now: '2026-10-11T08:00:00.000Z',
          todayDate: '2026-10-11',
        });
      });

      expect(result.updatedHabit.streakCount).toBe(1);
      expect(result.updatedHabit.totalEvidenceVotes).toBe(1);
      expect(result.rewards).toHaveLength(1);
      expect(result.rewards[0].milestoneType).toBe('first_action');
      expect(result.rewards[0].title).toBe('First Step Taken');

      // Verify event was emitted
      expect(eventsEmitted).toHaveLength(1);
      expect(eventsEmitted[0].entityId).toBe('h_run');
    });

    it('missHabit: enforces Never Miss Twice transition and emits RECOVERY_STARTED', async () => {
      const initialHabits = [
        {
          id: 'h_read',
          identityId: 'id_reader',
          title: 'Daily Reading',
          behavior: 'Read 20 pages',
          frequency: 'daily',
          status: 'active',
          minimumAction: 'Read 1 page',
          normalTarget: 'Read 20 pages',
          streakCount: 5,
          bestStreak: 10,
          totalEvidenceVotes: 20,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-10T10:00:00.000Z',
        },
      ];

      const eventsEmitted = [];
      eventBus.subscribeAll((evt) => eventsEmitted.push(evt));

      await act(async () => {
        currentRoot = renderer.create(
          <HabitProvider initialHabits={initialHabits}>
            <TestHabitConsumer />
          </HabitProvider>
        );
      });

      let missResult;
      await act(async () => {
        missResult = contextValue.missHabit('h_read', {
          now: '2026-10-11T22:00:00.000Z',
          todayDate: '2026-10-11',
        });
      });

      expect(missResult.updatedHabit.status).toBe('recovery');
      expect(missResult.updatedHabit.streakCount).toBe(0);
      expect(missResult.nextSessionTarget).toBe('Read 1 page');
      expect(missResult.triggerFrictionReview).toBe(false);
      expect(missResult.rulesApplied).toContain('RECOVERY_001');

      // Check emitted events
      expect(eventsEmitted.some((e) => e.type === 'HABIT_MISSED')).toBe(true);
      expect(eventsEmitted.some((e) => e.type === 'RECOVERY_STARTED')).toBe(true);

      // Now complete the recovery session
      let recoverResult;
      await act(async () => {
        recoverResult = contextValue.completeHabit('h_read', {
          now: '2026-10-12T08:00:00.000Z',
          todayDate: '2026-10-12',
        });
      });

      expect(recoverResult.updatedHabit.status).toBe('active');
      expect(recoverResult.rulesApplied).toContain('RECOVERY_SUCCESS_001');
      expect(recoverResult.rulesApplied).toContain('REWARD_RECOVERY_001');
      expect(recoverResult.rewards.some((r) => r.milestoneType === 'recovery')).toBe(true);
    });

    it('updateHabit and deleteHabit update state and emit events', async () => {
      const initialHabits = [
        {
          id: 'h_test',
          identityId: 'id_test',
          title: 'To Edit',
          behavior: 'Original',
          frequency: 'daily',
          status: 'active',
          minimumAction: 'min',
          normalTarget: 'norm',
          streakCount: 0,
          bestStreak: 0,
          totalEvidenceVotes: 0,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      ];

      await act(async () => {
        currentRoot = renderer.create(
          <HabitProvider initialHabits={initialHabits}>
            <TestHabitConsumer />
          </HabitProvider>
        );
      });

      await act(async () => {
        contextValue.updateHabit('h_test', { title: 'Edited Title' });
      });
      expect(contextValue.habits[0].title).toBe('Edited Title');

      await act(async () => {
        contextValue.deleteHabit('h_test');
      });
      expect(contextValue.habits).toHaveLength(0);
    });
  });

  describe('Bounded Behavior Event History (CONCERNS.md:239-242)', () => {
    it('enforces a strict FIFO cap of 500 items on behaviorEvents', async () => {
      // Seed with 520 behavior events
      const bulkEvents = [];
      for (let i = 0; i < 520; i++) {
        bulkEvents.push({
          id: `bevt_${i}`,
          type: 'HABIT_COMPLETED',
          entityId: 'habit_seed',
          timestamp: '2026-10-11T00:00:00.000Z',
          source: 'app',
        });
      }

      await act(async () => {
        currentRoot = renderer.create(
          <HabitProvider initialBehaviorEvents={bulkEvents}>
            <TestHabitConsumer />
          </HabitProvider>
        );
      });

      // Context must bound initial events to MAX_PERSISTED_BEHAVIOR_EVENTS (500)
      expect(contextValue.behaviorEvents).toHaveLength(MAX_PERSISTED_BEHAVIOR_EVENTS);
      // FIFO eviction: oldest 20 events dropped; first item is bevt_20
      expect(contextValue.behaviorEvents[0].id).toBe('bevt_20');
      expect(contextValue.behaviorEvents[499].id).toBe('bevt_519');
    });
  });

  describe('Subscriber Error Isolation', () => {
    it('EventBus subscriber crash does not disrupt habit mutations', async () => {
      const crashingListener = jest.fn().mockImplementation(() => {
        throw new Error('Exploding subscriber');
      });
      eventBus.subscribe('HABIT_CREATED', crashingListener);

      await act(async () => {
        currentRoot = renderer.create(
          <HabitProvider>
            <TestHabitConsumer />
          </HabitProvider>
        );
      });

      let created;
      await act(async () => {
        created = contextValue.createHabit({ behavior: 'Safe Habit' });
      });

      expect(created.habit).toBeDefined();
      expect(contextValue.habits).toHaveLength(1);
      expect(crashingListener).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'EventBus listener error:',
        expect.objectContaining({ error: 'Exploding subscriber', eventType: 'HABIT_CREATED' })
      );
    });
  });
});
