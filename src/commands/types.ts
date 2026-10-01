/**
 * KwestUp 4.0 — Command Registry & Sandbox Execution Types
 *
 * Source: 4.0/KwestUp_4.0_Master_Plan.md, rulebook/ai/intent-parser.md
 */

import { CueType, Habit, HabitFrequency, FrictionCategory } from '../behavior/types';

export interface CustomSchedule {
  weekdays: number[]; // 0=Sunday..6=Saturday
}

export type CommandAction =
  | 'CREATE_HABIT'
  | 'UPDATE_HABIT'
  | 'DELETE_HABIT'
  | 'LOG_HABIT'
  | 'START_RECOVERY'
  | 'DISMISS_INTERVENTION'
  | 'ADJUST_DIFFICULTY'
  | 'CREATE_IDENTITY'
  | 'PAUSE_HABIT'
  | 'ARCHIVE_HABIT'
  | 'RESUME_HABIT';

export type CommandPayload<A extends CommandAction> =
  A extends 'CREATE_HABIT'
    ? {
        identityId: string;
        title: string;
        behavior: string;
        minimumAction: string;
        normalTarget: string;
        stretchTarget?: string;
        frequency: HabitFrequency;
        customSchedule?: CustomSchedule;
        cueType: CueType;
        cueTime?: string;
        cueLocation?: string;
      }
    : A extends 'UPDATE_HABIT'
    ? {
        habitId: string;
        // NOTE: 'status' is engine-owned (midnight-rollover state machine in
        // rulebook/rules/missed-habit.md) and never AI-settable. Use
        // PAUSE_HABIT / ARCHIVE_HABIT / RESUME_HABIT with actor + reason.
        updates: Partial<Pick<Habit, 'title' | 'behavior' | 'minimumAction' | 'normalTarget'>>;
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
    : A extends 'CREATE_IDENTITY'
    ? {
        statement: string;
      }
    : A extends 'PAUSE_HABIT'
    ? {
        habitId: string;
        actor: 'user' | 'engine';
        reason: string;
      }
    : A extends 'ARCHIVE_HABIT'
    ? {
        habitId: string;
        actor: 'user' | 'engine';
        reason: string;
      }
    : A extends 'RESUME_HABIT'
    ? {
        habitId: string;
        actor: 'user' | 'engine';
        reason: string;
      }
    : never;

export interface CommandValidationResult {
  valid: boolean;
  errors: string[]; // always present; empty when valid
}

export interface CommandExecutionResult {
  success: boolean;
  entityId?: string;
  message: string; // human-readable outcome; empty string on failure
  error?: string; // only present when success === false
  requestId: string; // echo of idempotencyKey for dedup tracing
}

export interface DispatchedCommand<A extends CommandAction = CommandAction> {
  action: A;
  payload: CommandPayload<A>;
  idempotencyKey: string; // required — widget/notification callers must send; executor dedups double-tap
}
