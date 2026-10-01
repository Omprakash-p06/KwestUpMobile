---
id: habit-compiler
title: AI Habit Compiler Policy
section: ai
source: product-decision
review_date: 2026-10-01
---

# AI Habit Compiler Policy

## Purpose & Scope
The Habit Compiler transforms user goals into complete, source-faithful Atomic Habits specifications. It bridges the gap between high-level human ambitions and deterministic execution parameters.

## Compilation Contract
Every compiled habit routine MUST output the following 5 constituent parts:
1. **Identity Statement:** The underlying persona belief ("Who do you want to become?"), e.g., *"I am an active, energized person."*
2. **Behavior (Normal Target):** The standard target action, e.g., *"Run 3 km or workout for 30 minutes."*
3. **Cue:** An explicit, unambiguous trigger adhering to `implementation-intentions.md` or `habit-stacking.md`, e.g., *"Putting on running shoes at 07:00 in bedroom."*
4. **Minimum Action (2-Minute Rule):** A gateway version guaranteed to take <120 seconds, e.g., *"Put on running shoes and do 10 jumping jacks."*
5. **Recovery Plan:** Automatic downscaling instruction to the minimum action if day 1 is missed.

## Compiler Guardrails
- **Rejection of Vague Plans:** If a user specifies "I want to get fit", the compiler must prompt for a concrete cue and behavior rather than inventing arbitrary schedules.
- **Enforcement of Concurrent Limits:** If the user already has 3 active habits, the compiler will refuse to compile a 4th without prompting the user to pause or graduate an existing habit (`rulebook/rules/habit-creation.md`).

## Privacy Boundary
- Habit compilation runs entirely offline.
- Habit titles, identity statements, and cue text must NEVER be forwarded to remote servers or logged to the forensic ring buffer.
