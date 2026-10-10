/**
 * KwestUp 4.0 — Pure Cue & Habit Stacking Engine
 *
 * Implements cue validation, trigger binding, and habit stacking.
 *
 * Source: rulebook/machine/habitRules.json, 4.0/KwestUp_4.0_Master_Plan.md §5
 */

import { Cue, CueType, Habit, HabitStack } from './types';
import { evaluateRules, loadMachineRules } from './ruleEngine';

const VALID_CUE_TYPES: CueType[] = [
  'time',
  'after-habit',
  'task-completion',
  'manual',
  'morning',
  'evening',
];

/**
 * Validates cue anchor presence and schema (CUE_MANDATORY_001)
 */
export function validateCue(
  cue?: Partial<Cue> | null
): { valid: boolean; reason?: string; rulesApplied: string[] } {
  const rules = loadMachineRules('habit');
  const result = evaluateRules(rules, {
    action: 'COMPILE_HABIT',
    cue: cue && cue.type ? cue : null,
  });

  if (!cue || !cue.type) {
    return {
      valid: false,
      reason: 'A valid cue anchor (time, habit stack, or trigger) is mandatory per Law 1.',
      rulesApplied: ['CUE_MANDATORY_001', ...result.rulesApplied.filter((r) => r !== 'CUE_MANDATORY_001')],
    };
  }

  if (!VALID_CUE_TYPES.includes(cue.type)) {
    return {
      valid: false,
      reason: `Unsupported cue type: ${cue.type}. Valid types: ${VALID_CUE_TYPES.join(', ')}`,
      rulesApplied: result.rulesApplied,
    };
  }

  if (cue.type === 'after-habit' && !cue.triggerEvent && !cue.conditions?.anchorHabitId) {
    return {
      valid: false,
      reason: "Habit stack cue must specify an anchor habit via triggerEvent or conditions.anchorHabitId.",
      rulesApplied: result.rulesApplied,
    };
  }

  return {
    valid: true,
    rulesApplied: result.rulesApplied,
  };
}

/**
 * Links a target habit to an anchor habit via habit stacking (CUE_STACK_002)
 */
export function linkHabitStack(
  anchorHabit: Habit,
  targetHabit: Habit
): { habitStack: HabitStack; rulesApplied: string[] } {
  const rules = loadMachineRules('habit');
  const result = evaluateRules(rules, {
    action: 'COMPILE_HABIT',
    'cue.type': 'habit_stack',
  });

  const habitStack: HabitStack = {
    anchorHabitId: anchorHabit.id,
    targetHabitId: targetHabit.id,
    relationship: 'immediately-after',
  };

  return {
    habitStack,
    rulesApplied: ['CUE_STACK_002', ...result.rulesApplied.filter((r) => r !== 'CUE_STACK_002')],
  };
}

export default {
  validateCue,
  linkHabitStack,
};
