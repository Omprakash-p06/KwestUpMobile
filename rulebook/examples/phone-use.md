---
id: phone-use
title: "Domain Workflow: Reduce Mindless Phone Scrolling"
section: examples
source: product-decision
review_date: 2026-10-01
---

# Domain Workflow: Reduce Mindless Phone Scrolling

## 1. Goal Compilation (Inversion Workflow)
- **User Prompt:** "I waste 2 hours every night scrolling social media on my phone."
- **Derived Identity:** *"I am in control of my attention and digital habits."*
- **Habit Title:** Screen-Free Evening
- **Behavior Definition (3rd Inversion: Make it Difficult):** Increase physical friction to make evening scrolling difficult.
- **Normal Target:** Phone locked in desk drawer or hallway docking station from 21:00 until morning.
- **Minimum Action (2-Minute Rule):** Put phone on "Do Not Disturb" and place face-down across the room at 21:00.
- **Cue Type:** `time`
  - Cue Time: `21:00` wall-clock time

## 2. Notification & Reminder Policy Application
- **Scheduled Time:** `21:00`.
- **Policy Check (`rulebook/rules/reminders.md`):**
  - `21:00` is 60 minutes before Quiet Hours start (`22:00`). ✅ Permitted.
  - Generates clear action prompt: *"Friction trigger: Lock phone away for the night."*
  - This is the final push notification dispatched for the day, respecting the daily cap.

## 3. Missed Habit Recovery Scenario
1. **Day 1 (Missed):**
   - User dismisses notification and keeps scrolling until midnight.
   - Day ends; habit status transitions to `'recovery'`.
2. **Day 2 (Recovery Protocol):**
   - Next evening at 21:00, the system surfaces the low-friction minimum action:
     *"Never miss twice: You don't have to lock it in the drawer tonight. Just plug it in across the room and turn it face-down."*
   - User follows through with the minimum action and checks it off.
   - Recovery is complete; habit status resets to `'active'`.
