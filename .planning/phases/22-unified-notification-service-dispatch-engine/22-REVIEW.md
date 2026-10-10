---
phase: 22-unified-notification-service-dispatch-engine
reviewed: 2026-10-10T20:45:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/services/notificationService.ts
  - src/services/types.ts
  - src/utils/logger.js
  - src/utils/notifications.js
  - src/utils/billingNotifications.js
  - App.js
  - src/navigation/AppNavigator.js
  - src/context/BirthdayContext.js
  - src/context/TaskContext.js
  - src/screens/BirthdaysScreen.js
  - src/screens/DailyTasksScreen.js
  - src/screens/BillingScreen.js
  - src/utils/exportService.js
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues-found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-10-10T20:45:00Z  
**Depth:** standard  
**Files Reviewed:** 13  
**Status:** issues-found  

## Summary

Completed comprehensive code review of Phase 22 (Unified Notification Service & Dispatch Engine). The architecture aligns well with the behavioral rulebook (`rulebook/rules/reminders.md` and `rulebook/rules/privacy.md`):
- `evaluateNotificationPolicy` enforces quiet-hours (anchored at `08:01`), daily cap (3/day for behavioral cues), 90-min gap, 30-min deduplication, and user opt-out with critical channel bypass.
- Recurring requests (`task`, `birthday`, `billing`) are appropriately exempt from client-side schedule-time caps.
- Behavioral PII redaction (`habitTitle`, `cueText`) is enforced in `logger.js` and verified by unit tests.
- Sole bootstrap ownership is properly vested in `AppNavigator.js`, and legacy notification utilities have been collapsed into `@deprecated` adapters with zero raw console calls.

Two warnings and two informational improvements were identified:
1. **Warning (WR-01):** Android `channelId` was omitted from `Notifications.scheduleNotificationAsync`'s `content` payload across all schedulers, causing Android 8+ to fall back to the default channel and bypass custom channel importance/vibrations.
2. **Warning (WR-02):** Uncaught rejection hazard in `BillingScreen.js` and `exportService.js` when batch-canceling notifications using the throwing `cancelNotifications` helper.
3. **Info (IN-01):** Birthday reminder `payloadKey` should include `birthday.id` when available to prevent key collisions between contacts sharing the same name.
4. **Info (IN-02):** Defensive type guard in `getNotificationHistory()` for non-object array items in storage.

---

## Warnings

### WR-01: Android channelId omitted from native scheduleNotificationAsync content payload

**File:** `src/services/notificationService.ts:355-360, 419-423, 529-533, 563-567, 677-681`  
**Severity:** warning  
**Issue:** `initNotificationChannels` defines and registers 5 dedicated Android channels (`kwestup_behavior_cues`, `kwestup_daily_tasks`, `kwestup_birthdays`, `kwestup_billing`, `kwestup_system`) with customized importance and vibration patterns. However, none of the native `Notifications.scheduleNotificationAsync({ content: { ... } })` calls pass `channelId: request.channelId` in the `content` payload. On Android 8.0+ (API 26+), notifications without `channelId` inside `content` are assigned to the system fallback channel, bypassing the configured importance, vibration patterns, and user notification category controls.  
**Recommendation:** Pass `channelId` inside `content` in `scheduleNotification`, `scheduleDailyTaskReminder`, `scheduleBirthdayReminders`, and `scheduleBillReminder`. Update unit test assertions in `notificationService.test.ts` to verify channel assignment.

### WR-02: Unhandled rejection hazard in BillingScreen and exportService during notification cancellation

**File:** `src/screens/BillingScreen.js:223, 232`, `src/utils/exportService.js:373`  
**Severity:** warning  
**Issue:** `cancelNotifications` in `notificationService.ts` aggregates errors and throws an `Error` if any cancellation fails. In `BillingScreen.js` (`handleDeleteBill`, `handlePayBill`) and `exportService.js` (`importArchive`), `cancelNotifications` is invoked without a `try/catch` guard. If a notification ID is stale, already dismissed by the OS, or imported from an archive created on another device, the promise rejection aborts the bill mutation or corrupts the archive import flow.  
**Recommendation:** Wrap `cancelNotifications` (or `cancelBillReminders`) in `try/catch` inside `BillingScreen.js` and `exportService.js` so that cancellation failures for missing or stale OS notifications degrade gracefully without blocking state mutations or backup restores.

---

## Info

### IN-01: Birthday reminder payloadKey should include contact ID

**File:** `src/services/notificationService.ts:541, 575`  
**Severity:** info  
**Issue:** `scheduleBirthdayReminders` constructs `payloadKey` as `birthday_${name}_${year}` and `birthday_adv_${name}_${year}`. If a user has multiple contacts with identical names, payload keys collide. Other schedulers already use `task.id || taskName` and `bill.id || billName`.  
**Recommendation:** Use `birthday.id || name` when constructing `payloadKey` for birthday reminders.

### IN-02: Defensive null/object check in getNotificationHistory filter

**File:** `src/services/notificationService.ts:161-164`  
**Severity:** info  
**Issue:** `getNotificationHistory` filters parsed JSON array entries with `item.dispatchedAt`. If an array contains `null` or a primitive, property access throws a `TypeError`. While caught by the surrounding block, an explicit `!item || typeof item !== 'object'` guard avoids unnecessary exceptions.  
**Recommendation:** Add `if (!item || typeof item !== 'object') return false;` to the history filter.
