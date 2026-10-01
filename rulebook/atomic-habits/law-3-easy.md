---
id: law-3-easy
title: The 3rd Law — Make It Easy
section: atomic-habits
source: atomic-habits-interpretation
citation: "Clear, James. Atomic Habits (2018), Chapters 11–14: The 3rd Law"
review_date: 2026-10-01
---

# The 3rd Law — Make It Easy

> "Human behavior follows the Law of Least Effort. People will naturally gravitate toward the option that requires the least amount of work. In a sense, every habit is just an obstacle to getting what you really want." — James Clear

## Philosophical Principle

The third law addresses the response stage. To form a new habit, the required activation energy must be minimized. Habits form based on frequency and repetitions, not the duration of time spent thinking about them.
Key mechanics:
1. **Reduce Friction:** Eliminate micro-steps, setup delays, and cognitive burdens between the cue and the response.
2. **Prime the Environment:** Prepare physical and digital tools in advance so taking action is the default path.
3. **The 2-Minute Rule:** Scale any target habit down to an initial gateway version that takes less than 120 seconds to execute.
4. **Master the Decisive Moment:** Deliver interventions right at the tipping point that shapes the next chunk of time.

## KwestUp Implementation

### 1. Mandatory Minimum Action Schema
Every habit registered in KwestUp must declare both a `normalTarget` and a `minimumAction` (`src/behavior/types.ts`):
```typescript
export interface Habit {
  // ...
  minimumAction: string; // e.g., "Open note and write 1 sentence"
  normalTarget: string;  // e.g., "Write 500 words"
}
```
If a user or compiler attempts to create a habit with an unscaled minimum action (e.g., minimumAction: "Run 10 km"), the schema validation rejects it with an instruction to scale down.

### 2. Zero-Friction Widget Logging
- Completing a habit can be logged directly from the home-screen widget with a single tap, without launching the full React Native application or loading navigation state.
- Notification action buttons allow 1-tap completion directly from the Android status bar.

### 3. Automatic Fallback to Minimum Action
- Whenever a habit enters `recovery` status (after a miss), the system automatically prompts the user with the `minimumAction` rather than the `normalTarget`, reducing activation resistance to near zero.
