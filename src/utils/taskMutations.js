/**
 * Pure Task Mutation Engine
 * ==========================
 * Framework-agnostic, pure functions for all task transformations, recurrence
 * calculations, subtask mutations, and list management.
 * 
 * Shared across:
 *  - Headless Android widget task handler (widgets/widget-task-handler.tsx)
 *  - Interactive application state (TaskContext.js / App.js)
 */

import { getLocalDateString } from "./dateUtils";
import { generateId } from "./generateId";

/**
 * Calculates the next occurrence for a recurring task.
 * 
 * @param {Object} task - Original recurring task
 * @param {string} [now=new Date().toISOString()] - ISO timestamp for creation/updates
 * @returns {Object} Spawned recurrence task
 */
export const calculateNextRecurrence = (task, now = new Date().toISOString()) => {
  const currentDueDate = task.dueDate || now;
  const date = new Date(currentDueDate);
  if (isNaN(date.getTime())) {
    date.setTime(new Date(now).getTime() || Date.now());
  }

  let newTitle = task.title || task.name || "";
  const recurrence = task.recurrence || "none";

  if (recurrence === "daily") {
    date.setDate(date.getDate() + 1);
  } else if (recurrence === "weekly") {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === "monthly") {
    const originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    date.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  } else if (recurrence === "progressive") {
    date.setDate(date.getDate() + 1);
    // Increment the last number found in title (e.g. "Sprint 1" -> "Sprint 2", "Day 99" -> "Day 100")
    const match = newTitle.match(/\d+(?!.*\d)/);
    if (match) {
      const num = parseInt(match[0], 10);
      newTitle =
        newTitle.substring(0, match.index) +
        (num + 1) +
        newTitle.substring(match.index + match[0].length);
    } else {
      newTitle += " - 2";
    }
  }

  return {
    ...task,
    id: generateId(),
    title: newTitle,
    completed: false,
    completedDate: null,
    completedAt: null,
    dueDate: date.toISOString(),
    createdAt: now,
    updatedAt: now,
    notificationId: null,
  };
};

/**
 * Toggles a task's completion status.
 * If the task is recurring and transitioning from incomplete to complete,
 * it replaces the task with the newly spawned recurrence occurrence.
 * 
 * @param {Array<Object>} tasks - List of tasks
 * @param {string} taskId - ID of task to toggle
 * @param {Object} [options={}] - Optional overrides { now, todayDate }
 * @returns {{ updatedTasks: Array<Object>, toggledTask: Object|null, spawnedTask: Object|null }}
 */
export const toggleTask = (tasks = [], taskId, options = {}) => {
  const now = options.now || new Date().toISOString();
  const todayDate = options.todayDate || getLocalDateString();
  const updatedTasks = [];
  let toggledTask = null;
  let spawnedTask = null;

  for (const task of tasks) {
    if (task.id === taskId) {
      const nextCompleted = !task.completed;
      const isRecurring = task.recurrence && task.recurrence !== "none";

      if (nextCompleted && isRecurring) {
        spawnedTask = calculateNextRecurrence(task, now);
        updatedTasks.push(spawnedTask);
        toggledTask = spawnedTask;
      } else {
        const updated = {
          ...task,
          completed: nextCompleted,
          completedDate: nextCompleted ? todayDate : null,
          completedAt: nextCompleted ? now : null,
          updatedAt: now,
        };
        updatedTasks.push(updated);
        toggledTask = updated;
      }
    } else {
      updatedTasks.push(task);
    }
  }

  return { updatedTasks, toggledTask, spawnedTask };
};

/**
 * Explicitly marks a task as completed.
 * 
 * @param {Array<Object>} tasks
 * @param {string} taskId
 * @param {Object} [options={}]
 * @returns {{ updatedTasks: Array<Object>, completedTask: Object|null }}
 */
export const completeTask = (tasks = [], taskId, options = {}) => {
  const now = options.now || new Date().toISOString();
  const todayDate = options.todayDate || getLocalDateString();
  let completedTask = null;

  const updatedTasks = tasks.map((task) => {
    if (task.id === taskId) {
      completedTask = {
        ...task,
        completed: true,
        completedDate: todayDate,
        completedAt: now,
        updatedAt: now,
      };
      return completedTask;
    }
    return task;
  });

  return { updatedTasks, completedTask };
};

/**
 * Saves a new task or updates an existing task in the list.
 * 
 * @param {Array<Object>} tasks
 * @param {Object} taskData
 * @param {Object} [options={}]
 * @returns {{ updatedTasks: Array<Object>, savedTask: Object }}
 */
export const saveTask = (tasks = [], taskData, options = {}) => {
  const now = options.now || new Date().toISOString();
  const existingIndex = tasks.findIndex((t) => t.id === taskData.id);
  let updatedTasks;
  let savedTask;

  if (existingIndex >= 0) {
    savedTask = {
      ...tasks[existingIndex],
      ...taskData,
      updatedAt: now,
    };
    updatedTasks = [
      ...tasks.slice(0, existingIndex),
      savedTask,
      ...tasks.slice(existingIndex + 1),
    ];
  } else {
    savedTask = {
      ...taskData,
      id: taskData.id || generateId(),
      listId: taskData.listId || "default_inbox",
      completed: false,
      completedDate: null,
      completedAt: null,
      createdAt: taskData.createdAt || now,
      updatedAt: now,
    };
    updatedTasks = [...tasks, savedTask];
  }

  return { updatedTasks, savedTask };
};

/**
 * Deletes a task by ID.
 * 
 * @param {Array<Object>} tasks
 * @param {string} taskId
 * @returns {{ updatedTasks: Array<Object>, deletedTask: Object|null }}
 */
export const deleteTask = (tasks = [], taskId) => {
  const deletedTask = tasks.find((t) => t.id === taskId) || null;
  const updatedTasks = tasks.filter((t) => t.id !== taskId);
  return { updatedTasks, deletedTask };
};

/**
 * Toggles a subtask completion status.
 * 
 * @param {Array<Object>} tasks
 * @param {string} taskId
 * @param {number} subtaskIdx
 * @param {Object} [options={}]
 * @returns {{ updatedTasks: Array<Object>, updatedTask: Object|null }}
 */
export const toggleSubtask = (tasks = [], taskId, subtaskIdx, options = {}) => {
  const now = options.now || new Date().toISOString();
  let updatedTask = null;

  const targetTask = tasks.find((t) => t.id === taskId);
  const subtasks = targetTask?.subtasks;
  if (!targetTask || !Array.isArray(subtasks) || subtaskIdx < 0 || subtaskIdx >= subtasks.length) {
    return { updatedTasks: tasks, updatedTask: null };
  }

  const updatedTasks = tasks.map((task) => {
    if (task.id === taskId) {
      const updatedSubtasks = (task.subtasks || []).map((st, i) => {
        if (i === subtaskIdx) {
          const newCompleted = !st.completed;
          return {
            ...st,
            completed: newCompleted,
            completedAt: newCompleted ? now : null,
          };
        }
        return st;
      });

      updatedTask = {
        ...task,
        subtasks: updatedSubtasks,
        updatedAt: now,
      };
      return updatedTask;
    }
    return task;
  });

  return { updatedTasks, updatedTask };
};

/**
 * Creates a new task list.
 * 
 * @param {Array<Object>} taskLists
 * @param {string} name
 * @returns {{ updatedTaskLists: Array<Object>, createdList: Object }}
 */
export const createTaskList = (taskLists = [], name) => {
  const trimmed = (name || "").trim();
  const createdList = {
    id: generateId(),
    name: trimmed || "New List",
    createdAt: new Date().toISOString(),
  };
  return {
    updatedTaskLists: [...taskLists, createdList],
    createdList,
  };
};

/**
 * Renames an existing task list.
 * 
 * @param {Array<Object>} taskLists
 * @param {string} listId
 * @param {string} newName
 * @returns {{ updatedTaskLists: Array<Object>, renamedList: Object|null }}
 */
export const renameTaskList = (taskLists = [], listId, newName) => {
  let renamedList = null;
  const updatedTaskLists = taskLists.map((list) => {
    if (list.id === listId) {
      renamedList = {
        ...list,
        name: (newName || "").trim() || list.name,
      };
      return renamedList;
    }
    return list;
  });
  return { updatedTaskLists, renamedList };
};

/**
 * Deletes a task list. Cannot delete the default_inbox.
 * 
 * @param {Array<Object>} taskLists
 * @param {string} listId
 * @returns {{ updatedTaskLists: Array<Object>, deletedList: Object|null }}
 */
export const deleteTaskList = (taskLists = [], listId) => {
  if (listId === "default_inbox") {
    return { updatedTaskLists: taskLists, deletedList: null };
  }
  const deletedList = taskLists.find((l) => l.id === listId) || null;
  const updatedTaskLists = taskLists.filter((l) => l.id !== listId);
  return { updatedTaskLists, deletedList };
};

/**
 * Merges in-memory tasks with storage tasks using per-task `updatedAt` reconciliation.
 * Resolves the W-01/W-02/Phase 18 micro-window race:
 * - If a task exists in both, the record with the later `updatedAt` wins.
 * - Tasks present only in storage (e.g. created/spawned by widget or sync) are preserved.
 * - Tasks present only in-memory (e.g. freshly created, not yet persisted) are preserved.
 *
 * @param {Array<Object>} inMemoryTasks
 * @param {Array<Object>} storageTasks
 * @returns {Array<Object>} Reconciled tasks array
 */
export const mergeTasksByUpdatedAt = (inMemoryTasks = [], storageTasks = []) => {
  const mergedMap = new Map();

  // Consider all in-memory tasks (if duplicates exist in memory, newer wins)
  for (const memory of inMemoryTasks || []) {
    if (!memory || !memory.id) continue;
    const existing = mergedMap.get(memory.id);
    if (!existing) {
      mergedMap.set(memory.id, memory);
    } else {
      const existingTime = existing.updatedAt || "";
      const memoryTime = memory.updatedAt || "";
      if (memoryTime > existingTime) {
        mergedMap.set(memory.id, memory);
      }
    }
  }

  // Consider all stored tasks (stored wins if storedTime >= existingTime)
  for (const stored of storageTasks || []) {
    if (!stored || !stored.id) continue;
    const existing = mergedMap.get(stored.id);
    if (!existing) {
      mergedMap.set(stored.id, stored);
    } else {
      const existingTime = existing.updatedAt || "";
      const storedTime = stored.updatedAt || "";
      if (storedTime >= existingTime) {
        mergedMap.set(stored.id, stored);
      }
    }
  }

  return Array.from(mergedMap.values());
};

