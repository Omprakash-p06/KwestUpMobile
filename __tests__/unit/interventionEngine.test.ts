import {
  isInQuietHours,
  calculateQuietHoursDeferral,
  isHabitScheduledForDay,
  arbitrateNotificationIntervention,
  selectWidgetTouchpoint,
  arbitrateInAppIntervention,
} from '../../src/behavior/interventionEngine';
import { Habit, InterventionCandidate } from '../../src/behavior/types';

describe('interventionEngine Unit Tests', () => {
  const fixedNow = '2026-10-11T12:00:00.000Z'; // Local midday (12:00)
  const fixedToday = '2026-10-11';

  describe('isInQuietHours & calculateQuietHoursDeferral', () => {
    it('detects daytime hours as not in quiet hours', () => {
      const d10am = new Date('2026-10-11T10:00:00');
      const d2pm = new Date('2026-10-11T14:30:00');
      const d959pm = new Date('2026-10-11T21:59:00');
      const d801am = new Date('2026-10-11T08:01:00');

      expect(isInQuietHours(d10am)).toBe(false);
      expect(isInQuietHours(d2pm)).toBe(false);
      expect(isInQuietHours(d959pm)).toBe(false);
      expect(isInQuietHours(d801am)).toBe(false);
    });

    it('detects night and early morning hours as quiet hours [22:00, 08:00)', () => {
      const d10pm = new Date('2026-10-11T22:00:00');
      const d1130pm = new Date('2026-10-11T23:30:00');
      const dMidnight = new Date('2026-10-11T00:00:00');
      const d4am = new Date('2026-10-11T04:15:00');

      expect(isInQuietHours(d10pm)).toBe(true);
      expect(isInQuietHours(d1130pm)).toBe(true);
      expect(isInQuietHours(dMidnight)).toBe(true);
      expect(isInQuietHours(d4am)).toBe(true);
    });

    it('treats exactly 08:00:00 as daytime (half-open [22:00,08:00) contract)', () => {
      expect(isInQuietHours(new Date('2026-10-11T08:00:00'))).toBe(false);
    });

    it('defers late-night triggers to 08:15 next calendar morning', () => {
      const dLateNight = new Date('2026-10-11T22:45:00');
      const deferred = calculateQuietHoursDeferral(dLateNight);

      expect(deferred.getDate()).toBe(12);
      expect(deferred.getHours()).toBe(8);
      expect(deferred.getMinutes()).toBe(15);
      expect(deferred.getSeconds()).toBe(0);
    });

    it('defers early-morning triggers to 08:15 same calendar morning', () => {
      const dEarlyMorning = new Date('2026-10-11T03:30:00');
      const deferred = calculateQuietHoursDeferral(dEarlyMorning);

      expect(deferred.getDate()).toBe(11);
      expect(deferred.getHours()).toBe(8);
      expect(deferred.getMinutes()).toBe(15);
      expect(deferred.getSeconds()).toBe(0);
    });
  });

  describe('isHabitScheduledForDay', () => {
    const baseHabit: Habit = {
      id: 'h1',
      identityId: 'id1',
      title: 'Coding Practice',
      behavior: 'Write TypeScript',
      frequency: 'daily',
      status: 'active',
      minimumAction: 'Write 1 function',
      normalTarget: 'Write 30 min',
      streakCount: 5,
      bestStreak: 10,
      totalEvidenceVotes: 25,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    };

    it('returns false for paused or archived habits', () => {
      const sunday = new Date('2026-10-11T12:00:00'); // Oct 11, 2026 is Sunday
      expect(isHabitScheduledForDay({ ...baseHabit, status: 'paused' }, sunday)).toBe(false);
      expect(isHabitScheduledForDay({ ...baseHabit, status: 'archived' }, sunday)).toBe(false);
    });

    it('evaluates weekday frequency correctly', () => {
      const sunday = new Date('2026-10-11T12:00:00'); // Sunday = 0
      const monday = new Date('2026-10-12T12:00:00'); // Monday = 1
      const habit: Habit = { ...baseHabit, frequency: 'weekdays' };

      expect(isHabitScheduledForDay(habit, sunday)).toBe(false);
      expect(isHabitScheduledForDay(habit, monday)).toBe(true);
    });

    it('evaluates weekend frequency correctly', () => {
      const sunday = new Date('2026-10-11T12:00:00'); // Sunday = 0
      const monday = new Date('2026-10-12T12:00:00'); // Monday = 1
      const habit: Habit = { ...baseHabit, frequency: 'weekends' };

      expect(isHabitScheduledForDay(habit, sunday)).toBe(true);
      expect(isHabitScheduledForDay(habit, monday)).toBe(false);
    });

    it('evaluates custom weekday schedule correctly', () => {
      const sunday = new Date('2026-10-11T12:00:00'); // 0
      const tuesday = new Date('2026-10-13T12:00:00'); // 2
      const habit: Habit = {
        ...baseHabit,
        frequency: 'custom',
        customSchedule: { weekdays: [2, 4] }, // Tue, Thu
      };

      expect(isHabitScheduledForDay(habit, sunday)).toBe(false);
      expect(isHabitScheduledForDay(habit, tuesday)).toBe(true);
    });
  });

  describe('arbitrateNotificationIntervention', () => {
    const sampleCandidate: InterventionCandidate = {
      habitId: 'h1',
      type: 'reminder',
      surface: 'notification',
      priority: 'normal',
      title: 'Workout Prompt',
      message: 'Time for 2-minute warmup',
      targetTime: '2026-10-11T14:00:00', // 14:00 local daytime
    };

    it('approves notification when under daily cap and outside quiet hours with no recent notification', () => {
      const decision = arbitrateNotificationIntervention(sampleCandidate, [], {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(decision.approved).toBe(true);
      expect(decision.targetSurface).toBe('notification');
      expect(decision.action).toBe('DISPATCH_NOTIFICATION');
      expect(decision.reason).toBe('approved');
    });

    it('enforces REMINDER_ANTI_SPAM_001 when daily notifications >= 3 and redirects to widget', () => {
      const history = [
        { category: 'behavior', dispatchedAt: '2026-10-11T09:00:00Z' },
        { category: 'behavior', dispatchedAt: '2026-10-11T11:00:00Z' },
        { category: 'behavior', dispatchedAt: '2026-10-11T12:30:00Z' },
      ];

      const decision = arbitrateNotificationIntervention(sampleCandidate, history, {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(decision.approved).toBe(true);
      expect(decision.targetSurface).toBe('widget');
      expect(decision.action).toBe('BLOCK_BEHAVIOR_NOTIFICATION');
      expect(decision.reason).toBe('daily-cap-fallback-widget');
      expect(decision.rulesApplied).toContain('REMINDER_ANTI_SPAM_001');
    });

    it('enforces QUIET_HOURS_001 when target is late at night, deferring to 08:15 next morning', () => {
      const nightCandidate: InterventionCandidate = {
        ...sampleCandidate,
        targetTime: '2026-10-11T23:00:00', // 23:00 night
      };

      const decision = arbitrateNotificationIntervention(nightCandidate, [], {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(decision.approved).toBe(true);
      expect(decision.targetSurface).toBe('notification');
      expect(decision.action).toBe('DEFER_NOTIFICATION_UNTIL_MORNING');
      expect(decision.reason).toBe('quiet-hours-deferred');
      expect(decision.rulesApplied).toContain('QUIET_HOURS_001');
      expect(decision.scheduledFor).toBeDefined();

      const scheduledDate = new Date(decision.scheduledFor!);
      expect(scheduledDate.getDate()).toBe(12);
      expect(scheduledDate.getHours()).toBe(8);
      expect(scheduledDate.getMinutes()).toBe(15);
    });

    it('enforces QUIET_HOURS_001 when target is early morning, deferring to 08:15 same morning', () => {
      const earlyMorningCandidate: InterventionCandidate = {
        ...sampleCandidate,
        targetTime: '2026-10-11T05:00:00', // 05:00 morning
      };

      const decision = arbitrateNotificationIntervention(earlyMorningCandidate, [], {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(decision.approved).toBe(true);
      expect(decision.targetSurface).toBe('notification');
      expect(decision.action).toBe('DEFER_NOTIFICATION_UNTIL_MORNING');
      expect(decision.rulesApplied).toContain('QUIET_HOURS_001');
      expect(decision.scheduledFor).toBeDefined();

      const scheduledDate = new Date(decision.scheduledFor!);
      expect(scheduledDate.getDate()).toBe(11);
      expect(scheduledDate.getHours()).toBe(8);
      expect(scheduledDate.getMinutes()).toBe(15);
    });

    it('enforces REMINDER_MIN_GAP_001 when previous notification was < 90 minutes ago', () => {
      const recentHistory = [
        {
          category: 'behavior',
          dispatchedAt: '2026-10-11T13:15:00', // 45 min before 14:00
        },
      ];

      const decision = arbitrateNotificationIntervention(sampleCandidate, recentHistory, {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(decision.approved).toBe(false);
      expect(decision.targetSurface).toBe('notification');
      expect(decision.action).toBe('THROTTLE_NOTIFICATION');
      expect(decision.reason).toBe('min-gap-cooldown');
      expect(decision.rulesApplied).toContain('REMINDER_MIN_GAP_001');
    });

    it('allows dispatch when previous notification was >= 90 minutes ago', () => {
      const olderHistory = [
        {
          category: 'behavior',
          dispatchedAt: '2026-10-11T12:00:00', // 120 min before 14:00
        },
      ];

      const decision = arbitrateNotificationIntervention(sampleCandidate, olderHistory, {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(decision.approved).toBe(true);
      expect(decision.targetSurface).toBe('notification');
      expect(decision.action).toBe('DISPATCH_NOTIFICATION');
    });

    it('gives priority 100 anti-spam precedence over priority 95 quiet hours', () => {
      const nightCandidate: InterventionCandidate = {
        ...sampleCandidate,
        targetTime: '2026-10-11T23:30:00', // quiet hours
      };
      const threeHistory = [
        { category: 'behavior', dispatchedAt: '2026-10-11T10:00:00Z' },
        { category: 'behavior', dispatchedAt: '2026-10-11T14:00:00Z' },
        { category: 'behavior', dispatchedAt: '2026-10-11T18:00:00Z' },
      ];

      const decision = arbitrateNotificationIntervention(nightCandidate, threeHistory, {
        now: fixedNow,
        todayDate: fixedToday,
      });

      // Anti-spam wins (priority 100 > 95), redirecting directly to widget
      expect(decision.targetSurface).toBe('widget');
      expect(decision.action).toBe('BLOCK_BEHAVIOR_NOTIFICATION');
      expect(decision.rulesApplied).toContain('REMINDER_ANTI_SPAM_001');
    });
  });

  describe('selectWidgetTouchpoint (WIDGET_PRIORITY_001)', () => {
    const habitRecovery: Habit = {
      id: 'h-rec',
      identityId: 'id1',
      title: 'Guitar Practice',
      behavior: 'Play chords',
      frequency: 'daily',
      status: 'recovery',
      minimumAction: 'Play 1 chord for 60s',
      normalTarget: 'Play 20 min',
      streakCount: 0,
      bestStreak: 7,
      totalEvidenceVotes: 14,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    };

    const habitTodayDue: Habit = {
      id: 'h-today',
      identityId: 'id1',
      title: 'Drink 2L Water',
      behavior: 'Drink water',
      frequency: 'daily',
      status: 'active',
      minimumAction: 'Drink 1 glass',
      normalTarget: 'Drink 2L',
      streakCount: 12,
      bestStreak: 12,
      totalEvidenceVotes: 40,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    };

    const habitCompletedToday: Habit = {
      id: 'h-done',
      identityId: 'id1',
      title: 'Morning Meditation',
      behavior: 'Meditate',
      frequency: 'daily',
      status: 'active',
      minimumAction: 'Breathe 1 min',
      normalTarget: 'Sit 10 min',
      streakCount: 30,
      bestStreak: 30,
      totalEvidenceVotes: 90,
      lastCompletedDate: fixedToday,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    };

    it('selects Recovery touchpoint when a habit is in recovery status (Level 1 Priority)', () => {
      const habits = [habitTodayDue, habitRecovery, habitCompletedToday];

      const touchpoint = selectWidgetTouchpoint(habits, {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(touchpoint.type).toBe('recovery');
      expect(touchpoint.habitId).toBe('h-rec');
      expect(touchpoint.title).toBe("DON'T MISS TWICE");
      expect(touchpoint.actionLabel).toBe('[ 2-MIN VERSION ]');
      expect(touchpoint.actionType).toBe('COMPLETE_HABIT');
      expect(touchpoint.rulesApplied).toContain('WIDGET_PRIORITY_001');
    });

    it('selects Today Due touchpoint when no recovery habit exists (Level 2 Priority)', () => {
      const habits = [habitCompletedToday, habitTodayDue];

      const touchpoint = selectWidgetTouchpoint(habits, {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(touchpoint.type).toBe('today_due');
      expect(touchpoint.habitId).toBe('h-today');
      expect(touchpoint.title).toBe('TODAY OBJECTIVE');
      expect(touchpoint.actionLabel).toBe('[ COMPLETE ]');
      expect(touchpoint.actionType).toBe('COMPLETE_HABIT');
      expect(touchpoint.rulesApplied).toContain('WIDGET_PRIORITY_001');
    });

    it('selects Next Action touchpoint when all today habits are finished (Level 3 Priority)', () => {
      const habitTomorrowOnly: Habit = {
        ...habitTodayDue,
        id: 'h-tomorrow',
        frequency: 'weekdays', // Sunday is not weekday
      };
      const habits = [habitCompletedToday, habitTomorrowOnly];

      const touchpoint = selectWidgetTouchpoint(habits, {
        now: fixedNow, // Sunday Oct 11, 2026
        todayDate: fixedToday,
      });

      expect(touchpoint.type).toBe('next_action');
      expect(touchpoint.habitId).toBe('h-tomorrow');
      expect(touchpoint.title).toBe('NEXT ACTION');
      expect(touchpoint.actionLabel).toBe('[ START ]');
      expect(touchpoint.actionType).toBe('START_HABIT_ACTION');
    });

    it('returns Standby touchpoint when all active habits are satisfied for today', () => {
      const habits = [habitCompletedToday];

      const touchpoint = selectWidgetTouchpoint(habits, {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(touchpoint.type).toBe('standby');
      expect(touchpoint.title).toBe('SYS_STANDBY');
      expect(touchpoint.actionLabel).toBe('[ STANDBY ]');
      expect(touchpoint.actionType).toBe('STANDBY');
    });
  });

  describe('arbitrateInAppIntervention', () => {
    it('surfaces shouldPrompt = true when recovery or today due touchpoint is pending', () => {
      const habitRecovery: Habit = {
        id: 'h-rec',
        identityId: 'id1',
        title: 'Guitar',
        behavior: 'Play',
        frequency: 'daily',
        status: 'recovery',
        minimumAction: '1 chord',
        normalTarget: '15 min',
        streakCount: 0,
        bestStreak: 5,
        totalEvidenceVotes: 10,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };

      const result = arbitrateInAppIntervention([habitRecovery], [], {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(result.shouldPrompt).toBe(true);
      expect(result.touchpoint?.type).toBe('recovery');
    });

    it('surfaces shouldPrompt = false when all habits are completed (standby)', () => {
      const habitDone: Habit = {
        id: 'h-done',
        identityId: 'id1',
        title: 'Meditation',
        behavior: 'Sit',
        frequency: 'daily',
        status: 'active',
        minimumAction: '1 min',
        normalTarget: '10 min',
        streakCount: 10,
        bestStreak: 10,
        totalEvidenceVotes: 20,
        lastCompletedDate: fixedToday,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };

      const result = arbitrateInAppIntervention([habitDone], [], {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(result.shouldPrompt).toBe(false);
      expect(result.touchpoint).toBeNull();
    });
  });
});
