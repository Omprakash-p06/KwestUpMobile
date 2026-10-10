import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ANDROID_NOTIFICATION_CHANNELS,
  NOTIFICATION_HISTORY_KEY,
  initNotificationChannels,
  requestNotificationPermissions,
  getNotificationHistory,
  recordNotificationDispatch,
  evaluateNotificationPolicy,
  scheduleNotification,
  scheduleDailyTaskReminder,
  scheduleDueDateReminder,
  scheduleBirthdayReminders,
  scheduleBillReminder,
  cancelNotification,
  cancelNotifications,
  cancelAllNotifications,
} from '../../src/services/notificationService';
import {
  DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY,
  NotificationDispatchRequest,
  NotificationHistoryEntry,
} from '../../src/services/types';
import { getLocalDateString } from '../../src/utils/dateUtils';

describe('notificationService', () => {
  const originalPlatform = Platform.OS;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  describe('Android Notification Channels (NOTIF-01 & Codex HIGH 1)', () => {
    it('declares all 5 channels using native AndroidImportance enum values (HIGH=6, DEFAULT=5, LOW=4)', () => {
      expect(Notifications.AndroidImportance.HIGH).toBe(6);
      expect(Notifications.AndroidImportance.DEFAULT).toBe(5);
      expect(Notifications.AndroidImportance.LOW).toBe(4);

      expect(ANDROID_NOTIFICATION_CHANNELS.BEHAVIOR_CUES.importance).toBe(
        Notifications.AndroidImportance.HIGH
      );
      expect(ANDROID_NOTIFICATION_CHANNELS.DAILY_TASKS.importance).toBe(
        Notifications.AndroidImportance.HIGH
      );
      expect(ANDROID_NOTIFICATION_CHANNELS.BIRTHDAYS.importance).toBe(
        Notifications.AndroidImportance.DEFAULT
      );
      expect(ANDROID_NOTIFICATION_CHANNELS.BILLING.importance).toBe(
        Notifications.AndroidImportance.DEFAULT
      );
      expect(ANDROID_NOTIFICATION_CHANNELS.SYSTEM.importance).toBe(
        Notifications.AndroidImportance.LOW
      );

      // Verify channel IDs
      expect(ANDROID_NOTIFICATION_CHANNELS.BEHAVIOR_CUES.id).toBe('kwestup_behavior_cues');
      expect(ANDROID_NOTIFICATION_CHANNELS.DAILY_TASKS.id).toBe('kwestup_daily_tasks');
      expect(ANDROID_NOTIFICATION_CHANNELS.BIRTHDAYS.id).toBe('kwestup_birthdays');
      expect(ANDROID_NOTIFICATION_CHANNELS.BILLING.id).toBe('kwestup_billing');
      expect(ANDROID_NOTIFICATION_CHANNELS.SYSTEM.id).toBe('kwestup_system');

      // Verify vibration patterns on HIGH channels
      expect(ANDROID_NOTIFICATION_CHANNELS.BEHAVIOR_CUES.vibrationPattern).toEqual([
        0, 250, 250, 250,
      ]);
      expect(ANDROID_NOTIFICATION_CHANNELS.DAILY_TASKS.vibrationPattern).toEqual([
        0, 250, 250, 250,
      ]);
    });

    it('initializes all channels on Android and sets notification handler', async () => {
      Platform.OS = 'android';
      await initNotificationChannels();

      expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          handleNotification: expect.any(Function),
        })
      );

      // Check channels were registered
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(5);
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'kwestup_behavior_cues',
        expect.objectContaining({
          name: 'Behavioral Cues',
          importance: 6,
        })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'kwestup_daily_tasks',
        expect.objectContaining({
          name: 'Daily Tasks',
          importance: 6,
        })
      );
    });

    it('skips channel registration on non-Android platforms', async () => {
      Platform.OS = 'ios';
      await initNotificationChannels();

      expect(Notifications.setNotificationHandler).toHaveBeenCalled();
      expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });

  describe('Permissions Workflow', () => {
    it('requests permissions on Android and handles granted status', async () => {
      Platform.OS = 'android';
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      const status = await requestNotificationPermissions();
      expect(status).toBe('granted');
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    });

    it('displays Alert when permission is denied on Android', async () => {
      Platform.OS = 'android';
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      const status = await requestNotificationPermissions();
      expect(status).toBe('denied');
      expect(alertSpy).toHaveBeenCalledWith(
        'Permission required',
        expect.stringContaining('Please enable notification permissions')
      );
      alertSpy.mockRestore();
    });

    it('requests permissions on iOS with existing check', async () => {
      Platform.OS = 'ios';
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'undetermined',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      const status = await requestNotificationPermissions();
      expect(status).toBe('granted');
      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('Deterministic Behavioral Policy Engine (NOTIF-02)', () => {
    describe('Quiet Hours & Deferral Anchoring', () => {
      it('defers 23:30 target to 08:01 next morning', () => {
        const target = new Date('2026-10-10T23:30:00');
        const req: NotificationDispatchRequest = {
          category: 'behavior',
          payloadKey: 'cue-night-stretch',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          triggerDate: target.toISOString(),
          title: 'Night Stretch',
          body: 'Time to stretch',
        };

        const res = evaluateNotificationPolicy(req, [], DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBe('quiet-hours');
        expect(res.adjustedTriggerDate).toBeDefined();

        const adjusted = new Date(res.adjustedTriggerDate!);
        expect(adjusted.getDate()).toBe(target.getDate() + 1);
        expect(adjusted.getHours()).toBe(8);
        expect(adjusted.getMinutes()).toBe(1);
      });

      it('defers 04:15 target to 08:01 same morning', () => {
        const target = new Date('2026-10-10T04:15:00');
        const req: NotificationDispatchRequest = {
          category: 'behavior',
          payloadKey: 'cue-early-water',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          triggerDate: target.toISOString(),
          title: 'Drink Water',
          body: 'Hydrate early',
        };

        const res = evaluateNotificationPolicy(req, [], DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBe('quiet-hours');
        expect(res.adjustedTriggerDate).toBeDefined();

        const adjusted = new Date(res.adjustedTriggerDate!);
        expect(adjusted.getDate()).toBe(target.getDate());
        expect(adjusted.getHours()).toBe(8);
        expect(adjusted.getMinutes()).toBe(1);
      });

      it('defers 08:00:30 target to 08:01 same morning (08:00 is quiet)', () => {
        const target = new Date('2026-10-10T08:00:30');
        const req: NotificationDispatchRequest = {
          category: 'behavior',
          payloadKey: 'cue-breakfast',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          triggerDate: target.toISOString(),
          title: 'Breakfast',
          body: 'Eat well',
        };

        const res = evaluateNotificationPolicy(req, [], DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBe('quiet-hours');
        expect(res.adjustedTriggerDate).toBeDefined();
        const adjusted = new Date(res.adjustedTriggerDate!);
        expect(adjusted.getHours()).toBe(8);
        expect(adjusted.getMinutes()).toBe(1);
      });

      it('allows 14:00 target without deferral (outside quiet hours)', () => {
        const target = new Date('2026-10-10T14:00:00');
        const req: NotificationDispatchRequest = {
          category: 'behavior',
          payloadKey: 'cue-walk',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          triggerDate: target.toISOString(),
          title: 'Afternoon Walk',
          body: 'Step outside',
        };

        const res = evaluateNotificationPolicy(req, [], DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBe('ok');
        expect(res.adjustedTriggerDate).toBeUndefined();
      });
    });

    describe('Daily Notification Cap (Max 3/Day)', () => {
      it('blocks 4th behavioral cue on the same calendar day', () => {
        const target = new Date('2026-10-10T15:00:00');
        const targetDateStr = getLocalDateString(target);

        const history: NotificationHistoryEntry[] = [
          {
            id: 'n1',
            category: 'behavior',
            payloadKey: 'k1',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T09:00:00.000Z`,
          },
          {
            id: 'n2',
            category: 'behavior',
            payloadKey: 'k2',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T11:00:00.000Z`,
          },
          {
            id: 'n3',
            category: 'behavior',
            payloadKey: 'k3',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T13:00:00.000Z`,
          },
        ];

        const req: NotificationDispatchRequest = {
          category: 'behavior',
          payloadKey: 'k4',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          triggerDate: target.toISOString(),
          title: 'Fourth Cue',
          body: 'Blocked by cap',
        };

        const res = evaluateNotificationPolicy(req, history, DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('daily-cap');
      });

      it('critical category bypasses daily cap', () => {
        const target = new Date('2026-10-10T15:00:00');
        const targetDateStr = getLocalDateString(target);

        const history: NotificationHistoryEntry[] = [
          {
            id: 'n1',
            category: 'behavior',
            payloadKey: 'k1',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T09:00:00.000Z`,
          },
          {
            id: 'n2',
            category: 'behavior',
            payloadKey: 'k2',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T11:00:00.000Z`,
          },
          {
            id: 'n3',
            category: 'behavior',
            payloadKey: 'k3',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T13:00:00.000Z`,
          },
        ];

        const req: NotificationDispatchRequest = {
          category: 'critical',
          payloadKey: 'crit-alert',
          recurrence: 'one-shot',
          channelId: 'kwestup_system',
          triggerDate: target.toISOString(),
          title: 'Emergency',
          body: 'Critical bypass',
        };

        const res = evaluateNotificationPolicy(req, history, DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBe('ok');
      });
    });

    describe('Minimum Notification Gap (90 Minutes)', () => {
      it('blocks notification within 90 minutes of another behavioral cue', () => {
        const target = new Date('2026-10-10T14:30:00');
        const history: NotificationHistoryEntry[] = [
          {
            id: 'n1',
            category: 'behavior',
            payloadKey: 'k1',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: new Date('2026-10-10T13:45:00').toISOString(), // 45m earlier
          },
        ];

        const req: NotificationDispatchRequest = {
          category: 'behavior',
          payloadKey: 'k2',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          triggerDate: target.toISOString(),
          title: 'Too Soon',
          body: 'Violates 90m min-gap',
        };

        const res = evaluateNotificationPolicy(req, history, DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('min-gap');
      });

      it('allows notification after 95 minutes of prior behavioral cue', () => {
        const target = new Date('2026-10-10T14:30:00');
        const history: NotificationHistoryEntry[] = [
          {
            id: 'n1',
            category: 'behavior',
            payloadKey: 'k1',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: new Date('2026-10-10T12:55:00').toISOString(), // 95m earlier
          },
        ];

        const req: NotificationDispatchRequest = {
          category: 'behavior',
          payloadKey: 'k2',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          triggerDate: target.toISOString(),
          title: 'Allowed',
          body: 'Satisfies min-gap',
        };

        const res = evaluateNotificationPolicy(req, history, DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBe('ok');
      });
    });

    describe('Deduplication Window (30 Minutes)', () => {
      it('blocks duplicate payloadKey within 30 minutes', () => {
        const target = new Date('2026-10-10T14:30:00');
        const history: NotificationHistoryEntry[] = [
          {
            id: 'n1',
            category: 'behavior',
            payloadKey: 'water-habit-1',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: new Date('2026-10-10T14:15:00').toISOString(), // 15m earlier
          },
        ];

        const req: NotificationDispatchRequest = {
          category: 'behavior',
          payloadKey: 'water-habit-1',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          triggerDate: target.toISOString(),
          title: 'Water',
          body: 'Drink water',
        };

        // Note: min-gap would also trigger, test with policy minGapMinutes: 0 to isolate dedup
        const customPolicy = {
          ...DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY,
          minGapMinutes: 0,
        };

        const res = evaluateNotificationPolicy(req, history, customPolicy);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('dedup');
      });
    });

    describe('User Opt-Out Kill-Switch', () => {
      it('blocks non-critical notification when userOptOut is true', () => {
        const policy = {
          ...DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY,
          userOptOut: true,
        };

        const req: NotificationDispatchRequest = {
          category: 'behavior',
          payloadKey: 'habit-1',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          title: 'Habit',
          body: 'Cue',
        };

        const res = evaluateNotificationPolicy(req, [], policy);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('user-opt-out');
      });

      it('allows critical notification even when userOptOut is true', () => {
        const policy = {
          ...DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY,
          userOptOut: true,
        };

        const req: NotificationDispatchRequest = {
          category: 'critical',
          payloadKey: 'critical-sync',
          recurrence: 'one-shot',
          channelId: 'kwestup_system',
          title: 'Critical Alert',
          body: 'System requirement',
        };

        const res = evaluateNotificationPolicy(req, [], policy);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBe('ok');
      });
    });

    describe('Recurring-Exempt Semantics (Codex HIGH 2)', () => {
      it('allows recurring task reminder even when daily cap and min-gap are exceeded', () => {
        const target = new Date('2026-10-10T14:30:00');
        const targetDateStr = getLocalDateString(target);

        // 5 prior dispatches today + dispatch 10 minutes ago
        const history: NotificationHistoryEntry[] = [
          {
            id: 'n1',
            category: 'behavior',
            payloadKey: 'k1',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T09:00:00.000Z`,
          },
          {
            id: 'n2',
            category: 'behavior',
            payloadKey: 'k2',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T10:00:00.000Z`,
          },
          {
            id: 'n3',
            category: 'behavior',
            payloadKey: 'k3',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T11:00:00.000Z`,
          },
          {
            id: 'n4',
            category: 'behavior',
            payloadKey: 'k4',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: `${targetDateStr}T12:00:00.000Z`,
          },
          {
            id: 'n5',
            category: 'behavior',
            payloadKey: 'k5',
            recurrence: 'one-shot',
            channelId: 'kwestup_behavior_cues',
            dispatchedAt: new Date('2026-10-10T14:20:00').toISOString(),
          },
        ];

        const req: NotificationDispatchRequest = {
          category: 'task',
          payloadKey: 'daily_task_stretch',
          recurrence: 'recurring',
          channelId: 'kwestup_daily_tasks',
          triggerDate: target.toISOString(),
          title: 'Daily Stretch',
          body: 'Time for daily task',
        };

        const res = evaluateNotificationPolicy(req, history, DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBe('ok');
      });
    });
  });

  describe('scheduleNotification Dispatch & History Persistence', () => {
    it('schedules notification natively and writes history only upon success', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValueOnce('notif-123');

      const target = new Date('2026-10-10T14:00:00');
      const req: NotificationDispatchRequest = {
        category: 'behavior',
        payloadKey: 'test-cue',
        recurrence: 'one-shot',
        channelId: 'kwestup_behavior_cues',
        triggerDate: target.toISOString(),
        title: 'Exercise',
        body: 'Do 10 pushups',
      };

      const notifId = await scheduleNotification(req);
      expect(notifId).toBe('notif-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Exercise',
          body: 'Do 10 pushups',
          sound: 'default',
          data: undefined,
        },
        trigger: {
          date: target,
          channelId: 'kwestup_behavior_cues',
        },
      });

      // Verify history was saved
      const history = await getNotificationHistory();
      expect(history.length).toBe(1);
      expect(history[0].id).toBe('notif-123');
      expect(history[0].payloadKey).toBe('test-cue');
    });

    it('does not write history if native scheduling rejects', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Native scheduling error')
      );

      const target = new Date('2026-10-10T14:00:00');
      const req: NotificationDispatchRequest = {
        category: 'behavior',
        payloadKey: 'test-fail',
        recurrence: 'one-shot',
        channelId: 'kwestup_behavior_cues',
        triggerDate: target.toISOString(),
        title: 'Exercise',
        body: 'Do 10 pushups',
      };

      const notifId = await scheduleNotification(req);
      expect(notifId).toBeNull();

      const history = await getNotificationHistory();
      expect(history.length).toBe(0);
    });

    it('does not schedule natively if policy blocks dispatch', async () => {
      const policy = {
        ...DEFAULT_BEHAVIORAL_NOTIFICATION_POLICY,
        userOptOut: true,
      };

      const req: NotificationDispatchRequest = {
        category: 'behavior',
        payloadKey: 'test-blocked',
        recurrence: 'one-shot',
        channelId: 'kwestup_behavior_cues',
        title: 'Exercise',
        body: 'Do 10 pushups',
      };

      const notifId = await scheduleNotification(req, policy);
      expect(notifId).toBeNull();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      const history = await getNotificationHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('Specialized Schedulers', () => {
    describe('scheduleDailyTaskReminder', () => {
      it('validates HH:MM format and schedules repeating trigger', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValueOnce('daily-task-1');

        const notifId = await scheduleDailyTaskReminder({
          id: 'task-1',
          name: 'Read Book',
          time: '08:30',
        });

        expect(notifId).toBe('daily-task-1');
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
          content: {
            title: 'Daily Task: Read Book',
            body: 'Time for your daily task!',
            sound: 'default',
          },
          trigger: {
            hour: 8,
            minute: 30,
            repeats: true,
            channelId: 'kwestup_daily_tasks',
          },
        });
      });

      it('rejects invalid time formats', async () => {
        const notifId1 = await scheduleDailyTaskReminder({ time: '25:00' });
        const notifId2 = await scheduleDailyTaskReminder({ time: '8:3' });
        const notifId3 = await scheduleDailyTaskReminder({ time: 'invalid' });

        expect(notifId1).toBeNull();
        expect(notifId2).toBeNull();
        expect(notifId3).toBeNull();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      });
    });

    describe('scheduleDueDateReminder', () => {
      it('skips past due dates', async () => {
        const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
        const notifId = await scheduleDueDateReminder({
          id: 'task-past',
          title: 'Old Task',
          dueDate: pastDate.toISOString(),
        });

        expect(notifId).toBeNull();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      });

      it('schedules future due date reminder', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValueOnce('due-notif-1');
        const futureDate = new Date(Date.now() + 86400000); // tomorrow

        const notifId = await scheduleDueDateReminder({
          id: 'task-future',
          title: 'Project Submission',
          description: 'Submit report',
          dueDate: futureDate.toISOString(),
        });

        expect(notifId).toBe('due-notif-1');
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      });
    });

    describe('scheduleBirthdayReminders', () => {
      it('handles Feb 29 non-leap year observance on Feb 28', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('bday-notif');

        const ids = await scheduleBirthdayReminders({
          id: 'b1',
          name: 'Leap Baby',
          birthDate: '1996-02-29',
          remindAtTime: '09:00',
        });

        expect(Array.isArray(ids)).toBe(true);
        // Verify scheduleNotificationAsync was called
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();

        // Check call arguments: target dates for non-leap years should be Feb 28 (month 1, day 28)
        const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
        for (const call of calls) {
          expect(call[0].trigger.channelId).toBe('kwestup_birthdays');
          const trigger = call[0].trigger.date || call[0].trigger;
          if (trigger instanceof Date) {
            const yr = trigger.getFullYear();
            const isLeapYear = (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
            if (!isLeapYear && trigger.getMonth() === 1) {
              expect(trigger.getDate()).toBe(28);
            }
          }
        }
      });

      it('performs atomic rollback if a mid-batch schedule call fails', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock)
          .mockResolvedValueOnce('bday-1')
          .mockRejectedValueOnce(new Error('Native error'));

        const ids = await scheduleBirthdayReminders({
          id: 'b2',
          name: 'Rollback Test',
          birthDate: '2000-05-15',
          remindAtTime: '09:00',
          advanceReminder: '1_week',
        });

        expect(ids).toEqual([]);
        // Verify rollback cancelled bday-1
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('bday-1');
      });
    });

    describe('scheduleBillReminder (Codex MEDIUM 6)', () => {
      it('skips scheduling on malformed or non-positive amount and logs warning without fabricating zero alert', async () => {
        const notifId1 = await scheduleBillReminder({
          id: 'bill-1',
          name: 'Electricity',
          amount: 0,
          dueDay: 15,
        });
        const notifId2 = await scheduleBillReminder({
          id: 'bill-2',
          name: 'Gas',
          amount: -50,
          dueDay: 15,
        });
        const notifId3 = await scheduleBillReminder({
          id: 'bill-3',
          name: 'Internet',
          amount: NaN,
          dueDay: 15,
        });
        const notifId4 = await scheduleBillReminder({
          id: 'bill-4',
          name: 'Water',
          amount: undefined,
          dueDay: 15,
        });

        expect(notifId1).toBeNull();
        expect(notifId2).toBeNull();
        expect(notifId3).toBeNull();
        expect(notifId4).toBeNull();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      });

      it('schedules valid bill reminder with month-end clamping', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValueOnce('bill-notif-1');

        const notifId = await scheduleBillReminder({
          id: 'bill-rent',
          name: 'Apartment Rent',
          amount: 15000,
          dueDay: 31,
          notifyDaysBefore: 1,
        });

        expect(notifId).toBe('bill-notif-1');
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.objectContaining({
              title: '🏦 Bill Due Soon!',
              body: expect.stringContaining('Apartment Rent (₹15000.00)'),
            }),
            trigger: expect.objectContaining({
              channelId: 'kwestup_billing',
            }),
          })
        );
      });
    });
  });

  describe('Cancellation Functions (Codex MEDIUM 5)', () => {
    it('cancels single notification without throwing', async () => {
      await cancelNotification('notif-to-cancel');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-to-cancel');
    });

    it('cancels multiple notifications and collects partial failures into aggregate error', async () => {
      (Notifications.cancelScheduledNotificationAsync as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Cancel failed'))
        .mockResolvedValueOnce(undefined);

      await expect(
        cancelNotifications(['notif-1', 'notif-2', 'notif-3'])
      ).rejects.toThrow('Failed to cancel 1 notifications: notif-2');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(3);
    });

    it('cancels all scheduled notifications via cancelAllNotifications', async () => {
      await cancelAllNotifications();
      expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe('History & Storage Robustness (Codex MEDIUM 7)', () => {
    it('falls back to empty array on corrupt history JSON without crashing', async () => {
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, '{ invalid json');
      const history = await getNotificationHistory();
      expect(history).toEqual([]);
    });

    it('falls back to empty array on non-array history JSON', async () => {
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify({ not: 'an array' }));
      const history = await getNotificationHistory();
      expect(history).toEqual([]);
    });

    it('safely filters out non-object entries in history array', async () => {
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify([null, 'bad', 42]));
      const history = await getNotificationHistory();
      expect(history).toEqual([]);
    });

    it('gracefully handles AsyncStorage read rejection', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Disk error'));
      const history = await getNotificationHistory();
      expect(history).toEqual([]);
    });

    it('gracefully handles AsyncStorage write rejection without throwing', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Write error'));
      await expect(
        recordNotificationDispatch({
          id: 'test-id',
          category: 'behavior',
          payloadKey: 'test-key',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          dispatchedAt: new Date().toISOString(),
        })
      ).resolves.not.toThrow();
    });

    it('prunes history entries older than 48 hours', async () => {
      const now = Date.now();
      const oldDate = new Date(now - 50 * 3600 * 1000).toISOString(); // 50 hours old
      const freshDate = new Date(now - 2 * 3600 * 1000).toISOString(); // 2 hours old

      const entries: NotificationHistoryEntry[] = [
        {
          id: 'old-1',
          category: 'behavior',
          payloadKey: 'old-key',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          dispatchedAt: oldDate,
        },
        {
          id: 'fresh-1',
          category: 'behavior',
          payloadKey: 'fresh-key',
          recurrence: 'one-shot',
          channelId: 'kwestup_behavior_cues',
          dispatchedAt: freshDate,
        },
      ];

      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(entries));

      const history = await getNotificationHistory();
      expect(history.length).toBe(1);
      expect(history[0].id).toBe('fresh-1');
    });
  });
});
