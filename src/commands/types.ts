/**
 * KwestUp 4.0 — Command Registry & Sandbox Execution Types
 *
 * Source: 4.0/KwestUp_4.0_Master_Plan.md, rulebook/ai/intent-parser.md
 */

import { CueType, Habit, FrictionCategory } from '../behavior/types';

export type CommandAction =
  | 'CREATE_HABIT'
  | 'UPDATE_HABIT'
  | 'DELETE_HABIT'
  | 'LOG_HABIT'
  | 'START_RECOVERY'
  | 'DISMISS_INTERVENTION'
  | 'ADJUST_DIFFICULTY';

export type CommandPayload<A extends CommandAction> =
  A extends 'CREATE_HABIT'
    ? {
        identityId: string;
        title: string;
        behavior: string;
        minimumAction: string;
        normalTarget: string;
        cueType: CueType;
        cueTime?: string;
      }
    : A extends 'UPDATE_HABIT'
    ? {
        habitId: string;
        updates: Partial<Pick<Habit, 'title' | 'behavior' | 'minimumAction' | 'normalTarget' | 'status'>>;
      }
    : A extends 'LOG_HABIT'
    ? {
        habitId: string;
        completedAt: string;
        durationMinutes?: number;
        frictionCategory?: FrictionCategory;
      }
    : A extends 'START_RECOVERY'
    ? {
        habitId: string;
        reason: FrictionCategory;
      }
    : A extends 'DELETE_HABIT'
    ? {
        habitId: string;
      }
    : A extends 'DISMISS_INTERVENTION'
    ? {
        interventionId: string;
        reason: 'acted' | 'dismissed' | 'expired';
      }
    : A extends 'ADJUST_DIFFICULTY'
    ? {
        habitId: string;
        direction: 'easier' | 'harder';
        newMinimumAction: string;
      }
    : never;

export interface CommandValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface CommandExecutionResult {
  success: boolean;
  entityId?: string;
  message: string;
  error?: string;
}
