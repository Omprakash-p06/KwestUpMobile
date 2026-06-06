import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Platform, ActivityIndicator, AppState, Linking } from "react-native";
import { PaperProvider } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import Modal from "react-native-modal";
import ConfettiCannon from "react-native-confetti-cannon";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";

// Component imports
import { CustomButton } from "./src/components/CustomButton";
import { CustomTextInput } from "./src/components/CustomTextInput";
import { TaskEditModal } from "./src/components/TaskEditModal";
import { TimerLockoutOverlay } from "./src/components/TimerLockoutOverlay";
import { LiquidGlassBackground } from "./src/components/LiquidGlassBackground";
import { AIAssistant } from "./src/components/AIAssistant";

// Theme and Navigation imports
import { themes } from "./src/theme/colors";
import { styles } from "./src/theme/styles";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { initNotesFolder, getAllNotesFromFilesystem, wipeNotesFilesystem, saveNoteFile } from "./src/utils/fileStorage";
import { migrateToVaultSystem, getVaults, getActiveVaultId, setActiveVaultId } from "./src/utils/vaultService";

// Utility imports
import { APP_VERSION, STORAGE_VERSION, clearAllCaches } from "./src/utils/storage";
import { runDeviceDiagnostics, runNetworkDiagnostics, checkForUpdates, DEBUG_MODE } from "./src/utils/diagnostics";
import {
  requestNotificationPermissions,
  scheduleDailyTaskNotification,
  schedulePushNotification,
  scheduleDueDateNotification,
  cancelDueDateNotification,
  cancelCustomBirthdayReminders,
  scheduleCustomBirthdayReminders
} from "./src/utils/notifications";
import { performSync } from "./src/utils/syncService";
import { requestWidgetUpdate } from 'react-native-android-widget';
import { FocusTimerWidget } from './widgets/FocusTimerWidget';
import { DailyTasksWidget } from './widgets/DailyTasksWidget';
import { ImportantTasksWidget } from './widgets/ImportantTasksWidget';

// Configuration
const FORCE_CLEAR_ALL_STORAGE = false;

const VALID_THEME_MODES = ["light", "dark", "amoled"];
const VALID_THEME_NAMES = ["clean", "blue", "green", "purple", "dribbble"];

const resolveThemeMode = (value) => (VALID_THEME_MODES.includes(value) ? value : "light");
const resolveThemeName = (value) => (VALID_THEME_NAMES.includes(value) ? value : "dribbble");

const App = () => {
  console.log("🚀 KWESTUP MAIN APP COMPONENT LOADING...");

  const [fontsLoaded] = useFonts({
    "Inter-Regular": Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
    "HankenGrotesk-Regular": HankenGrotesk_400Regular,
    "HankenGrotesk-Medium": HankenGrotesk_500Medium,
    "HankenGrotesk-Bold": HankenGrotesk_700Bold,
    "HankenGrotesk-ExtraBold": HankenGrotesk_800ExtraBold,
    "JetBrainsMono-Regular": JetBrainsMono_400Regular,
    "JetBrainsMono-Medium": JetBrainsMono_500Medium,
    "JetBrainsMono-Bold": JetBrainsMono_700Bold,
  });

  const [dailyTasks, setDailyTasks] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskLists, setTaskLists] = useState([
    { id: "default_inbox", name: "My Tasks", createdAt: new Date().toISOString() }
  ]);
  const [notes, setNotes] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [timerDuration, setTimerDuration] = useState(25 * 60);
  const [timerRemaining, setTimerRemaining] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showTimerLockout, setShowTimerLockout] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const confirmationActionRef = useRef(null);
  const confirmationCancelActionRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const [themeMode, setThemeMode] = useState("light"); // "light", "dark", "amoled"
  const [selectedThemeName, setSelectedThemeName] = useState("dribbble"); // Default to dribbble theme
  const [userName, setUserName] = useState("");
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSynced, setLastSynced] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [vaults, setVaults] = useState([]);
  const [activeVaultId, setActiveVaultIdState] = useState("default");
  const [activeNote, setActiveNote] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  // Throttling refs to prevent Binder flooding on sensitive devices (NothingOS)
  const lastSaveTimeRef = useRef(0);
  const lastWidgetUpdateTimeRef = useRef(0);

  // AppState monitoring to prevent background Binder flooding
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  // Define currentTheme with fallback to prevent undefined errors
  const resolvedThemeName = resolveThemeName(selectedThemeName);
  const resolvedThemeMode = resolveThemeMode(themeMode);

  const currentTheme = themes[resolvedThemeName]?.[resolvedThemeMode] || themes.dribbble.light;

  const initializeApp = useCallback(async () => {
    setIsLoading(true);
    try {
      // Run one-time migration from flat Notes/ to multi-vault Notes/Vaults/
      await migrateToVaultSystem();

      // Load vault metadata
      const loadedVaults = await getVaults();
      setVaults(loadedVaults);
      const activeId = await getActiveVaultId();
      const resolvedActiveId = activeId || "default";
      setActiveVaultIdState(resolvedActiveId);

      await initNotesFolder(resolvedActiveId);
      runDeviceDiagnostics();
      await runNetworkDiagnostics();

      if (FORCE_CLEAR_ALL_STORAGE) {
        await clearAllCaches();
      }

      const lastVersion = await AsyncStorage.getItem("kwestup_last_version");
      if (lastVersion !== APP_VERSION) {
        console.log("🔄 Version change detected, clearing caches...");
        await clearAllCaches();
      }

      const storedUserName = await AsyncStorage.getItem(`kwestup_userName_${STORAGE_VERSION}`);
      if (storedUserName) {
        setUserName(storedUserName);
        setShowNameDialog(false);
      } else {
        setShowNameDialog(true);
      }

      setIsInitialized(true);
      setIsLoading(false);
    } catch (error) {
      console.error("❌ APP INITIALIZATION FAILED:", error);
      setIsInitialized(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Save userName to AsyncStorage immediately when set
  useEffect(() => {
    if (userName && userName.trim()) {
      AsyncStorage.setItem(`kwestup_userName_${STORAGE_VERSION}`, userName);
    }
  }, [userName]);

  const loadData = useCallback(async () => {
    if (!isInitialized) return;

    try {
      const themeModeKey = `kwestup_theme_mode_${STORAGE_VERSION}`;
      const themeNameKey = `kwestup_theme_name_${STORAGE_VERSION}`;
      const [storedDataRaw, storedTimerRaw, storedUserName, storedThemeMode, storedThemeName] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(timerKey),
        AsyncStorage.getItem(`kwestup_userName_${STORAGE_VERSION}`),
        AsyncStorage.getItem(themeModeKey),
        AsyncStorage.getItem(themeNameKey),
      ]);

      // Resolve active vault for this load cycle
      const activeId = activeVaultId || (await getActiveVaultId()) || "default";

      if (storedDataRaw) {
        const parsedData = JSON.parse(storedDataRaw);
        setDailyTasks(parsedData.dailyTasks || []);
        setBirthdays(parsedData.birthdays || []);
        setTasks(parsedData.tasks || []);
        setTaskLists(parsedData.taskLists || [
          { id: "default_inbox", name: "My Tasks", createdAt: new Date().toISOString() }
        ]);
        const fsNotes = await getAllNotesFromFilesystem(activeId);
        setNotes(fsNotes);
        
        if (storedThemeMode) {
          setThemeMode(resolveThemeMode(storedThemeMode));
        } else {
          setThemeMode(resolveThemeMode(parsedData.themeMode));
        }

        if (storedThemeName) {
          setSelectedThemeName(resolveThemeName(storedThemeName));
        } else {
          setSelectedThemeName(resolveThemeName(parsedData.selectedThemeName));
        }

        setLastSynced(parsedData.lastSynced || null);
        if (storedUserName) setUserName(storedUserName);
        else setUserName(parsedData.userName || "");

        // Timer state can come from either main data (legacy) or dedicated key
        const timerState = storedTimerRaw ? JSON.parse(storedTimerRaw) : parsedData.timerState;
        
        if (timerState) {
          const { duration, remaining, isRunning, startTime } = timerState;
          setTimerDuration(duration);
          if (isRunning && startTime) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const newRemaining = Math.max(0, duration - elapsed);
            setTimerRemaining(newRemaining);
            setIsTimerRunning(newRemaining > 0);
            setShowTimerLockout(newRemaining > 0);
          } else {
            setTimerRemaining(remaining);
            setIsTimerRunning(false);
            setShowTimerLockout(false);
          }
        }
      } else {
        setDailyTasks([]);
        setBirthdays([]);
        setTasks([]);
        setTaskLists([
          { id: "default_inbox", name: "My Tasks", createdAt: new Date().toISOString() }
        ]);
        const fsNotes = await getAllNotesFromFilesystem(activeId);
        setNotes(fsNotes);
        if (storedThemeMode) {
          setThemeMode(resolveThemeMode(storedThemeMode));
        } else {
          setThemeMode("light");
        }

        if (storedThemeName) {
          setSelectedThemeName(resolveThemeName(storedThemeName));
        } else {
          setSelectedThemeName("dribbble");
        }

        setLastSynced(null);
        setUserName(storedUserName || "");
      }
    } catch (error) {
      setDailyTasks([]);
      setBirthdays([]);
      setTasks([]);
      setTaskLists([
        { id: "default_inbox", name: "My Tasks", createdAt: new Date().toISOString() }
      ]);
      const fsNotes = await getAllNotesFromFilesystem(activeVaultId || "default");
      setNotes(fsNotes);
      setThemeMode("light");
      setSelectedThemeName("dribbble");
      setLastSynced(null);
    }
  }, [isInitialized, activeVaultId]);

  const saveData = useCallback(async () => {
    if (!isInitialized) return;

    // DECOUPLE: Main data save no longer includes high-frequency timer state.
    // This prevents Binder transaction failures (-22) when saving large datasets.
    const dataToSave = {
      dailyTasks,
      birthdays,
      tasks,
      taskLists,
      notes,
      themeMode,
      selectedThemeName,
      userName,
      lastSynced,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };

    try {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));
      console.log("💾 Main data saved successfully to:", storageKey);
      lastSaveTimeRef.current = Date.now();
    } catch (error) {
      console.error("❌ Failed to save main data:", error);
    }
  }, [
    dailyTasks,
    birthdays,
    tasks,
    taskLists,
    notes,
    themeMode,
    selectedThemeName,
    userName,
    lastSynced,
    isInitialized,
  ]);

  const saveTimerState = useCallback(async () => {
    if (!isInitialized) return;

    const timerState = {
      duration: timerDuration,
      remaining: timerRemaining,
      isRunning: isTimerRunning,
      startTime: isTimerRunning ? Date.now() - (timerDuration - timerRemaining) * 1000 : null,
    };

    try {
      const timerKey = `kwestup_timer_state_${STORAGE_VERSION}`;
      await AsyncStorage.setItem(timerKey, JSON.stringify(timerState));
      // Log only on changes to avoid console spam, or keep silent
    } catch (error) {
      console.error("❌ Failed to save timer state:", error);
    }
  }, [timerDuration, timerRemaining, isTimerRunning, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      requestNotificationPermissions();
      loadData();
    }
  }, [isInitialized, loadData]);

  // Main data save trigger with 15-second throttle to protect Binder buffer
  useEffect(() => {
    if (isInitialized) {
      const now = Date.now();
      if (now - lastSaveTimeRef.current > 15000) {
        saveData();
      } else {
        const timeout = setTimeout(saveData, 15000 - (now - lastSaveTimeRef.current));
        return () => clearTimeout(timeout);
      }
    }
  }, [
    dailyTasks,
    birthdays,
    tasks,
    taskLists,
    notes,
    themeMode,
    selectedThemeName,
    userName,
    lastSynced,
    isInitialized,
    saveData,
  ]);

  // High-frequency timer state save (minimal payload)
  useEffect(() => {
    if (isInitialized) {
      saveTimerState();
    }
  }, [timerRemaining, isTimerRunning, isInitialized, saveTimerState]);

  // Save theme state immediately to separate keys
  useEffect(() => {
    if (isInitialized) {
      AsyncStorage.setItem(`kwestup_theme_mode_${STORAGE_VERSION}`, themeMode);
    }
  }, [themeMode, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      AsyncStorage.setItem(`kwestup_theme_name_${STORAGE_VERSION}`, selectedThemeName);
    }
  }, [selectedThemeName, isInitialized]);

  // Background check for updates after initialization finishes
  useEffect(() => {
    if (isInitialized) {
      const timer = setTimeout(() => {
        checkForUpdates((updateInfo) => {
          showConfirmation(
            `A new update is available: ${updateInfo.latestVersion}\n\nWould you like to visit the release page to download it?`,
            () => {
              if (updateInfo.releaseUrl) {
                Linking.openURL(updateInfo.releaseUrl).catch((err) =>
                  console.error("Failed to open update URL:", err)
                );
              }
            },
            () => {}
          );
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  // Throttled, Staggered, and AppState-guarded widget updates
  useEffect(() => {
    if (!isInitialized || Platform.OS !== 'android') return;

    // RULE 1: Only push updates if the app is ACTIVE.
    if (appState.current !== 'active') return;

    // RULE 2: 5-second throttle for FocusTimer updates to prevent high-frequency flooding.
    const now = Date.now();
    if (now - lastWidgetUpdateTimeRef.current < 5000) return;

    lastWidgetUpdateTimeRef.current = now;

    requestWidgetUpdate({
      widgetName: 'FocusTimer',
      renderWidget: () => (
        <FocusTimerWidget
          remaining={timerRemaining}
          isRunning={isTimerRunning}
        />
      ),
    });

    // STAGGER: Wait 500ms before sending the next widget update to split Binder payloads.
    const staggerTimer = setTimeout(() => {
      requestWidgetUpdate({
        widgetName: 'DailyTasks',
        renderWidget: () => (
          <DailyTasksWidget
            dailyTaskCount={dailyTasks.length}
            dailyTasksCompleted={dailyTasks.filter(t => t.completed).length}
          />
        ),
      });
    }, 500);

    return () => clearTimeout(staggerTimer);
  }, [timerRemaining, isTimerRunning, dailyTasks, isInitialized]);

  // Update ImportantTasks widget when tasks list changes
  useEffect(() => {
    if (!isInitialized || Platform.OS !== 'android') return;

    // RULE 1: Only push updates if the app is ACTIVE.
    if (appState.current !== 'active') return;

    // SLICE DATA: Only send the first 5 important unfinished tasks to prevent Binder transaction bloat.
    const importantUnfinished = tasks
      .filter((t) => t.important && !t.completed)
      .slice(0, 5);

    requestWidgetUpdate({
      widgetName: 'ImportantTasks',
      renderWidget: () => (
        <ImportantTasksWidget tasks={importantUnfinished} />
      ),
    });
  }, [tasks, isInitialized]);

  const showConfirmation = (message, onConfirm, onCancel = null) => {
    setConfirmationMessage(message);
    confirmationActionRef.current = onConfirm;
    confirmationCancelActionRef.current = onCancel;
    setConfirmationVisible(true);
  };

  const handleConfirmation = () => {
    setConfirmationVisible(false);
    if (confirmationActionRef.current) {
      confirmationActionRef.current();
    }
  };

  const handleCancelConfirmation = () => {
    setConfirmationVisible(false);
    if (confirmationCancelActionRef.current) {
      confirmationCancelActionRef.current();
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (isTimerRunning && timerRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsTimerRunning(false);
            setShowTimerLockout(false);
            showConfirmation("Congratulations! You completed your focus session!", () => {
              setConfettiVisible(true);
            });
            Notifications.scheduleNotificationAsync({
              content: {
                title: "KwestUp Focus Timer",
                body: "Your focus session is complete! Great job!",
                sound: "default",
              },
              trigger: null,
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (!isTimerRunning && timerRemaining === 0) {
      clearInterval(timerIntervalRef.current);
      setShowTimerLockout(false);
    } else if (!isTimerRunning && timerRemaining > 0) {
      clearInterval(timerIntervalRef.current);
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning, timerRemaining]);

  const toggleTaskComplete = (id) => {
    console.log("🔄 Task toggle button pressed for task ID:", id);
    setTasks(
      tasks.map((task) => {
        if (task.id === id) {
          const newCompletedStatus = !task.completed;
          console.log("📊 Toggling task:", task.title || task.name, "from", task.completed, "to", newCompletedStatus);
          return {
            ...task,
            completed: newCompletedStatus,
            completedDate: newCompletedStatus ? new Date().toISOString().slice(0, 10) : null,
            completedAt: newCompletedStatus ? new Date().toISOString() : null,
          };
        }
        return task;
      })
    );
    console.log("✅ Task toggled:", id);
  };

  const deleteTask = (id) => {
    showConfirmation(
      "Are you sure you want to delete this task?",
      () => {
        setTasks(currentTasks => {
          const taskToDelete = currentTasks.find(t => t.id === id);
          if (taskToDelete && taskToDelete.notificationId) {
            cancelDueDateNotification(taskToDelete.notificationId);
          }
          return currentTasks.filter((task) => task.id !== id);
        });
        console.log("🗑️ Task deleted:", id);
      },
      () => { },
    );
  };

  const handleCompleteTask = (taskId) => {
    const now = new Date().toISOString();
    console.log("🎯 Task completion button pressed for task ID:", taskId);
    setTasks(prevTasks => {
      return prevTasks.map(task => {
        if (task.id === taskId) {
          console.log("✅ Marking task as complete:", task.title || task.name);
          return {
            ...task,
            completed: true,
            completedDate: now.slice(0, 10),
            completedAt: now
          };
        }
        return task;
      });
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    schedulePushNotification({
      title: 'Task Completed! ✨',
      body: "Great job! Another one bites the dust.",
    });
  };

  const handleSaveTask = (savedTask) => {
    // Ensure task listId is bound
    const taskToSave = {
      ...savedTask,
      listId: savedTask.listId || "default_inbox"
    };

    setTasks(currentTasks => {
      const existingTaskIndex = currentTasks.findIndex(t => t.id === taskToSave.id);
      if (existingTaskIndex > -1) {
        const oldTask = currentTasks[existingTaskIndex];
        if (oldTask.notificationId && oldTask.dueDate !== taskToSave.dueDate) {
          cancelDueDateNotification(oldTask.notificationId);
        }
        if (taskToSave.dueDate) {
          scheduleDueDateNotification(taskToSave).then(notificationId => {
            const newTasks = [...currentTasks];
            newTasks[existingTaskIndex] = { ...taskToSave, notificationId };
            setTasks(newTasks);
          });
          return currentTasks;
        } else {
          const newTasks = [...currentTasks];
          newTasks[existingTaskIndex] = { ...taskToSave, notificationId: null };
          return newTasks;
        }
      } else {
        const newTaskId = Date.now().toString();
        const finalTask = { ...taskToSave, id: newTaskId };
        if (finalTask.dueDate) {
          scheduleDueDateNotification(finalTask).then(notificationId => {
            setTasks([...currentTasks, { ...finalTask, notificationId }]);
          });
          return currentTasks;
        } else {
          return [...currentTasks, { ...finalTask, notificationId: null }];
        }
      }
    });
  };

  const handleToggleSubtask = (taskId, subtaskIdx) => {
    console.log("🔄 Toggling subtask at index:", subtaskIdx, "for task ID:", taskId);
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          const updatedSubtasks = (task.subtasks || []).map((st, i) => {
            if (i === subtaskIdx) {
              const newCompleted = !st.completed;
              return {
                ...st,
                completed: newCompleted,
                completedAt: newCompleted ? new Date().toISOString() : null
              };
            }
            return st;
          });
          return {
            ...task,
            subtasks: updatedSubtasks
          };
        }
        return task;
      })
    );
  };

  const handleCreateList = (name) => {
    if (!name || !name.trim()) return;
    const newList = {
      id: Date.now().toString(),
      name: name.trim(),
      createdAt: new Date().toISOString()
    };
    setTaskLists(prev => [...prev, newList]);
    console.log("➕ Custom list created:", newList.name);
  };

  const handleRenameList = (listId, name) => {
    if (!name || !name.trim()) return;
    setTaskLists(prev =>
      prev.map(list => (list.id === listId ? { ...list, name: name.trim() } : list))
    );
    console.log("✏️ Custom list renamed to:", name.trim());
  };

  const handleDeleteList = (listId) => {
    if (listId === "default_inbox") {
      showConfirmation("You cannot delete the default task list.", () => {});
      return;
    }
    showConfirmation(
      "Are you sure you want to delete this list? All tasks inside will be permanently deleted.",
      () => {
        setTasks(currentTasks => {
          currentTasks.forEach(task => {
            if (task.listId === listId && task.notificationId) {
              cancelDueDateNotification(task.notificationId);
            }
          });
          return currentTasks.filter(task => task.listId !== listId);
        });
        setTaskLists(prev => prev.filter(list => list.id !== listId));
        console.log("🗑️ Custom list deleted:", listId);
      },
      () => {}
    );
  };

  /**
   * Handles active vault switching: persists to AsyncStorage, reloads notes from new vault.
   */
  const handleSetActiveVault = useCallback(async (id) => {
    setActiveVaultIdState(id);
    await setActiveVaultId(id);
    const fsNotes = await getAllNotesFromFilesystem(id);
    setNotes(fsNotes);
  }, []);

  const handleExecuteSync = async (config) => {
    setIsSyncing(true);
    try {
      // 1. Run sync over network
      const result = await performSync(config, {
        notes,
        tasks,
        taskLists,
        birthdays,
        themeMode,
        selectedThemeName,
        userName
      });

      if (result) {
        // 2. Clear active vault notes from filesystem
        await wipeNotesFilesystem(activeVaultId);

        // 3. Write returning synchronized note markdown files back to device storage
        for (const note of result.notes || []) {
          await saveNoteFile(activeVaultId, note.folder, note.title, note.content);
        }

        // 4. Cancel all old scheduled birthday alarm system configurations
        birthdays.forEach(bday => {
          if (bday.notificationIds && bday.notificationIds.length > 0) {
            cancelCustomBirthdayReminders(bday.notificationIds);
          }
        });

        // 5. Reschedule upcoming reminders for newly synchronized birthdays list
        const rescheduledBirthdays = [];
        for (const bday of result.birthdays || []) {
          const updatedBday = { ...bday };
          try {
            const newNotificationIds = await scheduleCustomBirthdayReminders(bday);
            updatedBday.notificationIds = newNotificationIds;
          } catch (err) {
            console.error("reschedule custom birthdays failed:", bday.name, err);
          }
          rescheduledBirthdays.push(updatedBday);
        }

        // 6. Overwrite app React state properties
        setTasks(result.tasks || []);
        setTaskLists(result.taskLists || [
          { id: "default_inbox", name: "My Tasks", createdAt: new Date().toISOString() }
        ]);
        setThemeMode(resolveThemeMode(result.themeMode));
        setSelectedThemeName(resolveThemeName(result.selectedThemeName));
        setUserName(result.userName || "");
        
        // 7. Load merged notes array from active vault filesystem
        const updatedNotes = await getAllNotesFromFilesystem(activeVaultId);
        setNotes(updatedNotes);
        
        // Save the updated birthdays with scheduled notification IDs
        setBirthdays(rescheduledBirthdays);

        // 8. Update sync timestamp status indicators
        const nowStr = new Date().toISOString();
        setLastSynced(nowStr);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showConfirmation(
          `Sync Completed!\n\n• ${result.notes?.length || 0} notes updated\n• ${result.tasks?.length || 0} tasks updated\n• ${result.birthdays?.length || 0} birthdays updated`,
          () => {}
        );
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showConfirmation(
        error.message || "Local network sync request failed. Please check host connections.",
        () => {}
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetData = () => {
    showConfirmation(
      "Are you sure you want to reset all data? This action cannot be undone.",
      async () => {
        setDailyTasks([]);
        // Cancel all scheduled birthday alerts
        birthdays.forEach(bday => {
          if (bday.notificationIds) {
            cancelCustomBirthdayReminders(bday.notificationIds);
          }
        });
        setBirthdays([]);
        setTasks([]);
        setTaskLists([
          { id: "default_inbox", name: "My Tasks", createdAt: new Date().toISOString() }
        ]);
        setNotes([]);
        await wipeNotesFilesystem(activeVaultId);
        setTimerDuration(25 * 60);
        setTimerRemaining(25 * 60);
        setIsTimerRunning(false);
        setShowTimerLockout(false);
        showConfirmation("All data has been reset!", () => { });
      },
      () => { },
    );
  };

  if (isLoading || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: currentTheme.background }}>
          <ActivityIndicator size="large" color={currentTheme.primary} />
          <Text style={{ marginTop: 10, color: currentTheme.text, fontWeight: "600" }}>Initializing KwestUp...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <StatusBar style={themeMode === "light" ? "dark" : "light"} animated />
      <SafeAreaProvider>
        <PaperProvider theme={{ colors: currentTheme }}>
          <LiquidGlassBackground theme={currentTheme}>
            <View style={[styles.container, { backgroundColor: "transparent" }]}>
              <NavigationContainer theme={{ colors: { background: "transparent" } }}>
                <AppNavigator
                currentTheme={currentTheme}
                tasks={tasks}
                setTasks={setTasks}
                taskLists={taskLists}
                handleCreateList={handleCreateList}
                handleRenameList={handleRenameList}
                handleDeleteList={handleDeleteList}
                handleToggleSubtask={handleToggleSubtask}
                notes={notes}
                setNotes={setNotes}
                handleCompleteTask={handleCompleteTask}
                toggleTaskComplete={toggleTaskComplete}
                deleteTask={deleteTask}
                setSelectedTask={setSelectedTask}
                setModalVisible={setModalVisible}
                dailyTasks={dailyTasks}
                setDailyTasks={setDailyTasks}
                birthdays={birthdays}
                setBirthdays={setBirthdays}
                showConfirmation={showConfirmation}
                setConfettiVisible={setConfettiVisible}
                timerDuration={timerDuration}
                timerRemaining={timerRemaining}
                isTimerRunning={isTimerRunning}
                setIsTimerRunning={setIsTimerRunning}
                setTimerRemaining={setTimerRemaining}
                setTimerDuration={setTimerDuration}
                setShowTimerLockout={setShowTimerLockout}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                userName={userName}
                setUserName={setUserName}
                themeMode={themeMode}
                setThemeMode={setThemeMode}
                selectedThemeName={selectedThemeName}
                setSelectedThemeName={setSelectedThemeName}
                handleResetData={handleResetData}
                handleExecuteSync={handleExecuteSync}
                lastSynced={lastSynced}
                isSyncing={isSyncing}
                vaults={vaults}
                setVaults={setVaults}
                activeVaultId={activeVaultId}
                handleSetActiveVault={handleSetActiveVault}
                activeNote={activeNote}
                setActiveNote={setActiveNote}
              />
            </NavigationContainer>

            {/* Global Unified AI Assistant — shown only when no active note is open to prevent duplicate FAB */}
            {!activeNote && (
              <AIAssistant
                currentTheme={currentTheme}
                noteContent={activeNote ? activeNote.content : ""}
                noteTitle={activeNote ? activeNote.title : ""}
                onTasksExtracted={(extractedTaskTitles) => {
                  const newTasks = extractedTaskTitles.map((title) => ({
                    id: Date.now().toString() + Math.random().toString(36).slice(2),
                    title,
                    listId: "default_inbox",
                    completed: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }));
                  setTasks((prev) => [...prev, ...newTasks]);
                }}
                onTaskCreated={(taskData) => {
                  const newTask = {
                    id: Date.now().toString(),
                    title: taskData.title,
                    description: taskData.description || "",
                    dueDate: taskData.dueDate || null,
                    listId: "default_inbox",
                    completed: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  setTasks((prev) => [...prev, newTask]);
                  if (newTask.dueDate) {
                    scheduleDueDateNotification(newTask).then(notificationId => {
                      setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, notificationId } : t));
                    });
                  }
                }}
                onBirthdayCreated={async (birthdayData) => {
                  const newBday = {
                    id: Date.now().toString(),
                    name: birthdayData.name,
                    birthDate: birthdayData.date,
                    remindAtTime: "09:00",
                    advanceReminder: "none",
                    notificationIds: []
                  };
                  const notificationIds = await scheduleCustomBirthdayReminders(newBday);
                  const finalBday = { ...newBday, notificationIds };
                  setBirthdays((prev) => [...prev, finalBday]);
                }}
              />
            )}

            {/* Confirmation Modal */}
            <Modal
              isVisible={confirmationVisible}
              onBackdropPress={handleCancelConfirmation}
              style={styles.modalOverlay}
            >
              <View style={[styles.dialogContent, { backgroundColor: currentTheme.cardBackground }]}>
                <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>Confirmation</Text>
                <Text style={[styles.dialogMessage, { color: currentTheme.secondaryText }]}>{confirmationMessage}</Text>
                <View style={styles.dialogActions}>
                  {confirmationActionRef.current && (
                    <CustomButton
                      title="OK"
                      onPress={handleConfirmation}
                      color={currentTheme.primary}
                      style={styles.dialogButton}
                    />
                  )}
                  {confirmationCancelActionRef.current && (
                    <CustomButton
                      title="Cancel"
                      onPress={handleCancelConfirmation}
                      outline
                      color={currentTheme.primary}
                      style={styles.dialogButton}
                    />
                  )}
                </View>
              </View>
            </Modal>

            {/* Name Input Dialog */}
            <Modal
              isVisible={showNameDialog}
              onBackdropPress={() => {
                if (userName.trim()) setShowNameDialog(false);
              }}
              style={styles.modalOverlay}
            >
              <View style={[styles.dialogContent, { backgroundColor: currentTheme.cardBackground }]}>
                <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>Welcome to KwestUp!</Text>
                <Text style={[styles.dialogMessage, { color: currentTheme.secondaryText }]}>
                  Please enter your name to personalize your experience.
                </Text>
                <CustomTextInput
                  value={userName}
                  onChangeText={setUserName}
                  style={styles.nameInput}
                  placeholder="Enter your name"
                  placeholderTextColor={currentTheme.secondaryText}
                  theme={currentTheme}
                />
                <View style={styles.dialogActions}>
                  <CustomButton
                    title="Continue"
                    onPress={() => {
                      if (userName.trim()) {
                        setShowNameDialog(false);
                      }
                    }}
                    color={currentTheme.primary}
                    style={styles.dialogButton}
                    disabled={!userName.trim()}
                  />
                </View>
              </View>
            </Modal>

            {/* Task Edit Modal */}
            <TaskEditModal
              visible={modalVisible}
              onClose={() => setModalVisible(false)}
              task={selectedTask}
              onSave={handleSaveTask}
              theme={currentTheme}
              taskLists={taskLists}
            />

            {/* Timer Lockout Overlay */}
            <TimerLockoutOverlay
              show={showTimerLockout}
              remainingTime={timerRemaining}
              onExitAttempt={() =>
                showConfirmation(
                  "You are currently in a focus session. Exiting now will disrupt your focus. Are you sure you want to stop?",
                  () => {
                    setIsTimerRunning(false);
                    setShowTimerLockout(false);
                    setTimerRemaining(timerDuration);
                    console.log("Focus session interrupted!");
                  },
                  () => { },
                )
              }
              currentTheme={currentTheme}
              formatTime={formatTime}
            />

            {/* Confetti Animation */}
            {confettiVisible && (
              <ConfettiCannon
                count={200}
                origin={{ x: -10, y: 0 }}
                fadeOut={true}
                onAnimationEnd={() => setConfettiVisible(false)}
              />
            )}
            </View>
          </LiquidGlassBackground>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
