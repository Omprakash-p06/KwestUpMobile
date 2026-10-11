/**
 * KwestUp 4.0 — useCommandGateway React Hook
 *
 * Provides safe, type-checked command execution for UI screens, widgets,
 * and AI assistant interfaces, integrating with HabitContext.
 *
 * Source: 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import { useEffect, useCallback } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  CommandAction,
  CommandActor,
  CommandExecutionResult,
  CommandPayload,
  DispatchedCommand,
} from './types';
import { executeCommand } from './commandExecutor';
import { registerDefaultHabitHandlers } from './habitCommandHandlers';
import { executeAiCommand, AiCommandExecutionResult } from './aiSandbox';

export interface DispatchCommandOptions {
  confirmed?: boolean;
  actor?: CommandActor;
  idempotencyKey?: string;
}

export function useCommandGateway() {
  const habitOps = useHabits();

  useEffect(() => {
    const unregister = registerDefaultHabitHandlers(habitOps);
    return () => {
      unregister();
    };
  }, [habitOps]);

  const dispatchCommand = useCallback(
    async <A extends CommandAction>(
      action: A,
      payload: CommandPayload<A>,
      options: DispatchCommandOptions = {}
    ): Promise<CommandExecutionResult> => {
      const idempotencyKey =
        options.idempotencyKey ||
        `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const command: DispatchedCommand<A> = {
        action,
        payload,
        idempotencyKey,
        actor: options.actor || 'user',
        confirmed: options.confirmed,
      };

      return executeCommand(command);
    },
    []
  );

  const dispatchAiCommand = useCallback(
    async (
      untrustedOutput: unknown,
      options: { confirmed?: boolean; idempotencyKey?: string } = {}
    ): Promise<AiCommandExecutionResult> => {
      return executeAiCommand(untrustedOutput, options);
    },
    []
  );

  return {
    dispatchCommand,
    dispatchAiCommand,
  };
}
