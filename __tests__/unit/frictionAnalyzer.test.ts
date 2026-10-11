/**
 * Requirements Covered:
 * - AI-04: Semantic friction diagnosis (Behavior Analyst) & deterministic intervention mapping
 *
 * Codebase Map Alignment:
 * - ARCHITECTURE.md: Pure TypeScript testable behavior engines
 * - CONCERNS.md: Mitigates LLM timeout race, malformed JSON, and metacharacter regex crashes
 * - TESTING.md: Mocks aiService lifecycle cleanly with spyOn/restoreAllMocks
 */

import {
  diagnoseFrictionHeuristic,
  diagnoseFriction,
  mapFrictionToIntervention,
  VALID_FRICTION_CATEGORIES,
} from '../../src/ai/frictionAnalyzer';
import { Habit } from '../../src/behavior/types';
import * as aiService from '../../src/utils/aiService';

describe('frictionAnalyzer', () => {
  const dummyHabit: Habit = {
    id: 'habit-read-1',
    identityId: 'id-reader',
    title: 'Daily Reading',
    behavior: 'Read 20 pages',
    frequency: 'daily',
    status: 'active',
    minimumAction: 'Read 1 paragraph',
    normalTarget: 'Read 20 pages',
    streakCount: 5,
    bestStreak: 12,
    totalEvidenceVotes: 42,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('diagnoseFrictionHeuristic', () => {
    it('classifies effort friction when exhausted or tired', () => {
      const res = diagnoseFrictionHeuristic('I was completely exhausted after work');
      expect(res.category).toBe('effort');
      expect(res.source).toBe('heuristic');
      expect(res.confidence).toBe(0.85);
      expect(res.rulesApplied).toContain('FRICTION_DIAGNOSIS_001');
    });

    it('classifies time friction when busy or running late', () => {
      const res = diagnoseFrictionHeuristic('Too busy with meetings and ran out of time');
      expect(res.category).toBe('time');
      expect(res.source).toBe('heuristic');
      expect(res.confidence).toBe(0.85);
    });

    it('classifies setup friction when gear or tools were missing', () => {
      const res = diagnoseFrictionHeuristic("Couldn't find my reading glasses and desk was messy clutter");
      expect(res.category).toBe('setup');
      expect(res.confidence).toBe(0.85);
    });

    it('classifies emotional friction when feeling anxious, dreading, or avoiding', () => {
      const res = diagnoseFrictionHeuristic('Was dreading opening the book and procrastinating from anxiety');
      expect(res.category).toBe('emotional');
      expect(res.confidence).toBe(0.85);
    });

    it('classifies mental friction when confused, stuck, or ambiguous', () => {
      const res = diagnoseFrictionHeuristic("Felt stuck and didn't know where to start, too complicated");
      expect(res.category).toBe('mental');
      expect(res.confidence).toBe(0.85);
    });

    it('classifies location friction when traveling or away from home', () => {
      const res = diagnoseFrictionHeuristic('Traveling on vacation and staying in a hotel');
      expect(res.category).toBe('location');
      expect(res.confidence).toBe(0.85);
    });

    it('defaults to effort friction with lower confidence for unknown text', () => {
      const res = diagnoseFrictionHeuristic('just random words');
      expect(res.category).toBe('effort');
      expect(res.confidence).toBe(0.60);
    });

    it('attaches suggested intervention when habit is provided', () => {
      const res = diagnoseFrictionHeuristic('too exhausted to read', dummyHabit);
      expect(res.suggestedIntervention).toBeDefined();
      expect(res.suggestedIntervention?.action).toBe('ADJUST_DIFFICULTY');
      expect(res.suggestedIntervention?.ruleId).toBe('MINIMUM_ACTION_001');
    });
  });

  describe('mapFrictionToIntervention', () => {
    it('maps effort to ADJUST_DIFFICULTY downscale', () => {
      const intervention = mapFrictionToIntervention(dummyHabit, 'effort');
      expect(intervention.action).toBe('ADJUST_DIFFICULTY');
      expect(intervention.ruleId).toBe('MINIMUM_ACTION_001');
      expect(intervention.payload).toEqual({
        habitId: dummyHabit.id,
        direction: 'easier',
        newMinimumAction: dummyHabit.minimumAction,
      });
    });

    it('maps time to UPDATE_HABIT target reduction', () => {
      const intervention = mapFrictionToIntervention(dummyHabit, 'time');
      expect(intervention.action).toBe('UPDATE_HABIT');
      expect(intervention.ruleId).toBe('CUE_STACK_001');
      expect(intervention.payload.updates).toHaveProperty('normalTarget');
    });

    it('maps setup to UPDATE_HABIT environmental priming routine', () => {
      const intervention = mapFrictionToIntervention(dummyHabit, 'setup');
      expect(intervention.action).toBe('UPDATE_HABIT');
      expect(intervention.ruleId).toBe('CUE_STACK_002');
      expect(intervention.description).toContain('environmental priming');
    });

    it('maps emotional to ADJUST_DIFFICULTY micro step', () => {
      const intervention = mapFrictionToIntervention(dummyHabit, 'emotional');
      expect(intervention.action).toBe('ADJUST_DIFFICULTY');
      expect(intervention.ruleId).toBe('HABIT_IDENTITY_ANCHOR_001');
    });

    it('maps mental to UPDATE_HABIT first step clarification', () => {
      const intervention = mapFrictionToIntervention(dummyHabit, 'mental');
      expect(intervention.action).toBe('UPDATE_HABIT');
      expect(intervention.ruleId).toBe('MINIMUM_ACTION_001');
    });

    it('maps location to UPDATE_HABIT travel variant', () => {
      const intervention = mapFrictionToIntervention(dummyHabit, 'location');
      expect(intervention.action).toBe('UPDATE_HABIT');
      expect(intervention.ruleId).toBe('CUE_STACK_001');
    });

    it('prioritizes consecutive misses >= 2 with RECOVERY_CONSECUTIVE_MISS_002', () => {
      const intervention = mapFrictionToIntervention(dummyHabit, 'effort', { consecutiveMisses: 2 });
      expect(intervention.action).toBe('ADJUST_DIFFICULTY');
      expect(intervention.ruleId).toBe('RECOVERY_CONSECUTIVE_MISS_002');
    });
  });

  describe('diagnoseFriction (LLM + Fallback)', () => {
    it('short-circuits to heuristic when forceHeuristic is true', async () => {
      const spyLoad = jest.spyOn(aiService, 'loadModel');
      const res = await diagnoseFriction('I was too tired to work out', { forceHeuristic: true });
      expect(res.source).toBe('heuristic');
      expect(res.category).toBe('effort');
      expect(spyLoad).not.toHaveBeenCalled();
    });

    it('short-circuits to heuristic when model is not downloaded', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(false);
      const spyLoad = jest.spyOn(aiService, 'loadModel');
      const res = await diagnoseFriction('too busy all day');
      expect(res.source).toBe('heuristic');
      expect(res.category).toBe('time');
      expect(spyLoad).not.toHaveBeenCalled();
    });

    it('parses LLM JSON output when inference succeeds', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(() => {});
      const mockCompletion = jest.fn().mockResolvedValue({
        text: '{"category": "mental", "reason": "User was overwhelmed by project complexity"}',
      });
      jest.spyOn(aiService, 'loadModel').mockResolvedValue({
        completion: mockCompletion,
      } as any);

      const res = await diagnoseFriction('Code was too complicated and I got confused', { habit: dummyHabit });
      expect(res.source).toBe('llm');
      expect(res.category).toBe('mental');
      expect(res.confidence).toBe(0.95);
      expect(res.suggestedIntervention).toBeDefined();
      expect(res.suggestedIntervention?.ruleId).toBe('MINIMUM_ACTION_001');
    });

    it('falls back to heuristic when LLM times out', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(() => {});
      const mockHangingCompletion = jest.fn().mockImplementation(() => new Promise(() => {}));
      jest.spyOn(aiService, 'loadModel').mockResolvedValue({
        completion: mockHangingCompletion,
      } as any);

      const res = await diagnoseFriction('Exhausted and could not move', { timeoutMs: 20 });
      expect(res.source).toBe('heuristic');
      expect(res.category).toBe('effort');
    });

    it('falls back to heuristic when LLM returns malformed JSON', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(() => {});
      jest.spyOn(aiService, 'loadModel').mockResolvedValue({
        completion: jest.fn().mockResolvedValue({ text: 'Sorry I cannot output JSON' }),
      } as any);

      const res = await diagnoseFriction('Traveling out of town');
      expect(res.source).toBe('heuristic');
      expect(res.category).toBe('location');
    });

    it('falls back to heuristic when LLM returns invalid category', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(() => {});
      jest.spyOn(aiService, 'loadModel').mockResolvedValue({
        completion: jest.fn().mockResolvedValue({ text: '{"category": "super_lazy"}' }),
      } as any);

      const res = await diagnoseFriction('Could not find my tools');
      expect(res.source).toBe('heuristic');
      expect(res.category).toBe('setup');
    });

    it('clamps input longer than 500 characters', async () => {
      jest.spyOn(aiService, 'isModelDownloaded').mockResolvedValue(true);
      jest.spyOn(aiService, 'resetIdleTimer').mockImplementation(() => {});
      const mockCompletion = jest.fn().mockResolvedValue({
        text: '{"category": "time", "reason": "Busy"}',
      });
      jest.spyOn(aiService, 'loadModel').mockResolvedValue({
        completion: mockCompletion,
      } as any);

      const longInput = 'too busy '.repeat(300); // 2700 chars
      await diagnoseFriction(longInput);
      expect(mockCompletion).toHaveBeenCalled();
      const promptArg = mockCompletion.mock.calls[0][0].prompt;
      expect(promptArg).toContain(longInput.slice(0, 500));
      expect(promptArg).not.toContain(longInput);
    });
  });

  describe('VALID_FRICTION_CATEGORIES', () => {
    it('contains all 6 Atomic Habits categories', () => {
      expect(VALID_FRICTION_CATEGORIES).toEqual([
        'effort',
        'time',
        'setup',
        'emotional',
        'mental',
        'location',
      ]);
    });
  });
});
