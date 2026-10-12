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
  const payload = command.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('Command payload must be a non-null object');
    return { valid: false, errors, rulesApplied };
  }

  // 6. Action-Specific Parameter Validation
  switch (command.action) {
    case 'CREATE_HABIT': {
      const p = payload as any;
      if (p.identityId !== undefined && (typeof p.identityId !== 'string' || p.identityId.trim().length === 0 || p.identityId.length > 100)) {
        errors.push('CREATE_HABIT: identityId must be a non-empty string up to 100 characters');
      }
      if (typeof p.title !== 'string' || p.title.trim().length === 0 || p.title.length > 100) {
        errors.push('CREATE_HABIT: title must be a non-empty string up to 100 characters');
      }
      if (typeof p.behavior !== 'string' || p.behavior.trim().length === 0 || p.behavior.length > 200) {
        errors.push('CREATE_HABIT: behavior must be a non-empty string up to 200 characters');
      }
      if (typeof p.minimumAction !== 'string' || p.minimumAction.trim().length === 0 || p.minimumAction.length > 100) {
        errors.push('CREATE_HABIT: minimumAction must be a non-empty string up to 100 characters');
      }
      if (typeof p.normalTarget !== 'string' || p.normalTarget.trim().length === 0 || p.normalTarget.length > 100) {
        errors.push('CREATE_HABIT: normalTarget must be a non-empty string up to 100 characters');
      }
      if (p.stretchTarget !== undefined && (typeof p.stretchTarget !== 'string' || p.stretchTarget.length > 100)) {
        errors.push('CREATE_HABIT: stretchTarget must be a string up to 100 characters');
      }
      if (!VALID_FREQUENCIES.includes(p.frequency)) {
        errors.push(`CREATE_HABIT: frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);
      }
      if (p.frequency === 'custom') {
        const weekdays = p.customSchedule?.weekdays;
        if (!Array.isArray(weekdays) || weekdays.length === 0 || weekdays.length > 7) {
          errors.push('CREATE_HABIT: custom frequency requires customSchedule.weekdays array (1-7 items)');
        } else {
          const uniqueDays = new Set(weekdays);
          const allValid = weekdays.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6);
          if (!allValid || uniqueDays.size !== weekdays.length) {
            errors.push('CREATE_HABIT: weekdays must contain unique integers between 0 (Sunday) and 6 (Saturday)');
          }
        }
      }
      if (!VALID_CUE_TYPES.includes(p.cueType)) {
        errors.push(`CREATE_HABIT: cueType must be one of: ${VALID_CUE_TYPES.join(', ')}`);
      }
      if (p.cueTime !== undefined) {
        if (typeof p.cueTime !== 'string' || !TIME_REGEX.test(p.cueTime)) {
          errors.push('CREATE_HABIT: cueTime must match 24-hour format HH:mm (e.g. 08:30, 20:00)');
        }
      } else if (p.cueType === 'time') {
        errors.push('CREATE_HABIT: cueTime is required when cueType is "time"');
      }
      if (p.cueLocation !== undefined && (typeof p.cueLocation !== 'string' || p.cueLocation.length > 100)) {
        errors.push('CREATE_HABIT: cueLocation must be a string up to 100 characters');
      }
      break;
    }

    case 'UPDATE_HABIT': {
      const p = payload as any;
      if (typeof p.habitId !== 'string' || p.habitId.trim().length === 0) {
        errors.push('UPDATE_HABIT: habitId must be a non-empty string');
      }
      if (!p.updates || typeof p.updates !== 'object' || Array.isArray(p.updates)) {
        errors.push('UPDATE_HABIT: updates must be a non-null object');
      } else {
        // Enforce engine-owned state invariant
        for (const forbiddenKey of FORBIDDEN_UPDATE_KEYS) {
          if (forbiddenKey in p.updates) {
            errors.push(
              `UPDATE_HABIT: Field "${forbiddenKey}" is engine-owned and cannot be modified via command`
            );
          }
        }

        const allowedKeys = ['title', 'behavior', 'minimumAction', 'normalTarget', 'stretchTarget'];
        for (const key of Object.keys(p.updates)) {
          if (!allowedKeys.includes(key) && !FORBIDDEN_UPDATE_KEYS.includes(key as any)) {
            errors.push(`UPDATE_HABIT: Field "${key}" is not a permitted update field`);
          }
        }

        const presentAllowed = Object.keys(p.updates).filter((k) => allowedKeys.includes(k));
        if (presentAllowed.length === 0) {
          errors.push('UPDATE_HABIT: updates must contain at least one modifiable field');
        }

        if (p.updates.title !== undefined && (typeof p.updates.title !== 'string' || p.updates.title.trim().length === 0 || p.updates.title.length > 100)) {
          errors.push('UPDATE_HABIT: title must be a non-empty string up to 100 characters');
        }
        if (p.updates.behavior !== undefined && (typeof p.updates.behavior !== 'string' || p.updates.behavior.trim().length === 0 || p.updates.behavior.length > 200)) {
          errors.push('UPDATE_HABIT: behavior must be a non-empty string up to 200 characters');
        }
        if (p.updates.minimumAction !== undefined && (typeof p.updates.minimumAction !== 'string' || p.updates.minimumAction.trim().length === 0 || p.updates.minimumAction.length > 100)) {
          errors.push('UPDATE_HABIT: minimumAction must be a non-empty string up to 100 characters');
        }
        if (p.updates.normalTarget !== undefined && (typeof p.updates.normalTarget !== 'string' || p.updates.normalTarget.trim().length === 0 || p.updates.normalTarget.length > 100)) {
          errors.push('UPDATE_HABIT: normalTarget must be a non-empty string up to 100 characters');
        }
        if (p.updates.stretchTarget !== undefined && (typeof p.updates.stretchTarget !== 'string' || p.updates.stretchTarget.length > 100)) {
          errors.push('UPDATE_HABIT: stretchTarget must be a string up to 100 characters');
        }
      }
      break;
    }

    case 'DELETE_HABIT': {
      const p = payload as any;
      if (typeof p.habitId !== 'string' || p.habitId.trim().length === 0) {
        errors.push('DELETE_HABIT: habitId must be a non-empty string');
      }
      // AI actor destructive confirmation gate
      if (actor === 'ai' && !command.confirmed) {
        errors.push('Destructive action DELETE_HABIT initiated by AI requires explicit user confirmation');
      }
      break;
    }

    case 'LOG_HABIT': {
      const p = payload as any;
      if (typeof p.habitId !== 'string' || p.habitId.trim().length === 0) {
        errors.push('LOG_HABIT: habitId must be a non-empty string');
      }
      if (typeof p.completedAt !== 'string' || isNaN(Date.parse(p.completedAt))) {
        errors.push('LOG_HABIT: completedAt must be a valid ISO 8601 date timestamp');
      }
      if (p.durationMinutes !== undefined && (typeof p.durationMinutes !== 'number' || p.durationMinutes < 0)) {
        errors.push('LOG_HABIT: durationMinutes must be a non-negative number');
      }
      if (p.frictionCategory !== undefined && !VALID_FRICTION_CATEGORIES.includes(p.frictionCategory)) {
        errors.push(`LOG_HABIT: frictionCategory must be one of: ${VALID_FRICTION_CATEGORIES.join(', ')}`);
      }
      break;
    }

    case 'START_RECOVERY': {
      const p = payload as any;
      if (typeof p.habitId !== 'string' || p.habitId.trim().length === 0) {
        errors.push('START_RECOVERY: habitId must be a non-empty string');
      }
      if (!VALID_FRICTION_CATEGORIES.includes(p.reason)) {
        errors.push(`START_RECOVERY: reason must be a valid FrictionCategory: ${VALID_FRICTION_CATEGORIES.join(', ')}`);
      }
      break;
    }

    case 'DISMISS_INTERVENTION': {
      const p = payload as any;
      if (typeof p.interventionId !== 'string' || p.interventionId.trim().length === 0) {
        errors.push('DISMISS_INTERVENTION: interventionId must be a non-empty string');
      }
      if (!VALID_DISMISS_REASONS.includes(p.reason)) {
        errors.push(`DISMISS_INTERVENTION: reason must be one of: ${VALID_DISMISS_REASONS.join(', ')}`);
      }
      break;
    }

    case 'ADJUST_DIFFICULTY': {
      const p = payload as any;
      if (typeof p.habitId !== 'string' || p.habitId.trim().length === 0) {
        errors.push('ADJUST_DIFFICULTY: habitId must be a non-empty string');
      }
      if (p.direction !== 'easier' && p.direction !== 'harder') {
        errors.push('ADJUST_DIFFICULTY: direction must be "easier" or "harder"');
      }
      if (
        typeof p.newMinimumAction !== 'string' ||
        p.newMinimumAction.trim().length === 0 ||
        p.newMinimumAction.length > 100
      ) {
        errors.push('ADJUST_DIFFICULTY: newMinimumAction must be a non-empty string up to 100 characters');
      }
      break;
    }

    case 'CREATE_IDENTITY': {
      const p = payload as any;
      if (typeof p.statement !== 'string' || p.statement.trim().length === 0 || p.statement.length > 200) {
        errors.push('CREATE_IDENTITY: statement must be a non-empty string up to 200 characters');
      }
      break;
    }

    case 'PAUSE_HABIT': {
      const p = payload as any;
      const effectiveActor = p.actor || actor;
      if (typeof p.habitId !== 'string' || p.habitId.trim().length === 0) {
        errors.push('PAUSE_HABIT: habitId must be a non-empty string');
      }
      if (effectiveActor !== 'user' && effectiveActor !== 'engine' && effectiveActor !== 'ai') {
        errors.push('PAUSE_HABIT: actor must be "user" or "engine"');
      }
      if (typeof p.reason !== 'string' || p.reason.trim().length === 0 || p.reason.length > 200) {
        errors.push('PAUSE_HABIT: reason must be a non-empty string up to 200 characters');
      }
      break;
    }

    case 'ARCHIVE_HABIT': {
      const p = payload as any;
      const effectiveActor = p.actor || actor;
      if (typeof p.habitId !== 'string' || p.habitId.trim().length === 0) {
        errors.push('ARCHIVE_HABIT: habitId must be a non-empty string');
      }
      if (effectiveActor !== 'user' && effectiveActor !== 'engine' && effectiveActor !== 'ai') {
        errors.push('ARCHIVE_HABIT: actor must be "user" or "engine"');
      }
      if (typeof p.reason !== 'string' || p.reason.trim().length === 0 || p.reason.length > 200) {
        errors.push('ARCHIVE_HABIT: reason must be a non-empty string up to 200 characters');
      }
      if ((actor === 'ai' || effectiveActor === 'ai') && !command.confirmed) {
        errors.push('Destructive action ARCHIVE_HABIT initiated by AI requires explicit user confirmation');
      }
      break;
    }

    case 'RESUME_HABIT': {
      const p = payload as any;
      const effectiveActor = p.actor || actor;
      if (typeof p.habitId !== 'string' || p.habitId.trim().length === 0) {
        errors.push('RESUME_HABIT: habitId must be a non-empty string');
      }
      if (effectiveActor !== 'user' && effectiveActor !== 'engine' && effectiveActor !== 'ai') {
        errors.push('RESUME_HABIT: actor must be "user" or "engine"');
      }
      if (typeof p.reason !== 'string' || p.reason.trim().length === 0 || p.reason.length > 200) {
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
