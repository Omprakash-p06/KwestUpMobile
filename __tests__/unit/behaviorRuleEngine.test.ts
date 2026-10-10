/**
 * Unit Test Suite: Behavioral Rule Engine & Pure Logic Engines
 *
 * Requirements Covered: [BEH-01]
 * Codebase Alignment: TESTING.md, CONVENTIONS.md, CONCERNS.md
 */

import {
  evaluateCondition,
  getNestedValue,
  loadMachineRules,
  evaluateRules,
} from '../../src/behavior/ruleEngine';
import {
  generateEntityId,
  validateHabitCreation,
  generateMinimumAction,
  compileHabitPlan,
  completeHabit,
  evaluateProgression,
} from '../../src/behavior/habitEngine';
import { validateCue, linkHabitStack } from '../../src/behavior/cueEngine';
import {
  evaluateRecoveryTransition,
  handleRecoveryCompletion,
  checkOverloadRisk,
} from '../../src/behavior/recoveryEngine';
import { evaluateRewards } from '../../src/behavior/rewardEngine';
import {
  calculateRollingConsistency,
  calculateCurrentStreak,
  calculateAutomaticityScore,
} from '../../src/behavior/improvementEngine';
import { Habit, BehaviorEvent } from '../../src/behavior/types';

describe('behaviorRuleEngine', () => {
  const fixedNow = '2026-10-11T12:00:00.000Z';
  const fixedToday = '2026-10-11';
  const fixedClock = { now: fixedNow, todayDate: fixedToday };

  const sampleHabit: Habit = {
    id: 'habit_test_1',
    identityId: 'id_writer_1',
    title: 'Daily Writing',
    behavior: 'Write 500 words',
    frequency: 'daily',
    status: 'active',
    minimumAction: 'Write 1 sentence',
    normalTarget: 'Write 500 words',
    stretchTarget: 'Write 1,000 words',
    streakCount: 5,
    bestStreak: 10,
    totalEvidenceVotes: 25,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  };

  describe('Rule Engine Core (ruleEngine.ts)', () => {
    it('evaluates null conditions correctly', () => {
      expect(evaluateCondition(null, null)).toBe(true);
      expect(evaluateCondition(null, undefined)).toBe(true);
      expect(evaluateCondition(null, 'defined-value')).toBe(false);
    });

    it('evaluates array membership conditions', () => {
      expect(evaluateCondition([7, 21, 66], 7)).toBe(true);
      expect(evaluateCondition([7, 21, 66], 21)).toBe(true);
      expect(evaluateCondition([7, 21, 66], 66)).toBe(true);
      expect(evaluateCondition([7, 21, 66], 14)).toBe(false);
    });

    it('evaluates comparison operators correctly', () => {
      expect(evaluateCondition('>=3', 3)).toBe(true);
      expect(evaluateCondition('>=3', 4)).toBe(true);
      expect(evaluateCondition('>=3', 2)).toBe(false);

      expect(evaluateCondition('<0.80', 0.79)).toBe(true);
      expect(evaluateCondition('<0.80', 0.80)).toBe(false);

      expect(evaluateCondition('>0.40', 0.45)).toBe(true);
      expect(evaluateCondition('>0.40', 0.40)).toBe(false);

      expect(evaluateCondition('<90', 45)).toBe(true);
      expect(evaluateCondition('<90', 95)).toBe(false);
    });

    it('resolves nested object paths with getNestedValue', () => {
      const context = {
        habit: {
          missedConsecutively: 2,
          streakCount: 5,
          cue: { type: 'time' },
        },
        simpleKey: 'val',
      };

      expect(getNestedValue(context, 'simpleKey')).toBe('val');
      expect(getNestedValue(context, 'habit.missedConsecutively')).toBe(2);
      expect(getNestedValue(context, 'habit.cue.type')).toBe('time');
      expect(getNestedValue(context, 'nonexistent.path')).toBeUndefined();
    });

    it('loads machine rules across categories', () => {
      const habitRules = loadMachineRules('habit');
      expect(habitRules.length).toBeGreaterThanOrEqual(5);

      const recoveryRules = loadMachineRules('recovery');
      expect(recoveryRules.length).toBeGreaterThanOrEqual(4);

      const rewardRules = loadMachineRules('reward');
      expect(rewardRules.length).toBeGreaterThanOrEqual(4);

      const allRules = loadMachineRules('all');
      expect(allRules.length).toBeGreaterThan(15);
    });

    it('sorts matched rules by priority and extracts rejections', () => {
      const rules = loadMachineRules('habit');
      const result = evaluateRules(rules, {
        action: 'CREATE_HABIT',
        activeHabitCount: 3,
      });

      expect(result.rulesApplied).toContain('HABIT_CONCURRENT_CAP_001');
      expect(result.rejected).toBeDefined();
      expect(result.rejected?.ruleId).toBe('HABIT_CONCURRENT_CAP_001');
      expect(result.rejected?.reason).toContain('Maximum 3 concurrent habits reached');
    });
  });

  describe('Habit Engine (habitEngine.ts)', () => {
    it('CONCERNS.md:19-24: generates 1,000 unique entity IDs without collisions', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateEntityId('test'));
      }
      expect(ids.size).toBe(1000);
      for (const id of ids) {
        expect(id).toMatch(/^test_\d+_[a-z0-9]+$/);
      }
    });

    it('HABIT_CONCURRENT_CAP_001: rejects habit creation when 3 active habits exist', () => {
      const activeHabits: Habit[] = [
        { ...sampleHabit, id: 'h1', status: 'active' },
        { ...sampleHabit, id: 'h2', status: 'recovery' },
        { ...sampleHabit, id: 'h3', status: 'active' },
      ];

      const check = validateHabitCreation({}, activeHabits);
      expect(check.valid).toBe(false);
      expect(check.rulesApplied).toContain('HABIT_CONCURRENT_CAP_001');
      expect(check.reason).toContain('Maximum 3 concurrent habits');

      // Paused and archived habits do not count toward cap
      const mixedHabits: Habit[] = [
        { ...sampleHabit, id: 'h1', status: 'active' },
        { ...sampleHabit, id: 'h2', status: 'paused' },
        { ...sampleHabit, id: 'h3', status: 'archived' },
      ];
      const mixedCheck = validateHabitCreation({}, mixedHabits);
      expect(mixedCheck.valid).toBe(true);
    });

    it('MINIMUM_ACTION_001: generates 2-minute minimum action if missing', () => {
      const withMissing = generateMinimumAction('study algorithms');
      expect(withMissing.rulesApplied).toContain('MINIMUM_ACTION_001');
      expect(withMissing.minimumAction).toContain('2-minute version: start study algorithms');

      const withProvided = generateMinimumAction('study algorithms', 'solve 1 easy problem');
      expect(withProvided.minimumAction).toBe('solve 1 easy problem');
    });

    it('compileHabitPlan: creates complete plan and applies rule trace', () => {
      const result = compileHabitPlan({
        behavior: 'workout',
        minimumAction: '5 pushups',
        identity: 'disciplined athlete',
        cue: { type: 'time', time: '07:00' },
      });

      expect(result.valid).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan?.behavior.minimum).toBe('5 pushups');
      expect(result.plan?.identity.statement).toBe('disciplined athlete');
      expect(result.rulesApplied.length).toBeGreaterThan(0);
    });

    it('completeHabit: increments votes and streak; is idempotent on same day', () => {
      const { updatedHabit, completedToday, rulesApplied } = completeHabit(sampleHabit, fixedClock);

      expect(completedToday).toBe(true);
      expect(updatedHabit.streakCount).toBe(6);
      expect(updatedHabit.bestStreak).toBe(10);
      expect(updatedHabit.totalEvidenceVotes).toBe(26);
      expect(updatedHabit.lastCompletedDate).toBe(fixedToday);
      expect(rulesApplied).toContain('HABIT_COMPLETED');

      // Second completion on same day is idempotent
      const secondCall = completeHabit(updatedHabit, fixedClock);
      expect(secondCall.completedToday).toBe(false);
      expect(secondCall.updatedHabit.streakCount).toBe(6);
    });

    it('HABIT_PROGRESSION_001: rejects harder difficulty when consistency is below 80%', () => {
      const lowConsistency = evaluateProgression(sampleHabit, 0.75);
      expect(lowConsistency.allowed).toBe(false);
      expect(lowConsistency.rulesApplied).toContain('HABIT_PROGRESSION_001');
      expect(lowConsistency.reason).toContain('below 80%');

      const highConsistency = evaluateProgression(sampleHabit, 0.85);
      expect(highConsistency.allowed).toBe(true);
    });
  });

  describe('Cue Engine (cueEngine.ts)', () => {
    it('CUE_MANDATORY_001: rejects invalid or missing cues', () => {
      expect(validateCue(null).valid).toBe(false);
      expect(validateCue({}).valid).toBe(false);
      expect(validateCue({ type: 'time' }).valid).toBe(true);
      expect(validateCue({ type: 'manual' }).valid).toBe(true);
      expect(validateCue({ type: 'invalid-type' as any }).valid).toBe(false);
    });

    it('CUE_STACK_002: links habits in habit stack with immediately-after relation', () => {
      const anchor = { ...sampleHabit, id: 'anchor_1' };
      const target = { ...sampleHabit, id: 'target_1' };

      const { habitStack, rulesApplied } = linkHabitStack(anchor, target);
      expect(habitStack.anchorHabitId).toBe('anchor_1');
      expect(habitStack.targetHabitId).toBe('target_1');
      expect(habitStack.relationship).toBe('immediately-after');
      expect(rulesApplied).toContain('CUE_STACK_002');
    });
  });

  describe('Recovery Engine (recoveryEngine.ts)', () => {
    it('RECOVERY_001: first miss transitions to recovery status and scales to minimum action', () => {
      const result = evaluateRecoveryTransition(sampleHabit, 1, fixedClock);

      expect(result.updatedHabit.status).toBe('recovery');
      expect(result.updatedHabit.streakCount).toBe(0);
      expect(result.nextSessionTarget).toBe(sampleHabit.minimumAction);
      expect(result.triggerFrictionReview).toBe(false);
      expect(result.prompt).toContain('Never miss twice: 2-minute version ready.');
      expect(result.rulesApplied).toContain('RECOVERY_001');
    });

    it('RECOVERY_CONSECUTIVE_MISS_002: second consecutive miss triggers friction review', () => {
      const result = evaluateRecoveryTransition(sampleHabit, 2, fixedClock);

      expect(result.updatedHabit.status).toBe('recovery');
      expect(result.triggerFrictionReview).toBe(true);
      expect(result.offerAction).toBe('RESCALE_OR_CHANGE_CUE');
      expect(result.prompt).toContain('review habit friction');
      expect(result.rulesApplied).toContain('RECOVERY_CONSECUTIVE_MISS_002');
    });

    it('RECOVERY_SUCCESS_001: completing habit while in recovery restores active status', () => {
      const recoveryHabit: Habit = { ...sampleHabit, status: 'recovery' };
      const { updatedHabit, restored, awardedMilestone, rulesApplied } = handleRecoveryCompletion(
        recoveryHabit,
        fixedClock
      );

      expect(restored).toBe(true);
      expect(updatedHabit.status).toBe('active');
      expect(awardedMilestone).toBe('recovery');
      expect(rulesApplied).toContain('RECOVERY_SUCCESS_001');
    });

    it('OVERLOAD_TRIGGER_001: detects anti-burnout overload conditions', () => {
      const safe = checkOverloadRisk(2, 0.2, 1);
      expect(safe.overloaded).toBe(false);

      const overloaded = checkOverloadRisk(3, 0.5, 3);
      expect(overloaded.overloaded).toBe(true);
      expect(overloaded.rulesApplied).toContain('OVERLOAD_TRIGGER_001');
      expect(overloaded.recommendation).toContain('pause habit with lowest streak');
    });
  });

  describe('Reward Engine (rewardEngine.ts)', () => {
    it('REWARD_ANTI_GAMIFICATION_001: rejects arbitrary XP and points', () => {
      const result = evaluateRewards({
        habit: sampleHabit,
        event: 'HABIT_COMPLETED',
        requestedType: 'points_or_xp',
        options: fixedClock,
      });

      expect(result.rewards.length).toBe(0);
      expect(result.rejected).toBeDefined();
      expect(result.rejected?.ruleId).toBe('REWARD_ANTI_GAMIFICATION_001');
    });

    it('REWARD_FIRST_ACTION_001: awards milestone upon first completion', () => {
      const firstTimeHabit: Habit = { ...sampleHabit, totalEvidenceVotes: 1 };
      const result = evaluateRewards({
        habit: firstTimeHabit,
        event: 'HABIT_COMPLETED',
        options: fixedClock,
      });

      expect(result.rewards.length).toBe(1);
      expect(result.rewards[0].milestoneType).toBe('first_action');
      expect(result.rewards[0].title).toBe('First Step Taken');
      expect(result.rulesApplied).toContain('REWARD_FIRST_ACTION_001');
    });

    it('REWARD_RECOVERY_001: awards milestone when completed after a miss', () => {
      const result = evaluateRewards({
        habit: sampleHabit,
        event: 'HABIT_COMPLETED',
        previousEvent: 'HABIT_MISSED',
        options: fixedClock,
      });

      const recoveryReward = result.rewards.find((r) => r.milestoneType === 'recovery');
      expect(recoveryReward).toBeDefined();
      expect(recoveryReward?.title).toBe('Bounced Back');
      expect(result.rulesApplied).toContain('REWARD_RECOVERY_001');
    });

    it('REWARD_CONSISTENCY_001: awards milestones on days 7, 21, and 66', () => {
      const habit7: Habit = { ...sampleHabit, streakCount: 7 };
      const result7 = evaluateRewards({
        habit: habit7,
        event: 'HABIT_COMPLETED',
        options: fixedClock,
      });
      expect(result7.rewards.some((r) => r.milestoneType === 'consistency')).toBe(true);

      const habit10: Habit = { ...sampleHabit, streakCount: 10 };
      const result10 = evaluateRewards({
        habit: habit10,
        event: 'HABIT_COMPLETED',
        options: fixedClock,
      });
      expect(result10.rewards.some((r) => r.milestoneType === 'consistency')).toBe(false);
    });
  });

  describe('Improvement Engine (improvementEngine.ts)', () => {
    it('computes rolling 14-day consistency correctly', () => {
      const habitId = 'habit_dsa';
      const events: BehaviorEvent[] = [
        { id: 'e1', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-11T08:00:00.000Z', source: 'app' },
        { id: 'e2', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-10T08:00:00.000Z', source: 'app' },
        { id: 'e3', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-09T08:00:00.000Z', source: 'app' },
        { id: 'e4', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-08T08:00:00.000Z', source: 'app' },
        { id: 'e5', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-07T08:00:00.000Z', source: 'app' },
        { id: 'e6', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-06T08:00:00.000Z', source: 'app' },
        { id: 'e7', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-05T08:00:00.000Z', source: 'app' },
      ];

      // 7 completions in 14 days = 0.50
      const consistency = calculateRollingConsistency(events, habitId, 14, fixedClock);
      expect(consistency).toBe(0.5);

      // Empty events = 0.00
      expect(calculateRollingConsistency([], habitId, 14, fixedClock)).toBe(0);
    });

    it('computes current streak consecutively backwards', () => {
      const habitId = 'habit_run';
      const events: BehaviorEvent[] = [
        { id: 'e1', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-11T08:00:00.000Z', source: 'app' },
        { id: 'e2', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-10T08:00:00.000Z', source: 'app' },
        { id: 'e3', type: 'HABIT_COMPLETED', entityId: habitId, timestamp: '2026-10-09T08:00:00.000Z', source: 'app' },
      ];

      const streak = calculateCurrentStreak(events, habitId, fixedClock);
      expect(streak).toBe(3);
    });

    it('computes automaticity score clamped to 0–100', () => {
      const lowHabit: Habit = { ...sampleHabit, streakCount: 2, totalEvidenceVotes: 4 };
      const lowScore = calculateAutomaticityScore(lowHabit, 0.4);
      expect(lowScore).toBeGreaterThanOrEqual(0);
      expect(lowScore).toBeLessThan(50);

      const masterHabit: Habit = { ...sampleHabit, streakCount: 30, totalEvidenceVotes: 70 };
      const highScore = calculateAutomaticityScore(masterHabit, 0.95);
      expect(highScore).toBeGreaterThanOrEqual(80);
      expect(highScore).toBeLessThanOrEqual(100);
    });
  });
});
