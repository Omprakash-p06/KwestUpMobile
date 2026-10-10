# Phase 23 Validation: Domain Event Bus & Behavioral Telemetry

**Phase:** 23 of 28 (Milestone 3: KwestUp 4.0 Core Technology Platform)  
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
- **TypeScript Static Verification**: `npm run typecheck` (`tsc --noEmit`) passes with 0 errors across `src/behavior/eventBus.ts`, `src/behavior/types.ts`, test files, and all project modules.
- **ESLint Code Quality**: `npm run lint` (`eslint .`) passes with 0 errors. All raw `console.log`, `console.warn`, and `console.error` calls in `BillingContext.js` and `widget-task-handler.tsx` are eliminated in favor of `src/utils/logger.js`.
- **Jest Test Suite**: Dedicated unit test suite `__tests__/unit/eventBus.test.ts` and domain instrumentation suite `__tests__/unit/domainEventInstrumentation.test.ts` pass 100%, and full regression suite passes 100% (15+ suites, 230+ tests).

---

## 2. Test Cases & Verification Matrix

| Test Case | Component / File | Expected Behavior |
|---|---|---|
| **TC-EVT-01** | `eventBus.ts` Subscription & Dispatch | `subscribe(type, fn)` registers a type-specific listener. `emit(event)` delivers typed event to matching listener with auto-generated `id`, `timestamp`, and `source`. |
| **TC-EVT-02** | `eventBus.ts` Wildcard Subscription | `subscribeAll(fn)` receives all emitted events regardless of event type. |
| **TC-EVT-03** | `eventBus.ts` Unsubscribe Cleanup | Invoking the function returned by `subscribe` or `subscribeAll` removes the listener so subsequent emissions do not invoke it. |
| **TC-EVT-04** | `eventBus.ts` Error Isolation (Synchronous) | If a subscriber throws an error, other subscribers still receive the event without disruption, the error is logged via `logger.error`, and `emit` does not throw. |
| **TC-EVT-05** | `eventBus.ts` Error Isolation (Asynchronous) | If an async subscriber rejects, the rejection is handled gracefully with `logger.error`, not causing an unhandled promise rejection. |
| **TC-EVT-06** | `eventBus.ts` Telemetry Ring Buffer | `getRecentEvents()` returns chronological history up to maximum capacity (100). When capacity is exceeded, oldest events are evicted (FIFO). `clearBuffer()` resets history. |
| **TC-EVT-07** | `eventBus.ts` Defensive Immutability | Emitted event payloads cannot be mutated by listeners to corrupt state for subsequent listeners or internal telemetry buffer. |
| **TC-EVT-08** | `eventBus.ts` React Hook `useDomainEvent` | Registers listener on mount, updates callback ref without resubscription, and cleanly unregisters on unmount. |
| **TC-EVT-09** | Task Domain Instrumentation | Creating, updating, completing, and deleting tasks via `TaskContext` and `DailyTasksScreen` emits `TASK_CREATED`, `TASK_UPDATED`, `TASK_COMPLETED`, and `TASK_DELETED` events to `eventBus`. |
| **TC-EVT-10** | Billing Domain Instrumentation | Creating, paying, and deleting bills via `BillingContext` and `BillingScreen` emits `BILL_CREATED`, `BILL_PAID`, and `BILL_DELETED` events to `eventBus`. |
| **TC-EVT-11** | Birthday Domain Instrumentation | Saving and deleting birthdays via `BirthdayContext` emits `BIRTHDAY_CREATED`, `BIRTHDAY_UPDATED`, and `BIRTHDAY_DELETED` events to `eventBus`. |
| **TC-EVT-12** | Focus Timer Domain Instrumentation | Starting and completing focus timer sessions via `FocusTimerScreen` and `App.js` emits `FOCUS_STARTED` and `FOCUS_COMPLETED` events to `eventBus`. |
| **TC-EVT-13** | Widget Domain Instrumentation | Headless widget clicks and task toggles in `widget-task-handler.tsx` emit `WIDGET_ACTION` and `TASK_COMPLETED` events to `eventBus`. |
| **TC-EVT-14** | Observability & Zero Raw Console | All console statements in `BillingContext.js` and `widget-task-handler.tsx` replaced with structured `logger.*` calls. Logger PII redaction remains 100% active. |
| **TC-EVT-15** | Regression Suite | All existing test suites pass 100% without regression (`npm test`). |

---

## 3. Failure Mode & Boundary Considerations

1. **Re-entrant Listener Dispatch:**
   If a listener calls `eventBus.emit()` during its execution, the event bus must handle the re-entrant emission safely without infinite loops or corrupting listener sets.
2. **Listener Unsubscribing During Dispatch:**
   If a listener unsubscribes itself or another listener while an emission is iterating, snapshot iteration (`Array.from` or copied array) ensures iteration safety without skipped or out-of-order listener calls.
3. **Async Storage & Persistence Isolation:**
   Phase 23 is strictly an in-memory event bus. It does not perform asynchronous AsyncStorage writes on every emitted event, preventing high-frequency bottlenecks and race conditions. Persistent event logging is isolated to Phase 24 (`kwestup_behavior_events_v1`).
4. **Test Harness Reset:**
   Tests must call `eventBus.clearListeners()` and `eventBus.clearBuffer()` in `beforeEach` to guarantee absolute isolation between test cases.
