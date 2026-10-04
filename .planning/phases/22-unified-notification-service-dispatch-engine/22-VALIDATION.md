# Phase 22 Validation: Unified Notification Service & Dispatch Engine

**Phase:** 22 of 28 (Milestone 3: KwestUp 4.0 Core Technology Platform)  
**Status:** In Planning  
**Validation Suites:** `npm run typecheck`, `npm run lint`, `npm test`  

---

## 1. Automated Validation Gates

### Test Execution Commands
```bash
npm run typecheck
npm run lint
npm test
```

### Gate Criteria
- **TypeScript Static Verification**: `npm run typecheck` (`tsc --noEmit`) passes with 0 errors across `src/services/notificationService.ts`, existing `src/` modules, and test files.
- **ESLint Code Quality**: `npm run lint` (`eslint .`) passes with 0 errors. Raw `console.error` calls in `billingNotifications.js` are eliminated.
- **Jest Test Suite**: Dedicated test suite `__tests__/unit/notificationService.test.ts` passes 100%, and full regression suite passes 100% (14+ suites, 195+ tests).

---

## 2. Test Cases & Verification Matrix

| Test Case | Component / File | Expected Behavior |
|---|---|---|
| **TC-NOTIF-01** | `notificationService.ts` Channels | Initializes typed Android notification channels (`kwestup_behavior_cues`, `kwestup_daily_tasks`, `kwestup_birthdays`, `kwestup_billing`, `kwestup_system`) with correct importance and vibration patterns. |
| **TC-NOTIF-02** | `notificationService.ts` Permissions | `requestNotificationPermissions` handles Android and iOS permission checks, alert dialogs on denial, and returns permission status. |
| **TC-NOTIF-03** | `evaluateNotificationPolicy` Quiet Hours | Detects notifications targeting `[22:00, 08:00)` wall-clock window and auto-defers dispatch to `08:01` next morning. |
| **TC-NOTIF-04** | `evaluateNotificationPolicy` Daily Cap | Enforces maximum 3 push notifications per calendar day for behavioral cues (`maxPerDay = 3`). Critical notifications bypass behavioral cap. |
| **TC-NOTIF-05** | `evaluateNotificationPolicy` Min Gap | Enforces minimum 90-minute separation between consecutive behavioral notifications (`minGapMinutes = 90`). |
| **TC-NOTIF-06** | `evaluateNotificationPolicy` Deduplication | Suppresses duplicate notifications targeting identical entity/payload within 30 minutes (`deduplicationWindowMinutes = 30`). |
| **TC-NOTIF-07** | `evaluateNotificationPolicy` User Opt-Out | When `policy.userOptOut === true`, non-critical behavioral dispatches are suppressed immediately. |
| **TC-NOTIF-08** | Task & Bill Schedulers | Schedules daily task reminders, due date reminders, and recurring bills with proper channels and error handling. |
| **TC-NOTIF-09** | Birthday Schedulers | Schedules annual birthday reminders (including advance reminders and Feb 29 leap-year edge cases) with proper cleanup on error. |
| **TC-NOTIF-10** | Cancellation Functions | `cancelNotification`, `cancelNotifications`, and `cancelAllNotifications` cleanly cancel scheduled notifications without throwing. |
| **TC-NOTIF-11** | Logger Redaction & Privacy | `SENSITIVE_KEYS` in `logger.js` includes `habitTitle|cueText`. Logger calls inside `notificationService.ts` log zero PII (no habit titles, contact names, or currency amounts). |
| **TC-NOTIF-12** | Caller Migration & Legacy Wrappers | `src/utils/notifications.js` and `src/utils/billingNotifications.js` forward cleanly to `notificationService.ts`. Direct callers in contexts, screens, and navigation updated. |
| **TC-NOTIF-13** | Regression Suite | All existing test suites pass 100% with zero regressions. |

---

## 3. Failure Mode & Boundary Considerations

1. **Midnight Boundary & Daylight Saving Time (DST):**
   Quiet hours span across midnight (`22:00` to `08:00`). Calculations must compute minute-of-day offsets correctly and anchor to device-local wall-clock time (`dateUtils.js`) rather than UTC instants to remain invariant during DST transitions.
2. **Double Notification Scheduling on Rapid State Changes:**
   When tasks or birthdays are edited rapidly, callers must cancel previous notification IDs before scheduling new ones, and the deduplication window must suppress near-simultaneous duplicate payloads.
3. **Storage History Bounds:**
   Dispatch history tracked in `AsyncStorage` (`kwestup_notification_history_v1`) must automatically prune entries older than 48 hours to avoid unbounded storage growth.
