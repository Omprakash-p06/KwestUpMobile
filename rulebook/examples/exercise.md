---
id: exercise
title: "Domain Workflow: Daily Exercise"
section: examples
source: product-decision
review_date: 2026-10-01
---

# Domain Workflow: Daily Exercise

## 1. Goal Compilation
- **User Prompt:** "I need to work out every day in the morning."
- **Derived Identity:** *"I am an active, energized person."*
- **Habit Title:** Morning Workout
- **Behavior Definition:** Complete daily calisthenics or cardio session.
- **Normal Target:** 25 minutes of bodyweight circuit or running.
- **Minimum Action (2-Minute Rule):** Put on running shoes and do 10 pushups.
- **Cue Type:** `time`
  - Cue Description: "Putting on running shoes at 07:00 in bedroom"
  - Cue Time: `07:00` wall-clock time

## 2. Notification & Reminder Policy Application
- **Scheduled Time:** `07:00`.
- **Policy Check (`rulebook/rules/reminders.md`):**
  - **Quiet Hours Conflict:** `07:00` falls within default Quiet Hours (`22:00`–`08:00`).
  - **Resolution:** System checks if the user has custom morning hours or auto-defers push alert to `08:01`, OR relies on the home-screen widget ambient cue at `07:00` without triggering a sound notification.
  - If user explicitly configures early morning active window (06:30–21:30), `07:00` fires as scheduled.

## 3. Missed Habit Recovery Scenario
1. **Day 1 (Missed):**
   - User oversleeps; 07:00 passes without completion.
   - Day ends; habit enters `status: 'recovery'`.
2. **Day 2 (Recovery Protocol):**
   - Home-screen widget immediately highlights: *"Never Miss Twice: Put on shoes + 10 pushups (2 min)"*.
   - User does 10 pushups next to bed and taps `[2-Min Done]` on the widget.
   - Habit immediately returns to `status: 'active'`. Momentum is protected.
