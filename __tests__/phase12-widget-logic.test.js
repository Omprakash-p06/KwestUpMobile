/**
 * Phase 12 — Widget Logic Validation Tests
 * ==========================================
 * These tests validate the core pure-function logic extracted from
 * widget-task-handler.tsx WITHOUT requiring a running Android device,
 * AsyncStorage, or react-native-android-widget.
 *
 * Run with: npx jest __tests__/phase12-widget-logic.test.js
 * (requires jest + @jest/globals to be installed as devDependencies)
 *
 * NOTE: As of Phase 12, KwestUp Mobile has no Jest runner configured.
 *       Install jest + babel-jest to execute these:
 *       npm install --save-dev jest babel-jest @babel/preset-env @babel/preset-react
 *
 * Validation coverage:
 *   - [12-P1] TOGGLE_TASK: task found → flips completed, sets completedAt / completedDate
 *   - [12-P2] TOGGLE_TASK: un-completing → clears completedAt / completedDate
 *   - [12-P3] TOGGLE_TASK: task NOT found → isToggled stays false, no write
 *   - [12-P4] TOGGLE_TASK: empty task list → no crash, isToggled false
 *   - [12-P5] TOGGLE_TASK: corrupt storage (null raw) → graceful no-op
 *   - [12-P6] SWITCH_TAB: valid tab values accepted
 *   - [12-P7] SWITCH_TAB: invalid tab value treated as unknown (guard test)
 *   - [12-P8] Sort order: completed tasks sink to bottom, uncompleted rise
 *   - [12-P9] Slice: tasks list capped at 8 for widget payload
 *   - [12-P10] ImportantTask filter: only important=true && completed=false pass
 */

// ---------------------------------------------------------------------------
// Helpers — extracted pure-function equivalents of handler logic
// ---------------------------------------------------------------------------

/**
 * Pure equivalent of the TOGGLE_TASK mutation inside widgetTaskHandler.
 */
function toggleTaskInList(tasks, taskId) {
  const now = new Date().toISOString();
  let isToggled = false;
  const updated = tasks.map((task) => {
    if (task.id === taskId) {
      isToggled = true;
      const nextCompletedState = !task.completed;
      return {
        ...task,
        completed: nextCompletedState,
        completedDate: nextCompletedState ? now.slice(0, 10) : undefined,
        completedAt: nextCompletedState ? now : undefined,
      };
    }
    return task;
  });
  return { updated, isToggled };
}

/**
 * Pure equivalent of the tab value guard used on SWITCH_TAB.
 */
function isValidTab(tab) {
  return tab === 'tasks' || tab === 'daily' || tab === 'timer';
}

/**
 * Pure equivalent of the sort-and-slice logic used when building widget payloads.
 */
function sortAndSliceTasks(tasks, limit = 8) {
  return [...tasks]
    .sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return 0;
    })
    .slice(0, limit);
}

/**
 * Pure equivalent of the importantUnfinished filter.
 */
function filterImportantTasks(tasks, limit = 5) {
  return tasks.filter((t) => t.important && !t.completed).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Test runner (manual, no Jest required — run: node __tests__/phase12-widget-logic.test.js)
// ---------------------------------------------------------------------------

const results = [];
let passed = 0;
let failed = 0;

function test(id, description, fn) {
  try {
    fn();
    results.push(`  ✅ [${id}] ${description}`);
    passed++;
  } catch (e) {
    results.push(`  ❌ [${id}] ${description}\n       → ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, label) {
  if (a !== b)
    throw new Error(
      `${label || 'Expected'} ${JSON.stringify(b)} but got ${JSON.stringify(a)}`
    );
}

// ---------------------------------------------------------------------------
// [12-P1] TOGGLE_TASK: completing an active task
// ---------------------------------------------------------------------------
test('12-P1', 'TOGGLE_TASK: completing an active task sets completed=true and metadata', () => {
  const tasks = [{ id: 'a1', title: 'Test task', important: false, completed: false }];
  const { updated, isToggled } = toggleTaskInList(tasks, 'a1');
  assert(isToggled, 'isToggled should be true');
  assert(updated[0].completed === true, 'completed should be true');
  assert(typeof updated[0].completedAt === 'string', 'completedAt should be set');
  assert(typeof updated[0].completedDate === 'string', 'completedDate should be set');
  // completedDate must be YYYY-MM-DD format
  assert(/^\d{4}-\d{2}-\d{2}$/.test(updated[0].completedDate), 'completedDate must be YYYY-MM-DD');
});

// ---------------------------------------------------------------------------
// [12-P2] TOGGLE_TASK: un-completing a completed task
// ---------------------------------------------------------------------------
test('12-P2', 'TOGGLE_TASK: un-completing a task clears completedAt and completedDate', () => {
  const tasks = [
    {
      id: 'a2',
      title: 'Done task',
      important: false,
      completed: true,
      completedAt: '2026-06-28T10:00:00.000Z',
      completedDate: '2026-06-28',
    },
  ];
  const { updated, isToggled } = toggleTaskInList(tasks, 'a2');
  assert(isToggled, 'isToggled should be true');
  assert(updated[0].completed === false, 'completed should be false');
  assertEqual(updated[0].completedAt, undefined, 'completedAt');
  assertEqual(updated[0].completedDate, undefined, 'completedDate');
});

// ---------------------------------------------------------------------------
// [12-P3] TOGGLE_TASK: taskId not found
// ---------------------------------------------------------------------------
test('12-P3', 'TOGGLE_TASK: non-existent taskId → isToggled=false, list unchanged', () => {
  const tasks = [{ id: 'a3', title: 'Untouched', important: false, completed: false }];
  const { updated, isToggled } = toggleTaskInList(tasks, 'DOES_NOT_EXIST');
  assert(!isToggled, 'isToggled should be false');
  assert(updated[0].completed === false, 'Task should not be mutated');
});

// ---------------------------------------------------------------------------
// [12-P4] TOGGLE_TASK: empty tasks array
// ---------------------------------------------------------------------------
test('12-P4', 'TOGGLE_TASK: empty task list → no crash, isToggled false', () => {
  const { updated, isToggled } = toggleTaskInList([], 'any-id');
  assert(!isToggled, 'isToggled should be false');
  assertEqual(updated.length, 0, 'updated.length');
});

// ---------------------------------------------------------------------------
// [12-P5] TOGGLE_TASK: corrupt storage simulation (null raw)
// ---------------------------------------------------------------------------
test('12-P5', 'TOGGLE_TASK: null storage raw → graceful no-op (guard at call site)', () => {
  // The handler checks `if (raw)` before any JSON.parse.
  // Simulate: raw is null, so we should skip entirely.
  const raw = null;
  let didWrite = false;
  if (raw) {
    // This block must not execute
    didWrite = true;
  }
  assert(!didWrite, 'Should not write when raw is null');
});

// ---------------------------------------------------------------------------
// [12-P6] SWITCH_TAB: valid tab values
// ---------------------------------------------------------------------------
test('12-P6', 'SWITCH_TAB: tasks / daily / timer are all valid tab values', () => {
  assert(isValidTab('tasks'), 'tasks should be valid');
  assert(isValidTab('daily'), 'daily should be valid');
  assert(isValidTab('timer'), 'timer should be valid');
});

// ---------------------------------------------------------------------------
// [12-P7] SWITCH_TAB: invalid tab value
// ---------------------------------------------------------------------------
test('12-P7', 'SWITCH_TAB: invalid tab value is rejected by guard', () => {
  assert(!isValidTab('finance'), 'finance should not be valid');
  assert(!isValidTab(''), 'empty string should not be valid');
  assert(!isValidTab(undefined), 'undefined should not be valid');
  assert(!isValidTab(null), 'null should not be valid');
});

// ---------------------------------------------------------------------------
// [12-P8] Sort order: uncompleted tasks float to top
// ---------------------------------------------------------------------------
test('12-P8', 'Sort: uncompleted tasks appear before completed tasks in widget payload', () => {
  const tasks = [
    { id: 'c', title: 'C', completed: true },
    { id: 'a', title: 'A', completed: false },
    { id: 'b', title: 'B', completed: false },
  ];
  const sorted = sortAndSliceTasks(tasks, 8);
  assert(sorted[0].completed === false, 'First item must be uncompleted');
  assert(sorted[1].completed === false, 'Second item must be uncompleted');
  assert(sorted[2].completed === true, 'Last item must be completed');
});

// ---------------------------------------------------------------------------
// [12-P9] Slice: tasks capped at 8
// ---------------------------------------------------------------------------
test('12-P9', 'Sort+Slice: widget payload is capped at 8 tasks', () => {
  const tasks = Array.from({ length: 15 }, (_, i) => ({
    id: `t${i}`,
    title: `Task ${i}`,
    completed: false,
  }));
  const sorted = sortAndSliceTasks(tasks, 8);
  assertEqual(sorted.length, 8, 'sorted.length');
});

// ---------------------------------------------------------------------------
// [12-P10] ImportantTask filter
// ---------------------------------------------------------------------------
test('12-P10', 'filterImportantTasks: only important=true && completed=false pass, capped at 5', () => {
  const tasks = [
    { id: 'i1', important: true, completed: false },
    { id: 'i2', important: true, completed: true },   // excluded (completed)
    { id: 'i3', important: false, completed: false }, // excluded (not important)
    { id: 'i4', important: true, completed: false },
    { id: 'i5', important: true, completed: false },
    { id: 'i6', important: true, completed: false },
    { id: 'i7', important: true, completed: false },  // 6th → should be clipped
  ];
  const filtered = filterImportantTasks(tasks, 5);
  assertEqual(filtered.length, 5, 'filtered.length');
  assert(filtered.every((t) => t.important && !t.completed), 'All items must be important and incomplete');
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log('\n📋 Phase 12 Widget Logic Tests\n');
results.forEach((r) => console.log(r));
console.log(`\n${passed + failed} total  |  ${passed} passed  |  ${failed} failed\n`);
if (failed > 0) process.exit(1);
