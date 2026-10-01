---
phase: 15-centralized-local-date-engine-timezone-bug-fixes
fixed_at: 2026-10-01T06:00:00Z
review_path: C:/Users/OM Prakash/Documents/KwestUpMobile/.planning/phases/15-centralized-local-date-engine-timezone-bug-fixes/15-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-10-01T06:00:00Z
**Source review:** `15-REVIEW.md` (re-review, post `7a706b1`)
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (2 Critical + 8 Warnings; 9 Info out of scope per `critical_warning`)
- Fixed: 10
- Skipped: 0

**Verification environment:** syntax checks (`node --check`) and the WR-07 jest suite ran in the isolated review-fix worktree (repo-relative `.claude/worktrees/`, branch `gsd-reviewfix/15-*`), then fast-forwarded onto `development`. Gate results are reproducible from the post-merge tree.

## Fixed Issues

### CR-01: App.js reads `loadData` before its declaration — ReferenceError crash on mount

**Files modified:** `App.js`
**Commit:** 554aaaf
**Applied fix:** Moved the small foreground-`AppState` effect (16 lines) below the `loadData` `useCallback` declaration instead of moving the 160-line `loadData` block — same TDZ elimination, minimal diff. The effect body is unchanged; added a `NOTE (CR-01)` comment pinning the ordering invariant so a future edit cannot reintroduce the forward reference. Verified declaration precedes all three uses; `node --check` passes.

### CR-02: BillingScreen passes non-existent props to CustomButton — blank modal buttons

**Files modified:** `src/screens/BillingScreen.js`
**Commit:** 359fff9
**Applied fix:** All four buttons in the Add-Budget and Add-Bill modals now use the real `CustomButton` contract (`title` / `outline` / `color={currentTheme.primary}`), mirroring the correct Add-Transaction modal. Zero `label=` / `variant=` props remain (6 `title=` buttons total). `node --check` passes.

### WR-01: Dashboard due-date label still parses through `new Date(string)`

**Files modified:** `src/screens/DashboardScreen.js`
**Commit:** 4691124
**Applied fix:** Added `formatDueDateLabel()` helper: `YYYY-MM-DD` strings route through the centralized `parseLocalDate`; full ISO instants keep native parsing; invalid dates fall back to `"LOGGED IN QUEUE"`. Import extended to include `parseLocalDate`. `node --check` passes.

### WR-02: Negative net balance drops the minus sign

**Files modified:** `src/screens/BillingScreen.js`
**Commit:** 8e0b2c7
**Applied fix:** Negative branch now renders `"-"` instead of `""`. (Used ASCII hyphen rather than the review's U+2212 minus to guarantee glyph coverage in the bundled JetBrainsMono/Rupee rendering path.) `node --check` passes.

### WR-03: Untoggle-then-retoggle collapses a multi-day streak to 1

**Files modified:** `src/screens/DailyTasksScreen.js`, `src/screens/SearchScreen.js`
**Commit:** a927ba6
**Applied fix:** (multi-file atomic commit) Untoggling now decrements only `totalCompleted` and clears `completed`/`completedDate`; `streak` and `lastCompletedDate` are preserved (`lastCompletedDate: newCompletedStatus ? today : task.lastCompletedDate`), so an accidental untoggle + re-toggle restores state in both writers.
**Status:** `fixed: requires human verification` — streak-untoggle semantics (preserve vs. decrement) is a product decision; symmetry between the two screens is verified, but confirm the preserve-on-untoggle behavior is the intended UX before verification.

### WR-04: Notification-scheduling failure silently drops the new daily task

**Files modified:** `src/screens/DailyTasksScreen.js`
**Commit:** 020fb68
**Applied fix:** Added rejection handler to `scheduleDailyTaskNotification().then()` that logs via `logger.warn` and appends the task without a reminder; added the missing `import { logger } from "../utils/logger"`. `node --check` passes.

### WR-05: `assistWriting` / `assistWritingCustom` throw TypeError on null note content

**Files modified:** `src/utils/aiService.js`
**Commit:** af1e0bf
**Applied fix:** Both call sites (L950, L1023) now use `(typeof noteContent === "string" ? noteContent : "").slice(0, MAX_INPUT_CHARS)` via a single `replaceAll` edit — verified 2 guarded, 0 unguarded remaining. `node --check` passes.

### WR-06: Recurring-bill due-day accepts any integer

**Files modified:** `src/screens/BillingScreen.js`
**Commit:** dd9dcd0
**Applied fix:** Guard extended to `|| dueDay < 1 || dueDay > 31` exactly as suggested. `node --check` passes.

### WR-07: Phase-12 widget tests assert against local copies, never production code

**Files modified:** `__tests__/phase12-widget-logic.test.js`
**Commit:** b6a5ad0
**Applied fix:** Toggle tests P1–P4 rewritten against production `toggleTask` from `src/utils/taskMutations.js` (the unit the widget handler delegates to) with deterministic `now`/`todayDate` options; un-complete now asserts the production `null` contract (was `undefined`); `isValidTab` vocabulary extended to the production 5-tab set (`tasks/daily/timer/all/persistent`) with P6 updated accordingly; added P11 prod-parity test pinning date-engine stamping. Full suite: **11/11 pass**. Sort/filter helpers retained with a header comment documenting them as mirrors of the handler's inline render-path contract (production keeps them inline; no standalone unit exists to import).

### WR-08: Cold-start birthday reschedule is dead code

**Files modified:** `App.js`
**Commit:** 92a81e6
**Applied fix:** Introduced `loadedBirthdays` local assigned in both `storedDataRaw` branches; the reschedule guard and loop iterate the loaded data (snapshot into `birthdaysToReschedule` for the deferred `setTimeout` closure) instead of the stale `birthdays` state. The unrelated sync-path `for (const bday of birthdays)` loop was intentionally left untouched. `node --check` passes.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-10-01T06:00:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
