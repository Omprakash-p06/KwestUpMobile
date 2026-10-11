/**
 * Unit & Integration Test Suite: Deterministic Behavior Compiler
 *
 * Requirements Covered: [AI-03]
 * Codebase Alignment: ARCHITECTURE.md, STRUCTURE.md, TESTING.md
 */

import {
  compileIntentToHabitPlan,
  compileIntentToCommand,
  compileAndExecuteIntent,
  deriveIdentityStatement,
} from '../../src/ai/behaviorCompiler';
import { parseIntentHeuristic } from '../../src/ai/heuristicParser';
import { ExtractedIntent } from '../../src/ai/types';
import { Habit } from '../../src/behavior/types';
import {
  registerCommandHandler,
  clearCommandHandlers,
  clearIdempotencyCache,
} from '../../src/commands/commandExecutor';
import { DispatchedCommand } from '../../src/commands/types';
import { eventBus } from '../../src/behavior/eventBus';

describe('behaviorCompiler', () => {
  let activeHabitsFixture: Habit[] = [];

  beforeEach(() => {
    clearCommandHandlers();
    clearIdempotencyCache();
    eventBus.clearListeners();
    eventBus.clearBuffer();

    activeHabitsFixture = [
      {
        id: 'habit-1',
        identityId: 'id-1',
        title: 'Morning Yoga',
        behavior: 'Do 15 minutes of yoga',
        minimumAction: 'Do 1 downward dog',
        normalTarget: '15 minutes of yoga',
        frequency: 'daily',
        status: 'active',
        streakCount: 5,
        bestStreak: 10,
        totalEvidenceVotes: 12,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ];
  });

  describe('Identity Derivation (deriveIdentityStatement)', () => {
    it('derives identity statements from recognizable archetypes', () => {
      expect(deriveIdentityStatement('read 20 pages')).toContain('reader');
      expect(deriveIdentityStatement('go running in park')).toContain('runner');
      expect(deriveIdentityStatement('study DSA on laptop')).toContain('continuous learner');
      expect(deriveIdentityStatement('study Spanish daily')).toContain('lifelong learner');
      expect(deriveIdentityStatement('meditate every morning')).toContain('mindful practitioner');
      expect(deriveIdentityStatement('do 50 pushups')).toContain('athlete');
      expect(deriveIdentityStatement('write daily journal')).toContain('writer');
      expect(deriveIdentityStatement('drink 2L water')).toContain('hydration');
    });

    it('falls back to general identity statement for custom behaviors', () => {
      const custom = deriveIdentityStatement('play chess puzzles');
      expect(custom).toBe('I am someone who consistently practices play chess puzzles');
    });
  });

  describe('Habit Plan Compilation (compileIntentToHabitPlan)', () => {
    it('compiles a complete Atomic Habits plan from extracted create intent', () => {
      const intent: ExtractedIntent = {
        action: 'CREATE_HABIT',
        behavior: 'Study DSA',
        frequency: 'daily',
        cueType: 'after-habit',
        anchor: 'dinner',
        time: '20:00',
        confidence: 0.9,
        source: 'heuristic',
      };

      const result = compileIntentToHabitPlan(intent, activeHabitsFixture);

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();

      const plan = result.plan!;
      expect(plan.identity.statement).toContain('continuous learner');
      expect(plan.behavior.target).toBe('Study DSA');
      expect(plan.behavior.minimum).toMatch(/2-minute version/i);
      expect(plan.cue.type).toBe('after-habit');
      expect(plan.cue.time).toBe('20:00');
      expect(plan.recovery.enabled).toBe(true);
      expect(plan.recovery.minimum_after_miss).toBe(true);
      expect(plan.reward.type).toBe('factual_milestone');
      expect(result.rulesApplied).toContain('HABIT_IDENTITY_ANCHOR_001');
      expect(result.rulesApplied).toContain('MINIMUM_ACTION_001');
    });

    it('rejects compilation when user already has 3 active habits (HABIT_CONCURRENT_CAP_001)', () => {
      const threeHabits: Habit[] = [
        ...activeHabitsFixture,
        {
          ...activeHabitsFixture[0],
          id: 'habit-2',
          title: 'Daily Reading',
        },
        {
          ...activeHabitsFixture[0],
          id: 'habit-3',
          title: 'Evening Walk',
        },
      ];

      const intent: ExtractedIntent = {
        action: 'CREATE_HABIT',
        behavior: 'Study Spanish',
        frequency: 'daily',
        confidence: 0.9,
        source: 'heuristic',
      };

      const result = compileIntentToHabitPlan(intent, threeHabits);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toMatch(/concurrent habits/i);
      expect(result.rulesApplied).toContain('HABIT_CONCURRENT_CAP_001');
    });

    it('rejects non-creation action', () => {
      const intent: ExtractedIntent = {
        action: 'DELETE_HABIT',
        behavior: 'Morning Yoga',
        confidence: 0.9,
        source: 'heuristic',
      };

      const result = compileIntentToHabitPlan(intent, activeHabitsFixture);
      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toMatch(/non-creation action/i);
    });
  });

  describe('Command Proposal Compilation (compileIntentToCommand)', () => {
    it('compiles CREATE_HABIT intent into valid DispatchedCommand proposal', () => {
      const intent: ExtractedIntent = {
        action: 'CREATE_HABIT',
        behavior: 'Evening Reading',
        frequency: 'daily',
        time: '21:00',
        confidence: 0.9,
        source: 'heuristic',
      };

      const result = compileIntentToCommand(intent, activeHabitsFixture);

      expect(result.success).toBe(true);
      expect(result.command).toBeDefined();
      expect(result.command?.action).toBe('CREATE_HABIT');
      expect(result.command?.actor).toBe('ai');
      const cmd = result.command as DispatchedCommand<'CREATE_HABIT'>;
      expect(cmd.payload.title).toBe('Evening Reading');
      expect(cmd.payload.minimumAction).toBeDefined();
      expect(cmd.payload.cueTime).toBe('21:00');
    });

    it('compiles LOG_HABIT intent resolving habitId from active habits', () => {
      const intent: ExtractedIntent = {
        action: 'LOG_HABIT',
        behavior: 'Morning Yoga',
        confidence: 0.9,
        source: 'heuristic',
      };

      const result = compileIntentToCommand(intent, activeHabitsFixture);

      expect(result.success).toBe(true);
      expect(result.command?.action).toBe('LOG_HABIT');
      const cmd = result.command as DispatchedCommand<'LOG_HABIT'>;
      expect(cmd.payload.habitId).toBe('habit-1');
      expect(cmd.payload.completedAt).toBeDefined();
    });

    it('compiles PAUSE_HABIT intent with reason', () => {
      const intent: ExtractedIntent = {
        action: 'PAUSE_HABIT',
        behavior: 'Morning Yoga',
        reason: 'Back pain',
        confidence: 0.9,
        source: 'heuristic',
      };

      const result = compileIntentToCommand(intent, activeHabitsFixture);

      expect(result.success).toBe(true);
      expect(result.command?.action).toBe('PAUSE_HABIT');
      const cmd = result.command as DispatchedCommand<'PAUSE_HABIT'>;
      expect(cmd.payload.habitId).toBe('habit-1');
      expect(cmd.payload.reason).toBe('Back pain');
    });

    it('flags destructive actions (DELETE_HABIT, ARCHIVE_HABIT) with requiresConfirmation: true', () => {
      const deleteIntent: ExtractedIntent = {
        action: 'DELETE_HABIT',
        behavior: 'Morning Yoga',
        confidence: 0.9,
        source: 'heuristic',
      };
      const delResult = compileIntentToCommand(deleteIntent, activeHabitsFixture);
      expect(delResult.success).toBe(true);
      expect(delResult.requiresConfirmation).toBe(true);

      const archiveIntent: ExtractedIntent = {
        action: 'ARCHIVE_HABIT',
        behavior: 'Morning Yoga',
        confidence: 0.9,
        source: 'heuristic',
      };
      const archResult = compileIntentToCommand(archiveIntent, activeHabitsFixture);
      expect(archResult.success).toBe(true);
      expect(archResult.requiresConfirmation).toBe(true);
    });

    it('compiles UPDATE_HABIT intent with minimumAction and target updates', () => {
      const intent: ExtractedIntent = {
        action: 'UPDATE_HABIT',
        behavior: 'Morning Yoga',
        minimumAction: 'Do 2 downward dogs',
        target: '20 minutes of yoga',
        confidence: 0.9,
        source: 'heuristic',
      };

      const result = compileIntentToCommand(intent, activeHabitsFixture);

      expect(result.success).toBe(true);
      expect(result.command?.action).toBe('UPDATE_HABIT');
      const cmd = result.command as DispatchedCommand<'UPDATE_HABIT'>;
      expect(cmd.payload.habitId).toBe('habit-1');
      expect(cmd.payload.updates.minimumAction).toBe('Do 2 downward dogs');
      expect(cmd.payload.updates.normalTarget).toBe('20 minutes of yoga');
    });

    it('returns a clean error when active habits exist but none match the requested behavior', () => {
      const intent: ExtractedIntent = {
        action: 'LOG_HABIT',
        behavior: 'Underwater Basket Weaving',
        confidence: 0.9,
        source: 'heuristic',
      };

      const result = compileIntentToCommand(intent, activeHabitsFixture);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toMatch(/No active habit found matching "Underwater Basket Weaving"/);
      expect(result.errors?.[0]).toMatch(/Morning Yoga/);
    });
  });

  describe('End-to-End Execution Bridge (compileAndExecuteIntent)', () => {
    it('compiles and executes CREATE_HABIT intent through Command Gateway and emits event', async () => {
      const executedEvents: any[] = [];
      const unsub = eventBus.subscribe('COMMAND_EXECUTED', (e) => {
        executedEvents.push(e);
      });

      const mockCreateHandler = jest.fn().mockImplementation((payload) => ({
        entityId: 'habit-new-123',
        message: `Habit "${payload.title}" created`,
      }));
      registerCommandHandler('CREATE_HABIT', mockCreateHandler);

      const intent: ExtractedIntent = {
        action: 'CREATE_HABIT',
        behavior: 'Cold Shower',
        frequency: 'daily',
        time: '07:00',
        confidence: 0.95,
        source: 'llm',
      };

      const result = await compileAndExecuteIntent(intent, { activeHabits: activeHabitsFixture });

      expect(result.success).toBe(true);
      expect(result.entityId).toBe('habit-new-123');
      expect(mockCreateHandler).toHaveBeenCalledTimes(1);
      expect(executedEvents).toHaveLength(1);
      expect(executedEvents[0].payload.action).toBe('CREATE_HABIT');

      unsub();
    });

    it('blocks unconfirmed destructive intent execution and returns SYS_AI_CONFIRMATION_GATE_001', async () => {
      const mockDeleteHandler = jest.fn();
      registerCommandHandler('DELETE_HABIT', mockDeleteHandler);

      const intent: ExtractedIntent = {
        action: 'DELETE_HABIT',
        behavior: 'Morning Yoga',
        confidence: 0.9,
        source: 'heuristic',
      };

      // Dispatched without options.confirmed === true
      const result = await compileAndExecuteIntent(intent, { activeHabits: activeHabitsFixture });

      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.rulesApplied).toContain('SYS_AI_CONFIRMATION_GATE_001');
      expect(mockDeleteHandler).not.toHaveBeenCalled();

      // Dispatched with explicit confirmation
      mockDeleteHandler.mockReturnValue({ entityId: 'habit-1', message: 'Deleted' });
      const confirmedResult = await compileAndExecuteIntent(intent, {
        activeHabits: activeHabitsFixture,
        confirmed: true,
      });

      expect(confirmedResult.success).toBe(true);
      expect(mockDeleteHandler).toHaveBeenCalledTimes(1);
    });

    it('executes full pipeline from natural language text to gateway execution', async () => {
      const mockCreateHandler = jest.fn().mockImplementation((payload) => ({
        entityId: 'habit-dsa-1',
        message: `Habit "${payload.title}" created`,
      }));
      registerCommandHandler('CREATE_HABIT', mockCreateHandler);

      const utterance = 'I want to study DSA every evening after dinner';
      const extracted = parseIntentHeuristic(utterance);
      const executionResult = await compileAndExecuteIntent(extracted, { activeHabits: activeHabitsFixture });

      expect(executionResult.success).toBe(true);
      expect(mockCreateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/study dsa/i),
          cueType: 'after-habit',
          cueTime: '20:00',
        }),
        expect.anything()
      );
    });
  });
});
