# KwestUpMobile — Logic Defect Hunt, Behavioral Verification and Automated Bug-Fix Pipeline

**Session Date:** 2026-10-12
**Status:** COMPLETE
**Domain:** Logic Defect Audit, Concurrency, Behavioral Engineering & Testing

---

## 1. Baseline & Final Verification Metrics

### Quality Gates Summary
- **Node.js Runtime:** v22.19.0
- **TypeScript Gate:** `npm run typecheck` (`tsc --noEmit`) -> **PASSED** (0 errors)
- **ESLint Gate:** `npm run lint` (`eslint .`) -> **PASSED** (0 errors, 478 baseline warnings, 0 new warnings)
- **Jest Suite:** `npm test` (`jest`) -> **PASSED**
  - **Suites:** 34 passed, 34 total (+4 suites added)
  - **Tests:** 496 passed, 496 total (+39 tests added, 0 failures)
- **Property-Based Testing:** `npm run test:property` -> **PASSED** (7 invariant properties across 100+ fuzzed runs)
- **Mutation Testing:** `npm run test:mutation:critical` -> **PASSED** (87.54% overall mutation score, 93.36% covered score on `src/utils/taskMutations.js`)
- **Code Coverage:**
  - Statements: 50.84%
  - Branches: 41.52%
  - Functions: 38.01%
  - Lines: 51.98%

### Module Test Coverage & Test Gaps
- **Well-Covered Engine Domains (85–95%+):**
  - `src/ai/`: behaviorCompiler (73.7%), frictionAnalyzer (94.7%), heuristicParser (87.9%), intentParser (82.5%), weeklyReviewEngine (96.4%).
  - `src/behavior/`: cueEngine (93.7%), eventBus (89.5%), habitEngine (96.5%), improvementEngine (94.0%), interventionEngine (90.6%), recoveryEngine (96.4%), rewardEngine (94.7%), ruleEngine (89.8%).
  - `src/commands/`: aiSandbox (96.5%), commandExecutor (93.0%), commandValidator (76.0%), habitCommandHandlers (87.2%), idempotencyStore (93.5%).
  - `src/services/`: notificationService (86.0%).
  - `src/utils/`: dateUtils (92.3%), logger (91.1%), storage (91.8%), syncService (94.8%), taskMutations (97.0%).
- **Untested / Zero-Coverage Presentation Modules (0%):**
  - `src/screens/`: `NotesScreen.js` (0%), `BillingScreen.js` (0%), `BirthdaysScreen.js` (0%), `DailyTasksScreen.js` (0%), `DashboardScreen.js` (0%), `SearchScreen.js` (0%), `SettingsScreen.js` (0%), `TaskListScreen.js` (0%).
  - `src/navigation/`: `AppNavigator.js` (0%), `CustomDrawerContent.js` (0%).
  - `src/context/`: `VaultContext.js` (0%).
  - `src/components/`: `WeeklyReviewModal.js` (0%), `QRScannerModal.js` (0%), `TaskCard.js` (0%), `TaskEditModal.js` (0%).

---

## 2. Prioritized Defect Inventory

| Defect ID | Severity | Status | File & Function | Summary |
|-----------|----------|--------|-----------------|---------|
| **DEF-01** | CRITICAL | CONFIRMED | `src/context/TaskContext.js:toggleTaskComplete`, `handleSaveTask` | Lost updates on rapid sequential task mutations due to closure-captured state |
| **DEF-02** | CRITICAL | CONFIRMED | `src/context/TaskContext.js:refreshTasksFromStorage`, `writeTaskSnapshot` | Stale storage read overwrites in-memory state during 500ms debounce window (CONCERNS.md:51) |
| **DEF-03** | HIGH | CONFIRMED | `src/utils/taskMutations.js:calculateNextRecurrence` | Monthly recurring task on 31st skips February due to JS `Date.setMonth()` rollover |
| **DEF-04** | MEDIUM | CONFIRMED | `src/utils/taskMutations.js:toggleSubtask` | Out-of-bounds `subtaskIdx` modifies task and updates `updatedAt` without changing subtasks |
| **DEF-05** | HIGH | CONFIRMED | `src/utils/fileStorage.js:saveNoteFile`, `vaultService.js:getVaultPath` | Unsanitized folder and vault ID allow directory traversal and escaping vault directory |
| **DEF-06** | HIGH | CONFIRMED | `src/commands/commandValidator.ts:validateCommand` | `PAUSE_HABIT`, `ARCHIVE_HABIT`, `RESUME_HABIT` require redundant `actor` in payload; blocks AI-initiated confirmed archive |
| **DEF-07** | MEDIUM | CONFIRMED | `src/utils/storage.js:isUserDataKey` | `isUserDataKey` excludes `kwestup_idempotency_v1`, causing cache clear to wipe durable idempotency |
| **DEF-08** | LOW | CONFIRMED | `src/context/BirthdayContext.js:handleSaveBirthday` | Event bus payload emits `date: undefined` when input birthday provides `birthDate` |

---

## 3. Defect Details & Analysis

### DEF-01: Lost Updates on Rapid Sequential Task Mutations
- **File:** `src/context/TaskContext.js` -> `toggleTaskComplete`, `handleSaveTask`
- **Expected Behavior:** Sequential calls to `toggleTaskComplete` (e.g. clicking two task checkboxes in rapid succession) or `handleSaveTask` must apply both mutations.
- **Actual Behavior:** `toggleTaskComplete` uses `const { updatedTasks } = toggleTask(tasks, id); setTasks(updatedTasks);` where `tasks` is closed over from the component render scope. Two calls before re-render both compute off the same stale `tasks`, causing the second call to overwrite and cancel the first.
- **Root Cause:** Closing over `tasks` rather than using functional state updater or latest-state ref.
- **Confidence:** 100% (Confirmed by code inspection and reproduction test).

### DEF-02: Stale Storage Read Overwrites In-Memory State During 500ms Debounce Window
- **File:** `src/context/TaskContext.js` -> `refreshTasksFromStorage`, `writeTaskSnapshot`
- **Expected Behavior:** Foregrounding the app or receiving a refresh trigger while a debounced write is pending (<500ms after an in-app mutation) must NOT overwrite fresh in-memory task mutations with stale storage data. Widget updates in storage and app updates in memory must merge by per-task `updatedAt`.
- **Actual Behavior:** `refreshTasksFromStorage` checks `prevJson !== nextJson` and sets `parsed.tasks` unconditionally from storage, wiping recent in-memory mutations. In addition, `writeTaskSnapshot` sets `tasks: snapshot.tasks`, clobbering any newer task updates written by the widget during the debounce window.
- **Root Cause:** Missing per-task `updatedAt` reconciliation and lack of pending-write awareness in `refreshTasksFromStorage`.
- **Confidence:** 100% (Documented in `CONCERNS.md:51`).

### DEF-03: Monthly Recurring Task Skips Months on 31st
- **File:** `src/utils/taskMutations.js` -> `calculateNextRecurrence`
- **Expected Behavior:** A monthly recurring task due on January 31, when completed, should schedule its next occurrence on the last day of February (Feb 28 or Feb 29 in leap years).
- **Actual Behavior:** `date.setMonth(date.getMonth() + 1)` on January 31 overflows February into March 2 or 3, completely skipping February.
- **Root Cause:** Standard ECMAScript date arithmetic overflow when the source day exceeds the number of days in the target month.
- **Confidence:** 100% (Confirmed by date arithmetic analysis).

### DEF-04: Out-of-Bounds Subtask Index Mutates Task
- **File:** `src/utils/taskMutations.js` -> `toggleSubtask`
- **Expected Behavior:** Calling `toggleSubtask(tasks, taskId, -1)` or with an index >= subtasks length should be a no-op returning `updatedTask = null` and preserving the original task array.
- **Actual Behavior:** `toggleSubtask` creates a shallow copy of the task with a new `updatedAt` timestamp and returns it as `updatedTask`.
- **Root Cause:** Missing bounds check on `subtaskIdx`.
- **Confidence:** 100%.

### DEF-05: Unsanitized Folder / Vault ID Path Traversal
- **File:** `src/utils/fileStorage.js` -> `saveNoteFile`, `readNoteFile`; `src/utils/vaultService.js` -> `getVaultPath`
- **Expected Behavior:** Folder names and vault IDs containing `..` or path separators must be sanitized so note files cannot escape `Notes/Vaults/<vaultId>/`.
- **Actual Behavior:** `sanitizedFolder = (folder || "Uncategorized").trim()` preserves `/`, `\\`, and `..`. `getVaultPath(vaultId)` does not sanitize `vaultId`.
- **Root Cause:** Folder and vault ID inputs are not sanitized with the character whitelist applied to note titles.
- **Confidence:** 100%.

### DEF-06: Command Validator Actor Discrepancy in Habit Lifecycle Actions
- **File:** `src/commands/commandValidator.ts` -> `validateCommand`
- **Expected Behavior:** A command with root `actor: 'user'` should be valid for `PAUSE_HABIT`, `ARCHIVE_HABIT`, and `RESUME_HABIT` without requiring `payload.actor`. An AI-initiated `ARCHIVE_HABIT` with `command.confirmed = true` should be allowed past validation.
- **Actual Behavior:** `validateCommand` inspected `p.actor` directly on payload, rejecting commands where actor was provided only at root. In addition, `p.actor !== 'user' && p.actor !== 'engine'` blocked AI-confirmed archive requests.
- **Root Cause:** Hardcoded check on `payload.actor` instead of resolving `effectiveActor = p.actor || actor`.
- **Confidence:** 100%.

### DEF-07: Durable Idempotency Key Omitted from Storage Protection
- **File:** `src/utils/storage.js` -> `isUserDataKey`
- **Expected Behavior:** `isUserDataKey('kwestup_idempotency_v1')` must return `true` so `clearAllCaches()` preserves idempotency records and `collectAsyncStorageData()` includes them in backup archives.
- **Actual Behavior:** `isUserDataKey` only checks a hardcoded list that omitted `kwestup_idempotency_`, resulting in the key being cleared by cache maintenance.
- **Root Cause:** New storage key prefix added in Milestone 4.0 was not added to the protection allowlist.
- **Confidence:** 100%.

### DEF-08: Birthday Event Bus Payload Field Mismatch
- **File:** `src/context/BirthdayContext.js` -> `handleSaveBirthday`
- **Expected Behavior:** Emitted event payload for `BIRTHDAY_CREATED` / `BIRTHDAY_UPDATED` includes the birthday date string.
- **Actual Behavior:** Emits `payload: { name: finalBirthday.name, date: finalBirthday.date }`; because birthdays use `birthDate`, `date` is undefined.
- **Root Cause:** Property name mismatch between schema and emit call.
- **Confidence:** 100%.

---

## 4. Fixes Applied & Regression Test Mapping

| Defect ID | Files Modified | Fix Description | Regression Test File & Assertion |
|-----------|----------------|-----------------|----------------------------------|
| **DEF-01** | `src/context/TaskContext.js` | Converted `toggleTaskComplete` and `handleSaveTask` to functional updaters (`setTasks((currentTasks) => ...)`) to eliminate render closure race conditions. | `__tests__/unit/taskConcurrencyAndRecurrence.test.js` -> `handles rapid concurrent toggleTaskComplete without dropping either update`, `handles rapid sequential handleSaveTask calls without race overwrites` |
| **DEF-02** | `src/context/TaskContext.js`, `src/utils/taskMutations.js` | Implemented `mergeTasksByUpdatedAt` and integrated into `writeTaskSnapshot` and `refreshTasksFromStorage`. Gated `initialTasks` prop sync to cold start or explicit empty resets. | `__tests__/unit/taskConcurrencyAndRecurrence.test.js` -> `refreshTasksFromStorage does not clobber a recent in-memory mutation`, `mergeTasksByUpdatedAt preserves newer in-memory updates over older storage reads` |
| **DEF-03** | `src/utils/taskMutations.js` | Clamped monthly recurrence day to `Math.min(originalDay, lastDayOfTargetMonth)` so Jan 31 clamps to Feb 28/29 without skipping into March. | `__tests__/unit/taskConcurrencyAndRecurrence.test.js` -> `clamps Jan 31 to Feb 28 in a standard non-leap year (2026)`, `clamps Jan 31 to Feb 29 in a leap year (2024)`, `clamps March 31 to April 30` |
| **DEF-04** | `src/utils/taskMutations.js` | Added bounds check `subtaskIdx < 0 || subtaskIdx >= subtasks.length` to return untouched task list and `null`. | `__tests__/unit/taskConcurrencyAndRecurrence.test.js` -> `returns untouched tasks array and null updatedTask on negative subtask index`, `on out-of-bounds subtask index` |
| **DEF-05** | `src/utils/fileStorage.js`, `src/utils/vaultService.js` | Sanitized `folder` in note operations and `vaultId` in `getVaultPath` using `.replace(/[/\\?%*:|"<>. ]/g, "_")`. | `__tests__/unit/logicDefectFixes.test.tsx` -> `getVaultPath sanitizes directory traversal characters from vaultId`, `saveNoteFile and readNoteFile sanitize folder traversal so notes stay in vault` |
| **DEF-06** | `src/commands/commandValidator.ts` | Resolved `effectiveActor = p.actor || actor` in `PAUSE_HABIT`, `ARCHIVE_HABIT`, and `RESUME_HABIT`. Added confirmed AI execution check for `ARCHIVE_HABIT`. | `__tests__/unit/logicDefectFixes.test.tsx` -> `validates PAUSE_HABIT using root command.actor`, `allows AI-initiated ARCHIVE_HABIT when command.confirmed is true`, `rejects AI-initiated ARCHIVE_HABIT when unconfirmed` |
| **DEF-07** | `src/utils/storage.js` | Added `key.startsWith("kwestup_idempotency_")` to `isUserDataKey`. | `__tests__/unit/logicDefectFixes.test.tsx` -> `isUserDataKey returns true for kwestup_idempotency_v1 key`, `clearAllCaches preserves durable idempotency keys while deleting cache keys` |
| **DEF-08** | `src/context/BirthdayContext.js` | Emitted `date: finalBirthday.date || finalBirthday.birthDate || ""` in telemetry event payload. | `__tests__/unit/logicDefectFixes.test.tsx` -> `emits BIRTHDAY_CREATED with populated date when record provides birthDate` |

---

## 5. Phase E — Stateful Sequence Verification

Verified five end-to-end multi-step flows in `__tests__/unit/statefulSequences.test.ts`:
1. **Task Sequence:** Create → edit → complete → toggle → persist → reload → widget background completion → foreground reconcile. (PASSED)
2. **Habit Sequence:** Create plan → complete for today → duplicate completion (idempotent, no double streak) → miss day (transition to recovery) → recovery completion (restores active status) → pause → resume. (PASSED)
3. **Command Gateway Sequence:** Valid command → duplicate command with same idempotencyKey (side effect prevented) → schema-invalid command (validation rejected) → cold start (in-memory cache evicted) → retry (durable store dedup verified). (PASSED)
4. **Persistence Sequence:** Interleaved in-memory and widget mutations resolving out of order; `mergeTasksByUpdatedAt` correctly preserves the latest state for every entity. (PASSED)
5. **Notification Sequence:** Schedule reminder → reschedule due date (cancels old notification, schedules new) → delete task (cancels active notification). (PASSED)

---

## 6. Phase C — Property-Based Testing Invariants (`fast-check`)

Implemented and verified in `__tests__/unit/propertyBased.test.ts` (100–150 iterations per property):
- **Task Mutations:**
  - Non-interference: Completing task A never mutates or alters unrelated task B.
  - Subtask Isolation: Out-of-bounds subtask indices never mutate the task list.
  - Reconciliation Invariant: `mergeTasksByUpdatedAt` guarantees all output IDs are unique and every task retains the maximum `updatedAt` timestamp across all duplicate instances in both in-memory and storage inputs.
- **Habit Engine:**
  - Streak Non-negativity: Streak counts remain strictly `>= 0` across all valid transitions.
  - Same-day Idempotency: Multiple completions on the same date never duplicate streak or evidence votes.
  - Recovery State Restoration: Completing a habit in recovery status always restores active status.
- **Command Validator:**
  - Fuzz Safety: `validateCommand` never throws an uncaught exception on arbitrary fuzzed inputs.
  - Rejection Gates: Unsupported command actions are deterministically rejected.

---

## 7. Phase D — Mutation Testing Evaluation (Stryker)

- **Configuration:** `stryker.config.json` configured with Jest runner and isolated Babel parser to eliminate Expo SDK 57 `decorators-legacy` conflicts.
- **Target Module:** `src/utils/taskMutations.js`
- **Mutants Generated:** 321 mutants
- **Stryker Metrics:**
  - **Mutation Score (Overall):** 87.54%
  - **Mutation Score (Covered):** 93.36%
  - **Killed:** 281 mutants
  - **Survived:** 20 mutants (arithmetic / fallback defaults where test input values match neutral defaults)
  - **Timeout:** 0
  - **No Coverage:** 20 mutants
  - **Compile / Runtime Errors:** 0
- **Package Scripts Added:**
  - `"test:property"`: `jest __tests__/unit/propertyBased.test.ts`
  - `"test:mutation:critical"`: `stryker run`

---

## 8. Summary of Completion Criteria

- [x] **Baseline & Defect Inventory:** Fully documented in `.planning/debug/logic-defect-audit.md`.
- [x] **Regression Tests for Confirmed Defects:** 8 confirmed defects resolved and covered by regression tests (`__tests__/unit/taskConcurrencyAndRecurrence.test.js` & `__tests__/unit/logicDefectFixes.test.tsx`).
- [x] **Stateful Sequences (Phase E):** 5 multi-step sequences verified in `__tests__/unit/statefulSequences.test.ts`.
- [x] **Property-Based Testing (Phase C):** 7 core invariants verified using `fast-check` in `__tests__/unit/propertyBased.test.ts`.
- [x] **Mutation Testing (Phase D):** Stryker configured and executed on `src/utils/taskMutations.js` yielding an 87.54% mutation score.
- [x] **Clean Verification Gates:**
  - `npm run typecheck` (`tsc --noEmit`) -> Exited 0
  - `npm run lint` (`eslint .`) -> Exited 0 (0 errors, 478 baseline warnings, 0 introduced warnings)
  - `npm test` (`jest`) -> Exited 0 (34/34 suites, 496/496 tests passed)
- [x] **Git Rule Respected:** NO GIT COMMITS created, preserving the uncommitted working tree per user constraints.


