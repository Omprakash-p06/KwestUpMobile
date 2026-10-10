/**
 * KwestUp 4.0 — Pure Improvement & Consistency Engine
 *
 * Calculates rolling 14-day consistency, streaks, and automaticity scoring.
 *
 * Source: rulebook/machine/habitRules.json, 4.0/KwestUp_4.0_Master_Plan.md §10, §11
 */

import { BehaviorEvent, Habit, TimeOptions } from './types';
import { getLocalDateString, parseLocalDate } from '../utils/dateUtils';

/**
 * Calculates rolling completion consistency over the last N days (0.00 to 1.00)
 */
export function calculateRollingConsistency(
  events: BehaviorEvent[],
  habitId: string,
  days = 14,
  options: TimeOptions = {}
): number {
  if (days <= 0) return 0;

  const todayStr = options.todayDate || getLocalDateString();
  const baseDate = parseLocalDate(todayStr);
  if (isNaN(baseDate.getTime())) return 0;

  // Find all completion events for this habit
  const habitCompletionDates = new Set<string>();
  for (const event of events) {
    if (event.type === 'HABIT_COMPLETED' && event.entityId === habitId) {
      const eventDate = getLocalDateString(event.timestamp);
      if (eventDate) {
        habitCompletionDates.add(eventDate);
      }
    }
  }

  let completedDays = 0;
  for (let offset = 0; offset < days; offset++) {
    const targetDate = new Date(baseDate.getTime());
    targetDate.setDate(targetDate.getDate() - offset);
    const dateKey = getLocalDateString(targetDate);
    if (habitCompletionDates.has(dateKey)) {
      completedDays++;
    }
  }

  return Number((completedDays / days).toFixed(2));
}

/**
 * Calculates current consecutive completion streak from behavior event log
 */
export function calculateCurrentStreak(
  events: BehaviorEvent[],
  habitId: string,
  options: TimeOptions = {}
): number {
  const todayStr = options.todayDate || getLocalDateString();
  const baseDate = parseLocalDate(todayStr);
  if (isNaN(baseDate.getTime())) return 0;

  const habitCompletionDates = new Set<string>();
  for (const event of events) {
    if (event.type === 'HABIT_COMPLETED' && event.entityId === habitId) {
      const eventDate = getLocalDateString(event.timestamp);
      if (eventDate) {
        habitCompletionDates.add(eventDate);
      }
    }
  }

  // Check if today was completed
  const completedToday = habitCompletionDates.has(todayStr);

  // If not completed today, start checking from yesterday
  let streak = 0;
  let offset = completedToday ? 0 : 1;

  while (true) {
    const targetDate = new Date(baseDate.getTime());
    targetDate.setDate(targetDate.getDate() - offset);
    const dateKey = getLocalDateString(targetDate);

    if (habitCompletionDates.has(dateKey)) {
      streak++;
      offset++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculates Phillippa Lally 66-day automaticity progress index (0 to 100)
 */
export function calculateAutomaticityScore(
  habit: Habit,
  rolling14DayConsistency: number
): number {
  // 1. Consistency component (0 to 40 pts) based on 14-day rolling consistency
  const consistencyScore = Math.min(40, Math.round(rolling14DayConsistency * 40));

  // 2. Lifetime evidence votes component (0 to 40 pts) towards 66-day automaticity target
  const votes = habit.totalEvidenceVotes || 0;
  const votesScore = Math.min(40, Math.round((votes / 66) * 40));

  // 3. Current streak momentum component (0 to 20 pts)
  const streak = habit.streakCount || 0;
  const streakScore = Math.min(20, Math.round((streak / 21) * 20));

  const total = consistencyScore + votesScore + streakScore;
  return Math.min(100, Math.max(0, total));
}

export default {
  calculateRollingConsistency,
  calculateCurrentStreak,
  calculateAutomaticityScore,
};
