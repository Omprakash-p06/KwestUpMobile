import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Platform, ActivityIndicator } from "react-native";
import { PaperProvider } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import Modal from "react-native-modal";
import ConfettiCannon from "react-native-confetti-cannon";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

// Component imports
import { CustomButton } from "./src/components/CustomButton";
import { CustomTextInput } from "./src/components/CustomTextInput";
import { TaskEditModal } from "./src/components/TaskEditModal";
import { TimerLockoutOverlay } from "./src/components/TimerLockoutOverlay";

// Theme and Navigation imports
import { themes } from "./src/theme/colors";
import { styles } from "./src/theme/styles";
import { AppNavigator } from "./src/navigation/AppNavigator";

// Utility imports
import { APP_VERSION, STORAGE_VERSION, clearAllCaches } from "./src/utils/storage";
import { runDeviceDiagnostics, runNetworkDiagnostics, checkForUpdates, DEBUG_MODE } from "./src/utils/diagnostics";
import {
  requestNotificationPermissions,
  scheduleDailyTaskNotification,
  schedulePushNotification,
  scheduleDueDateNotification,
  cancelDueDateNotification
} from "./src/utils/notifications";

// Configuration
const FORCE_CLEAR_ALL_STORAGE = false;

const App = () => {
  console.log("🚀 KWESTUP MAIN APP COMPONENT LOADING...");

  const [dailyTasks, setDailyTasks] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [tasks, setTasks] = useState([]);
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

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Define currentTheme with fallback to prevent undefined errors
  const currentTheme = themes[selectedThemeName]?.[themeMode] || themes.dribbble.light;

  const initializeApp = useCallback(async () => {
    setIsLoading(true);
    try {
      runDeviceDiagnostics();
      await checkForUpdates();
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
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      const [storedDataRaw, storedUserName] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(`kwestup_userName_${STORAGE_VERSION}`),
      ]);

      if (storedDataRaw) {
        const parsedData = JSON.parse(storedDataRaw);
        setDailyTasks(parsedData.dailyTasks || []);
        setBirthdays(parsedData.birthdays || []);
        setTasks(parsedData.tasks || []);
        setThemeMode(parsedData.themeMode || "light");
        setSelectedThemeName(parsedData.selectedThemeName || "dribbble");
        if (storedUserName) setUserName(storedUserName);
        else setUserName(parsedData.userName || "");

        if (parsedData.timerState) {
          const { duration, remaining, isRunning, startTime } = parsedData.timerState;
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
        setThemeMode("light");
        setSelectedThemeName("dribbble");
        setUserName(storedUserName || "");
      }
    } catch (error) {
      setDailyTasks([]);
      setBirthdays([]);
      setTasks([]);
      setThemeMode("light");
      setSelectedThemeName("dribbble");
    }
  }, [isInitialized]);

  const saveData = useCallback(async () => {
    if (!isInitialized) return;

    const dataToSave = {
      dailyTasks,
      birthdays,
      tasks,
      timerState: {
        duration: timerDuration,
        remaining: timerRemaining,
        isRunning: isTimerRunning,
        startTime: isTimerRunning ? Date.now() - (timerDuration - timerRemaining) * 1000 : null,
      },
      themeMode,
      selectedThemeName,
      userName,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };

    try {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));
      console.log("💾 Data saved successfully to:", storageKey);
    } catch (error) {
      console.error("❌ Failed to save data:", error);
    }
  }, [
    dailyTasks,
    birthdays,
    tasks,
    timerDuration,
    timerRemaining,
    isTimerRunning,
    themeMode,
    selectedThemeName,
    userName,
    isInitialized,
  ]);

  useEffect(() => {
    if (isInitialized) {
      requestNotificationPermissions();
      loadData();
    }
  }, [isInitialized, loadData]);

  useEffect(() => {
    if (isInitialized) {
      saveData();
    }
  }, [
    dailyTasks,
    birthdays,
    tasks,
    timerDuration,
    timerRemaining,
    isTimerRunning,
    themeMode,
    selectedThemeName,
    userName,
    isInitialized,
    saveData,
  ]);

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
    setTasks(currentTasks => {
      const existingTaskIndex = currentTasks.findIndex(t => t.id === savedTask.id);
      if (existingTaskIndex > -1) {
        const oldTask = currentTasks[existingTaskIndex];
        if (oldTask.notificationId && oldTask.dueDate !== savedTask.dueDate) {
          cancelDueDateNotification(oldTask.notificationId);
        }
        if (savedTask.dueDate) {
          scheduleDueDateNotification(savedTask).then(notificationId => {
            const newTasks = [...currentTasks];
            newTasks[existingTaskIndex] = { ...savedTask, notificationId };
            setTasks(newTasks);
          });
          return currentTasks;
        } else {
          const newTasks = [...currentTasks];
          newTasks[existingTaskIndex] = { ...savedTask, notificationId: null };
          return newTasks;
        }
      } else {
        if (savedTask.dueDate) {
          scheduleDueDateNotification(savedTask).then(notificationId => {
            setTasks([...currentTasks, { ...savedTask, id: Date.now().toString(), notificationId }]);
          });
          return currentTasks;
        } else {
          return [...currentTasks, { ...savedTask, id: Date.now().toString(), notificationId: null }];
        }
      }
    });
  };

  const handleResetData = () => {
    showConfirmation(
      "Are you sure you want to reset all data? This action cannot be undone.",
      () => {
        setDailyTasks([]);
        setBirthdays([]);
        setTasks([]);
        setTimerDuration(25 * 60);
        setTimerRemaining(25 * 60);
        setIsTimerRunning(false);
        setShowTimerLockout(false);
        showConfirmation("All data has been reset!", () => { });
      },
      () => { },
    );
  };

  if (isLoading) {
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
      <SafeAreaProvider>
        <PaperProvider theme={{ colors: currentTheme }}>
          <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
            <NavigationContainer theme={{ colors: { background: currentTheme.background } }}>
              <AppNavigator
                currentTheme={currentTheme}
                tasks={tasks}
                setTasks={setTasks}
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
              />
            </NavigationContainer>

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
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
