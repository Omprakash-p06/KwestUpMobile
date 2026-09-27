# Phase 15: Centralized Local Date Engine & Timezone Bug Fixes - Research

**Date:** 2026-09-27  
**Target:** React Native 0.79.5 / Expo 53 / React 19 / Node 20  
**Requirements:** DATE-01, DATE-02  

---

## 1. Executive Summary

In multiple locations across KwestUp Mobile, the application extracts calendar dates using `new Date().toISOString().slice(0, 10)`. The ISO 8601 specification dictates that `.toISOString()` serializes timestamps in **Coordinated Universal Time (UTC)**.

Because calendar date concepts (such as "Today's Tasks", "Yesterday's completion for streak continuity", "Billing transaction date", and "Contact birthdays") are experienced strictly within the user's **device-local timezone**, using UTC date slicing causes severe silent bugs:
1. **Positive UTC Offsets (e.g. India UTC+5:30, Japan UTC+9, Australia UTC+10):**
   - Early morning (e.g. 1:00 AM IST) corresponds to the previous calendar day in UTC (7:30 PM UTC).
   - `new Date().toISOString().slice(0, 10)` yields yesterday's calendar date.
   - Tasks scheduled for "today" fail to reset, streaks are marked broken or fail to increment, and new tasks receive yesterday's completion stamp.
2. **Negative UTC Offsets (e.g. New York UTC-5, Los Angeles UTC-8, Hawaii UTC-10):**
   - Late evening (e.g. 9:00 PM EST) corresponds to the next calendar day in UTC (2:00 AM UTC next day).
   - Slicing yields tomorrow's calendar date, causing premature daily task rollover and out-of-order transaction records.
3. **UTC Date String Parsing Trap (`new Date('YYYY-MM-DD')`):**
   - The ECMAScript specification mandates that date-only strings without time components (e.g. `'2026-04-01'`) are parsed as UTC midnight (`2026-04-01T00:00:00.000Z`).
   - In any negative timezone (e.g. UTC-5), `new Date('2026-04-01').getDate()` evaluates to `31` (March 31 at 19:00 local time).
   - This causes visual dashboard charts and streak verifiers to shift data back by an entire day.

Phase 15 builds a rock-solid, zero-dependency `src/utils/dateUtils.js` module, creates comprehensive unit tests covering timezone shifts and boundary conditions, and systematically refactors all callsites.

---

## 2. Callsite Inventory & Impact Analysis

| File | Line | Current Fragile Pattern | Intended Behavior |
|------|------|-------------------------|-------------------|
| `App.js` | 275 | `const todayStr = new Date().toISOString().slice(0, 10);` | Check if daily tasks reset on the current local day |
| `App.js` | 278 | `const yesterdayStr = yesterday.toISOString().slice(0, 10);` | Check if last completed day was local yesterday for streak calculation |
| `App.js` | 376 | `const todayKey = new Date().toISOString().slice(0, 10);` | Rate-limit birthday notification rescheduling to once per local day |
| `App.js` | 759 | `completedDate: newCompletedStatus ? new Date().toISOString().slice(0, 10) : null` | Record local date of non-recurring task completion |
| `App.js` | 800 | `completedDate: now.slice(0, 10)` | Record local date of task completion in `handleCompleteTask` |
| `src/screens/DailyTasksScreen.js` | 27 | `const today = new Date().toISOString().slice(0, 10);` | Set current local day context for daily task list |
| `src/screens/DailyTasksScreen.js` | 78 | `const yesterdayStr = yesterday.toISOString().slice(0, 10);` | Check streak continuity against local yesterday |
| `src/screens/BillingScreen.js` | 152 | `date: txDate.toISOString().slice(0, 10)` | Record local transaction date for expense/income item |
| `src/screens/BillingScreen.js` | 228 | `const paidDate = new Date().toISOString().slice(0, 10);` | Record local payment date when recurring bill is marked paid |
| `src/screens/BillingScreen.js` | 587 | `DATE: {txDate.toISOString().slice(0, 10)}` | Display local transaction date in UI modal button |
| `src/screens/SearchScreen.js` | 61 | `const today = new Date().toISOString().slice(0, 10);` | Toggle daily task completion and streak stamp in search view |
| `src/navigation/AppNavigator.js` | 126 | `date: new Date().toISOString().slice(0, 10)` | Save local date for AI-generated financial transactions |
| `widgets/widget-task-handler.tsx` | 130 | `completedDate: nextCompletedState ? now.slice(0, 10) : undefined` | Record local completion date from Android home-screen widget |
| `src/utils/aiService.js` | 430 | `let dateStr = new Date().toISOString().slice(5, 10);` | Default month-day for natural language birthday parsing |
| `src/screens/DashboardScreen.js` | 25 | `new Date(date).toDateString() === dayStr` | Compare completed dates in 7-day activity chart |
| `__tests__/phase12-widget-logic.test.js` | 22 | `completedDate: nextCompletedState ? now.slice(0, 10) : undefined` | Test helper replicating widget completion logic |

---

## 3. Date Engine API Specification (`src/utils/dateUtils.js`)

The centralized utility must provide pure, high-performance, and fail-safe functions that operate directly on local calendar numbers (`getFullYear()`, `getMonth()`, `getDate()`) without relying on heavy external libraries like Moment.js or date-fns.

### API Signatures:

1. `getLocalDateString(input = new Date()) -> string`
   - Returns `'YYYY-MM-DD'` representing the local calendar day.
   - Accepts Date instances, timestamp numbers, or ISO strings.
   - If input is already in `'YYYY-MM-DD'` format, validates and returns it directly.
   - Returns `''` on invalid input without throwing.

2. `getYesterdayLocalDateString(input = new Date()) -> string`
   - Returns `'YYYY-MM-DD'` for the local day immediately preceding `input`.

3. `getTomorrowLocalDateString(input = new Date()) -> string`
   - Returns `'YYYY-MM-DD'` for the local day immediately following `input`.

4. `getLocalMonthString(input = new Date()) -> string`
   - Returns `'YYYY-MM'` representing the local month.

5. `getLocalMonthDayString(input = new Date()) -> string`
   - Returns `'MM-DD'` representing the local month and day (ideal for birthdays).

6. `parseLocalDate(dateStr) -> Date`
   - Parses `'YYYY-MM-DD'` into a local Date instance set to local midnight (`00:00:00.000`).
   - Uses `new Date(year, month - 1, day, 0, 0, 0, 0)` so negative UTC offsets cannot shift the calendar date backward.

7. `isSameLocalDay(d1, d2) -> boolean`
   - Compares two dates, timestamps, or date strings to check if they fall on the exact same local calendar day.

---

## 4. Boundary & Edge Case Analysis

1. **Midnight Rollover:**
   - 23:59:59.999 to 00:00:00.000 must cleanly transition to the next day string.
2. **Leap Years (e.g. 2024-02-29):**
   - `getYesterdayLocalDateString('2024-03-01')` must produce `'2024-02-29'`.
   - `getTomorrowLocalDateString('2024-02-28')` must produce `'2024-02-29'`.
   - `parseLocalDate('2024-02-29')` must yield a valid Date with month index 1 and day 29.
3. **Month Boundaries:**
   - Rollover from Jan 31 to Feb 1, Mar 31 to Apr 1, Dec 31 to Jan 1.
4. **Timezone Offset Differentials:**
   - Ensure a simulated UTC midnight timestamp (`2026-04-01T00:00:00.000Z`) correctly extracts local day components based on the local environment rather than UTC.

---

## 5. Verification Architecture

- **Unit Test Suite:** `__tests__/unit/dateUtils.test.js`
- **Runner:** `npm test -- __tests__/unit/dateUtils.test.js`
- **Full Suite Verification:** `npm test` and `npm run lint`
- **Execution Time:** < 2 seconds
