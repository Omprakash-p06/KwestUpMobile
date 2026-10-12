import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { generateId } from "../utils/generateId";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  toggleTask,
  completeTask,
  saveTask,
  deleteTask as deleteTaskMutation,
  toggleSubtask,
  createTaskList,
  renameTaskList,
  deleteTaskList,
  mergeTasksByUpdatedAt,
} from "../utils/taskMutations";
import {
  scheduleDueDateReminder,
  scheduleNotification,
  cancelNotification,
} from "../services/notificationService";
import { STORAGE_VERSION } from "../utils/storage";
import { logger } from "../utils/logger";
import { eventBus } from "../behavior/eventBus";

const TaskContext = createContext(null);

const DEFAULT_TASKS = [];
const DEFAULT_TASK_LISTS = [{ id: "default_inbox", name: "My Tasks" }];
const DEFAULT_DAILY_TASKS = [];

export const TaskProvider = ({
  children,
  initialTasks = DEFAULT_TASKS,
  initialTaskLists = DEFAULT_TASK_LISTS,
  initialDailyTasks = DEFAULT_DAILY_TASKS,
  showConfirmationDialog = null,
}) => {
  const [tasks, setTasks] = useState(initialTasks);
  const [taskLists, setTaskLists] = useState(initialTaskLists);
  const [dailyTasks, setDailyTasks] = useState(initialDailyTasks);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const prevInitialTasksRef = useRef(initialTasks);
  const tasksHydratedRef = useRef(Array.isArray(initialTasks) && initialTasks.length > 0);

  // Synchronize when initial props change (e.g. boot loadData, sync, reset).
  useEffect(() => {
    if (Array.isArray(initialTasks) && initialTasks !== prevInitialTasksRef.current) {
      prevInitialTasksRef.current = initialTasks;
      if (!tasksHydratedRef.current || initialTasks.length === 0) {
        setTasks(initialTasks);
        if (initialTasks.length > 0) {
          tasksHydratedRef.current = true;
        }
      } else {
        setTasks((prevTasks) => mergeTasksByUpdatedAt(prevTasks, initialTasks));
      }
    }
  }, [initialTasks]);

  useEffect(() => {
    if (Array.isArray(initialTaskLists) && initialTaskLists !== DEFAULT_TASK_LISTS) {
      setTaskLists(initialTaskLists);
    }
  }, [initialTaskLists]);

  useEffect(() => {
    if (Array.isArray(initialDailyTasks)) {
      setDailyTasks(initialDailyTasks);
    }
  }, [initialDailyTasks]);

  // Eager write-through persistence (W-01/W-02 fix): TaskContext is the sole
  // writer of the tasks/taskLists/dailyTasks keys. Every mutation persists to
  // AsyncStorage via a short debounce (≤1s) using read-modify-write, so the
  // sibling domains App.js still persists (birthdays/notes/theme) are never
  // clobbered. Writes use the computed state snapshot — never inside a React
  // updater — to avoid StrictMode double-invocation double-writes.
  const storageWriteTimerRef = useRef(null);
  const lastPersistedJsonRef = useRef(null);

  const writeTaskSnapshot = useCallback(async (snapshot) => {
    try {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      const raw = await AsyncStorage.getItem(storageKey);
      const stored = raw ? JSON.parse(raw) : {};
      const mergedTasks = mergeTasksByUpdatedAt(snapshot.tasks, stored.tasks || []);
      const merged = {
        ...stored,
        tasks: mergedTasks,
        taskLists: snapshot.taskLists,
        dailyTasks: snapshot.dailyTasks,
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify(merged));
      lastPersistedJsonRef.current = JSON.stringify({
        tasks: mergedTasks,
        taskLists: snapshot.taskLists,
        dailyTasks: snapshot.dailyTasks,
      });
    } catch (err) {
      logger.error("❌ Failed to persist tasks to storage:", err);
    }
  }, []);

  useEffect(() => {
    const snapshot = { tasks, taskLists, dailyTasks };
    const snapshotJson = JSON.stringify(snapshot);
    if (snapshotJson === lastPersistedJsonRef.current) return;
    if (storageWriteTimerRef.current) clearTimeout(storageWriteTimerRef.current);
    storageWriteTimerRef.current = setTimeout(async () => {
      storageWriteTimerRef.current = null;
      // Boot guard: while App.js hasn't loaded data yet, in-memory task state
      // is still the boot empty — never let that wipe real storage content.
      if (!tasksHydratedRef.current) {
        try {
          const storageKey = `kwestup_data_${STORAGE_VERSION}`;
          const raw = await AsyncStorage.getItem(storageKey);
          const stored = raw ? JSON.parse(raw) : {};
          const inMemoryEmpty =
            tasks.length === 0 &&
            dailyTasks.length === 0 &&
            (taskLists.length === 0 ||
              (taskLists.length === 1 && taskLists[0].id === "default_inbox"));
          if (inMemoryEmpty && Array.isArray(stored.tasks) && stored.tasks.length > 0) {
            return;
          }
        } catch {
          // If storage is unreadable, fall through and attempt the write.
        }
      }
      tasksHydratedRef.current = true;
      await writeTaskSnapshot(snapshot);
    }, 500);
    return () => {
      if (storageWriteTimerRef.current) clearTimeout(storageWriteTimerRef.current);
    };
  }, [tasks, taskLists, dailyTasks, writeTaskSnapshot]);

  // Foreground storage re-synchronization (widget updates sync)
  const refreshTasksFromStorage = useCallback(async () => {
    try {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tasks)) {
        setTasks((prevTasks) => {
          const merged = mergeTasksByUpdatedAt(prevTasks, parsed.tasks);
          const prevJson = JSON.stringify(prevTasks);
          const nextJson = JSON.stringify(merged);
          if (prevJson !== nextJson) {
            logger.info("🔄 Synchronized tasks from storage update");
            return merged;
          }
          return prevTasks;
        });
      }
      if (Array.isArray(parsed.taskLists)) {
        setTaskLists((prevLists) => {
          const prevJson = JSON.stringify(prevLists);
          const nextJson = JSON.stringify(parsed.taskLists);
          if (prevJson !== nextJson) {
            return parsed.taskLists;
          }
          return prevLists;
        });
      }
      if (Array.isArray(parsed.dailyTasks)) {
        setDailyTasks((prevDaily) => {
          const prevJson = JSON.stringify(prevDaily);
          const nextJson = JSON.stringify(parsed.dailyTasks);
          if (prevJson !== nextJson) {
            return parsed.dailyTasks;
          }
          return prevDaily;
        });
      }
    } catch (err) {
      logger.error("❌ Failed to refresh tasks from storage:", err);
    }
  }, []);

  // Listen for AppState changes to active
  useEffect(() => {
    let subscription = null;
    if (AppState && typeof AppState.addEventListener === "function") {
      subscription = AppState.addEventListener("change", (nextAppState) => {
        if (nextAppState === "active") {
          refreshTasksFromStorage();
        }
      });
    }

    return () => {
      if (subscription && typeof subscription.remove === "function") {
        subscription.remove();
      } else if (AppState && typeof AppState.removeEventListener === "function") {
        AppState.removeEventListener("change", () => {});
      }
    };
  }, [refreshTasksFromStorage]);

  // Task Action Handlers
  // DEF-01: Compute toggleTask inside functional updater to eliminate closure races
  const toggleTaskComplete = useCallback((id) => {
    let spawnedTaskToSchedule = null;
    let wasCompleted = false;
    let targetTitle = "";

    setTasks((currentTasks) => {
      const target = currentTasks.find((t) => t.id === id);
      if (target) {
        wasCompleted = Boolean(target.completed);
        targetTitle = target.title || "";
      }

      const { updatedTasks, spawnedTask } = toggleTask(currentTasks, id);
      spawnedTaskToSchedule = spawnedTask;
      return updatedTasks;
    });

    if (spawnedTaskToSchedule && spawnedTaskToSchedule.dueDate) {
      scheduleDueDateReminder(spawnedTaskToSchedule)
        .then((notificationId) => {
          if (notificationId) {
            setTasks((prev) =>
              prev.map((t) => (t.id === spawnedTaskToSchedule.id ? { ...t, notificationId } : t))
            );
          }
        })
        .catch((e) => logger.warn("Reminder schedule failed:", e));
    }

    if (!wasCompleted) {
      eventBus.emit({
        type: "TASK_COMPLETED",
        entityId: id,
        source: "app",
        payload: { title: targetTitle, completed: true },
      });
    } else {
      eventBus.emit({
        type: "TASK_UPDATED",
        entityId: id,
        source: "app",
        payload: { title: targetTitle, completed: false },
      });
    }
  }, []);


  const handleCompleteTask = useCallback((taskId) => {
    setTasks((currentTasks) => {
      const { updatedTasks } = completeTask(currentTasks, taskId);
      return updatedTasks;
    });

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    }

    scheduleNotification({
      category: "system",
      payloadKey: `task_complete_${taskId}_${generateId()}`,
      recurrence: "one-shot",
      channelId: "kwestup_system",
      title: "Task Completed! ✨",
      body: "Great job! Another one bites the dust.",
    });

    eventBus.emit({
      type: "TASK_COMPLETED",
      entityId: taskId,
      source: "app",
      payload: { completed: true },
    });
  }, []);

  const deleteTask = useCallback((id, customConfirm = null) => {
    const executeDelete = () => {
      setTasks((currentTasks) => {
        const { updatedTasks, deletedTask } = deleteTaskMutation(currentTasks, id);
        if (deletedTask?.notificationId) {
          cancelNotification(deletedTask.notificationId);
        }
        return updatedTasks;
      });

      eventBus.emit({
        type: "TASK_DELETED",
        entityId: id,
        source: "app",
      });
    };

    const confirmFn = customConfirm || showConfirmationDialog;
    if (confirmFn) {
      confirmFn(
        "Are you sure you want to delete this task?",
        executeDelete,
        () => {}
      );
    } else {
      executeDelete();
    }
  }, [showConfirmationDialog]);

  const handleSaveTask = useCallback(async (taskData) => {
    const taskToSave = {
      ...taskData,
      listId: taskData.listId || "default_inbox",
    };

    // Schedule notification if due date is present
    let notificationId = taskToSave.notificationId || null;
    if (taskToSave.dueDate) {
      const nid = await scheduleDueDateReminder(taskToSave);
      if (nid) notificationId = nid;
    }

    let isUpdate = false;
    let savedTaskResult = null;

    setTasks((currentTasks) => {
      isUpdate = Boolean(taskToSave.id && currentTasks.some((t) => t.id === taskToSave.id));
      if (isUpdate && taskToSave.id) {
        const existing = currentTasks.find((t) => t.id === taskToSave.id);
        if (existing?.notificationId && existing.dueDate !== taskToSave.dueDate) {
          cancelNotification(existing.notificationId).catch(() => {});
        }
      }

      const { updatedTasks, savedTask } = saveTask(currentTasks, {
        ...taskToSave,
        notificationId,
      });
      savedTaskResult = savedTask;
      return updatedTasks;
    });

    if (savedTaskResult) {
      eventBus.emit({
        type: isUpdate ? "TASK_UPDATED" : "TASK_CREATED",
        entityId: savedTaskResult.id,
        source: "app",
        payload: {
          title: savedTaskResult.title,
          listId: savedTaskResult.listId,
          dueDate: savedTaskResult.dueDate,
          recurrence: savedTaskResult.recurrence,
        },
      });
    }
  }, []);

  const handleToggleSubtask = useCallback((taskId, subtaskIdx) => {
    setTasks((currentTasks) => {
      const { updatedTasks } = toggleSubtask(currentTasks, taskId, subtaskIdx);
      return updatedTasks;
    });
  }, []);

  const handleCreateList = useCallback((name) => {
    setTaskLists((currentLists) => {
      const { updatedTaskLists } = createTaskList(currentLists, name);
      return updatedTaskLists;
    });
  }, []);

  const handleRenameList = useCallback((listId, newName) => {
    setTaskLists((currentLists) => {
      const { updatedTaskLists } = renameTaskList(currentLists, listId, newName);
      return updatedTaskLists;
    });
  }, []);

  const handleDeleteList = useCallback((listId) => {
    if (listId === "default_inbox") {
      if (showConfirmationDialog) {
        showConfirmationDialog("You cannot delete the default task list.", () => {});
      }
      return;
    }
    const executeDelete = () => {
      // Preserve App.js behavior: tasks inside the deleted list are removed
      // and their scheduled notifications cancelled.
      setTasks((currentTasks) => {
        currentTasks.forEach((task) => {
          if (task.listId === listId && task.notificationId) {
            cancelNotification(task.notificationId);
          }
        });
        return currentTasks.filter((task) => task.listId !== listId);
      });
      setTaskLists((currentLists) => {
        const { updatedTaskLists } = deleteTaskList(currentLists, listId);
        return updatedTaskLists;
      });
    };
    if (showConfirmationDialog) {
      showConfirmationDialog(
        "Are you sure you want to delete this list? All tasks inside will be permanently deleted.",
        executeDelete,
        () => {}
      );
    } else {
      executeDelete();
    }
  }, [showConfirmationDialog]);

  const value = {
    tasks,
    setTasks,
    taskLists,
    setTaskLists,
    dailyTasks,
    setDailyTasks,
    selectedTask,
    setSelectedTask,
    modalVisible,
    setModalVisible,
    toggleTaskComplete,
    handleCompleteTask,
    deleteTask,
    handleSaveTask,
    handleToggleSubtask,
    handleCreateList,
    handleRenameList,
    handleDeleteList,
    refreshTasksFromStorage,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  return context;
};

export default TaskContext;
