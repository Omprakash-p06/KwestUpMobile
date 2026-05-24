import { Platform, Alert } from "react-native";
import * as Notifications from "expo-notifications";

// Configure Expo Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions() {
  if (Platform.OS === "android") {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
      android: {},
    });
  } else {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      Alert.alert(
        "Permission required",
        "Please enable notification permissions in your device settings to receive reminders.",
      );
    }
  }
}

// Helper to schedule a repeating daily notification for a daily task
export async function scheduleDailyTaskNotification(task) {
  if (!task.time) return null;
  try {
    const [hours, minutes] = task.time.split(":").map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Daily Task: ${task.name}`,
          body: 'Time for your daily task!',
          sound: true,
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });
      return notificationId;
    }
  } catch (e) {
    console.error("Failed to schedule daily task notification:", e);
  }
  return null;
}

// Helper to schedule a push notification immediately
export async function schedulePushNotification({ title, body }) {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // Send immediately
    });
    return notificationId;
  } catch (e) {
    console.error("Failed to schedule push notification:", e);
  }
  return null;
}

// Helper to schedule a push notification for a due date
export async function scheduleDueDateNotification(task) {
  if (!task.dueDate) return null;
  try {
    const triggerDate = new Date(task.dueDate);
    if (triggerDate > new Date()) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Task Due: ${task.title || task.name}`,
          body: task.description ? task.description : 'Your task is due now!',
          sound: true,
        },
        trigger: triggerDate,
      });
      return notificationId;
    }
  } catch (e) {
    console.error("Failed to schedule due date notification:", e);
  }
  return null;
}

// Helper to cancel a scheduled notification
export async function cancelDueDateNotification(notificationId) {
  if (notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (e) {
      console.error("Failed to cancel notification:", e);
    }
  }
}

// Helper to play birthday notification sound immediately
export async function playBirthdaySound() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎂 Birthday!',
        body: "It's someone's birthday today! 🎉",
        sound: 'default',
      },
      trigger: null,
    });
  } catch (e) {
    console.error("Failed to play birthday sound:", e);
  }
}

// Helper to schedule repeating birthday notification
export async function scheduleBirthdayNotification(name, month, day) {
  try {
    const now = new Date();
    let year = now.getFullYear();
    const birthdayThisYear = new Date(`${year}-${month}-${day}T00:00:00`);
    if (birthdayThisYear < now) {
      year += 1;
    }
    const nextBirthday = new Date(`${year}-${month}-${day}T00:00:00`);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🎂 Birthday: ${name}`,
        body: `Wish ${name} a happy birthday!`,
        sound: 'default',
      },
      trigger: {
        date: nextBirthday,
        repeats: false,
      },
    });
    return notificationId;
  } catch (e) {
    console.error("Failed to schedule birthday notification:", e);
  }
  return null;
}
