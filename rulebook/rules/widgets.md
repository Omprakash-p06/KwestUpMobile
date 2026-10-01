---
id: widgets
title: Home-Screen Widget Prioritization Policy
section: rules
source: product-decision
review_date: 2026-10-01
---

# Home-Screen Widget Prioritization Policy

## Rule Statement
The home-screen widget is KwestUp's primary ambient behavioral surface. Because screen real estate on Android home screens is constrained, widget content renders in strict hierarchical priority:

1. **Priority 1: Don't Miss Twice Recovery Prompt:**
   If any active habit is in `status: 'recovery'` (having been missed the previous day), it is pinned to the top of the widget with its 2-minute minimum action.
2. **Priority 2: Today's Pending Habit (Next Action):**
   The immediate next scheduled habit for the current day.
3. **Priority 3: Today's Tasks & Checklist Items:**
   Active high-priority daily tasks from `TaskContext.js`.
4. **Priority 4: Completed State / Celebratory Summary:**
   When all today actions are completed, the widget renders a clean summary (votes cast today and current streak).

## Rationale
The widget must guide action, not overwhelm with clutter. By giving highest precedence to Never-Miss-Twice recovery actions, the widget directly protects user consistency and prevents routine collapse.

## Counterexamples and Edge Cases

> [!NOTE]
> **Counterexample: Recovery Action Preemption**
> Suppose the user has 5 standard tasks and 1 habit in recovery. The recovery habit always preempts the first slot of the widget, even if the other tasks have earlier timestamps.
