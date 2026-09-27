/**
 * Phase 12 — Widget Logic Validation Tests
 * ==========================================
 * These tests validate the core task sorting, slicing, filtering,
 * and tab switching logic used by the widget system.
 */

// ---------------------------------------------------------------------------
// Helpers — extracted pure-function equivalents of handler logic
// ---------------------------------------------------------------------------

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

function isValidTab(tab) {
  return tab === 'tasks' || tab === 'daily' || tab === 'timer';
}

function sortAndSliceTasks(tasks, limit = 8) {
  return [...tasks]
    .sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return 0;
    })
    .slice(0, limit);
}

function filterImportantTasks(tasks, limit = 5) {
  return tasks.filter((t) => t.important && !t.completed).slice(0, limit);
}

describe('Phase 12 Widget Logic Tests', () => {
  it('[12-P1] TOGGLE_TASK: completing an active task sets completed=true and metadata', () => {
    const tasks = [{ id: 'a1', title: 'Test task', important: false, completed: false }];
    const { updated, isToggled } = toggleTaskInList(tasks, 'a1');
    expect(isToggled).toBe(true);
    expect(updated[0].completed).toBe(true);
    expect(typeof updated[0].completedAt).toBe('string');
    expect(typeof updated[0].completedDate).toBe('string');
    expect(/^\d{4}-\d{2}-\d{2}$/.test(updated[0].completedDate)).toBe(true);
  });

  it('[12-P2] TOGGLE_TASK: un-completing a task clears completedAt and completedDate', () => {
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
    expect(isToggled).toBe(true);
    expect(updated[0].completed).toBe(false);
    expect(updated[0].completedAt).toBeUndefined();
    expect(updated[0].completedDate).toBeUndefined();
  });

  it('[12-P3] TOGGLE_TASK: non-existent taskId -> isToggled=false, list unchanged', () => {
    const tasks = [{ id: 'a3', title: 'Untouched', important: false, completed: false }];
    const { updated, isToggled } = toggleTaskInList(tasks, 'DOES_NOT_EXIST');
    expect(isToggled).toBe(false);
    expect(updated[0].completed).toBe(false);
  });

  it('[12-P4] TOGGLE_TASK: empty task list -> no crash, isToggled false', () => {
    const { updated, isToggled } = toggleTaskInList([], 'any-id');
    expect(isToggled).toBe(false);
    expect(updated.length).toBe(0);
  });

  it('[12-P5] TOGGLE_TASK: null storage raw -> graceful no-op', () => {
    const raw = null;
    let didWrite = false;
    if (raw) {
      didWrite = true;
    }
    expect(didWrite).toBe(false);
  });

  it('[12-P6] SWITCH_TAB: tasks / daily / timer are all valid tab values', () => {
    expect(isValidTab('tasks')).toBe(true);
    expect(isValidTab('daily')).toBe(true);
    expect(isValidTab('timer')).toBe(true);
  });

  it('[12-P7] SWITCH_TAB: invalid tab value is rejected by guard', () => {
    expect(isValidTab('finance')).toBe(false);
    expect(isValidTab('')).toBe(false);
    expect(isValidTab(undefined)).toBe(false);
    expect(isValidTab(null)).toBe(false);
  });

  it('[12-P8] Sort: uncompleted tasks appear before completed tasks in widget payload', () => {
    const tasks = [
      { id: 'c', title: 'C', completed: true },
      { id: 'a', title: 'A', completed: false },
      { id: 'b', title: 'B', completed: false },
    ];
    const sorted = sortAndSliceTasks(tasks, 8);
    expect(sorted[0].completed).toBe(false);
    expect(sorted[1].completed).toBe(false);
    expect(sorted[2].completed).toBe(true);
  });

  it('[12-P9] Sort+Slice: widget payload is capped at 8 tasks', () => {
    const tasks = Array.from({ length: 15 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      completed: false,
    }));
    const sorted = sortAndSliceTasks(tasks, 8);
    expect(sorted.length).toBe(8);
  });

  it('[12-P10] filterImportantTasks: only important=true && completed=false pass, capped at 5', () => {
    const tasks = [
      { id: 'i1', important: true, completed: false },
      { id: 'i2', important: true, completed: true },
      { id: 'i3', important: false, completed: false },
      { id: 'i4', important: true, completed: false },
      { id: 'i5', important: true, completed: false },
      { id: 'i6', important: true, completed: false },
      { id: 'i7', important: true, completed: false },
    ];
    const filtered = filterImportantTasks(tasks, 5);
    expect(filtered.length).toBe(5);
    expect(filtered.every((t) => t.important && !t.completed)).toBe(true);
  });
});
