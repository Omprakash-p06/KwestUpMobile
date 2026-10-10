import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Platform, ActivityIndicator, AppState, Linking } from "react-native";
import { PaperProvider } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { TimerLockoutOverlay } from "./src/components/TimerLockoutOverlay";
import { LiquidGlassBackground } from "./src/components/LiquidGlassBackground";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { logger } from "./src/utils/logger";

// Theme and Navigation imports
import { themes } from "./src/theme/colors";
import { styles } from "./src/theme/styles";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { TaskProvider } from "./src/context/TaskContext";
import { VaultProvider } from "./src/context/VaultContext";
import { BillingProvider } from "./src/context/BillingContext";
import { BirthdayProvider } from "./src/context/BirthdayContext";
import { initNotesFolder, getAllNotesFromFilesystem, wipeNotesFilesystem, saveNoteFile } from "./src/utils/fileStorage";
import { migrateToVaultSystem, getVaults, getActiveVaultId, setActiveVaultId } from "./src/utils/vaultService";

// Utility imports
import { APP_VERSION, STORAGE_VERSION, clearAllCaches, migrateUserDataIfNeeded } from "./src/utils/storage";
import { scheduleNotification } from "./src/services/notificationService";
import { performSync } from "./src/utils/syncService";
import { runDeviceDiagnostics, runNetworkDiagnostics, checkForUpdates, sendTelemetryEvent, DEBUG_MODE } from "./src/utils/diagnostics";
import { loadBillingData } from "./src/utils/billingStorage";
import { requestWidgetUpdate } from 'react-native-android-widget';
import { FocusTimerWidget } from './widgets/FocusTimerWidget';
import { DailyTasksWidget } from './widgets/DailyTasksWidget';
import { ImportantTasksWidget } from './widgets/ImportantTasksWidget';
import { TasksListWidget } from './widgets/TasksListWidget';
import { getLocalDateString, getYesterdayLocalDateString } from './src/utils/dateUtils';
import { subscribeAppState, unsubscribeAppState } from "./src/utils/aiService";
import { eventBus } from "./src/behavior/eventBus";

// Configuration
const FORCE_CLEAR_ALL_STORAGE = false;

const VALID_THEME_MODES = ["light", "dark", "amoled"];
const VALID_THEME_NAMES = ["clean", "blue", "green", "purple", "dribbble"];

const resolveThemeMode = (value) => (VALID_THEME_MODES.includes(value) ? value : "light");
const resolveThemeName = (value) => (VALID_THEME_NAMES.includes(value) ? value : "dribbble");

const App = () => {
  logger.debug("🚀 KWESTUP MAIN APP COMPONENT LOADING...");

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
  const [timerDuration, setTimerDuration] = useState(25 * 60);
  const [timerRemaining, setTimerRemaining] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showTimerLockout, setShowTimerLockout] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const confirmationActionRef = useRef(null);
  const confirmationCancelActionRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const focusCompletedRef = useRef(false);

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

  const [telemetryEnabled, setTelemetryEnabled] = useState(false);
  const [showTelemetryDialog, setShowTelemetryDialog] = useState(false);
  const [billingData, setBillingData] = useState({ transactions: [], budgets: [], recurringBills: [], currency: "₹" });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [widgetActiveTab, setWidgetActiveTab] = useState("tasks");
  const appState = useRef(AppState.currentState);

  // Throttling refs to prevent Binder flooding on sensitive devices (NothingOS)
  const lastSaveTimeRef = useRef(0);
  const lastWidgetUpdateTimeRef = useRef(0);
  const birthdaysRef = useRef(birthdays);
  const lastBirthdayRescheduleRef = useRef("");

  // Keep birthdaysRef in sync
  useEffect(() => {
    birthdaysRef.current = birthdays;
  }, [birthdays]);

  // Define currentTheme with fallback to prevent undefined errors
  const resolvedThemeName = resolveThemeName(selectedThemeName);
  const resolvedThemeMode = resolveThemeMode(themeMode);

  const currentTheme = themes[resolvedThemeName]?.[resolvedThemeMode] || themes.dribbble.light;

  const initializeApp = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        lastVersion,
        storedUserName,
        loadedVaults,
        activeId,
        storedTelemetry,
      ] = await Promise.all([
        AsyncStorage.getItem("kwestup_last_version"),
        AsyncStorage.getItem(`kwestup_userName_${STORAGE_VERSION}`),
        getVaults(),
        getActiveVaultId(),
        AsyncStorage.getItem("kwestup_telemetry_optin"),
      ]);

      setVaults(loadedVaults);
      const resolvedActiveId = activeId || "default";
      setActiveVaultIdState(resolvedActiveId);

      if (storedUserName) {
        setUserName(storedUserName);
        setShowNameDialog(false);
        if (storedTelemetry === null) {
          setShowTelemetryDialog(true);
        }
      } else {
        setShowNameDialog(true);
      }

      if (storedTelemetry !== null) {
        const isOptIn = storedTelemetry === "true";
        setTelemetryEnabled(isOptIn);
        if (isOptIn) {
          sendTelemetryEvent("launch");
        }
      }

      // PHASE 2: Initialize folder structure (fast local FS op)
      await initNotesFolder(resolvedActiveId);

      // PHASE 3: Run one-time vault migration (no-op if already migrated)
      // and version-cache clearing in background — does NOT block UI
      const backgroundInit = async () => {
        try {
          await migrateToVaultSystem();
          if (FORCE_CLEAR_ALL_STORAGE) {
            await clearAllCaches();
          } else if (lastVersion !== APP_VERSION) {
            logger.info("🔄 Version change detected, clearing caches...");
            await clearAllCaches();
          }
          // WR-03: network & device diagnostics are dev-only informational
          // probes — release builds must not phone third-party endpoints
          // (httpbin) or pay the launch-latency cost on every cold start.
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            runDeviceDiagnostics();
            runNetworkDiagnostics();
          }
        } catch (bgErr) {
          logger.warn("⚠️ Background init step failed (non-critical):", bgErr);
        }
      };
      backgroundInit(); // fire-and-forget

      // Unblock UI immediately after essential setup is done
      setIsInitialized(true);
      setIsLoading(false);
    } catch (error) {
      logger.error("❌ APP INITIALIZATION FAILED:", error);
      setIsInitialized(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Save userName to AsyncStorage immediately when set
  useEffect(() => {
    if (isDataLoaded && userName && userName.trim()) {
      AsyncStorage.setItem(`kwestup_userName_${STORAGE_VERSION}`, userName);
    }
  }, [userName, isDataLoaded]);

  const loadData = useCallback(async () => {
    if (!isInitialized) return;

    try {
      // Scan and migrate any legacy user data from older storage versions if current version has no data
      await migrateUserDataIfNeeded(STORAGE_VERSION);

      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      const timerKey = `kwestup_timer_state_${STORAGE_VERSION}`;
      const themeModeKey = `kwestup_theme_mode_${STORAGE_VERSION}`;
      const themeNameKey = `kwestup_theme_name_${STORAGE_VERSION}`;
      const [storedDataRaw, storedTimerRaw, storedUserName, storedThemeMode, storedThemeName, storedWidgetTab] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(timerKey),
        AsyncStorage.getItem(`kwestup_userName_${STORAGE_VERSION}`),
        AsyncStorage.getItem(themeModeKey),
        AsyncStorage.getItem(themeNameKey),
        AsyncStorage.getItem("kwestup_widget_active_tab"),
      ]);

      // Resolve active vault for this load cycle
      const activeId = activeVaultId || (await getActiveVaultId()) || "default";
      // WR-08: birthdays loaded this cycle — the `birthdays` state captured in
      // this closure is the stale initial [] on cold start, so the reschedule
      // block below must iterate what was actually loaded, not state.
      let loadedBirthdays = [];

      if (storedWidgetTab) {
        setWidgetActiveTab(storedWidgetTab);
      }

      if (storedDataRaw) {
        const parsedData = JSON.parse(storedDataRaw);
        const loadedDailyTasks = parsedData.dailyTasks || [];
        const todayStr = getLocalDateString();
        const yesterdayStr = getYesterdayLocalDateString();

        const resetDailyTasks = loadedDailyTasks.map((t) => {
          // If the task was completed on a previous day, reset completion status
          if (t.completed && t.completedDate !== todayStr) {
            let streak = t.streak || 0;
            // If the last completed date was not yesterday (meaning they missed a day), break the streak
            if (t.lastCompletedDate !== yesterdayStr && t.lastCompletedDate !== todayStr) {
              streak = 0;
            }
            return {
              ...t,
              completed: false,
              completedDate: null,
              streak,
            };
          } else if (!t.completed && t.lastCompletedDate && t.lastCompletedDate !== yesterdayStr && t.lastCompletedDate !== todayStr) {
            // If they didn't complete it today or yesterday, they broke their streak
            return {
              ...t,
              streak: 0,
            };
          }
          return t;
        });

        setDailyTasks(resetDailyTasks);
        loadedBirthdays = parsedData.birthdays || [];
        setBirthdays(loadedBirthdays);
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
        loadedBirthdays = [];
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
      setIsDataLoaded(true);

      // Reschedule birthday notifications on app start so they cover
      // both this year AND next year's dates (since absolute Date triggers fire once)
      if (loadedBirthdays.length > 0) {
        const todayKey = getLocalDateString();
        if (lastBirthdayRescheduleRef.current !== todayKey) {
          lastBirthdayRescheduleRef.current = todayKey;
          const birthdaysToReschedule = loadedBirthdays;
          setTimeout(async () => {
            try {
              for (const bday of birthdaysToReschedule) {
                if (bday.notificationIds && bday.notificationIds.length > 0) {
                  await cancelCustomBirthdayReminders(bday.notificationIds);
                }
                const newIds = await scheduleCustomBirthdayReminders(bday);
                setBirthdays(prev => prev.map(b => b.id === bday.id ? { ...b, notificationIds: newIds } : b));
              }
            } catch (e) {
              logger.warn("Birthday notification reschedule error:", e);
            }
          }, 500);
        }
      }
    } catch (error) {
      logger.error("❌ Failed to load data:", error);
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
      setIsDataLoaded(true);
    }
  }, [isInitialized, activeVaultId]);

  // AppState monitoring to prevent background Binder flooding and reload widget-changed data
  // NOTE (CR-01): this effect MUST stay below the loadData declaration — its deps
  // array ([loadData]) reads the binding eagerly, so placing it above the
  // `const loadData = useCallback(...)` declaration throws a TDZ ReferenceError
  // on first render and prevents the app from mounting.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        logger.debug("[App] Came to foreground, reloading state from AsyncStorage...");
        loadData();
      }
      appState.current = nextAppState;
    });
    // Managed AI lifecycle subscription (deduped inside aiService; auto-register
    // at module load remains the fallback for non-root importers).
    subscribeAppState();
    return () => {
      subscription.remove();
      unsubscribeAppState();
    };
  }, [loadData]);

  const saveData = useCallback(async () => {
    if (!isInitialized) return;

    // DECOUPLE: Main data save no longer includes high-frequency timer state.
    // This prevents Binder transaction failures (-22) when saving large datasets.
    // W-01: tasks/taskLists/dailyTasks are owned exclusively by TaskContext
    // (eager write-through persistence). App merges its remaining domains onto
    // the stored object so a periodic save can never clobber fresh task data
    // with a stale App-local snapshot.
    const dataToSave = {
      birthdays,
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
      const storedRaw = await AsyncStorage.getItem(storageKey);
      const stored = storedRaw ? JSON.parse(storedRaw) : {};
      await AsyncStorage.setItem(storageKey, JSON.stringify({ ...stored, ...dataToSave }));
      logger.debug("💾 Main data saved successfully to:", storageKey);
      lastSaveTimeRef.current = Date.now();
    } catch (error) {
      logger.error("❌ Failed to save main data:", error);
    }
  }, [
    birthdays,
    notes,
    themeMode,
    selectedThemeName,
    userName,
    lastSynced,
    isInitialized,
  ]);

  const saveTimerState = useCallback(async () => {
    if (!isDataLoaded) return;

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
      logger.error("❌ Failed to save timer state:", error);
    }
  }, [timerDuration, timerRemaining, isTimerRunning, isDataLoaded]);

  useEffect(() => {
    if (isInitialized) {
      loadData();
      // Load billing data separately (its own storage key)
      loadBillingData()
        .then(setBillingData)
        .catch((err) => logger.warn("Failed to load billing data:", err));
    }
  }, [isInitialized, loadData]);

  // Main data save trigger with 15-second throttle to protect Binder buffer
  useEffect(() => {
    if (isDataLoaded) {
      const now = Date.now();
      if (now - lastSaveTimeRef.current > 15000) {
        saveData();
      } else {
        const timeout = setTimeout(saveData, 15000 - (now - lastSaveTimeRef.current));
        return () => clearTimeout(timeout);
      }
    }
  }, [
    birthdays,
    notes,
    themeMode,
    selectedThemeName,
    userName,
    lastSynced,
    isDataLoaded,
    saveData,
  ]);

  // W-03: Billing persistence is owned exclusively by BillingContext
  // (updateBillingDataState). The App-level duplicate writer was removed to
  // eliminate the stale-write race between the two snapshots.

  // High-frequency timer state save (minimal payload)
  useEffect(() => {
    if (isDataLoaded) {
      saveTimerState();
    }
  }, [timerRemaining, isTimerRunning, isDataLoaded, saveTimerState]);


  // Save theme state immediately to separate keys
  useEffect(() => {
    if (isDataLoaded) {
      AsyncStorage.setItem(`kwestup_theme_mode_${STORAGE_VERSION}`, themeMode);
    }
  }, [themeMode, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) {
      AsyncStorage.setItem(`kwestup_theme_name_${STORAGE_VERSION}`, selectedThemeName);
    }
  }, [selectedThemeName, isDataLoaded]);

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
                  logger.error("Failed to open update URL:", err)
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

  // Update the unified interactive TasksList widget
  useEffect(() => {
    if (!isInitialized || Platform.OS !== 'android') return;

    // RULE 1: Only push updates if the app is ACTIVE.
    if (appState.current !== 'active') return;

    // Stagger the TasksList update to split binder transactions
    const tasksListTimer = setTimeout(() => {
      const sortedTasks = [...tasks].sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        return 0;
      }).slice(0, 8);

      requestWidgetUpdate({
        widgetName: 'TasksList',
        renderWidget: () => (
          <TasksListWidget
            tasks={sortedTasks}
            activeTab={widgetActiveTab === 'persistent' ? 'persistent' : 'all'}
          />
        ),
      });
    }, 250);

    return () => clearTimeout(tasksListTimer);
  }, [
    tasks,
    isInitialized,
    widgetActiveTab
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
      focusCompletedRef.current = false;
      timerIntervalRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          return Math.max(0, prev - 1);
        });
      }, 1000);
    } else if (timerRemaining === 0) {
      clearInterval(timerIntervalRef.current);
      if (isTimerRunning && !focusCompletedRef.current) {
        focusCompletedRef.current = true;
        setIsTimerRunning(false);
        setShowTimerLockout(false);
        showConfirmation("Congratulations! You completed your focus session!", () => {
          setConfettiVisible(true);
        });
        scheduleNotification({
          category: "system",
          payloadKey: `focus_timer_${Date.now()}`,
          recurrence: "one-shot",
          channelId: "kwestup_system",
          title: "KwestUp Focus Timer",
          body: "Your focus session is complete! Great job!",
        });
        eventBus.emit({
          type: "FOCUS_COMPLETED",
          entityId: `focus_${Date.now()}`,
          source: "app",
          payload: {
            duration: timerDuration,
          },
        });
      }
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning, timerRemaining]);

  // C-02: Task mutations live exclusively in TaskContext (src/context/TaskContext.js),
  // which wraps the authoritative engine in src/utils/taskMutations.js.
  // The duplicated hand-rolled copies that used to live here were removed so
  // there is a single mutation path with notification scheduling preserved.

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
        for (const bday of birthdays) {
          if (bday.notificationIds && bday.notificationIds.length > 0) {
            await cancelCustomBirthdayReminders(bday.notificationIds);
          }
        }

        // 5. Reschedule upcoming reminders for newly synchronized birthdays list
        const rescheduledBirthdays = [];
        for (const bday of result.birthdays || []) {
          const updatedBday = { ...bday };
          try {
            const newNotificationIds = await scheduleCustomBirthdayReminders(bday);
            updatedBday.notificationIds = newNotificationIds;
          } catch (err) {
            logger.error("reschedule custom birthdays failed:", bday.name, err);
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
            <ErrorBoundary currentTheme={currentTheme} isDark={resolvedThemeMode !== "light"}>
              <View style={[styles.container, { backgroundColor: "transparent" }]}>
              <TaskProvider
                initialTasks={tasks}
                initialTaskLists={taskLists}
                initialDailyTasks={dailyTasks}
                showConfirmationDialog={showConfirmation}
              >
                <VaultProvider
                  initialVaults={vaults}
                  initialActiveVaultId={activeVaultId}
                  initialNotes={notes}
                  initialActiveNote={activeNote}
                >
                  <BillingProvider initialBillingData={billingData}>
                    <BirthdayProvider
                      initialBirthdays={birthdays}
                      showConfirmationDialog={showConfirmation}
                    >
                      <NavigationContainer theme={{ colors: { background: "transparent" } }}>
                        <AppNavigator
                          currentTheme={currentTheme}
                          notes={notes}
                          setNotes={setNotes}
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
                          billingData={billingData}
                          setBillingData={setBillingData}
                          telemetryEnabled={telemetryEnabled}
                          setTelemetryEnabled={setTelemetryEnabled}
                        />
                      </NavigationContainer>
                    </BirthdayProvider>
                  </BillingProvider>
                </VaultProvider>
              </TaskProvider>


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
                    onPress={async () => {
                      if (userName.trim()) {
                        setShowNameDialog(false);
                        const optin = await AsyncStorage.getItem("kwestup_telemetry_optin");
                        if (optin === null) {
                          setShowTelemetryDialog(true);
                        }
                      }
                    }}
                    color={currentTheme.primary}
                    style={styles.dialogButton}
                    disabled={!userName.trim()}
                  />
                </View>
              </View>
            </Modal>

            {/* Telemetry Opt-in Dialog */}
            <Modal
              isVisible={showTelemetryDialog}
              onBackdropPress={() => {}}
              style={styles.modalOverlay}
            >
              <View style={[styles.dialogContent, { backgroundColor: currentTheme.cardBackground }]}>
                <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>Anonymous Telemetry</Text>
                <Text style={[styles.dialogMessage, { color: currentTheme.secondaryText, marginBottom: 14 }]}>
                  To help us count active installations and improve the app, KwestUp can anonymously track app launches and OS platforms. No personal data, notes, or files are ever sent.
                  {"\n\n"}
                  Do you want to enable anonymous usage telemetry? You can toggle this setting in the configuration panel at any time.
                </Text>
                <View style={styles.dialogActions}>
                  <CustomButton
                    title="ALLOW (OPT IN)"
                    onPress={async () => {
                      await AsyncStorage.setItem("kwestup_telemetry_optin", "true");
                      setTelemetryEnabled(true);
                      setShowTelemetryDialog(false);
                      // Trigger launch event after state update completes
                      setTimeout(() => {
                        sendTelemetryEvent("launch");
                      }, 100);
                    }}
                    color={currentTheme.primary}
                    style={[styles.dialogButton, { marginRight: 8 }]}
                  />
                  <CustomButton
                    title="DECLINE (OFFLINE)"
                    onPress={async () => {
                      await AsyncStorage.setItem("kwestup_telemetry_optin", "false");
                      setTelemetryEnabled(false);
                      setShowTelemetryDialog(false);
                    }}
                    outline
                    color={currentTheme.primary}
                    style={styles.dialogButton}
                  />
                </View>
              </View>
            </Modal>

            {/* C-01: TaskEditModal now lives in AppNavigator, bound to the same
                TaskContext state the screens write. */}

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
                    logger.info("Focus session interrupted!");
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
            </ErrorBoundary>
          </LiquidGlassBackground>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
