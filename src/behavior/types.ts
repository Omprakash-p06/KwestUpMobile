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

export type InterventionType =
  | 'reminder'
  | 'check-in'
  | 'recovery'
  | 'overload'
  | 'reward'
  | 'encouragement';

export interface Intervention {
  id: string;
  habitId: string;
  type: InterventionType;
  surface: InterventionSurface;
  priority: InterventionPriority;
  scheduledFor: string;
  expiresAt?: string;
  action: string;
  reason: string;
  status: InterventionStatus;
}

export type BehaviorEventType =
  // Task lifecycle
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'TASK_DELETED'
  | 'TASK_MISSED'
  // Billing lifecycle
  | 'BILL_CREATED'
  | 'BILL_PAID'
  | 'BILL_UPDATED'
  | 'BILL_DELETED'
  // Birthday lifecycle
  | 'BIRTHDAY_CREATED'
  | 'BIRTHDAY_UPDATED'
  | 'BIRTHDAY_DELETED'
  // Focus Timer lifecycle
  | 'FOCUS_STARTED'
  | 'FOCUS_COMPLETED'
  // Home-screen Widget lifecycle
  | 'WIDGET_ACTION'
  // Habit & Behavioral lifecycle (Phase 24 readiness)
  | 'HABIT_CREATED'
  | 'HABIT_UPDATED'
  | 'HABIT_COMPLETED'
  | 'HABIT_MISSED'
  | 'RECOVERY_STARTED'
  | 'REMINDER_DISMISSED'
  | 'REMINDER_IGNORED'
  | 'CHECK_IN_COMPLETED';

export type DomainEventType = BehaviorEventType;

export interface BehaviorEvent {
  id: string;
  type: BehaviorEventType;
  entityId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  source: 'app' | 'widget' | 'notification' | 'system';
}

export type DomainEvent<T extends DomainEventType = DomainEventType> = BehaviorEvent & {
  type: T;
};

export type DomainEventInput<T extends DomainEventType = DomainEventType> = Omit<
  DomainEvent<T>,
  'id' | 'timestamp'
> & {
  id?: string;
  timestamp?: string;
};

export type DomainEventListener<T extends DomainEventType = DomainEventType> = (
  event: DomainEvent<T>
) => void | Promise<void>;

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
  // Canonical Master Plan §10 seven categories. Legacy aliases
  // (first_completion, consistency_streak, recovery_success, fast_activation)
  // remain accepted until Phase 24 migration renames stored rewards.
  milestoneType:
    | 'first_action'
    | 'improvement'
    | 'consistency'
    | 'recovery'
    | 'difficulty_progression'
    | 'friction_reduction'
    | 'identity_evidence'
    | 'first_completion'
    | 'consistency_streak'
    | 'recovery_success'
    | 'fast_activation';
  achievedAt: string;
}

export interface BehaviorRule {
  id: string; // Unique rule identifier (e.g. 'HABIT_CONCURRENT_CAP_001', 'MINIMUM_ACTION_001')
  description: string;
  when: Record<string, unknown>;
  then: Record<string, unknown>;
  priority: number;
}

export interface CompiledHabitPlan {
  identity: {
    statement: string;
  };
  behavior: {
    target: string;
    minimum: string; // <120 seconds (Two-Minute Rule)
    normal: string;
    stretch?: string;
  };
  cue: {
    type: CueType;
    anchor?: string;
    time?: string;
  };
  intervention: {
    surface: InterventionSurface;
    action: string;
  };
  recovery: {
    enabled: boolean;
    minimum_after_miss: boolean;
  };
  reward: {
    type: string;
  };
  rulesApplied: string[]; // Rule IDs applied by Behavior Compiler & Rule Engine
}

export type RuleEvaluationContext = Record<string, unknown>;

export interface RuleEvaluationResult {
  rulesApplied: string[];
  actions: Array<Record<string, unknown>>;
  matchedRules: BehaviorRule[];
  rejected?: {
    ruleId: string;
    reason: string;
  };
}

export interface TimeOptions {
  now?: string;
  todayDate?: string;
}
