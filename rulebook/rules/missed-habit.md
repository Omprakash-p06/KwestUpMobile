---
id: missed-habit
title: Missed Habit Recovery Policy
section: rules
source: atomic-habits-interpretation
citation: "Clear, James. Atomic Habits (2018), Chapter 20: The Rule of Never Missing Twice"
review_date: 2026-10-01
---

# Missed Habit Recovery Policy

## Rule Statement
The moment a scheduled habit is missed (calendar day ends at 23:59:59 without a recorded completion):
1. **Immediate State Transition:** The habit transitions from `status: 'active'` to `status: 'recovery'`.
2. **Never Miss Twice Trigger:** The recovery engine flags the habit for elevated intervention priority across all surfaces (widgets, notifications).
3. **Mandatory Minimum Action Default:** For the next scheduled occurrence, the user interface and notification actions prioritize the `minimumAction` (2-minute rule) rather than the normal target.
4. **Resolution:** Completing the minimum action successfully restores the habit to `status: 'active'`.

## Rationale
"Missing once is an accident. Missing twice is the start of a new habit." By immediately acknowledging a miss and lowering the barrier to entry on the following day, the app prevents the psychological spiral of abandonment.

## Counterexamples and Edge Cases

> [!IMPORTANT]
> **Counterexample: Completing then Undoing on the Same Day**
> If a habit is marked complete and subsequently unchecked on the same calendar day, it is **NOT** registered as a miss until the calendar day finishes. If re-completed before 23:59:59, zero recovery state is triggered.

> [!NOTE]
> **Counterexample: Consecutive Miss Escalation**
> If a habit in `status: 'recovery'` is missed a second consecutive time, the system DOES NOT shame the user. Instead, it triggers Question 5 of the Check-in Bank (`rulebook/ai/check-in-engine.md`): *"Do you want to keep this habit?"* giving the user a graceful path to pause or recalibrate.
