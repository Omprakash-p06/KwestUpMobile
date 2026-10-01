---
id: work
title: "Domain Workflow: Daily Deep Work Session"
section: examples
source: product-decision
review_date: 2026-10-01
---

# Domain Workflow: Daily Deep Work Session

## 1. Goal Compilation
- **User Prompt:** "I need to focus on deep work every morning without distractions."
- **Derived Identity:** *"I am a focused, prolific builder."*
- **Habit Title:** Morning Deep Work
- **Behavior Definition:** 60 minutes of uninterrupted engineering or creative focus.
- **Normal Target:** 60 minutes with notifications muted and editor open.
- **Minimum Action (2-Minute Rule):** Sit at desk, open code editor, and write or review 1 line of code.
- **Cue Type:** `after-habit` / `time`
  - Cue Description: "After pouring 09:00 morning coffee at desk"
  - Cue Time: `09:00` wall-clock time

## 2. Notification & Reminder Policy Application
- **Scheduled Time:** `09:00`.
- **Policy Check (`rulebook/rules/reminders.md`):**
  - Falls cleanly after Quiet Hours (`08:00`). ✅ Permitted.
  - Spaced $\ge 90$ minutes from any earlier wake-up alert. ✅
  - Notification action includes 1-tap deep work session start.

## 3. Missed Habit Recovery Scenario
1. **Day 1 (Missed):**
   - User gets caught up in urgent email/messaging chatter at 09:00; deep work neglected.
   - Day ends; habit moves to `status: 'recovery'`.
2. **Day 2 (Recovery Protocol):**
   - Pinned on home-screen widget: *"Don't Miss Twice: Sit down, open editor, write 1 line (2 min)"*.
   - User opens editor, fixes 1 comment or type definition, and taps `[2-Min Done]`.
   - Often, opening the editor sparks momentum to continue, but even if stopped after 2 minutes, the habit recovery is complete.
