/**
 * KwestUp 4.0 — AI Execution Sandbox & Adversarial Defense Layer
 *
 * Implements strict boundary enforcement, prototype pollution stripping,
 * storage/path injection defenses, and user confirmation gating for all
 * AI-initiated command dispatches.
 *
 * Source: rulebook/ai/intent-parser.md, rulebook/machine/rules.json, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import { CommandAction, CommandExecutionResult, DispatchedCommand } from './types';
import { executeCommand } from './commandExecutor';
import { logger } from '../utils/logger';

const PROHIBITED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const STORAGE_KEY_PATTERN = /kwestup_[a-z0-9_]*/i;
const PATH_TRAVERSAL_PATTERN =
  /(\.\.\/|\.\.\\|file:\/\/|^[a-zA-Z]:[/\\]|^\\\\[a-zA-Z0-9_]+|^\/(etc|data|system|proc|sys|dev|root|var|tmp|usr|bin|storage)\b)/i;


const DESTRUCTIVE_ACTIONS: readonly CommandAction[] = ['DELETE_HABIT', 'ARCHIVE_HABIT'];

export interface AiExecutionOptions {
  confirmed?: boolean;
  idempotencyKey?: string;
}

export interface AiCommandExecutionResult extends CommandExecutionResult {
  requiresConfirmation?: boolean;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // 0. Skip undefined values (standard JSON serialization behavior)
    if (value === undefined) {
      continue;
    }

    // 1. Prototype pollution defense
    if (PROHIBITED_KEYS.has(key.toLowerCase())) {
      continue;
    }

    // 2. Prohibited key names
    if (STORAGE_KEY_PATTERN.test(key) || PATH_TRAVERSAL_PATTERN.test(key)) {
      throw new Error(`Security violation: Prohibited pattern detected in key "${key}"`);
    }

    // 3. Value sanitization
    clean[key] = sanitizeValue(value);
  }

  return clean;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    if (STORAGE_KEY_PATTERN.test(value)) {
      throw new Error('Security violation: Prohibited storage key injection detected in parameter value');
    }
    if (PATH_TRAVERSAL_PATTERN.test(value)) {
      throw new Error('Security violation: Prohibited path traversal sequence detected in parameter value');
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.filter((v) => v !== undefined).map(sanitizeValue);
  }

  if (typeof value === 'object') {
    // Reject dates, regex, class instances with custom prototypes
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('Security violation: Non-plain object instance rejected');
    }
    return sanitizeObject(value as Record<string, unknown>);
  }

  // Reject functions, symbols, undefined
  throw new Error(`Security violation: Unsupported data type "${typeof value}" in AI input`);
}

/**
 * Recursively sanitizes untrusted raw input from LLMs / AI intent parser:
 * - Drops prototype pollution keys (__proto__, constructor, prototype)
 * - Rejects non-JSON types (functions, symbols, undefined, regexes, Date objects)
 * - Rejects prohibited storage keys (kwestup_*) and path traversal patterns
 */
export function sanitizeAiPayload(rawPayload: unknown): Record<string, unknown> {
  if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new Error('AI payload must be a plain, non-null object');
  }

  return sanitizeObject(rawPayload as Record<string, unknown>);
}

/**
 * Sandboxed execution pipeline for AI-initiated commands:
 * 1. Parses raw JSON if string.
 * 2. Enforces non-null object shape.
 * 3. Sanitizes payload with prototype & injection filters.
 * 4. Checks destructive confirmation gate for DELETE_HABIT and ARCHIVE_HABIT.
 * 5. Generates monotonic idempotency key if missing.
 * 6. Dispatches to Command Gateway with actor = 'ai'.
 */
export async function executeAiCommand(
  untrustedInput: unknown,
  options: AiExecutionOptions = {}
): Promise<AiCommandExecutionResult> {
  let parsed: any = untrustedInput;

  if (typeof untrustedInput === 'string') {
    try {
      parsed = JSON.parse(untrustedInput);
    } catch {
      return {
        success: false,
        message: '',
        error: 'Failed to parse AI output: Malformed JSON string',
        requestId: options.idempotencyKey || 'unknown',
      };
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      success: false,
      message: '',
      error: 'AI command must be a non-null object',
      requestId: options.idempotencyKey || 'unknown',
    };
  }

  const action = parsed.action as CommandAction;
  if (!action || typeof action !== 'string') {
    return {
      success: false,
      message: '',
      error: 'Missing or invalid "action" in AI command',
      requestId: options.idempotencyKey || 'unknown',
    };
  }

  const rawPayload = parsed.payload ?? parsed.params ?? {};
  let sanitizedPayload: Record<string, unknown>;
  try {
    sanitizedPayload = sanitizeAiPayload(rawPayload);
  } catch (sanitizeErr: any) {
    logger.warn('AI command rejected during payload sanitization');
    return {
      success: false,
      message: '',
      error: sanitizeErr.message || 'Adversarial payload rejected by sandbox',
      requestId: options.idempotencyKey || parsed.idempotencyKey || 'unknown',
    };
  }

  // Strict authorization: Untrusted AI input cannot self-authorize destructive actions
  const isConfirmed = options.confirmed === true;
  const idempotencyKey =
    options.idempotencyKey ||
    (typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey.trim().length >= 4
      ? parsed.idempotencyKey
      : `cmd_ai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

  // Destructive Action Confirmation Gate
  if (DESTRUCTIVE_ACTIONS.includes(action) && !isConfirmed) {
    return {
      success: false,
      requiresConfirmation: true,
      message: 'Action requires user confirmation before proceeding',
      error: `Destructive action "${action}" initiated by AI requires explicit user confirmation`,
      requestId: idempotencyKey,
      rulesApplied: ['SYS_AI_CONFIRMATION_GATE_001'],
    };
  }

  const dispatchedCommand: DispatchedCommand = {
    action,
    payload: sanitizedPayload as any,
    idempotencyKey,
    actor: 'ai',
    confirmed: isConfirmed,
  };

  return executeCommand(dispatchedCommand);
}
