---
id: adaptation-engine
title: AI Adaptation Engine Policy
section: ai
source: product-decision
review_date: 2026-10-01
---

# AI Adaptation Engine Policy

## Purpose & Scope
The Adaptation Engine analyzes longitudinal behavioral patterns to dynamically optimize habit parameters, lower activation energies, and prevent systemic abandonment.

## Deterministic Adaptation Logic
The AI Adaptation Engine cannot arbitrarily change user goals. It operates under strict rule-based constraints:
1. **Lowering Activation Energy on Repeat Misses:**
   - If a habit is missed on two consecutive scheduled occurrences, the engine recommends lowering the default target to the `minimumAction`.
   - *Constraint:* The user must explicitly approve the proposal; the engine cannot silently reduce goals.
2. **Cue Tuning:**
   - If reminder notifications are repeatedly snoozed or ignored for 5 consecutive sessions, the engine suggests moving the cue to a different time or anchoring it to an alternate existing habit.
3. **Difficulty Escalation Restrictions:**
   - The engine is forbidden from suggesting a difficulty increase unless the habit has maintained ≥80% consistency across the preceding 14 days (`rulebook/rules/habit-modification.md`).

## Privacy Boundary
- Behavioral event metrics (streak history, completion timestamps, friction scores) are aggregated locally on-device.
- No aggregated analytics or behavior patterns are transmitted off the device.
