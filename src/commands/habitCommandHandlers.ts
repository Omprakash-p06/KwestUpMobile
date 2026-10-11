/**
 * KwestUp 4.0 — Habit Domain Command Handlers
 *
 * Bridges validated Command Gateway actions to HabitContext operations
 * and pure domain engines (habitEngine, recoveryEngine, rewardEngine).
 *
 * Source: 4.0/KwestUp_4.0_Master_Plan.md §7, rulebook/machine/*.json
 */

import { CommandAction, CommandPayload } from './types';
import { CommandHandler, registerCommandHandler, unregisterCommandHandler } from './commandExecutor';
import { generateEntityId } from '../behavior/habitEngine';
import { eventBus } from '../behavior/eventBus';

export interface HabitOperations {
  createHabit: (input: any) => Promise<{ habit?: any; id?: string; rulesApplied?: string[] }> | { habit?: any; id?: string; rulesApplied?: string[] };
  updateHabit: (id: string, patch: any) => Promise<any> | any;
  deleteHabit: (id: string) => Promise<any> | any;
  completeHabit: (id: string, options?: any) => Promise<{ updatedHabit?: any; rulesApplied?: string[] }> | { updatedHabit?: any; rulesApplied?: string[] };
  missHabit: (id: string, options?: any) => Promise<{ updatedHabit?: any; rulesApplied?: string[] }> | { updatedHabit?: any; rulesApplied?: string[] };
  createIdentity?: (statement: string) => Promise<{ id?: string } | string> | { id?: string } | string;
  habits?: any[];
}

export type HabitCommandHandlerMap = {
  [A in CommandAction]: CommandHandler<A>;
};

/**
 * Creates concrete command handler functions mapped to the provided HabitOperations.
 */
export function createHabitCommandHandlers(
  ops: HabitOperations
): HabitCommandHandlerMap {
  return {
    CREATE_HABIT: async (payload: CommandPayload<'CREATE_HABIT'>) => {
      const habitInput = {
        ...payload,
        cue: {
          type: payload.cueType || 'manual',
          time: payload.cueTime,
          location: payload.cueLocation,
        },
      };
      const result = await ops.createHabit(habitInput);
      const entityId = result?.habit?.id || result?.id || generateEntityId('habit');
      return {
        entityId,
        message: `Habit "${payload.title}" created successfully`,
        rulesApplied: result?.rulesApplied || [],
      };
    },

    UPDATE_HABIT: async (payload: CommandPayload<'UPDATE_HABIT'>) => {
      await ops.updateHabit(payload.habitId, payload.updates);
      return {
        entityId: payload.habitId,
        message: 'Habit updated successfully',
        rulesApplied: [],
      };
    },

    DELETE_HABIT: async (payload: CommandPayload<'DELETE_HABIT'>) => {
      await ops.deleteHabit(payload.habitId);
      return {
        entityId: payload.habitId,
        message: 'Habit deleted successfully',
        rulesApplied: [],
      };
    },

    LOG_HABIT: async (payload: CommandPayload<'LOG_HABIT'>) => {
      const result = await ops.completeHabit(payload.habitId, {
        completedAt: payload.completedAt,
        durationMinutes: payload.durationMinutes,
        frictionCategory: payload.frictionCategory,
      });
      return {
        entityId: payload.habitId,
        message: 'Habit completed successfully',
        rulesApplied: result?.rulesApplied || [],
      };
    },

    START_RECOVERY: async (payload: CommandPayload<'START_RECOVERY'>) => {
      const result = await ops.missHabit(payload.habitId, {
        reason: payload.reason,
        category: payload.reason,
      });
      return {
        entityId: payload.habitId,
        message: 'Recovery protocol initiated',
        rulesApplied: result?.rulesApplied || [],
      };
    },

    DISMISS_INTERVENTION: async (payload: CommandPayload<'DISMISS_INTERVENTION'>, meta) => {
      eventBus.emit({
        type: 'REMINDER_DISMISSED',
        entityId: payload.interventionId,
        source: meta.actor === 'ai' ? 'ai' : meta.actor === 'widget' ? 'widget' : meta.actor === 'engine' ? 'system' : 'app',
        payload: {
          interventionId: payload.interventionId,
          reason: payload.reason,
        },
      });
      return {
        entityId: payload.interventionId,
        message: `Intervention dismissed (${payload.reason})`,
        rulesApplied: [],
      };
    },

    ADJUST_DIFFICULTY: async (payload: CommandPayload<'ADJUST_DIFFICULTY'>) => {
      await ops.updateHabit(payload.habitId, {
        minimumAction: payload.newMinimumAction,
      });
      return {
        entityId: payload.habitId,
        message: `Habit difficulty adjusted to "${payload.newMinimumAction}"`,
        rulesApplied: [],
      };
    },

    CREATE_IDENTITY: async (payload: CommandPayload<'CREATE_IDENTITY'>) => {
      let entityId: string;
      if (typeof ops.createIdentity === 'function') {
        const res = await ops.createIdentity(payload.statement);
        entityId = typeof res === 'string' ? res : res?.id || generateEntityId('identity');
      } else {
        entityId = generateEntityId('identity');
      }
      return {
        entityId,
        message: 'Identity created',
        rulesApplied: ['HABIT_IDENTITY_ANCHOR_001'],
      };
    },

    PAUSE_HABIT: async (payload: CommandPayload<'PAUSE_HABIT'>) => {
      await ops.updateHabit(payload.habitId, { status: 'paused' });
      return {
        entityId: payload.habitId,
        message: `Habit paused (${payload.reason})`,
        rulesApplied: [],
      };
    },

    ARCHIVE_HABIT: async (payload: CommandPayload<'ARCHIVE_HABIT'>) => {
      await ops.updateHabit(payload.habitId, { status: 'archived' });
      return {
        entityId: payload.habitId,
        message: `Habit archived (${payload.reason})`,
        rulesApplied: [],
      };
    },

    RESUME_HABIT: async (payload: CommandPayload<'RESUME_HABIT'>) => {
      await ops.updateHabit(payload.habitId, { status: 'active' });
      return {
        entityId: payload.habitId,
        message: `Habit resumed (${payload.reason})`,
        rulesApplied: [],
      };
    },
  };
}

let defaultHandlerRefCount = 0;

/**
 * Resets the default handler reference count (primarily for testing isolation).
 */
export function resetDefaultHabitHandlerRefCount(): void {
  defaultHandlerRefCount = 0;
}

/**
 * Registers default domain handlers for all 11 CommandAction types into the Command Executor.
 * Returns an unregister cleanup function that uses reference counting to prevent premature
 * teardown when multiple components consume the command gateway.
 */
export function registerDefaultHabitHandlers(ops: HabitOperations): () => void {
  const handlers = createHabitCommandHandlers(ops);
  defaultHandlerRefCount++;
  for (const [action, handler] of Object.entries(handlers)) {
    registerCommandHandler(action as CommandAction, handler);
  }

  return () => {
    defaultHandlerRefCount = Math.max(0, defaultHandlerRefCount - 1);
    if (defaultHandlerRefCount === 0) {
      for (const action of Object.keys(handlers)) {
        unregisterCommandHandler(action as CommandAction);
      }
    }
  };
}
