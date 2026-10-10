/**
 * Unified Notification Service & Behavioral Dispatch Engine
 *
 * Architecture & Decision Record (Codex HIGH finding 2):
 * Behavioral Notification Policy (quiet hours, daily cap 3, 90-min gap, 30-min dedup, user opt-out)
 * is evaluated ONLY for one-shot requests whose category is 'behavior'.
 *
 * Recurring requests (repeating daily-task calendar triggers, annual/advance birthday reminders,
 * recurring bill reminders) are EXEMPT from daily-cap, min-gap, and dedup checks because schedule-time
 * JS cannot constrain native future OS-level firings. Recurring requests still receive quiet-hours
 * shifting at schedule time, channel routing, and history recording marked exempt.
 *
 * The alternative design (one-shot-next-occurrence plus a background JS rescheduler) was explicitly
 * REJECTED to preserve Feb-29 observance and multi-day advance reminders without requiring an
 * active background daemon or waking the JS runtime when the app is killed. Phase 25 may revisit
 * this decision if background fetch primitives are introduced.
 */

import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AndroidNotificationChannel,
  BehavioralNotificationPolicy,
  DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY,
  NotificationDispatchRequest,
  NotificationHistoryEntry,
  PolicyEvaluationResult,
} from './types';
import { getLocalDateString } from '../utils/dateUtils';
import { logger } from '../utils/logger';

export const NOTIFICATION_HISTORY_KEY = 'kwestup_notification_history_v1';

export const ANDROID_NOTIFICATION_CHANNELS: Record<string, AndroidNotificationChannel> = {
  BEHAVIOR_CUES: {
    id: 'kwestup_behavior_cues',
    name: 'Behavioral Cues',
    description: 'Habit prompts, 2-minute action cues, and recovery interventions',
    importance: (Notifications.AndroidImportance?.HIGH ?? 6) as 6,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  },
  DAILY_TASKS: {
    id: 'kwestup_daily_tasks',
    name: 'Daily Tasks',
    description: 'Scheduled reminders for daily tasks and due dates',
    importance: (Notifications.AndroidImportance?.HIGH ?? 6) as 6,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  },
  BIRTHDAYS: {
    id: 'kwestup_birthdays',
    name: 'Birthdays',
    description: 'Annual birthday alerts and advance notifications',
    importance: (Notifications.AndroidImportance?.DEFAULT ?? 5) as 5,
    sound: 'default',
  },
  BILLING: {
    id: 'kwestup_billing',
    name: 'Billing & Reminders',
    description: 'Due date alerts for recurring financial commitments',
    importance: (Notifications.AndroidImportance?.DEFAULT ?? 5) as 5,
    sound: 'default',
  },
  SYSTEM: {
    id: 'kwestup_system',
    name: 'System & Timers',
    description: 'Focus timer completion and system sync alerts',
    importance: (Notifications.AndroidImportance?.LOW ?? 4) as 4,
    sound: 'default',
  },
};

/**
 * Initializes Android notification channels and configures foreground notification presentation.
 */
export async function initNotificationChannels(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    for (const channel of Object.values(ANDROID_NOTIFICATION_CHANNELS)) {
      try {
        await Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          description: channel.description,
          importance: channel.importance as any,
          sound: channel.sound,
          vibrationPattern: channel.vibrationPattern,
        });
      } catch (e) {
        logger.warn('Failed to set notification channel', { channelId: channel.id });
      }
    }
  }
}

/**
 * Requests push notification permissions with Android/iOS branching and user-facing alert on denial.
 */
export async function requestNotificationPermissions(): Promise<string> {
  try {
    if (Platform.OS === 'android') {
      const { status } = await Notifications.requestPermissionsAsync({
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      if (status !== 'granted') {
        Alert.alert(
          'Permission required',
          'Please enable notification permissions in your device settings to receive reminders.'
        );
      }
      return status;
    } else {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permission required',
          'Please enable notification permissions in your device settings to receive reminders.'
        );
      }
      return finalStatus;
    }
  } catch (e) {
    logger.warn('Failed to request notification permissions');
    return 'denied';
  }
}

/**
 * Loads recent notification dispatch history from AsyncStorage, automatically pruning records older than 48h.
 * Returns empty array on corrupted JSON or storage errors without crashing.
 */
export async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      logger.warn('Corrupt notification history detected, resetting to empty array');
      return [];
    }
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return parsed.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const ts = new Date(item.dispatchedAt).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
  } catch (e) {
    logger.warn('Failed to read notification history from storage');
    return [];
  }
}

/**
 * Persists an entry to notification dispatch history, pruning entries older than 48 hours.
 */
export async function recordNotificationDispatch(entry: NotificationHistoryEntry): Promise<void> {
  try {
    const history = await getNotificationHistory();
    history.push(entry);
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const pruned = history.filter((item) => {
      const ts = new Date(item.dispatchedAt).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(pruned));
  } catch (e) {
    logger.warn('Failed to write notification history to storage');
  }
}

/**
 * Evaluates quiet hours for a target wall-clock date.
 * Window is [quietHoursStart, quietHoursEnd) (e.g. [22:00, 08:00) with first allowed dispatch at 08:01).
 * Target at or after 22:00 defers to 08:01 next morning; target before 08:00 (or at 08:00) defers to 08:01 same morning.
 */
function evaluateQuietHours(
  targetDate: Date,
  policy: BehavioralNotificationPolicy
): { inQuiet: boolean; deferredDate?: Date } {
  const [startH, startM] = policy.quietHoursStart.split(':').map(Number);
  const [endH, endM] = policy.quietHoursEnd.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  const curH = targetDate.getHours();
  const curM = targetDate.getMinutes();
  const curMin = curH * 60 + curM;

  // Window: [startMin, 24:00) U [00:00, endMin] (08:00 is quiet, 08:01 is allowed)
  const inQuiet =
    startMin < endMin
      ? curMin >= startMin && curMin <= endMin
      : curMin >= startMin || curMin <= endMin;

  if (!inQuiet) {
    return { inQuiet: false };
  }

  const deferred = new Date(targetDate);
  if (curMin >= startMin) {
    // 22:00 or later -> advance 1 calendar day
    deferred.setDate(deferred.getDate() + 1);
  }
  // Set to 08:01 (endH:endM + 1)
  deferred.setHours(endH, endM + 1, 0, 0);

  return { inQuiet: true, deferredDate: deferred };
}

/**
 * Pure policy evaluation engine.
 * Enforces quiet-hours, daily cap, min-gap, dedup, and user-opt-out according to category and recurrence semantics.
 */
export function evaluateNotificationPolicy(
  request: NotificationDispatchRequest,
  history: NotificationHistoryEntry[],
  policy: BehavioralNotificationPolicy = DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY,
  now: Date = new Date()
): PolicyEvaluationResult {
  // 1. Critical category bypasses user opt-out and all behavioral constraints
  if (request.category === 'critical') {
    return { allowed: true, reason: 'ok' };
  }

  // 2. User opt-out kill-switch
  if (policy.userOptOut) {
    return { allowed: false, reason: 'user-opt-out' };
  }

  const baseTargetDate = request.triggerDate ? new Date(request.triggerDate) : now;
  const targetDate = isNaN(baseTargetDate.getTime()) ? now : baseTargetDate;

  // 3. Quiet hours evaluation
  const quietCheck = evaluateQuietHours(targetDate, policy);
  let effectiveDate = targetDate;
  let adjustedTriggerDate: string | undefined;

  if (quietCheck.inQuiet && quietCheck.deferredDate) {
    effectiveDate = quietCheck.deferredDate;
    adjustedTriggerDate = effectiveDate.toISOString();
  }

  // 4. Recurring or non-behavior requests are EXEMPT from daily cap, min-gap, and dedup
  if (request.recurrence === 'recurring' || request.category !== 'behavior') {
    return {
      allowed: true,
      adjustedTriggerDate,
      reason: adjustedTriggerDate ? 'quiet-hours' : 'ok',
    };
  }

  // 5. Daily Notification Cap (max 3/calendar day for behavioral cues)
  const targetLocalDate = getLocalDateString(effectiveDate);
  const behavioralToday = history.filter((entry) => {
    if (entry.category !== 'behavior') return false;
    const entryDate = entry.triggerDate ? new Date(entry.triggerDate) : new Date(entry.dispatchedAt);
    return getLocalDateString(entryDate) === targetLocalDate;
  });

  if (behavioralToday.length >= policy.maxPerDay) {
    return { allowed: false, reason: 'daily-cap' };
  }

  // 6. Minimum Notification Gap (90 minutes separation between behavioral cues)
  const effectiveTimeMs = effectiveDate.getTime();
  const hasMinGapViolation = history.some((entry) => {
    if (entry.category !== 'behavior') return false;
    const entryTimeMs = entry.triggerDate
      ? new Date(entry.triggerDate).getTime()
      : new Date(entry.dispatchedAt).getTime();
    if (isNaN(entryTimeMs)) return false;
    const diffMinutes = Math.abs(effectiveTimeMs - entryTimeMs) / 60000;
    return diffMinutes < policy.minGapMinutes;
  });

  if (hasMinGapViolation) {
    return { allowed: false, reason: 'min-gap' };
  }

  // 7. Deduplication Window (30 minutes for identical payloadKey)
  if (request.payloadKey) {
    const hasDedupViolation = history.some((entry) => {
      if (entry.payloadKey !== request.payloadKey) return false;
      const entryTimeMs = entry.triggerDate
        ? new Date(entry.triggerDate).getTime()
        : new Date(entry.dispatchedAt).getTime();
      if (isNaN(entryTimeMs)) return false;
      const diffMinutes = Math.abs(effectiveTimeMs - entryTimeMs) / 60000;
      return diffMinutes < policy.deduplicationWindowMinutes;
    });

    if (hasDedupViolation) {
      return { allowed: false, reason: 'dedup' };
    }
  }

  return {
    allowed: true,
    adjustedTriggerDate,
    reason: adjustedTriggerDate ? 'quiet-hours' : 'ok',
  };
}

/**
 * Authoritative notification scheduling entry point.
 * Accepts an explicit NotificationDispatchRequest, evaluates policy, schedules via expo-notifications,
 * and atomically logs safe metadata and records history upon native success.
 */
export async function scheduleNotification(
  request: NotificationDispatchRequest,
  policy: BehavioralNotificationPolicy = DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY
): Promise<string | null> {
  const history = await getNotificationHistory();
  const evaluation = evaluateNotificationPolicy(request, history, policy);

  if (!evaluation.allowed) {
    logger.debug('Notification policy blocked dispatch', {
      reason: evaluation.reason,
      category: request.category,
      channelId: request.channelId,
    });
    return null;
  }

  const finalTriggerDateStr = evaluation.adjustedTriggerDate || request.triggerDate;
  let trigger: any = request.channelId ? { channelId: request.channelId } : null;

  if (finalTriggerDateStr) {
    const d = new Date(finalTriggerDateStr);
    if (!isNaN(d.getTime())) {
      trigger = request.channelId
        ? { date: d, channelId: request.channelId }
        : d;
    }
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: request.title,
        body: request.body,
        sound: 'default',
        data: request.data,
      },
      trigger,
    });

    // History record persisted atomically ONLY after native success
    const historyEntry: NotificationHistoryEntry = {
      id: notificationId,
      category: request.category,
      payloadKey: request.payloadKey,
      recurrence: request.recurrence,
      channelId: request.channelId,
      dispatchedAt: new Date().toISOString(),
      triggerDate: finalTriggerDateStr,
      exempt: request.recurrence === 'recurring' || request.category !== 'behavior',
    };
    await recordNotificationDispatch(historyEntry);

    const logDate = trigger instanceof Date ? trigger : new Date();
    logger.debug('Notification scheduled successfully', {
      channelId: request.channelId,
      notificationId,
      triggerHour: logDate.getHours(),
      triggerMinute: logDate.getMinutes(),
    });

    return notificationId;
  } catch (e) {
    logger.warn('Native notification scheduling failed', {
      channelId: request.channelId,
    });
    return null;
  }
}

/**
 * Schedules a recurring daily task reminder for a given time ('HH:MM').
 */
export async function scheduleDailyTaskReminder(task: {
  id?: string;
  name?: string;
  title?: string;
  time?: string;
}): Promise<string | null> {
  if (!task?.time || typeof task.time !== 'string') return null;
  if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(task.time)) {
    logger.warn('Invalid daily task time format, expected HH:MM');
    return null;
  }

  const [hours, minutes] = task.time.split(':').map(Number);
  const taskName = task.name || task.title || 'Daily Task';

  try {
    const trigger: any = {
      hour: hours,
      minute: minutes,
      repeats: true,
      channelId: ANDROID_NOTIFICATION_CHANNELS.DAILY_TASKS.id,
    };
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Daily Task: ${taskName}`,
        body: 'Time for your daily task!',
        sound: 'default',
      },
      trigger,
    });

    await recordNotificationDispatch({
      id: notificationId,
      category: 'task',
      payloadKey: `daily_task_${task.id || taskName}`,
      recurrence: 'recurring',
      channelId: ANDROID_NOTIFICATION_CHANNELS.DAILY_TASKS.id,
      dispatchedAt: new Date().toISOString(),
      exempt: true,
    });

    logger.debug('Daily task reminder scheduled', {
      channelId: ANDROID_NOTIFICATION_CHANNELS.DAILY_TASKS.id,
      notificationId,
      triggerHour: hours,
      triggerMinute: minutes,
    });

    return notificationId;
  } catch (e) {
    logger.warn('Failed to schedule daily task reminder');
    return null;
  }
}

/**
 * Schedules a one-shot due date reminder for a task.
 */
export async function scheduleDueDateReminder(task: {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  dueDate?: string | number | Date;
}): Promise<string | null> {
  if (!task?.dueDate) return null;
  const triggerDate = new Date(task.dueDate);
  if (isNaN(triggerDate.getTime()) || triggerDate <= new Date()) {
    return null;
  }

  const taskTitle = task.title || task.name || 'Task Due';
  const request: NotificationDispatchRequest = {
    category: 'task',
    payloadKey: `task_due_${task.id || taskTitle}`,
    recurrence: 'one-shot',
    channelId: ANDROID_NOTIFICATION_CHANNELS.DAILY_TASKS.id,
    triggerDate: triggerDate.toISOString(),
    title: `Task Due: ${taskTitle}`,
    body: task.description || 'Your task is due now!',
  };

  return scheduleNotification(request);
}

/**
 * Schedules annual birthday reminders and optional advance reminders.
 * Observes Feb-29 on Feb-28 in non-leap years.
 * Performs atomic rollback on partial native scheduling failure to prevent orphaned reminders.
 */
export async function scheduleBirthdayReminders(birthday: {
  id?: string;
  name?: string;
  birthDate?: string;
  remindAtTime?: string;
  advanceReminder?: string;
}): Promise<string[]> {
  const notificationIds: string[] = [];
  try {
    const { name, birthDate, remindAtTime, advanceReminder } = birthday ?? {};
    if (typeof birthDate !== 'string' || typeof name !== 'string' || !name.trim()) return [];
    const parts = birthDate.split('-');
    if (parts.length < 2 || parts.length > 3) return [];

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
    const yearsToSchedule = [currentYear, currentYear + 1];

    for (const year of yearsToSchedule) {
      let targetBday = new Date(year, month - 1, day, hours, minutes, 0);
      if (targetBday.getMonth() !== month - 1) {
        // Feb 29 in non-leap year: observe on Feb 28
        if (month === 2 && day === 29) {
          targetBday = new Date(year, 1, 28, hours, minutes, 0);
        } else {
          continue;
        }
      }

      if (targetBday > today) {
        const trigger: any = {
          date: targetBday,
          channelId: ANDROID_NOTIFICATION_CHANNELS.BIRTHDAYS.id,
        };
        const notifId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `🎂 Birthday Alert!`,
            body: `It's ${name}'s birthday today! Wish them the best! 🎉`,
            sound: 'default',
          },
          trigger,
        });
        notificationIds.push(notifId);

        await recordNotificationDispatch({
          id: notifId,
          category: 'birthday',
          payloadKey: `birthday_${birthday.id || name}_${year}`,
          recurrence: 'recurring',
          channelId: ANDROID_NOTIFICATION_CHANNELS.BIRTHDAYS.id,
          dispatchedAt: new Date().toISOString(),
          triggerDate: targetBday.toISOString(),
          exempt: true,
        });
      }

      // Optional advance reminder
      if (advanceReminder && advanceReminder !== 'none') {
        let daysPrior = 1;
        if (advanceReminder === '3_days') daysPrior = 3;
        if (advanceReminder === '1_week') daysPrior = 7;

        const advanceTarget = new Date(targetBday);
        advanceTarget.setDate(targetBday.getDate() - daysPrior);
        advanceTarget.setHours(hours, minutes, 0, 0);

        if (advanceTarget > today) {
          const trigger: any = {
            date: advanceTarget,
            channelId: ANDROID_NOTIFICATION_CHANNELS.BIRTHDAYS.id,
          };
          const advId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `🎁 Birthday Coming Up!`,
              body: `${name}'s birthday is in ${daysPrior} days (${birthDate}). Don't forget to prepare!`,
              sound: 'default',
            },
            trigger,
          });
          notificationIds.push(advId);

          await recordNotificationDispatch({
            id: advId,
            category: 'birthday',
            payloadKey: `birthday_adv_${birthday.id || name}_${year}`,
            recurrence: 'recurring',
            channelId: ANDROID_NOTIFICATION_CHANNELS.BIRTHDAYS.id,
            dispatchedAt: new Date().toISOString(),
            triggerDate: advanceTarget.toISOString(),
            exempt: true,
          });
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to schedule birthday reminders, performing rollback');
    for (const id of notificationIds) {
      try {
        if (id) await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // Best effort rollback
      }
    }
    return [];
  }

  return notificationIds;
}

/**
 * Calculates next due date for a recurring bill based on its dueDay (1–31) with month-end clamping.
 */
function getNextDueDate(dueDay: number): Date {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const clampDay = (y: number, m: number, d: number) => {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return Math.min(d, daysInMonth);
  };

  const clampedDueDay = clampDay(year, month, dueDay);
  let candidate = new Date(year, month, clampedDueDay, 9, 0, 0);
  if (candidate <= today) {
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const nextMonthIndex = nextMonth > 11 ? 0 : nextMonth;
    const nextClamped = clampDay(nextYear, nextMonthIndex, dueDay);
    candidate = new Date(nextYear, nextMonthIndex, nextClamped, 9, 0, 0);
  }
  return candidate;
}

/**
 * Schedules a recurring bill reminder with finite positive amount check.
 * If amount is malformed, non-numeric, or non-positive, skips scheduling, returns null, and logs safe identifiers.
 */
export async function scheduleBillReminder(
  bill: {
    id?: string;
    name?: string;
    amount?: number;
    dueDay?: number;
    notifyDaysBefore?: number;
  },
  currency: string = '₹'
): Promise<string | null> {
  if (
    typeof bill?.amount !== 'number' ||
    !Number.isFinite(bill.amount) ||
    bill.amount <= 0
  ) {
    logger.warn('Skipping bill reminder: malformed or non-positive amount', {
      billId: bill?.id,
      reason: 'invalid-amount',
    });
    return null;
  }

  if (typeof bill?.dueDay !== 'number' || bill.dueDay < 1 || bill.dueDay > 31) {
    logger.warn('Skipping bill reminder: invalid dueDay', {
      billId: bill?.id,
      reason: 'invalid-due-day',
    });
    return null;
  }

  const dueDate = getNextDueDate(bill.dueDay);
  const notifyDate = new Date(dueDate);
  notifyDate.setDate(dueDate.getDate() - (bill.notifyDaysBefore || 0));

  if (notifyDate <= new Date()) {
    return null;
  }

  const dueDateStr = dueDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const billName = bill.name || 'Recurring Bill';

  try {
    const trigger: any = {
      date: notifyDate,
      channelId: ANDROID_NOTIFICATION_CHANNELS.BILLING.id,
    };
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏦 Bill Due Soon!',
        body: `${billName} (${currency}${bill.amount.toFixed(2)}) is due on ${dueDateStr}`,
        sound: 'default',
      },
      trigger,
    });

    await recordNotificationDispatch({
      id: notifId,
      category: 'billing',
      payloadKey: `bill_${bill.id || billName}`,
      recurrence: 'recurring',
      channelId: ANDROID_NOTIFICATION_CHANNELS.BILLING.id,
      dispatchedAt: new Date().toISOString(),
      triggerDate: notifyDate.toISOString(),
      exempt: true,
    });

    logger.debug('Bill reminder scheduled', {
      channelId: ANDROID_NOTIFICATION_CHANNELS.BILLING.id,
      notificationId: notifId,
      billId: bill.id,
    });

    return notifId;
  } catch (err) {
    logger.warn('Failed to schedule bill reminder', { billId: bill.id });
    return null;
  }
}

/**
 * Cancels a single scheduled notification by ID.
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    logger.warn('Failed to cancel notification', { notificationId });
  }
}

/**
 * Cancels multiple scheduled notifications by IDs, aggregating failures and throwing only if at least one fails.
 */
export async function cancelNotifications(notificationIds: string[]): Promise<void> {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) return;
  const failures: { id: string; error: unknown }[] = [];

  for (const id of notificationIds) {
    if (!id) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (e) {
      failures.push({ id, error: e });
      logger.warn('Failed to cancel notification in batch', { notificationId: id });
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Failed to cancel ${failures.length} notifications: ${failures.map((f) => f.id).join(', ')}`
    );
  }
}

/**
 * Cancels all scheduled notifications across the application.
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    logger.warn('Failed to cancel all notifications');
  }
}
