import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
} from "../utils/taskMutations";
import {
  scheduleDueDateNotification,
  cancelDueDateNotification,
  schedulePushNotification,
} from "../utils/notifications";
import { STORAGE_VERSION } from "../utils/storage";

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

  // Synchronize when initial props change (e.g. boot loadData)
  useEffect(() => {
    if (initialTasks && initialTasks.length > 0) {
      setTasks(initialTasks);
    }
  }, [initialTasks]);

  useEffect(() => {
    if (initialTaskLists && initialTaskLists !== DEFAULT_TASK_LISTS && initialTaskLists.length > 0) {
      setTaskLists(initialTaskLists);
    }
  }, [initialTaskLists]);

  useEffect(() => {
    if (initialDailyTasks && initialDailyTasks.length > 0) {
      setDailyTasks(initialDailyTasks);
    }
  }, [initialDailyTasks]);

  // Foreground storage re-synchronization (widget updates sync)
  const refreshTasksFromStorage = useCallback(async () => {
    try {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tasks)) {
        setTasks((prevTasks) => {
          // Quick structural equality check
          const prevJson = JSON.stringify(prevTasks);
          const nextJson = JSON.stringify(parsed.tasks);
          if (prevJson !== nextJson) {
            console.log("🔄 Synchronized tasks from storage update");
            return parsed.tasks;
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
      console.error("❌ Failed to refresh tasks from storage:", err);
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
  const toggleTaskComplete = useCallback((id) => {
    setTasks((currentTasks) => {
      const { updatedTasks, spawnedTask } = toggleTask(currentTasks, id);
      if (spawnedTask && spawnedTask.dueDate) {
        scheduleDueDateNotification(spawnedTask).then((notificationId) => {
          if (notificationId) {
            setTasks((prev) =>
              prev.map((t) => (t.id === spawnedTask.id ? { ...t, notificationId } : t))
            );
          }
        });
      }
      return updatedTasks;
    });
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

    schedulePushNotification({
      title: "Task Completed! ✨",
      body: "Great job! Another one bites the dust.",
    });
  }, []);

  const deleteTask = useCallback((id, customConfirm = null) => {
    const executeDelete = () => {
      setTasks((currentTasks) => {
        const { updatedTasks, deletedTask } = deleteTaskMutation(currentTasks, id);
        if (deletedTask?.notificationId) {
          cancelDueDateNotification(deletedTask.notificationId);
        }
        return updatedTasks;
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

    // Cancel old notification if due date changed
    if (taskToSave.id) {
      const existing = tasks.find((t) => t.id === taskToSave.id);
      if (existing?.notificationId && existing.dueDate !== taskToSave.dueDate) {
        await cancelDueDateNotification(existing.notificationId);
      }
    }

    // Schedule notification if due date is present
    let notificationId = taskToSave.notificationId || null;
    if (taskToSave.dueDate) {
      const nid = await scheduleDueDateNotification(taskToSave);
      if (nid) notificationId = nid;
    }

    setTasks((currentTasks) => {
      const { updatedTasks } = saveTask(currentTasks, {
        ...taskToSave,
        notificationId,
      });
      return updatedTasks;
    });
  }, [tasks]);

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
    setTaskLists((currentLists) => {
      const { updatedTaskLists } = deleteTaskList(currentLists, listId);
      return updatedTaskLists;
    });
  }, []);

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
