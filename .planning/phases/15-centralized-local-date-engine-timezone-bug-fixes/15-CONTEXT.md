# Phase 15: Centralized Local Date Engine & Timezone Bug Fixes - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate all UTC date slicing bugs across the codebase by creating a centralized `src/utils/dateUtils.js` module. Replace every instance of `new Date().toISOString().slice(0, 10)` in `App.js`, `DailyTasksScreen.js`, `BillingScreen.js`, `SearchScreen.js`, `AppNavigator.js`, and `widgets/widget-task-handler.tsx` with timezone-aware local date calculations.

</domain>

<decisions>
## Implementation Decisions

### Centralized Date Utility Module
- **D-01:** Create `src/utils/dateUtils.js` as the single authoritative source of date/time calculation for calendar dates.
- **D-02:** Provide `getLocalDateString(date)` returning `YYYY-MM-DD` using `getFullYear()`, `getMonth() + 1`, and `getDate()` with zero-padding, strictly reflecting the user's local timezone.
- **D-03:** Provide `getYesterdayLocalDateString()`, `getTomorrowLocalDateString()`, and `isSameLocalDay(d1, d2)` helpers.
- **D-04:** Provide `parseLocalDate(dateStr)` that parses `YYYY-MM-DD` into a local Date at midnight local time (`new Date(year, month - 1, day)`), avoiding timezone shifts caused by `new Date('YYYY-MM-DD')` which evaluates as UTC.

### Call Site Refactoring
- **D-05:** Replace all 12+ fragile `toISOString().slice(0, 10)` callsites across `App.js`, `src/screens/DailyTasksScreen.js`, `src/screens/BillingScreen.js`, `src/screens/SearchScreen.js`, `src/navigation/AppNavigator.js`, and `widgets/widget-task-handler.tsx`.
- **D-06:** Ensure full timestamps (`createdAt`, `updatedAt`) remain ISO-8601 strings in UTC for persistence and synchronization, while all calendar day comparisons and day-bucket keys use `dateUtils`.

### Comprehensive Timezone Unit Tests
- **D-07:** Create `__tests__/unit/dateUtils.test.js` testing positive UTC offset (e.g., UTC+5:30 India), negative UTC offset (e.g., UTC-5 New York), month boundaries, leap years, and midnight transitions.

</decisions>

<canonical_refs>
## Canonical References

### Codebase Audits
- `.planning/codebase/CONCERNS.md` § Known Bugs — Details UTC-vs-local date handling for "today".
- `.planning/codebase/ARCHITECTURE.md` § Data Layer — App state lifecycle, rollover triggers, and widget synchronization.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Jest testing environment configured in Phase 14 (`npm test`).
- Test mocks in `__tests__/setup/jest.setup.js`.

### Callsites to Refactor
- `App.js`: lines 275, 278, 376, 759
- `src/screens/DailyTasksScreen.js`: lines 27, 78
- `src/screens/BillingScreen.js`: lines 152, 228, 587
- `src/screens/SearchScreen.js`: line 61
- `src/navigation/AppNavigator.js`: line 126
- `widgets/widget-task-handler.tsx`: line 130

</code_context>

<deferred>
## Deferred Ideas

- Integration with external timezone calendar APIs (e.g., Google Calendar sync).
- Custom recurring lunar or multi-calendar formats.

</deferred>

---

*Phase: 15-centralized-local-date-engine-timezone-bug-fixes*
*Context gathered: 2026-09-27*
