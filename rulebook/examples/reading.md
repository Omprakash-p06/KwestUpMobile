---
id: reading
title: "Domain Workflow: Daily Reading"
section: examples
source: product-decision
review_date: 2026-10-01
---

# Domain Workflow: Daily Reading

## 1. Goal Compilation
- **User Prompt:** "I want to read more books before going to sleep."
- **Derived Identity:** *"I am a curious, lifelong reader."*
- **Habit Title:** Evening Reading
- **Behavior Definition:** Read non-fiction or literature before bed.
- **Normal Target:** 15 minutes of uninterrupted reading.
- **Minimum Action (2-Minute Rule):** Open book on nightstand and read exactly 1 page.
- **Cue Type:** `after-habit`
  - Cue Description: "Getting into bed and turning on the bedside reading lamp"
  - Cue Time: `21:30` wall-clock time

## 2. Notification & Reminder Policy Application
- **Scheduled Time:** `21:30`.
- **Policy Check (`rulebook/rules/reminders.md`):**
  - `21:30` falls before Quiet Hours (`22:00`–`08:00`). ✅ Permitted.
  - Notice: Because Quiet Hours start at `22:00`, any notification for bedtime reading must fire before `22:00` to avoid being suppressed.
  - Daily cap verified. ✅

## 3. Missed Habit Recovery Scenario
1. **Day 1 (Missed):**
   - User fell asleep instantly from exhaustion without opening the book.
   - Day rolls over; habit moves to `status: 'recovery'`.
2. **Day 2 (Recovery Protocol):**
   - The widget and next evening's reminder prompt: *"Don't miss twice: Just 1 page tonight before closing your eyes."*
   - User reads 1 page, taps `[1 Page Complete]`.
   - Habit returns to `status: 'active'`.
