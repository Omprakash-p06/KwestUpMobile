import { Platform, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { logger } from "./logger";

// Configure Expo Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions() {
  if (Platform.OS === "android") {
    const { status } = await Notifications.requestPermissionsAsync({
      android: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please enable notification permissions in your device settings to receive reminders.",
      );
    }
    return status;
  } else {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      Alert.alert(
        "Permission required",
        "Please enable notification permissions in your device settings to receive reminders.",
      );
    }
    return finalStatus;
  }
}

// ---------------------------------------------------------------------------
// Grandfather notice (rulebook/README.md §3): legacy schedulers below bypass
// BehavioralNotificationPolicy until Phase 22 consolidation. Do NOT add new
// schedule call sites against expo-notifications directly — route all
// behavior/task scheduling through canDispatchBehavioralNotification() and
// the single constant DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY in
// src/services/types.ts (3/day, 90-min gap, 22:00-08:00 quiet, 30-min dedup).
// Phase 22 will replace these three functions with the guarded dispatcher.
// ---------------------------------------------------------------------------

/**
 * Pure policy guard — single enforcement point for Phase 22.
 * Checks quietHours + maxPerDay + minGapMinutes + dedup window.
 * @param {Date} now
 * @param {Date[]} history - prior dispatch timestamps (same day)
 * @param {{payloadKey?: string, recentKeys?: {key:string, at:Date}[]}} [opts]
 * @param {{maxPerDay:number,minGapMinutes:number,quietHoursStart:string,quietHoursEnd:string,deduplicationWindowMinutes:number}} [policy]
 */
export function canDispatchBehavioralNotification(now, history = [], opts = {}, policy = { maxPerDay: 3, minGapMinutes: 90, quietHoursStart: '22:00', quietHoursEnd: '08:00', deduplicationWindowMinutes: 30 }) {
  const toMin = (s) => {
    const [h, m] = String(s).split(':').map(Number);
    return h * 60 + m;
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMin(policy.quietHoursStart);
  const end = toMin(policy.quietHoursEnd);
  const inQuiet = start < end ? cur >= start && cur < end : cur >= start || cur < end;
  if (inQuiet) return { allowed: false, deferUntil: policy.quietHoursEnd, reason: 'quiet-hours' };
  const today = history.filter((d) => d.toDateString() === now.toDateString());
  if (today.length >= policy.maxPerDay) return { allowed: false, reason: 'daily-cap' };
  if (today.length > 0) {
    const last = new Date(Math.max(...today.map((d) => d.getTime())));
    if ((now - last) / 60000 < policy.minGapMinutes) return { allowed: false, reason: 'min-gap' };
  }
  if (opts.payloadKey && Array.isArray(opts.recentKeys)) {
    const dup = opts.recentKeys.find(
      (r) => r.key === opts.payloadKey && (now - new Date(r.at)) / 60000 < policy.deduplicationWindowMinutes,
    );
    if (dup) return { allowed: false, reason: 'dedup' };
  }
  return { allowed: true, reason: 'ok' };
}

// Helper to schedule a repeating daily notification for a daily task
// @deprecated Grandfathered until Phase 22 — use the guarded dispatcher.
export async function scheduleDailyTaskNotification(task) {
  if (!task?.time || typeof task.time !== 'string') return null;
  if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(task.time)) {
    logger.error("Invalid daily task time format, expected HH:MM", { time: task.time });
    return null;
  }
  try {
    const [hours, minutes] = task.time.split(":").map(Number);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Daily Task: ${task.name}`,
        body: 'Time for your daily task!',
        sound: true,
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });
    return notificationId;
  } catch (e) {
    logger.error("Failed to schedule daily task notification", { error: e });
  }
  return null;
}

// Helper to schedule a push notification immediately
// @deprecated Grandfathered until Phase 22 — use the guarded dispatcher.
export async function schedulePushNotification({ title, body }) {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // Send immediately
    });
    return notificationId;
  } catch (e) {
    logger.error("Failed to schedule push notification", { error: e });
  }
  return null;
}

// Helper to schedule a push notification for a due date
// @deprecated Grandfathered until Phase 22 — use the guarded dispatcher.
export async function scheduleDueDateNotification(task) {
  if (!task.dueDate) return null;
  try {
    const triggerDate = new Date(task.dueDate);
    if (triggerDate > new Date()) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Task Due: ${task.title || task.name}`,
          body: task.description ? task.description : 'Your task is due now!',
          sound: true,
        },
        trigger: triggerDate,
      });
      return notificationId;
    }
  } catch (e) {
    logger.error("Failed to schedule due date notification", { error: e });
  }
  return null;
}

// Helper to cancel a scheduled notification
export async function cancelDueDateNotification(notificationId) {
  if (notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (e) {
      logger.error("Failed to cancel notification", { error: e });
    }
  }
}

// Upgraded custom birthday push reminders scheduler
// Grandfathered v3.5.0 scheduler — see BehavioralNotificationPolicy grandfather
// notice in rulebook/README.md §3. Do NOT add new call sites against
// expo-notifications directly. Phase 22 consolidates all behavior/task
// scheduling through canDispatchBehavioralNotification() + policy constants.
export async function scheduleCustomBirthdayReminders(birthday) {
  const notificationIds = [];
  try {
    const { name, birthDate, remindAtTime, advanceReminder } = birthday ?? {};
    if (typeof birthDate !== 'string' || typeof name !== 'string' || !name.trim()) return [];
    const parts = birthDate.split('-');
    if (parts.length < 2 || parts.length > 3) return [];

    // Extract month and day safely depending on whether year is present
    const month = parseInt(parts[parts.length === 3 ? 1 : 0], 10);
    const day = parseInt(parts[parts.length === 3 ? 2 : 1], 10);
    if (!Number.isInteger(month) || !Number.isInteger(day)) return [];
    if (month < 1 || month > 12 || day < 1 || day > 31) return [];
    const timeParts = (remindAtTime || '00:00').split(':').map(Number);
    const hours = timeParts[0];
    const minutes = timeParts[1];
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return [];
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return [];
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Schedule for this year AND next year (covers the yearly repeat gap)
    // Without this, the notification fires once and never again
    const yearsToSchedule = [currentYear, currentYear + 1];

    for (const year of yearsToSchedule) {
      let targetBday = new Date(year, month - 1, day, hours, minutes, 0);
      if (targetBday.getMonth() !== month - 1) {
        // Overflow (e.g. Feb 29 in a non-leap year). Policy: observe Feb 29
        // birthdays on Feb 28 in non-leap years — never Mar 1/Mar 2 probing.
        if (month === 2 && day === 29) {
          targetBday = new Date(year, 1, 28, hours, minutes, 0);
        } else {
          continue; // invalid day for this month/year — skip, don't guess
        }
      }
      
      // Skip past dates (only schedule future notifications)
      if (targetBday <= today) continue;

      const bdayNotifyId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎂 Birthday Alert!`,
          body: `It's ${name}'s birthday today! Wish them the best! 🎉`,
          sound: "default",
        },
        trigger: targetBday,
      });
      notificationIds.push(bdayNotifyId);

      // Schedule Optional Advance Reminder for this year
      if (advanceReminder && advanceReminder !== "none") {
        let daysPrior = 1;
        if (advanceReminder === "3_days") daysPrior = 3;
        if (advanceReminder === "1_week") daysPrior = 7;

        const advanceTarget = new Date(targetBday);
        advanceTarget.setDate(targetBday.getDate() - daysPrior);
        // Wall-clock anchoring per rulebook/rules/reminders.md DST rule:
        // re-assert the original wall-clock time so a spring-forward/fall-back
        // transition cannot shift the reminder by an hour into quiet hours.
        advanceTarget.setHours(hours, minutes, 0, 0);

        if (advanceTarget > today) {
          const advanceNotifyId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `🎁 Birthday Coming Up!`,
              body: `${name}'s birthday is in ${daysPrior} days (${birthDate}). Don't forget to prepare!`,
              sound: "default",
            },
            trigger: advanceTarget,
          });
          notificationIds.push(advanceNotifyId);
        }
      }
    }
  } catch (error) {
    logger.error("Failed to schedule birthday reminders", { error });
    // Never return partial IDs — cancel anything already scheduled so the
    // caller does not persist orphaned schedules that can't be cancelled.
    for (const id of notificationIds) {
      try {
        if (id) await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // best-effort cleanup
      }
    }
    return [];
  }

  return notificationIds;
}

// Upgraded custom birthday reminders cancellation utility
export async function cancelCustomBirthdayReminders(notificationIds) {
  if (notificationIds && Array.isArray(notificationIds)) {
    for (const id of notificationIds) {
      if (id) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (e) {
          logger.error("Failed to cancel scheduled birthday notification", { error: e });
        }
      }
    }
  }
}
