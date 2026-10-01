---
id: study
title: "Domain Workflow: Study DSA Daily"
section: examples
source: product-decision
review_date: 2026-10-01
---

# Domain Workflow: Study DSA Daily

## 1. Goal Compilation
- **User Prompt:** "I want to study Data Structures & Algorithms every evening."
- **Derived Identity:** *"I am a disciplined problem solver."*
- **Habit Title:** Study DSA
- **Behavior Definition:** Practice algorithmic problem solving and review core concepts.
- **Normal Target:** 30 minutes of focused coding practice.
- **Minimum Action (2-Minute Rule):** Open laptop and read 1 problem description on LeetCode/NeetCode.
- **Cue Type:** `after-habit` / `time`
  - Cue Description: "After finishing dinner at 20:00 in home office"
  - Cue Time: `20:00` wall-clock time

## 2. Notification & Reminder Policy Application
- **Scheduled Time:** `20:00`.
- **Policy Check (`rulebook/rules/reminders.md`):**
  - Falls outside Quiet Hours (`22:00`–`08:00`). ✅ Permitted.
  - Checks daily cap: Is within the 3/day notification limit. ✅
  - Checks minimum gap: Fires $\ge 90$ minutes after any earlier daytime reminder. ✅
- **Notification Content:**
  - Title: *"Time to solve: DSA Practice"*
  - Action buttons: `[Done (30m)]` `[2-Min Read]` `[Snooze 15m]`

## 3. Missed Habit Recovery Scenario
1. **Day 1 (Missed):**
   - User works late and skips the 20:00 session.
   - At midnight (23:59:59), the recovery state machine triggers:
     - `status` transitions from `'active'` to `'recovery'`.
     - Streak resets to 0, but total lifetime evidence votes are preserved.
2. **Day 2 (Recovery Protocol):**
   - Home-screen widget pins: *"Don't Miss Twice: Read 1 problem (2 min)"*.
   - At 20:00, the push notification explicitly presents the minimum action:
     - *"Recovery time: Just open 1 problem description to keep the chain alive."*
   - User clicks `[2-Min Read]` from the widget:
     - Completion is recorded!
     - `status` restores to `'active'`.
     - Factual reward logged: *"Never Miss Twice recovery completed successfully"*.
