/**
 * KwestUp 4.0 — Semantic Friction Analyzer & Deterministic Intervention Mapping
 *
 * Implements the Behavior Analyst role: categorizing user obstacle utterances
 * across the 6 Atomic Habits friction categories (effort, time, setup, emotional, mental, location)
 * and mapping them deterministically to actionable KwestUp interventions.
 *
 * Source: rulebook/atomic-habits/friction.md, rulebook/machine/recoveryRules.json, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import { Habit, FrictionCategory } from '../behavior/types';
import {
  FrictionAnalysisResult,
  SuggestedIntervention,
  FrictionAnalyzerOptions,
} from './types';
import { isModelDownloaded, loadModel, resetIdleTimer } from '../utils/aiService';
import { logger } from '../utils/logger';

export const MAX_FRICTION_INPUT_LENGTH = 500;
export const MAX_FRICTION_OUTPUT_TOKENS = 80;
export const DEFAULT_FRICTION_TIMEOUT_MS = 10000;

export const VALID_FRICTION_CATEGORIES: FrictionCategory[] = [
  'effort',
  'time',
  'setup',
  'emotional',
  'mental',
  'location',
];

/**
 * Deterministically maps a diagnosed friction category to an actionable KwestUp command proposal.
 */
export function mapFrictionToIntervention(
  habit: Habit,
  category: FrictionCategory,
  context?: { recentMissCount?: number; consecutiveMisses?: number }
): SuggestedIntervention {
  // If habit has consecutive misses >= 2, trigger Never-Miss-Twice recovery downscaling
  if (context?.consecutiveMisses && context.consecutiveMisses >= 2) {
    return {
      action: 'ADJUST_DIFFICULTY',
      habitId: habit.id,
      payload: {
        habitId: habit.id,
        direction: 'easier',
        newMinimumAction: habit.minimumAction || '2-minute version',
      },
      description: 'Never miss twice: downscale habit to 2-minute minimum gateway action',
      ruleId: 'RECOVERY_CONSECUTIVE_MISS_002',
    };
  }

  switch (category) {
    case 'effort':
      return {
        action: 'ADJUST_DIFFICULTY',
        habitId: habit.id,
        payload: {
          habitId: habit.id,
          direction: 'easier',
          newMinimumAction: habit.minimumAction || '2-minute version',
        },
        description: 'Reduce physical effort: scale down session to 2-minute gateway action',
        ruleId: 'MINIMUM_ACTION_001',
      };

    case 'time':
      return {
        action: 'UPDATE_HABIT',
        habitId: habit.id,
        payload: {
          habitId: habit.id,
          updates: {
            normalTarget: habit.minimumAction || '10 minutes',
          },
        },
        description: 'Reduce duration friction: adjust target to fit available schedule',
        ruleId: 'CUE_STACK_001',
      };

    case 'setup':
      return {
        action: 'UPDATE_HABIT',
        habitId: habit.id,
        payload: {
          habitId: habit.id,
          updates: {
            behavior: `Prime environment: prepare tools before ${habit.behavior}`,
          },
        },
        description: 'Eliminate setup friction: add environmental priming routine',
        ruleId: 'CUE_STACK_002',
      };

    case 'emotional':
      return {
        action: 'ADJUST_DIFFICULTY',
        habitId: habit.id,
        payload: {
          habitId: habit.id,
          direction: 'easier',
          newMinimumAction: habit.minimumAction || '1-minute starting action',
        },
        description: 'Overcome emotional friction: focus on showing up with a micro step',
        ruleId: 'HABIT_IDENTITY_ANCHOR_001',
      };

    case 'mental':
      return {
        action: 'UPDATE_HABIT',
        habitId: habit.id,
        payload: {
          habitId: habit.id,
          updates: {
            minimumAction: habit.minimumAction || 'Define clear first line or step',
          },
        },
        description: 'Clarify ambiguity: specify immediate first step',
        ruleId: 'MINIMUM_ACTION_001',
      };

    case 'location':
      return {
        action: 'UPDATE_HABIT',
        habitId: habit.id,
        payload: {
          habitId: habit.id,
          updates: {
            normalTarget: habit.minimumAction || 'Portable travel routine',
          },
        },
        description: 'Context adaptation: establish portable routine for alternate locations',
        ruleId: 'CUE_STACK_001',
      };

    default:
      return {
        action: 'ADJUST_DIFFICULTY',
        habitId: habit.id,
        payload: {
          habitId: habit.id,
          direction: 'easier',
          newMinimumAction: habit.minimumAction || '2-minute version',
        },
        description: 'Simplify habit to reduce activation energy',
        ruleId: 'MINIMUM_ACTION_001',
      };
  }
}

/**
 * Deterministic 100% offline regex & keyword diagnostic classifier.
 */
export function diagnoseFrictionHeuristic(
  input: string,
  habit?: Habit,
  context?: { recentMissCount?: number; consecutiveMisses?: number }
): FrictionAnalysisResult {
  const normalized = (input || '').toLowerCase().trim();

  // Pattern definitions for each category
  const patterns: Array<{ category: FrictionCategory; pattern: RegExp; reason: string }> = [
    {
      category: 'location',
      pattern: /\b(travel|traveling|hotel|airport|flight|transit|vacation|trip|away from home|not at home|out of town|road trip)\b/i,
      reason: 'Physical environment disruption or travel',
    },
    {
      category: 'setup',
      pattern: /\b(gear|prep|preparation|not ready|tools|messy|supplies|equipment|clutter|can't find|couldn't find|missing)\b/i,
      reason: 'Environment or tools were not primed',
    },
    {
      category: 'emotional',
      pattern: /\b(dread|anxious|anxiety|scared|fear|avoiding|procrastinat\w*|overwhelm\w*|unmotivated|bored|discouraged|mood|stress)\b/i,
      reason: 'Emotional resistance, anxiety, or avoidance',
    },
    {
      category: 'mental',
      pattern: /\b(confus\w*|stuck|don't know where|didn't know how|vague|complicated|complex|unclear|difficult to decide|lost|indecisive)\b/i,
      reason: 'Cognitive ambiguity or lack of clarity',
    },
    {
      category: 'time',
      pattern: /\b(busy|no time|ran out of time|late|rush|hurried|meeting|schedule|overtime|too long|delay|errands)\b/i,
      reason: 'Duration or scheduling conflict',
    },
    {
      category: 'effort',
      pattern: /\b(tired|exhaust\w*|energy|drained|heavy|hard to start|fatigue|sleepy|burnout|too much work|weak|no strength|lethargic)\b/i,
      reason: 'Physical exhaustion or low activation energy',
    },
  ];

  let matchedCategory: FrictionCategory = 'effort';
  let matchedReason = 'Low activation energy or physical fatigue';
  let confidence = 0.60;

  for (const item of patterns) {
    if (item.pattern.test(normalized)) {
      matchedCategory = item.category;
      matchedReason = item.reason;
      confidence = 0.85;
      break;
    }
  }

  const result: FrictionAnalysisResult = {
    category: matchedCategory,
    reason: matchedReason,
    confidence,
    source: 'heuristic',
    rulesApplied: ['FRICTION_DIAGNOSIS_001'],
  };

  if (habit) {
    result.suggestedIntervention = mapFrictionToIntervention(habit, matchedCategory, context);
  }

  return result;
}

/**
 * Semantic friction analyzer using on-device Qwen LLM with guaranteed heuristic fallback.
 */
export async function diagnoseFriction(
  input: string,
  options: FrictionAnalyzerOptions = {}
): Promise<FrictionAnalysisResult> {
  // 1. Clamp Input
  const safeInput = typeof input === 'string' ? input : '';
  const clampedInput = safeInput.slice(0, MAX_FRICTION_INPUT_LENGTH).trim();

  const fallbackContext = {
    recentMissCount: options.recentMissCount,
    consecutiveMisses: options.consecutiveMisses,
  };

  // 2. Short-Circuit if Heuristic Forced or Empty Input
  if (options.forceHeuristic || !clampedInput) {
    return diagnoseFrictionHeuristic(clampedInput, options.habit, fallbackContext);
  }

  // 3. Check Model Availability
  try {
    const downloaded = await isModelDownloaded();
    if (!downloaded) {
      return diagnoseFrictionHeuristic(clampedInput, options.habit, fallbackContext);
    }
  } catch {
    return diagnoseFrictionHeuristic(clampedInput, options.habit, fallbackContext);
  }

  // 3. Build Diagnostic Prompt
  const systemPrompt = `You are an expert behavior analyst specializing in Atomic Habits.
Analyze the user's reflection or obstacle note and classify the friction into exactly one category:
- "effort": Physical exhaustion, low energy, heavy vigor required
- "time": Scheduling conflict, running late, duration too long
- "setup": Tools missing, environment unprimed, preparation friction
- "emotional": Anxiety, dread, perfectionism, avoidance
- "mental": Confusion, cognitive complexity, ambiguous first step
- "location": Travel, hotel, away from normal environment

Output a single JSON object ONLY:
{"category": "effort"|"time"|"setup"|"emotional"|"mental"|"location", "reason": "brief reason"}`;

  const prompt = `<|im_start|>system\n${systemPrompt}\n<|im_end|>\n<|im_start|>user\n${clampedInput}\n<|im_end|>\n<|im_start|>assistant\n`;

  // 4. On-Device LLM Inference
  resetIdleTimer();
  let rawOutput = '';

  try {
    const ctx = await loadModel();

    let timeoutId: any = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Inference timeout exceeded'));
      }, options.timeoutMs ?? DEFAULT_FRICTION_TIMEOUT_MS);
    });

    try {
      const completionResult: any = await Promise.race([
        ctx.completion(
          {
            prompt,
            n_predict: MAX_FRICTION_OUTPUT_TOKENS,
            temperature: 0.1,
            top_p: 0.9,
            stop: ['<|im_end|>', '<|im_start|>', '```', '\n\n'],
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
  } catch (err: any) {
    logger.debug('Native LLM friction inference error or timeout; falling back to heuristic:', err?.message || err);
    return diagnoseFrictionHeuristic(clampedInput, options.habit, fallbackContext);
  }

  // 5. Parse and Validate Model Output
  try {
    const firstBrace = rawOutput.indexOf('{');
    const lastBrace = rawOutput.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('No valid JSON block found in output');
    }

    const jsonString = rawOutput.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonString);

    const categoryCandidate = String(parsed?.category || '').toLowerCase().trim() as FrictionCategory;
    if (!VALID_FRICTION_CATEGORIES.includes(categoryCandidate)) {
      throw new Error(`Invalid category returned: ${categoryCandidate}`);
    }

    const reason = typeof parsed?.reason === 'string' && parsed.reason.trim().length > 0
      ? parsed.reason.trim()
      : `Diagnosed as ${categoryCandidate} friction`;

    const result: FrictionAnalysisResult = {
      category: categoryCandidate,
      reason,
      confidence: 0.95,
      source: 'llm',
      rulesApplied: ['FRICTION_DIAGNOSIS_001'],
    };

    if (options.habit) {
      result.suggestedIntervention = mapFrictionToIntervention(options.habit, categoryCandidate, fallbackContext);
    }

    return result;
  } catch (parseErr: any) {
    logger.debug('Friction LLM JSON parse failed; falling back to heuristic:', parseErr?.message || parseErr);
    return diagnoseFrictionHeuristic(clampedInput, options.habit, fallbackContext);
  }
}
