/**
 * KwestUp 4.0 — Command Gateway Executor
 *
 * Provides bounded in-memory idempotency deduplication (SYS_IDEMPOTENT_COMMAND_001),
 * handler registry dispatch, error isolation, and COMMAND_EXECUTED telemetry emission.
 *
 * Source: rulebook/machine/rules.json, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import {
  CommandAction,
  CommandActor,
  CommandExecutionResult,
  CommandPayload,
  DispatchedCommand,
} from './types';
import { validateCommand } from './commandValidator';
import { eventBus } from '../behavior/eventBus';
import { logger } from '../utils/logger';
import { loadMachineRules, evaluateRules } from '../behavior/ruleEngine';

export const MAX_IDEMPOTENCY_CACHE_SIZE = 200;
export const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CachedExecution {
  result: CommandExecutionResult;
  timestamp: number;
}

export type CommandHandler<A extends CommandAction = CommandAction> = (
  payload: CommandPayload<A>,
  meta: { idempotencyKey: string; actor: CommandActor }
) =>
  | Promise<{ entityId?: string; message: string; rulesApplied?: string[] }>
  | { entityId?: string; message: string; rulesApplied?: string[] };

const idempotencyCache = new Map<string, CachedExecution>();
const handlers = new Map<CommandAction, CommandHandler<any>>();

/**
 * Registers an execution handler for a specific CommandAction.
 */
export function registerCommandHandler<A extends CommandAction>(
  action: A,
  handler: CommandHandler<A>
): void {
  handlers.set(action, handler);
}

/**
 * Unregisters an execution handler for a specific CommandAction.
 */
export function unregisterCommandHandler(action: CommandAction): void {
  handlers.delete(action);
}

/**
 * Clears all registered command handlers.
 */
export function clearCommandHandlers(): void {
  handlers.clear();
}

/**
 * Clears the in-memory idempotency cache (used for tests and cache invalidation).
 */
export function clearIdempotencyCache(): void {
  idempotencyCache.clear();
}

/**
 * Returns current idempotency cache size.
 */
export function getIdempotencyCacheSize(): number {
  return idempotencyCache.size;
}

/**
 * Purges expired idempotency records from memory based on IDEMPOTENCY_TTL_MS.
 */
export function purgeExpiredEntries(now: number = Date.now()): number {
  let purged = 0;
  for (const [key, item] of idempotencyCache.entries()) {
    if (now - item.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
      purged++;
    }
  }
  return purged;
}

function setInCache(key: string, result: CommandExecutionResult): void {
  if (idempotencyCache.has(key)) {
    idempotencyCache.delete(key);
  } else if (idempotencyCache.size >= MAX_IDEMPOTENCY_CACHE_SIZE) {
    purgeExpiredEntries();
    if (idempotencyCache.size >= MAX_IDEMPOTENCY_CACHE_SIZE) {
      const oldestKey = idempotencyCache.keys().next().value;
      if (oldestKey !== undefined) {
        idempotencyCache.delete(oldestKey);
      }
    }
  }
  idempotencyCache.set(key, {
    result,
    timestamp: Date.now(),
  });
}

function mapActorToEventSource(
  actor: CommandActor
): 'app' | 'widget' | 'notification' | 'system' | 'ai' {
  switch (actor) {
    case 'ai':
      return 'ai';
    case 'widget':
      return 'widget';
    case 'engine':
      return 'system';
    case 'user':
    default:
      return 'app';
  }
}

/**
 * Executes a validated, sandboxed command idempotently.
 *
 * 1. Deep schema and capability validation (commandValidator).
 * 2. Idempotency cache lookup (returns cached result if replayed within TTL).
 * 3. Handler dispatch with error boundary isolation.
 * 4. Telemetry event emission (COMMAND_EXECUTED / COMMAND_FAILED) via eventBus.
 */
export async function executeCommand<A extends CommandAction = CommandAction>(
  command: DispatchedCommand<A>
): Promise<CommandExecutionResult> {
  const actor: CommandActor = command?.actor || 'user';
  const requestId = command?.idempotencyKey || 'unknown';

  // 1. Validation
  const validation = validateCommand(command, { caller: actor });
  if (!validation.valid) {
    return {
      success: false,
      message: '',
      error: validation.errors.join('; '),
      requestId,
      rulesApplied: validation.rulesApplied || [],
    };
  }

  // 2. Idempotency Check (SYS_IDEMPOTENT_COMMAND_001)
  const cached = idempotencyCache.get(command.idempotencyKey);
  const now = Date.now();
  if (cached) {
    if (now - cached.timestamp <= IDEMPOTENCY_TTL_MS) {
      const systemRules = loadMachineRules('system');
      const evalResult = evaluateRules(systemRules, {
        command: 'DISPATCH',
        isDuplicateKey: true,
      });
      const rulesApplied = Array.from(
        new Set([
          ...(cached.result.rulesApplied || []),
          ...evalResult.rulesApplied,
          'SYS_IDEMPOTENT_COMMAND_001',
        ])
      );
      return {
        ...cached.result,
        rulesApplied,
      };
    } else {
      idempotencyCache.delete(command.idempotencyKey);
    }
  }

  // 3. Handler Resolution
  const handler = handlers.get(command.action);
  if (!handler) {
    return {
      success: false,
      message: '',
      error: `No handler registered for command action: "${command.action}"`,
      requestId: command.idempotencyKey,
      rulesApplied: validation.rulesApplied || [],
    };
  }

  // 4. Isolated Execution
  try {
    const handlerResult = await handler(command.payload, {
      idempotencyKey: command.idempotencyKey,
      actor,
    });

    const rulesApplied = Array.from(
      new Set([
        ...(validation.rulesApplied || []),
        ...(handlerResult?.rulesApplied || []),
      ])
    );

    const executionResult: CommandExecutionResult = {
      success: true,
      entityId: handlerResult?.entityId,
      message: handlerResult?.message || '',
      requestId: command.idempotencyKey,
      rulesApplied,
    };

    // Cache successful execution result
    setInCache(command.idempotencyKey, executionResult);

    // Emit domain event for command execution telemetry
    try {
      eventBus.emit({
        type: 'COMMAND_EXECUTED',
        entityId: executionResult.entityId || command.idempotencyKey,
        source: mapActorToEventSource(actor),
        payload: {
          action: command.action,
          requestId: command.idempotencyKey,
          rulesApplied,
        },
      });
    } catch (emitErr) {
      logger.warn('Failed to emit COMMAND_EXECUTED event:', emitErr);
    }

    return executionResult;
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || 'Execution failed';
    logger.error(`Command execution failed for "${command.action}" (${command.idempotencyKey}):`, err);

    try {
      eventBus.emit({
        type: 'COMMAND_FAILED',
        entityId: command.idempotencyKey,
        source: mapActorToEventSource(actor),
        payload: {
          action: command.action,
          requestId: command.idempotencyKey,
          error: errorMessage,
        },
      });
    } catch {
      // Prevent telemetry failure from altering isolation
    }

    return {
      success: false,
      message: '',
      error: errorMessage,
      requestId: command.idempotencyKey,
      rulesApplied: validation.rulesApplied || [],
    };
  }
}
