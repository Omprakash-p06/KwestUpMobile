---
id: rewards
title: Reward & Positive Reinforcement Policy
section: rules
source: product-decision
review_date: 2026-10-01
---

# Reward & Positive Reinforcement Policy

## Rule Statement
KwestUp adheres to a strict **factual reward policy**:
1. **Rejection of Arbitrary Gamification:** The application strictly forbids casino mechanics, arbitrary XP points, virtual currencies, loot crates, or synthetic badges.
2. **Factual Milestone Acknowledgement:** Rewards are based solely on verifiable real-world achievements (`src/behavior/types.ts:FactualReward`):
   - First completion milestone
   - Consistency streaks (7, 14, 30, 90, 365 days)
   - Successful Never-Miss-Twice recoveries
   - Fastest activation energy (actions completed within 5 minutes of cue)
3. **Sensory Confirmation:** Tactile haptic feedback and sound pulses provide clean sensory closure immediately upon completion without delayed slot-machine animations.

## Rationale
Arbitrary gamification fosters extrinsic motivation, which evaporates the moment the novelty fades or the user feels manipulated. Factual milestone tracking fosters intrinsic identity pride: "I am becoming the type of person who follows through."

## Counterexamples and Edge Cases

> [!CAUTION]
> **Counterexample: Arbitrary Points Forbidden**
> A proposed PR or AI prompt that awards "+50 XP points for drinking water" violates this rule and will be rejected at code review and schema validation.
> *Compliant Equivalent:* "3rd day of drinking 2L logged. Consistency: 100% this week."
