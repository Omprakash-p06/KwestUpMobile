---
id: review-system
title: Weekly Review & System Reflection
section: atomic-habits
source: atomic-habits-interpretation
citation: "Clear, James. Atomic Habits (2018), Chapter 20: How to Review Your Habits and Make Adjustments"
review_date: 2026-10-01
---

# Weekly Review & System Reflection

> "Reflection and review enables the long-term improvement of all habits because it brings awareness to your mistakes and helps you consider possible paths for improvement. Without reflection, we can make excuses, create rationalizations, and lie to ourselves." — James Clear

## Philosophical Principle

A periodic review prevents stagnation and self-deception. Clear outlines two core reflection rhythms:
1. **The Annual Review:** Reflecting on what went well, what didn't go well, and what you learned.
2. **The Integrity Report:** Auditing core values, identity beliefs, and whether your daily actions aligned with who you wish to become.

For daily and weekly execution, a structured **Weekly Review** provides the feedback loop necessary to tune activation energies, adjust cues, and catch bad habit creep before it solidifies.

## KwestUp Implementation

### 1. Weekly Behavioral Review UI (Phase 28)
- Every Sunday (or user-configured review day), KwestUp prompts a lightweight weekly review:
  - Total votes cast per identity.
  - Overall consistency percentage across all active habits.
  - Miss analysis: highlighting which friction categories (`effort`, `time`, `setup`, `emotional`, `mental`, `location`) caused lapses.
  - Recovery success rate: how effectively the user adhered to the "Never Miss Twice" rule.

### 2. Actionable Adjustments Over Guilt
The weekly review never lectures or berates the user. It presents objective, factual data and suggests concrete system adaptations:
- "3 misses this week were due to `time` friction at 07:00 AM. Would you like to shift this reminder to 08:00 AM or reduce the normal target to 15 minutes?"
- This closes the loop between observed behavioral telemetry and the next week's habit parameters.
