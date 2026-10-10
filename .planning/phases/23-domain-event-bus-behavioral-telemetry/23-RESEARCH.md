# Phase 23 Research: Domain Event Bus & Behavioral Telemetry

**Phase:** 23 of 28 (Milestone 3: KwestUp 4.0 Core Technology Platform)  
**Requirements Addressed:** `EVT-01`  
**Domain:** In-Memory Event Bus, Behavioral Telemetry, Decoupled Domain Architecture, PII-Safe Event Payloads  
**Date:** 2026-10-10  

---

## 1. Executive Summary

Phase 23 establishes the decoupled event backbone of KwestUp 4.0: [`src/behavior/eventBus.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/behavior/eventBus.ts).

Prior to this phase, feature areas across KwestUp (tasks, billing, birthdays, focus timer, and Android widgets) operated as isolated silos with tight coupling or ad-hoc side effects (e.g. notifications scheduled directly inside button callbacks or context reducers). There was no uniform observation bus allowing the upcoming Atomic Habits behavioral rule engine (Phase 24), intervention engine (Phase 25), and on-device AI intent compiler (Phase 26-28) to observe domain state transitions without directly tangling with UI screens and React state trees.

### Core Objectives:
1. **In-Memory Type-Safe Event Bus (`EVT-01`):**
   - Implement `src/behavior/eventBus.ts` providing typed pub/sub (`subscribe`, `subscribeAll`, `emit`, `getRecentEvents`, `clearBuffer`, `clearListeners`).
   - Strongly typed events leveraging and expanding `BehaviorEventType` and `BehaviorEvent` from [`src/behavior/types.ts`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/behavior/types.ts).
   - Strict subscriber error isolation: a thrown error in one listener must never interrupt event delivery to other listeners, crash the emitter, or disrupt the domain mutator.
   - Unsubscribe tokens/callbacks returned from `subscribe` to enable leak-free React component lifecycles (`useEffect`).
   - Provide a React hook helper `useDomainEvent` for declarative subscriptions.
   - In-memory circular telemetry buffer (ring buffer of recent 100 events) for forensic diagnostics, behavioral review, and auditing.
2. **Domain Mutation Instrumentation (`EVT-01`):**
   - Instrument state transitions across all 5 key domain areas:
     - **Tasks:** `TASK_CREATED`, `TASK_UPDATED`, `TASK_COMPLETED`, `TASK_DELETED` in [`TaskContext.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/context/TaskContext.js) and [`DailyTasksScreen.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/screens/DailyTasksScreen.js).
     - **Billing:** `BILL_CREATED`, `BILL_PAID`, `BILL_DELETED`, `BILL_UPDATED` in [`BillingContext.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/context/BillingContext.js) and [`BillingScreen.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/screens/BillingScreen.js).
     - **Birthdays:** `BIRTHDAY_CREATED`, `BIRTHDAY_UPDATED`, `BIRTHDAY_DELETED` in [`BirthdayContext.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/context/BirthdayContext.js).
     - **Focus Timer:** `FOCUS_STARTED`, `FOCUS_COMPLETED` in [`App.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/App.js) and [`FocusTimerScreen.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/screens/FocusTimerScreen.js).
     - **Widgets:** `WIDGET_ACTION` / `TASK_COMPLETED` in [`widgets/widget-task-handler.tsx`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/widgets/widget-task-handler.tsx).
3. **Observability & Code Quality Standards:**
   - Zero raw `console.log` / `console.warn` / `console.error` calls: eliminate raw console statements in `BillingContext.js` and `widget-task-handler.tsx`, routing all logging through [`src/utils/logger.js`](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/src/utils/logger.js).
   - Full TypeScript safety for `src/behavior/` (`strict: true`), clean Jest test suites, and 0 lint or typecheck regressions.

---

## 2. Event Contract & Schema Design

### Alignment with Existing `src/behavior/types.ts`
The repository already contains baseline definitions in `src/behavior/types.ts`:
```typescript
export type BehaviorEventType =
  | 'TASK_CREATED'
  | 'TASK_MISSED'
  | 'TASK_COMPLETED'
  | 'HABIT_COMPLETED'
  | 'HABIT_MISSED'
  | 'REMINDER_DISMISSED'
  | 'REMINDER_IGNORED'
  | 'WIDGET_ACTION'
  | 'FOCUS_COMPLETED'
  | 'CHECK_IN_COMPLETED'
  | 'HABIT_CREATED'
  | 'HABIT_UPDATED'
  | 'RECOVERY_STARTED';

export interface BehaviorEvent {
  id: string;
  type: BehaviorEventType;
  entityId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  source: 'app' | 'widget' | 'notification' | 'system';
}
```

### Expanded Domain Event Types
To support full domain mutation coverage as mandated by requirement `[EVT-01]`, `BehaviorEventType` will be expanded to encompass all domain lifecycle events:
```typescript
export type BehaviorEventType =
  // Task lifecycle
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'TASK_DELETED'
  | 'TASK_MISSED'
  // Billing lifecycle
  | 'BILL_CREATED'
  | 'BILL_PAID'
  | 'BILL_UPDATED'
  | 'BILL_DELETED'
  // Birthday lifecycle
  | 'BIRTHDAY_CREATED'
  | 'BIRTHDAY_UPDATED'
  | 'BIRTHDAY_DELETED'
  // Focus Timer lifecycle
  | 'FOCUS_STARTED'
  | 'FOCUS_COMPLETED'
  // Home-screen Widget lifecycle
  | 'WIDGET_ACTION'
  // Habit & Behavioral lifecycle (Phase 24 readiness)
  | 'HABIT_CREATED'
  | 'HABIT_UPDATED'
  | 'HABIT_COMPLETED'
  | 'HABIT_MISSED'
  | 'RECOVERY_STARTED'
  | 'REMINDER_DISMISSED'
  | 'REMINDER_IGNORED'
  | 'CHECK_IN_COMPLETED';

export type DomainEventType = BehaviorEventType;

export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  id: string;
  type: T;
  entityId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source: 'app' | 'widget' | 'notification' | 'system';
}
```

### Event Payload Contracts
Each domain event carries typed metadata / payload fields:
1. `TASK_CREATED`: `{ id, title, listId, isDaily, dueDate, recurrence }`
2. `TASK_UPDATED`: `{ id, updates, isDaily }`
3. `TASK_COMPLETED`: `{ id, completed: true, recurrence, nextDueDate, streak, isDaily }`
4. `TASK_DELETED`: `{ id, isDaily, listId }`
5. `BILL_CREATED`: `{ id, amount, category, dueDate, recurrence }`
6. `BILL_PAID`: `{ id, paidDate, amount, category }`
7. `BILL_UPDATED`: `{ id, updates }`
8. `BILL_DELETED`: `{ id }`
9. `BIRTHDAY_CREATED`: `{ id, name, date }`
10. `BIRTHDAY_UPDATED`: `{ id, updates }`
11. `BIRTHDAY_DELETED`: `{ id }`
12. `FOCUS_STARTED`: `{ sessionId, durationMinutes, remainingSeconds }`
13. `FOCUS_COMPLETED`: `{ sessionId, durationMinutes, completedAt }`
14. `WIDGET_ACTION`: `{ widgetName, actionType, taskId, tab }`

---

## 3. Event Bus Architecture (`src/behavior/eventBus.ts`)

### Key Design Pillars
1. **In-Memory Singleton:** Pure runtime memory execution. No network requests, zero cloud synchronization, zero blocking I/O on critical mutation paths.
2. **Error Isolation (Fault Tolerance):** Every subscriber callback is executed inside a guarded boundary (`try / catch` for synchronous listeners; `.catch()` for promises). If listener `L1` throws, listener `L2` still executes, and the error is logged via `logger.error` with structured details.
3. **Defensive Immutability:** Events emitted to subscribers are deep-frozen (`Object.freeze`) or defensively shallow-copied so no subscriber can mutate an event in flight and corrupt data for other subscribers.
4. **Subscription Cleanup:** `subscribe()` and `subscribeAll()` return an idempotent unsubscription function `() => void`.
5. **Telemetry Buffer:** A fixed-capacity circular ring buffer (default 100 events) stores recent events in memory for audit logging, diagnostics, and Phase 24 behavioral rule evaluation.
6. **Zero External Dependencies:** Implemented in pure TypeScript using ES standard data structures (`Map<DomainEventType, Set<Listener>>`, `Set<Listener>`).

### Conceptual API Surface
```typescript
export interface DomainEventBus {
  subscribe<T extends DomainEventType>(
    type: T,
    listener: (event: DomainEvent<T>) => void | Promise<void>
  ): () => void;

  subscribeAll(
    listener: (event: DomainEvent) => void | Promise<void>
  ): () => void;

  emit<T extends DomainEventType>(
    eventInput: Omit<DomainEvent<T>, 'id' | 'timestamp'> & {
      id?: string;
      timestamp?: string;
    }
  ): DomainEvent<T>;

  getRecentEvents(limit?: number): DomainEvent[];

  clearBuffer(): void;

  clearListeners(): void;

  listenerCount(type?: DomainEventType): number;
}
```

---

## 4. Call Site Mutation Analysis

| Domain / File | State Transition Function | Emitted Event | Source |
|---|---|---|---|
| `src/context/TaskContext.js` | `handleSaveTask` (new task) | `TASK_CREATED` | `'app'` |
| `src/context/TaskContext.js` | `handleSaveTask` (existing task) | `TASK_UPDATED` | `'app'` |
| `src/context/TaskContext.js` | `handleCompleteTask`, `toggleTaskComplete` | `TASK_COMPLETED` (or `TASK_UPDATED` if untoggled) | `'app'` |
| `src/context/TaskContext.js` | `deleteTask` | `TASK_DELETED` | `'app'` |
| `src/screens/DailyTasksScreen.js` | `addDailyTask` | `TASK_CREATED` | `'app'` |
| `src/screens/DailyTasksScreen.js` | `toggleDailyTaskComplete` | `TASK_COMPLETED` / `TASK_UPDATED` | `'app'` |
| `src/screens/DailyTasksScreen.js` | `deleteDailyTask` | `TASK_DELETED` | `'app'` |
| `src/context/BillingContext.js` | `addRecurringBillAction` | `BILL_CREATED` | `'app'` |
| `src/context/BillingContext.js` | `deleteRecurringBillAction` | `BILL_DELETED` | `'app'` |
| `src/screens/BillingScreen.js` | `saveMarkBillPaid` / payment toggle | `BILL_PAID` | `'app'` |
| `src/screens/BillingScreen.js` | `saveAddBill` | `BILL_CREATED` | `'app'` |
| `src/screens/BillingScreen.js` | `saveDeleteBill` | `BILL_DELETED` | `'app'` |
| `src/context/BirthdayContext.js` | `handleSaveBirthday` | `BIRTHDAY_CREATED` / `BIRTHDAY_UPDATED` | `'app'` |
| `src/context/BirthdayContext.js` | `handleDeleteBirthday` | `BIRTHDAY_DELETED` | `'app'` |
| `App.js` | timer tick reaches 0 (`timerRemaining === 0`) | `FOCUS_COMPLETED` | `'app'` |
| `src/screens/FocusTimerScreen.js` | `startTimer` | `FOCUS_STARTED` | `'app'` |
| `widgets/widget-task-handler.tsx`| `props.widgetAction === 'WIDGET_CLICK'` | `WIDGET_ACTION` / `TASK_COMPLETED` | `'widget'` |

---

## 5. Architectural & Security Risk Analysis

1. **Memory Growth & Leak Risk:**
   - Unbounded listener registrations: Components registering listeners without unregistering on unmount could cause memory leaks.
   - *Mitigation:* `useDomainEvent` hook handles cleanup in `useEffect`. `subscribe` returns a direct unsubscription closure. `clearListeners()` allows reset.
   - Telemetry buffer overflow:
   - *Mitigation:* Ring buffer has a hard cap (max 100 items), dropping oldest events once full.
2. **Re-entrancy & Infinite Event Loops:**
   - A listener for `TASK_COMPLETED` might trigger another task mutation, emitting another event.
   - *Mitigation:* In-memory dispatcher executes current listener set snapshot, avoiding iteration over a mutating set. Listeners should be asynchronous or decoupled from direct state writes.
3. **PII and Data Exposure via Telemetry:**
   - Payloads in `DomainEvent` could contain sensitive titles, names, notes, or amounts.
   - *Mitigation:* `logger.js` redaction engine already protects sensitive keys (`habitTitle|cueText|title|notes`). Event logging uses `logger.debug` with entity IDs and event types, avoiding plain logging of private user data.
4. **Android Widget Background Execution (Binder Limits):**
   - The headless widget task handler runs in Android background service contexts.
   - *Mitigation:* `widgetTaskHandler` emits lightweight events without keeping long-lived in-memory objects in the Android process.
