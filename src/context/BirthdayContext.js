import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { scheduleCustomBirthdayReminders } from "../utils/notifications";

const BirthdayContext = createContext(null);

const DEFAULT_BIRTHDAYS = [];

export const BirthdayProvider = ({
  children,
  initialBirthdays = DEFAULT_BIRTHDAYS,
  showConfirmationDialog = null,
}) => {
  const [birthdays, setBirthdays] = useState(initialBirthdays);

  useEffect(() => {
    if (initialBirthdays && initialBirthdays !== DEFAULT_BIRTHDAYS && initialBirthdays.length > 0) {
      setBirthdays(initialBirthdays);
    }
  }, [initialBirthdays]);

  const handleSaveBirthday = useCallback(async (birthdayData) => {
    // If updating, cancel old notifications
    if (birthdayData.id) {
      const existing = birthdays.find((b) => b.id === birthdayData.id);
      if (existing?.notificationIds && existing.notificationIds.length > 0) {
        for (const notifId of existing.notificationIds) {
          try {
            await Notifications.cancelScheduledNotificationAsync(notifId);
          } catch {
            // ignore
          }
        }
      }
    }

    const newId = birthdayData.id || Date.now().toString();
    const bdayToSchedule = { ...birthdayData, id: newId };
    const notificationIds = await scheduleCustomBirthdayReminders(bdayToSchedule);
    const finalBirthday = { ...bdayToSchedule, notificationIds };

    setBirthdays((prev) => {
      const idx = prev.findIndex((b) => b.id === newId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = finalBirthday;
        return next;
      }
      return [...prev, finalBirthday];
    });

    return finalBirthday;
  }, [birthdays]);

  const handleDeleteBirthday = useCallback((id, customConfirm = null) => {
    const executeDelete = async () => {
      const existing = birthdays.find((b) => b.id === id);
      if (existing?.notificationIds && existing.notificationIds.length > 0) {
        for (const notifId of existing.notificationIds) {
          try {
            await Notifications.cancelScheduledNotificationAsync(notifId);
          } catch {
            // ignore
          }
        }
      }
      setBirthdays((prev) => prev.filter((b) => b.id !== id));
    };

    const confirmFn = customConfirm || showConfirmationDialog;
    if (confirmFn) {
      confirmFn(
        "Are you sure you want to delete this birthday reminder?",
        executeDelete,
        () => {}
      );
    } else {
      executeDelete();
    }
  }, [birthdays, showConfirmationDialog]);

  const value = {
    birthdays,
    setBirthdays,
    handleSaveBirthday,
    handleDeleteBirthday,
  };

  return <BirthdayContext.Provider value={value}>{children}</BirthdayContext.Provider>;
};

export const useBirthdays = () => {
  const context = useContext(BirthdayContext);
  return context;
};

export default BirthdayContext;
