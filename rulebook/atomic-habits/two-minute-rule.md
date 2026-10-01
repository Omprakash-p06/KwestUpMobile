---
id: two-minute-rule
title: The Two-Minute Rule
section: atomic-habits
source: atomic-habits-interpretation
citation: "Clear, James. Atomic Habits (2018), Chapter 13: How to Stop Procrastinating by Using the Two-Minute Rule"
review_date: 2026-10-01
---

# The Two-Minute Rule

> "When you start a new habit, it should take less than two minutes to do. You'll find that nearly any habit can be scaled down into a two-minute version: 'Read before bed each night' becomes 'Read one page.' 'Do thirty minutes of yoga' becomes 'Take out my yoga mat.' 'Fold the laundry' becomes 'Fold one pair of socks.'" — James Clear

## Philosophical Principle

The purpose of the Two-Minute Rule is not to do something trivial, but to **master the art of showing up**.
A habit must be established before it can be improved. If you cannot learn the basic skill of showing up, you have little hope of mastering the finer details.
- "Gateway Habits": The two-minute action naturally leads you down a productive path. Once you put on your running shoes, you usually end up going for a run.
- "Standardize Before You Optimize": You can't optimize a habit that doesn't exist.

## KwestUp Implementation

### 1. Mandatory `minimumAction` in Schema
- In KwestUp, every habit MUST define a `minimumAction` (`src/behavior/types.ts:Habit`):
  ```typescript
  export interface Habit {
    id: string;
    identityId: string;
    title: string;
    behavior: string;
    minimumAction: string; // MUST take < 120 seconds
    normalTarget: string;
    stretchTarget?: string;
    // ...
  }
  ```
- The validator enforces that `minimumAction` is present on habit creation (`rulebook/rules/habit-creation.md`).

### 2. The 2-Minute Completion Option
- When logging a habit in-app or via widget, the user is offered two check-off options:
  - **Full Target Complete** (e.g., "Ran 5 km")
  - **Minimum Action Complete** (e.g., "Put on running shoes and stepped outside")
- **Both count as a valid completion vote for the identity!**
- This removes the "all-or-nothing" perfectionist trap that causes users to abandon habits during busy, low-energy days.

### 3. Recovery Default
- When a habit enters `recovery` state (after a missed day), the UI automatically emphasizes the 2-minute version to ensure the user does not miss twice (`rulebook/atomic-habits/never-miss-twice.md`).
