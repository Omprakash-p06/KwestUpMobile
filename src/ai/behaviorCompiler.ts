/**
 * KwestUp 4.0 — Deterministic Behavior Compiler
 *
 * Compiles extracted bare-fact intents into complete, verified Atomic Habits
 * plans and executable commands. Enforces habit concurrent caps (HABIT_CONCURRENT_CAP_001),
 * Two-Minute minimum action derivations (MINIMUM_ACTION_001), identity statement
 * anchors (HABIT_IDENTITY_ANCHOR_001), implementation intentions (CUE_STACK_001),
 * and Never-Miss-Twice recovery protocols (NEVER_MISS_TWICE_001).
 *
 * Source: rulebook/ai/habit-compiler.md, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import { ExtractedIntent, CompilationResult, CompilerOptions } from './types';
import { Habit, Cue } from '../behavior/types';
import {
  compileHabitPlan,
  generateMinimumAction,
  validateHabitCreation,
  generateEntityId,
} from '../behavior/habitEngine';
import { DispatchedCommand, CommandAction } from '../commands/types';
import { executeAiCommand, AiCommandExecutionResult } from '../commands/aiSandbox';
import { getLocalDateString } from '../utils/dateUtils';

const ARCHETYPE_IDENTITIES: Array<{ keywords: string[]; identity: string }> = [
  {
    keywords: ['read', 'book', 'reading', 'pages'],
    identity: 'I am a consistent, thoughtful reader',
  },
  {
    keywords: ['run', 'running', 'jog', 'marathon'],
    identity: 'I am an active, disciplined runner',
  },
  {
    keywords: ['code', 'program', 'dsa', 'study', 'algorithm', 'software'],
    identity: 'I am a disciplined software engineer and continuous learner',
  },
  {
    keywords: ['meditate', 'meditation', 'mindful', 'breathe', 'breathwork'],
    identity: 'I am a calm, centered, and mindful practitioner',
  },
  {
    keywords: ['workout', 'pushup', 'pushups', 'gym', 'exercise', 'lift'],
    identity: 'I am an active, energized, and strong athlete',
  },
  {
    keywords: ['write', 'journal', 'essay', 'blog'],
    identity: 'I am a dedicated, expressive writer',
  },
  {
    keywords: ['water', 'hydrate', 'drink'],
    identity: 'I am someone who takes excellent care of my health and hydration',
  },
];

/**
 * Deterministically derives an identity statement anchored in behavior.
 */
export function deriveIdentityStatement(behavior: string): string {
  const lower = (behavior || '').toLowerCase();
  for (const item of ARCHETYPE_IDENTITIES) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      return item.identity;
    }
  }

  const clean = behavior.trim() || 'good habits';
  return `I am someone who consistently practices ${clean}`;
}

/**
 * Compiles an extracted intent into a complete, source-faithful Atomic Habits plan.
 */
export function compileIntentToHabitPlan(
  intent: ExtractedIntent,
  activeHabits: Habit[] = []
): CompilationResult {
  const rulesAppliedSet = new Set<string>();

  if (intent.action !== 'CREATE_HABIT') {
    return {
      success: false,
      errors: [`Cannot compile habit plan for non-creation action "${intent.action}"`],
      rulesApplied: [],
    };
  }

  if (!intent.behavior || intent.behavior.trim().length === 0) {
    return {
      success: false,
      errors: ['Behavior description cannot be empty'],
      rulesApplied: [],
    };
  }

  // 1. Concurrent Cap Check (HABIT_CONCURRENT_CAP_001)
  const capCheck = validateHabitCreation({ title: intent.behavior }, activeHabits);
  capCheck.rulesApplied.forEach((r) => rulesAppliedSet.add(r));

  if (!capCheck.valid) {
    return {
      success: false,
      errors: [capCheck.reason || 'Maximum concurrent active habits reached (3). Pause or complete an existing habit first.'],
      rulesApplied: Array.from(rulesAppliedSet),
    };
  }

  // 2. Identity Derivation (HABIT_IDENTITY_ANCHOR_001)
  const identityStatement = deriveIdentityStatement(intent.behavior);
  rulesAppliedSet.add('HABIT_IDENTITY_ANCHOR_001');

  // 3. Minimum Action Derivation (MINIMUM_ACTION_001)
  const minResult = generateMinimumAction(intent.behavior, intent.minimumAction);
  minResult.rulesApplied.forEach((r) => rulesAppliedSet.add(r));

  // 4. Cue Structuring
  const cueType = intent.cueType || (intent.anchor ? 'after-habit' : intent.time ? 'time' : 'manual');
  const cue: Partial<Cue> = {
    type: cueType,
    time: intent.time,
    location: intent.location,
  };

  // 5. Compile Complete Atomic Habits Plan
  const planResult = compileHabitPlan(
    {
      identity: identityStatement,
      behavior: intent.behavior,
      minimumAction: minResult.minimumAction,
      normalTarget: intent.target || intent.behavior,
      cue,
    },
    activeHabits
  );

  planResult.rulesApplied.forEach((r) => rulesAppliedSet.add(r));

  if (!planResult.valid || !planResult.plan) {
    return {
      success: false,
      errors: [planResult.reason || 'Habit plan compilation failed'],
      rulesApplied: Array.from(rulesAppliedSet),
    };
  }

  return {
    success: true,
    plan: planResult.plan,
    rulesApplied: Array.from(rulesAppliedSet),
  };
}

/**
 * Translates an extracted intent into a typed DispatchedCommand proposal.
 */
export function compileIntentToCommand(
  intent: ExtractedIntent,
  activeHabits: Habit[] = []
): CompilationResult {
  const rulesAppliedSet = new Set<string>();
  if (intent.rulesRetrieved) {
    intent.rulesRetrieved.forEach((r) => rulesAppliedSet.add(r));
  }

  const idempotencyKey = `cmd_comp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  switch (intent.action) {
    case 'CREATE_HABIT': {
      const planRes = compileIntentToHabitPlan(intent, activeHabits);
      planRes.rulesApplied.forEach((r) => rulesAppliedSet.add(r));

      if (!planRes.success || !planRes.plan) {
        return {
          success: false,
          errors: planRes.errors,
          rulesApplied: Array.from(rulesAppliedSet),
        };
      }

      const plan = planRes.plan;
      const payload: DispatchedCommand<'CREATE_HABIT'>['payload'] = {
        title: intent.behavior,
        behavior: plan.behavior.target,
        minimumAction: plan.behavior.minimum,
        normalTarget: plan.behavior.normal,
        frequency: intent.frequency || 'daily',
        cueType: plan.cue.type,
      };

      if (intent.customWeekdays && intent.customWeekdays.length > 0) {
        payload.customSchedule = { weekdays: intent.customWeekdays };
      }
      if (plan.cue.time) {
        payload.cueTime = plan.cue.time;
      }
      if (intent.location || plan.cue.anchor) {
        payload.cueLocation = intent.location || plan.cue.anchor;
      }

      const command: DispatchedCommand<'CREATE_HABIT'> = {
        action: 'CREATE_HABIT',
        idempotencyKey,
        actor: 'ai',
        payload,
      };

      return {
        success: true,
        plan,
        command,
        rulesApplied: Array.from(rulesAppliedSet),
      };
    }

    case 'LOG_HABIT': {
      // Find matching habit if possible
      const matchingHabit = activeHabits.find((h) =>
        h.title.toLowerCase().includes(intent.behavior.toLowerCase()) ||
        intent.behavior.toLowerCase().includes(h.title.toLowerCase())
      );
      const habitId = matchingHabit?.id || generateEntityId('habit');

      const command: DispatchedCommand<'LOG_HABIT'> = {
        action: 'LOG_HABIT',
        idempotencyKey,
        actor: 'ai',
        payload: {
          habitId,
          completedAt: new Date().toISOString(),
        },
      };

      return {
        success: true,
        command,
        rulesApplied: Array.from(rulesAppliedSet),
      };
    }

    case 'PAUSE_HABIT': {
      const matchingHabit = activeHabits.find((h) =>
        h.title.toLowerCase().includes(intent.behavior.toLowerCase())
      );
      const habitId = matchingHabit?.id || generateEntityId('habit');

      const command: DispatchedCommand<'PAUSE_HABIT'> = {
        action: 'PAUSE_HABIT',
        idempotencyKey,
        actor: 'ai',
        payload: {
          habitId,
          actor: 'user',
          reason: intent.reason || 'User requested pause via assistant',
        },
      };

      return {
        success: true,
        command,
        rulesApplied: Array.from(rulesAppliedSet),
      };
    }

    case 'RESUME_HABIT': {
      const matchingHabit = activeHabits.find((h) =>
        h.title.toLowerCase().includes(intent.behavior.toLowerCase())
      );
      const habitId = matchingHabit?.id || generateEntityId('habit');

      const command: DispatchedCommand<'RESUME_HABIT'> = {
        action: 'RESUME_HABIT',
        idempotencyKey,
        actor: 'ai',
        payload: {
          habitId,
          actor: 'user',
          reason: intent.reason || 'User requested resume via assistant',
        },
      };

      return {
        success: true,
        command,
        rulesApplied: Array.from(rulesAppliedSet),
      };
    }

    case 'DELETE_HABIT': {
      const matchingHabit = activeHabits.find((h) =>
        h.title.toLowerCase().includes(intent.behavior.toLowerCase())
      );
      const habitId = matchingHabit?.id || generateEntityId('habit');

      const command: DispatchedCommand<'DELETE_HABIT'> = {
        action: 'DELETE_HABIT',
        idempotencyKey,
        actor: 'ai',
        confirmed: false, // Requires explicit user confirmation
        payload: {
          habitId,
        },
      };

      return {
        success: true,
        command,
        requiresConfirmation: true,
        rulesApplied: Array.from(rulesAppliedSet),
      };
    }

    case 'ARCHIVE_HABIT': {
      const matchingHabit = activeHabits.find((h) =>
        h.title.toLowerCase().includes(intent.behavior.toLowerCase())
      );
      const habitId = matchingHabit?.id || generateEntityId('habit');

      const command: DispatchedCommand<'ARCHIVE_HABIT'> = {
        action: 'ARCHIVE_HABIT',
        idempotencyKey,
        actor: 'ai',
        confirmed: false, // Requires explicit user confirmation
        payload: {
          habitId,
          actor: 'user',
          reason: intent.reason || 'User requested archive',
        },
      };

      return {
        success: true,
        command,
        requiresConfirmation: true,
        rulesApplied: Array.from(rulesAppliedSet),
      };
    }

    case 'ADJUST_DIFFICULTY': {
      const matchingHabit = activeHabits.find((h) =>
        h.title.toLowerCase().includes(intent.behavior.toLowerCase())
      );
      const habitId = matchingHabit?.id || generateEntityId('habit');

      const simplerAction = intent.minimumAction || `Do 1 minute of ${intent.behavior}`;
      const command: DispatchedCommand<'ADJUST_DIFFICULTY'> = {
        action: 'ADJUST_DIFFICULTY',
        idempotencyKey,
        actor: 'ai',
        payload: {
          habitId,
          direction: 'easier',
          newMinimumAction: simplerAction,
        },
      };

      return {
        success: true,
        command,
        rulesApplied: Array.from(rulesAppliedSet),
      };
    }

    case 'START_RECOVERY': {
      const matchingHabit = activeHabits.find((h) =>
        h.title.toLowerCase().includes(intent.behavior.toLowerCase())
      );
      const habitId = matchingHabit?.id || generateEntityId('habit');

      const command: DispatchedCommand<'START_RECOVERY'> = {
        action: 'START_RECOVERY',
        idempotencyKey,
        actor: 'ai',
        payload: {
          habitId,
          reason: 'effort',
        },
      };

      return {
        success: true,
        command,
        rulesApplied: Array.from(rulesAppliedSet),
      };
    }

    case 'CREATE_IDENTITY': {
      const command: DispatchedCommand<'CREATE_IDENTITY'> = {
        action: 'CREATE_IDENTITY',
        idempotencyKey,
        actor: 'ai',
        payload: {
          statement: intent.behavior.startsWith('I am') ? intent.behavior : deriveIdentityStatement(intent.behavior),
        },
      };

      return {
        success: true,
        command,
        rulesApplied: ['HABIT_IDENTITY_ANCHOR_001', ...Array.from(rulesAppliedSet)],
      };
    }

    default: {
      return {
        success: false,
        errors: [`Unsupported compilation action "${intent.action}"`],
        rulesApplied: Array.from(rulesAppliedSet),
      };
    }
  }
}

/**
 * Compiles an extracted intent into a command and dispatches it through the AI Sandbox.
 * Enforces destructive action confirmation gating (SYS_AI_CONFIRMATION_GATE_001).
 */
export async function compileAndExecuteIntent(
  intent: ExtractedIntent,
  options: CompilerOptions = {}
): Promise<AiCommandExecutionResult> {
  const activeHabits = options.activeHabits || [];
  const compilation = compileIntentToCommand(intent, activeHabits);

  if (!compilation.success || !compilation.command) {
    return {
      success: false,
      message: '',
      error: compilation.errors?.join('; ') || 'Compilation failed',
      requestId: 'unknown',
      rulesApplied: compilation.rulesApplied,
    };
  }

  const command = compilation.command;

  // Destructive Action Gate: require explicit confirmation
  const isDestructive = command.action === 'DELETE_HABIT' || command.action === 'ARCHIVE_HABIT';
  if (isDestructive && options.confirmed !== true) {
    return {
      success: false,
      requiresConfirmation: true,
      message: 'Action requires user confirmation before proceeding',
      error: `Destructive action "${command.action}" requires explicit user confirmation`,
      requestId: command.idempotencyKey,
      rulesApplied: ['SYS_AI_CONFIRMATION_GATE_001', ...compilation.rulesApplied],
    };
  }

  // Dispatch to Command Gateway through AI Execution Sandbox
  return executeAiCommand(command, {
    confirmed: options.confirmed === true,
    idempotencyKey: command.idempotencyKey,
  });
}
