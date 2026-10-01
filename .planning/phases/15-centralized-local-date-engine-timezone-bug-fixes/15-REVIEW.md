---
phase: 15-centralized-local-date-engine-timezone-bug-fixes
reviewed: 2026-10-01T05:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - App.js
  - __tests__/phase12-widget-logic.test.js
  - __tests__/unit/dateUtils.test.js
  - src/navigation/AppNavigator.js
  - src/screens/BillingScreen.js
  - src/screens/DailyTasksScreen.js
  - src/screens/DashboardScreen.js
  - src/screens/SearchScreen.js
  - src/utils/aiService.js
  - src/utils/dateUtils.js
  - widgets/widget-task-handler.tsx
findings:
  critical: 2
  warning: 8
  info: 9
  total: 19
status: issues_found
---

# Phase 15: Code Review Report (Re-review, Post-fix)

**Reviewed:** 2026-10-01T05:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Re-review of the 11 phase-15 files at their CURRENT on-disk state, after commit
`7a706b1` ("fix(phase-15): address code review warnings"). All six prior
Warnings were checked against the present code; the date-engine fixes are real
and verified (see verification table). However, this pass surfaces **2 new
Critical defects** (an App.js mount crash and blank modal buttons in
BillingScreen) plus 8 Warnings, several in code paths the prior review already
touched. The date engine itself (`src/utils/dateUtils.js`) is now sound; the
remaining risk sits in its consumers and in unrelated defects inside the same
files.

### Prior-review verification (commit 7a706b1)

| Prior finding | Current state | Verdict |
|---|---|---|
| W1: `parseLocalDate` fabricates today on invalid input | `dateUtils.js:64,83,85` return `new Date(NaN)`; JSDoc contract updated; tests pin `null/undefined/''/junk/bool/{}` | FIXED |
| W2: `parseLocalDate` rollover (`2023-02-29` → Mar 1, ISO-datetime truncation) | `dateUtils.js:72-82` strict regex + component round-trip; ISO datetimes rejected; tests pin `'2023-02-29'`, `'2026-13-01'`, `'2026-09-27T23:30:00.000Z'` | FIXED |
| W3: falsy epoch `0` mishandled | Yesterday/tomorrow use explicit `=== null / === undefined / trim()===''` guards (`dateUtils.js:95,115`); `isSameLocalDay` uses explicit nullability (`:158-159`); epoch-0 test added (`dateUtils.test.js:97-101`) | FIXED |
| W4: `t.date.startsWith` crash on null date | `BillingScreen.js:126` now `(t.date \|\| '').startsWith(viewMonth)` | FIXED |
| W5: SearchScreen skips streak bookkeeping | `SearchScreen.js:64-96` now mirrors DailyTasks streak/`totalCompleted` logic | FIXED (but the mirrored logic carries a new flaw — see WR-03) |
| W6: hand-rolled unvalidated birthday math | `DashboardScreen.js:46-79` now regex + range + leap-year round-trip probe + `daysRemaining: 999` sentinel + `Number.isFinite` guard | FIXED |
| Info: stale `today` snapshot (DailyTasks) | `DailyTasksScreen.js:28` still render-time snapshot | OPEN (IN-01) |
| Info: widget `undefined` vs `null` | Production handler now delegates to `taskMutations.toggleTask` (which writes `null`); divergence moot in prod, but test helper still uses `undefined` | MOOT in prod / OPEN in tests (folded into WR-07) |
| Info: unvalidated birthday day (aiService) | `aiService.js:850-860` still accepts `Oct 99` → `'10-99'` | OPEN (IN-02) |
| Info: out-of-contract coercion to epoch | `dateUtils.js:36-41` booleans/objects still coerce via `new Date(input)` | OPEN (IN-03) |
| Info: test coverage gaps | Epoch-0 + invalid-input battery added; `isSameLocalDay(0,0)`, yesterday/tomorrow-with-invalid-input, `NaN`/boolean gaps remain | PARTIALLY OPEN (IN-04) |

## Critical Issues

### CR-01: App.js reads `loadData` before its declaration — ReferenceError crash on mount

**File:** `App.js:147-162` (use) vs `App.js:257` (declaration)
**Issue:** The foreground `AppState` effect at lines 147–162 closes over
`loadData` and, critically, evaluates it eagerly in its dependency array
(`}, [loadData]);` line 162). `loadData` is declared as
`const loadData = useCallback(...)` at line 257 — 95 lines *later* in the same
function body. Evaluating the deps array reads a `const` binding in its
temporal dead zone, throwing `ReferenceError: Cannot access 'loadData' before
initialization` on the very first render, before any provider or ErrorBoundary
below it can catch (the boundary is rendered *by* this component). The app
cannot mount at all in its current on-disk state. (The second consumer at
line 487 is fine — it sits after the declaration.)
**Fix:** Move the `loadData` definition above the `AppState` effect so no
reference precedes initialization:
```js
// App.js — define loadData BEFORE the AppState effect (~line 146)
const loadData = useCallback(async () => { /* unchanged body */ },
  [isInitialized, activeVaultId]);

useEffect(() => {
  const subscription = AppState.addEventListener("change", (nextAppState) => {
    if (appState.current.match(/inactive|background/) && nextAppState === "active") {
      loadData();
    }
    appState.current = nextAppState;
  });
  subscribeAppState();
  return () => { subscription.remove(); unsubscribeAppState(); };
}, [loadData]);
```

### CR-02: BillingScreen passes non-existent props to CustomButton — Budget/Bill modal buttons render with no text

**File:** `src/screens/BillingScreen.js:640-641`, `src/screens/BillingScreen.js:710-711`
**Issue:** `CustomButton`'s signature is
`({ title, onPress, icon, style, textStyle, outline, disabled, color })` with no
rest-props passthrough, and it renders `{title || ""}`
(`src/components/CustomButton.js:6,59`). But the Add-Budget modal (L640-641)
and Add-Bill modal (L710-711) use `<CustomButton label="CANCEL"
variant="secondary" theme={currentTheme}>` / `<CustomButton label="SET BUDGET"
theme={...}>` / `<CustomButton label="ADD BILL" ...>`. `label`, `variant`, and
`theme` are all silently dropped, so all four buttons render as blank colored
boxes — the user cannot tell CANCEL from SAVE in either modal. (The
Add-Transaction modal at L593-594 correctly uses `title`/`outline`/`color` and
is unaffected.)
**Fix:**
```jsx
<CustomButton title="CANCEL" onPress={() => setShowAddBudget(false)} outline color={currentTheme.primary} style={{ flex: 1, marginRight: 8 }} />
<CustomButton title="SET BUDGET" onPress={handleSaveBudget} color={currentTheme.primary} style={{ flex: 1 }} />
// same label→title / variant→outline swap for the ADD_RECURRING_BILL pair
```

## Warnings

### WR-01: Dashboard due-date label still parses through `new Date(string)` — the UTC-midnight shift phase 15 was meant to kill

**File:** `src/screens/DashboardScreen.js:159`
**Issue:** `` `DUE: ${new Date(task.dueDate).toLocaleDateString(...)}` ``. When
`dueDate` is a `YYYY-MM-DD` calendar string, `new Date('2026-05-15')` parses as
UTC midnight, so in negative-offset timezones the label renders the previous
day ("May 14"). This is the exact bug class the centralized engine exists to
prevent, at a callsite the migration missed. (Full-ISO instants are unaffected
— the bug is conditional on the string shape, which is why it survived.)
**Fix:**
```js
import { parseLocalDate } from "../utils/dateUtils";
const due = /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate ?? "")
  ? parseLocalDate(task.dueDate)
  : new Date(task.dueDate);
const label = isNaN(due.getTime()) ? "LOGGED IN QUEUE"
  : `DUE: ${due.toLocaleDateString([], { month: "short", day: "numeric" })}`;
```

### WR-02: Negative net balance drops the minus sign — loss renders identically to gain except color

**File:** `src/screens/BillingScreen.js:286-288`
**Issue:** `{net >= 0 ? "+" : ""}{currency}{Math.abs(net)...}` — for
`net = -500` this renders `₹500` in red, i.e. the same digits as a `+₹500`
surplus. Color alone carries the sign; on monochrome/high-contrast themes or
for color-blind users the loss is misread as a gain.
**Fix:**
```jsx
<Text ...>{net >= 0 ? "+" : "−"}{currency}{Math.abs(net).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Text>
```

### WR-03: Untoggle-then-retoggle collapses a multi-day streak to 1 (mirrored into both screens by the parity fix)

**File:** `src/screens/DailyTasksScreen.js:86-96`, `src/screens/SearchScreen.js:79-83`
**Issue:** Untoggling decrements the streak *and* nulls `lastCompletedDate`
(`streak = max(0, streak-1)`, `lastCompletedDate: null`). Re-completing the same
day then sees `lastCompletedDate` as neither yesterday nor today and takes the
`streak = 1` branch. Sequence on a 6-day streak: mis-tap off (→5), tap back on
(→1). A single accidental double-toggle destroys a week of streak state, and
the phase-15 parity fix copied the flaw into SearchScreen so both writers agree
on the wrong answer.
**Fix:** Preserve continuity on uncomplete instead of destroying it:
```js
} else {
  // untoggled — preserve streak/lastCompletedDate so an accidental
  // untoggle + re-toggle in the same session restores state
  totalCompleted = Math.max(0, totalCompleted - 1);
  return { ...task, completed: false, completedDate: null };
}
```

### WR-04: Notification-scheduling failure silently drops the new daily task (no `.catch`)

**File:** `src/screens/DailyTasksScreen.js:45-51`
**Issue:** `scheduleDailyTaskNotification(newDailyTask).then(notificationId => {
setDailyTasks(...) })` has no rejection handler. If scheduling throws (denied
permissions, notification subsystem error), the promise rejects unhandled *and*
`setDailyTasks` never runs — the user's task vanishes with no feedback. The
timed path should degrade to an unscheduled task, not a lost task.
**Fix:**
```js
if (newDailyTask.time) {
  scheduleDailyTaskNotification(newDailyTask).then(
    (notificationId) => setDailyTasks((prev) => [...prev, { ...newDailyTask, notificationId }]),
    (err) => {
      logger.warn("Daily reminder scheduling failed; adding task without reminder:", err?.message);
      setDailyTasks((prev) => [...prev, newDailyTask]);
    }
  );
}
```

### WR-05: `assistWriting` / `assistWritingCustom` throw TypeError on null note content

**File:** `src/utils/aiService.js:950`, `src/utils/aiService.js:1023`
**Issue:** Both functions call `noteContent.slice(0, MAX_INPUT_CHARS)` with no
guard, while their sibling heuristics (`extractTasksFromNoteHeuristic`,
`summarizeNoteHeuristic`) explicitly return early on non-string input. A null /
undefined note (e.g. assistant invoked with no active note) crashes with
`Cannot read properties of null` instead of degrading gracefully.
**Fix:**
```js
const clampedContent = (typeof noteContent === "string" ? noteContent : "").slice(0, MAX_INPUT_CHARS);
```

### WR-06: Recurring-bill due-day accepts any integer — `99` persists to storage

**File:** `src/screens/BillingScreen.js:195-199`
**Issue:** `handleSaveBill` checks `isNaN(dueDay)` but never its range, so
`dueDay = 99` passes validation and is persisted. Downstream,
`isBillOverdue` (`todayDay < 99` is always true) never flags it and the row
renders `DUE: 99th`. Same unvalidated-day class as the prior aiService Info,
but here it corrupts overdue computation, not just a label.
**Fix:**
```js
if (!billName.trim() || isNaN(amt) || amt <= 0 || isNaN(dueDay) || dueDay < 1 || dueDay > 31) return;
```

### WR-07: Phase-12 widget tests assert against local copies, never production code — plus stale tab vocabulary

**File:** `__tests__/phase12-widget-logic.test.js:14-49`
**Issue:** (a) `toggleTaskInList`, `sortAndSliceTasks`, `filterImportantTasks`
are re-implemented inside the test file; the suite never imports the production
`toggleTask` (`src/utils/taskMutations.js`) or the real widget handler, so all
12 assertions are tautological — a production regression in toggle/sort/filter
cannot fail this suite. Notably the copy clears dates with `undefined` (L24)
while production writes `null` (taskMutations.js:96), and the suite *asserts*
the divergent value (L76-77), locking in behavior production does not have.
(b) The local `isValidTab` (L33-35) accepts only `tasks/daily/timer`, while the
production handler accepts `tasks/daily/timer/all/persistent`
(`widget-task-handler.tsx:205,209`) — the test double disagrees with the
shipped contract.
**Fix:** Import the production units under test (`toggleTask` from
`src/utils/taskMutations.js`; tab guard extracted to a shared module) and
rewrite assertions against them; update the tab vocabulary to include
`all`/`persistent`.

### WR-08: Cold-start birthday reschedule is dead code — stale `birthdays` closure is always empty when it matters

**File:** `App.js:385-403`
**Issue:** Inside `loadData`, `if (birthdays.length > 0)` reads the `birthdays`
React state captured by the `useCallback` closure (`deps:
[isInitialized, activeVaultId]`). On cold start that state is the initial `[]`,
so the "reschedule on app start" block is skipped exactly when it was designed
to run; the just-loaded `parsedData.birthdays` (or the already-maintained
`birthdaysRef`) is never consulted. The feature only fires on a later
foreground reload, if ever.
**Fix:** Iterate what was actually loaded instead of the stale state:
```js
const storedBirthdays = parsedData.birthdays || [];
setBirthdays(storedBirthdays);
// ... reschedule loop over storedBirthdays, not `birthdays`
```

## Info

### IN-01: Render-time `today` snapshot still goes stale past midnight (prior Info, still open)

**File:** `src/screens/DailyTasksScreen.js:28`
**Issue:** `const today = getLocalDateString()` is captured once per render; a
session open across midnight stamps completions with yesterday's date until the
next render. Pre-existing, low impact (App.js rollover corrects on reload).
**Fix:** Call `getLocalDateString()` inside `toggleDailyTaskComplete` instead
of closing over the render-time value.

### IN-02: Unvalidated birthday day from NL parsing still reaches storage (prior Info, still open)

**File:** `src/utils/aiService.js:850-860`
**Issue:** `Oct 99` yields `dateStr = '10-99'` with no day-range check; the
value is persisted as the birthday `date` and fed to reminder scheduling. Low
risk (user-typed natural-language path), but unvalidated input reaches
persisted state.
**Fix:** Validate `1 <= day <= 31` (plus month-day plausibility) before
accepting; fall back to `getLocalMonthDayString()` on out-of-range input.

### IN-03: Out-of-contract inputs still coerce to epoch dates (prior Info, still open)

**File:** `src/utils/dateUtils.js:36-41`
**Issue:** The `else { d = new Date(input); }` fallthrough means
`getLocalDateString(true)` → `'1970-01-01'` and `getYesterdayLocalDateString(false)`
→ epoch-minus-a-day. JSDoc promises `Date|string|number`; anything else should
be `''`, not a fabricated 1970 date.
**Fix:** `else { return ''; }` instead of `d = new Date(input);`.

### IN-04: Test gaps remain on the adversarial inputs (prior Info, partially open)

**File:** `__tests__/unit/dateUtils.test.js`
**Issue:** The fix commit added the epoch-0 and invalid-input battery, but
still unpinned: `getLocalDateString(undefined)` (default→today, unasserted),
`NaN`, booleans; `isSameLocalDay(0, 0)` (same-day, epoch); yesterday/tomorrow
with invalid input (`''`, `'2023-02-29'`, `false`).
**Fix:** Add ~5 tests pinning these contracts, especially to lock WR/IN-03
behavior.

### IN-05: Unused imports, props, and locals in DailyTasksScreen

**File:** `src/screens/DailyTasksScreen.js:1,14-21`
**Issue:** `useEffect`, `useRef`, `Platform`, `Animated` are imported but never
used; `navigation` (L22), `setSelectedTask`/`setModalVisible` props are
accepted but never referenced. Dead weight that misleads readers about the
screen's dependencies.
**Fix:** Remove unused imports/props or wire the edit-modal path they imply.

### IN-06: Debug `console.log` and `as any` casts in widget handler

**File:** `widgets/widget-task-handler.tsx:79,133` (`console.log`); `:98,102,120,164,205-206,242,266` (`as any`)
**Issue:** Two `console.log` calls on the tap/render hot path (mitigated in
release by the Phase-19 babel strip, but still logcat noise in dev), and seven
`as any` assertions around tab/task shapes that defeat the `.tsx` type
checking the file otherwise buys into.
**Fix:** Route through `logger.debug`; replace `as any` with the existing
`TaskItemType` /tab-union types.

### IN-07: SearchScreen assumes non-null `searchQuery`

**File:** `src/screens/SearchScreen.js:116,120`
**Issue:** `searchQuery.length` and `searchQuery.toUpperCase()` throw if the
prop is ever `null`/`undefined` (no default in destructuring, L19). Safe today
(App.js always passes a string via `useState("")`), but one refactor away from
a crash.
**Fix:** `const q = searchQuery ?? "";` and use `q` throughout.

### IN-08: Feb-29 fallback lands on Mar 2, not Mar 1, in non-leap years

**File:** `src/screens/DashboardScreen.js:71-76`
**Issue:** For a Feb-29 birthday in a non-leap year,
`new Date(year, 1, 29)` rolls to Mar 1 (month mismatch detected), then the
fallback constructs `new Date(year, 1, day + 1)` = `new Date(year, 1, 30)` →
Mar 2. Conventional handling is Mar 1. One-day countdown error, one entry
class, only in non-leap years.
**Fix:** Clamp instead of incrementing: when the month mismatches, use
`new Date(year, month + 1, 0)` (last day of the target month: Feb 28 / Mar 1
convention by choice) and document the choice.

### IN-09: Minor App.js robustness nits

**File:** `App.js:253,412,680-682`
**Issue:** (a) L253 `AsyncStorage.setItem` for the username is fire-and-forget
— a storage failure rejects unhandled. (b) L412 `await
getAllNotesFromFilesystem(...)` sits inside the `catch` recovery path with no
guard of its own — if the filesystem read also fails, the recovery path throws
out of `loadData`. (c) L680-682 the timer tick `prev - 1` is unclamped; a
trailing interval firing can push `timerRemaining` to `-1`, briefly rendering
`-1:-59` via `formatTime` and pushing a negative `remaining` to the widget.
**Fix:** (a) append `.catch((e) => logger.warn(...))`; (b) wrap the catch-path
read in try/catch with `setNotes([])` fallback; (c) `setTimerRemaining((prev)
=> Math.max(0, prev - 1))`.

---

_Reviewed: 2026-10-01T05:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
