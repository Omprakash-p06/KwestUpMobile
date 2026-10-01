---
id: implementation-intentions
title: Implementation Intentions
section: atomic-habits
source: atomic-habits-interpretation
citation: "Clear, James. Atomic Habits (2018), Chapter 5: The Best Way to Start a New Habit"
review_date: 2026-10-01
---

# Implementation Intentions

> "Hundreds of studies have shown that implementation intentions are effective for sticking to our goals, whether it's writing down the exact time and date you will get a flu shot or recording the time of your next colonoscopy appointment." — James Clear

## Philosophical Principle

An implementation intention is a pre-determined plan that specifies *when* and *where* an intended behavior will take place.
The canonical formula:
$$\text{"I will [BEHAVIOR] at [TIME] in [LOCATION]."}$$

Many people believe they lack motivation when what they truly lack is clarity. Vague goals (such as "I want to eat healthier" or "I should read more") leave the brain guessing when to initiate action. An explicit implementation intention transforms a vague ambition into a concrete trigger that prompts action automatically when the time and place arrive.

## KwestUp Implementation

### 1. Concrete Cue Specification (`src/behavior/types.ts:Cue`)
In KwestUp, every habit cue must specify the trigger conditions:
```typescript
export interface Cue {
  id: string;
  habitId: string;
  type: CueType; // 'time' | 'after-habit' | 'task-completion' | 'manual' | 'morning' | 'evening'
  time?: string; // 'HH:mm' wall-clock format
  location?: string; // optional physical context (e.g. 'Gym', 'Desk')
  triggerEvent?: string; // e.g. 'TASK_COMPLETED'
  conditions?: Record<string, unknown>;
}
```

### 2. Habit Compiler Enforcement
- The AI Habit Compiler (`rulebook/ai/habit-compiler.md`) is strictly forbidden from compiling a habit with an ungrounded or ambiguous cue (e.g., "when free", "soon").
- If the user provides a freeform goal like "I want to do pushups every day", the compiler must infer or request:
  - Behavior: "Do 10 pushups"
  - Time/Anchor: "07:30 AM" or "Immediately upon getting out of bed"
  - Location: "Living room floor"
