---
id: sleep
title: "Domain Workflow: Sleep Hygiene & Wind-Down"
section: examples
source: product-decision
review_date: 2026-10-01
---

# Domain Workflow: Sleep Hygiene & Wind-Down

## 1. Goal Compilation
- **User Prompt:** "Help me fix my sleep schedule so I sleep by 22:30."
- **Derived Identity:** *"I am a well-rested, high-functioning person."*
- **Habit Title:** Evening Wind-Down
- **Behavior Definition:** Disconnect from screens and begin bedroom sleep preparation.
- **Normal Target:** Lights out and asleep by 22:30.
- **Minimum Action (2-Minute Rule):** Turn off phone screen and put device on charger away from bed.
- **Cue Type:** `time`
  - Intended Trigger: 22:00 alarm

## 2. Notification & Reminder Policy Application

> [!IMPORTANT]
> **Quiet Hours Interaction Policy (`rulebook/rules/reminders.md`):**
> Because default Quiet Hours begin promptly at `22:00`, a notification cannot be dispatched at `22:00` without violating quiet hours!
> **System Adaptation:**
> The AI Habit Compiler automatically schedules the wind-down reminder at **`21:30`** (30 minutes prior to quiet hours).
> Notification text: *"Wind-down cue: 30 minutes until quiet hours. Time to turn off screens."*

## 3. Missed Habit Recovery Scenario
1. **Day 1 (Missed):**
   - User stayed up watching videos until 01:00.
   - At midnight/morning evaluation, sleep habit registers as missed -> `status: 'recovery'`.
2. **Day 2 (Recovery Protocol):**
   - In the evening (21:30), the notification prompts:
     *"Never miss twice: Tonight, just take 30 seconds to place your phone on the charger before 22:00."*
   - User places phone on charger at 21:50 and logs 2-minute completion.
   - Habit successfully recovers to `'active'`.
