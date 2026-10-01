/**
 * KwestUp 4.0 — Unified Services & Notification Policy Types
 *
 * Source: rulebook/rules/reminders.md, 4.0/KwestUp_4.0_Master_Plan.md
 */

export interface AndroidNotificationChannel {
  id: string;
  name: string;
  description?: string;
  importance: 0 | 1 | 2 | 3 | 4; // Expo AndroidImportance enum value (None..Max)
  sound?: string;
  vibrationPattern?: number[];
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
