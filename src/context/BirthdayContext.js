import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  scheduleBirthdayReminders,
  cancelNotification,
} from "../services/notificationService";
import { logger } from "../utils/logger";
import { eventBus } from "../behavior/eventBus";

const BirthdayContext = createContext(null);

const DEFAULT_BIRTHDAYS = [];

export const BirthdayProvider = ({
  children,
  initialBirthdays = DEFAULT_BIRTHDAYS,
  showConfirmationDialog = null,
}) => {
  const [birthdays, setBirthdays] = useState(initialBirthdays);

  // WR-05: Sync unconditionally when an array is passed so empty-state resets propagate
  useEffect(() => {
    if (Array.isArray(initialBirthdays)) {
      setBirthdays(initialBirthdays);
    }
  }, [initialBirthdays]);

  const handleSaveBirthday = useCallback(async (birthdayData) => {
    const isUpdate = Boolean(birthdayData.id && birthdays.some((b) => b.id === birthdayData.id));

    // If updating, cancel old notifications
    if (birthdayData.id) {
      const existing = birthdays.find((b) => b.id === birthdayData.id);
      if (existing?.notificationIds && existing.notificationIds.length > 0) {
        for (const notifId of existing.notificationIds) {
          if (notifId) await cancelNotification(notifId);
        }
      }
    }

    const newId = birthdayData.id || Date.now().toString();
    const bdayToSchedule = { ...birthdayData, id: newId };
    let notificationIds = [];
    try {
      notificationIds = await scheduleBirthdayReminders(bdayToSchedule);
    } catch (e) {
      logger.warn("Birthday reminder scheduling failed; saving without reminder:", e?.message);
    }
    const finalBirthday = { ...bdayToSchedule, notificationIds: notificationIds || [] };

    setBirthdays((prev) => {
      const idx = prev.findIndex((b) => b.id === newId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = finalBirthday;
        return next;
      }
      return [...prev, finalBirthday];
    });

    eventBus.emit({
      type: isUpdate ? "BIRTHDAY_UPDATED" : "BIRTHDAY_CREATED",
      entityId: finalBirthday.id,
      source: "app",
      payload: {
        name: finalBirthday.name,
        date: finalBirthday.date,
      },
    });

    return finalBirthday;
  }, [birthdays]);

  const handleDeleteBirthday = useCallback((id, customConfirm = null) => {
    const executeDelete = async () => {
      const existing = birthdays.find((b) => b.id === id);
      if (existing?.notificationIds && existing.notificationIds.length > 0) {
        for (const notifId of existing.notificationIds) {
          if (notifId) await cancelNotification(notifId);
        }
      }
      setBirthdays((prev) => prev.filter((b) => b.id !== id));
      eventBus.emit({
        type: "BIRTHDAY_DELETED",
        entityId: String(id),
        source: "app",
      });
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
