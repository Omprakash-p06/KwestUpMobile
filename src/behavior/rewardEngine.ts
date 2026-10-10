/**
 * KwestUp 4.0 — Pure Factual Reward Engine
 *
 * Enforces anti-gamification policies (rejecting arbitrary XP/points/coins)
 * and grants factual behavioral milestone evidence.
 *
 * Source: rulebook/machine/rewardRules.json, 4.0/KwestUp_4.0_Master_Plan.md §10
 */

import {
  BehaviorEventType,
  FactualReward,
  Habit,
  TimeOptions,
} from './types';
import { evaluateRules, loadMachineRules } from './ruleEngine';
import { generateEntityId } from './habitEngine';

/**
 * Evaluates behavioral events and habit state to award factual milestones
 */
export function evaluateRewards(params: {
  habit: Habit;
  event: BehaviorEventType;
  previousEvent?: BehaviorEventType;
  requestedType?: string;
  options?: TimeOptions;
}): {
  rewards: FactualReward[];
  rejected?: { reason: string; ruleId: string };
  rulesApplied: string[];
} {
  const { habit, event, previousEvent, requestedType, options = {} } = params;
  const now = options.now || new Date().toISOString();
  const rules = loadMachineRules('reward');

  // 1. Anti-gamification rejection check (REWARD_ANTI_GAMIFICATION_001)
  if (requestedType) {
    const antiGamificationResult = evaluateRules(rules, {
      event: 'EVALUATE_REWARD',
      requestedType,
    });
    if (antiGamificationResult.rejected) {
      return {
        rewards: [],
        rejected: {
          reason: antiGamificationResult.rejected.reason,
          ruleId: antiGamificationResult.rejected.ruleId,
        },
        rulesApplied: antiGamificationResult.rulesApplied,
      };
    }
  }

  const evalContext = {
    event,
    requestedType: requestedType || null,
    'habit.totalEvidenceVotes': habit.totalEvidenceVotes,
    'habit.streakCount': habit.streakCount,
    previousEvent: previousEvent || null,
  };

  const evalResult = evaluateRules(rules, evalContext);

  if (evalResult.rejected) {
    return {
      rewards: [],
      rejected: {
        reason: evalResult.rejected.reason,
        ruleId: evalResult.rejected.ruleId,
      },
      rulesApplied: evalResult.rulesApplied,
    };
  }

  const rewards: FactualReward[] = [];

  // 2. First action milestone (REWARD_FIRST_ACTION_001)
  if (evalResult.rulesApplied.includes('REWARD_FIRST_ACTION_001')) {
    rewards.push({
      id: generateEntityId('reward'),
      habitId: habit.id,
      identityId: habit.identityId,
      title: 'First Step Taken',
      description: `Completed the initial execution of "${habit.title}".`,
      milestoneType: 'first_action',
      achievedAt: now,
    });
  }

  // 3. Recovery bounce-back milestone (REWARD_RECOVERY_001)
  if (evalResult.rulesApplied.includes('REWARD_RECOVERY_001')) {
    rewards.push({
      id: generateEntityId('reward'),
      habitId: habit.id,
      identityId: habit.identityId,
      title: 'Bounced Back',
      description: `Successfully showed up after a missed session for "${habit.title}". Never missed twice.`,
      milestoneType: 'recovery',
      achievedAt: now,
    });
  }

  // 4. Consistency milestone (REWARD_CONSISTENCY_001)
  if (evalResult.rulesApplied.includes('REWARD_CONSISTENCY_001')) {
    rewards.push({
      id: generateEntityId('reward'),
      habitId: habit.id,
      identityId: habit.identityId,
      title: `${habit.streakCount}-Day Consistency Milestone`,
      description: `Achieved ${habit.streakCount} consecutive days of "${habit.title}". Moving closer to automaticity.`,
      milestoneType: 'consistency',
      achievedAt: now,
    });
  }

  return {
    rewards,
    rulesApplied: evalResult.rulesApplied,
  };
}

export default {
  evaluateRewards,
};
