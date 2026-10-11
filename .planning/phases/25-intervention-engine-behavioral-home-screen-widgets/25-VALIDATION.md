# Phase 25 Validation: Intervention Engine & Behavioral Home-Screen Widgets

**Phase:** 25 of 28 (Milestone 3: KwestUp 4.0 — Atomic Behavior Engine)  
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
- **TypeScript Static Verification**: `npm run typecheck` (`tsc --noEmit`) passes with 0 errors across all files in `src/` AND `widgets/` (with `widgets/**/*` included in `tsconfig.json`).
- **ESLint Code Quality**: `npm run lint` (`eslint .`) passes with 0 errors. All new modules adhere to zero raw `console.*` rules, routing through `src/utils/logger.js`.
- **Jest Test Suite**: Dedicated unit test suites `__tests__/unit/interventionEngine.test.ts` and `__tests__/unit/behavioralWidget.test.ts` pass 100%, and the full regression suite passes 100% (20+ suites, 310+ tests).

---

## 2. Test Cases & Verification Matrix

| Test Case | Component / File | Expected Behavior |
|---|---|---|
| **TC-INTV-01** | `interventionEngine.ts` Anti-Spam Gate | `REMINDER_ANTI_SPAM_001`: When $\ge 3$ behavioral notifications have occurred today, blocks notification dispatch and redirects `targetSurface` to `'widget'`. |
| **TC-INTV-02** | `interventionEngine.ts` Anti-Spam Approval | When $< 3$ behavioral notifications have occurred today, allows notification dispatch if other policy rules pass. |
| **TC-INTV-03** | `interventionEngine.ts` Quiet Hours Deferral | `QUIET_HOURS_001`: When notification is triggered within the `[22:00, 08:00)` window, defers dispatch to morning shift target time `08:15` (next morning if $\ge 22:00$, same morning if $< 08:00$). |
| **TC-INTV-04** | `interventionEngine.ts` Quiet Hours Daytime | When notification is triggered during daytime ($08:15 \le t < 22:00$), does not defer. |
| **TC-INTV-05** | `interventionEngine.ts` Minimum Gap Throttle | `REMINDER_MIN_GAP_001`: When the elapsed time since the previous behavioral notification is $< 90$ minutes, throttles notification dispatch. |
| **TC-INTV-06** | `interventionEngine.ts` Minimum Gap Pass | When elapsed time since the previous behavioral notification is $\ge 90$ minutes, approves dispatch. |
| **TC-INTV-07** | `interventionEngine.ts` Rule Priority Precedence | When both anti-spam cap ($\ge 3$) and quiet hours match, anti-spam (priority 100) takes precedence over quiet hours (priority 95), redirecting to widget. |
| **TC-INTV-08** | `interventionEngine.ts` Audit Traces | Every arbitration decision produces an explicit `rulesApplied: string[]` list detailing applied rule IDs. |
| **TC-WIDG-01** | `interventionEngine.ts` Widget Priority Hierarchy | `WIDGET_PRIORITY_001`: Selects touchpoint in strict order: Recovery > Today Due > Next Action. |
| **TC-WIDG-02** | `interventionEngine.ts` Widget Recovery Mode | When any habit is in `status === 'recovery'`, returns Recovery touchpoint (`DON'T MISS TWICE`, `[ 2-MIN VERSION ]`). |
| **TC-WIDG-03** | `interventionEngine.ts` Widget Today Due Mode | When no habit is in recovery but a habit is due today and incomplete, returns Today Due touchpoint (`TODAY OBJECTIVE`, `[ COMPLETE ]`). |
| **TC-WIDG-04** | `interventionEngine.ts` Widget Next Action Mode | When all today-due habits are complete but active habits exist, returns Next Action touchpoint (`NEXT ACTION`, `[ START ]`). |
| **TC-WIDG-05** | `interventionEngine.ts` Widget Standby Mode | When all habits are completed, returns Standby touchpoint (`SYS_STANDBY`). |
| **TC-WIDG-06** | `tsconfig.json` Widget Typecheck Scope | Removing `widgets/**/*` from `exclude` and including in compilation produces 0 type errors. `ListWidget` and `TextWidget` excess `flex` props resolved. |
| **TC-WIDG-07** | `widget-task-handler.tsx` Headless Completion | When `COMPLETE_HABIT` is clicked, headless handler updates `kwestup_habits_v1` using `completeHabit`, appends to `kwestup_behavior_events_v1` (bounded at 500 FIFO), and emits `WIDGET_ACTION` / `HABIT_COMPLETED` domain events. |
| **TC-WIDG-08** | `HabitContext.js` Foreground Sync | Subscribes to `AppState` active events and re-hydrates `kwestup_habits_v1` and `kwestup_behavior_events_v1` from storage when returning from the home screen. |

---

## 3. Failure Mode & Boundary Considerations

1. **Midnight Rollover in Quiet Hours Deferral:**
   A trigger at `23:45` on October 11 must correctly advance the date component to October 12 at `08:15`. A trigger at `01:15` on October 12 must defer to October 12 at `08:15` (same calendar day). The deferral calculations must use local calendar dates from `src/utils/dateUtils.js`.
2. **Headless Storage Access Safety:**
   The headless widget task handler operates in a separate JavaScript runtime without React. It must interact only with `AsyncStorage`, using pure engines (`completeHabit`, `selectWidgetTouchpoint`) and avoid importing any React components, screens, or contexts.
3. **Event Buffer Boundedness in Headless Process:**
   When appending `HABIT_COMPLETED` behavior events to `kwestup_behavior_events_v1`, the headless handler must enforce the 500-item FIFO cap (`.slice(-MAX_PERSISTED_BEHAVIOR_EVENTS)`), mirroring `HabitContext.js`.
4. **Deterministic Testing:**
   All test cases must inject fixed `{ now, todayDate }` timestamps into pure engines, guaranteeing 100% deterministic assertion without relying on system wall clocks.
