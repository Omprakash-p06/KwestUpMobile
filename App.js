import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, Platform, Linking, ScrollView } from 'react-native';
import { Appbar, BottomNavigation, PaperProvider, MD3LightTheme, MD3DarkTheme, TextInput, Button, Checkbox, List, IconButton, Dialog, Portal, Switch } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configure Expo Notifications to handle notifications when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions on app start
async function requestNotificationPermissions() {
  if (Platform.OS === 'android') {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
      android: {
        // Android permissions are generally granted by default for basic notifications
        // but explicit request can be good practice.
      },
    });
  } else {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Permission required', 'Please enable notification permissions in your device settings to receive reminders.');
    }
  }
}

// Custom Material Design Themes for Light and Dark Mode
const LightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1976d2', // Blue 700
    onPrimary: '#ffffff',
    primaryContainer: '#bbdefb', // Blue 100
    onPrimaryContainer: '#0d47a1', // Blue 900
    secondary: '#ab47bc', // Purple 400
    onSecondary: '#ffffff',
    background: '#f5f6fa', // Light grey
    onBackground: '#212121',
    surface: '#ffffff',
    onSurface: '#212121',
    error: '#f44336',
    onError: '#ffffff',
    success: '#4caf50',
    outline: '#e0e0e0', // Grey 300 for borders
    textSecondary: '#757575', // Grey 600
  },
};

const DarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#90caf9', // Blue 200
    onPrimary: '#212121',
    primaryContainer: '#1a237e', // Indigo 900
    onPrimaryContainer: '#e3f2fd', // Blue 50
    secondary: '#ce93d8', // Purple 200
    onSecondary: '#212121',
    background: '#121212', // Dark grey
    onBackground: '#e0e0e0',
    surface: '#1e1e1e',
    onSurface: '#e0e0e0',
    error: '#ef9a9a', // Red 200
    onError: '#212121',
    success: '#a5d6a7', // Green 200
    outline: '#424242', // Grey 800 for borders
    textSecondary: '#bdbdbd', // Grey 400
  },
};

// --- Timer Lockout Overlay Component (Moved outside App) ---
const TimerLockoutOverlay = ({ show, remainingTime, onExitAttempt, currentTheme, formatTime }) => {
  if (!show) return null;
  return (
    <View style={[styles.lockoutOverlay, { backgroundColor: currentTheme.colors.primaryContainer }]}>
      <View style={[styles.lockoutContent, { backgroundColor: currentTheme.colors.surfaceVariant }]}>
        <Text style={[styles.lockoutTitle, { color: currentTheme.colors.onPrimaryContainer }]}>Focus Mode Active!</Text>
        <Text style={[styles.lockoutMessage, { color: currentTheme.colors.onPrimaryContainer }]}>
          Stay focused. You cannot exit until the timer is complete.
        </Text>
        <Text style={[styles.lockoutTimer, { color: currentTheme.colors.primary, backgroundColor: currentTheme.colors.primaryContainer, borderColor: currentTheme.colors.primary }]}>
          {formatTime(remainingTime)}
        </Text>
        <Text style={[styles.lockoutMessage, { color: currentTheme.colors.onPrimaryContainer }]}>
          Keep going, you're doing great!
        </Text>
        <Button
          mode="contained"
          icon="close"
          onPress={onExitAttempt}
          style={styles.lockoutButton}
          labelStyle={styles.lockoutButtonLabel}
          contentStyle={styles.lockoutButtonContent}
          theme={{ colors: { primary: currentTheme.colors.error } }}
        >
          Attempt Exit (Warning)
        </Button>
      </View>
    </View>
  );
};


// Main App Component
const App = () => {
  const [index, setIndex] = useState(0); // For BottomNavigation index
  const [dailyTasks, setDailyTasks] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timerDuration, setTimerDuration] = useState(25 * 60); // 25 minutes
  const [timerRemaining, setTimerRemaining] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showTimerLockout, setShowTimerLockout] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const confirmationActionRef = useRef(null);
  const confirmationCancelActionRef = useRef(null);

  const timerIntervalRef = useRef(null);

  // --- Dark mode state ---
  const [darkMode, setDarkMode] = useState(false);
  const currentTheme = darkMode ? DarkTheme : LightTheme;

  // --- Local Storage Management (AsyncStorage) ---
  const loadData = useCallback(async () => {
    try {
      const storedData = await AsyncStorage.getItem('questup_data');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setDailyTasks(parsedData.dailyTasks || []);
        setBirthdays(parsedData.birthdays || []);
        setTasks(parsedData.tasks || []);
        setDarkMode(parsedData.darkMode || false);

        if (parsedData.timerState) {
          const { duration, remaining, isRunning, startTime } = parsedData.timerState;
          setTimerDuration(duration);
          if (isRunning && startTime) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const newRemaining = Math.max(0, duration - elapsed);
            setTimerRemaining(newRemaining);
            if (newRemaining > 0) {
              setIsTimerRunning(true);
              setShowTimerLockout(true);
            } else {
              setIsTimerRunning(false);
              setShowTimerLockout(false);
            }
          } else {
            setTimerRemaining(remaining);
            setIsTimerRunning(false);
            setShowTimerLockout(false);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load data from AsyncStorage:", error);
    }
  }, []);

  const saveData = useCallback(async () => {
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
      darkMode,
    };
    try {
      await AsyncStorage.setItem('questup_data', JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Failed to save data to AsyncStorage:", error);
    }
  }, [dailyTasks, birthdays, tasks, timerDuration, timerRemaining, isTimerRunning, darkMode]);

  useEffect(() => {
    requestNotificationPermissions();
    loadData();
  }, [loadData]);

  useEffect(() => {
    saveData();
  }, [dailyTasks, birthdays, tasks, timerDuration, timerRemaining, isTimerRunning, darkMode, saveData]);

  // --- Timer Logic ---
  useEffect(() => {
    if (isTimerRunning && timerRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsTimerRunning(false);
            setShowTimerLockout(false);
            showConfirmation("Focus session complete! Great job!", () => {});
            Notifications.scheduleNotificationAsync({
              content: {
                title: "QuestUp Focus Timer",
                body: "Your focus session is complete! Great job!",
                sound: 'default',
              },
              trigger: null, // show immediately
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

  // --- Notification Scheduling Logic ---
  const scheduleDailyTaskNotification = useCallback(async (task) => {
    if (!task.time) return;

    const [hours, minutes] = task.time.split(':').map(Number);
    const now = new Date();
    let triggerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    // If the time has already passed today, schedule for tomorrow
    if (triggerDate.getTime() < now.getTime()) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `daily-task-${task.id}`, // Unique ID for the notification
      content: {
        title: "QuestUp Daily Reminder",
        body: `It's time to do your daily task: "${task.name}"`,
        sound: 'default',
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true, // Repeat daily
      },
    });
  }, []);

  const scheduleGeneralTaskNotification = useCallback(async (task) => {
    if (!task.date || !task.time || task.completed) return;

    const [year, month, day] = task.date.split('-').map(Number);
    const [hours, minutes] = task.time.split(':').map(Number);

    const triggerDate = new Date(year, month - 1, day, hours, minutes, 0); // Month is 0-indexed

    if (triggerDate.getTime() < Date.now()) {
      console.warn(`Task "${task.name}" has a date/time in the past. Notification not scheduled.`);
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `general-task-${task.id}`, // Unique ID for the notification
      content: {
        title: "QuestUp Task Reminder",
        body: `It's time to do your task: "${task.name}"`,
        sound: 'default',
      },
      trigger: triggerDate, // Specific date and time
    });
  }, []);

  const scheduleBirthdayNotification = useCallback(async (birthday) => {
    const [month, day] = birthday.date.split('-').map(Number);
    const now = new Date();
    let triggerDate = new Date(now.getFullYear(), month - 1, day, 0, 0, 0); // 00:00 AM

    // If birthday has already passed this year, schedule for next year
    if (triggerDate.getTime() < now.getTime()) {
      triggerDate.setFullYear(triggerDate.getFullYear() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `birthday-${birthday.id}`,
      content: {
        title: "QuestUp Birthday Reminder! 🎉",
        body: `Happy Birthday to ${birthday.name}!`,
        sound: 'default',
      },
      trigger: {
        month: triggerDate.getMonth(),
        day: triggerDate.getDate(),
        hour: 0,
        minute: 0,
        repeats: true, // Repeat annually
      },
    });
  }, []);

  // Effect to schedule/reschedule notifications when tasks/birthdays change
  useEffect(() => {
    // Clear all existing QuestUp notifications to prevent duplicates or outdated ones
    Notifications.cancelAllScheduledNotificationsAsync();

    dailyTasks.forEach(task => scheduleDailyTaskNotification(task));
    tasks.forEach(task => scheduleGeneralTaskNotification(task));
    birthdays.forEach(birthday => scheduleBirthdayNotification(birthday));

    // For birthdays, also check for immediate notification on app open for today
    const todayMonthDay = new Date().toISOString().slice(5, 10); // MM-DD
    const checkAndNotifyBirthdaysImmediately = async () => {
      const hasNotified = await AsyncStorage.getItem(`questup_birthday_notified_${todayMonthDay}`);
      if (!hasNotified) {
        const todayBirthdays = birthdays.filter(b => b.date === todayMonthDay);
        if (todayBirthdays.length > 0) {
          const names = todayBirthdays.map(b => b.name).join(', ');
          showConfirmation(
            `Happy Birthday to: ${names}! 🎉`,
            async () => {
              await AsyncStorage.setItem(`questup_birthday_notified_${todayMonthDay}`, 'true');
            }
          );
          // Also trigger a system notification immediately
          Notifications.scheduleNotificationAsync({
            content: {
              title: "QuestUp Birthday Reminder",
              body: `Happy Birthday to: ${names}! 🎉`,
              sound: 'default',
            },
            trigger: null, // show immediately
          });
        }
      }
    };
    checkAndNotifyBirthdaysImmediately();

  }, [dailyTasks, tasks, birthdays, scheduleDailyTaskNotification, scheduleGeneralTaskNotification, scheduleBirthdayNotification]);


  // --- Confirmation Dialog ---
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

  // --- Helper Functions ---
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Daily Tasks Component ---
  const DailyTasksRoute = () => {
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskTime, setNewTaskTime] = useState(''); // New: time field
    const today = new Date().toISOString().slice(0, 10);

    const addDailyTask = () => {
      if (newTaskName.trim()) {
        const newDailyTask = { id: Date.now(), name: newTaskName.trim(), lastCompletedDate: null, time: newTaskTime || null };
        setDailyTasks([...dailyTasks, newDailyTask]);
        setNewTaskName('');
        setNewTaskTime('');
      }
    };

    const markDailyTaskComplete = (id) => {
      setDailyTasks(dailyTasks.map(task =>
        task.id === id ? { ...task, lastCompletedDate: today } : task
      ));
    };

    const unmarkDailyTaskComplete = (id) => {
      setDailyTasks(dailyTasks.map(task =>
        task.id === id ? { ...task, lastCompletedDate: null } : task
      ));
    };

    const deleteDailyTask = (id) => {
      showConfirmation(
        "Are you sure you want to delete this daily task?",
        () => setDailyTasks(dailyTasks.filter(task => task.id !== id)),
        () => {}
      );
    };

    return (
      <ScrollView style={styles.tabContentScroll}>
        <View style={[styles.tabContent, { backgroundColor: currentTheme.colors.surface }]}>
          <Text style={[styles.tabTitle, { color: currentTheme.colors.onSurface }]}>Normal Daily Tasks</Text>
          <View style={styles.inputRow}>
            <TextInput
              label="Task Name"
              value={newTaskName}
              onChangeText={setNewTaskName}
              style={styles.textInputFlex}
              mode="outlined"
              onSubmitEditing={addDailyTask}
              theme={{ colors: { primary: currentTheme.colors.primary, text: currentTheme.colors.onSurface, onSurfaceVariant: currentTheme.colors.onSurface } }}
            />
            <TextInput
              label="Time (HH:MM)"
              value={newTaskTime}
              onChangeText={setNewTaskTime}
              style={styles.textInputTime}
              mode="outlined"
              placeholder="HH:MM"
              keyboardType="numbers-and-punctuation" // For time input
              theme={{ colors: { primary: currentTheme.colors.primary, text: currentTheme.colors.onSurface, onSurfaceVariant: currentTheme.colors.onSurface } }}
            />
          </View>
          <Button icon="plus" mode="contained" onPress={addDailyTask} style={styles.fullWidthButton}>
            Add Daily Task
          </Button>

          <View style={styles.listContainer}>
            {dailyTasks.length === 0 ? (
              <Text style={[styles.emptyListText, { color: currentTheme.colors.textSecondary }]}>No daily tasks added yet. Start by adding one!</Text>
            ) : (
              dailyTasks.map(task => {
                const isDue = task.lastCompletedDate !== today;
                const isCompletedToday = task.lastCompletedDate === today;
                return (
                  <List.Item
                    key={task.id}
                    title={task.name}
                    description={
                      <View>
                        {task.lastCompletedDate && <Text style={{color: currentTheme.colors.textSecondary}}>Last done: {new Date(task.lastCompletedDate).toLocaleDateString()}</Text>}
                        {task.time && <Text style={{color: currentTheme.colors.primary}}>⏰ {task.time}</Text>}
                      </View>
                    }
                    titleStyle={isCompletedToday ? { textDecorationLine: 'line-through', color: currentTheme.colors.textSecondary } : { color: currentTheme.colors.onSurface }}
                    left={() => (
                      isDue ? (
                        <List.Icon icon="bell" color={currentTheme.colors.error} />
                      ) : (
                        <List.Icon icon="check-circle" color={currentTheme.colors.success} />
                      )
                    )}
                    right={() => (
                      <View style={styles.listItemActions}>
                        {isCompletedToday && ( // Show undo if completed today
                          <IconButton
                            icon="undo"
                            color={currentTheme.colors.info}
                            onPress={() => unmarkDailyTaskComplete(task.id)}
                            accessibilityLabel="Undo completion"
                          />
                        )}
                        {isDue && !isCompletedToday && ( // Show check if due and not completed today
                          <IconButton
                            icon="check"
                            color={currentTheme.colors.success}
                            onPress={() => markDailyTaskComplete(task.id)}
                            accessibilityLabel="Mark as complete"
                          />
                        )}
                        <IconButton
                          icon="delete"
                          color={currentTheme.colors.error}
                          onPress={() => deleteDailyTask(task.id)}
                          accessibilityLabel="Delete task"
                        />
                      </View>
                    )}
                    style={[styles.listItem, { borderColor: isDue ? currentTheme.colors.error : currentTheme.colors.success, backgroundColor: currentTheme.colors.surface }]}
                  />
                );
              })
            )}
          </View>
          <View style={styles.infoTextContainer}>
            <List.Icon icon="information-outline" color={currentTheme.colors.textSecondary} style={{marginRight: 0}}/>
            <Text style={[styles.infoText, { color: currentTheme.colors.textSecondary }]}>
              These tasks will trigger daily system notifications at the specified time.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  // --- Birthdays Component ---
  const BirthdaysRoute = () => {
    const [newBirthdayName, setNewBirthdayName] = useState('');
    const [newBirthdayDate, setNewBirthdayDate] = useState(''); //YYYY-MM-DD format from date picker

    const addBirthday = () => {
      if (newBirthdayName.trim() && newBirthdayDate) {
        const [, month, day] = newBirthdayDate.split('-');
        const newBday = { id: Date.now(), name: newBirthdayName.trim(), date: `${month}-${day}` };
        setBirthdays([...birthdays, newBday]);
        setNewBirthdayName('');
        setNewBirthdayDate('');
      }
    };

    const deleteBirthday = (id) => {
      showConfirmation(
        "Are you sure you want to delete this birthday?",
        () => setBirthdays(birthdays.filter(b => b.id !== id)),
        () => {}
      );
    };

    const todayMonthDay = new Date().toISOString().slice(5, 10); // MM-DD

    return (
      <ScrollView style={styles.tabContentScroll}>
        <View style={[styles.tabContent, { backgroundColor: currentTheme.colors.surface }]}>
          <Text style={[styles.tabTitle, { color: currentTheme.colors.onSurface }]}>Birthdays</Text>
          <View style={styles.inputRow}>
            <TextInput
              label="Person's Name"
              value={newBirthdayName}
              onChangeText={setNewBirthdayName}
              style={styles.textInputFlex}
              mode="outlined"
              theme={{ colors: { primary: currentTheme.colors.primary, text: currentTheme.colors.onSurface, onSurfaceVariant: currentTheme.colors.onSurface } }}
            />
            {/* Note: For a true date picker, you'd use a library like @react-native-community/datetimepicker */}
            <TextInput
              label="Date (YYYY-MM-DD)"
              value={newBirthdayDate}
              onChangeText={setNewBirthdayDate}
              style={styles.textInputDate}
              mode="outlined"
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              theme={{ colors: { primary: currentTheme.colors.primary, text: currentTheme.colors.onSurface, onSurfaceVariant: currentTheme.colors.onSurface } }}
            />
          </View>
          <Button icon="plus" mode="contained" onPress={addBirthday} style={styles.fullWidthButton}>
            Add Birthday
          </Button>

          <View style={styles.listContainer}>
            {birthdays.length === 0 ? (
              <Text style={[styles.emptyListText, { color: currentTheme.colors.textSecondary }]}>No birthdays added yet. Add a special date!</Text>
            ) : (
              birthdays.map(b => {
                const isToday = b.date === todayMonthDay;
                const birthDateFormatted = new Date(new Date().getFullYear(), parseInt(b.date.split('-')[0]) - 1, parseInt(b.date.split('-')[1])).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                return (
                  <List.Item
                    key={b.id}
                    title={b.name}
                    description={birthDateFormatted}
                    left={() => (
                      <List.Icon icon="cake" color={isToday ? currentTheme.colors.secondary : currentTheme.colors.textSecondary} />
                    )}
                    right={() => (
                      <IconButton
                        icon="delete"
                        color={currentTheme.colors.error}
                        onPress={() => deleteBirthday(b.id)}
                      />
                    )}
                    style={[styles.listItem, { borderColor: isToday ? currentTheme.colors.secondary : currentTheme.colors.outline, backgroundColor: currentTheme.colors.surface }]}
                    titleStyle={isToday ? { fontWeight: 'bold', color: currentTheme.colors.onSurface } : { color: currentTheme.colors.onSurface }}
                    descriptionStyle={{ color: currentTheme.colors.textSecondary }}
                  />
                );
              })
            )}
          </View>
          <View style={styles.infoTextContainer}>
            <List.Icon icon="information-outline" color={currentTheme.colors.textSecondary} style={{marginRight: 0}}/>
            <Text style={[styles.infoText, { color: currentTheme.colors.textSecondary }]}>
              These will trigger annual system notifications at 00:00 on the birthday.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  // --- General Tasks Component ---
  const GeneralTasksRoute = () => {
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskDate, setNewTaskDate] = useState(''); //YYYY-MM-DD format
    const [newTaskTime, setNewTaskTime] = useState(''); // HH:MM format

    const addTask = () => {
      if (newTaskName.trim()) {
        const newGeneralTask = {
          id: Date.now(),
          name: newTaskName.trim(),
          completed: false,
          date: newTaskDate || null,
          time: newTaskTime || null
        };
        setTasks([...tasks, newGeneralTask]);
        setNewTaskName('');
        setNewTaskDate('');
        setNewTaskTime('');
      }
    };

    const toggleTaskComplete = (id) => {
      setTasks(tasks.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
      ));
    };

    const deleteTask = (id) => {
      showConfirmation(
        "Are you sure you want to delete this task?",
        () => setTasks(tasks.filter(task => task.id !== id)),
        () => {}
      );
    };

    return (
      <ScrollView style={styles.tabContentScroll}>
        <View style={[styles.tabContent, { backgroundColor: currentTheme.colors.surface }]}>
          <Text style={[styles.tabTitle, { color: currentTheme.colors.onSurface }]}>Tasks (Goals)</Text>
          <View style={styles.inputRow}>
            <TextInput
              label="Task Name"
              value={newTaskName}
              onChangeText={setNewTaskName}
              style={styles.textInputFlex}
              mode="outlined"
              onSubmitEditing={addTask}
              theme={{ colors: { primary: currentTheme.colors.primary, text: currentTheme.colors.onSurface, onSurfaceVariant: currentTheme.colors.onSurface } }}
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              label="Date (YYYY-MM-DD)"
              value={newTaskDate}
              onChangeText={setNewTaskDate}
              style={styles.textInputDate}
              mode="outlined"
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              theme={{ colors: { primary: currentTheme.colors.primary, text: currentTheme.colors.onSurface, onSurfaceVariant: currentTheme.colors.onSurface } }}
            />
            <TextInput
              label="Time (HH:MM)"
              value={newTaskTime}
              onChangeText={setNewTaskTime}
              style={styles.textInputTime}
              mode="outlined"
              placeholder="HH:MM"
              keyboardType="numbers-and-punctuation"
              theme={{ colors: { primary: currentTheme.colors.primary, text: currentTheme.colors.onSurface, onSurfaceVariant: currentTheme.colors.onSurface } }}
            />
          </View>
          <Button icon="plus" mode="contained" onPress={addTask} style={styles.fullWidthButton}>
            Add Task
          </Button>

          <View style={styles.listContainer}>
            {tasks.length === 0 ? (
              <Text style={[styles.emptyListText, { color: currentTheme.colors.textSecondary }]}>No general tasks added yet. What are your goals?</Text>
            ) : (
              tasks.map(task => (
                <List.Item
                  key={task.id}
                  title={task.name}
                  description={
                    <View>
                      {(task.date || task.time) && (
                        <Text style={{color: currentTheme.colors.primary}}>
                          {task.date && `📅 ${task.date}`}
                          {task.date && task.time && ' '}
                          {task.time && `⏰ ${task.time}`}
                        </Text>
                      )}
                    </View>
                  }
                  left={() => (
                    <Checkbox.Android
                      status={task.completed ? 'checked' : 'unchecked'}
                      onPress={() => toggleTaskComplete(task.id)}
                      color={currentTheme.colors.success}
                    />
                  )}
                  right={() => (
                    <IconButton
                      icon="delete"
                      color={currentTheme.colors.error}
                      onPress={() => deleteTask(task.id)}
                    />
                  )}
                  style={[styles.listItem, { borderColor: task.completed ? currentTheme.colors.success : currentTheme.colors.outline, backgroundColor: currentTheme.colors.surface }]}
                  titleStyle={task.completed ? { textDecorationLine: 'line-through', color: currentTheme.colors.textSecondary } : { color: currentTheme.colors.onSurface }}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  // --- Focus Study Timer Component ---
  const FocusTimerRoute = () => {
    const startTimer = () => {
      if (!isTimerRunning && timerRemaining > 0) {
        setIsTimerRunning(true);
        setShowTimerLockout(true);
      }
    };

    const pauseTimer = () => {
      setIsTimerRunning(false);
    };

    const resetTimer = () => {
      showConfirmation(
        "Are you sure you want to reset the timer?",
        () => {
          setIsTimerRunning(false);
          setTimerRemaining(timerDuration);
          setShowTimerLockout(false);
        },
        () => {}
      );
    };

    const handleDurationChange = (minutes) => {
      const parsedMinutes = parseInt(minutes, 10);
      if (!isNaN(parsedMinutes) && parsedMinutes > 0) {
        const newDuration = parsedMinutes * 60;
        setTimerDuration(newDuration);
        if (!isTimerRunning) {
          setTimerRemaining(newDuration);
        }
      }
    };

    return (
      <View style={[styles.tabContent, { backgroundColor: currentTheme.colors.surface }]}>
        <Text style={[styles.tabTitle, { color: currentTheme.colors.onSurface }]}>Focus Study Timer</Text>

        <View style={styles.timerInputContainer}>
          <Text style={[styles.timerInputLabel, { color: currentTheme.colors.onSurface }]}>Set Duration (minutes):</Text>
          <TextInput
            keyboardType="numeric"
            value={(timerDuration / 60).toString()}
            onChangeText={handleDurationChange}
            disabled={isTimerRunning}
            style={styles.timerDurationInput}
            mode="outlined"
            theme={{ colors: { primary: currentTheme.colors.primary, text: currentTheme.colors.onSurface, onSurfaceVariant: currentTheme.colors.onSurface } }}
          />
        </View>

        <View style={[styles.timerDisplayContainer, {
          backgroundColor: currentTheme.colors.primaryContainer, // Use primaryContainer for background
          borderColor: currentTheme.colors.primary, // Use primary for border
        }]}>
          <Text style={[styles.timerDisplayText, {
            color: currentTheme.colors.primary, // Use primary for text color
          }]}>
            {formatTime(timerRemaining)}
          </Text>
        </View>

        <View style={styles.timerControls}>
          {!isTimerRunning ? (
            <Button
              mode="contained"
              icon="play"
              onPress={startTimer}
              disabled={timerRemaining === 0}
              style={styles.timerButton}
              labelStyle={styles.timerButtonLabel}
              contentStyle={styles.timerButtonContent}
              theme={{ colors: { primary: currentTheme.colors.success } }}
            >
              Start
            </Button>
          ) : (
            <Button
              mode="contained"
              icon="pause"
              onPress={pauseTimer}
              style={[styles.timerButton, { backgroundColor: currentTheme.colors.warning }]}
              labelStyle={styles.timerButtonLabel}
              contentStyle={styles.timerButtonContent}
              theme={{ colors: { primary: currentTheme.colors.warning } }}
            >
              Pause
            </Button>
          )}
          <Button
            mode="contained"
            icon="refresh"
            onPress={resetTimer}
            style={[styles.timerButton, { backgroundColor: currentTheme.colors.error }]}
            labelStyle={styles.timerButtonLabel}
            contentStyle={styles.timerButtonContent}
            theme={{ colors: { primary: currentTheme.colors.error } }}
          >
            Reset
          </Button>
        </View>
        <View style={styles.infoTextContainer}>
          <List.Icon icon="information-outline" color={currentTheme.colors.textSecondary} style={{marginRight: 0}}/>
          <Text style={[styles.infoText, { color: currentTheme.colors.textSecondary }]}>
            In a native app, this feature would truly prevent exiting until the timer is up. Here, a full-screen overlay is used.
          </Text>
        </View>
      </View>
    );
  };

  // --- About Me Component ---
  const AboutRoute = () => {
    return (
      <View style={[styles.tabContent, { backgroundColor: currentTheme.colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[styles.tabTitle, { color: currentTheme.colors.onSurface, marginBottom: 20 }]}>About QuestUp</Text>
        <Text style={[styles.aboutText, { color: currentTheme.colors.onSurface }]}>
          QuestUp is designed to help you manage your daily tasks, remember important birthdays, track personal goals, and maintain focus with a dedicated study timer.
        </Text>
        <Text style={[styles.aboutText, { color: currentTheme.colors.onSurface, marginTop: 20 }]}>
          Developed by: Omprakash Panda
        </Text>
        <Button
          mode="text"
          icon="github"
          onPress={() => Linking.openURL('https://github.com/Omprakash-p06/QuestUpMobile')}
          labelStyle={{ color: currentTheme.colors.primary, fontSize: 16 }}
          style={{ marginTop: 10 }}
        >
          My GitHub Repository
        </Button>
      </View>
    );
  };


  // Define routes for BottomNavigation
  const routes = [
    { key: 'daily', title: 'Daily', focusedIcon: 'bell', unfocusedIcon: 'bell-outline' },
    { key: 'birthdays', title: 'Birthdays', focusedIcon: 'cake', unfocusedIcon: 'cake-variant-outline' },
    { key: 'tasks', title: 'Tasks', focusedIcon: 'clipboard-list', unfocusedIcon: 'clipboard-list-outline' },
    { key: 'timer', title: 'Focus', focusedIcon: 'timer', unfocusedIcon: 'timer-outline' },
    { key: 'about', title: 'About', focusedIcon: 'information', unfocusedIcon: 'information-outline' }, // New About tab
  ];

  // Render scene for each route
  const renderScene = BottomNavigation.SceneMap({
    daily: DailyTasksRoute,
    birthdays: BirthdaysRoute,
    tasks: GeneralTasksRoute,
    timer: FocusTimerRoute,
    about: AboutRoute, // Add the new About route
  });

  return (
    <PaperProvider theme={currentTheme}>
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <Appbar.Header style={[styles.appBar, { backgroundColor: currentTheme.colors.primary }]}>
          <Appbar.Content title="QuestUp" titleStyle={[styles.appBarTitle, { color: currentTheme.colors.onPrimary }]} />
          {/* Dark mode toggle */}
          <View style={styles.darkModeToggle}>
            <Switch
              value={darkMode}
              onValueChange={() => setDarkMode((prev) => !prev)}
              color={currentTheme.colors.onPrimary}
            />
          </View>
          {/* GitHub link (text, as custom SVG icons are harder in RN) */}
          <Appbar.Action
            icon="github" // Using a standard icon from react-native-vector-icons
            color={currentTheme.colors.onPrimary}
            onPress={() => Linking.openURL('https://github.com/Omprakash-p06/QuestUpMobile')}
          />
        </Appbar.Header>

        {/* This is the ONLY place where the BottomNavigation renders its content */}
        <BottomNavigation
          navigationState={{ index, routes }}
          onIndexChange={setIndex}
          renderScene={renderScene}
          barStyle={{ backgroundColor: currentTheme.colors.surface, borderTopColor: currentTheme.colors.outline }}
          activeColor={currentTheme.colors.primary}
          inactiveColor={currentTheme.colors.textSecondary}
          labeled
          shifting={false}
          getLabelText={({ route }) => route.title}
          getIcon={({ route, focused, color }) => (
            <List.Icon icon={focused ? route.focusedIcon : route.unfocusedIcon} color={color} />
          )}
          style={styles.bottomNavContainer} // Apply flex: 1 to the BottomNavigation container
        />

        <Portal>
          <Dialog visible={confirmationVisible} onDismiss={handleCancelConfirmation} style={[styles.confirmationDialog, { backgroundColor: currentTheme.colors.surface }]}>
            <Dialog.Title style={[styles.dialogTitle, { color: currentTheme.colors.onSurface }]}>Confirmation</Dialog.Title>
            <Dialog.Content>
              <Text style={[styles.dialogMessage, { color: currentTheme.colors.onSurface }]}>{confirmationMessage}</Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.dialogActions}>
              {confirmationActionRef.current && (
                <Button onPress={handleConfirmation} mode="contained" theme={{ colors: { primary: currentTheme.colors.primary } }} style={styles.dialogButton}>OK</Button>
              )}
              {confirmationCancelActionRef.current && (
                <Button onPress={handleCancelConfirmation} mode="outlined" theme={{ colors: { primary: currentTheme.colors.primary } }} style={styles.dialogButton}>Cancel</Button>
              )}
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Pass currentTheme and formatTime as props to TimerLockoutOverlay */}
        <TimerLockoutOverlay
          show={showTimerLockout}
          remainingTime={timerRemaining}
          onExitAttempt={() => showConfirmation(
            "You are currently in a focus session. Exiting now will disrupt your focus. Are you sure you want to stop?",
            () => {
              setIsTimerRunning(false);
              setShowTimerLockout(false);
              setTimerRemaining(timerDuration);
            },
            () => {}
          )}
          currentTheme={currentTheme}
          formatTime={formatTime}
        />
      </View>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appBar: {
    // Background color set by theme.colors.primary in component
  },
  appBarTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 20,
  },
  darkModeToggle: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  // Removed contentContainer as BottomNavigation handles content directly
  bottomNavContainer: { // New style for the BottomNavigation itself
    flex: 1, // Allow BottomNavigation to take up remaining space for its content
  },
  tabContentScroll: { // Added for scrollability
    flexGrow: 1, // Use flexGrow inside ScrollView
  },
  tabContent: {
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16, // Add some margin at the bottom of the content
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputRow: { // New style for input rows
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12, // Reduced margin between input rows
    gap: 8, // Gap between items in the row
  },
  textInputFlex: { // TextInput that takes flexible width
    flex: 1,
    backgroundColor: 'transparent', // Allow theme background to show
  },
  textInputTime: { // Specific width for time input
    width: 100,
    backgroundColor: 'transparent',
  },
  textInputDate: { // Specific width for date input
    width: 120,
    backgroundColor: 'transparent',
  },
  fullWidthButton: { // Button that takes full width
    marginTop: 8, // Add margin above the button
    marginBottom: 16, // Add margin below the button
    borderRadius: 8,
    paddingVertical: 4,
  },
  listContainer: {
    flex: 1, // Allow list to take available space
    marginTop: 16, // Add some space above the list
  },
  listItem: {
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
  },
  listItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyListText: {
    textAlign: 'center',
    paddingVertical: 40,
    fontSize: 16,
  },
  infoTextContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
  },
  infoText: {
    fontSize: 12,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  bottomNavigation: {
    borderTopWidth: 1,
  },
  confirmationDialog: {
    borderRadius: 12,
  },
  dialogTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 20,
  },
  dialogMessage: {
    textAlign: 'center',
    fontSize: 16,
  },
  dialogActions: {
    justifyContent: 'center',
    paddingBottom: 16,
  },
  dialogButton: {
    borderRadius: 8,
    marginHorizontal: 8,
  },
  timerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  timerInputLabel: {
    fontSize: 16,
    marginRight: 8,
  },
  timerDurationInput: {
    width: 80,
    height: 40,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  timerDisplayContainer: {
    marginBottom: 32,
    padding: 32,
    borderRadius: 100,
    borderWidth: 4,
    alignSelf: 'center',
    // These colors are now dynamically set in the component's render method
    // backgroundColor: currentTheme.colors.primaryContainer,
    // borderColor: currentTheme.colors.primary,
  },
  timerDisplayText: {
    fontSize: 72,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    // color: currentTheme.colors.primary, // This color is now dynamically set in the component's render method
  },
  timerControls: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  timerButton: {
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  timerButtonLabel: {
    fontSize: 18,
  },
  timerButtonContent: {
    height: 48,
  },
  lockoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockoutContent: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
  },
  lockoutTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  lockoutMessage: {
    fontSize: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  lockoutTimer: {
    fontSize: 80,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 24,
    padding: 24,
    borderRadius: 100,
    borderWidth: 2,
  },
  lockoutButton: {
    marginTop: 24,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  lockoutButtonLabel: {
    fontSize: 18,
    color: 'white',
  },
  lockoutButtonContent: {
    height: 56,
  },
  aboutText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
});

export default App;