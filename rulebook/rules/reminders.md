---
id: reminders
title: Notification & Reminder Policy
section: rules
source: product-decision
review_date: 2026-10-01
---

# Notification & Reminder Policy

## Rule Statement
To protect the user's attention, prevent device fatigue, and preserve sleep hygiene, all scheduled push notifications are governed by the `BehavioralNotificationPolicy` (`src/services/types.ts`):

1. **Quiet Hours (Default: `22:00` – `08:00`):**
   No non-critical notifications may fire between 22:00 at night and 08:00 in the morning. The window is `[22:00, 08:00)` wall-clock — `08:00:30` is still quiet. Any cue scheduled inside this window is automatically deferred to the end of quiet hours (`08:01`).
2. **Daily Notification Cap (Max 3/Day):**
   The application will dispatch a maximum of **3 push notifications per calendar day** across all active habits and task reminders combined.
3. **Minimum Notification Gap (Minimum 90 Minutes):**
   Two notifications may not be dispatched within **90 minutes** of each other. If two habits trigger within 90 minutes, the second is either batched or postponed.
4. **Deduplication Window (30 Minutes):**
   Identical reminder payloads targeting the same habit entity within 30 minutes are suppressed.

## Counterexamples and Edge Cases

> [!IMPORTANT]
> **Counterexample: Quiet Hours Crossing Midnight**
> A user sets a reminder for `23:00` to do night stretches.
> *System Behavior:* Because `23:00` falls within the quiet hours window (`22:00` to `08:00`), the notification engine automatically reschedules this reminder to **`08:01` the following morning**, or prompts the user to adjust the cue to `21:30` (before quiet hours begin).

> [!NOTE]
> **Counterexample: Daylight Saving Time (DST) Transitions**
> All quiet hour calculations, schedule triggers, and time window verifications use **device-local wall-clock time**, NOT UTC offsets. When the local clock springs forward or falls back, quiet hours remain anchored to `22:00`–`08:00` local time as reported by `dateUtils.js`.

> [!WARNING]
> **Counterexample: Multiple Habits Scheduled Simultaneously at 08:00**
> Suppose Habit A (Recovery state, high priority) and Habit B (Standard active) are both scheduled for `08:00`.
> *System Behavior:* Under the 90-minute minimum gap and single-dispatch rules, **only the highest-priority habit (Habit A) fires at `08:00`**. Habit B's reminder is batched into a bundled summary or deferred to `09:30` to avoid notification spam.
