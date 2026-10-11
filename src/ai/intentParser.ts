/**
 * KwestUp 4.0 — Specialist On-Device AI Intent Parser
 *
 * Translates natural language user utterances into structured ExtractedIntent
 * bare facts. Employs on-device Qwen2.5-0.5B via llama.rn with lightweight rule RAG
 * and falls back deterministically to heuristic parsing on any model unavailability,
 * error, or timeout.
 *
 * Source: rulebook/ai/intent-parser.md, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import { ExtractedIntent, IntentParserOptions } from './types';
import { parseIntentHeuristic } from './heuristicParser';
import { retrieveRulePacket } from './rulePacketRetriever';
import { loadModel, resetIdleTimer, isModelDownloaded } from '../utils/aiService';
import { logger } from '../utils/logger';

export const MAX_USER_INPUT_LENGTH = 500;
export const MAX_OUTPUT_TOKENS = 120;
export const DEFAULT_INFERENCE_TIMEOUT_MS = 15000;

/**
 * Parses user natural language into structured ExtractedIntent.
 *
 * Pipeline:
 * 1. Clamps input string to 500 chars.
 * 2. If forceHeuristic is true, immediately runs heuristicParser.
 * 3. Retrieves up to 3 behavioral machine rules via rulePacketRetriever.
 * 4. Runs on-device Qwen model with low temperature (0.1) and strict JSON format.
 * 5. If model is unavailable, times out, or emits malformed output, gracefully
 *    falls back to heuristicParser without throwing to the caller.
 */
export async function parseUserIntent(
  userInput: string,
  options: IntentParserOptions = {}
): Promise<ExtractedIntent> {
  const trimmed = (userInput || '').trim();
  if (trimmed.length < 3) {
    return {
      action: 'CREATE_HABIT',
      behavior: '',
      confidence: 0,
      source: 'heuristic',
    };
  }

  const clampedInput = trimmed.slice(0, MAX_USER_INPUT_LENGTH);
  const rulePacket = retrieveRulePacket(clampedInput);

  // 1. Force heuristic option
  if (options.forceHeuristic === true) {
    const heuristic = parseIntentHeuristic(clampedInput);
    heuristic.rulesRetrieved = rulePacket.ruleIds;
    return heuristic;
  }

  // 2. Check model download availability
  try {
    const downloaded = await isModelDownloaded();
    if (!downloaded) {
      logger.debug('Model not downloaded on device; utilizing heuristic intent parser');
      const heuristic = parseIntentHeuristic(clampedInput);
      heuristic.rulesRetrieved = rulePacket.ruleIds;
      return heuristic;
    }
  } catch (checkErr) {
    logger.debug('Failed to verify model download status:', checkErr);
    const heuristic = parseIntentHeuristic(clampedInput);
    heuristic.rulesRetrieved = rulePacket.ruleIds;
    return heuristic;
  }

  // 3. Build Prompt with Rule RAG
  let systemPrompt = `You are the KwestUp Intent Parser. Extract bare facts from the user habit request.
Output a single JSON object ONLY with properties:
- "action": "CREATE_HABIT" | "UPDATE_HABIT" | "DELETE_HABIT" | "LOG_HABIT" | "PAUSE_HABIT" | "RESUME_HABIT" | "ARCHIVE_HABIT" | "ADJUST_DIFFICULTY" | "START_RECOVERY" | "CREATE_IDENTITY"
- "behavior": string (the core action)
- "frequency": "daily" | "weekdays" | "weekends" | "weekly" | "custom" (optional)
- "cueType": "time" | "after-habit" | "morning" | "evening" | "manual" (optional)
- "time": string (HH:mm format, optional)
- "anchor": string (anchor routine if habit stack, optional)
- "location": string (optional)
- "minimumAction": string (optional)
- "target": string (optional)
- "reason": string (optional)`;

  if (rulePacket.formattedPromptText) {
    systemPrompt += `\n${rulePacket.formattedPromptText}`;
  }

  const prompt = `<|im_start|>system\n${systemPrompt}\n<|im_end|>\n<|im_start|>user\n${clampedInput}\n<|im_end|>\n<|im_start|>assistant\n`;

  // 4. On-Device LLM Execution
  resetIdleTimer();
  let rawOutput = '';

  try {
    const ctx = await loadModel();

    let timeoutId: any = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Inference timeout exceeded'));
      }, options.timeoutMs ?? DEFAULT_INFERENCE_TIMEOUT_MS);
    });

    try {
      const completionResult: any = await Promise.race([
        ctx.completion(
          {
            prompt,
            n_predict: MAX_OUTPUT_TOKENS,
            temperature: options.temperature ?? 0.1,
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
    logger.debug('Native LLM inference error or timeout; falling back to heuristic parser:', err?.message || err);
    const heuristic = parseIntentHeuristic(clampedInput);
    heuristic.rulesRetrieved = rulePacket.ruleIds;
    return heuristic;
  }

  // 5. JSON Extraction & Validation
  const jsonMatch = rawOutput.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    logger.debug('LLM output lacked JSON delimiters; falling back to heuristic parser');
    const heuristic = parseIntentHeuristic(clampedInput);
    heuristic.rulesRetrieved = rulePacket.ruleIds;
    return heuristic;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.behavior) {
      const heuristic = parseIntentHeuristic(clampedInput);
      heuristic.rulesRetrieved = rulePacket.ruleIds;
      return heuristic;
    }

    return {
      action: parsed.action || 'CREATE_HABIT',
      behavior: String(parsed.behavior).trim(),
      frequency: parsed.frequency,
      customWeekdays: parsed.customWeekdays,
      cueType: parsed.cueType,
      time: parsed.time,
      anchor: parsed.anchor,
      location: parsed.location,
      minimumAction: parsed.minimumAction,
      target: parsed.target,
      reason: parsed.reason,
      confidence: 0.95,
      source: 'llm',
      rulesRetrieved: rulePacket.ruleIds,
    };
  } catch {
    const heuristic = parseIntentHeuristic(clampedInput);
    heuristic.rulesRetrieved = rulePacket.ruleIds;
    return heuristic;
  }
}
