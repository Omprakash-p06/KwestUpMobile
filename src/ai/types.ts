/**
 * KwestUp 4.0 — AI Intent Parser & Behavior Compiler Types
 *
 * Defines typed contracts for on-device intent extraction, rule packets,
 * and deterministic habit compilation.
 *
 * Source: rulebook/ai/intent-parser.md, rulebook/ai/habit-compiler.md, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import { CommandAction, DispatchedCommand } from '../commands/types';
import { HabitFrequency, CueType, CompiledHabitPlan, Habit } from '../behavior/types';

export interface ExtractedIntent {
  action: CommandAction;
  behavior: string;
  frequency?: HabitFrequency;
  customWeekdays?: number[]; // [0..6]
  cueType?: CueType;
  time?: string; // HH:mm format
  anchor?: string; // habit stack anchor description
  location?: string;
  minimumAction?: string;
  target?: string;
  reason?: string;
  confidence: number; // 0..1
  source: 'llm' | 'heuristic';
  rulesRetrieved?: string[];
}

export interface IntentParserOptions {
  forceHeuristic?: boolean;
  temperature?: number;
  contextPrompt?: string;
}

export interface RulePacket {
  ruleIds: string[];
  snippets: string[];
  formattedPromptText: string;
}

export interface CompilationResult {
  success: boolean;
  plan?: CompiledHabitPlan;
  command?: DispatchedCommand;
  errors?: string[];
  rulesApplied: string[];
  requiresConfirmation?: boolean;
}

export interface CompilerOptions {
  activeHabits?: Habit[];
  confirmed?: boolean;
}
