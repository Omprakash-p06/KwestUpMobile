---
phase: 22
reviewers: [codex]
reviewed_at: 2026-10-05T00:00:00Z
plans_reviewed: [22-01-PLAN.md, 22-02-PLAN.md]
note: gemini lane dropped — Gemini CLI auth ineligible (UNSUPPORTED_CLIENT, free-tier client no longer supported); opencode lane skipped (self-review + missing jq prerequisite)
---

# Cross-AI Plan Review — Phase 22

## Codex Review

### Summary

The phase is well-scoped around real notification hotspots, but it has two material design gaps: the proposed numeric Android channel priorities are incompatible with the installed Expo enum, and the proposed policy engine cannot enforce dispatch-time limits for native repeating/future notifications as written. The migration inventory is mostly accurate, but bootstrap permission ownership and several error-path tests need tightening.

### Strengths

- The migration targets are grounded in real distributed calls: direct Expo scheduling remains in `App.js:703`, birthday cancellation bypasses the utility in `src/context/BirthdayContext.js:27`, and task, daily-task, billing, navigator, and import flows all use legacy schedulers.
- Keeping legacy utilities as adapters is a sensible compatibility path. Existing callers are numerous — for example, `src/context/TaskContext.js:198` persists generated notification IDs, while `src/utils/exportService.js:368` reschedules bills after import.
- The plan preserves important existing birthday behavior: the current implementation handles Feb 29 observance and cancels partial schedules on error in `src/utils/notifications.js:203` and `src/utils/notifications.js:254`.
- Using `getLocalDateString` for daily-cap calculation is appropriate: it explicitly derives a device-local `YYYY-MM-DD`, avoiding UTC date-boundary mistakes (`src/utils/dateUtils.js:14`).

### Concerns

- **HIGH — Channel priorities are numerically wrong for the installed Expo API.** The plan labels importance `4` as "high", `3` as "default", and `2` as "low", but Expo's actual enum is `LOW = 4`, `DEFAULT = 5`, `HIGH = 6`, and `NONE = 2` (`node_modules/expo-notifications/src/NotificationChannelManager.types.ts:21`). The project custom channel type also restricts values to `0 | 1 | 2 | 3 | 4` (`src/services/types.ts:7`), so it cannot represent Expo default/high correctly.
- **HIGH — NOTIF-02 cannot be enforced for native repeating or future schedules merely by checking policy when scheduling.** Daily tasks currently create native repeating calendar triggers (`src/utils/notifications.js:101`), while Expo's native scheduler handles daily triggers independently after scheduling (`node_modules/expo-notifications/src/NotificationScheduler.types.ts:47`). JavaScript will not run at each future firing to update AsyncStorage history, apply the daily cap, or enforce the 90-minute gap. The plan must define which reminders are "behavioral" and either schedule one-shot notifications through a rescheduler or explicitly exempt recurring task/birthday/bill reminders.
- **HIGH — The proposed public service API does not carry enough information to apply its own policy.** `evaluateNotificationPolicy` needs `payloadKey` and `category`, but planned `scheduleNotification(descriptor, policy)` does not expose them, and `ScheduledNotificationDescriptor` contains neither field (`src/services/types.ts:16`). This risks all callers defaulting to one category, losing deduplication identity, or silently bypassing behavioral policy.
- **MEDIUM — Permission requests are likely to be duplicated unless the App bootstrap call is explicitly removed.** Permissions are already requested from `App.js:491`, imported from the legacy utility at `App.js:53`. Plan 22-02 moves permission initialization to `AppNavigator`, but only calls out removing the Expo import and focus-timer call. It should explicitly remove or redirect this existing App-level request.
- **MEDIUM — The Jest mock plan omits an API required by the proposed cancellation surface.** The existing mock has individual cancellation but not `cancelAllScheduledNotificationsAsync` (`__tests__/setup/jest.setup.js:140`). Expo does export that API (`node_modules/expo-notifications/src/index.ts:34`). A `cancelAllNotifications()` implementation will either fail tests or be untested unless the mock is extended.
- **MEDIUM — Coercing malformed bill amounts to zero produces a false financial notification.** UI-created bills are already validated as positive numeric amounts (`src/screens/BillingScreen.js:195`), but imports can contain malformed values and are rescheduled directly (`src/utils/exportService.js:372`). Scheduling "₹0.00 due" avoids a throw but silently fabricates user-facing financial information; skip the reminder and emit safe metadata instead.
- **MEDIUM — Tests do not cover persistence and native-failure behavior.** The plan lists policy branches and scheduler happy paths but not invalid/corrupt history JSON, AsyncStorage read/write rejection, concurrent scheduling, native `scheduleNotificationAsync` rejection, or partial `cancelNotifications` failures. These are the paths most likely to compromise a "single authoritative" service.
- **LOW — Logger redaction deserves a direct regression assertion.** The existing sensitive-key regex is key-name based (`src/utils/logger.js:37`), and the current tests only prove fields such as `title`, `content`, and `token` (`__tests__/unit/logger.test.js:181`). Add explicit assertions for `habitTitle` and `cueText`.

### Suggestions

- Change channel contracts to use `Notifications.AndroidImportance` values (or an app-level symbolic priority mapped to those values), and test the actual enum values rather than raw integers.
- Define a `NotificationDispatchRequest` that includes `category`, `payloadKey`, recurrence semantics, and whether it is eligible for behavioral policy. Make `scheduleNotification` accept this request, rather than trying to infer it from a generic descriptor.
- Decide enforcement semantics explicitly:
  - one-shot behavioral cues: evaluate, schedule, then atomically persist history after native scheduling succeeds;
  - recurring reminders: either keep them outside behavioral caps or replace repeat triggers with a one-shot next-occurrence scheduler plus rescheduling logic.
- Move channel initialization and permission requesting to one bootstrap owner, then remove the existing `App.js:491` call.
- Extend the Expo mock with `cancelAllScheduledNotificationsAsync`, simulate channel failures, and reset all mocks/storage between tests.
- On invalid imported bill data, return `null` and log only a safe bill identifier/reason; do not replace the amount with zero.

### Risk Assessment

**HIGH.** The migration can centralize mechanics successfully, but without correcting priority mappings and defining enforceable semantics for native repeating/future notifications, it does not reliably meet NOTIF-01's priority requirement or NOTIF-02's hard behavioral-policy guarantee.

---

## Consensus Summary

Single grounded reviewer (Codex; Gemini lane dropped for dead CLI auth, OpenCode skipped as self-review). All findings below are Codex's, verified against source with `file:line` evidence.

### Agreed Concerns (by severity — feed into planning first)

1. **Channel importance values wrong (HIGH):** plan uses 4/3/2 for high/default/low; installed Expo enum is LOW=4, DEFAULT=5, HIGH=6, NONE=2, and `src/services/types.ts:7` caps at 4. Fix the contract before 22-01 implementation.
2. **Policy unenforceable for native repeating/future schedules (HIGH):** schedule-time checks cannot cap or gap-limit firings that Expo delivers natively. Scope behavioral policy to one-shot cues or add a rescheduler design.
3. **Descriptor lacks policy routing fields (HIGH):** `scheduleNotification(descriptor, policy)` exposes neither `category` nor `payloadKey`; `ScheduledNotificationDescriptor` has neither. Add an explicit dispatch-request type.
4. **Duplicate permission bootstrap (MEDIUM):** `App.js:491` already requests permissions; 22-02 must remove/redirect it when moving init to AppNavigator.
5. **Mock gap for cancel-all (MEDIUM):** extend jest.setup.js mock with `cancelAllScheduledNotificationsAsync`.
6. **Zero-amount fabrication on bad import data (MEDIUM):** skip + log instead of scheduling "₹0.00 due".
7. **Missing persistence/failure tests (MEDIUM):** corrupt history JSON, AsyncStorage rejection, native scheduling rejection, partial-cancel failures.
8. **Logger redaction assertion (LOW):** explicit `habitTitle`/`cueText` assertions in logger tests.

### Divergent Views

None — single reviewer. Recommend a second pass (e.g. functional `/gsd-plan-phase 22 --reviews` incorporation + human check of the three HIGH items) before execution.
