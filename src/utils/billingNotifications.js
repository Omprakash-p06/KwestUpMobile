import * as Notifications from "expo-notifications";

// ─── Schedule a Recurring Bill Reminder ──────────────────────────────────────

/**
 * Calculates the next due date for a recurring bill based on its dueDay.
 * Always targets the current or next month, depending on today vs dueDay.
 * @param {number} dueDay - Day of month (1–31)
 * @returns {Date} Next due date object
 */
const getNextDueDate = (dueDay) => {
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
 * @param {Date} dueDate
 * @param {number} notifyDaysBefore
 * @returns {Date}
 */
const getNotifyDate = (dueDate, notifyDaysBefore) => {
  const notify = new Date(dueDate);
  notify.setDate(dueDate.getDate() - notifyDaysBefore);
  return notify;
};

/**
 * Schedules a native notification reminder for a recurring bill.
 * @param {Object} bill - Recurring bill object
 * @param {string} currency - Currency symbol (e.g. "₹")
 * @returns {Promise<string>} Notification ID
 */
export const scheduleRecurringBillReminder = async (bill, currency = "₹") => {
  const dueDate = getNextDueDate(bill.dueDay);
  const notifyDate = getNotifyDate(dueDate, bill.notifyDaysBefore || 0);
  const today = new Date();

  // Only schedule if notification date is in the future
  if (notifyDate <= today) return null;

  const dueDateStr = dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  try {
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🏦 Bill Due Soon!",
        body: `${bill.name} (${currency}${bill.amount.toFixed(2)}) is due on ${dueDateStr}`,
        sound: "default",
      },
      trigger: notifyDate,
    });
    return notifId;
  } catch (err) {
    console.error("billingNotifications: failed to schedule bill reminder:", err);
    return null;
  }
};

/**
 * Cancels one or more scheduled bill reminder notifications.
 * @param {Array<string>} notificationIds
 */
export const cancelRecurringBillReminders = async (notificationIds = []) => {
  for (const id of notificationIds) {
    if (!id) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (err) {
      console.error("billingNotifications: failed to cancel notification:", id, err);
    }
  }
};
