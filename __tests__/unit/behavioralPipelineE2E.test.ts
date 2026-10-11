/**
 * Behavioral Pipeline End-to-End Integration Test Suite
 * =====================================================
 * Verifies the complete unbroken behavioral lifecycle across Milestone 3:
 *
 * 1. Natural Language Intent -> Behavior Compiler -> AI Sandbox -> Command Gateway -> Habit Operations
 * 2. Telemetry Emission -> Miss Event -> Recovery Transition -> Widget Touchpoint Arbitration
 * 3. User Reflection Note -> Semantic Friction Diagnosis -> Intervention Mapping -> Adaptive Scaling
 * 4. 7-Day Rolling Aggregation -> Identity Evidence Voting -> Never-Miss-Twice Adherence -> Language Generator
 * 5. Adversarial & Destructive AI Command Confirmation Gates (DELETE_HABIT, ARCHIVE_HABIT)
 * 6. Full Sequential End-to-End Lifecycle execution
 *
 * Requirements Covered: [AI-04], [AI-03], [CMD-01], [INTV-01], [WIDG-03]
 * Codebase Alignment: ARCHITECTURE.md, STRUCTURE.md, CONCERNS.md:54, TESTING.md
 */

import { parseUserIntent } from '../../src/ai/intentParser';
import { compileIntentToCommand, deriveIdentityStatement } from '../../src/ai/behaviorCompiler';
import { executeAiCommand } from '../../src/commands/aiSandbox';
import {
  executeCommand,
  clearCommandHandlers,
  clearIdempotencyCache,
} from '../../src/commands/commandExecutor';
import {
  registerDefaultHabitHandlers,
  resetDefaultHabitHandlerRefCount,
  HabitOperations,
} from '../../src/commands/habitCommandHandlers';
import { eventBus } from '../../src/behavior/eventBus';
import { evaluateRecoveryTransition } from '../../src/behavior/recoveryEngine';
import { selectWidgetTouchpoint } from '../../src/behavior/interventionEngine';
import { diagnoseFriction, mapFrictionToIntervention } from '../../src/ai/frictionAnalyzer';
import { generateWeeklyReview } from '../../src/ai/weeklyReviewEngine';
import type { Habit, Identity, BehaviorEvent, DomainEvent } from '../../src/behavior/types';

describe('Behavioral Pipeline E2E', () => {
  let inMemoryHabits: Habit[] = [];
  let inMemoryIdentities: Identity[] = [];
  let inMemoryEvents: BehaviorEvent[] = [];
  let executedEvents: DomainEvent[] = [];
  let habitOperations: HabitOperations;
  let unregisterHandlers: () => void;

  beforeEach(() => {
    resetDefaultHabitHandlerRefCount();
    clearCommandHandlers();
    clearIdempotencyCache();
    eventBus.clearListeners();
    eventBus.clearBuffer();

    inMemoryHabits = [];
    inMemoryIdentities = [];
    inMemoryEvents = [];
    executedEvents = [];

    // Track COMMAND_EXECUTED emissions on eventBus
    eventBus.subscribe('COMMAND_EXECUTED', (event) => {
      executedEvents.push(event);
    });

    habitOperations = {
      habits: inMemoryHabits,
      createHabit: jest.fn().mockImplementation(async (input) => {
        const newHabit: Habit = {
          id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          identityId: input.identityId || 'id-default',
          title: input.title,
          behavior: input.behavior,
          minimumAction: input.minimumAction || '2-minute starter',
          normalTarget: input.normalTarget || input.behavior,
          frequency: input.frequency || 'daily',
          status: 'active',
          streakCount: 0,
          bestStreak: 0,
          totalEvidenceVotes: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        inMemoryHabits.push(newHabit);
        return { habit: newHabit, rulesApplied: ['HABIT_CONCURRENT_CAP_001'] };
      }),
      updateHabit: jest.fn().mockImplementation(async (id, patch) => {
        const index = inMemoryHabits.findIndex((h) => h.id === id);
        if (index >= 0) {
          inMemoryHabits[index] = {
            ...inMemoryHabits[index],
            ...patch,
            updatedAt: new Date().toISOString(),
          };
          return inMemoryHabits[index];
        }
        return null;
      }),
      deleteHabit: jest.fn().mockImplementation(async (id) => {
        const index = inMemoryHabits.findIndex((h) => h.id === id);
        if (index >= 0) {
          inMemoryHabits.splice(index, 1);
        }
      }),
      completeHabit: jest.fn().mockImplementation(async (id, _opts) => {
        const habit = inMemoryHabits.find((h) => h.id === id);
        if (habit) {
          habit.streakCount += 1;
          habit.bestStreak = Math.max(habit.bestStreak || 0, habit.streakCount);
          habit.totalEvidenceVotes = (habit.totalEvidenceVotes || 0) + 1;
          habit.status = 'active';
        }
        return { updatedHabit: habit, rulesApplied: ['HABIT_EVIDENCE_VOTE_001'] };
      }),
      missHabit: jest.fn().mockImplementation(async (id, _opts) => {
        const habit = inMemoryHabits.find((h) => h.id === id);
        if (habit) {
          habit.status = 'recovery';
          habit.streakCount = 0;
        }
        return { updatedHabit: habit, rulesApplied: ['RECOVERY_001'] };
      }),
      createIdentity: jest.fn().mockImplementation(async (statement) => {
        const newIdentity: Identity = {
          id: `identity-${Date.now()}`,
          statement,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        inMemoryIdentities.push(newIdentity);
        return newIdentity;
      }),
    };

    unregisterHandlers = registerDefaultHabitHandlers(habitOperations);
  });

  afterEach(() => {
    if (unregisterHandlers) {
      unregisterHandlers();
    }
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Natural Language Creation to Gateway Execution
  // ---------------------------------------------------------------------------
  describe('Natural Language Creation to Gateway Execution', () => {
    it('executes unbroken chain: natural language -> heuristic parser -> compiler -> sandbox -> gateway -> state mutation', async () => {
      const userInput = 'Read 10 pages of philosophy every morning at 07:00';

      // 1. Natural language intent parsing
      const intent = await parseUserIntent(userInput, { forceHeuristic: true });
      expect(intent.action).toBe('CREATE_HABIT');
      expect(intent.behavior.toLowerCase()).toContain('read');
      expect(intent.time).toBe('07:00');
      expect(intent.frequency).toBe('daily');
      expect(intent.confidence).toBeGreaterThan(0.7);

      // 2. Deterministic Behavior Compiler
      const compiled = compileIntentToCommand(intent, inMemoryHabits);
      expect(compiled.success).toBe(true);
      expect(compiled.command).toBeDefined();
      expect(compiled.plan).toBeDefined();
      expect(compiled.plan?.identity.statement).toContain('reader');
      expect(compiled.plan?.behavior.minimum).toBeDefined();
      expect(compiled.rulesApplied).toContain('HABIT_IDENTITY_ANCHOR_001');

      // 3. Sandboxed execution through AI execution layer
      const executionResult = await executeAiCommand(compiled.command!);
      expect(executionResult.success).toBe(true);

      // 4. Verify domain state mutation and telemetry
      expect(inMemoryHabits.length).toBe(1);
      const createdHabit = inMemoryHabits[0];
      expect(createdHabit.title).toBe(intent.behavior);
      expect(createdHabit.minimumAction).toBe(compiled.plan?.behavior.minimum);
      expect(createdHabit.status).toBe('active');

      // 5. Verify local EventBus emitted COMMAND_EXECUTED
      expect(executedEvents.length).toBeGreaterThan(0);
      const lastCmd = executedEvents[executedEvents.length - 1];
      expect(lastCmd?.payload?.action).toBe('CREATE_HABIT');
      expect(lastCmd?.source).toBe('ai');
    });

    it('derives identity statements and anchors them cleanly into behavior plans', () => {
      const statement = deriveIdentityStatement('read 10 pages');
      expect(statement).toContain('reader');
      expect(statement).toContain('I am');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Miss Event, Recovery Transition, and Widget Touchpoint Arbitration
  // ---------------------------------------------------------------------------
  describe('Miss Event, Recovery Transition, and Widget Touchpoint Arbitration', () => {
    it('transitions habit to recovery on miss and elevates widget touchpoint to Never-Miss-Twice 2-minute action', () => {
      const habit: Habit = {
        id: 'habit_mindset',
        identityId: 'id_reader',
        title: 'Daily Reading',
        behavior: 'Read 20 pages',
        minimumAction: 'Read 1 page',
        normalTarget: 'Read 20 pages',
        frequency: 'daily',
        status: 'active',
        streakCount: 4,
        bestStreak: 10,
        totalEvidenceVotes: 12,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      };
      inMemoryHabits.push(habit);

      // 1. Evaluate recovery transition on single miss
      const recoveryResult = evaluateRecoveryTransition(habit, 1, {
        now: '2026-10-12T10:00:00.000Z',
      });

      expect(recoveryResult.updatedHabit.status).toBe('recovery');
      expect(recoveryResult.nextSessionTarget).toBe(habit.minimumAction);
      expect(recoveryResult.rulesApplied).toContain('RECOVERY_001');

      // Update in-memory habit to recovery
      inMemoryHabits[0] = recoveryResult.updatedHabit;

      // 2. Emit HABIT_MISSED on eventBus
      eventBus.emit({
        type: 'HABIT_MISSED',
        entityId: habit.id,
        source: 'system',
        payload: {
          consecutiveMisses: 1,
          status: 'recovery',
        },
      });

      // 3. Widget Touchpoint arbitration under recovery state
      const touchpoint = selectWidgetTouchpoint(inMemoryHabits, {
        todayDate: '2026-10-12',
        now: '2026-10-12T10:00:00.000Z',
      });

      expect(touchpoint.type).toBe('recovery');
      expect(touchpoint.title).toBe("DON'T MISS TWICE");
      expect(touchpoint.actionLabel).toBe('[ 2-MIN VERSION ]');
      expect(touchpoint.actionType).toBe('COMPLETE_HABIT');
      expect(touchpoint.habitId).toBe(habit.id);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Reflection Note, Friction Diagnosis, and System Adjustment
  // ---------------------------------------------------------------------------
  describe('Reflection Note, Friction Diagnosis, and System Adjustment', () => {
    it('diagnoses semantic friction from reflection note and executes adaptive downscaling via gateway', async () => {
      const habit: Habit = {
        id: 'habit_deep_work',
        identityId: 'id_writer',
        title: 'Morning Deep Writing',
        behavior: 'Write 1000 words',
        minimumAction: 'Write 1 sentence',
        normalTarget: 'Write 1000 words',
        frequency: 'daily',
        status: 'recovery',
        streakCount: 0,
        bestStreak: 7,
        totalEvidenceVotes: 12,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z',
      };
      inMemoryHabits.push(habit);

      const reflectionNote = 'Too exhausted and no energy to write after long day';

      // 1. Friction diagnosis via Behavior Analyst
      const diagnosis = await diagnoseFriction(reflectionNote, { habit, forceHeuristic: true });
      expect(diagnosis.category).toBe('effort');
      expect(diagnosis.confidence).toBeGreaterThanOrEqual(0.6);
      expect(diagnosis.rulesApplied).toContain('FRICTION_DIAGNOSIS_001');

      // 2. Deterministic intervention mapping
      const intervention = mapFrictionToIntervention(habit, diagnosis.category);
      expect(intervention.action).toBe('ADJUST_DIFFICULTY');
      expect(intervention.ruleId).toBe('MINIMUM_ACTION_001');
      expect(intervention.payload.habitId).toBe(habit.id);
      expect(intervention.payload.direction).toBe('easier');
      expect(intervention.payload.newMinimumAction).toBe('Write 1 sentence');

      // 3. Execute adjustment command via Command Gateway
      const execResult = await executeCommand({
        action: intervention.action,
        payload: intervention.payload as any,
        actor: 'engine',
        idempotencyKey: 'cmd_adjust_e2e_001',
      });

      expect(execResult.success).toBe(true);
      expect(habitOperations.updateHabit).toHaveBeenCalledWith(
        habit.id,
        expect.objectContaining({ minimumAction: 'Write 1 sentence' })
      );

      // Verify COMMAND_EXECUTED event
      const adjustEvent = executedEvents.find((e) => e?.payload?.action === 'ADJUST_DIFFICULTY');
      expect(adjustEvent).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Weekly Review Synthesis and Identity Voting
  // ---------------------------------------------------------------------------
  describe('Weekly Review Synthesis and Identity Voting', () => {
    it('synthesizes 7-day review report with factual identity votes, Never-Miss-Twice metrics, and non-punitive narrative', async () => {
      const identity1: Identity = {
        id: 'id_reader',
        statement: 'I am a dedicated reader',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      };
      const identity2: Identity = {
        id: 'id_athlete',
        statement: 'I am a strong athlete',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      };
      inMemoryIdentities.push(identity1, identity2);

      const habit1: Habit = {
        id: 'h1',
        identityId: identity1.id,
        title: 'Daily Reading',
        behavior: 'Read 20 pages',
        minimumAction: 'Read 1 page',
        normalTarget: 'Read 20 pages',
        frequency: 'daily',
        status: 'active',
        streakCount: 5,
        bestStreak: 12,
        totalEvidenceVotes: 25,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      };
      const habit2: Habit = {
        id: 'h2',
        identityId: identity2.id,
        title: 'Workout Session',
        behavior: 'Gym workout',
        minimumAction: '1 set of squats',
        normalTarget: 'Full workout',
        frequency: 'daily',
        status: 'recovery',
        streakCount: 0,
        bestStreak: 6,
        totalEvidenceVotes: 18,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      };
      inMemoryHabits.push(habit1, habit2);

      // 7-day behavior event history (today = 2026-10-12)
      const simulatedEvents: BehaviorEvent[] = [
        { id: 'ev1', type: 'HABIT_COMPLETED', entityId: 'h1', timestamp: '2026-10-06T10:00:00.000Z', source: 'app', payload: {} },
        { id: 'ev2', type: 'HABIT_COMPLETED', entityId: 'h1', timestamp: '2026-10-07T10:00:00.000Z', source: 'app', payload: {} },
        { id: 'ev3', type: 'HABIT_COMPLETED', entityId: 'h1', timestamp: '2026-10-08T10:00:00.000Z', source: 'app', payload: {} },
        { id: 'ev4', type: 'HABIT_COMPLETED', entityId: 'h1', timestamp: '2026-10-09T10:00:00.000Z', source: 'app', payload: {} },
        { id: 'ev5', type: 'HABIT_COMPLETED', entityId: 'h1', timestamp: '2026-10-11T10:00:00.000Z', source: 'app', payload: {} },

        { id: 'ev6', type: 'HABIT_COMPLETED', entityId: 'h2', timestamp: '2026-10-06T18:00:00.000Z', source: 'app', payload: {} },
        { id: 'ev7', type: 'HABIT_MISSED', entityId: 'h2', timestamp: '2026-10-08T18:00:00.000Z', source: 'app', payload: { frictionCategory: 'effort' } },
        { id: 'ev8', type: 'HABIT_COMPLETED', entityId: 'h2', timestamp: '2026-10-09T18:00:00.000Z', source: 'app', payload: { status: 'recovery' } },
        { id: 'ev9', type: 'HABIT_MISSED', entityId: 'h2', timestamp: '2026-10-11T18:00:00.000Z', source: 'app', payload: { frictionCategory: 'time' } },
      ];
      inMemoryEvents.push(...simulatedEvents);

      const report = await generateWeeklyReview(inMemoryHabits, inMemoryEvents, inMemoryIdentities, {
        forceHeuristic: true,
        todayDate: '2026-10-12',
        userName: 'Tester',
      });

      expect(report.totalHabitsTracked).toBe(2);
      expect(report.totalCompletions).toBe(7);
      expect(report.totalMisses).toBe(2);
      expect(report.overallConsistencyRate).toBeGreaterThan(0);
      expect(report.overallConsistencyRate).toBeLessThanOrEqual(1.0);
      expect(report.recoveryAdherenceRate).toBeGreaterThan(0);

      // Identity votes verification
      expect(report.identityVotes[identity1.id].votesThisWeek).toBe(5);
      expect(report.identityVotes[identity1.id].totalVotes).toBe(25);
      expect(report.identityVotes[identity2.id].votesThisWeek).toBe(2);
      expect(report.identityVotes[identity2.id].totalVotes).toBe(18);

      // Friction breakdown verification
      expect(report.topFrictionCategories.length).toBeGreaterThan(0);
      const categoriesPresent = report.topFrictionCategories.map((c) => c.category);
      expect(categoriesPresent).toContain('effort');
      expect(categoriesPresent).toContain('time');

      // Narrative summary non-punitive tone verification
      expect(report.narrativeSummary).toContain('Tester');
      expect(report.narrativeSummary).toContain('cast 7 total votes');
      expect(report.narrativeSummary).not.toMatch(/failed|lazy|shame|disappoint/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Destructive AI Command Confirmation Gate
  // ---------------------------------------------------------------------------
  describe('Destructive AI Command Confirmation Gate', () => {
    it('rejects unconfirmed destructive AI commands and executes only upon explicit user confirmation', async () => {
      const habit: Habit = {
        id: 'habit_to_delete',
        identityId: 'id_default',
        title: 'Old Habit',
        behavior: 'Old behavior',
        minimumAction: '1 sec',
        normalTarget: '1 min',
        frequency: 'daily',
        status: 'active',
        streakCount: 0,
        bestStreak: 0,
        totalEvidenceVotes: 0,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      };
      inMemoryHabits.push(habit);

      // 1. Untrusted AI attempts DELETE_HABIT without confirmation
      const unconfirmedDelete = await executeAiCommand(
        {
          action: 'DELETE_HABIT',
          payload: { habitId: habit.id },
        },
        { confirmed: false }
      );

      expect(unconfirmedDelete.success).toBe(false);
      expect(unconfirmedDelete.requiresConfirmation).toBe(true);
      expect(unconfirmedDelete.message).toContain('requires user confirmation');
      expect(inMemoryHabits.length).toBe(1);

      // 2. Untrusted AI attempts ARCHIVE_HABIT without confirmation
      const unconfirmedArchive = await executeAiCommand(
        {
          action: 'ARCHIVE_HABIT',
          payload: { habitId: habit.id, reason: 'testing' },
        },
        { confirmed: false }
      );

      expect(unconfirmedArchive.success).toBe(false);
      expect(unconfirmedArchive.requiresConfirmation).toBe(true);
      expect(inMemoryHabits[0].status).toBe('active');

      // 3. User explicitly confirms DELETE_HABIT
      const confirmedDelete = await executeAiCommand(
        {
          action: 'DELETE_HABIT',
          payload: { habitId: habit.id },
        },
        { confirmed: true }
      );

      expect(confirmedDelete.success).toBe(true);
      expect(habitOperations.deleteHabit).toHaveBeenCalledWith(habit.id);
      expect(inMemoryHabits.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Complete End-to-End Unbroken Lifecycle
  // ---------------------------------------------------------------------------
  describe('Complete End-to-End Lifecycle', () => {
    it('executes unbroken lifecycle from natural language creation to recovery, adaptation, and review', async () => {
      // Step 1: Create habit via natural language intent -> compiler -> gateway
      const intent = await parseUserIntent('Study algorithms every morning at 08:00', {
        forceHeuristic: true,
      });
      const compiled = compileIntentToCommand(intent, inMemoryHabits);
      const createRes = await executeAiCommand(compiled.command!);
      expect(createRes.success).toBe(true);
      expect(inMemoryHabits.length).toBe(1);
      const createdHabit = inMemoryHabits[0];

      // Step 2: Log completion on day 1
      const logRes = await executeCommand({
        action: 'LOG_HABIT',
        payload: {
          habitId: createdHabit.id,
          completedAt: '2026-10-06T08:05:00.000Z',
        },
        actor: 'user',
        idempotencyKey: 'cmd_log_e2e_001',
      });
      expect(logRes.success).toBe(true);
      expect(inMemoryHabits[0].totalEvidenceVotes).toBe(1);

      // Record completion event
      inMemoryEvents.push({
        id: 'ev-c1',
        type: 'HABIT_COMPLETED',
        entityId: createdHabit.id,
        timestamp: '2026-10-06T08:05:00.000Z',
        source: 'app',
        payload: {},
      });

      // Step 3: Miss on day 2 -> Recovery transition
      const recoveryTrans = evaluateRecoveryTransition(inMemoryHabits[0], 1, {
        now: '2026-10-07T08:00:00.000Z',
      });
      inMemoryHabits[0] = recoveryTrans.updatedHabit;
      expect(inMemoryHabits[0].status).toBe('recovery');

      // Record miss event
      inMemoryEvents.push({
        id: 'ev-m1',
        type: 'HABIT_MISSED',
        entityId: createdHabit.id,
        timestamp: '2026-10-07T08:00:00.000Z',
        source: 'app',
        payload: { frictionCategory: 'effort' },
      });

      // Step 4: Widget detects recovery priority
      const widgetTouchpoint = selectWidgetTouchpoint(inMemoryHabits, {
        todayDate: '2026-10-07',
        now: '2026-10-07T09:00:00.000Z',
      });
      expect(widgetTouchpoint.type).toBe('recovery');

      // Step 5: User submits friction reflection note
      const frictionDiagnosis = await diagnoseFriction(
        'Too exhausted and no energy to study today',
        { habit: inMemoryHabits[0], forceHeuristic: true }
      );
      expect(frictionDiagnosis.category).toBe('effort');

      // Step 6: Map to system adaptation and apply via gateway
      const adaptation = mapFrictionToIntervention(inMemoryHabits[0], frictionDiagnosis.category);
      const adaptRes = await executeCommand({
        action: adaptation.action,
        payload: adaptation.payload as any,
        actor: 'user',
        idempotencyKey: 'cmd_adapt_e2e_002',
      });
      expect(adaptRes.success).toBe(true);

      // Step 7: Weekly review reflects the full week
      const review = await generateWeeklyReview(inMemoryHabits, inMemoryEvents, inMemoryIdentities, {
        forceHeuristic: true,
        todayDate: '2026-10-12',
      });
      expect(review.totalHabitsTracked).toBe(1);
      expect(review.narrativeSummary).toBeDefined();
    });
  });
});
