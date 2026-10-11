/**
 * KwestUp 4.0 — AI Intent Parser & Behavior Compiler Types
 *
 * Defines typed contracts for on-device intent extraction, rule packets,
 * and deterministic habit compilation.
 *
 * Source: rulebook/ai/intent-parser.md, rulebook/ai/habit-compiler.md, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import { CommandAction, DispatchedCommand } from '../commands/types';
import { HabitFrequency, CueType, CompiledHabitPlan, Habit, FrictionCategory } from '../behavior/types';

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
  timeoutMs?: number;
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

export interface SuggestedIntervention {
  action: CommandAction;
  habitId: string;
  payload: Record<string, unknown>;
  description: string;
  ruleId: string;
}

export interface FrictionAnalysisResult {
  category: FrictionCategory;
  reason: string;
  confidence: number; // 0..1
  source: 'llm' | 'heuristic';
  suggestedIntervention?: SuggestedIntervention;
  rulesApplied: string[];
}

export interface FrictionAnalyzerOptions {
  forceHeuristic?: boolean;
  timeoutMs?: number;
  habit?: Habit;
  recentMissCount?: number;
  consecutiveMisses?: number;
}

export interface WeeklyReviewIdentityVote {
  identityId: string;
  statement: string;
  totalVotes: number;
  votesThisWeek: number;
}

export interface WeeklyReviewReport {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  totalHabitsTracked: number;
  overallConsistencyRate: number; // 0..1
  totalCompletions: number;
  totalMisses: number;
  recoveryAdherenceRate: number; // 0..1
  identityVotes: Record<string, WeeklyReviewIdentityVote>;
  topFrictionCategories: Array<{ category: FrictionCategory; count: number }>;
  suggestedAdjustments: SuggestedIntervention[];
  narrativeSummary: string;
  source: 'llm' | 'heuristic';
  rulesApplied: string[];
}

export interface WeeklyReviewOptions {
  todayDate?: string; // YYYY-MM-DD
  forceHeuristic?: boolean;
  timeoutMs?: number;
  userName?: string;
}
