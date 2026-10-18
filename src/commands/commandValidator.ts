/**
 * KwestUp 4.0 — Command Gateway Validator
 *
 * Enforces strict schema verification, boundary constraints, and actor capabilities
 * across all 11 discrete CommandAction types before any execution can occur.
 *
 * Source: rulebook/machine/rules.json, rulebook/ai/intent-parser.md, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import {
  CommandAction,
  CommandActor,
  CommandValidationResult,
  DispatchedCommand,
} from './types';
import { loadMachineRules, evaluateRules } from '../behavior/ruleEngine';
import { FrictionCategory } from '../behavior/types';

export const SUPPORTED_COMMAND_ACTIONS: readonly CommandAction[] = [
  'CREATE_HABIT',
  'UPDATE_HABIT',
  'DELETE_HABIT',
  'LOG_HABIT',
  'START_RECOVERY',
  'DISMISS_INTERVENTION',
  'ADJUST_DIFFICULTY',
  'CREATE_IDENTITY',
  'PAUSE_HABIT',
  'ARCHIVE_HABIT',
  'RESUME_HABIT',
] as const;

const VALID_FRICTION_CATEGORIES: readonly FrictionCategory[] = [
  'effort',
  'time',
  'setup',
  'emotional',
  'mental',
  'location',
] as const;

const VALID_FREQUENCIES = ['daily', 'weekdays', 'weekends', 'weekly', 'custom'] as const;
const VALID_CUE_TYPES = ['time', 'after-habit', 'task-completion', 'manual', 'morning', 'evening'] as const;
const VALID_DISMISS_REASONS = ['acted', 'dismissed', 'expired'] as const;
const VALID_ACTORS = ['ai', 'user', 'widget', 'engine'] as const;

const FORBIDDEN_UPDATE_KEYS = [
  'status',
  'streakCount',
  'bestStreak',
  'totalEvidenceVotes',
  'lastCompletedDate',
  'createdAt',
  'id',
] as const;

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ValidationOptions {
  caller?: CommandActor;
}

/**
 * Evaluates whether a requested command action is supported by the system capability catalog,
 * applying deterministic machine rule SYS_COMMAND_CAPABILITY_CHECK_001.
 */
export function checkCommandCapability(action: string): { supported: boolean; rulesApplied: string[] } {
  const isSupported = (SUPPORTED_COMMAND_ACTIONS as readonly string[]).includes(action);
  const systemRules = loadMachineRules('system');
  const context = {
    command: 'VALIDATE',
    capabilitySupported: isSupported,
  };
  const result = evaluateRules(systemRules, context);
  const rulesApplied = [...result.rulesApplied];

  if (!isSupported && !rulesApplied.includes('SYS_COMMAND_CAPABILITY_CHECK_001')) {
    rulesApplied.push('SYS_COMMAND_CAPABILITY_CHECK_001');
  }

  return { supported: isSupported, rulesApplied };
}

/**
 * Deeply validates a dispatched command against strict schema boundaries,
 * parameter constraints, actor capabilities, and security rules.
 */
export function validateCommand(
  command: DispatchedCommand,
  options: ValidationOptions = {}
): CommandValidationResult {
  const errors: string[] = [];
  const rulesApplied: string[] = [];

  // 1. Structure & Top-Level Invariants
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    return {
      valid: false,
      errors: ['Command must be a non-null object'],
      rulesApplied: [],
    };
  }

  // 2. Idempotency Key Validation
  if (
    typeof command.idempotencyKey !== 'string' ||
    command.idempotencyKey.trim().length < 4 ||
    command.idempotencyKey.length > 128
  ) {
    errors.push('idempotencyKey must be a non-empty string between 4 and 128 characters');
  }

  // 3. Action Capability Check (SYS_COMMAND_CAPABILITY_CHECK_001)
  const capability = checkCommandCapability(command.action);
  capability.rulesApplied.forEach((r) => {
    if (!rulesApplied.includes(r)) rulesApplied.push(r);
  });

  if (!capability.supported) {
    errors.push(`Unsupported command action: "${command.action}"`);
    return { valid: false, errors, rulesApplied };
  }

  // 4. Actor Resolution & Permissions
  const actor: CommandActor = command.actor || options.caller || 'user';
  if (!VALID_ACTORS.includes(actor)) {
    errors.push(`Invalid command actor: "${actor}"`);
  }

  // 5. Payload Object Check
  const rawPayload = command.payload;
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    errors.push('Command payload must be a non-null object');
    return { valid: false, errors, rulesApplied };
  }
  const p = rawPayload as Record<string, unknown>;

  // 6. Action-Specific Parameter Validation
  switch (command.action) {
    case 'CREATE_HABIT': {
      const {
        identityId,
        title,
        behavior,
        minimumAction,
        normalTarget,
        stretchTarget,
        frequency,
        customSchedule,
        cueType,
        cueTime,
        cueLocation,
      } = p;
      if (identityId !== undefined && (typeof identityId !== 'string' || identityId.trim().length === 0 || identityId.length > 100)) {
        errors.push('CREATE_HABIT: identityId must be a non-empty string up to 100 characters');
      }
      if (typeof title !== 'string' || title.trim().length === 0 || title.length > 100) {
        errors.push('CREATE_HABIT: title must be a non-empty string up to 100 characters');
      }
      if (typeof behavior !== 'string' || behavior.trim().length === 0 || behavior.length > 200) {
        errors.push('CREATE_HABIT: behavior must be a non-empty string up to 200 characters');
      }
      if (typeof minimumAction !== 'string' || minimumAction.trim().length === 0 || minimumAction.length > 100) {
        errors.push('CREATE_HABIT: minimumAction must be a non-empty string up to 100 characters');
      }
      if (typeof normalTarget !== 'string' || normalTarget.trim().length === 0 || normalTarget.length > 100) {
        errors.push('CREATE_HABIT: normalTarget must be a non-empty string up to 100 characters');
      }
      if (stretchTarget !== undefined && (typeof stretchTarget !== 'string' || stretchTarget.length > 100)) {
        errors.push('CREATE_HABIT: stretchTarget must be a string up to 100 characters');
      }
      if (typeof frequency !== 'string' || !(VALID_FREQUENCIES as readonly string[]).includes(frequency)) {
        errors.push(`CREATE_HABIT: frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);
      }
      if (frequency === 'custom') {
        const sched = customSchedule as Record<string, unknown> | undefined;
        const weekdays = sched?.weekdays;
        if (!Array.isArray(weekdays) || weekdays.length === 0 || weekdays.length > 7) {
          errors.push('CREATE_HABIT: custom frequency requires customSchedule.weekdays array (1-7 items)');
        } else {
          const uniqueDays = new Set(weekdays);
          const allValid = weekdays.every((d: unknown) => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6);
          if (!allValid || uniqueDays.size !== weekdays.length) {
            errors.push('CREATE_HABIT: weekdays must contain unique integers between 0 (Sunday) and 6 (Saturday)');
          }
        }
      }
      if (typeof cueType !== 'string' || !(VALID_CUE_TYPES as readonly string[]).includes(cueType)) {
        errors.push(`CREATE_HABIT: cueType must be one of: ${VALID_CUE_TYPES.join(', ')}`);
      }
      if (cueTime !== undefined) {
        if (typeof cueTime !== 'string' || !TIME_REGEX.test(cueTime)) {
          errors.push('CREATE_HABIT: cueTime must match 24-hour format HH:mm (e.g. 08:30, 20:00)');
        }
      } else if (cueType === 'time') {
        errors.push('CREATE_HABIT: cueTime is required when cueType is "time"');
      }
      if (cueLocation !== undefined && (typeof cueLocation !== 'string' || cueLocation.length > 100)) {
        errors.push('CREATE_HABIT: cueLocation must be a string up to 100 characters');
      }
      break;
    }

    case 'UPDATE_HABIT': {
      const habitId = p.habitId;
      const updates = p.updates as Record<string, unknown> | undefined;
      if (typeof habitId !== 'string' || habitId.trim().length === 0) {
        errors.push('UPDATE_HABIT: habitId must be a non-empty string');
      }
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        errors.push('UPDATE_HABIT: updates must be a non-null object');
      } else {
        // Enforce engine-owned state invariant
        for (const forbiddenKey of FORBIDDEN_UPDATE_KEYS) {
          if (forbiddenKey in updates) {
            errors.push(
              `UPDATE_HABIT: Field "${forbiddenKey}" is engine-owned and cannot be modified via command`
            );
          }
        }

        const allowedKeys = ['title', 'behavior', 'minimumAction', 'normalTarget', 'stretchTarget'];
        for (const key of Object.keys(updates)) {
          if (!allowedKeys.includes(key) && !(FORBIDDEN_UPDATE_KEYS as readonly string[]).includes(key)) {
            errors.push(`UPDATE_HABIT: Field "${key}" is not a permitted update field`);
          }
        }

        const presentAllowed = Object.keys(updates).filter((k) => allowedKeys.includes(k));
        if (presentAllowed.length === 0) {
          errors.push('UPDATE_HABIT: updates must contain at least one modifiable field');
        }

        const { title, behavior, minimumAction, normalTarget, stretchTarget } = updates;
        if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 100)) {
          errors.push('UPDATE_HABIT: title must be a non-empty string up to 100 characters');
        }
        if (behavior !== undefined && (typeof behavior !== 'string' || behavior.trim().length === 0 || behavior.length > 200)) {
          errors.push('UPDATE_HABIT: behavior must be a non-empty string up to 200 characters');
        }
        if (minimumAction !== undefined && (typeof minimumAction !== 'string' || minimumAction.trim().length === 0 || minimumAction.length > 100)) {
          errors.push('UPDATE_HABIT: minimumAction must be a non-empty string up to 100 characters');
        }
        if (normalTarget !== undefined && (typeof normalTarget !== 'string' || normalTarget.trim().length === 0 || normalTarget.length > 100)) {
          errors.push('UPDATE_HABIT: normalTarget must be a non-empty string up to 100 characters');
        }
        if (stretchTarget !== undefined && (typeof stretchTarget !== 'string' || stretchTarget.length > 100)) {
          errors.push('UPDATE_HABIT: stretchTarget must be a string up to 100 characters');
        }
      }
      break;
    }

    case 'DELETE_HABIT': {
      const habitId = p.habitId;
      if (typeof habitId !== 'string' || habitId.trim().length === 0) {
        errors.push('DELETE_HABIT: habitId must be a non-empty string');
      }
      // AI actor destructive confirmation gate
      if (actor === 'ai' && !command.confirmed) {
        errors.push('Destructive action DELETE_HABIT initiated by AI requires explicit user confirmation');
      }
      break;
    }

    case 'LOG_HABIT': {
      const { habitId, completedAt, durationMinutes, frictionCategory } = p;
      if (typeof habitId !== 'string' || habitId.trim().length === 0) {
        errors.push('LOG_HABIT: habitId must be a non-empty string');
      }
      if (typeof completedAt !== 'string' || isNaN(Date.parse(completedAt))) {
        errors.push('LOG_HABIT: completedAt must be a valid ISO 8601 date timestamp');
      }
      if (durationMinutes !== undefined && (typeof durationMinutes !== 'number' || durationMinutes < 0)) {
        errors.push('LOG_HABIT: durationMinutes must be a non-negative number');
      }
      if (frictionCategory !== undefined && !(VALID_FRICTION_CATEGORIES as readonly unknown[]).includes(frictionCategory)) {
        errors.push(`LOG_HABIT: frictionCategory must be one of: ${VALID_FRICTION_CATEGORIES.join(', ')}`);
      }
      break;
    }

    case 'START_RECOVERY': {
      const { habitId, reason } = p;
      if (typeof habitId !== 'string' || habitId.trim().length === 0) {
        errors.push('START_RECOVERY: habitId must be a non-empty string');
      }
      if (!(VALID_FRICTION_CATEGORIES as readonly unknown[]).includes(reason)) {
        errors.push(`START_RECOVERY: reason must be a valid FrictionCategory: ${VALID_FRICTION_CATEGORIES.join(', ')}`);
      }
      break;
    }

    case 'DISMISS_INTERVENTION': {
      const { interventionId, reason } = p;
      if (typeof interventionId !== 'string' || interventionId.trim().length === 0) {
        errors.push('DISMISS_INTERVENTION: interventionId must be a non-empty string');
      }
      if (!(VALID_DISMISS_REASONS as readonly unknown[]).includes(reason)) {
        errors.push(`DISMISS_INTERVENTION: reason must be one of: ${VALID_DISMISS_REASONS.join(', ')}`);
      }
      break;
    }

    case 'ADJUST_DIFFICULTY': {
      const { habitId, direction, newMinimumAction } = p;
      if (typeof habitId !== 'string' || habitId.trim().length === 0) {
        errors.push('ADJUST_DIFFICULTY: habitId must be a non-empty string');
      }
      if (direction !== 'easier' && direction !== 'harder') {
        errors.push('ADJUST_DIFFICULTY: direction must be "easier" or "harder"');
      }
      if (
        typeof newMinimumAction !== 'string' ||
        newMinimumAction.trim().length === 0 ||
        newMinimumAction.length > 100
      ) {
        errors.push('ADJUST_DIFFICULTY: newMinimumAction must be a non-empty string up to 100 characters');
      }
      break;
    }

    case 'CREATE_IDENTITY': {
      const statement = p.statement;
      if (typeof statement !== 'string' || statement.trim().length === 0 || statement.length > 200) {
        errors.push('CREATE_IDENTITY: statement must be a non-empty string up to 200 characters');
      }
      break;
    }

    case 'PAUSE_HABIT': {
      const { habitId, reason } = p;
      const effectiveActor = (p.actor as CommandActor) || actor;
      if (typeof habitId !== 'string' || habitId.trim().length === 0) {
        errors.push('PAUSE_HABIT: habitId must be a non-empty string');
      }
      if (effectiveActor !== 'user' && effectiveActor !== 'engine' && effectiveActor !== 'ai') {
        errors.push('PAUSE_HABIT: actor must be "user" or "engine"');
      }
      if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 200) {
        errors.push('PAUSE_HABIT: reason must be a non-empty string up to 200 characters');
      }
      break;
    }

    case 'ARCHIVE_HABIT': {
      const { habitId, reason } = p;
      const effectiveActor = (p.actor as CommandActor) || actor;
      if (typeof habitId !== 'string' || habitId.trim().length === 0) {
        errors.push('ARCHIVE_HABIT: habitId must be a non-empty string');
      }
      if (effectiveActor !== 'user' && effectiveActor !== 'engine' && effectiveActor !== 'ai') {
        errors.push('ARCHIVE_HABIT: actor must be "user" or "engine"');
      }
      if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 200) {
        errors.push('ARCHIVE_HABIT: reason must be a non-empty string up to 200 characters');
      }
      if ((actor === 'ai' || effectiveActor === 'ai') && !command.confirmed) {
        errors.push('Destructive action ARCHIVE_HABIT initiated by AI requires explicit user confirmation');
      }
      break;
    }

    case 'RESUME_HABIT': {
      const { habitId, reason } = p;
      const effectiveActor = (p.actor as CommandActor) || actor;
      if (typeof habitId !== 'string' || habitId.trim().length === 0) {
        errors.push('RESUME_HABIT: habitId must be a non-empty string');
      }
      if (effectiveActor !== 'user' && effectiveActor !== 'engine' && effectiveActor !== 'ai') {
        errors.push('RESUME_HABIT: actor must be "user" or "engine"');
      }
      if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 200) {
        errors.push('RESUME_HABIT: reason must be a non-empty string up to 200 characters');
      }
      break;
    }

    default:
      errors.push(`Unhandled validation for action: "${command.action}"`);
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    rulesApplied,
  };
}
