# Phase 22 Research: Unified Notification Service & Dispatch Engine

**Phase:** 22 of 28 (Milestone 3: KwestUp 4.0 Core Technology Platform)  
**Requirements Addressed:** `NOTIF-01`, `NOTIF-02`  
**Domain:** Notification Architecture, Android Channels, Deterministic Behavioral Policy Engine, PII Redaction  
**Date:** 2026-10-04  

---

## 1. Executive Summary

Phase 22 consolidates all notification scheduling, channel management, permissions, and policy enforcement into a single authoritative service: [`src/services/notificationService.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/services/notificationService.ts).

Currently, notification mechanics are scattered across [`src/utils/notifications.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/utils/notifications.js) (285 lines), [`src/utils/billingNotifications.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/utils/billingNotifications.js) (94 lines), and direct Expo API calls in [`src/context/BirthdayContext.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/context/BirthdayContext.js). Schedulers currently bypass the behavioral policy contracts defined in the rulebook, and billing notifications contain raw `console.error` calls that violate repo linting standards.

### Non-Negotiable Phase Objectives:
1. **Unified Service (`NOTIF-01`):** Implement `src/services/notificationService.ts` implementing the TypeScript contracts established in Phase 20 (`src/services/types.ts`). Configure dedicated Android notification channels with specific importance levels and vibration patterns.
2. **Deterministic Behavioral Policy Engine (`NOTIF-02`):** Implement a pure policy evaluation engine enforcing:
   - Quiet Hours (`22:00` to `08:00` wall-clock, auto-deferring to `08:01`).
   - Daily Notification Cap (Maximum 3 dispatches/calendar day for behavioral cues).
   - Minimum Notification Gap (90 minutes minimum separation between behavioral dispatches).
   - Deduplication Window (30-minute suppression of identical payload keys).
   - User opt-out kill switch.
3. **Dispatch History & State Persistence:** Maintain a lightweight, privacy-safe history of recent notification dispatch timestamps in `AsyncStorage` (`kwestup_notification_history_v1`) to evaluate policy constraints across app restarts.
4. **Caller Migration & Clean Backwards Compatibility:** Migrate callers (`TaskContext.js`, `BirthdayContext.js`, `AppNavigator.js`, screens, and `exportService.js`) to `notificationService.ts`. Retain legacy utility files as thin wrappers with deprecation warnings.
5. **Logger Redaction Expansion:** Extend `SENSITIVE_KEYS` in [`src/utils/logger.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/utils/logger.js) with `habitTitle|cueText` as mandated by `rulebook/rules/privacy.md`.
6. **Zero Regression Test Suite:** Add unit tests for `notificationService.ts` and ensure all 13+ test suites pass 100% with 0 lint errors and 0 type errors.

---

## 2. Current Notification Ecosystem Analysis

### Existing Call Sites & Implementations

| File | Current Implementation | Issues / Deficiencies | Migration Target in Phase 22 |
|---|---|---|---|
| `src/utils/notifications.js` | Exports `requestNotificationPermissions`, `canDispatchBehavioralNotification`, `scheduleDailyTaskNotification`, `schedulePushNotification`, `scheduleDueDateNotification`, `cancelDueDateNotification`, `scheduleCustomBirthdayReminders`, `cancelCustomBirthdayReminders`. | No channel management; bypasses behavioral policy; scattered schedulers. | Thin wrapper delegating to `notificationService.ts`. |
| `src/utils/billingNotifications.js` | Exports `scheduleRecurringBillReminder`, `cancelRecurringBillReminders`. | Uses raw `console.error` (2 ESLint warnings); bypasses central logger; no channels. | Thin wrapper delegating to `notificationService.ts`. |
| `src/context/BirthdayContext.js` | Direct imports of `expo-notifications` for `cancelScheduledNotificationAsync`. | Bypasses service abstraction; calls native library directly. | Migrated to `notificationService.cancelNotification`. |
| `src/context/TaskContext.js` | Uses `scheduleDailyTaskNotification`, `scheduleDueDateNotification`, `cancelDueDateNotification`. | Untyped; legacy API. | Migrated to `notificationService` methods. |
| `src/navigation/AppNavigator.js` | Calls `requestNotificationPermissions` on mount. | Direct utility import. | Migrated to `notificationService.requestPermissions`. |
| `src/screens/BirthdaysScreen.js` | Direct calls to birthday notification schedulers. | Direct utility import. | Migrated to `notificationService`. |
| `src/screens/DailyTasksScreen.js` | Direct calls to daily task schedulers. | Direct utility import. | Migrated to `notificationService`. |
| `src/screens/BillingScreen.js` | Direct calls to bill reminder schedulers. | Direct utility import. | Migrated to `notificationService`. |
| `src/utils/exportService.js` | Imports bill reminder helpers for restore. | Direct utility import. | Migrated to `notificationService`. |

---

## 3. Architecture & Channel Specification

### Android Notification Channels

Expo Notifications on Android requires notification channels for Android 8.0+ (API level 26+). `notificationService.ts` will declare and initialize the following typed channels on app startup:

```typescript
export const ANDROID_NOTIFICATION_CHANNELS: Record<string, AndroidNotificationChannel> = {
  BEHAVIOR_CUES: {
    id: 'kwestup_behavior_cues',
    name: 'Habit & Behavior Cues',
    description: 'Prompts, 2-minute action cues, and recovery interventions',
    importance: 4, // High: makes sound and appears as heads-up
    vibrationPattern: [0, 250, 250, 250],
  },
  DAILY_TASKS: {
    id: 'kwestup_daily_tasks',
    name: 'Daily Tasks & Reminders',
    description: 'Scheduled reminders for daily tasks and due dates',
    importance: 4, // High
    vibrationPattern: [0, 250, 250, 250],
  },
  BIRTHDAYS: {
    id: 'kwestup_birthdays',
    name: 'Birthdays & Celebrations',
    description: 'Annual birthday alerts and advance notifications',
    importance: 3, // Default: makes sound, no heads-up
  },
  BILLING: {
    id: 'kwestup_billing',
    name: 'Bills & Subscriptions',
    description: 'Due date alerts for recurring financial commitments',
    importance: 3, // Default
  },
  SYSTEM: {
    id: 'kwestup_system',
    name: 'System & Sync',
    description: 'Local network sync and backup alerts',
    importance: 2, // Low: no sound
  },
};
```

---

## 4. Deterministic Behavioral Policy Engine

### Core Invariants from `rulebook/rules/reminders.md`

1. **Quiet Hours (`[22:00, 08:00)` Wall-Clock):**
   - No non-critical notification may fire between 22:00 and 08:00 local time.
   - Any notification scheduled in this window is automatically deferred to `08:01` on the morning quiet hours end.
   - Uses device-local wall-clock time (`dateUtils.js`), NOT UTC, ensuring stability across DST transitions.
2. **Daily Cap (Max 3/Day):**
   - Maximum 3 push notifications per calendar day across all behavioral cues and habits.
   - Critical task due dates can specify `category: 'critical'` to bypass this behavioral cap.
3. **Minimum Notification Gap (90 Minutes):**
   - Minimum 90 minutes between consecutive behavioral notifications.
   - If a new cue is scheduled within 90 minutes of the previous dispatch, it is deferred to `lastDispatch + 90m`.
4. **Deduplication Window (30 Minutes):**
   - Identical payloads (matching `payloadKey` or entity ID) within 30 minutes are suppressed.
5. **User Opt-Out:**
   - When `policy.userOptOut === true`, all non-critical notifications are suppressed immediately.

### Dispatch History Schema

Stored in `AsyncStorage` under key `kwestup_notification_history_v1`:
```typescript
interface NotificationHistoryEntry {
  id: string;
  category: 'behavior' | 'task' | 'birthday' | 'billing';
  timestamp: string; // ISO local datetime string
  payloadKey?: string;
}
```
Entries older than 48 hours are automatically purged on evaluation to bound storage usage.

---

## 5. PII Redaction & Privacy Invariants

Per `rulebook/rules/privacy.md` §Logger Redaction & Forensic Buffer Boundary:
- `logger.js` must NEVER log habit titles, reminder cues, recipient names, or financial amounts.
- `SENSITIVE_KEYS` regex in `logger.js` must be updated from:
  ```javascript
  /(content|body|note|title|text|message|passphrase|token|key|secret|password)/i
  ```
  to:
  ```javascript
  /(content|body|note|title|text|message|passphrase|token|key|secret|password|habitTitle|cueText)/i
  ```
- All log statements in `notificationService.ts` must pass safe anonymized metadata only:
  ```typescript
  logger.info('Notification scheduled', { channelId, notificationId, triggerHour, triggerMinute });
  ```

---

## 6. Testing & Quality Gate Plan

1. **Mock Additions in `__tests__/setup/jest.setup.js`:**
   - Mock `Notifications.setNotificationChannelAsync` (resolving undefined).
   - Mock `Notifications.deleteNotificationChannelAsync`.
   - Mock `Notifications.getNotificationChannelsAsync`.
   - Mock `Notifications.AndroidImportance` enum (`{ NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 }`).
2. **Dedicated Unit Tests (`__tests__/unit/notificationService.test.ts`):**
   - Test channel setup and Android platform branching.
   - Test permission requests (granted vs denied).
   - Test pure policy evaluations:
     - Quiet hours detection (e.g. 23:30 -> defer to 08:01 next morning; 03:00 -> defer to 08:01 same morning).
     - Daily cap limiting (1st, 2nd, 3rd allowed; 4th rejected).
     - 90-minute gap enforcement.
     - 30-minute deduplication rejection.
     - User opt-out rejection.
   - Test scheduling for tasks, birthdays (including leap year Feb 29), and recurring bills.
   - Test cancellation routines.
   - Test PII redaction in logger calls.

---

## 7. Plan Slicing Recommendation

- **Plan 22-01 (Core Service & Engine):**
  - Implement `src/services/notificationService.ts` with Android channels, permissions, and `evaluateNotificationPolicy` logic.
  - Implement `AsyncStorage` dispatch history management.
  - Update `__tests__/setup/jest.setup.js` with notification channel mocks.
  - Write comprehensive unit tests in `__tests__/unit/notificationService.test.ts`.
- **Plan 22-02 (Caller Migration & Polish):**
  - Refactor `src/utils/notifications.js` and `src/utils/billingNotifications.js` into thin wrappers forwarding to `notificationService.ts` (eliminating raw `console.error` calls).
  - Migrate callers in `src/context/` (`TaskContext.js`, `BirthdayContext.js`), `src/screens/` (`DailyTasksScreen.js`, `BirthdaysScreen.js`, `BillingScreen.js`), `src/navigation/AppNavigator.js`, and `src/utils/exportService.js`.
  - Extend `SENSITIVE_KEYS` in `src/utils/logger.js` to include `habitTitle|cueText`.
  - Validate with `npm run typecheck`, `npm run lint` (0 errors), and `npm test` (100% pass).
