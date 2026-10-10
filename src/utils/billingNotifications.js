/**
 * Billing Notifications Adapter (Deprecated)
 *
 * @deprecated Legacy adapter grandfathered from v3.5.0.
 * All new scheduling and cancellation operations must use `src/services/notificationService.ts`.
 */

import { logger } from './logger';
import {
  scheduleBillReminder as serviceScheduleBillReminder,
  cancelNotification as serviceCancelNotification,
} from '../services/notificationService';

// ─── Pure Date Helpers (Preserved for tests) ──────────────────────────────────

/**
 * Calculates the next due date for a recurring bill based on its dueDay.
 * Always targets the current or next month, depending on today vs dueDay.
 * @deprecated Pure helper preserved for compatibility.
 * @param {number} dueDay - Day of month (1–31)
 * @returns {Date} Next due date object
 */
export const getNextDueDate = (dueDay) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Clamp dueDay to the last valid day of the given month
  const clampDay = (y, m, d) => {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return Math.min(d, daysInMonth);
  };

  // Try this month first
  const clampedDueDay = clampDay(year, month, dueDay);
  let candidate = new Date(year, month, clampedDueDay, 9, 0, 0);
  // If today is past or on the due day, schedule for next month
  if (candidate <= today) {
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const nextMonthIndex = nextMonth > 11 ? 0 : nextMonth;
    const nextClamped = clampDay(nextYear, nextMonthIndex, dueDay);
    candidate = new Date(nextYear, nextMonthIndex, nextClamped, 9, 0, 0);
  }
  return candidate;
};

/**
 * Adjusts the trigger date backwards by notifyDaysBefore days.
 * @deprecated Pure helper preserved for compatibility.
 * @param {Date} dueDate
 * @param {number} notifyDaysBefore
 * @returns {Date}
 */
export const getNotifyDate = (dueDate, notifyDaysBefore) => {
  const notify = new Date(dueDate);
  notify.setDate(dueDate.getDate() - notifyDaysBefore);
  return notify;
};

/**
 * Schedules a native notification reminder for a recurring bill.
 * @deprecated Use notificationService.scheduleBillReminder instead.
 * @param {Object} bill - Recurring bill object
 * @param {string} currency - Currency symbol (e.g. "₹")
 * @returns {Promise<string|null>} Notification ID
 */
export const scheduleRecurringBillReminder = async (bill, currency = "₹") => {
  if (
    typeof bill?.amount !== 'number' ||
    !Number.isFinite(bill.amount) ||
    bill.amount <= 0
  ) {
    logger.warn('billingNotifications: skipping bill reminder for invalid amount', {
      billId: bill?.id,
      reason: 'invalid-amount',
    });
    return null;
  }

  try {
    return await serviceScheduleBillReminder(bill, currency);
  } catch {
    logger.warn('billingNotifications: failed to schedule bill reminder', {
      billId: bill?.id,
    });
    return null;
  }
};

/**
 * Cancels one or more scheduled bill reminder notifications.
 * @deprecated Use notificationService.cancelNotifications instead.
 * @param {Array<string>} notificationIds
 */
export const cancelRecurringBillReminders = async (notificationIds = []) => {
  if (!Array.isArray(notificationIds)) return;
  for (const id of notificationIds) {
    if (!id) continue;
    try {
      await serviceCancelNotification(id);
    } catch {
      logger.warn('billingNotifications: failed to cancel notification', { id });
    }
  }
};
