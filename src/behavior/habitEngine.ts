/**
 * KwestUp 4.0 — Pure Habit Engine
 *
 * Implements habit lifecycle, 2-minute minimum action, difficulty progression,
 * and Atomic Habits invariants.
 *
 * Source: rulebook/machine/habitRules.json, 4.0/KwestUp_4.0_Master_Plan.md §5, §11
 */

import {
  Habit,
  CompiledHabitPlan,
  Cue,
  TimeOptions,
} from './types';
import { evaluateRules, loadMachineRules } from './ruleEngine';
import { getLocalDateString } from '../utils/dateUtils';

/**
 * Generates an entity ID using monotonic timestamp and random entropy (CONCERNS.md:19-24)
 */
export function generateEntityId(prefix: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Validates habit creation against machine rules (HABIT_CONCURRENT_CAP_001)
 */
export function validateHabitCreation(
  habitInput: Partial<Habit>,
  activeHabits: Habit[] = []
): { valid: boolean; reason?: string; rulesApplied: string[] } {
  const activeCount = activeHabits.filter(
    (h) => h.status === 'active' || h.status === 'recovery'
  ).length;

  const rules = loadMachineRules('habit');
  const result = evaluateRules(rules, {
    action: 'CREATE_HABIT',
    activeHabitCount: activeCount,
  });

  if (result.rejected) {
    return {
      valid: false,
      reason: result.rejected.reason,
      rulesApplied: result.rulesApplied,
    };
  }

  return {
    valid: true,
    rulesApplied: result.rulesApplied,
  };
}

/**
 * Generates an achievable minimum action taking <120 seconds (MINIMUM_ACTION_001)
 */
export function generateMinimumAction(
  behaviorText: string,
  providedAction?: string
): { minimumAction: string; rulesApplied: string[] } {
  const rules = loadMachineRules('habit');
  const result = evaluateRules(rules, {
    action: 'COMPILE_HABIT',
    minimumAction: providedAction && providedAction.trim().length > 0 ? providedAction : null,
  });

  if (providedAction && providedAction.trim().length > 0) {
    return {
      minimumAction: providedAction.trim(),
      rulesApplied: result.rulesApplied,
    };
  }

  const cleanBehavior = (behaviorText || 'behavior').trim();
  const generatedAction = `2-minute version: start ${cleanBehavior}`;

  return {
    minimumAction: generatedAction,
    rulesApplied: ['MINIMUM_ACTION_001', ...result.rulesApplied.filter((r) => r !== 'MINIMUM_ACTION_001')],
  };
}

/**
 * Compiles natural or structured habit input into a verified Atomic Habits plan
 */
export function compileHabitPlan(
  input: {
    identity?: string;
    behavior: string;
    minimumAction?: string;
    normalTarget?: string;
    stretchTarget?: string;
    cue?: Partial<Cue>;
  },
  activeHabits: Habit[] = []
): { plan?: CompiledHabitPlan; valid: boolean; reason?: string; rulesApplied: string[] } {
  const allRules = loadMachineRules('habit');
  const rulesAppliedSet = new Set<string>();

  // 1. Check concurrent cap
  const creationCheck = validateHabitCreation({}, activeHabits);
  creationCheck.rulesApplied.forEach((r) => rulesAppliedSet.add(r));

  if (!creationCheck.valid) {
    return {
      valid: false,
      reason: creationCheck.reason,
      rulesApplied: Array.from(rulesAppliedSet),
    };
  }

  // 2. Minimum action
  const minActionResult = generateMinimumAction(input.behavior, input.minimumAction);
  minActionResult.rulesApplied.forEach((r) => rulesAppliedSet.add(r));

  // 3. Identity statement
  const identityStatement = input.identity?.trim() || `consistent ${input.behavior || 'practitioner'}`;
  if (!input.identity) {
    rulesAppliedSet.add('HABIT_IDENTITY_001');
  }

  // 4. Cue evaluation
  const cueType = input.cue?.type || 'manual';
  if (!input.cue || !input.cue.type) {
    rulesAppliedSet.add('CUE_MANDATORY_001');
  }
  if (cueType === 'after-habit') {
    rulesAppliedSet.add('CUE_STACK_002');
  }

  const evalResult = evaluateRules(allRules, {
    action: 'COMPILE_HABIT',
    minimumAction: input.minimumAction || null,
    cue: input.cue || null,
    'cue.type': cueType,
    identityStatement: input.identity || null,
  });
  evalResult.rulesApplied.forEach((r) => rulesAppliedSet.add(r));

  const plan: CompiledHabitPlan = {
    identity: {
      statement: identityStatement,
    },
    behavior: {
      target: input.behavior,
      minimum: minActionResult.minimumAction,
      normal: input.normalTarget || input.behavior,
      stretch: input.stretchTarget,
    },
    cue: {
      type: cueType,
      anchor: input.cue?.location || input.cue?.triggerEvent,
      time: input.cue?.time,
    },
    intervention: {
      surface: 'widget',
      action: 'START_MINIMUM',
    },
    recovery: {
      enabled: true,
      minimum_after_miss: true,
    },
    reward: {
      type: 'factual_milestone',
    },
    rulesApplied: Array.from(rulesAppliedSet),
  };

  return {
    plan,
    valid: true,
    rulesApplied: Array.from(rulesAppliedSet),
  };
}

/**
 * Completes a habit session, updating streak and cumulative lifetime evidence votes
 */
export function completeHabit(
  habit: Habit,
  options: TimeOptions = {}
): { updatedHabit: Habit; completedToday: boolean; rulesApplied: string[] } {
  const todayDate = options.todayDate || getLocalDateString();
  const now = options.now || new Date().toISOString();

  // If already completed today, return idempotent unchanged habit
  if (habit.lastCompletedDate === todayDate) {
    return {
      updatedHabit: habit,
      completedToday: false,
      rulesApplied: [],
    };
  }

  const nextStreak = (habit.streakCount || 0) + 1;
  const nextBest = Math.max(nextStreak, habit.bestStreak || 0);
  const nextEvidenceVotes = (habit.totalEvidenceVotes || 0) + 1;

  const updatedHabit: Habit = {
    ...habit,
    status: 'active', // Restores active from recovery if completed
    streakCount: nextStreak,
    bestStreak: nextBest,
    totalEvidenceVotes: nextEvidenceVotes,
    lastCompletedDate: todayDate,
    updatedAt: now,
  };

  return {
    updatedHabit,
    completedToday: true,
    rulesApplied: ['HABIT_COMPLETED'],
  };
}

/**
 * Evaluates a difficulty progression upgrade against the 80% 14-day gate (HABIT_PROGRESSION_001)
 */
export function evaluateProgression(
  _habit: Habit,
  rolling14DayConsistency: number
): { allowed: boolean; reason?: string; rulesApplied: string[] } {
  const rules = loadMachineRules('habit');
  const result = evaluateRules(rules, {
    action: 'ADJUST_DIFFICULTY',
    direction: 'harder',
    rolling14DayConsistency,
  });

  if (result.rejected) {
    return {
      allowed: false,
      reason: result.rejected.reason,
      rulesApplied: result.rulesApplied,
    };
  }

  return {
    allowed: true,
    rulesApplied: result.rulesApplied,
  };
}

export default {
  generateEntityId,
  validateHabitCreation,
  generateMinimumAction,
  compileHabitPlan,
  completeHabit,
  evaluateProgression,
};
