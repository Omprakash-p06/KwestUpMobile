import React from "react";
import { useWindowDimensions, View } from "react-native";
import { AIAssistant } from "../components/AIAssistant";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { CustomDrawerContent } from "./CustomDrawerContent";
import { DashboardScreen } from "../screens/DashboardScreen";
import { DailyTasksScreen } from "../screens/DailyTasksScreen";
import { BirthdaysScreen } from "../screens/BirthdaysScreen";
import { TaskListScreen } from "../screens/TaskListScreen";
import { FocusTimerScreen } from "../screens/FocusTimerScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { NotesScreen } from "../screens/NotesScreen";
import { BillingScreen } from "../screens/BillingScreen";
import {
  scheduleDueDateNotification,
  scheduleCustomBirthdayReminders,
} from "../utils/notifications";
import { useNavigationState } from "@react-navigation/native";
import { getLocalDateString } from "../utils/dateUtils";
import { useTasks } from "../context/TaskContext";
import { useVaults } from "../context/VaultContext";
import { useBilling } from "../context/BillingContext";
import { useBirthdays } from "../context/BirthdayContext";

const Drawer = createDrawerNavigator();

export const AppNavigator = ({
  currentTheme,
  tasks,
  setTasks,
  taskLists,
  handleCreateList,
  handleRenameList,
  handleDeleteList,
  handleToggleSubtask,
  handleCompleteTask,
  toggleTaskComplete,
  deleteTask,
  setSelectedTask,
  setModalVisible,
  dailyTasks,
  setDailyTasks,
  birthdays,
  setBirthdays,
  showConfirmation,
  setConfettiVisible,
  timerDuration,
  timerRemaining,
  isTimerRunning,
  setIsTimerRunning,
  setTimerRemaining,
  setTimerDuration,
  setShowTimerLockout,
  searchQuery,
  setSearchQuery,
  userName,
  setUserName,
  themeMode,
  setThemeMode,
  selectedThemeName,
  setSelectedThemeName,
  handleResetData,
  notes,
  setNotes,
  handleExecuteSync,
  lastSynced,
  isSyncing,
  vaults,
  setVaults,
  activeVaultId,
  handleSetActiveVault,
  activeNote,
  setActiveNote,
  billingData,
  setBillingData,
  telemetryEnabled,
  setTelemetryEnabled,
}) => {
  const { width } = useWindowDimensions();
  const taskCtx = useTasks();
  const vaultCtx = useVaults();
  const billingCtx = useBilling();
  const birthdayCtx = useBirthdays();

  const effectiveTasks = taskCtx?.tasks ?? tasks ?? [];
  const effectiveSetTasks = taskCtx?.setTasks ?? setTasks;
  const effectiveTaskLists = taskCtx?.taskLists ?? taskLists ?? [];
  const effectiveHandleCreateList = taskCtx?.handleCreateList ?? handleCreateList;
  const effectiveHandleRenameList = taskCtx?.handleRenameList ?? handleRenameList;
  const effectiveHandleDeleteList = taskCtx?.handleDeleteList ?? handleDeleteList;
  const effectiveHandleToggleSubtask = taskCtx?.handleToggleSubtask ?? handleToggleSubtask;
  const effectiveHandleCompleteTask = taskCtx?.handleCompleteTask ?? handleCompleteTask;
  const effectiveToggleTaskComplete = taskCtx?.toggleTaskComplete ?? toggleTaskComplete;
  const effectiveDeleteTask = taskCtx?.deleteTask ?? deleteTask;
  const effectiveSetSelectedTask = taskCtx?.setSelectedTask ?? setSelectedTask;
  const effectiveSetModalVisible = taskCtx?.setModalVisible ?? setModalVisible;
  const effectiveDailyTasks = taskCtx?.dailyTasks ?? dailyTasks ?? [];
  const effectiveSetDailyTasks = taskCtx?.setDailyTasks ?? setDailyTasks;

  const effectiveBirthdays = birthdayCtx?.birthdays ?? birthdays ?? [];
  const effectiveSetBirthdays = birthdayCtx?.setBirthdays ?? setBirthdays;

  const effectiveVaults = vaultCtx?.vaults ?? vaults ?? [];
  const effectiveSetVaults = vaultCtx?.setVaults ?? setVaults;
  const effectiveActiveVaultId = vaultCtx?.activeVaultId ?? activeVaultId ?? "default";
  const effectiveHandleSetActiveVault = vaultCtx?.handleSetActiveVault ?? handleSetActiveVault;
  const effectiveNotes = vaultCtx?.notes ?? notes ?? [];
  const effectiveSetNotes = vaultCtx?.setNotes ?? setNotes;
  const effectiveActiveNote = vaultCtx?.activeNote ?? activeNote;
  const effectiveSetActiveNote = vaultCtx?.setActiveNote ?? setActiveNote;

  const effectiveBillingData = billingCtx?.billingData ?? billingData;
  const effectiveSetBillingData = billingCtx?.setBillingData ?? setBillingData;

  const activeRouteName = useNavigationState((state) => {
    if (!state) return null;
    let route = state.routes[state.index];
    while (route.state) {
      route = route.state.routes[route.state.index];
    }
    return route.name;
  });

  const onTaskCreated = (taskData) => {
    if (taskCtx?.handleSaveTask) {
      taskCtx.handleSaveTask(taskData);
      return;
    }
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
    if (effectiveSetTasks) {
      effectiveSetTasks((prev) => [...prev, newTask]);
    }
    if (newTask.dueDate) {
      scheduleDueDateNotification(newTask).then((notificationId) => {
        if (effectiveSetTasks) {
          effectiveSetTasks((prev) =>
            prev.map((t) => (t.id === newTask.id ? { ...t, notificationId } : t))
          );
        }
      });
    }
  };

  const onBirthdayCreated = async (birthdayData) => {
    if (birthdayCtx?.handleSaveBirthday) {
      await birthdayCtx.handleSaveBirthday({
        name: birthdayData.name,
        birthDate: birthdayData.date,
        remindAtTime: "09:00",
        advanceReminder: "none",
      });
      return;
    }
    const newBday = {
      id: Date.now().toString(),
      name: birthdayData.name,
      birthDate: birthdayData.date,
      remindAtTime: "09:00",
      advanceReminder: "none",
      notificationIds: [],
    };
    const notificationIds = await scheduleCustomBirthdayReminders(newBday);
    const finalBday = { ...newBday, notificationIds };
    if (effectiveSetBirthdays) {
      effectiveSetBirthdays((prev) => [...prev, finalBday]);
    }
  };

  const onTransactionCreated = async (txData) => {
    if (billingCtx?.addTransactionAction) {
      await billingCtx.addTransactionAction({
        type: txData.transactionType,
        amount: txData.amount,
        category: txData.category,
        description: txData.description,
        date: getLocalDateString(),
      });
      return;
    }
    const { addTransaction } = await import("../utils/billingStorage");
    const newTx = {
      id: Date.now().toString(),
      type: txData.transactionType,
      amount: txData.amount,
      category: txData.category,
      description: txData.description,
      date: getLocalDateString(),
      createdAt: new Date().toISOString(),
    };
    const updated = await addTransaction(newTx);
    if (effectiveSetBillingData) {
      effectiveSetBillingData(updated);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Drawer.Navigator
        initialRouteName="Dashboard"
        drawerContent={(props) => (
          <CustomDrawerContent
            {...props}
            currentTheme={currentTheme}
            userName={userName}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
          />
        )}
        sceneContainerStyle={{ backgroundColor: "transparent" }}
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: themeMode === "light" ? "rgba(255, 255, 255, 0.5)" : "rgba(12, 15, 23, 0.5)",
            borderBottomWidth: 1,
            borderBottomColor: currentTheme.border,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: currentTheme.text,
          headerTitleStyle: {
            fontWeight: "600",
            fontSize: 20,
            color: currentTheme.text,
            fontFamily: "JetBrainsMono-Bold",
          },
          drawerType: "front",
          drawerPosition: "left",
          swipeEnabled: true,
          swipeEdgeWidth: width * 0.5,
          overlayColor: "rgba(0, 0, 0, 0.5)",
          drawerStyle: {
            backgroundColor: currentTheme.cardBackground,
            width: width * 0.75,
          },
        }}
      >
        <Drawer.Screen name="Dashboard" options={{ title: "Dashboard" }}>
          {() => (
            <DashboardScreen
              tasks={effectiveTasks}
              notes={effectiveNotes}
              birthdays={effectiveBirthdays}
              currentTheme={currentTheme}
              setSelectedTask={effectiveSetSelectedTask}
              setModalVisible={effectiveSetModalVisible}
              toggleTaskComplete={effectiveToggleTaskComplete}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Daily" options={{ title: "Daily Tasks" }}>
          {() => (
            <DailyTasksScreen
              currentTheme={currentTheme}
              setSelectedTask={effectiveSetSelectedTask}
              setModalVisible={effectiveSetModalVisible}
              dailyTasks={effectiveDailyTasks}
              setDailyTasks={effectiveSetDailyTasks}
              showConfirmation={showConfirmation}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Birthdays" options={{ title: "Birthdays" }}>
          {() => (
            <BirthdaysScreen
              currentTheme={currentTheme}
              setSelectedTask={effectiveSetSelectedTask}
              setModalVisible={effectiveSetModalVisible}
              birthdays={effectiveBirthdays}
              setBirthdays={effectiveSetBirthdays}
              showConfirmation={showConfirmation}
              setConfettiVisible={setConfettiVisible}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Billing" options={{ title: "Billing" }}>
          {() => (
            <BillingScreen
              currentTheme={currentTheme}
              billingData={effectiveBillingData}
              setBillingData={effectiveSetBillingData}
              showConfirmation={showConfirmation}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Tasks" options={{ title: "Task List" }}>
          {() => (
            <TaskListScreen
              tasks={effectiveTasks}
              setTasks={effectiveSetTasks}
              taskLists={effectiveTaskLists}
              handleCreateList={effectiveHandleCreateList}
              handleRenameList={effectiveHandleRenameList}
              handleDeleteList={effectiveHandleDeleteList}
              handleToggleSubtask={effectiveHandleToggleSubtask}
              handleCompleteTask={effectiveHandleCompleteTask}
              toggleTaskComplete={effectiveToggleTaskComplete}
              deleteTask={effectiveDeleteTask}
              currentTheme={currentTheme}
              setSelectedTask={effectiveSetSelectedTask}
              setModalVisible={effectiveSetModalVisible}
              showConfirmation={showConfirmation}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Notes" options={{ title: "Notes" }}>
          {() => (
            <NotesScreen
              currentTheme={currentTheme}
              notes={effectiveNotes}
              setNotes={effectiveSetNotes}
              showConfirmation={showConfirmation}
              tasks={effectiveTasks}
              setTasks={effectiveSetTasks}
              vaults={effectiveVaults}
              setVaults={effectiveSetVaults}
              activeVaultId={effectiveActiveVaultId}
              handleSetActiveVault={effectiveHandleSetActiveVault}
              activeNote={effectiveActiveNote}
              setActiveNote={effectiveSetActiveNote}
              onTaskCreated={onTaskCreated}
              onBirthdayCreated={onBirthdayCreated}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Focus" options={{ title: "Focus Timer" }}>
          {() => (
            <FocusTimerScreen
              currentTheme={currentTheme}
              timerDuration={timerDuration}
              timerRemaining={timerRemaining}
              isTimerRunning={isTimerRunning}
              setIsTimerRunning={setIsTimerRunning}
              setTimerRemaining={setTimerRemaining}
              setTimerDuration={setTimerDuration}
              setShowTimerLockout={setShowTimerLockout}
              showConfirmation={showConfirmation}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Settings" options={{ title: "Settings" }}>
          {() => (
            <SettingsScreen
              currentTheme={currentTheme}
              userName={userName}
              setUserName={setUserName}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              selectedThemeName={selectedThemeName}
              setSelectedThemeName={setSelectedThemeName}
              showConfirmation={showConfirmation}
              handleResetData={handleResetData}
              handleExecuteSync={handleExecuteSync}
              lastSynced={lastSynced}
              isSyncing={isSyncing}
              telemetryEnabled={telemetryEnabled}
              setTelemetryEnabled={setTelemetryEnabled}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Search" options={{ title: "Search" }}>
          {() => (
            <SearchScreen
              currentTheme={currentTheme}
              setSelectedTask={effectiveSetSelectedTask}
              setModalVisible={effectiveSetModalVisible}
              dailyTasks={effectiveDailyTasks}
              setDailyTasks={effectiveSetDailyTasks}
              birthdays={effectiveBirthdays}
              tasks={effectiveTasks}
              notes={effectiveNotes}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              handleCompleteTask={effectiveHandleCompleteTask}
              toggleTaskComplete={effectiveToggleTaskComplete}
              deleteTask={effectiveDeleteTask}
            />
          )}
        </Drawer.Screen>
      </Drawer.Navigator>

      {!effectiveActiveNote && activeRouteName !== "Settings" && (
        <AIAssistant
          currentTheme={currentTheme}
          noteContent={effectiveActiveNote ? effectiveActiveNote.content : ""}
          noteTitle={effectiveActiveNote ? effectiveActiveNote.title : ""}
          onTasksExtracted={(extractedTaskTitles) => {
            if (taskCtx?.handleSaveTask) {
              extractedTaskTitles.forEach((title) => {
                taskCtx.handleSaveTask({ title, listId: "default_inbox", completed: false });
              });
            } else if (effectiveSetTasks) {
              const newTasks = extractedTaskTitles.map((title) => ({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                title,
                listId: "default_inbox",
                completed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }));
              effectiveSetTasks((prev) => [...prev, ...newTasks]);
            }
          }}
          onTaskCreated={onTaskCreated}
          onBirthdayCreated={onBirthdayCreated}
          onTransactionCreated={onTransactionCreated}
        />
      )}
    </View>
  );
};
