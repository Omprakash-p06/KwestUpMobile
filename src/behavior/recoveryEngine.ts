/**
 * KwestUp 4.0 — Pure Recovery & Friction Engine
 *
 * Implements "Never Miss Twice" state machine, friction review triggers,
 * and anti-burnout overload protection.
 *
 * Source: rulebook/machine/recoveryRules.json, 4.0/KwestUp_4.0_Master_Plan.md §12
 */

import { Habit, TimeOptions } from './types';
import { evaluateRules, loadMachineRules } from './ruleEngine';

/**
 * Evaluates recovery state transitions when a habit miss occurs (RECOVERY_001, RECOVERY_CONSECUTIVE_MISS_002)
 */
export function evaluateRecoveryTransition(
  habit: Habit,
  consecutiveMisses: number,
  options: TimeOptions = {}
): {
  updatedHabit: Habit;
  nextSessionTarget: string;
  rulesApplied: string[];
  triggerFrictionReview: boolean;
  prompt?: string;
  offerAction?: string;
} {
  const now = options.now || new Date().toISOString();
  const rules = loadMachineRules('recovery');

  const result = evaluateRules(rules, {
    event: 'HABIT_MISSED',
    'habit.missedConsecutively': consecutiveMisses,
    'habit.status': habit.status,
  });

  const triggerFrictionReview = consecutiveMisses >= 2;
  const isFirstMiss = consecutiveMisses === 1;

  let prompt: string | undefined;
  let offerAction: string | undefined;
  let nextSessionTarget = habit.normalTarget;

  if (isFirstMiss) {
    prompt = 'Never miss twice: 2-minute version ready.';
    nextSessionTarget = habit.minimumAction;
  } else if (triggerFrictionReview) {
    prompt = 'Second consecutive miss: review habit friction before resuming.';
    offerAction = 'RESCALE_OR_CHANGE_CUE';
    nextSessionTarget = habit.minimumAction;
  }

  const updatedHabit: Habit = {
    ...habit,
    status: 'recovery',
    streakCount: 0, // Reset streak counter on miss (votes are retained)
    updatedAt: now,
  };

  return {
    updatedHabit,
    nextSessionTarget,
    rulesApplied: result.rulesApplied,
    triggerFrictionReview,
    prompt,
    offerAction,
  };
}

/**
 * Handles habit completion when in recovery status, restoring active state (RECOVERY_SUCCESS_001)
 */
export function handleRecoveryCompletion(
  habit: Habit,
  options: TimeOptions = {}
): { updatedHabit: Habit; restored: boolean; awardedMilestone?: string; rulesApplied: string[] } {
  const now = options.now || new Date().toISOString();
  const rules = loadMachineRules('recovery');

  const result = evaluateRules(rules, {
    event: 'HABIT_COMPLETED',
    'habit.status': habit.status,
  });

  if (habit.status === 'recovery') {
    const updatedHabit: Habit = {
      ...habit,
      status: 'active',
      updatedAt: now,
    };

    return {
      updatedHabit,
      restored: true,
      awardedMilestone: 'recovery',
      rulesApplied: result.rulesApplied,
    };
  }

  return {
    updatedHabit: habit,
    restored: false,
    rulesApplied: result.rulesApplied,
  };
}

/**
 * Anti-burnout overload protection check (OVERLOAD_TRIGGER_001)
 */
export function checkOverloadRisk(
  activeHabitCount: number,
  sevenDayMissRate: number,
  consecutiveDaysInCondition: number
): { overloaded: boolean; recommendation?: string; rulesApplied: string[] } {
  const rules = loadMachineRules('recovery');
  const result = evaluateRules(rules, {
    activeHabits: activeHabitCount,
    sevenDayMissRate,
    consecutiveDaysInCondition,
  });

  const isOverloaded = result.rulesApplied.includes('OVERLOAD_TRIGGER_001');

  if (isOverloaded) {
    return {
      overloaded: true,
      recommendation: 'Anti-burnout overload protection: pause habit with lowest streak to consolidate.',
      rulesApplied: result.rulesApplied,
    };
  }

  return {
    overloaded: false,
    rulesApplied: result.rulesApplied,
  };
}

export default {
  evaluateRecoveryTransition,
  handleRecoveryCompletion,
  checkOverloadRisk,
};
