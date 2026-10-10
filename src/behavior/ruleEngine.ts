/**
 * KwestUp 4.0 — Deterministic Machine Rule Evaluation Engine
 *
 * Source: rulebook/machine/*.json, 4.0/KwestUp_4.0_Master_Plan.md §4
 */

import habitRulesData from '../../rulebook/machine/habitRules.json';
import recoveryRulesData from '../../rulebook/machine/recoveryRules.json';
import rewardRulesData from '../../rulebook/machine/rewardRules.json';
import rulesData from '../../rulebook/machine/rules.json';
import interventionRulesData from '../../rulebook/machine/interventionRules.json';

import { BehaviorRule, RuleEvaluationContext, RuleEvaluationResult } from './types';
import { logger } from '../utils/logger';

export type RuleCategory = 'habit' | 'recovery' | 'reward' | 'intervention' | 'system' | 'all';

/**
 * Extract nested object value via dot notation path (e.g. 'habit.missedConsecutively')
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  if (path in obj) return obj[path];

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Evaluates a single condition property against actual context value.
 * Supports:
 * - null/undefined checks
 * - array membership (e.g. [7, 21, 66])
 * - numeric comparison operators ('>=3', '<0.80', '>0.40', '<90', '>=1', '>=2')
 * - exact primitive equality (string, boolean, number)
 */
export function evaluateCondition(conditionValue: unknown, contextValue: unknown): boolean {
  // 1. Explicit null check
  if (conditionValue === null) {
    return contextValue === null || contextValue === undefined;
  }

  // 2. Explicit undefined check
  if (conditionValue === undefined) {
    return contextValue === undefined;
  }

  // 3. Array membership check (e.g. habit.streakCount: [7, 21, 66])
  if (Array.isArray(conditionValue)) {
    return conditionValue.includes(contextValue);
  }

  // 4. Operator string check (e.g. '>=3', '<0.80', '>0.40', '>=1')
  if (typeof conditionValue === 'string') {
    const operatorMatch = conditionValue.match(/^([><]=?|==|!=)\s*([0-9.]+)$/);
    if (operatorMatch && typeof contextValue === 'number') {
      const op = operatorMatch[1];
      const targetVal = parseFloat(operatorMatch[2]);
      switch (op) {
        case '>=':
          return contextValue >= targetVal;
        case '<=':
          return contextValue <= targetVal;
        case '>':
          return contextValue > targetVal;
        case '<':
          return contextValue < targetVal;
        case '==':
          return contextValue === targetVal;
        case '!=':
          return contextValue !== targetVal;
        default:
          return false;
      }
    }
  }

  // 5. Direct equality
  return conditionValue === contextValue;
}

/**
 * Load machine rules for specified category
 */
export function loadMachineRules(category: RuleCategory = 'all'): BehaviorRule[] {
  const habitRules = (habitRulesData.rules || []) as BehaviorRule[];
  const recoveryRules = (recoveryRulesData.rules || []) as BehaviorRule[];
  const rewardRules = (rewardRulesData.rules || []) as BehaviorRule[];
  const systemRules = (rulesData.rules || []) as BehaviorRule[];
  const interventionRules = (interventionRulesData.rules || []) as BehaviorRule[];

  switch (category) {
    case 'habit':
      return habitRules;
    case 'recovery':
      return recoveryRules;
    case 'reward':
      return rewardRules;
    case 'system':
      return systemRules;
    case 'intervention':
      return interventionRules;
    case 'all':
    default:
      return [
        ...systemRules,
        ...habitRules,
        ...recoveryRules,
        ...rewardRules,
        ...interventionRules,
      ];
  }
}

/**
 * Evaluates rules against context and produces an execution trace
 */
export function evaluateRules(
  rules: BehaviorRule[],
  context: RuleEvaluationContext
): RuleEvaluationResult {
  const matchedRules: BehaviorRule[] = [];

  for (const rule of rules) {
    if (!rule || !rule.when || typeof rule.when !== 'object') continue;

    let matches = true;
    for (const [key, expectedCondition] of Object.entries(rule.when)) {
      const actualValue = getNestedValue(context, key);
      if (!evaluateCondition(expectedCondition, actualValue)) {
        matches = false;
        break;
      }
    }

    if (matches) {
      matchedRules.push(rule);
    }
  }

  // Sort matched rules by priority descending
  matchedRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const rulesApplied: string[] = [];
  const actions: Array<Record<string, unknown>> = [];
  let rejected: { ruleId: string; reason: string } | undefined;

  for (const rule of matchedRules) {
    if (!rulesApplied.includes(rule.id)) {
      rulesApplied.push(rule.id);
    }

    if (rule.then && typeof rule.then === 'object') {
      actions.push(rule.then);

      const actionName = String(rule.then.action || '');
      if (actionName.startsWith('REJECT_') && !rejected) {
        rejected = {
          ruleId: rule.id,
          reason: String(rule.then.reason || rule.then.error || actionName),
        };
      }
    }
  }

  logger.debug('RuleEngine evaluation result:', {
    matchedCount: matchedRules.length,
    rulesApplied,
    hasRejection: Boolean(rejected),
  });

  return {
    rulesApplied,
    actions,
    matchedRules,
    rejected,
  };
}

export default {
  getNestedValue,
  evaluateCondition,
  loadMachineRules,
  evaluateRules,
};
