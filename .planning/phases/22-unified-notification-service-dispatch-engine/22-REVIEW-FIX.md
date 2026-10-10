---
phase: 22-unified-notification-service-dispatch-engine
fixed_at: 2026-10-10T21:00:00Z
review_path: .planning/phases/22-unified-notification-service-dispatch-engine/22-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: clean
---

# Phase 22: Code Review Fix Report

**Fixed at:** 2026-10-10T21:00:00Z  
**Source review:** .planning/phases/22-unified-notification-service-dispatch-engine/22-REVIEW.md  
**Iteration:** 1  

**Summary:**
- Findings in scope: 2 (WR-01, WR-02 — Critical + Warning)
- Fixed: 2 (WR-01, WR-02)
- Skipped: 0
- Informational fixes included: IN-01, IN-02
- Quality Gates: TypeScript (0 errors), ESLint (0 errors), Jest (14/14 suites, 218/218 tests passing)

---

## Fixed Issues

### WR-01: Android channelId omitted from native scheduleNotificationAsync trigger payload

**Files modified:** `src/services/notificationService.ts`, `__tests__/unit/notificationService.test.ts`  
**Applied fix:**
- In `scheduleNotification`, attached `request.channelId` to the `trigger` object (`{ date: d, channelId: request.channelId }` or `{ channelId: request.channelId }` for immediate triggers), conforming to Expo Notifications' `NotificationTriggerInput` / `ChannelAwareTriggerInput` contracts.
- In `scheduleDailyTaskReminder`, forwarded `channelId: ANDROID_NOTIFICATION_CHANNELS.DAILY_TASKS.id` on the daily repeating trigger.
- In `scheduleBirthdayReminders`, forwarded `channelId: ANDROID_NOTIFICATION_CHANNELS.BIRTHDAYS.id` on birthday and advance reminder triggers.
- In `scheduleBillReminder`, forwarded `channelId: ANDROID_NOTIFICATION_CHANNELS.BILLING.id` on the bill reminder trigger.
- Updated `__tests__/unit/notificationService.test.ts` unit assertions to verify `trigger.channelId` across all scheduling paths.

### WR-02: Unhandled rejection hazard in BillingScreen and exportService during notification cancellation

**Files modified:** `src/screens/BillingScreen.js`, `src/utils/exportService.js`  
**Applied fix:**
- In `src/screens/BillingScreen.js`, wrapped `cancelBillReminders` in `try/catch` inside `handleDeleteBill` and `handleMarkBillPaid` so that stale or OS-cleared notification IDs degrade gracefully without halting bill deletion or payment updates.
- In `src/utils/exportService.js`, wrapped `cancelNotifications` in `try/catch` inside the `importArchive` billing restore loop so that missing or non-existent notification IDs from other devices never abort archive restoration.

---

## Additional Polish Fixed

### IN-01: Birthday reminder payloadKey includes contact ID

**Files modified:** `src/services/notificationService.ts`  
**Applied fix:** Updated `scheduleBirthdayReminders` to construct payload keys using `birthday_${birthday.id || name}_${year}` and `birthday_adv_${birthday.id || name}_${year}`, preventing key collisions when multiple contacts share the same name.

### IN-02: Defensive null/object check in getNotificationHistory filter

**Files modified:** `src/services/notificationService.ts`, `__tests__/unit/notificationService.test.ts`  
**Applied fix:** Added `if (!item || typeof item !== 'object') return false;` guard before reading `item.dispatchedAt` in `getNotificationHistory()`. Added unit test in `notificationService.test.ts` asserting that non-object elements (`null`, numbers, strings) in history JSON are safely filtered.

---

## Verification

- `npm run typecheck`: Passed (exit code 0).
- `npm run lint`: Passed (exit code 0, 0 errors).
- `npm test`: Passed (14/14 suites, 218/218 tests passing, 0 failures).
