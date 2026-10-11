/**
 * Requirements Covered:
 * - AI-04: Adaptive review engine & Language Generator (Weekly Review)
 *
 * Codebase Map Alignment:
 * - ARCHITECTURE.md: Pure TypeScript testable behavior engines
 * - CONCERNS.md: Mitigates LLM timeout race, 7-day rolling window timezone safety, non-punitive framing
 * - TESTING.md: Mocks aiService lifecycle cleanly with spyOn/restoreAllMocks
 */

import {
  generateWeeklyReviewHeuristic,
  generateWeeklyReviewNarrative,
  generateWeeklyReview,
} from '../../src/ai/weeklyReviewEngine';
import { Habit, BehaviorEvent, Identity } from '../../src/behavior/types';
import * as aiService from '../../src/utils/aiService';

describe('weeklyReviewEngine', () => {
  const dummyIdentity: Identity = {
    id: 'id-writer',
    statement: 'I am a prolific writer',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const dummyHabit: Habit = {
    id: 'habit-write-1',
    identityId: 'id-writer',
    title: 'Daily Journaling',
    behavior: 'Write 500 words',
    frequency: 'daily',
    status: 'active',
    minimumAction: 'Write 1 sentence',
    normalTarget: 'Write 500 words',
    streakCount: 6,
    bestStreak: 14,
    totalEvidenceVotes: 30,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateWeeklyReviewHeuristic', () => {
    it('generates an encouraging, non-punitive reflection summary with user name', () => {
      const summary = generateWeeklyReviewHeuristic(
        {
          periodStart: '2026-10-05',
          periodEnd: '2026-10-11',
          totalHabitsTracked: 1,
          overallConsistencyRate: 0.86,
          totalCompletions: 6,
          totalMisses: 1,
          recoveryAdherenceRate: 1.0,
          identityVotes: {
            'id-writer': {
              identityId: 'id-writer',
              statement: 'I am a prolific writer',
              totalVotes: 36,
              votesThisWeek: 6,
            },
          },
          topFrictionCategories: [{ category: 'effort', count: 1 }],
          suggestedAdjustments: [],
        },
        'Om'
      );

      expect(summary).toContain('Hello Om.');
      expect(summary).toContain('6 total votes for who you want to become');
      expect(summary).toContain('I am a prolific writer');
      expect(summary).toContain('86%');
      expect(summary).toContain('Never Miss Twice');
      expect(summary).toContain('effort friction');
      // Enforce zero toxic gamification / guilt-tripping
      expect(summary.toLowerCase()).not.toContain('failed');
      expect(summary.toLowerCase()).not.toContain('lost your streak');
      expect(summary.toLowerCase()).not.toContain('shame');
    });

    it('celebrates perfect consistency when there are 0 misses', () => {
      const summary = generateWeeklyReviewHeuristic({
        periodStart: '2026-10-05',
        periodEnd: '2026-10-11',
        totalHabitsTracked: 1,
        overallConsistencyRate: 1.0,
        totalCompletions: 7,
        totalMisses: 0,
        recoveryAdherenceRate: 1.0,
        identityVotes: {},
        topFrictionCategories: [],
        suggestedAdjustments: [],
      });

      expect(summary).toContain('100%');
      expect(summary).toContain('zero missed scheduled sessions');
      expect(summary).toContain('operating smoothly');
    });

    it('reminds user of system adaptation principles when adjustments are suggested', () => {
      const summary = generateWeeklyReviewHeuristic({
        periodStart: '2026-10-05',
        periodEnd: '2026-10-11',
        totalHabitsTracked: 1,
        overallConsistencyRate: 0.40,
        totalCompletions: 2,
        totalMisses: 3,
        recoveryAdherenceRate: 0.5,
        identityVotes: {},
        topFrictionCategories: [{ category: 'time', count: 2 }],
        suggestedAdjustments: [
          {
            action: 'ADJUST_DIFFICULTY',
            habitId: dummyHabit.id,
            payload: {},
            description: 'Downscale to 2-minute action',
            ruleId: 'MINIMUM_ACTION_001',
          },
        ],
      });

      expect(summary).toContain('fall to the level of your systems');
      expect(summary).toContain('suggested system adaptations');
    });
  });

  describe('generateWeeklyReviewNarrative (LLM + Fallback)', () => {
    const baseReportData = {
      periodStart: '2026-10-05',
      periodEnd: '2026-10-11',
      totalHabitsTracked: 1,
      overallConsistencyRate: 0.86,
      totalCompletions: 6,
      totalMisses: 1,
      recoveryAdherenceRate: 1.0,
      identityVotes: {},
      topFrictionCategories: [{ category: 'effort' as const, count: 1 }],
      suggestedAdjustments: [],
    };

    it('short-circuits to heuristic when forceHeuristic is true', async () => {
      const spyLoad = jest.spyOn(aiService, 'loadModel');
      const res = await generateWeeklyReviewNarrative(baseReportData, { forceHeuristic: true });
      expect(res.source).toBe('heuristic');
      expect(res.narrative).toContain('consistency');
      expect(spyLoad).not.toHaveBeenCalled();
    });

    it('short-circuits to heuristic when model is not downloaded', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(false);
      const spyLoad = jest.spyOn(aiService, 'loadModel');
      const res = await generateWeeklyReviewNarrative(baseReportData);
      expect(res.source).toBe('heuristic');
      expect(spyLoad).not.toHaveBeenCalled();
    });

    it('returns LLM-generated reflection when inference succeeds', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(() => {});
      const mockCompletion = jest.fn().mockResolvedValue({
        text: 'This week was a strong display of identity-based momentum. You maintained high consistency and recovered smoothly when physical fatigue arose.',
      });
      jest.spyOn(aiService, 'loadModel').mockResolvedValue({
        completion: mockCompletion,
      } as any);

      const res = await generateWeeklyReviewNarrative(baseReportData);
      expect(res.source).toBe('llm');
      expect(res.narrative).toContain('identity-based momentum');
      expect(mockCompletion).toHaveBeenCalled();
    });

    it('falls back to heuristic when LLM times out', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(() => {});
      const mockHanging = jest.fn().mockImplementation(() => new Promise(() => {}));
      jest.spyOn(aiService, 'loadModel').mockResolvedValue({
        completion: mockHanging,
      } as any);

      const res = await generateWeeklyReviewNarrative(baseReportData, { timeoutMs: 25 });
      expect(res.source).toBe('heuristic');
      expect(res.narrative).toBeDefined();
    });

    it('falls back to heuristic when LLM returns empty text', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(() => {});
      jest.spyOn(aiService, 'loadModel').mockResolvedValue({
        completion: jest.fn().mockResolvedValue({ text: '  ' }),
      } as any);

      const res = await generateWeeklyReviewNarrative(baseReportData);
      expect(res.source).toBe('heuristic');
      expect(res.narrative).toBeDefined();
    });
  });

  describe('generateWeeklyReview (Full Report Aggregation)', () => {
    it('aggregates 7-day behavior telemetry, identity votes, and recovery adherence', async () => {
      const today = '2026-10-11';

      // 5 completions and 1 miss with effort friction
      const sampleEvents: BehaviorEvent[] = [
        {
          id: 'evt-1',
          type: 'HABIT_COMPLETED',
          entityId: dummyHabit.id,
          timestamp: '2026-10-06T09:00:00.000Z',
          source: 'app',
        },
        {
          id: 'evt-2',
          type: 'HABIT_COMPLETED',
          entityId: dummyHabit.id,
          timestamp: '2026-10-07T09:00:00.000Z',
          source: 'app',
        },
        {
          id: 'evt-3',
          type: 'HABIT_MISSED',
          entityId: dummyHabit.id,
          timestamp: '2026-10-08T09:00:00.000Z',
          source: 'system',
          payload: { frictionCategory: 'effort' },
        },
        {
          id: 'evt-4',
          type: 'HABIT_COMPLETED',
          entityId: dummyHabit.id,
          timestamp: '2026-10-09T09:00:00.000Z',
          source: 'app',
          payload: { status: 'recovery' },
        },
        {
          id: 'evt-5',
          type: 'HABIT_COMPLETED',
          entityId: dummyHabit.id,
          timestamp: '2026-10-10T09:00:00.000Z',
          source: 'app',
        },
        {
          id: 'evt-6',
          type: 'HABIT_COMPLETED',
          entityId: dummyHabit.id,
          timestamp: '2026-10-11T09:00:00.000Z',
          source: 'app',
        },
      ];

      const report = await generateWeeklyReview(
        [dummyHabit],
        sampleEvents,
        [dummyIdentity],
        { todayDate: today, forceHeuristic: true }
      );

      expect(report.periodEnd).toBe(today);
      expect(report.totalHabitsTracked).toBe(1);
      expect(report.totalCompletions).toBe(5);
      expect(report.totalMisses).toBe(1);
      expect(report.overallConsistencyRate).toBeGreaterThan(0.5);
      expect(report.recoveryAdherenceRate).toBe(1.0); // Never missed twice, recovered immediately

      // Identity votes verification
      expect(report.identityVotes['id-writer']).toBeDefined();
      expect(report.identityVotes['id-writer'].votesThisWeek).toBe(5);
      expect(report.identityVotes['id-writer'].totalVotes).toBe(30);

      // Top friction verification
      expect(report.topFrictionCategories).toEqual([{ category: 'effort', count: 1 }]);

      // Rules applied audit trail
      expect(report.rulesApplied).toContain('REVIEW_WEEKLY_001');
      expect(report.rulesApplied).toContain('RECOVERY_001');
      expect(report.source).toBe('heuristic');
    });

    it('proposes system adjustments when habit struggles (<60% consistency or multiple misses)', async () => {
      const today = '2026-10-11';
      const strugglingHabit: Habit = {
        ...dummyHabit,
        id: 'habit-struggle',
        status: 'recovery',
        minimumAction: 'Write 1 sentence',
      };

      const strugglingEvents: BehaviorEvent[] = [
        {
          id: 'evt-m1',
          type: 'HABIT_MISSED',
          entityId: strugglingHabit.id,
          timestamp: '2026-10-08T09:00:00.000Z',
          source: 'system',
          payload: { frictionCategory: 'time' },
        },
        {
          id: 'evt-m2',
          type: 'HABIT_MISSED',
          entityId: strugglingHabit.id,
          timestamp: '2026-10-09T09:00:00.000Z',
          source: 'system',
          payload: { frictionCategory: 'time' },
        },
      ];

      const report = await generateWeeklyReview(
        [strugglingHabit],
        strugglingEvents,
        [dummyIdentity],
        { todayDate: today, forceHeuristic: true }
      );

      expect(report.suggestedAdjustments.length).toBeGreaterThan(0);
      const adjustment = report.suggestedAdjustments[0];
      expect(adjustment.habitId).toBe(strugglingHabit.id);
      expect(adjustment.ruleId).toBeDefined();
    });

    it('handles empty events and habits gracefully without crashing', async () => {
      const report = await generateWeeklyReview([], [], [], {
        todayDate: '2026-10-11',
        forceHeuristic: true,
      });

      expect(report.totalHabitsTracked).toBe(0);
      expect(report.totalCompletions).toBe(0);
      expect(report.totalMisses).toBe(0);
      expect(report.overallConsistencyRate).toBe(0);
      expect(report.recoveryAdherenceRate).toBe(1.0);
      expect(report.suggestedAdjustments).toEqual([]);
      expect(report.narrativeSummary).toBeDefined();
    });
  });
});
