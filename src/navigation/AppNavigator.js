import React from "react";
import { useWindowDimensions } from "react-native";
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
}) => {
  const { width } = useWindowDimensions();

  return (
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
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: currentTheme.cardBackground,
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
            currentTheme={currentTheme}
            handleCompleteTask={handleCompleteTask}
            setSelectedTask={setSelectedTask}
            setModalVisible={setModalVisible}
            toggleTaskComplete={toggleTaskComplete}
            deleteTask={deleteTask}
            setTasks={setTasks}
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
            birthdays={birthdays}
            tasks={tasks}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleCompleteTask={handleCompleteTask}
            toggleTaskComplete={toggleTaskComplete}
            deleteTask={deleteTask}
          />
        )}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
};
