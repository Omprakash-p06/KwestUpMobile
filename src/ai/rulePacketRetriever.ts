/**
 * KwestUp 4.0 — Rule Packet Retriever (Lightweight Rule RAG)
 *
 * Scans user natural language input for behavioral keywords and retrieves
 * 2-3 focused machine rule definitions to inform on-device model extraction
 * without context overflow.
 *
 * Source: rulebook/machine/*.json, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import { RulePacket } from './types';

interface RuleDefinition {
  id: string;
  keywords: string[];
  snippet: string;
}

const BEHAVIORAL_RULES: readonly RuleDefinition[] = [
  {
    id: 'CUE_STACK_001',
    keywords: ['stack', 'after', 'before', 'then', 'when i', 'following'],
    snippet: 'CUE_STACK: Anchor habit to an existing daily anchor routine.',
  },
  {
    id: 'CUE_STACK_002',
    keywords: ['after', 'before', 'following', 'right after'],
    snippet: 'CUE_STACK_TIME: Establish immediate temporal sequence with anchor.',
  },
  {
    id: 'HABIT_IDENTITY_ANCHOR_001',
    keywords: ['identity', 'become', 'person', 'type of', 'who i am', 'athlete', 'writer'],
    snippet: 'IDENTITY: Ground habit in desired identity belief ("I am a...").',
  },
  {
    id: 'MINIMUM_ACTION_001',
    keywords: ['start small', '2 min', 'two minute', 'easy', 'quick', 'minimum', 'tiny'],
    snippet: '2-MIN: Define gateway action that takes <120 seconds.',
  },
  {
    id: 'NEVER_MISS_TWICE_001',
    keywords: ['miss', 'missed', 'skip', 'failed', 'relapse', 'recover', 'back on track'],
    snippet: 'RECOVERY: Never miss twice. Revert to 2-minute action on miss.',
  },
  {
    id: 'HABIT_PAUSE_001',
    keywords: ['pause', 'break', 'hold', 'vacation', 'sick', 'freeze', 'travel'],
    snippet: 'PAUSE: Temporary hold preserves identity and streaks.',
  },
];

export const MAX_PROMPT_RULE_PACKET_LENGTH = 200;

/**
 * Retrieves up to 3 relevant behavioral machine rules based on input text keywords.
 */
export function retrieveRulePacket(input: string): RulePacket {
  if (!input || typeof input !== 'string') {
    return {
      ruleIds: [],
      snippets: [],
      formattedPromptText: '',
    };
  }

  const lower = input.toLowerCase();
  const matchedRules: RuleDefinition[] = [];

  for (const rule of BEHAVIORAL_RULES) {
    const hasMatch = rule.keywords.some((kw) => lower.includes(kw));
    if (hasMatch) {
      matchedRules.push(rule);
      if (matchedRules.length >= 3) {
        break;
      }
    }
  }

  const ruleIds = matchedRules.map((r) => r.id);
  const snippets = matchedRules.map((r) => r.snippet);

  const formattedPromptText = formatRulePacketForPrompt({ snippets });

  return {
    ruleIds,
    snippets,
    formattedPromptText,
  };
}

/**
 * Formats a RulePacket into a compact string suitable for LLM system prompt injection,
 * clamped to MAX_PROMPT_RULE_PACKET_LENGTH (200 chars).
 */
export function formatRulePacketForPrompt(packet: Pick<RulePacket, 'snippets'>): string {
  if (!packet.snippets || packet.snippets.length === 0) {
    return '';
  }

  const joined = `Relevant Rules: [${packet.snippets.join(' | ')}]`;
  if (joined.length <= MAX_PROMPT_RULE_PACKET_LENGTH) {
    return joined;
  }

  return joined.slice(0, MAX_PROMPT_RULE_PACKET_LENGTH - 4).trim() + '...]';
}
