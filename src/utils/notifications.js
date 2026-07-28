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
      android: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
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

// Upgraded custom birthday push reminders scheduler
export async function scheduleCustomBirthdayReminders(birthday) {
  const { name, birthDate, remindAtTime, advanceReminder } = birthday;
  const parts = birthDate.split("-");
  
  // Extract month and day safely depending on whether year is present
  const month = parseInt(parts[parts.length === 3 ? 1 : 0], 10);
  const day = parseInt(parts[parts.length === 3 ? 2 : 1], 10);
  const [hours, minutes] = (remindAtTime || "00:00").split(":").map(Number);

  const notificationIds = [];

  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Schedule for this year AND next year (covers the yearly repeat gap)
    // Without this, the notification fires once and never again
    const yearsToSchedule = [currentYear, currentYear + 1];

    for (const year of yearsToSchedule) {
      let targetBday = new Date(year, month - 1, day, hours, minutes, 0);
      if (targetBday.getMonth() !== month - 1) {
        targetBday = new Date(year, month - 1, day + 1, hours, minutes, 0);
      }
      
      // Skip past dates (only schedule future notifications)
      if (targetBday <= today) continue;

      const bdayNotifyId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎂 Birthday Alert!`,
          body: `It's ${name}'s birthday today! Wish them the best! 🎉`,
          sound: "default",
        },
        trigger: targetBday,
      });
      notificationIds.push(bdayNotifyId);

      // Schedule Optional Advance Reminder for this year
      if (advanceReminder && advanceReminder !== "none") {
        let daysPrior = 1;
        if (advanceReminder === "3_days") daysPrior = 3;
        if (advanceReminder === "1_week") daysPrior = 7;

        const advanceTarget = new Date(targetBday);
        advanceTarget.setDate(targetBday.getDate() - daysPrior);

        if (advanceTarget > today) {
          const advanceNotifyId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `🎁 Birthday Coming Up!`,
              body: `${name}'s birthday is in ${daysPrior} days (${birthDate}). Don't forget to prepare!`,
              sound: "default",
            },
            trigger: advanceTarget,
          });
          notificationIds.push(advanceNotifyId);
        }
      }
    }
  } catch (error) {
    console.error("Failed to schedule reminders:", error);
  }

  return notificationIds;
}

// Upgraded custom birthday reminders cancellation utility
export async function cancelCustomBirthdayReminders(notificationIds) {
  if (notificationIds && Array.isArray(notificationIds)) {
    for (const id of notificationIds) {
      if (id) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (e) {
          console.error("Failed to cancel scheduled notification:", e);
        }
      }
    }
  }
}
