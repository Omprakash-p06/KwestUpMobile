---
id: law-1-obvious
title: The 1st Law — Make It Obvious
section: atomic-habits
source: atomic-habits-interpretation
citation: "Clear, James. Atomic Habits (2018), Chapters 4–7: The 1st Law"
review_date: 2026-10-01
---

# The 1st Law — Make It Obvious

> "Until you make the unconscious conscious, it will direct your life and you will call it fate. You do not need to be aware of the cue for a habit to begin, but you do need to be aware of the cue for a habit to change." — James Clear

## Philosophical Principle

The first step to building better habits is becoming aware of cues and designing an environment where positive cues are prominent and impossible to miss.
Key mechanics:
1. **Habit Scorecard:** Auditing current behaviors to make unconscious patterns explicit.
2. **Implementation Intentions:** Pinpointing exact time, date, and location triggers.
3. **Habit Stacking:** Linking a desired new action to an established daily routine anchor.
4. **Environment Design:** Designing visual cues in one's physical and digital surroundings.

## KwestUp Implementation

### 1. Cue Saliency via Android Surfaces
KwestUp makes habit cues obvious across three primary Android touchpoints:
- **Interactive Home-Screen Widgets:** The `TasksListWidget` and `HabitWidget` present pending habits directly on the user's primary mobile viewport, eliminating the friction of voluntarily opening the application.
- **Actionable Notifications:** Reminders fire with clear, explicit cue context (e.g., "After dinner: open your study notes") with direct action buttons (`Done`, `2-Min Done`, `Snooze 15m`).
- **In-App Top Banners:** Urgent or recovery actions appear immediately in the primary task and habit header areas.

### 2. Cue Formulation Validation
- Every habit must specify a concrete trigger:
  - `time`: e.g., `07:30` wall-clock time
  - `after-habit`: linked to the completion of another habit
  - `task-completion`: linked to completing a task in a specific task list
  - `morning` / `evening`: broad ambient routine anchors
- Abstract cues (e.g., "when I feel like it", "sometime today") are rejected by the habit compiler and command schema.
