/**
 * KwestUp 4.0 — Weekly Review Engine & Factual Language Generator
 *
 * Implements the Language Generator role and weekly self-reflection synthesizer:
 * aggregates 7-day behavioral telemetry, tallies identity evidence votes,
 * computes rolling consistency and Never-Miss-Twice recovery adherence, and synthesizes
 * non-punitive reflection narratives grounded in Atomic Habits philosophy.
 *
 * Source: rulebook/atomic-habits/review-system.md, rulebook/machine/recoveryRules.json, 4.0/KwestUp_4.0_Master_Plan.md §10
 */

import { Habit, BehaviorEvent, Identity, FrictionCategory } from '../behavior/types';
import {
  WeeklyReviewReport,
  WeeklyReviewOptions,
  WeeklyReviewIdentityVote,
  SuggestedIntervention,
} from './types';
import { calculateRollingConsistency } from '../behavior/improvementEngine';
import { mapFrictionToIntervention, VALID_FRICTION_CATEGORIES } from './frictionAnalyzer';
import { getLocalDateString, parseLocalDate } from '../utils/dateUtils';
import { isModelDownloaded, loadModel, resetIdleTimer } from '../utils/aiService';
import { logger } from '../utils/logger';

export const MAX_REVIEW_PROMPT_LENGTH = 600;
export const MAX_REVIEW_OUTPUT_TOKENS = 180;
export const DEFAULT_REVIEW_TIMEOUT_MS = 15000;

export type ReviewDataForNarrative = Omit<
  WeeklyReviewReport,
  'narrativeSummary' | 'source' | 'rulesApplied'
>;

/**
 * Deterministic template-based narrative generator enforcing Atomic Habits non-punitive tone.
 */
export function generateWeeklyReviewHeuristic(
  reportData: ReviewDataForNarrative,
  userName?: string
): string {
  const greeting = userName ? `Hello ${userName}. ` : '';

  // Zero habits tracked edge case
  if (reportData.totalHabitsTracked === 0) {
    return `${greeting}No active habits were tracked during this period. Start by defining your core identity statement and creating a 2-minute starter habit.\n\nRemember James Clear's principle: Every action you take is a vote for the type of person you wish to become.`;
  }

  const consistencyPct = Math.round(reportData.overallConsistencyRate * 100);
  const recoveryPct = Math.round(reportData.recoveryAdherenceRate * 100);

  // Identity votes statement
  const identityEntries = Object.values(reportData.identityVotes);
  let identitySummary = '';
  if (identityEntries.length > 0) {
    const totalWeekVotes = identityEntries.reduce((sum, item) => sum + item.votesThisWeek, 0);
    const topIdentity = identityEntries.reduce((prev, curr) =>
      curr.votesThisWeek > prev.votesThisWeek ? curr : prev
    );
    identitySummary = `This week, you cast ${totalWeekVotes} total votes for who you want to become, reinforcing: "${topIdentity.statement}". `;
  } else {
    identitySummary = `This week, you executed ${reportData.totalCompletions} habit repetitions. `;
  }

  // Consistency & recovery reflection
  let resilienceSummary = '';
  if (reportData.totalMisses === 0) {
    resilienceSummary = `Your consistency was exceptionally high at ${consistencyPct}%, with zero missed scheduled sessions across your active habits. `;
  } else {
    resilienceSummary = `Your consistency was ${consistencyPct}% across ${reportData.totalHabitsTracked} tracked habits. In ${recoveryPct}% of recovery opportunities, you adhered to the Never Miss Twice principle, rebounding quickly after lapses. `;
  }

  // Friction touchpoint
  let frictionSummary = '';
  if (reportData.topFrictionCategories.length > 0) {
    const topFriction = reportData.topFrictionCategories[0];
    frictionSummary = `The primary obstacle noted was ${topFriction.category} friction. `;
  } else {
    frictionSummary = 'No recurring friction obstacles were recorded. ';
  }

  // System adjustment takeaway
  const closingTakeaway =
    reportData.suggestedAdjustments.length > 0
      ? 'Remember James Clear\'s principle: You do not rise to the level of your goals, you fall to the level of your systems. Review the suggested system adaptations below to reduce friction.'
      : 'Your behavioral system is operating smoothly. Continue consolidating your identity-based habits.';

  return `${greeting}${identitySummary}${resilienceSummary}\n\n${frictionSummary}${closingTakeaway}`;
}

/**
 * On-device Language Generator synthesizing weekly reflection narrative via Qwen LLM.
 */
export async function generateWeeklyReviewNarrative(
  reportData: ReviewDataForNarrative,
  options: WeeklyReviewOptions = {}
): Promise<{ narrative: string; source: 'llm' | 'heuristic' }> {
  // 1. Short-circuit if heuristic forced or model missing
  if (options.forceHeuristic) {
    return {
      narrative: generateWeeklyReviewHeuristic(reportData, options.userName),
      source: 'heuristic',
    };
  }

  try {
    const downloaded = await isModelDownloaded();
    if (!downloaded) {
      return {
        narrative: generateWeeklyReviewHeuristic(reportData, options.userName),
        source: 'heuristic',
      };
    }
  } catch {
    return {
      narrative: generateWeeklyReviewHeuristic(reportData, options.userName),
      source: 'heuristic',
    };
  }

  // 2. Build Grounded Metric Summary for LLM Prompt
  const topFriction = reportData.topFrictionCategories[0]?.category || 'none';
  const identityList = Object.values(reportData.identityVotes)
    .map((iv) => `${iv.statement} (+${iv.votesThisWeek} votes)`)
    .slice(0, 2)
    .join(', ');

  const metricsGrounding = `Habits: ${reportData.totalHabitsTracked}, Completions: ${reportData.totalCompletions}, Misses: ${reportData.totalMisses}, Consistency: ${Math.round(reportData.overallConsistencyRate * 100)}%, Recovery Adherence: ${Math.round(reportData.recoveryAdherenceRate * 100)}%, Identities: [${identityList || 'General growth'}], Top Friction: ${topFriction}.`.slice(
    0,
    MAX_REVIEW_PROMPT_LENGTH
  );

  const systemPrompt = `You are the KwestUp Language Generator. Write a concise 2-paragraph weekly behavioral reflection for the user based strictly on the provided factual metrics.
Ground your reflection in Atomic Habits:
1. Frame completions as votes cast for identity.
2. Celebrate Never Miss Twice recovery resilience and consistency.
3. Frame missed sessions as useful data on system friction, never human failure or willpower deficiency.
4. Strictly forbid guilt-tripping, streak anxiety, or punitive language. Keep response under 150 words.`;

  const prompt = `<|im_start|>system\n${systemPrompt}\n<|im_end|>\n<|im_start|>user\nHere are my weekly metrics: ${metricsGrounding}\n<|im_end|>\n<|im_start|>assistant\n`;

  // 3. On-Device LLM Inference
  resetIdleTimer();
  let rawOutput = '';

  try {
    const ctx = await loadModel();

    let timeoutId: any = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Inference timeout exceeded'));
      }, options.timeoutMs ?? DEFAULT_REVIEW_TIMEOUT_MS);
    });

    try {
      const completionResult: any = await Promise.race([
        ctx.completion(
          {
            prompt,
            n_predict: MAX_REVIEW_OUTPUT_TOKENS,
            temperature: 0.3,
            top_p: 0.9,
            stop: ['<|im_end|>', '<|im_start|>', '```'],
          },
          (data: { token?: string }) => {
            if (data?.token) {
              rawOutput += data.token;
            }
          }
        ),
        timeoutPromise,
      ]);

      if (!rawOutput && completionResult?.text) {
        rawOutput = completionResult.text;
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    const cleaned = (rawOutput || '').trim();
    if (!cleaned || cleaned.length < 20) {
      throw new Error('LLM output too short or empty');
    }

    return {
      narrative: cleaned,
      source: 'llm',
    };
  } catch (err: any) {
    logger.debug('Weekly review narrative LLM error or timeout; falling back to heuristic:', err?.message || err);
    return {
      narrative: generateWeeklyReviewHeuristic(reportData, options.userName),
      source: 'heuristic',
    };
  }
}

/**
 * Synthesizes the full Weekly Review Report over a 7-day rolling window.
 */
export async function generateWeeklyReview(
  habits: Habit[],
  events: BehaviorEvent[],
  identities: Identity[],
  options: WeeklyReviewOptions = {}
): Promise<WeeklyReviewReport> {
  const todayStr = options.todayDate || getLocalDateString();
  const baseDate = parseLocalDate(todayStr);

  // Determine 7-day window [today - 6 days, today]
  const windowDates = new Set<string>();
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(baseDate.getTime());
    d.setDate(d.getDate() - offset);
    const dateStr = getLocalDateString(d);
    if (dateStr) {
      windowDates.add(dateStr);
    }
  }

  const sortedWindow = Array.from(windowDates).sort();
  const periodStart = sortedWindow[0] || todayStr;
  const periodEnd = sortedWindow[sortedWindow.length - 1] || todayStr;

  // Filter events in window
  const windowEvents = (events || []).filter((e) => {
    const eventDate = getLocalDateString(e.timestamp);
    return eventDate && windowDates.has(eventDate);
  });

  const activeOrRecoveryHabits = (habits || []).filter(
    (h) => h.status === 'active' || h.status === 'recovery'
  );
  const totalHabitsTracked = activeOrRecoveryHabits.length;

  const completionEvents = windowEvents.filter((e) => e.type === 'HABIT_COMPLETED');
  const missEvents = windowEvents.filter((e) => e.type === 'HABIT_MISSED');

  const totalCompletions = completionEvents.length;
  const totalMisses = missEvents.length;

  // 1. Overall Consistency Rate
  let overallConsistencyRate = 0;
  if (totalHabitsTracked > 0) {
    const totalConsistency = activeOrRecoveryHabits.reduce((sum, h) => {
      const consistency = calculateRollingConsistency(events, h.id, 7, { todayDate: todayStr });
      return sum + consistency;
    }, 0);
    overallConsistencyRate = Number((totalConsistency / totalHabitsTracked).toFixed(2));
  }

  // 2. Never-Miss-Twice Recovery Adherence
  let recoveryAdherenceRate = 1.0;
  if (totalMisses > 0) {
    // Count recovery completions: events completed with status recovery or where habit rebounded
    const recoveryCompletions = completionEvents.filter((e) => {
      const habit = habits.find((h) => h.id === e.entityId);
      return habit?.status === 'recovery' || e.payload?.status === 'recovery';
    }).length;

    // A habit adhering to never-miss-twice does not experience >= 2 consecutive misses
    const habitsWithMultiMiss = activeOrRecoveryHabits.filter((h) => {
      const habitMisses = missEvents.filter((e) => e.entityId === h.id).length;
      return habitMisses >= 2;
    }).length;

    const successfulRecoveries = Math.max(0, totalMisses - habitsWithMultiMiss + recoveryCompletions);
    recoveryAdherenceRate = Math.min(1.0, Number((successfulRecoveries / totalMisses).toFixed(2)));
  }

  // 3. Identity Evidence Votes
  const identityVotes: Record<string, WeeklyReviewIdentityVote> = {};
  for (const identity of identities || []) {
    const associatedHabits = (habits || []).filter((h) => h.identityId === identity.id);
    const associatedHabitIds = new Set(associatedHabits.map((h) => h.id));

    const votesThisWeek = completionEvents.filter((e) => associatedHabitIds.has(e.entityId)).length;
    const totalVotes = associatedHabits.reduce((sum, h) => sum + (h.totalEvidenceVotes || 0), 0);

    identityVotes[identity.id] = {
      identityId: identity.id,
      statement: identity.statement,
      totalVotes,
      votesThisWeek,
    };
  }

  // 4. Friction Touchpoints Distribution
  const frictionCounts: Record<FrictionCategory, number> = {
    effort: 0,
    time: 0,
    setup: 0,
    emotional: 0,
    mental: 0,
    location: 0,
  };

  for (const miss of missEvents) {
    const category = (miss.payload?.frictionCategory || miss.payload?.category || '') as FrictionCategory;
    if (VALID_FRICTION_CATEGORIES.includes(category)) {
      frictionCounts[category]++;
    } else {
      frictionCounts.effort++;
    }
  }

  const topFrictionCategories = Object.entries(frictionCounts)
    .map(([cat, count]) => ({ category: cat as FrictionCategory, count }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  // 5. Actionable Adaptation Proposals
  const suggestedAdjustments: SuggestedIntervention[] = [];
  for (const habit of activeOrRecoveryHabits) {
    const habitMisses = missEvents.filter((e) => e.entityId === habit.id);
    const habitConsistency = calculateRollingConsistency(events, habit.id, 7, { todayDate: todayStr });

    if (habitConsistency < 0.60 || habitMisses.length >= 2) {
      // Determine predominant friction category for this habit
      const habitFriction = (habitMisses[0]?.payload?.frictionCategory as FrictionCategory) ||
        topFrictionCategories[0]?.category ||
        'effort';

      const adaptation = mapFrictionToIntervention(habit, habitFriction, {
        recentMissCount: habitMisses.length,
        consecutiveMisses: habitMisses.length >= 2 ? 2 : 1,
      });

      suggestedAdjustments.push(adaptation);
    }
  }

  // 6. Generate Narrative Reflection
  const reportDataWithoutNarrative: ReviewDataForNarrative = {
    periodStart,
    periodEnd,
    totalHabitsTracked,
    overallConsistencyRate,
    totalCompletions,
    totalMisses,
    recoveryAdherenceRate,
    identityVotes,
    topFrictionCategories,
    suggestedAdjustments,
  };

  const narrativeResult = await generateWeeklyReviewNarrative(reportDataWithoutNarrative, options);

  return {
    ...reportDataWithoutNarrative,
    narrativeSummary: narrativeResult.narrative,
    source: narrativeResult.source,
    rulesApplied: ['REVIEW_WEEKLY_001', 'RECOVERY_001'],
  };
}
