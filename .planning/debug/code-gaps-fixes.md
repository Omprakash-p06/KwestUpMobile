---
slug: code-gaps-fixes
status: resolved
trigger: user-reported: birthday notifications not showing on time, code logic gaps, app functions not working
created: 2026-07-28
---

## Symptoms

1. Birthday notifications don't show up on time (should trigger at 00:00 on the birthday)
2. A lot of gaps in code logic throughout the app
3. A lot of other app functions don't work properly

**Project:** KwestUpMobile — React Native app at C:\Users\OM Prakash\Documents\KwestUpMobile

## Current Focus

**Hypothesis:** Multiple bugs and logic gaps across the codebase — notification scheduling, date/time handling, async patterns, error handling, race conditions, state management.

**Next action:** Full codebase investigation — scan for bugs, logic gaps, and code quality issues across all key areas.

## Evidence Log

- timestamp: 2026-07-28T00:00:00Z — Full codebase scan complete. Found 12+ bugs across notifications, state management, date handling, and billing.

  **BUG-1 (ROOT CAUSE - birthday notifications):** BirthdaysScreen.js line 20 — default `newBirthdayTime` is `23:59` (one minute before midnight) instead of `00:00`. User expects notifications at midnight (00:00) on their birthday. The birthday notification scheduling function (`scheduleCustomBirthdayReminders`) uses the `remindAtTime` field from this state, so by default it fires at 23:59, not 00:00.

  **BUG-2 (dead code):** `scheduleBirthdayNotification()` in notifications.js (lines 134-160) is never imported or called anywhere. It was supposed to handle 00:00 birthday scheduling but is dead code. Also uses timezone-brittle `new Date(\`${year}-${month}-${day}T00:00:00\`)`.

  **BUG-3 (dead code):** `playBirthdaySound()` in notifications.js (lines 118-132) is never imported or called.

  **BUG-4 (stale closure):** DailyTasksScreen.js addDailyTask() uses `[...dailyTasks, ...]` with stale closure value instead of functional updater `prev => [...prev, ...]`. Multiple rapid additions can lose tasks.

  **BUG-5 (async race):** App.js handleSaveTask() — scheduleDueDateNotification is called inside setTasks updater, but the `.then()` callback captures the updater's `currentTasks` parameter. If state updates happen before the async notification resolves, the .then() call may overwrite with stale data.

  **BUG-6 (state silently dropped):** App.js handleSaveTask() — when editing existing task with dueDate, `return currentTasks` returns unmodified state. The actual update only happens async in `.then()`, causing the UI to appear unresponsive.

  **BUG-7 (billing date overflow):** billingNotifications.js getNextDueDate() — when dueDay > days-in-month (e.g., 31 in April, February), JS Date auto-rolls to next month, producing wrong due dates.

  **BUG-8 (unawaited promises):** App.js handleExecuteSync() — cancelCustomBirthdayReminders() called in forEach without awaiting promises.

  **BUG-9 (redundant code):** exportService.js line 275 — `storageEntries.map(([key, value]) => [key, value])` is a no-op since Object.entries already returns [key, value] pairs.

  **BUG-10 (handleSaveTask new task):** Creating a new task with dueDate doesn't add it to state immediately; waits for async notification scheduling, causing visual delay.

  **BUG-11 (import after export):** diagnostics.js line 109 — `import AsyncStorage` appears after function exports. While Metro bundles tolerate this, it violates ESM spec and can confuse linters.

## Resolution

**Root Cause:** Birthday notification default time set to 23:59 instead of 00:00; stale closures in state updates causing data loss; billing date overflow for month-end days; unused dead code; prop mismatch (label vs title) in CustomButton usage; unawaited promises; redundant no-op operations.

**Fix:**
- BUG-1: Changed default `newBirthdayTime` from 23:59 to 00:00 in BirthdaysScreen.js
- BUG-2/3: Removed dead code `scheduleBirthdayNotification` and `playBirthdaySound` from notifications.js
- BUG-4: Fixed stale closure in DailyTasksScreen.addDailyTask using functional updater
- BUG-5/6/10: Refactored handleSaveTask in App.js to eliminate async race conditions — moved notification scheduling outside setTasks updater, used proper await pattern
- BUG-7: Fixed billing date overflow in getNextDueDate by clamping to month's last valid day
- BUG-8: Changed forEach to for-await loop in handleExecuteSync for birthday cancellation
- BUG-9: Removed redundant map in exportService.js restore logic
- BUG-11: Moved AsyncStorage import to top of diagnostics.js
- Fixed requestNotificationPermissions to use proper Android config instead of iOS config
- Fixed BillingScreen: changed `label`→`title` and `variant="secondary"`→`outline` on CustomButton calls
- Fixed SettingsScreen: changed `variant="outline"`→`outline` on CustomButton calls