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
import {
  scheduleDueDateNotification,
  scheduleCustomBirthdayReminders,
} from "../utils/notifications";

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
}) => {
  const { width } = useWindowDimensions();

  const onTaskCreated = (taskData) => {
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
  };

  const onBirthdayCreated = async (birthdayData) => {
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
              tasks={tasks}
              notes={notes}
              birthdays={birthdays}
              currentTheme={currentTheme}
              setSelectedTask={setSelectedTask}
              setModalVisible={setModalVisible}
              toggleTaskComplete={toggleTaskComplete}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Daily" options={{ title: "Daily Tasks" }}>
          {() => (
            <DailyTasksScreen
              currentTheme={currentTheme}
              setSelectedTask={setSelectedTask}
              setModalVisible={setModalVisible}
              dailyTasks={dailyTasks}
              setDailyTasks={setDailyTasks}
              showConfirmation={showConfirmation}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Birthdays" options={{ title: "Birthdays" }}>
          {() => (
            <BirthdaysScreen
              currentTheme={currentTheme}
              setSelectedTask={setSelectedTask}
              setModalVisible={setModalVisible}
              birthdays={birthdays}
              setBirthdays={setBirthdays}
              showConfirmation={showConfirmation}
              setConfettiVisible={setConfettiVisible}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Tasks" options={{ title: "Task List" }}>
          {() => (
            <TaskListScreen
              tasks={tasks}
              setTasks={setTasks}
              taskLists={taskLists}
              handleCreateList={handleCreateList}
              handleRenameList={handleRenameList}
              handleDeleteList={handleDeleteList}
              handleToggleSubtask={handleToggleSubtask}
              handleCompleteTask={handleCompleteTask}
              toggleTaskComplete={toggleTaskComplete}
              deleteTask={deleteTask}
              currentTheme={currentTheme}
              setSelectedTask={setSelectedTask}
              setModalVisible={setModalVisible}
              showConfirmation={showConfirmation}
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Notes" options={{ title: "Notes" }}>
          {() => (
            <NotesScreen
              currentTheme={currentTheme}
              notes={notes}
              setNotes={setNotes}
              showConfirmation={showConfirmation}
              tasks={tasks}
              setTasks={setTasks}
              vaults={vaults}
              setVaults={setVaults}
              activeVaultId={activeVaultId}
              handleSetActiveVault={handleSetActiveVault}
              activeNote={activeNote}
              setActiveNote={setActiveNote}
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
            />
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Search" options={{ title: "Search" }}>
          {() => (
            <SearchScreen
              currentTheme={currentTheme}
              setSelectedTask={setSelectedTask}
              setModalVisible={setModalVisible}
              dailyTasks={dailyTasks}
              setDailyTasks={setDailyTasks}
              birthdays={birthdays}
              tasks={tasks}
              notes={notes}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              handleCompleteTask={handleCompleteTask}
              toggleTaskComplete={toggleTaskComplete}
              deleteTask={deleteTask}
            />
          )}
        </Drawer.Screen>
      </Drawer.Navigator>

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
          onTaskCreated={onTaskCreated}
          onBirthdayCreated={onBirthdayCreated}
        />
      )}
    </View>
  );
};
