# Phase 15 Code Review

**Reviewed:** 2026-09-27 | **Depth:** standard | **Files Reviewed:** 11 | **Status:** issues_found

## Scope (files + lines changed)

Centralized local-date engine + migration of all UTC-slicing callsites:

1. `src/utils/dateUtils.js` (NEW, ~160 lines) — `getLocalDateString`, `parseLocalDate`, `getYesterdayLocalDateString`, `getTomorrowLocalDateString`, `getLocalMonthString`, `getLocalMonthDayString`, `isSameLocalDay`
2. `__tests__/unit/dateUtils.test.js` (NEW, ~180 lines, 27 tests)
3. `App.js` — rollover (L276-277), birthday reschedule key (L375), `handleToggleTaskCompletion` (L758), `handleCompleteTask` (L799); import L65
4. `src/screens/DailyTasksScreen.js` — today filter (L28), streak continuity (L77); import L12
5. `src/screens/BillingScreen.js` — tx stamp (L152), paid stamp (L228), picker label (L587), `toMonthStr` (L49); import L30
6. `src/screens/SearchScreen.js` — toggle stamp (L62); import L9
7. `src/navigation/AppNavigator.js` — AI tx stamp (L127); import L20
8. `widgets/widget-task-handler.tsx` — widget stamp (L131); import L10
9. `src/utils/aiService.js` — birthday fallback (L431); import L12
10. `src/screens/DashboardScreen.js` — 7-day chart via `isSameLocalDay` (L26); import L8
11. `__tests__/phase12-widget-logic.test.js` — helper updated (L24)

Verified: zero remaining `toISOString().slice(0, 10)` / `.split`-based date slicing / `toDateString()` comparisons in source. Full-ISO `toISOString()` retained only for true timestamps (`createdAt`, `completedAt`, `dueDate`) — correct.

## Findings

### [Warning] src/utils/dateUtils.js:59 — parseLocalDate silently returns today on invalid input
`if (!dateStr) return new Date();` and the line-77 fallback `isNaN(...) ? new Date() : fallback` mean `parseLocalDate(null/undefined/''/'random-junk')` returns *today's date* — a plausible, wrong answer that masks caller bugs (e.g. a missing `completedDate` silently becomes "today"). A parser should return an Invalid Date (or throw) on garbage, never fabricate today.
**Recommendation:** `if (!dateStr) return new Date(NaN);` and `return isNaN(fallback.getTime()) ? new Date(NaN) : fallback;` Callers must handle invalid explicitly.

### [Warning] src/utils/dateUtils.js:67-74 — parseLocalDate has no calendar-validity check, rolls over
Unlike `getLocalDateString` (which round-trip-validates via lines 26-34), `parseLocalDate('2023-02-29')` yields `new Date(2023, 1, 29)` = **Mar 1**, and month 13 / day 99 roll over silently. Worse, ISO datetimes like `'2026-09-27T23:30:00.000Z'` split into 3 `-` parts where `parseInt('27T23:30:00.000Z')` → `27`, silently truncating the time portion.
**Recommendation:** mirror the round-trip guard from `getLocalDateString`; only accept strict `YYYY-MM-DD` (regex + component round-trip), return Invalid Date otherwise.

### [Warning] src/utils/dateUtils.js:92,109,145 — falsy epoch 0 mishandled
`getYesterdayLocalDateString` / `getTomorrowLocalDateString` use `(input ? new Date(input) : new Date())`, so timestamp `0` (1970-01-01, falsy) computes relative to *today* instead of epoch — while `getLocalDateString(0)` correctly returns the epoch date. Same class: `isSameLocalDay` starts with `if (!d1 || !d2) return false`, so `isSameLocalDay(0, 0)` (same day!) returns `false`.
**Recommendation:** test nullability explicitly: `if (d1 === null || d1 === undefined || d1 === '') return false;` and `input === null || input === undefined || input === '' ? new Date() : ...`.

### [Warning] src/screens/BillingScreen.js:124 — unguarded t.date.startsWith crashes on missing date
`transactions.filter((t) => { if (!t.date.startsWith(viewMonth)) ... })` throws `TypeError` when any transaction has `null`/`undefined` date (legacy data, failed import). Migration makes `''` possible too (`''` is safe, `null` is not). Similarly `formatMonthLabel('')` (L51-55) would throw `RangeError` on an Invalid Date if `viewMonth` ever degrades to `''`.
**Recommendation:** `if (!(t.date || '').startsWith(viewMonth)) return false;`

### [Warning] src/screens/SearchScreen.js:61-75 — toggle skips streak/totalCompleted bookkeeping
`handleToggleDailyTask` sets `completed/completedDate/lastCompletedDate` but never touches `streak` or `totalCompleted`, while `DailyTasksScreen.toggleDailyTaskComplete` (L66-104) maintains both. Completing/uncompleting the same task from Search vs Daily screens diverges streak state — a cross-screen state inconsistency introduced alongside (not caused by) this migration.
**Recommendation:** extract a shared `toggleDailyTask(tasks, id, today)` helper (or reuse one implementation) so both screens share streak logic.

### [Warning] src/screens/DashboardScreen.js:46-69 — computeBirthdayDaysRemaining left hand-rolled, NaN-prone
This function was not migrated: raw `dateStr.split('-')` + unchecked `parseInt` means a malformed `birthDate` (`''`, `'junk'`, `'2026-13-40'`) yields `NaN` month/day → Invalid `nextBday` → `daysRemaining: NaN`, which poisons `.sort()` (NaN comparator) and silently drops the entry (`NaN <= 30` is false). Also Feb-29 handling (L62: `day + 1` → Mar 1 in non-leap years) is an undocumented product choice sitting in untested code.
**Recommendation:** validate parts (regex + round-trip) and return a sentinel (`daysRemaining: 999`, matching the existing L58 pattern) on invalid input; route parsing through `parseLocalDate` where possible.

### [Info] src/screens/DailyTasksScreen.js:28 — today snapshot goes stale past midnight
`const today = getLocalDateString()` is captured once per render; a session left open across midnight stamps completions with yesterday's date until next render. Pre-existing pattern, low impact (App.js rollover corrects on reload).
**Recommendation:** compute inside the toggle handler (`getLocalDateString()` at call time) instead of closing over render-time value. Same note applies to `SearchScreen.js:62` (already call-time — good).

### [Info] widgets/widget-task-handler.tsx:131 — undefined vs null completedDate inconsistency
Widget writes `completedDate: ... : undefined` (key dropped by `JSON.stringify`), App.js writes `null`. Interface allows both (`string | null`, L33). All readers use falsy checks so behavior is identical today, but storage shape differs by writer.
**Recommendation:** standardize on `null` in the widget handler to match App.js/SearchScreen.

### [Info] src/utils/aiService.js:438-442 — unvalidated birthday day flows to storage
`Oct 99` → `dateStr = '10-99'` with no range check; stored as the birthday `date` and fed to reminder scheduling downstream. Low risk (user-typed NL command), but it is unvalidated input reaching persisted state.
**Recommendation:** clamp/validate day 1-31 (and month-day plausibility) before accepting; fall back to `getLocalMonthDayString()` default on out-of-range.

### [Info] src/utils/dateUtils.js:39-41 — out-of-contract inputs coerce to epoch dates
Booleans/arrays/plain objects fall through to `new Date(input)`: `getLocalDateString(true)` → `'1970-01-01'`, `getLocalDateString([])` → epoch. JSDoc promises `Date|string|number`; anything else should be `''`, not a fabricated 1970 date.
**Recommendation:** `else { return ''; }` instead of `d = new Date(input)`.

### [Info] __tests__/unit/dateUtils.test.js — coverage gaps on the exact edge cases that bite
Missing: `getLocalDateString(undefined)` (hits default → today, unasserted), `NaN`, epoch `0`, booleans; `parseLocalDate('2023-02-29')` rollover; `isSameLocalDay(0, 0)`; yesterday/tomorrow with invalid input (`''`, `'2023-02-29'`). The 27 tests cover the happy paths well; the adversarial inputs above are untested.
**Recommendation:** add ~6 tests pinning down invalid/epoch/falsy behavior — especially to lock in whatever contract is chosen for Findings 1-3.

## Strengths

- `getLocalDateString`'s strict `YYYY-MM-DD` round-trip validation (rejects `2023-02-29`, `2026-04-31`) is exactly right and genuinely better than the code it replaced.
- Local-midnight construction in `parseLocalDate` (`new Date(y, m-1, d, 0,0,0,0)`) correctly fixes the UTC-midnight rollback class.
- Migration is complete and consistent: all 8 callsites import from the single engine, zero UTC-slicing remnants, `createdAt/completedAt/dueDate` correctly left as full-ISO timestamps, `.tsx` widget import resolves through the same Metro/babel pipeline (lint + tests green).
- `isSameLocalDay` cross-type comparison in the Dashboard chart correctly handles mixed `YYYY-MM-DD` / ISO-datetime / timestamp inputs — the right abstraction at that boundary.

## Verdict (APPROVED WITH NOTES)

No blockers: the engine is sound for all real-world inputs, the migration is complete, and tests/lint are green. The six Warnings are robustness defects (silent-today fabrication, rollover acceptance, epoch-0 falsiness, unguarded `startsWith`, divergent streak logic, unmigrated birthday math) that deserve fixes but do not break current behavior on valid data. Address Warnings 1-4 before building further features on `parseLocalDate`.
