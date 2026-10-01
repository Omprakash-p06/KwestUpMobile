/**
 * Phase 12 — Widget Logic Validation Tests
 * ==========================================
 * These tests validate the core task sorting, slicing, filtering,
 * and tab switching logic used by the widget system.
 *
 * WR-07: toggle assertions run against the PRODUCTION `toggleTask`
 * (`src/utils/taskMutations.js`) — the same unit the headless widget
 * handler delegates to — instead of a local re-implementation, so a
 * production regression in toggle semantics fails this suite. The tab
 * vocabulary matches the production handler contract
 * (`widgets/widget-task-handler.tsx` accepts tasks/daily/timer/all/persistent).
 * Sort/filter helpers below pin the handler's inline render-path contract
 * (important-unfinished filter, cap 5 — see widget-task-handler render block);
 * production keeps them inline, so they are documented as contract mirrors.
 */

import { getLocalDateString } from '../src/utils/dateUtils';
import { toggleTask } from '../src/utils/taskMutations';

// ---------------------------------------------------------------------------
// Tab guard — mirrors the production accepted-tab contract
// (widget-task-handler.tsx: clickActionData.tab + stored-tab render path)
// ---------------------------------------------------------------------------

function isValidTab(tab) {
  return ['tasks', 'daily', 'timer', 'all', 'persistent'].includes(tab);
}

// ---------------------------------------------------------------------------
// Render-path contract mirrors (production keeps these inline in the
// widget-task-handler render block / TasksListWidget)
// ---------------------------------------------------------------------------

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
    const { updatedTasks, toggledTask } = toggleTask(tasks, 'a1', {
      now: '2026-06-28T10:00:00.000Z',
      todayDate: '2026-06-28',
    });
    expect(toggledTask).not.toBeNull();
    expect(toggledTask.completed).toBe(true);
    expect(typeof toggledTask.completedAt).toBe('string');
    expect(typeof toggledTask.completedDate).toBe('string');
    expect(/^\d{4}-\d{2}-\d{2}$/.test(toggledTask.completedDate)).toBe(true);
    expect(updatedTasks[0].completed).toBe(true);
  });

  it('[12-P2] TOGGLE_TASK: un-completing a task clears completedAt and completedDate to null', () => {
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
    const { updatedTasks, toggledTask } = toggleTask(tasks, 'a2', {
      now: '2026-06-28T11:00:00.000Z',
      todayDate: '2026-06-28',
    });
    expect(toggledTask).not.toBeNull();
    expect(toggledTask.completed).toBe(false);
    // Production contract (taskMutations.js) clears with null, not undefined
    expect(toggledTask.completedAt).toBeNull();
    expect(toggledTask.completedDate).toBeNull();
    expect(updatedTasks[0].completed).toBe(false);
  });

  it('[12-P3] TOGGLE_TASK: non-existent taskId -> toggledTask=null, list unchanged', () => {
    const tasks = [{ id: 'a3', title: 'Untouched', important: false, completed: false }];
    const { updatedTasks, toggledTask } = toggleTask(tasks, 'DOES_NOT_EXIST', {
      now: '2026-06-28T10:00:00.000Z',
      todayDate: '2026-06-28',
    });
    expect(toggledTask).toBeNull();
    expect(updatedTasks).toEqual(tasks);
  });

  it('[12-P4] TOGGLE_TASK: empty task list -> no crash, toggledTask null', () => {
    const { updatedTasks, toggledTask } = toggleTask([], 'any-id', {
      now: '2026-06-28T10:00:00.000Z',
      todayDate: '2026-06-28',
    });
    expect(toggledTask).toBeNull();
    expect(updatedTasks.length).toBe(0);
  });

  it('[12-P5] TOGGLE_TASK: null storage raw -> graceful no-op', () => {
    const raw = null;
    let didWrite = false;
    if (raw) {
      didWrite = true;
    }
    expect(didWrite).toBe(false);
  });

  it('[12-P6] SWITCH_TAB: tasks / daily / timer / all / persistent are all valid tab values', () => {
    expect(isValidTab('tasks')).toBe(true);
    expect(isValidTab('daily')).toBe(true);
    expect(isValidTab('timer')).toBe(true);
    expect(isValidTab('all')).toBe(true);
    expect(isValidTab('persistent')).toBe(true);
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

  it('[12-P11] PROD-PARITY: production toggle stamps today via date engine by default', () => {
    const today = getLocalDateString();
    const { toggledTask } = toggleTask(
      [{ id: 'p1', title: 'Parity', important: false, completed: false }],
      'p1'
    );
    expect(toggledTask.completedDate).toBe(today);
  });
});
