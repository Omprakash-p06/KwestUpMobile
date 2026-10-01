/**
 * KwestUp 4.0 — Unified Services & Notification Policy Types
 *
 * Source: rulebook/rules/reminders.md, 4.0/KwestUp_4.0_Master_Plan.md
 */

export interface AndroidNotificationChannel {
  id: string;
  name: string;
  description?: string;
  importance: number; // NotificationImportance enum value
  sound?: string;
  vibrationPattern?: number[];
}

export interface ScheduledNotificationDescriptor {
  id: string;
  habitId?: string;
  taskId?: string;
  title: string;
  body: string;
  triggerDate: string; // ISO 8601 string
  channelId: string;
  data?: Record<string, unknown>;
}

export interface BehavioralNotificationPolicy {
  maxPerDay: number;
  minGapMinutes: number;
  quietHoursStart: string; // 'HH:mm' 24h format (e.g. '22:00')
  quietHoursEnd: string;   // 'HH:mm' 24h format (e.g. '08:00')
  deduplicationWindowMinutes: number;
}

/**
 * Authoritative default notification policy.
 * Source: rulebook/rules/reminders.md
 */
export const DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY: BehavioralNotificationPolicy = {
  maxPerDay: 3,
  minGapMinutes: 90,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  deduplicationWindowMinutes: 30,
};
