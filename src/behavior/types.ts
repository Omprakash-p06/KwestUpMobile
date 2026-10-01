/**
 * KwestUp 4.0 — Atomic Behavior Domain Types
 *
 * Source: rulebook/atomic-habits/, 4.0/KwestUp_4.0_Master_Plan.md
 */

export interface Identity {
  id: string;
  statement: string; // e.g. "I am a disciplined software engineer"
  createdAt: string;
  updatedAt: string;
}

export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom';

export interface CustomSchedule {
  weekdays: number[]; // 0=Sunday..6=Saturday; required when frequency === 'custom'
}

export type HabitStatus = 'active' | 'paused' | 'archived' | 'recovery';

export interface Habit {
  id: string;
  identityId: string;
  title: string;
  behavior: string;
  frequency: HabitFrequency;
  status: HabitStatus;
  minimumAction: string; // Two-Minute Rule: must take < 120s
  normalTarget: string;
  stretchTarget?: string;
  streakCount: number;
  bestStreak: number;
  totalEvidenceVotes: number; // cumulative lifetime completions; never reset on miss
  customSchedule?: CustomSchedule; // required when frequency === 'custom'
  lastCompletedDate?: string;
  createdAt: string;
  updatedAt: string;
}

// 'manual' = user-initiated, no time trigger — explicitly allowed as a
// triggerless-but-intentional cue; validators must accept it.
export type CueType = 'time' | 'after-habit' | 'task-completion' | 'manual' | 'morning' | 'evening';

export interface Cue {
  id: string;
  habitId: string;
  type: CueType;
  time?: string; // 'HH:mm' wall-clock format
  location?: string;
  triggerEvent?: string; // e.g. 'TASK_COMPLETED'
  conditions?: Record<string, unknown>;
}

export interface HabitStack {
  anchorHabitId: string;
  targetHabitId: string;
  relationship: 'immediately-after' | 'with';
}

export type InterventionSurface = 'widget' | 'notification' | 'in-app';

export type InterventionPriority = 'low' | 'normal' | 'high' | 'urgent';

export type InterventionStatus = 'scheduled' | 'dispatched' | 'dismissed' | 'acted' | 'expired';

export interface Intervention {
  id: string;
  habitId: string;
  type: string;
  surface: InterventionSurface;
  priority: InterventionPriority;
  scheduledFor: string;
  expiresAt?: string;
  action: string;
  reason: string;
  status: InterventionStatus;
}

export type BehaviorEventType =
  | 'TASK_COMPLETED'
  | 'HABIT_COMPLETED'
  | 'HABIT_MISSED'
  | 'REMINDER_DISMISSED'
  | 'REMINDER_IGNORED'
  | 'WIDGET_ACTION'
  | 'FOCUS_COMPLETED'
  | 'CHECK_IN_COMPLETED'
  | 'HABIT_CREATED'
  | 'HABIT_UPDATED'
  | 'RECOVERY_STARTED';

export interface BehaviorEvent {
  id: string;
  type: BehaviorEventType;
  entityId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  source: 'app' | 'widget' | 'notification' | 'system';
}

export type FrictionCategory = 'effort' | 'time' | 'setup' | 'emotional' | 'mental' | 'location';

export interface FrictionDiagnosis {
  habitId: string;
  category: FrictionCategory;
  notes?: string;
  diagnosedAt: string;
}

export interface FactualReward {
  id: string;
  habitId: string;
  identityId: string;
  title: string;
  description: string;
  milestoneType:
    | 'first_completion'
    | 'consistency_streak'
    | 'recovery_success'
    | 'fast_activation'
    | 'friction_reduction';
  achievedAt: string;
}
