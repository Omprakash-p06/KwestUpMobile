/**
 * Legacy Notifications Utility Adapter (Deprecated)
 *
 * @deprecated Grandfathered v3.5.0 notification adapter.
 * All new scheduling, cancellation, and permission operations must use
 * `src/services/notificationService.ts`.
 */

import {
  requestNotificationPermissions as serviceRequestNotificationPermissions,
  scheduleNotification as serviceScheduleNotification,
  scheduleDailyTaskReminder as serviceScheduleDailyTaskReminder,
  scheduleDueDateReminder as serviceScheduleDueDateReminder,
  scheduleBirthdayReminders as serviceScheduleBirthdayReminders,
  cancelNotification as serviceCancelNotification,
} from "../services/notificationService";

/**
 * Request notification permissions.
 * @deprecated Use notificationService.requestNotificationPermissions instead.
 */
export async function requestNotificationPermissions() {
  return serviceRequestNotificationPermissions();
}

/**
 * Pure policy guard — single enforcement point grandfathered from v3.5.0.
 * @deprecated Use evaluateNotificationPolicy from src/services/notificationService.ts instead.
 * @param {Date} now
 * @param {Date[]} history - prior dispatch timestamps (same day)
 * @param {{payloadKey?: string, recentKeys?: {key:string, at:Date}[]}} [opts]
 * @param {{maxPerDay:number,minGapMinutes:number,quietHoursStart:string,quietHoursEnd:string,deduplicationWindowMinutes:number}} [policy]
 */
export function canDispatchBehavioralNotification(
  now,
  history = [],
  opts = {},
  policy = {
    maxPerDay: 3,
    minGapMinutes: 90,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    deduplicationWindowMinutes: 30,
  }
) {
  const toMin = (s) => {
    const [h, m] = String(s).split(":").map(Number);
    return h * 60 + m;
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMin(policy.quietHoursStart);
  const end = toMin(policy.quietHoursEnd);
  const inQuiet = start < end ? cur >= start && cur < end : cur >= start || cur < end;
  if (inQuiet) return { allowed: false, deferUntil: policy.quietHoursEnd, reason: "quiet-hours" };
  const today = history.filter((d) => d.toDateString() === now.toDateString());
  if (today.length >= policy.maxPerDay) return { allowed: false, reason: "daily-cap" };
  if (today.length > 0) {
    const last = new Date(Math.max(...today.map((d) => d.getTime())));
    if ((now - last) / 60000 < policy.minGapMinutes) return { allowed: false, reason: "min-gap" };
  }
  if (opts.payloadKey && Array.isArray(opts.recentKeys)) {
    const dup = opts.recentKeys.find(
      (r) => r.key === opts.payloadKey && (now - new Date(r.at)) / 60000 < policy.deduplicationWindowMinutes
    );
    if (dup) return { allowed: false, reason: "dedup" };
  }
  return { allowed: true, reason: "ok" };
}

/**
 * Helper to schedule a repeating daily notification for a daily task.
 * @deprecated Use notificationService.scheduleDailyTaskReminder instead.
 * @param {Object} task
 */
export async function scheduleDailyTaskNotification(task) {
  return serviceScheduleDailyTaskReminder(task);
}

/**
 * Helper to schedule a push notification immediately.
 * @deprecated Use notificationService.scheduleNotification instead.
 * @param {{ title: string, body: string }} param0
 */
export async function schedulePushNotification({ title, body }) {
  return serviceScheduleNotification({
    category: "system",
    payloadKey: `push_${Date.now()}`,
    recurrence: "one-shot",
    channelId: "kwestup_system",
    title,
    body,
  });
}

/**
 * Helper to schedule a push notification for a due date.
 * @deprecated Use notificationService.scheduleDueDateReminder instead.
 * @param {Object} task
 */
export async function scheduleDueDateNotification(task) {
  return serviceScheduleDueDateReminder(task);
}

/**
 * Helper to cancel a scheduled notification.
 * @deprecated Use notificationService.cancelNotification instead.
 * @param {string} notificationId
 */
export async function cancelDueDateNotification(notificationId) {
  return serviceCancelNotification(notificationId);
}

/**
 * Custom birthday push reminders scheduler.
 * @deprecated Use notificationService.scheduleBirthdayReminders instead.
 * @param {Object} birthday
 */
export async function scheduleCustomBirthdayReminders(birthday) {
  return serviceScheduleBirthdayReminders(birthday);
}

/**
 * Custom birthday reminders cancellation utility.
 * @deprecated Use notificationService.cancelNotifications instead.
 * @param {Array<string>} notificationIds
 */
export async function cancelCustomBirthdayReminders(notificationIds) {
  if (!Array.isArray(notificationIds)) return;
  for (const id of notificationIds) {
    if (id) {
      await serviceCancelNotification(id);
    }
  }
}
