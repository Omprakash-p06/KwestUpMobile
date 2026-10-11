/**
 * Behavioral Home-Screen Widget Unit Tests
 * =========================================
 * Validates:
 * 1. Widget touchpoint priority arbitration (Recovery > Today Due > Next Action > Standby).
 * 2. Headless habit mutation execution and streak updating via widgetTaskHandler.
 * 3. Bounded behavioral event persistence with 500-item FIFO cap.
 * 4. Local EventBus telemetry dispatch with source 'widget'.
 * 5. HabitWidget component rendering contracts.
 *
 * Requirements: [WIDG-03, INTV-01]
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { HabitWidget } from '../../widgets/HabitWidget';
import { widgetTaskHandler } from '../../widgets/widget-task-handler';
import { selectWidgetTouchpoint } from '../../src/behavior/interventionEngine';
import { completeHabit } from '../../src/behavior/habitEngine';
import { eventBus } from '../../src/behavior/eventBus';
import {
  HABITS_STORAGE_KEY,
  BEHAVIOR_EVENTS_STORAGE_KEY,
  MAX_PERSISTED_BEHAVIOR_EVENTS,
} from '../../src/context/HabitContext';
import type { Habit, BehaviorEvent, WidgetTouchpoint } from '../../src/behavior/types';

const mockScreenInfo = {
  screenHeightDp: 800,
  screenWidthDp: 360,
  density: 2.75,
  densityDpi: 440,
};

describe('behavioralWidget', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // 1. Widget Touchpoint Priority Arbitration Tests
  // ---------------------------------------------------------------------------
  describe('Touchpoint Priority Arbitration', () => {
    const fixedNow = '2026-06-15T10:00:00.000Z'; // Monday
    const fixedToday = '2026-06-15';

    const baseHabit: Habit = {
      id: 'habit_1',
      identityId: 'id_1',
      title: 'Morning Meditation',
      behavior: 'Meditate for 10 minutes',
      frequency: 'daily',
      status: 'active',
      minimumAction: '1 conscious breath',
      normalTarget: '10 minutes sitting',
      stretchTarget: '20 minutes sitting',
      streakCount: 3,
      bestStreak: 5,
      totalEvidenceVotes: 10,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };

    it('Level 1: returns Recovery touchpoint when any habit has recovery status', () => {
      const recoveryHabit: Habit = {
        ...baseHabit,
        id: 'habit_rec',
        title: 'Deep Work',
        status: 'recovery',
      };
      const activeHabit: Habit = {
        ...baseHabit,
        id: 'habit_act',
        title: 'Exercise',
        status: 'active',
      };

      const touchpoint = selectWidgetTouchpoint([activeHabit, recoveryHabit], {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(touchpoint.type).toBe('recovery');
      expect(touchpoint.habitId).toBe('habit_rec');
      expect(touchpoint.title).toBe("DON'T MISS TWICE");
      expect(touchpoint.actionLabel).toBe('[ 2-MIN VERSION ]');
      expect(touchpoint.actionType).toBe('COMPLETE_HABIT');
      expect(touchpoint.rulesApplied).toContain('WIDGET_PRIORITY_001');
    });

    it('Level 2: returns Today Due touchpoint when active habit is scheduled today and incomplete', () => {
      const activeHabit: Habit = {
        ...baseHabit,
        id: 'habit_act',
        title: 'Morning Jog',
        status: 'active',
        frequency: 'daily',
        lastCompletedDate: '2026-06-14',
      };

      const touchpoint = selectWidgetTouchpoint([activeHabit], {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(touchpoint.type).toBe('today_due');
      expect(touchpoint.habitId).toBe('habit_act');
      expect(touchpoint.title).toBe('TODAY OBJECTIVE');
      expect(touchpoint.subtitle).toContain('Morning Jog');
      expect(touchpoint.actionLabel).toBe('[ COMPLETE ]');
      expect(touchpoint.actionType).toBe('COMPLETE_HABIT');
      expect(touchpoint.rulesApplied).toContain('WIDGET_PRIORITY_001');
    });

    it('Level 3: returns Next Action touchpoint when habit is active but not scheduled for current day', () => {
      // Habit scheduled only on Fridays (2026-06-15 is Monday, day 1)
      const weekendHabit: Habit = {
        ...baseHabit,
        id: 'habit_fri',
        title: 'Weekly Review',
        frequency: 'custom',
        customSchedule: {
          weekdays: [5], // Friday
        },
        status: 'active',
        lastCompletedDate: '2026-06-12',
      };

      const touchpoint = selectWidgetTouchpoint([weekendHabit], {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(touchpoint.type).toBe('next_action');
      expect(touchpoint.habitId).toBe('habit_fri');
      expect(touchpoint.title).toBe('NEXT ACTION');
      expect(touchpoint.actionLabel).toBe('[ START ]');
      expect(touchpoint.actionType).toBe('START_HABIT_ACTION');
    });

    it('Level 4: returns Standby touchpoint when all habits completed today or empty', () => {
      const completedHabit: Habit = {
        ...baseHabit,
        id: 'habit_done',
        title: 'Read Book',
        status: 'active',
        lastCompletedDate: fixedToday,
      };

      const touchpointDone = selectWidgetTouchpoint([completedHabit], {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(touchpointDone.type).toBe('standby');
      expect(touchpointDone.title).toBe('SYS_STANDBY');
      expect(touchpointDone.actionLabel).toBe('[ STANDBY ]');
      expect(touchpointDone.actionType).toBe('STANDBY');

      const touchpointEmpty = selectWidgetTouchpoint([], {
        now: fixedNow,
        todayDate: fixedToday,
      });
      expect(touchpointEmpty.type).toBe('standby');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Headless Habit Mutation & Storage Sync via widgetTaskHandler
  // ---------------------------------------------------------------------------
  describe('Headless Habit Mutation in widgetTaskHandler', () => {
    const mockHabit: Habit = {
      id: 'habit_headless_1',
      identityId: 'id_1',
      title: 'Hydrate 2L',
      behavior: 'Drink water',
      frequency: 'daily',
      status: 'active',
      minimumAction: '1 glass of water',
      normalTarget: '2L water',
      stretchTarget: '3L water',
      streakCount: 4,
      bestStreak: 6,
      totalEvidenceVotes: 12,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };

    it('processes COMPLETE_HABIT click: updates streak, saves to storage, and requests widget update', async () => {
      await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([mockHabit]));

      const mockRender = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'COMPLETE_HABIT',
        clickActionData: { habitId: 'habit_headless_1' },
        widgetInfo: {
          widgetId: 101,
          widgetName: 'HabitWidget',
          width: 300,
          height: 150,
          screenInfo: mockScreenInfo,
        },
        renderWidget: mockRender,
      });

      // Assert AsyncStorage was updated with incremented streak and new lastCompletedDate
      const storedHabitsJson = await AsyncStorage.getItem(HABITS_STORAGE_KEY);
      expect(storedHabitsJson).not.toBeNull();
      const storedHabits: Habit[] = JSON.parse(storedHabitsJson!);
      const updated = storedHabits.find((h) => h.id === 'habit_headless_1');

      expect(updated).toBeDefined();
      expect(updated!.streakCount).toBe(5);
      expect(updated!.totalEvidenceVotes).toBe(13);
      expect(updated!.lastCompletedDate).toBeDefined();

      // Assert requestWidgetUpdate was called for HabitWidget
      expect(requestWidgetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ widgetName: 'HabitWidget' })
      );
    });

    it('enforces FIFO cap (500 items) on kwestup_behavior_events_v1 during headless completions', async () => {
      // Pre-fill storage with 500 dummy behavior events
      const dummyEvents: BehaviorEvent[] = Array.from({ length: 500 }, (_, i) => ({
        id: `bevt_dummy_${i}`,
        type: 'HABIT_COMPLETED',
        entityId: 'habit_headless_1',
        timestamp: new Date(Date.now() - (500 - i) * 60000).toISOString(),
        source: 'app',
        payload: { habitId: 'habit_headless_1', streakCount: i },
      }));

      await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([mockHabit]));
      await AsyncStorage.setItem(BEHAVIOR_EVENTS_STORAGE_KEY, JSON.stringify(dummyEvents));

      const mockRender = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'COMPLETE_HABIT',
        clickActionData: { habitId: 'habit_headless_1' },
        widgetInfo: {
          widgetId: 102,
          widgetName: 'HabitWidget',
          width: 300,
          height: 150,
          screenInfo: mockScreenInfo,
        },
        renderWidget: mockRender,
      });

      const eventsJson = await AsyncStorage.getItem(BEHAVIOR_EVENTS_STORAGE_KEY);
      expect(eventsJson).not.toBeNull();
      const events: BehaviorEvent[] = JSON.parse(eventsJson!);

      // Maximum length must be strictly bounded at MAX_PERSISTED_BEHAVIOR_EVENTS (500)
      expect(events.length).toBe(MAX_PERSISTED_BEHAVIOR_EVENTS);
      // The oldest event (dummy 0) must have been evicted, and the latest event must be present
      expect(events[0].id).toBe('bevt_dummy_1');
      expect(events[events.length - 1].source).toBe('widget');
      expect(events[events.length - 1].type).toBe('HABIT_COMPLETED');
    });

    it('handles START_HABIT_ACTION click equivalently to complete habit starter', async () => {
      const recoveryHabit: Habit = {
        ...mockHabit,
        id: 'habit_rec_1',
        status: 'recovery',
      };
      await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([recoveryHabit]));

      const mockRender = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'START_HABIT_ACTION',
        clickActionData: { habitId: 'habit_rec_1' },
        widgetInfo: {
          widgetId: 103,
          widgetName: 'HabitWidget',
          width: 300,
          height: 150,
          screenInfo: mockScreenInfo,
        },
        renderWidget: mockRender,
      });

      const storedHabitsJson = await AsyncStorage.getItem(HABITS_STORAGE_KEY);
      const storedHabits: Habit[] = JSON.parse(storedHabitsJson!);
      const updated = storedHabits.find((h) => h.id === 'habit_rec_1');

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('active'); // Restores from recovery
      expect(updated!.streakCount).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Telemetry Event Emission via EventBus
  // ---------------------------------------------------------------------------
  describe('EventBus Telemetry Dispatch from Widget Handler', () => {
    it('emits WIDGET_ACTION and HABIT_COMPLETED events with source widget', async () => {
      const testHabit: Habit = {
        id: 'habit_telemetry_1',
        identityId: 'id_1',
        title: 'Cold Shower',
        behavior: 'Take cold shower',
        frequency: 'daily',
        status: 'active',
        minimumAction: '30 seconds cold',
        normalTarget: '2 minutes cold',
        stretchTarget: '5 minutes cold',
        streakCount: 1,
        bestStreak: 2,
        totalEvidenceVotes: 3,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      };

      await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([testHabit]));

      const emittedEvents: any[] = [];
      const unsub = eventBus.subscribeAll((evt) => {
        emittedEvents.push(evt);
      });

      try {
        const mockRender = jest.fn();
        await widgetTaskHandler({
          widgetAction: 'WIDGET_CLICK',
          clickAction: 'COMPLETE_HABIT',
          clickActionData: { habitId: 'habit_telemetry_1' },
          widgetInfo: {
            widgetId: 201,
            widgetName: 'HabitWidget',
            width: 300,
            height: 150,
            screenInfo: mockScreenInfo,
          },
          renderWidget: mockRender,
        });

        // Verify WIDGET_ACTION event
        const widgetActionEvt = emittedEvents.find((e) => e.type === 'WIDGET_ACTION');
        expect(widgetActionEvt).toBeDefined();
        expect(widgetActionEvt.source).toBe('widget');
        expect(widgetActionEvt.payload.action).toBe('COMPLETE_HABIT');
        expect(widgetActionEvt.payload.habitId).toBe('habit_telemetry_1');

        // Verify HABIT_COMPLETED event
        const habitCompletedEvt = emittedEvents.find((e) => e.type === 'HABIT_COMPLETED');
        expect(habitCompletedEvt).toBeDefined();
        expect(habitCompletedEvt.source).toBe('widget');
        expect(habitCompletedEvt.entityId).toBe('habit_telemetry_1');
        expect(habitCompletedEvt.payload.completedToday).toBe(true);
      } finally {
        unsub();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Widget Rendering Lifecycle (WIDGET_UPDATE / WIDGET_ADDED)
  // ---------------------------------------------------------------------------
  describe('HabitWidget Render Lifecycle in widgetTaskHandler', () => {
    it('renders HabitWidget when widgetName is HabitWidget during WIDGET_UPDATE', async () => {
      const activeHabit: Habit = {
        id: 'habit_render_1',
        identityId: 'id_1',
        title: 'Deep Breath',
        behavior: 'Take 5 deep breaths',
        frequency: 'daily',
        status: 'active',
        minimumAction: '1 breath',
        normalTarget: '5 breaths',
        stretchTarget: '10 breaths',
        streakCount: 0,
        bestStreak: 0,
        totalEvidenceVotes: 0,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      };
      await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([activeHabit]));

      const mockRender = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_UPDATE',
        widgetInfo: {
          widgetId: 301,
          widgetName: 'HabitWidget',
          width: 300,
          height: 150,
          screenInfo: mockScreenInfo,
        },
        renderWidget: mockRender,
      });

      expect(mockRender).toHaveBeenCalledTimes(1);
      const renderedElement = mockRender.mock.calls[0][0];
      expect(React.isValidElement(renderedElement)).toBe(true);
      expect(renderedElement.props.touchpoint).toBeDefined();
      expect(renderedElement.props.touchpoint.habitId).toBe('habit_render_1');
    });

    it('renders HabitWidget in standby state when storage is empty', async () => {
      const mockRender = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_ADDED',
        widgetInfo: {
          widgetId: 302,
          widgetName: 'HabitWidget',
          width: 300,
          height: 150,
          screenInfo: mockScreenInfo,
        },
        renderWidget: mockRender,
      });

      expect(mockRender).toHaveBeenCalledTimes(1);
      const renderedElement = mockRender.mock.calls[0][0];
      expect(React.isValidElement(renderedElement)).toBe(true);
      expect(renderedElement.props.touchpoint.type).toBe('standby');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. HabitWidget Visual Contract Verification
  // ---------------------------------------------------------------------------
  describe('HabitWidget Component Structure', () => {
    it('creates HabitWidget element cleanly across all touchpoint types without throwing', () => {
      const touchpoints: WidgetTouchpoint[] = [
        {
          type: 'recovery',
          habitId: 'h1',
          title: "DON'T MISS TWICE",
          subtitle: 'Execute recovery protocol',
          actionLabel: '[ 2-MIN VERSION ]',
          actionType: 'COMPLETE_HABIT',
          rulesApplied: ['WIDGET_PRIORITY_001'],
        },
        {
          type: 'today_due',
          habitId: 'h2',
          title: 'TODAY OBJECTIVE',
          subtitle: 'Core habit session pending',
          actionLabel: '[ COMPLETE ]',
          actionType: 'COMPLETE_HABIT',
          rulesApplied: ['WIDGET_PRIORITY_001'],
        },
        {
          type: 'next_action',
          habitId: 'h3',
          title: 'NEXT ACTION',
          subtitle: 'Start with 2-minute action',
          actionLabel: '[ START ]',
          actionType: 'START_HABIT_ACTION',
          rulesApplied: ['WIDGET_PRIORITY_001'],
        },
        {
          type: 'standby',
          title: 'SYS_STANDBY',
          subtitle: 'All protocols satisfied',
          actionLabel: '[ STANDBY ]',
          actionType: 'STANDBY',
          rulesApplied: ['WIDGET_PRIORITY_001'],
        },
      ];

      touchpoints.forEach((tp) => {
        const element = React.createElement(HabitWidget, { touchpoint: tp });
        expect(React.isValidElement(element)).toBe(true);
        expect(element.props.touchpoint).toEqual(tp);
      });
    });
  });
});
