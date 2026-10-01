---
id: check-in-engine
title: AI Check-in Engine Policy
section: ai
source: product-decision
review_date: 2026-10-01
---

# AI Check-in Engine Policy

## Purpose & Scope
The Check-in Engine provides structured self-reflection moments following missed cues, broken streaks, or weekly milestones.

## Strict Finite Question Bank
To eliminate hallucinations, unexpected conversational rambling, and excessive token usage, check-ins are restricted to a **FINITE QUESTION BANK OF EXACTLY 5 STRUCTURED QUESTIONS**.

The Check-in Engine DOES NOT use open-ended LLM text generation to invent conversational questions. Instead, questions are deterministically selected from the approved bank based on context:

1. **"What got in the way today?"** (Friction Diagnosis)
   - *Trigger:* Fired on a missed habit or broken streak.
   - *Response format:* Selection among the 6 friction categories (`effort`, `time`, `setup`, `emotional`, `mental`, `location`).
2. **"How hard did it feel on a scale of 1-5?"** (Effort Calibration)
   - *Trigger:* Fired after completing a newly increased target or difficult habit.
   - *Response format:* Numeric 1 (too easy) to 5 (exhausting).
3. **"Would an easier minimum action help?"** (Activation Energy)
   - *Trigger:* Fired after a second consecutive miss (Never-Miss-Twice recovery state).
   - *Response format:* Binary (Yes / No) with proposal to scale down `minimumAction`.
4. **"Should we adjust the reminder time?"** (Cue Relevance)
   - *Trigger:* Fired when reminders are frequently dismissed without completion.
   - *Response format:* Time adjustment picker or "Keep current time".
5. **"Do you want to keep this habit?"** (Commitment Check)
   - *Trigger:* Fired when a habit has been inactive for ≥7 consecutive days or overload is declared.
   - *Response format:* Action choice (Keep & reset / Pause habit / Archive habit).

## Anti-Pattern Prohibition
- The system must never engage in multi-turn therapy or guilt-tripping dialogue.
- Check-ins are fast, deterministic, and complete in <30 seconds.

## Privacy Boundary
- Responses to check-in questions are stored locally in the behavioral events log.
- Check-in answers and question contexts are strictly excluded from network sync and logger breadcrumbs.
