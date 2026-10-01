---
id: habit-loop
title: The 4-Stage Habit Feedback Loop
section: atomic-habits
source: atomic-habits-interpretation
citation: "Clear, James. Atomic Habits (2018), Chapter 3: How to Build Better Habits in 4 Simple Steps"
review_date: 2026-10-01
---

# The 4-Stage Habit Feedback Loop

> "The process of building a habit can be divided into four simple steps: cue, craving, response, and reward. Breaking it down into these fundamental parts can help us understand what a habit is, how it works, and how to improve it." — James Clear

## Philosophical Principle

The neurological feedback loop of all human behavior consists of four stages:
1. **Cue:** Triggers your brain to initiate a behavior. It is a bit of information that predicts a reward.
2. **Craving:** The motivational force behind every habit. What you crave is not the habit itself, but the change in internal state it delivers.
3. **Response:** The actual habit you perform, which can take the form of a thought or an action. Whether a response occurs depends on how motivated you are and how much friction is associated with the behavior.
4. **Reward:** The end goal of every habit. Rewards deliver two purposes: they satisfy our craving and they teach our brain which actions are worth remembering.

From this feedback loop arise the **Four Laws of Behavior Change** (to create a good habit) and their inversions (to break a bad habit):
- Cue: Make it obvious (Inversion: Make it invisible)
- Craving: Make it attractive (Inversion: Make it unattractive)
- Response: Make it easy (Inversion: Make it difficult)
- Reward: Make it satisfying (Inversion: Make it unsatisfying)

## KwestUp Implementation

### 1. Structural Mapping
In KwestUp's domain layer, every habit entity explicitly models this 4-stage pipeline:
- **Cue (`src/behavior/types.ts:Cue`):** Deterministic trigger specification (time, location, after-habit anchor, or system event).
- **Craving / Mindset:** Associated identity statement and motivation prompt captured during compilation.
- **Response (`src/behavior/types.ts:Habit`):** Concrete action broken into a mandatory `minimumAction` (low activation energy) and a `normalTarget`.
- **Reward (`src/behavior/types.ts:FactualReward`):** Immediate sensory confirmation (haptic feedback, sound, visual state update, and factual milestone tracking).

### 2. Behavioral Verification
- A habit cannot be persisted in KwestUp without a defined **Cue** and a defined **Response**.
- When a habit fails, the diagnosis engine analyzes which stage broke:
  - Did the cue fail to trigger or get missed? (1st Law)
  - Was motivation or craving lacking? (2nd Law)
  - Was friction too high? (3rd Law)
  - Did the outcome feel unsatisfying or unrewarding? (4th Law)
