/**
 * KwestUp 4.0 — Habit Domain Context & State Provider
 *
 * Implements isolated versioned persistence (kwestup_habits_v1,
 * kwestup_behavior_events_v1), "Never Miss Twice" recovery state machine,
 * bounded behavior event history, and EventBus telemetry dispatch.
 *
 * Source: rulebook/machine/*.json, 4.0/KwestUp_4.0_Master_Plan.md §5, §19
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateEntityId,
  validateHabitCreation,
  compileHabitPlan,
  completeHabit as completeHabitEngine,
} from '../behavior/habitEngine';
import {
  evaluateRecoveryTransition,
  handleRecoveryCompletion,
  checkOverloadRisk,
} from '../behavior/recoveryEngine';
import { evaluateRewards } from '../behavior/rewardEngine';
import {
  calculateRollingConsistency,
  calculateCurrentStreak,
  calculateAutomaticityScore,
} from '../behavior/improvementEngine';
import { eventBus } from '../behavior/eventBus';
import { logger } from '../utils/logger';
import { getLocalDateString } from '../utils/dateUtils';

export const HABITS_STORAGE_KEY = 'kwestup_habits_v1';
export const BEHAVIOR_EVENTS_STORAGE_KEY = 'kwestup_behavior_events_v1';
export const IDENTITIES_STORAGE_KEY = 'kwestup_identities_v1';
export const REWARDS_STORAGE_KEY = 'kwestup_rewards_v1';
export const MAX_PERSISTED_BEHAVIOR_EVENTS = 500;

const DEFAULT_HABITS = [];
const DEFAULT_IDENTITIES = [];
const DEFAULT_BEHAVIOR_EVENTS = [];
const DEFAULT_REWARDS = [];

const HabitContext = createContext(null);

export const HabitProvider = ({
  children,
  initialHabits = DEFAULT_HABITS,
  initialIdentities = DEFAULT_IDENTITIES,
  initialBehaviorEvents = DEFAULT_BEHAVIOR_EVENTS,
  initialRewards = DEFAULT_REWARDS,
  persistDebounceMs = 400,
}) => {
  const [habits, setHabits] = useState(initialHabits);
  const [identities, setIdentities] = useState(initialIdentities);
  const [behaviorEvents, setBehaviorEvents] = useState(initialBehaviorEvents);
  const [rewards, setRewards] = useState(initialRewards);
  const [isHydrated, setIsHydrated] = useState(false);

  const storageWriteTimerRef = useRef(null);
  const lastPersistedJsonRef = useRef(null);

  // 1. Initial Storage Hydration
  useEffect(() => {
    let isMounted = true;

    const hydrateFromStorage = async () => {
      try {
        const [storedHabits, storedIdentities, storedEvents, storedRewards] = await Promise.all([
          AsyncStorage.getItem(HABITS_STORAGE_KEY),
          AsyncStorage.getItem(IDENTITIES_STORAGE_KEY),
          AsyncStorage.getItem(BEHAVIOR_EVENTS_STORAGE_KEY),
          AsyncStorage.getItem(REWARDS_STORAGE_KEY),
        ]);

        if (!isMounted) return;

        if (storedHabits) {
          const parsed = JSON.parse(storedHabits);
          if (Array.isArray(parsed)) setHabits(parsed);
        }
        if (storedIdentities) {
          const parsed = JSON.parse(storedIdentities);
          if (Array.isArray(parsed)) setIdentities(parsed);
        }
        if (storedEvents) {
          const parsed = JSON.parse(storedEvents);
          if (Array.isArray(parsed)) {
            // Apply bounded FIFO limit to loaded events
            setBehaviorEvents(parsed.slice(-MAX_PERSISTED_BEHAVIOR_EVENTS));
          }
        }
        if (storedRewards) {
          const parsed = JSON.parse(storedRewards);
          if (Array.isArray(parsed)) setRewards(parsed);
        }

        setIsHydrated(true);
      } catch (err) {
        logger.error('❌ Failed to hydrate habit state from storage:', err);
        if (isMounted) setIsHydrated(true);
      }
    };

    hydrateFromStorage();

    return () => {
      isMounted = false;
      if (storageWriteTimerRef.current) {
        clearTimeout(storageWriteTimerRef.current);
      }
    };
  }, []);

  // Synchronize when initial props change (e.g. tests or external reset)
  useEffect(() => {
    if (Array.isArray(initialHabits) && initialHabits.length > 0) {
      setHabits(initialHabits);
    }
  }, [initialHabits]);

  useEffect(() => {
    if (Array.isArray(initialIdentities) && initialIdentities.length > 0) {
      setIdentities(initialIdentities);
    }
  }, [initialIdentities]);

  useEffect(() => {
    if (Array.isArray(initialBehaviorEvents) && initialBehaviorEvents.length > 0) {
      setBehaviorEvents(initialBehaviorEvents.slice(-MAX_PERSISTED_BEHAVIOR_EVENTS));
    }
  }, [initialBehaviorEvents]);

  useEffect(() => {
    if (Array.isArray(initialRewards) && initialRewards.length > 0) {
      setRewards(initialRewards);
    }
  }, [initialRewards]);

  // 2. Debounced Write-Through Persistence to Isolated Versioned Keys
  const persistState = useCallback(async (snapshot) => {
    try {
      // Enforce FIFO cap on behavior events before writing to storage
      const boundedEvents = (snapshot.behaviorEvents || []).slice(-MAX_PERSISTED_BEHAVIOR_EVENTS);

      await Promise.all([
        AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(snapshot.habits || [])),
        AsyncStorage.setItem(IDENTITIES_STORAGE_KEY, JSON.stringify(snapshot.identities || [])),
        AsyncStorage.setItem(BEHAVIOR_EVENTS_STORAGE_KEY, JSON.stringify(boundedEvents)),
        AsyncStorage.setItem(REWARDS_STORAGE_KEY, JSON.stringify(snapshot.rewards || [])),
      ]);

      lastPersistedJsonRef.current = JSON.stringify(snapshot);
      logger.debug('💾 Persisted habit domain state to isolated storage keys');
    } catch (err) {
      logger.error('❌ Failed to persist habit domain state:', err);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const snapshot = { habits, identities, behaviorEvents, rewards };
    const snapshotJson = JSON.stringify(snapshot);

    if (snapshotJson === lastPersistedJsonRef.current) return;

    if (storageWriteTimerRef.current) {
      clearTimeout(storageWriteTimerRef.current);
    }

    storageWriteTimerRef.current = setTimeout(() => {
      persistState(snapshot);
    }, persistDebounceMs);

    return () => {
      if (storageWriteTimerRef.current) {
        clearTimeout(storageWriteTimerRef.current);
      }
    };
  }, [habits, identities, behaviorEvents, rewards, isHydrated, persistDebounceMs, persistState]);

  // Helper to append a behavior event with FIFO cap
  const appendBehaviorEvent = useCallback((event) => {
    setBehaviorEvents((prev) => {
      const updated = [...prev, event];
      return updated.length > MAX_PERSISTED_BEHAVIOR_EVENTS
        ? updated.slice(-MAX_PERSISTED_BEHAVIOR_EVENTS)
        : updated;
    });
  }, []);

  // 3. Domain State Actions

  /**
   * Create a new habit enforcing concurrent caps and compiling Atomic Habits schema
   */
  const createHabit = useCallback(
    (input) => {
      const validation = validateHabitCreation(input, habits);
      if (!validation.valid) {
        throw new Error(validation.reason || 'Habit creation rejected by rulebook policy');
      }

      const compilation = compileHabitPlan(input, habits);
      if (!compilation.valid || !compilation.plan) {
        throw new Error(compilation.reason || 'Failed to compile habit plan');
      }

      const now = new Date().toISOString();
      const habitId = generateEntityId('habit');
      const identityId = input.identityId || generateEntityId('identity');

      const newHabit = {
        id: habitId,
        identityId,
        title: input.title || input.behavior,
        behavior: input.behavior,
        frequency: input.frequency || 'daily',
        status: 'active',
        minimumAction: compilation.plan.behavior.minimum,
        normalTarget: compilation.plan.behavior.normal,
        stretchTarget: compilation.plan.behavior.stretch,
        streakCount: 0,
        bestStreak: 0,
        totalEvidenceVotes: 0,
        customSchedule: input.customSchedule,
        createdAt: now,
        updatedAt: now,
      };

      setHabits((prev) => [newHabit, ...prev]);

      const event = {
        id: generateEntityId('bevt'),
        type: 'HABIT_CREATED',
        entityId: habitId,
        timestamp: now,
        source: 'app',
        payload: {
          habitId,
          title: newHabit.title,
          rulesApplied: compilation.rulesApplied,
        },
      };

      appendBehaviorEvent(event);
      eventBus.emit(event);

      return { habit: newHabit, rulesApplied: compilation.rulesApplied };
    },
    [habits, appendBehaviorEvent]
  );

  /**
   * Update habit fields immutably
   */
  const updateHabit = useCallback(
    (id, patch) => {
      let updatedHabit = null;
      const now = new Date().toISOString();

      setHabits((prev) =>
        prev.map((h) => {
          if (h.id === id) {
            updatedHabit = { ...h, ...patch, updatedAt: now };
            return updatedHabit;
          }
          return h;
        })
      );

      if (updatedHabit) {
        const event = {
          id: generateEntityId('bevt'),
          type: 'HABIT_UPDATED',
          entityId: id,
          timestamp: now,
          source: 'app',
          payload: { habitId: id, patch },
        };
        appendBehaviorEvent(event);
        eventBus.emit(event);
      }

      return updatedHabit;
    },
    [appendBehaviorEvent]
  );

  /**
   * Delete a habit from state
   */
  const deleteHabit = useCallback(
    (id) => {
      setHabits((prev) => prev.filter((h) => h.id !== id));
      const now = new Date().toISOString();
      const event = {
        id: generateEntityId('bevt'),
        type: 'HABIT_UPDATED',
        entityId: id,
        timestamp: now,
        source: 'app',
        payload: { habitId: id, deleted: true },
      };
      appendBehaviorEvent(event);
      eventBus.emit(event);
    },
    [appendBehaviorEvent]
  );

  /**
   * Complete a habit session: updates streak, lifetime votes, recovery status, and awards factual rewards
   */
  const completeHabit = useCallback(
    (id, options = {}) => {
      const habit = habits.find((h) => h.id === id);
      if (!habit) {
        throw new Error(`Habit with ID ${id} not found`);
      }

      const wasInRecovery = habit.status === 'recovery';

      const previousSessionEvent = behaviorEvents
        .slice()
        .reverse()
        .find((e) => e.entityId === id && (e.type === 'HABIT_MISSED' || e.type === 'HABIT_COMPLETED'))?.type;

      // 1. Complete session via pure engine
      const completionResult = completeHabitEngine(habit, options);
      let updated = completionResult.updatedHabit;
      const rulesApplied = [...completionResult.rulesApplied];

      // 2. Restore active status if completing from recovery
      if (wasInRecovery) {
        const recoveryResult = handleRecoveryCompletion(habit, options);
        updated = {
          ...updated,
          status: 'active',
        };
        recoveryResult.rulesApplied.forEach((r) => {
          if (!rulesApplied.includes(r)) rulesApplied.push(r);
        });
      }

      // 3. Evaluate factual rewards
      const effectivePreviousEvent = wasInRecovery ? 'HABIT_MISSED' : previousSessionEvent;
      const rewardResult = evaluateRewards({
        habit: updated,
        event: 'HABIT_COMPLETED',
        previousEvent: effectivePreviousEvent,
        options,
      });
      rewardResult.rulesApplied.forEach((r) => {
        if (!rulesApplied.includes(r)) rulesApplied.push(r);
      });

      if (rewardResult.rewards && rewardResult.rewards.length > 0) {
        setRewards((prev) => [...rewardResult.rewards, ...prev]);
      }

      setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));

      const now = options.now || new Date().toISOString();
      const event = {
        id: generateEntityId('bevt'),
        type: 'HABIT_COMPLETED',
        entityId: id,
        timestamp: now,
        source: 'app',
        payload: {
          habitId: id,
          completedToday: completionResult.completedToday,
          streakCount: updated.streakCount,
          totalEvidenceVotes: updated.totalEvidenceVotes,
          rulesApplied,
        },
      };

      appendBehaviorEvent(event);
      eventBus.emit(event);

      return {
        updatedHabit: updated,
        rewards: rewardResult.rewards || [],
        completedToday: completionResult.completedToday,
        rulesApplied,
      };
    },
    [habits, behaviorEvents, appendBehaviorEvent]
  );

  /**
   * Record a missed habit session: enforces Never Miss Twice recovery state machine
   */
  const missHabit = useCallback(
    (id, options = {}) => {
      const habit = habits.find((h) => h.id === id);
      if (!habit) {
        throw new Error(`Habit with ID ${id} not found`);
      }

      // Determine consecutive misses
      const recentMisses = behaviorEvents
        .slice()
        .reverse()
        .filter((e) => e.entityId === id && (e.type === 'HABIT_MISSED' || e.type === 'HABIT_COMPLETED'));

      let consecutiveMisses = 1;
      for (const evt of recentMisses) {
        if (evt.type === 'HABIT_MISSED') {
          consecutiveMisses++;
        } else {
          break;
        }
      }

      const recoveryResult = evaluateRecoveryTransition(habit, consecutiveMisses, options);
      const updated = recoveryResult.updatedHabit;

      setHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));

      const now = options.now || new Date().toISOString();
      const missEvent = {
        id: generateEntityId('bevt'),
        type: 'HABIT_MISSED',
        entityId: id,
        timestamp: now,
        source: 'app',
        payload: {
          habitId: id,
          consecutiveMisses,
          rulesApplied: recoveryResult.rulesApplied,
        },
      };

      const recoveryEvent = {
        id: generateEntityId('bevt'),
        type: 'RECOVERY_STARTED',
        entityId: id,
        timestamp: now,
        source: 'app',
        payload: {
          habitId: id,
          nextSessionTarget: recoveryResult.nextSessionTarget,
          triggerFrictionReview: recoveryResult.triggerFrictionReview,
        },
      };

      appendBehaviorEvent(missEvent);
      appendBehaviorEvent(recoveryEvent);
      eventBus.emit(missEvent);
      eventBus.emit(recoveryEvent);

      return {
        updatedHabit: updated,
        nextSessionTarget: recoveryResult.nextSessionTarget,
        triggerFrictionReview: recoveryResult.triggerFrictionReview,
        prompt: recoveryResult.prompt,
        offerAction: recoveryResult.offerAction,
        rulesApplied: recoveryResult.rulesApplied,
      };
    },
    [habits, behaviorEvents, appendBehaviorEvent]
  );

  /**
   * Helper queries using pure improvement engine
   */
  const getHabitConsistency = useCallback(
    (id, days = 14) => {
      return calculateRollingConsistency(behaviorEvents, id, days);
    },
    [behaviorEvents]
  );

  const getHabitStreak = useCallback(
    (id) => {
      return calculateCurrentStreak(behaviorEvents, id);
    },
    [behaviorEvents]
  );

  const getHabitAutomaticity = useCallback(
    (id) => {
      const habit = habits.find((h) => h.id === id);
      if (!habit) return 0;
      const consistency = calculateRollingConsistency(behaviorEvents, id, 14);
      return calculateAutomaticityScore(habit, consistency);
    },
    [habits, behaviorEvents]
  );

  const checkOverload = useCallback(() => {
    const activeCount = habits.filter(
      (h) => h.status === 'active' || h.status === 'recovery'
    ).length;

    const sevenDayTotalEvents = behaviorEvents.filter(
      (e) => e.type === 'HABIT_COMPLETED' || e.type === 'HABIT_MISSED'
    );
    const sevenDayMissCount = sevenDayTotalEvents.filter((e) => e.type === 'HABIT_MISSED').length;
    const missRate =
      sevenDayTotalEvents.length > 0 ? sevenDayMissCount / sevenDayTotalEvents.length : 0;

    return checkOverloadRisk(activeCount, missRate, 3);
  }, [habits, behaviorEvents]);

  const value = {
    habits,
    identities,
    behaviorEvents,
    rewards,
    isHydrated,
    createHabit,
    updateHabit,
    deleteHabit,
    completeHabit,
    missHabit,
    getHabitConsistency,
    getHabitStreak,
    getHabitAutomaticity,
    checkOverload,
  };

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>;
};

export const useHabits = () => {
  const context = useContext(HabitContext);
  if (!context) {
    throw new Error('useHabits must be used within a HabitProvider');
  }
  return context;
};

export default {
  HabitProvider,
  useHabits,
  HABITS_STORAGE_KEY,
  BEHAVIOR_EVENTS_STORAGE_KEY,
  IDENTITIES_STORAGE_KEY,
  REWARDS_STORAGE_KEY,
  MAX_PERSISTED_BEHAVIOR_EVENTS,
};
