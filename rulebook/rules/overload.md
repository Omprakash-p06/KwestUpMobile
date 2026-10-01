---
id: overload
title: Overload & Anti-Burnout Policy
section: rules
source: product-decision
review_date: 2026-10-01
---

# Overload & Anti-Burnout Policy

## Rule Statement
To prevent behavioral exhaustion and chronic failure spirals, KwestUp monitors active load and triggers an automated Anti-Burnout Overload Intervention.

### Concrete Overload Threshold Criteria
An **Overload Condition** is declared if and only if **ALL** of the following three conditions are met simultaneously:

1. **Active Habit Count:**
   The user has **3 or more habits in active-or-recovery load** (`status: 'active'` or `status: 'recovery'`). Threshold sits at 3 (not 4) so it is reachable under the habit-creation cap of max 3 active habits.
2. **Systemic Miss Rate:**
   The combined 7-day miss rate across **ALL** active habits exceeds **40%** (i.e., less than 60% of scheduled habit occurrences were completed over the last 7 calendar days).
3. **Persistence:**
   This high-miss condition has persisted for at least **3 consecutive days**.

## Automated Intervention Action
When an Overload Condition is declared:
1. The app displays a supportive, non-judgmental anti-burnout banner:
   *"You're carrying a lot right now. When habits collide, consistency drops. Let's protect your core momentum."*
2. The engine proposes **pausing the lowest-streak habit** (moving it to `status: 'paused'`), temporarily reducing the cognitive burden until consistency returns on core routines.
3. Push notifications for non-essential routines are automatically curtailed.

## Rationale
"Be the designer of your world, not merely the consumer of it." When life demands surge, continuing to demand 100% execution across multiple new habits causes guilt and total system abandonment. Structured pausing allows users to maintain high integrity on their top 1–2 identities without feeling like failures.

## Counterexamples and Edge Cases

> [!NOTE]
> **Counterexample: High Miss Rate with Few Habits**
> A user has only 2 active habits, but misses both 3 days in a row (100% miss rate).
> *System Behavior:* This does **NOT** trip the Overload Engine because active-or-recovery load is $< 3$. Instead, this trips the standard Never-Miss-Twice recovery flow (`rulebook/rules/missed-habit.md`), which scales the habit down to its 2-minute version.
