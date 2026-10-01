---
id: habit-creation
title: Habit Creation Policy
section: rules
source: product-decision
review_date: 2026-10-01
---

# Habit Creation Policy

## Rule Statement
To ensure sustainable behavioral adoption and prevent initial burnout, all newly registered habits in KwestUp must satisfy three deterministic constraints before persistence:

1. **Concurrent Active Habit Limit:**
   A user may maintain a maximum of **3 active habits simultaneously**. If 3 active habits already exist, any command attempting `CREATE_HABIT` will be rejected by `commandValidator.ts` unless an existing habit is archived or paused.
2. **Mandatory Minimum Action (2-Minute Rule):**
   Every habit must define a `minimumAction` that takes under 120 seconds to execute. Registrations with blank or identical targets (e.g., `normalTarget: "50 pushups"`, `minimumAction: "50 pushups"`) are rejected.
3. **Mandatory Cue Specification:**
   Every habit must specify an unambiguous, actionable cue trigger (`type: 'time' | 'after-habit' | 'task-completion' | 'morning' | 'evening'`). Unscheduled or triggerless habits are rejected.

## Rationale
Behavioral research demonstrates that attempting too many lifestyle changes simultaneously depletes executive function and leads to total system collapse. Focusing on a maximum of 3 habits allows automaticity to form before taking on additional cognitive load.

## Counterexamples and Edge Cases

> [!NOTE]
> **Paused or Archived Habits:**
> Habits with `status: 'paused'` or `status: 'archived'` do **NOT** count against the 3-habit concurrency cap. A user may have 20 archived habits in their historical catalog and still create a new habit if active habits are $\le 2$.

> [!WARNING]
> **Counterexample: Rejection of Overloaded Creation**
> User has Active Habits: [Workout, Study DSA, Read]. User inputs: "Start a new habit to drink 3L water".
> *System Response:* Command rejected. System informs user: "You have reached the maximum limit of 3 concurrent active habits. Pause or graduate an existing habit to begin a new one."
