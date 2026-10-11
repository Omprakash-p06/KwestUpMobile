/**
 * Pure Multi-Surface Intervention & Behavioral Touchpoint Engine
 * ==============================================================
 * Deterministic arbitration engine coordinating behavioral cues across
 * Notifications, Android Home-Screen Widgets, and In-App surfaces.
 *
 * Governed by:
 *  - rulebook/machine/interventionRules.json (REMINDER_ANTI_SPAM_001, QUIET_HOURS_001,
 *    REMINDER_MIN_GAP_001, WIDGET_PRIORITY_001)
 *  - 4.0/KwestUp_4.0_Master_Plan.md §9
 */

import {
  Habit,
  BehaviorEvent,
  InterventionCandidate,
  InterventionDecision,
  WidgetTouchpoint,
  TimeOptions,
} from './types';
import { loadMachineRules, evaluateRules } from './ruleEngine';
import { getLocalDateString } from '../utils/dateUtils';
import { logger } from '../utils/logger';

/**
 * Checks if a target time falls within local quiet hours [22:00, 08:00).
 * 22:00 through 07:59:59 (and 08:00:00) is quiet; 08:01+ is daytime.
 *
 * @param {Date} date - Local Date instance
 * @returns {boolean} True if within quiet hours window
 */
export function isInQuietHours(date: Date): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const startMinutes = 22 * 60; // 22:00 -> 1320
  const endMinutes = 8 * 60; // 08:00 -> 480

  // Window: [22:00, 24:00) U [00:00, 08:00]
  return totalMinutes >= startMinutes || totalMinutes <= endMinutes;
}

/**
 * Calculates deferred morning trigger date for notifications falling in quiet hours.
 * Defers to 08:15 local time (next morning if >= 22:00; same morning if < 08:00).
 *
 * @param {Date} date - Target Date instance in quiet hours
 * @returns {Date} Adjusted Date shifted to 08:15
 */
export function calculateQuietHoursDeferral(date: Date): Date {
  const deferred = new Date(date);
  const hours = date.getHours();

  if (hours >= 22) {
    // 22:00 or later -> advance by 1 calendar day
    deferred.setDate(deferred.getDate() + 1);
  }

  // Set target time to 08:15:00.000 local time
  deferred.setHours(8, 15, 0, 0);
  return deferred;
}

/**
 * Checks whether a habit is scheduled for the given calendar day.
 *
 * @param {Habit} habit - Habit entity
 * @param {Date} date - Date object
 * @returns {boolean} True if habit is scheduled on this day
 */
export function isHabitScheduledForDay(habit: Habit, date: Date): boolean {
  if (habit.status === 'paused' || habit.status === 'archived') {
    return false;
  }

  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  switch (habit.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'weekly':
      return true;
    case 'custom': {
      const weekdays =
        habit.customSchedule?.weekdays ||
        (habit.customSchedule as any)?.daysOfWeek;
      if (Array.isArray(weekdays)) {
        return weekdays.includes(dayOfWeek);
      }
      return true;
    }
    default:
      return true;
  }
}

/**
 * Arbitrates a behavioral notification candidate against historical dispatches
 * and deterministic machine rules (REMINDER_ANTI_SPAM_001, QUIET_HOURS_001, REMINDER_MIN_GAP_001).
 *
 * @param {InterventionCandidate} candidate - Proposed intervention candidate
 * @param {Array<{ category?: string; dispatchedAt: string; triggerDate?: string }>} history - Prior notifications
 * @param {TimeOptions} [options={}] - Injectable clock options
 * @returns {InterventionDecision} Arbitration decision with audit trail
 */
export function arbitrateNotificationIntervention(
  candidate: InterventionCandidate,
  history: Array<{ category?: string; dispatchedAt: string; triggerDate?: string }> = [],
  options: TimeOptions = {}
): InterventionDecision {
  const nowIso = options.now || new Date().toISOString();
  const todayDate = options.todayDate || getLocalDateString(nowIso);
  const nowDate = new Date(nowIso);

  const targetDate = candidate.targetTime ? new Date(candidate.targetTime) : nowDate;
  const effectiveTargetDate = isNaN(targetDate.getTime()) ? nowDate : targetDate;

  // 1. Calculate count of behavioral notifications today
  const behavioralToday = history.filter((entry) => {
    if (entry.category && entry.category !== 'behavior') return false;
    const entryDateStr = entry.triggerDate || entry.dispatchedAt;
    const entryLocalDate = getLocalDateString(entryDateStr);
    return entryLocalDate === todayDate;
  });
  const behaviorNotificationsToday = behavioralToday.length;

  // 2. Evaluate quiet hours [22:00, 08:00)
  const inQuiet = isInQuietHours(effectiveTargetDate);

  // 3. Calculate minutes since the most recent behavioral notification
  let minutesSinceLastNotification = Infinity;
  if (history.length > 0) {
    const behavioralEntries = history.filter(
      (entry) => !entry.category || entry.category === 'behavior'
    );

    if (behavioralEntries.length > 0) {
      // Find latest entry timestamp
      let latestMs = -Infinity;
      for (const entry of behavioralEntries) {
        const timeStr = entry.triggerDate || entry.dispatchedAt;
        const ms = new Date(timeStr).getTime();
        if (Number.isFinite(ms) && ms > latestMs) {
          latestMs = ms;
        }
      }

      if (Number.isFinite(latestMs) && latestMs > 0) {
        const diffMs = effectiveTargetDate.getTime() - latestMs;
        minutesSinceLastNotification = Math.max(0, Math.floor(diffMs / 60000));
      }
    }
  }

  // 4. Assemble evaluation context for machine rules
  const context: Record<string, unknown> = {
    surface: 'notification',
    behaviorNotificationsToday,
    currentTime: inQuiet ? 'inQuietHours' : 'normal',
    minutesSinceLastNotification,
  };

  const interventionRules = loadMachineRules('intervention');
  const evaluationResult = evaluateRules(interventionRules, context);
  const rulesApplied = evaluationResult.rulesApplied;

  // 5. Arbitrate in descending priority order matching interventionRules.json:
  // Priority 100: REMINDER_ANTI_SPAM_001 (>= 3 -> Block notification and fall back to widget)
  if (rulesApplied.includes('REMINDER_ANTI_SPAM_001')) {
    logger.debug('Intervention blocked by REMINDER_ANTI_SPAM_001; redirecting to widget', {
      behaviorNotificationsToday,
    });
    return {
      approved: true,
      targetSurface: 'widget',
      action: 'BLOCK_BEHAVIOR_NOTIFICATION',
      reason: 'daily-cap-fallback-widget',
      rulesApplied,
    };
  }

  // Priority 95: QUIET_HOURS_001 (inQuietHours -> Defer to morning shift 08:15)
  if (rulesApplied.includes('QUIET_HOURS_001')) {
    const deferredDate = calculateQuietHoursDeferral(effectiveTargetDate);
    const scheduledFor = deferredDate.toISOString();
    logger.debug('Intervention deferred by QUIET_HOURS_001 until morning', {
      original: effectiveTargetDate.toISOString(),
      scheduledFor,
    });
    return {
      approved: true,
      targetSurface: 'notification',
      action: 'DEFER_NOTIFICATION_UNTIL_MORNING',
      scheduledFor,
      reason: 'quiet-hours-deferred',
      rulesApplied,
    };
  }

  // Priority 90: REMINDER_MIN_GAP_001 (< 90 minutes cooldown -> Throttle notification)
  if (rulesApplied.includes('REMINDER_MIN_GAP_001')) {
    logger.debug('Intervention throttled by REMINDER_MIN_GAP_001 (cooldown)', {
      minutesSinceLastNotification,
    });
    return {
      approved: false,
      targetSurface: 'notification',
      action: 'THROTTLE_NOTIFICATION',
      reason: 'min-gap-cooldown',
      rulesApplied,
    };
  }

  // Default: approved for notification dispatch
  return {
    approved: true,
    targetSurface: 'notification',
    action: 'DISPATCH_NOTIFICATION',
    reason: 'approved',
    rulesApplied: [],
  };
}

/**
 * Selects the highest priority behavioral touchpoint for Android home-screen widgets
 * governed by WIDGET_PRIORITY_001 (Recovery > Today Habit > Next Action).
 *
 * @param {Habit[]} habits - Active habits in storage
 * @param {TimeOptions} [options={}] - Injectable clock options
 * @returns {WidgetTouchpoint} Highest priority touchpoint with rule audit log
 */
export function selectWidgetTouchpoint(
  habits: Habit[] = [],
  options: TimeOptions = {}
): WidgetTouchpoint {
  const nowIso = options.now || new Date().toISOString();
  const todayDate = options.todayDate || getLocalDateString(nowIso);
  const nowDate = new Date(nowIso);

  // Evaluate WIDGET_PRIORITY_001 machine rule
  const context: Record<string, unknown> = {
    surface: 'widget',
    event: 'RENDER_WIDGET',
  };
  const interventionRules = loadMachineRules('intervention');
  const evaluationResult = evaluateRules(interventionRules, context);
  const rulesApplied = evaluationResult.rulesApplied.includes('WIDGET_PRIORITY_001')
    ? ['WIDGET_PRIORITY_001']
    : ['WIDGET_PRIORITY_001', ...evaluationResult.rulesApplied];

  // Hierarchy Level 1: Recovery ("Never Miss Twice")
  const recoveryHabit = habits.find((h) => h.status === 'recovery');
  if (recoveryHabit) {
    return {
      type: 'recovery',
      habitId: recoveryHabit.id,
      title: "DON'T MISS TWICE",
      subtitle: `${recoveryHabit.title}: You missed yesterday. 2-min version ready.`,
      actionLabel: '[ 2-MIN VERSION ]',
      actionType: 'COMPLETE_HABIT',
      rulesApplied,
    };
  }

  // Hierarchy Level 2: Today Habit (Active, scheduled for today, incomplete)
  const todayDueHabit = habits.find((h) => {
    if (h.status !== 'active') return false;
    if (h.lastCompletedDate === todayDate) return false;
    return isHabitScheduledForDay(h, nowDate);
  });

  if (todayDueHabit) {
    return {
      type: 'today_due',
      habitId: todayDueHabit.id,
      title: 'TODAY OBJECTIVE',
      subtitle: `${todayDueHabit.title}: ${todayDueHabit.normalTarget || todayDueHabit.behavior}`,
      actionLabel: '[ COMPLETE ]',
      actionType: 'COMPLETE_HABIT',
      rulesApplied,
    };
  }

  // Hierarchy Level 3: Next Action (Active habit starter, 2-minute minimum)
  const nextActionHabit = habits.find((h) => {
    if (h.status !== 'active') return false;
    return h.lastCompletedDate !== todayDate;
  });

  if (nextActionHabit) {
    return {
      type: 'next_action',
      habitId: nextActionHabit.id,
      title: 'NEXT ACTION',
      subtitle: `${nextActionHabit.title}: ${nextActionHabit.minimumAction}`,
      actionLabel: '[ START ]',
      actionType: 'START_HABIT_ACTION',
      rulesApplied,
    };
  }

  // Standby: All habits completed or no habits active
  return {
    type: 'standby',
    title: 'SYS_STANDBY',
    subtitle: 'ALL HABITS SATISFIED // PROTOCOLS CLEAR',
    actionLabel: '[ STANDBY ]',
    actionType: 'STANDBY',
    rulesApplied,
  };
}

/**
 * Arbitrates active behavioral interventions for in-app surface (dialogs, banners).
 *
 * @param {Habit[]} habits - Active habits in storage
 * @param {BehaviorEvent[]} _events - Recent behavioral telemetry events
 * @param {TimeOptions} [options={}] - Injectable clock options
 * @returns {{ shouldPrompt: boolean; touchpoint: WidgetTouchpoint | null; rulesApplied: string[] }}
 */
export function arbitrateInAppIntervention(
  habits: Habit[] = [],
  _events: BehaviorEvent[] = [],
  options: TimeOptions = {}
): { shouldPrompt: boolean; touchpoint: WidgetTouchpoint | null; rulesApplied: string[] } {
  const touchpoint = selectWidgetTouchpoint(habits, options);

  // In-app prompts surface when an urgent recovery state or uncompleted today habit is pending
  const shouldPrompt = touchpoint.type === 'recovery' || touchpoint.type === 'today_due';

  return {
    shouldPrompt,
    touchpoint: shouldPrompt ? touchpoint : null,
    rulesApplied: touchpoint.rulesApplied,
  };
}

export default {
  isInQuietHours,
  calculateQuietHoursDeferral,
  isHabitScheduledForDay,
  arbitrateNotificationIntervention,
  selectWidgetTouchpoint,
  arbitrateInAppIntervention,
};
