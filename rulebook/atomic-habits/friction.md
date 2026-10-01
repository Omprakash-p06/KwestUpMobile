---
id: friction
title: Friction Taxonomy & Analysis
section: atomic-habits
source: atomic-habits-interpretation
citation: "Clear, James. Atomic Habits (2018), Chapter 12: The Law of Least Effort"
review_date: 2026-10-01
---

# Friction Taxonomy & Analysis

> "Friction is the distance between your cue and your response. The greater the friction, the less likely the habit is to occur. When you reduce the friction associated with good habits, you make them effortless to perform." — James Clear

## Philosophical Principle

Every task requires a specific amount of activation energy. Friction represents all the micro-steps, obstacles, physical distances, and cognitive delays that stand between the intention to act and the execution of the action.
To build good habits, we systematically eliminate friction. To break bad habits, we systematically insert friction.

## Friction Taxonomy in KwestUp

KwestUp categorizes friction into six distinct categories (`src/behavior/types.ts:FrictionCategory`):

1. **`effort` (Physical/Energy Friction):**
   - The action is physically exhausting or demands excessive physical vigor when energy is low.
   - *Example:* A 60-minute intense gym workout after a 10-hour workday.
2. **`time` (Duration/Scheduling Friction):**
   - The action takes too long to complete, conflicting with other commitments.
   - *Example:* Demanding 45 minutes of meditation when only 10 minutes are available before commuting.
3. **`setup` (Preparation/Tooling Friction):**
   - The tools, files, or environment are not pre-configured, requiring significant preparation before work begins.
   - *Example:* Having to find running socks, clean gym shorts, and charge earbuds before jogging.
4. **`emotional` (Anxiety/Avoidance Friction):**
   - Negative emotional states (fear of failure, boredom, dread, perfectionism) repel the user from starting.
   - *Example:* Procrastinating on an exam review because the material feels overwhelming.
5. **`mental` (Cognitive/Complexity Friction):**
   - The action is confusing, ambiguous, or lacks a clear first step.
   - *Example:* "Work on thesis" with no defined section or outline.
6. **`location` (Spatial/Contextual Friction):**
   - The user is in the wrong physical environment or traveling, making the normal routine impossible.
   - *Example:* Routine requires home barbell equipment while staying in a hotel.

## KwestUp Implementation

### 1. Friction Diagnosis on Missed Actions
When a habit is missed and the user engages with a check-in or weekly review, KwestUp asks:
*"What got in the way today?"*
The user selects one of the 6 friction categories (`effort`, `time`, `setup`, `emotional`, `mental`, `location`).

### 2. Evidence-Based Adaptation
The Adaptation Engine (`rulebook/ai/adaptation-engine.md`) maps the diagnosed friction to automated structural adjustments:
- If `setup` friction is high: Add an environment priming step to the preceding evening's routine.
- If `time` or `effort` friction is high: Scale down the default target to the 2-minute minimum action.
- If `mental` friction is high: Require the habit to specify the exact file or first line of action.
- If `location` friction is high: Create an alternate "travel routine" version of the habit.
