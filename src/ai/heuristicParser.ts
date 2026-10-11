/**
 * KwestUp 4.0 — Offline Heuristic Intent Parser
 *
 * 100% offline, deterministic intent extraction using regex and pattern rules.
 * Runs instantly without loading native LLM weights and acts as resilient fallback
 * during model uninstalls, low-memory states, or inference timeouts.
 *
 * Source: rulebook/ai/intent-parser.md, 4.0/KwestUp_4.0_Master_Plan.md §7
 */

import { ExtractedIntent } from './types';
import { CommandAction } from '../commands/types';
import { HabitFrequency, CueType } from '../behavior/types';

/**
 * Normalizes clock time strings (e.g. "7:30am", "8pm", "14:00", "7") into "HH:mm" 24h format.
 */
export function normalizeTimeString(rawTime: string): string | undefined {
  if (!rawTime) return undefined;

  const match = rawTime.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return undefined;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3] ? match[3].toLowerCase() : null;

  if (period === 'pm' && hour < 12) {
    hour += 12;
  } else if (period === 'am' && hour === 12) {
    hour = 0;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined;
  }

  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/**
 * Parses user natural language utterance using deterministic heuristics.
 */
export function parseIntentHeuristic(rawInput: string): ExtractedIntent {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      action: 'CREATE_HABIT',
      behavior: '',
      confidence: 0,
      source: 'heuristic',
    };
  }

  const lower = trimmed.toLowerCase();

  // 1. Action Identification
  let action: CommandAction = 'CREATE_HABIT';
  let reason: string | undefined;

  if (/^(?:delete|remove|cancel|stop)\s+(?:habit\s+)?(.+)/i.test(lower)) {
    action = 'DELETE_HABIT';
  } else if (/^(?:pause|freeze|put on hold|hold)\s+(?:habit\s+)?(.+)/i.test(lower)) {
    action = 'PAUSE_HABIT';
    const vacationMatch = lower.match(/(?:for|due to|during)\s+([^,.]+)/i);
    if (vacationMatch) {
      reason = vacationMatch[1].trim();
    }
  } else if (/^(?:resume|unpause|restart|continue)\s+(?:habit\s+)?(.+)/i.test(lower)) {
    action = 'RESUME_HABIT';
  } else if (/^(?:archive)\s+(?:habit\s+)?(.+)/i.test(lower)) {
    action = 'ARCHIVE_HABIT';
  } else if (/^(?:i\s+)?(?:log|completed|finished|did my|did|check off|mark(?:ed)? done)\s+(?:habit\s+)?(.+)/i.test(lower) || /\b(?:completed|finished|logged|checked off)\b/i.test(lower)) {
    action = 'LOG_HABIT';
  } else if (/(?:too hard|make easier|simplify|reduce difficulty|make it easier|scale down)/i.test(lower)) {
    action = 'ADJUST_DIFFICULTY';
  } else if (/(?:missed|failed|fell off|start recovery|reset streak)/i.test(lower)) {
    action = 'START_RECOVERY';
  } else if (/^(?:my identity is|i want to become a|i am a|identity:)\s+(.+)/i.test(lower)) {
    action = 'CREATE_IDENTITY';
  }

  // 2. Frequency Extraction
  let frequency: HabitFrequency | undefined;
  let customWeekdays: number[] | undefined;

  if (/(?:every day|daily|each day|7 days a week)/i.test(lower)) {
    frequency = 'daily';
  } else if (/(?:every weekday\b|weekdays?\b|monday to friday|mon-fri|workdays?\b)/i.test(lower)) {
    frequency = 'weekdays';
  } else if (/(?:weekends?\b|saturday and sunday|sat-sun)/i.test(lower)) {
    frequency = 'weekends';
  } else if (/(?:once a week|every week\b|weekly\b)/i.test(lower)) {
    frequency = 'weekly';
  } else {
    // Check for explicit days (e.g. "on Mondays and Wednesdays")
    const daysFound = new Set<number>();
    for (const [dayName, dayIndex] of Object.entries(DAY_MAP)) {
      const regex = new RegExp(`\\b${dayName}s?\\b`, 'i');
      if (regex.test(lower)) {
        daysFound.add(dayIndex);
      }
    }
    if (daysFound.size > 0 && daysFound.size < 7) {
      frequency = 'custom';
      customWeekdays = Array.from(daysFound).sort((a, b) => a - b);
    } else if (action === 'CREATE_HABIT') {
      frequency = 'daily'; // Default for Atomic Habits
    }
  }

  // 3. Time, Cue & Anchor Extraction
  let cueType: CueType | undefined;
  let time: string | undefined;
  let anchor: string | undefined;
  let location: string | undefined;

  // Explicit time (e.g. "at 7:30 am", "at 8pm", "by 10:00")
  const explicitTimeMatch = lower.match(/(?:at|by)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (explicitTimeMatch && explicitTimeMatch[1]) {
    const normalized = normalizeTimeString(explicitTimeMatch[1]);
    if (normalized) {
      time = normalized;
      cueType = 'time';
    }
  }

  // Time-of-day phrases
  if (/\b(?:morning|in the morning)\b/i.test(lower)) {
    cueType = cueType || 'morning';
    time = time || '08:00';
  } else if (/\b(?:evening|in the evening|night|at night|before bed)\b/i.test(lower)) {
    cueType = cueType || 'evening';
    time = time || '20:00';
  } else if (/\b(?:afternoon)\b/i.test(lower)) {
    time = time || '14:00';
  }

  // Habit stacking anchor (e.g. "after dinner", "before breakfast", "when I wake up")
  const stackMatch = trimmed.match(/(?:after|before|following|right after|when I)\s+([^,.]+)/i);
  if (stackMatch && stackMatch[1]) {
    anchor = stackMatch[1].trim();
    cueType = 'after-habit';
  }

  // Location extraction
  const locationMatch = trimmed.match(/(?:in|at the|in the)\s+(gym|bedroom|kitchen|office|desk|living room|park|study|room)\b/i);
  if (locationMatch && locationMatch[1]) {
    location = locationMatch[1].trim();
  }

  // 4. Minimum Action Extraction
  let minimumAction: string | undefined;
  const minMatch = trimmed.match(/(?:for 2 minutes|at least \d+ [a-z]+|minimum:?\s*([a-z0-9 ]+)|start with\s+([a-z0-9 ]+))/i);
  if (minMatch) {
    minimumAction = minMatch[0].trim();
  }

  // 5. Clean Behavior Extraction
  let behavior = trimmed;

  // Strip leading intent verbs
  behavior = behavior.replace(
    /^(?:i want to|please remind me to|help me start|remind me to|start a habit of|build a habit of|i need to|i'd like to|let's|create habit|delete habit|pause habit|resume habit|log habit|start|i completed(?: my)?|completed(?: my)?|i finished(?: my)?|finished(?: my)?|i did(?: my)?|did(?: my)?)\s+/i,
    ''
  );

  // Strip frequency phrases from behavior string
  behavior = behavior.replace(/\b(?:every day|daily|each day|on weekdays|weekdays|on weekends|weekends|weekly|once a week)\b/gi, '');

  // Strip temporal and relative date markers
  behavior = behavior.replace(/\b(?:today|yesterday|tonight)\b/gi, '');

  // Strip time and anchor phrases from behavior string
  behavior = behavior.replace(/\b(?:at|by)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '');
  behavior = behavior.replace(/\b(?:in the morning|in the evening|at night|every morning|every evening)\b/gi, '');
  if (anchor) {
    behavior = behavior.replace(new RegExp(`(?:after|before|following|right after|when I)\\s+${anchor}`, 'gi'), '');
  }

  behavior = behavior.replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim();

  // If behavior extraction completely emptied, fallback to original trimmed
  if (!behavior) {
    behavior = trimmed;
  }

  return {
    action,
    behavior,
    frequency,
    customWeekdays,
    cueType: cueType || 'manual',
    time,
    anchor,
    location,
    minimumAction,
    reason,
    confidence: 0.85,
    source: 'heuristic',
  };
}
