/**
 * KwestUp 4.0 — Unified Services & Notification Policy Types
 *
 * Source: rulebook/rules/reminders.md, 4.0/KwestUp_4.0_Master_Plan.md
 */

export interface AndroidNotificationChannel {
  id: string;
  name: string;
  description?: string;
  importance: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // Expo AndroidImportance enum value (UNKNOWN=0..MAX=7)
  sound?: string;
  vibrationPattern?: number[];
}

export type NotificationCategory =
  | 'behavior'
  | 'task'
  | 'birthday'
  | 'billing'
  | 'system'
  | 'critical';

export type NotificationRecurrence = 'one-shot' | 'recurring';

export interface NotificationDispatchRequest {
  category: NotificationCategory;
  payloadKey: string;
  recurrence: NotificationRecurrence;
  triggerDate?: string; // ISO 8601 string in device-local wall-clock (see dateUtils); NOT a UTC instant
  channelId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationHistoryEntry {
  id: string;
  category: NotificationCategory;
  payloadKey: string;
  recurrence: NotificationRecurrence;
  channelId: string;
  dispatchedAt: string; // ISO 8601 string in device-local wall-clock
  triggerDate?: string;
  exempt?: boolean;
}

export type PolicyEvaluationReason =
  | 'ok'
  | 'quiet-hours'
  | 'daily-cap'
  | 'min-gap'
  | 'dedup'
  | 'user-opt-out';

export interface PolicyEvaluationResult {
  allowed: boolean;
  adjustedTriggerDate?: string;
  reason: PolicyEvaluationReason;
}

export interface ScheduledNotificationDescriptor {
  id: string;
  habitId?: string;
  taskId?: string;
  title: string;
  body: string;
  triggerDate: string; // ISO 8601 string in device-local wall-clock (see dateUtils); NOT a UTC instant
  channelId: string;
  data?: Record<string, unknown>;
}

export interface BehavioralNotificationPolicy {
  maxPerDay: number;
  minGapMinutes: number;
  quietHoursStart: string; // 'HH:mm' 24h wall-clock (e.g. '22:00'), inclusive
  quietHoursEnd: string;   // 'HH:mm' 24h wall-clock (e.g. '08:00'), exclusive — first dispatch 08:01
  deduplicationWindowMinutes: number;
  maximumRepeatedReminderCount: number; // suppress after N ignores (intervention-planner)
  priorityRules: string[]; // ordered surface/priority arbitration rules (Phase 22)
  userOptOut: boolean; // master kill-switch; when true no non-critical dispatch
}

/**
 * Authoritative default notification policy.
 * Source: rulebook/rules/reminders.md
 * Quiet window is [22:00, 08:00) wall-clock — 08:00:30 is still quiet,
 * first allowed dispatch is 08:01.
 */
export const DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY: BehavioralNotificationPolicy = {
  maxPerDay: 3,
  minGapMinutes: 90,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  deduplicationWindowMinutes: 30,
  maximumRepeatedReminderCount: 2,
  priorityRules: ['recovery-over-standard', 'highest-streak-risk-first'],
  userOptOut: false,
};
