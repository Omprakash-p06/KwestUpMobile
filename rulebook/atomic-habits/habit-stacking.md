---
id: habit-stacking
title: Habit Stacking
section: atomic-habits
source: atomic-habits-interpretation
citation: "Clear, James. Atomic Habits (2018), Chapter 5: Habit Stacking (adapted from BJ Fogg)"
review_date: 2026-10-01
---

# Habit Stacking

> "One of the best ways to build a new habit is to identify a current habit you already do each day and then stack your new behavior on top. This is called habit stacking." — James Clear

## Philosophical Principle

Habit stacking is a specialized form of implementation intention. Instead of pairing your new habit with a particular time and location, you pair it with an established, automatic daily routine.
The canonical formula:
$$\text{"After [CURRENT HABIT], I will [NEW HABIT]."}$$

Because the brain already has established neural pathways for the existing habit (the "anchor"), attaching the new behavior directly to the anchor leverages existing momentum and eliminates the need to remember when to act.

## KwestUp Implementation

### 1. HabitStack Entity (`src/behavior/types.ts:HabitStack`)
KwestUp natively models sequential habit chaining:
```typescript
export interface HabitStack {
  anchorHabitId: string;
  targetHabitId: string;
  relationship: 'immediately-after' | 'with';
}
```

### 2. Event-Driven Reactive Triggers
- When habit $A$ (the anchor) is completed, the domain event bus (`eventBus.ts`, Phase 23) dispatches a `HABIT_COMPLETED` event.
- The Cue Engine catches this event and immediately surfaces the stacked habit $B$ on active surfaces:
  - If the user is in-app, a sequential transition card appears.
  - If completed via widget or notification, a secondary notification or updated widget state immediately cues habit $B$.

### 3. Stacking Rules & Safety Limits
- To prevent cognitive overload, stacks are limited to a maximum depth of **3 sequential habits**.
- An anchor habit must have at least an 80% consistency rate over the last 14 days before a new habit can be anchored to it (`rulebook/rules/habit-modification.md`).
