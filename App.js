import { useState, useEffect, useRef, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  Linking,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal as RNModal,
} from "react-native"
import { PaperProvider, useTheme } from "react-native-paper" // Keep PaperProvider for theme context, but replace components
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"
import DateTimePicker from "@react-native-community/datetimepicker"
import Modal from "react-native-modal"
import ConfettiCannon from "react-native-confetti-cannon"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from "react-native-reanimated"
import { createDrawerNavigator } from "@react-navigation/drawer"
import { NavigationContainer, useNavigation, DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from "@react-navigation/native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { MaterialCommunityIcons } from "@expo/vector-icons" // Import icons directly
import { useFonts } from "expo-font"
import Color from "color"
import * as Haptics from "expo-haptics"

const Drawer = createDrawerNavigator()
console.log("Drawer created successfully")

// FORCE UPDATE SYSTEM - COMPREHENSIVE VERSION TRACKING
const BUILD_TIMESTAMP = new Date().getTime()
const APP_VERSION = "v2.5.0-SIDE-PANEL-REDESIGN" // Updated version
const STORAGE_VERSION = "v5.0" // Updated storage version

// Debug Configuration
const DEBUG_MODE = false // Disable debug mode
const FORCE_CLEAR_ALL_STORAGE = false // Don't clear storage on startup

// Configure Expo Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Request notification permissions
async function requestNotificationPermissions() {
  if (Platform.OS === "android") {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
      android: {},
    })
  } else {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== "granted") {
      Alert.alert(
        "Permission required",
        "Please enable notification permissions in your device settings to receive reminders.",
      )
    }
  }
}

// COMPREHENSIVE CACHE CLEARING SYSTEM
const clearAllCaches = async () => {
  console.log("🧹 STARTING COMPREHENSIVE CACHE CLEAR...")

  try {
    const allKeys = await AsyncStorage.getAllKeys()
    console.log("📋 Found AsyncStorage keys:", allKeys)

    const kwestupKeys = allKeys.filter(
      (key) =>
        key.includes("kwestup") ||
        key.includes("medical") ||
        key.includes("clean") ||
        key.includes("sidebar") ||
        key.includes("cache"),
    )

    if (kwestupKeys.length > 0) {
      await AsyncStorage.multiRemove(kwestupKeys)
      console.log("✅ Cleared KwestUp storage keys:", kwestupKeys)
    }

    const specificKeys = [
      "kwestup_medical_data",
      "kwestup_medical_data_v2",
      "kwestup_clean_data_v3",
      "kwestup_ui_cache",
      "kwestup_version_check",
      "@kwestup_data",
      "sidebar:state",
    ]

    await AsyncStorage.multiRemove(specificKeys)
    console.log("✅ Cleared specific storage keys")

    await AsyncStorage.setItem("kwestup_last_version", APP_VERSION)
    await AsyncStorage.setItem("kwestup_last_clear", new Date().toISOString())

    console.log("✅ CACHE CLEAR COMPLETED SUCCESSFULLY")
    return true
  } catch (error) {
    console.error("❌ CACHE CLEAR FAILED:", error)
    return false
  }
}

// NETWORK DIAGNOSTICS
const runNetworkDiagnostics = async () => {
  console.log("🌐 RUNNING NETWORK DIAGNOSTICS...")

  try {
    const response = await fetch("https://httpbin.org/json", {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })

    if (response.ok) {
      console.log("✅ Network connectivity: OK")
      console.log("📡 Response status:", response.status)
    } else {
      console.log("⚠️ Network response not OK:", response.status)
    }
  } catch (error) {
    console.error("❌ Network connectivity failed:", error)
  }
}

// EXPO UPDATES CHECK (DISABLED FOR DEVELOPMENT)
const checkForUpdates = async () => {
  console.log("🔄 UPDATE CHECK DISABLED - Development mode")
}

// DEVICE DIAGNOSTICS
const runDeviceDiagnostics = () => {
  console.log("📱 DEVICE DIAGNOSTICS:")
  console.log("🤖 Platform:", Platform.OS)
  console.log("📊 Platform Version:", Platform.Version)
  console.log("🏗️ Development Mode:", DEBUG_MODE)

  if (Platform.OS === "ios") {
    console.log("🍎 iOS Platform Constants:", Platform.constants)
  } else {
    console.log("🤖 Android Platform Constants:", Platform.constants)
  }
}

// --- THEME DEFINITIONS (Dribbble Inspired) ---
const dribbbleColors = {
  light: {
    primary: "#8E7BEF", // Main accent blue/purple
    background: "#F0E6F8", // Light lavender background
    cardBackground: "#FFFFFF",
    text: "#333333",
    secondaryText: "#666666",
    border: "#E0E0E0",
    accent: "#FFC107", // Yellow for highlights
    success: "#8BC34A", // Green for success
    error: "#F44336", // Red for error
    warning: "#FFB366", // Orange for warning
    // Specific colors from Dribbble image cards
    cardBlue: "#8E7BEF",
    cardPink: "#F381C1",
    cardOrange: "#FFB366",
    cardGreen: "#8BC34A",
  },
  dark: {
    primary: "#A799FF", // Lighter primary for dark mode
    background: "#282A36", // Dark background
    cardBackground: "#3A3C4E", // Darker card background
    text: "#F8F8F2",
    secondaryText: "#BD93F9",
    border: "#44475A",
    accent: "#FFD54F",
    success: "#A5D6A7",
    error: "#EF9A9A",
    warning: "#FFB74D",
    // Specific colors for dark mode cards (adjusted)
    cardBlue: "#A799FF",
    cardPink: "#FF99CC",
    cardOrange: "#FFC98A",
    cardGreen: "#A5D6A7",
  },
  amoled: {
    primary: "#A799FF", // Lighter primary for AMOLED mode
    background: "#000000", // True black for AMOLED
    cardBackground: "#111111", // Very dark gray for cards
    text: "#FFFFFF",
    secondaryText: "#CCCCCC",
    border: "#333333",
    accent: "#FFD54F",
    success: "#A5D6A7",
    error: "#EF9A9A",
    warning: "#FFB74D",
    // Specific colors for AMOLED mode
    cardBlue: "#A799FF",
    cardPink: "#FF99CC",
    cardOrange: "#FFC98A",
    cardGreen: "#A5D6A7",
  },
}

const themes = {
  clean: {
    light: { ...dribbbleColors.light, primary: "#4A90E2" },
    dark: { ...dribbbleColors.dark, primary: "#79B8F3" },
    amoled: { ...dribbbleColors.amoled, primary: "#79B8F3" },
  },
  blue: {
    light: { ...dribbbleColors.light, primary: "#2196F3" },
    dark: { ...dribbbleColors.dark, primary: "#64B5F6" },
    amoled: { ...dribbbleColors.amoled, primary: "#64B5F6" },
  },
  green: {
    light: { ...dribbbleColors.light, primary: "#4CAF50" },
    dark: { ...dribbbleColors.dark, primary: "#81C784" },
    amoled: { ...dribbbleColors.amoled, primary: "#81C784" },
  },
  purple: {
    light: { ...dribbbleColors.light, primary: "#9C27B0" },
    dark: { ...dribbbleColors.dark, primary: "#BA68C8" },
    amoled: { ...dribbbleColors.amoled, primary: "#BA68C8" },
  },
  dribbble: {
    light: dribbbleColors.light,
    dark: dribbbleColors.dark,
    amoled: dribbbleColors.amoled,
  },
}

// Custom Button Component
const CustomButton = ({ title, onPress, icon, style, textStyle, color, outline, disabled }) => {
  const primaryColor = color || "#8E7BEF";
  const isOutlined = !!outline;

  let buttonBackgroundColor = isOutlined ? "transparent" : primaryColor;
  let buttonTextColor = isOutlined ? primaryColor : "#FFFFFF";
  let buttonBorderColor = isOutlined ? primaryColor : "transparent";

  if (disabled) {
    if (isOutlined) {
      buttonTextColor = '#888';
      buttonBorderColor = '#555';
    } else {
      buttonBackgroundColor = '#555';
      buttonTextColor = '#AAA';
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.customButton,
        {
          backgroundColor: buttonBackgroundColor,
          borderColor: buttonBorderColor,
          borderWidth: isOutlined ? 1 : 0,
        },
        style,
        disabled && styles.customButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon && <MaterialCommunityIcons name={icon} size={20} color={buttonTextColor} style={styles.customButtonIcon} />}
      <Text style={[styles.customButtonText, { color: buttonTextColor }, textStyle]}>{title || ""}</Text>
    </TouchableOpacity>
  );
};

// Custom TextInput Component
const CustomTextInput = ({ label, value, onChangeText, style, icon, theme, placeholder, ...props }) => {
  const currentTheme = theme || { text: "#333", secondaryText: "#666", border: "#ccc", cardBackground: "#f9f9f9" };
  return (
    <View style={[styles.customTextInputContainer, style]}>
      {label && <Text style={[styles.customTextInputLabel, { color: currentTheme.text }]}>{label}</Text>}
      <View style={[
        styles.customTextInputWrapper,
        {
          borderColor: currentTheme.secondaryText, // Use a more visible color for the border
          backgroundColor: currentTheme.cardBackground,
        },
      ]}>
        {icon && <MaterialCommunityIcons name={icon} size={20} color={currentTheme.secondaryText} style={styles.customTextInputIcon} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={[
            styles.customTextInput,
            icon && { paddingLeft: 40 },
            { color: currentTheme.text, backgroundColor: 'transparent' },
          ]}
          placeholder={placeholder || "Enter text"}
          placeholderTextColor={currentTheme.secondaryText}
          {...props}
        />
      </View>
    </View>
  );
};

// Custom Card Component
const CustomCard = ({ children, style, theme }) => {
  const currentTheme = theme || { cardBackground: "#FFFFFF" }
  return <View style={[styles.customCard, { backgroundColor: currentTheme.cardBackground }, style]}>{children}</View>
}

// Custom Badge Component
const CustomBadge = ({ text, style, textColor, backgroundColor }) => {
  return (
    <View style={[styles.customBadge, { backgroundColor: backgroundColor || "#ccc" }, style]}>
      <Text style={[(styles.customBadgeText || {}), { color: textColor || "#000" }]}>{text}</Text>
    </View>
  )
}

// Custom Switch Component
const CustomSwitch = ({ value, onValueChange, label, color, theme }) => {
  const currentTheme = theme || { text: "#333", primary: "#8E7BEF" }
  const switchColor = color || currentTheme.primary
  return (
    <TouchableOpacity onPress={() => onValueChange(!value)} style={styles.customSwitchContainer}>
      <Text style={[styles.customSwitchLabel, { color: currentTheme.text }]}>{label}</Text>
      <View style={[styles.customSwitchTrack, { backgroundColor: value ? switchColor : "#ccc" }]}>
        <Animated.View style={[styles.customSwitchThumb, { left: value ? 22 : 2 }]} />
      </View>
    </TouchableOpacity>
  )
}

// Custom Segmented Buttons (simplified)
const CustomSegmentedButtons = ({ options, selectedValue, onValueChange, theme }) => {
  return (
    <View style={styles.segmentedButtonsContainer}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.segmentedButton,
            {
              backgroundColor: selectedValue === option.value ? theme.primary : theme.cardBackground,
              borderColor: selectedValue === option.value ? theme.primary : theme.border,
            },
          ]}
          onPress={() => onValueChange(option.value)}
        >
          <Text style={{ color: selectedValue === option.value ? '#FFFFFF' : theme.text, fontWeight: '600' }}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Timer Lockout Overlay Component
const TimerLockoutOverlay = ({ show, remainingTime, onExitAttempt, currentTheme, formatTime }) => {
  if (!show) return null
  return (
    <View style={[styles.lockoutOverlay, { backgroundColor: currentTheme.background + "80" }]}>
      <View style={[styles.lockoutContent, { backgroundColor: currentTheme.cardBackground }]}>
        <Text style={[styles.lockoutTitle, { color: currentTheme.text }]}>Focus Mode Active</Text>
        <Text style={[styles.lockoutMessage, { color: currentTheme.secondaryText }]}>
          Stay focused. You cannot exit until the timer is complete.
        </Text>
        <Text
          style={[
            styles.lockoutTimer,
            {
              color: currentTheme.primary,
              backgroundColor: currentTheme.background,
              borderColor: currentTheme.primary,
            },
          ]}
        >
          {formatTime(remainingTime)}
        </Text>
        <Text style={[styles.lockoutMessage, { color: currentTheme.secondaryText }]}>
          Keep going, you're doing great!
        </Text>
        <CustomButton
          title="Attempt Exit (Warning)"
          icon="close"
          onPress={onExitAttempt}
          style={{ backgroundColor: currentTheme.error, marginTop: 20 }}
          textStyle={{ color: "#FFFFFF" }}
        />
      </View>
    </View>
  )
}

// --- Update TaskEditModal to allow color and importance selection ---
const colorPalette = [
  '#8E7BEF', // purple
  '#FFC107', // yellow
  '#8BC34A', // green
  '#F381C1', // pink
  '#FFB366', // orange
  '#2196F3', // blue
  '#F44336', // red
  '#A799FF', // light purple
];

const TaskEditModal = ({ visible, onClose, task, onSave, theme }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [color, setColor] = useState(colorPalette[0]);
  const [important, setImportant] = useState(false);
  const [dueDate, setDueDate] = useState(null);
  const [dueDateText, setDueDateText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  const [tempDate, setTempDate] = useState(null);

  // Reset modal state when opening for a new task or closing
  useEffect(() => {
    if (visible) {
      if (task) {
        setTitle(task?.title || task?.name || '');
        setDescription(task?.description || '');
        setSubtasks(task?.subtasks ? [...task.subtasks] : []);
        setColor(task?.color || colorPalette[0]);
        setImportant(!!task?.important);
        setDueDate(task?.dueDate ? new Date(task.dueDate) : null);
        setDueDateText(task?.dueDate ? new Date(task.dueDate).toLocaleString() : '');
      } else {
        setTitle('');
        setDescription('');
        setSubtasks([]);
        setColor(colorPalette[0]);
        setImportant(false);
        setDueDate(null);
        setDueDateText('');
      }
    } else {
      // Optionally reset state when modal closes
      setTitle('');
      setDescription('');
      setSubtasks([]);
      setColor(colorPalette[0]);
      setImportant(false);
      setDueDate(null);
      setDueDateText('');
    }
  }, [visible, task]);

  const handleSubtaskToggle = (idx) => {
    setSubtasks((prev) => prev.map((st, i) => i === idx ? { ...st, completed: !st.completed } : st));
  };
  const handleSubtaskChange = (idx, text) => {
    setSubtasks((prev) => prev.map((st, i) => i === idx ? { ...st, text } : st));
  };
  const handleAddSubtask = () => {
    setSubtasks((prev) => [...prev, { text: '', completed: false }]);
  };
  const handleDeleteSubtask = (idx) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleSave = () => {
    let finalDueDate = dueDate;
    if (!finalDueDate && dueDateText) {
      const parsed = new Date(dueDateText);
      if (!isNaN(parsed.getTime())) finalDueDate = parsed;
    }
    onSave({ ...task, title, name: title, description, subtasks, color, important, dueDate: finalDueDate ? finalDueDate.toISOString() : undefined });
    onClose();
  };
  const handleDateChange = (event, selectedDate) => {
    if (pickerMode === 'date' && selectedDate) {
      setTempDate(selectedDate);
      setPickerMode('time');
      setShowDatePicker(true);
    } else if (pickerMode === 'time' && selectedDate) {
      const combined = new Date(tempDate || dueDate || new Date());
      combined.setHours(selectedDate.getHours());
      combined.setMinutes(selectedDate.getMinutes());
      combined.setSeconds(0);
      setDueDate(combined);
      setDueDateText(combined.toLocaleString());
      setShowDatePicker(false);
      setPickerMode('date');
      setTempDate(null);
    } else {
      setShowDatePicker(false);
      setPickerMode('date');
      setTempDate(null);
    }
  };
  return (
    <RNModal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center' }}>
        <ScrollView
          style={{ maxHeight: '90%', width: '90%' }}
          contentContainerStyle={{ backgroundColor: theme.cardBackground, borderRadius: 16, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Edit Task</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Task Title"
            style={{ borderColor: theme.primary, borderWidth: 1, borderRadius: 8, color: theme.text, padding: 8, marginBottom: 12 }}
            placeholderTextColor={theme.secondaryText}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            style={{ borderColor: theme.border, borderWidth: 1, borderRadius: 8, color: theme.text, padding: 8, marginBottom: 12, minHeight: 40 }}
            placeholderTextColor={theme.secondaryText}
            multiline
          />
          {/* Due Date/Time Picker and Manual Entry */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity onPress={() => { setPickerMode('date'); setShowDatePicker(true); }} style={{ marginRight: 8, marginBottom: 4 }}>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>{dueDate ? `Due: ${dueDate.toLocaleString()}` : '+ Pick Due Date & Time'}</Text>
            </TouchableOpacity>
            <Text style={{ color: theme.secondaryText, marginHorizontal: 4, marginBottom: 4 }}>or</Text>
            <TextInput
              value={dueDateText}
              onChangeText={setDueDateText}
              placeholder="YYYY-MM-DD HH:MM"
              style={{ borderColor: theme.border, borderWidth: 1, borderRadius: 8, color: theme.text, padding: 6, minWidth: 120, maxWidth: 180, flexShrink: 1, marginBottom: 4 }}
              placeholderTextColor={theme.secondaryText}
            />
            </View>
          {showDatePicker && (
            <DateTimePicker
              value={dueDate || new Date()}
              mode={pickerMode}
              is24Hour={true}
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}
          <Text style={{ color: theme.text, fontWeight: '600', marginBottom: 8, marginTop: 8 }}>Subtasks</Text>
          {subtasks.map((st, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity onPress={() => handleSubtaskToggle(idx)} style={{ marginRight: 8 }}>
                <MaterialCommunityIcons name={st.completed ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={theme.primary} />
              </TouchableOpacity>
              <TextInput
                value={st.text}
                onChangeText={text => handleSubtaskChange(idx, text)}
                placeholder={`Subtask ${idx + 1}`}
                style={{ flex: 1, borderBottomWidth: 1, borderColor: theme.border, color: theme.text, padding: 4 }}
                placeholderTextColor={theme.secondaryText}
              />
              {/* Delete subtask button */}
              <TouchableOpacity onPress={() => handleDeleteSubtask(idx)} style={{ marginLeft: 8 }}>
                <MaterialCommunityIcons name="delete" size={20} color={theme.error || '#F44336'} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={handleAddSubtask} style={{ marginVertical: 8 }}>
            <Text style={{ color: theme.primary, fontWeight: 'bold' }}>+ Add Subtask</Text>
          </TouchableOpacity>
          {/* Color selection */}
          <Text style={{ color: theme.text, fontWeight: '600', marginTop: 16, marginBottom: 4 }}>Card Color</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
            {colorPalette.map((c, idx) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: 14, backgroundColor: c, marginRight: 10, marginBottom: 8,
                  borderWidth: color === c ? 3 : 1,
                  borderColor: color === c ? theme.primary : theme.border,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                {color === c && <MaterialCommunityIcons name="check" size={18} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
          {/* Important toggle */}
          <TouchableOpacity onPress={() => setImportant(i => !i)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <MaterialCommunityIcons name={important ? 'star' : 'star-outline'} size={22} color={important ? '#FFD700' : theme.secondaryText} style={{ marginRight: 6 }} />
            <Text style={{ color: theme.text, fontWeight: '600' }}>Mark as Important</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
            <CustomButton title="Cancel" onPress={onClose} outline color={theme.primary} style={{ marginRight: 8 }} />
            <CustomButton title="Save" onPress={handleSave} color={theme.primary} />
          </View>
        </ScrollView>
      </View>
    </RNModal>
  );
};

// --- Modern, aesthetic TaskCard redesign ---
const TaskCard = ({ task, onPress, onComplete, onUncomplete, onDelete, theme, accent, type, onToggleSubtask }) => {
  const { colors: themeColors } = useTheme();
  const currentTheme = theme || themeColors;
  const cardBg = currentTheme.cardBackground || '#fff';
  // Use the selected card color for border and accent, and compute text color for contrast
  const cardAccent = accent || currentTheme.primary;
  const borderColor = task.important ? cardAccent : (currentTheme.border || '#E5EAF1');
  const isAccentDark = Color(cardAccent).isDark();
  const accentTextColor = isAccentDark ? '#fff' : '#222';
  const textColor = isAccentDark && task.color ? '#fff' : (currentTheme.text || '#222');
  // Ensure glow is visible on AMOLED by using a fallback color if accent is too dark
  const glowColor = (cardAccent && (Color(cardAccent).isDark() || Color(currentTheme.cardBackground).isDark())) ? '#a799ff' : cardAccent;
  const importantGlow = task.important
    ? {
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 18,
        elevation: 16,
        borderWidth: 2,
        borderColor: glowColor,
        ...(Platform.OS === 'web' ? { boxShadow: `0 0 16px 2px ${glowColor}` } : {}),
      }
    : {};
  // If this is a birthday card, render a simplified card
  if (type === 'birthday') {
    return (
      <View style={{
        backgroundColor: cardBg,
        borderRadius: 18,
        padding: 20,
        marginVertical: 10,
        marginHorizontal: 2,
        borderWidth: 1.5,
        borderColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        minHeight: 80,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...importantGlow,
      }}>
        <View>
          <Text style={{ color: textColor, fontWeight: '700', fontSize: 17, marginBottom: 2 }}>{task.title || task.name || 'Birthday'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <MaterialCommunityIcons name="cake-variant" size={18} color={cardAccent} style={{ marginRight: 4 }} />
            <Text style={{ color: cardAccent, fontWeight: '600', fontSize: 14 }}>{task.date}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {task.completed ? (
            <TouchableOpacity 
              onPress={() => onUncomplete && onUncomplete(task.id)} 
              style={{ marginLeft: 8, backgroundColor: currentTheme.warning + '22', borderRadius: 8, padding: 8 }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={22} color={currentTheme.warning || '#D32F2F'} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={() => onComplete && onComplete(task.id)} 
              style={{ backgroundColor: cardAccent, borderRadius: 8, padding: 8 }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={22} color={accentTextColor} />
            </TouchableOpacity>
          )}
          {/* Delete button beside the check/uncheck button */}
          <TouchableOpacity 
            onPress={() => onDelete && onDelete(task.id)} 
            style={{ marginLeft: 8, backgroundColor: currentTheme.error + '22', borderRadius: 8, padding: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={currentTheme.error || '#D32F2F'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  const completed = task.subtasks ? task.subtasks.filter(st => st.completed).length : 0;
  const total = task.subtasks ? task.subtasks.length : 0;
  const progress = total > 0 ? completed / total : 0;
  const status = task.completed ? 'Completed' : (progress > 0 ? 'In Progress' : 'Not Started');
  const statusColor = task.completed ? currentTheme.success || '#4CAF50' : (progress > 0 ? cardAccent : currentTheme.secondaryText || '#B0B0B0');
  return (
    <View style={{
      backgroundColor: cardBg,
      borderRadius: 18,
      padding: 20,
      marginVertical: 10,
      marginHorizontal: 2,
      borderWidth: 1.5,
      borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
      minHeight: 120,
      ...importantGlow,
    }}>
      {/* Status badge */}
      <View style={{ position: 'absolute', top: 14, right: 18, backgroundColor: cardAccent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2 }}>
        <Text style={{ color: accentTextColor, fontWeight: '700', fontSize: 12 }}>{(task.completed ? 'COMPLETED' : (task.subtasks && task.subtasks.some(st => st.completed) ? 'IN PROGRESS' : 'NOT STARTED')).toUpperCase()}</Text>
      </View>
      {/* Title and description */}
      <TouchableOpacity onPress={onPress ? () => onPress(task) : null} activeOpacity={onPress ? 0.93 : 1}>
        <Text style={{ color: textColor, fontWeight: '700', fontSize: 17, marginBottom: 2 }} numberOfLines={1}>{task.title || task.name || 'Untitled'}</Text>
        {task.description ? <Text style={{ color: currentTheme.secondaryText || '#888', fontSize: 14, marginBottom: 6 }} numberOfLines={2}>{task.description}</Text> : null}
      </TouchableOpacity>
      {/* Due date/time */}
      {task.dueDate && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <MaterialCommunityIcons name="calendar-clock" size={17} color={cardAccent} style={{ marginRight: 4 }} />
          <Text style={{ color: cardAccent, fontWeight: '600', fontSize: 13 }}>{new Date(task.dueDate).toLocaleString()}</Text>
        </View>
      )}
      {/* Progress bar and subtask count */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 2 }}>
        <Text style={{ color: cardAccent, fontWeight: '600', fontSize: 13, marginRight: 8 }}>TASK PROGRESS</Text>
        <View style={{ flex: 1, height: 7, backgroundColor: currentTheme.border || '#F0F2F6', borderRadius: 4, overflow: 'hidden', marginRight: 8 }}>
          <View style={{ width: `${(task.subtasks && task.subtasks.length > 0 ? (task.subtasks.filter(st => st.completed).length / task.subtasks.length) : 0) * 100}%`, height: 7, backgroundColor: cardAccent, borderRadius: 4, opacity: (task.subtasks && task.subtasks.length > 0) ? 1 : 0.25 }} />
        </View>
        <Text style={{ color: cardAccent, fontWeight: '700', fontSize: 13 }}>{task.subtasks && task.subtasks.length > 0 ? `${Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)}%` : '0%'}</Text>
      </View>
      {/* Subtasks */}
      {task.subtasks && task.subtasks.length > 0 && (
        <View style={{ marginBottom: 8, marginLeft: 2 }}>
          <Text style={{ color: cardAccent, fontWeight: '600', fontSize: 13, marginBottom: 2 }}>{`SUB-TASKS: ${task.subtasks.length}`}</Text>
          {task.subtasks.slice(0, 4).map((st, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <TouchableOpacity onPress={() => onToggleSubtask && onToggleSubtask(task.id, idx)}>
                <MaterialCommunityIcons
                  name={st.completed ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={17}
                  color={st.completed ? cardAccent : (currentTheme.secondaryText || '#B0B0B0')}
                  style={{ marginRight: 6 }}
                />
              </TouchableOpacity>
              <Text style={{ color: st.completed ? (currentTheme.secondaryText || '#B0B0B0') : textColor, textDecorationLine: st.completed ? 'line-through' : 'none', opacity: st.completed ? 0.6 : 1, fontSize: 14 }} numberOfLines={1}>{st.text}</Text>
            </View>
          ))}
          {task.subtasks.length > 4 && (
            <Text style={{ color: cardAccent, fontSize: 12, marginLeft: 24 }}>+{task.subtasks.length - 4} more subtasks</Text>
          )}
        </View>
      )}
      {/* Action icons */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8 }}>
        {task.completed ? (
          <TouchableOpacity 
            onPress={() => onUncomplete && onUncomplete(task.id)} 
            style={{ marginLeft: 8, backgroundColor: currentTheme.warning + '22', borderRadius: 8, padding: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={22} color={currentTheme.warning || '#D32F2F'} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={() => onComplete && onComplete(task.id)} 
            style={{ backgroundColor: cardAccent, borderRadius: 8, padding: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={accentTextColor} />
          </TouchableOpacity>
        )}
        {/* Delete button beside the check/uncheck button */}
        <TouchableOpacity 
          onPress={() => onDelete && onDelete(task.id)} 
          style={{ marginLeft: 8, backgroundColor: currentTheme.error + '22', borderRadius: 8, padding: 8 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={currentTheme.error || '#D32F2F'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main App Component
const App = () => {
  console.log("🚀 KWESTUP MAIN APP COMPONENT LOADING...")
  console.log("Drawer object:", Drawer)

  const [dailyTasks, setDailyTasks] = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [timerDuration, setTimerDuration] = useState(25 * 60)
  const [timerRemaining, setTimerRemaining] = useState(25 * 60)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [showTimerLockout, setShowTimerLockout] = useState(false)
  const [confirmationVisible, setConfirmationVisible] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState("")
  const confirmationActionRef = useRef(null)
  const confirmationCancelActionRef = useRef(null)
  const timerIntervalRef = useRef(null)

  const [themeMode, setThemeMode] = useState("light") // "light", "dark", "amoled"
  const [selectedThemeName, setSelectedThemeName] = useState("dribbble") // Default to dribbble theme
  const [userName, setUserName] = useState("")
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerMode, setPickerMode] = useState("date")
  const [pickerTarget, setPickerTarget] = useState(null)
  const [confettiVisible, setConfettiVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Define currentTheme with fallback to prevent undefined errors
  const currentTheme = themes[selectedThemeName]?.[themeMode] || themes.dribbble.light

  const initializeApp = useCallback(async () => {
    setIsLoading(true)
    try {
      runDeviceDiagnostics()
      await checkForUpdates()
      await runNetworkDiagnostics()

      if (FORCE_CLEAR_ALL_STORAGE) {
        await clearAllCaches()
      }

      const lastVersion = await AsyncStorage.getItem("kwestup_last_version")
      if (lastVersion !== APP_VERSION) {
        console.log("🔄 Version change detected, clearing caches...")
        await clearAllCaches()
      }

      const storedUserName = await AsyncStorage.getItem(`kwestup_userName_${STORAGE_VERSION}`)
      if (storedUserName) {
        setUserName(storedUserName)
        setShowNameDialog(false)
      } else {
        setShowNameDialog(true)
      }

      setIsInitialized(true)
      setIsLoading(false)
    } catch (error) {
      console.error("❌ APP INITIALIZATION FAILED:", error)
      setIsInitialized(true)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    initializeApp()
  }, [initializeApp])

  // Save userName to AsyncStorage immediately when set
  useEffect(() => {
    if (userName && userName.trim()) {
      AsyncStorage.setItem(`kwestup_userName_${STORAGE_VERSION}`, userName)
    }
  }, [userName])

  const loadData = useCallback(async () => {
    if (!isInitialized) return;

    try {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      // Load all data in parallel
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
      // No need for extra logs
    } catch (error) {
      // Optionally show a toast or alert here
      setDailyTasks([]);
      setBirthdays([]);
      setTasks([]);
      setThemeMode("light");
      setSelectedThemeName("dribbble");
    }
  }, [isInitialized]);

  const saveData = useCallback(async () => {
    if (!isInitialized) return

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
    }

    try {
      const storageKey = `kwestup_data_${STORAGE_VERSION}`
      await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave))
      console.log("💾 Data saved successfully to:", storageKey)
    } catch (error) {
      console.error("❌ Failed to save data:", error)
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
  ])

  useEffect(() => {
    if (isInitialized) {
      requestNotificationPermissions()
      loadData()
    }
  }, [isInitialized, loadData])

  useEffect(() => {
    if (isInitialized) {
      saveData()
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
  ])

  useEffect(() => {
    if (isTimerRunning && timerRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current)
            setIsTimerRunning(false)
            setShowTimerLockout(false)
            showConfirmation("Congratulations! You completed your focus session!", () => {
              setConfettiVisible(true)
            })
            Notifications.scheduleNotificationAsync({
              content: {
                title: "KwestUp Focus Timer",
                body: "Your focus session is complete! Great job!",
                sound: "default",
              },
              trigger: null,
            })
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (!isTimerRunning && timerRemaining === 0) {
      clearInterval(timerIntervalRef.current)
      setShowTimerLockout(false)
    } else if (!isTimerRunning && timerRemaining > 0) {
      clearInterval(timerIntervalRef.current)
    }

    return () => clearInterval(timerIntervalRef.current)
  }, [isTimerRunning, timerRemaining])

  const showConfirmation = (message, onConfirm, onCancel = null) => {
    setConfirmationMessage(message)
    confirmationActionRef.current = onConfirm
    confirmationCancelActionRef.current = onCancel
    setConfirmationVisible(true)
  }

  const handleConfirmation = () => {
    setConfirmationVisible(false)
    if (confirmationActionRef.current) {
      confirmationActionRef.current()
    }
  }

  const handleCancelConfirmation = () => {
    setConfirmationVisible(false)
    if (confirmationCancelActionRef.current) {
      confirmationCancelActionRef.current()
    }
  }

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Modified toggleTaskComplete to include completedDate
  const toggleTaskComplete = (id) => {
    console.log("🔄 Task toggle button pressed for task ID:", id);
    setTasks(
      tasks.map((task) => {
        if (task.id === id) {
          const newCompletedStatus = !task.completed
          console.log("📊 Toggling task:", task.title || task.name, "from", task.completed, "to", newCompletedStatus);
          return {
            ...task,
            completed: newCompletedStatus,
            completedDate: newCompletedStatus ? new Date().toISOString().slice(0, 10) : null,
            completedAt: newCompletedStatus ? new Date().toISOString() : null,
          }
        }
        return task
      }),
    )
    console.log("✅ Task toggled:", id)
  }

  const deleteTask = (id) => {
    showConfirmation(
      "Are you sure you want to delete this task?",
      () => {
        setTasks(tasks => {
          const taskToDelete = tasks.find(t => t.id === id);
          if (taskToDelete && taskToDelete.notificationId) {
            cancelDueDateNotification(taskToDelete.notificationId);
          }
          return tasks.filter((task) => task.id !== id);
        });
        console.log("🗑️ Task deleted:", id);
      },
      () => {},
    );
  }

  const handleCompleteTask = (taskId) => {
    const now = new Date().toISOString();
    console.log("🎯 Task completion button pressed for task ID:", taskId);
    setTasks(prevTasks => {
      const newTasks = prevTasks.map(task => {
        if (task.id === taskId) {
          console.log("✅ Marking task as complete:", task.title || task.name);
          return { 
            ...task, 
            completed: true, 
            completedDate: now.slice(0, 10),
            completedAt: now // Ensure this is set for chart tracking
          };
        }
        return task;
      });
      return newTasks;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    schedulePushNotification({
      title: 'Task Completed! ✨',
      body: "Great job! Another one bites the dust.",
    });
  };

  // Helper to schedule a push notification for a due date
  async function scheduleDueDateNotification(task) {
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
      // Optionally log or show a toast
    }
    return null;
  }

  // Helper to cancel a scheduled notification
  async function cancelDueDateNotification(notificationId) {
    if (notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      } catch (e) {}
    }
  }

  // Update handleSaveTask to schedule/cancel notifications
  const handleSaveTask = (savedTask) => {
    setTasks(currentTasks => {
      const existingTaskIndex = currentTasks.findIndex(t => t.id === savedTask.id);
      if (existingTaskIndex > -1) {
        // Update existing task
        const oldTask = currentTasks[existingTaskIndex];
        // Cancel old notification if dueDate changed or removed
        if (oldTask.notificationId && oldTask.dueDate !== savedTask.dueDate) {
          cancelDueDateNotification(oldTask.notificationId);
        }
        // Schedule new notification if dueDate exists
        if (savedTask.dueDate) {
          scheduleDueDateNotification(savedTask).then(notificationId => {
            const newTasks = [...currentTasks];
            newTasks[existingTaskIndex] = { ...savedTask, notificationId };
            setTasks(newTasks);
          });
          return currentTasks; // Will be updated in .then
        } else {
          // No dueDate, just update
          const newTasks = [...currentTasks];
          newTasks[existingTaskIndex] = { ...savedTask, notificationId: null };
          return newTasks;
        }
      } else {
        // Add new task with a unique ID
        if (savedTask.dueDate) {
          scheduleDueDateNotification(savedTask).then(notificationId => {
            setTasks([...currentTasks, { ...savedTask, id: Date.now().toString(), notificationId }]);
          });
          return currentTasks; // Will be updated in .then
        } else {
          return [...currentTasks, { ...savedTask, id: Date.now().toString(), notificationId: null }];
        }
      }
    });
  };

  const onUpdateTask = (updatedTask) => {
    setTasks(currentTasks =>
      currentTasks.map(task =>
        task.id === updatedTask.id ? updatedTask : task
      )
    );
  };

  // --- Route Components ---

  const DashboardScreen = ({ tasks, currentTheme, handleCompleteTask, setSelectedTask, setModalVisible }) => {
    // Function to get weekly task statistics
    const getWeeklyTaskStats = useCallback(() => {
      console.log("📊 Generating weekly stats for tasks:", tasks.length, "total tasks");
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6); // Get date 6 days ago for a 7-day window

      const dailyStats = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(sevenDaysAgo.getDate() + i);
        const dateString = date.toISOString().slice(0, 10);
        const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" }).charAt(0);
        dailyStats[dateString] = {
          date: dateString,
          completed: 0,
          label: dayLabel,
        };
        console.log("📅 Day", i, ":", dateString, "(", dayLabel, ")");
      }

      // Count completed tasks for each day
      tasks.forEach((task) => {
        if (task.completed && task.completedAt) {
          const taskDate = new Date(task.completedAt);
          const dateString = taskDate.toISOString().slice(0, 10);
          
          if (dailyStats[dateString]) {
            dailyStats[dateString].completed++;
            console.log("✅ Task completed on", dateString, ":", task.title || task.name);
          }
        } else if (task.completed && task.completedDate) {
          // Fallback to completedDate if completedAt doesn't exist
          const dateString = task.completedDate;
          if (dailyStats[dateString]) {
            dailyStats[dateString].completed++;
            console.log("✅ Task completed on", dateString, "(using completedDate):", task.title || task.name);
          }
        }
      });

      // Log the stats for debugging
      Object.entries(dailyStats).forEach(([date, stats]) => {
        console.log("📈", date, ":", stats.completed, "tasks completed");
      });

      // Convert to array for chart, sorted by date
      return Object.values(dailyStats);
    }, [tasks])

    const weeklyStatsData = getWeeklyTaskStats()

    const handleToggleSubtask = (taskId, subtaskIdx) => {
      setTasks(prevTasks => prevTasks.map(task => {
        if (task.id === taskId) {
          const newSubtasks = task.subtasks.map((st, idx) => idx === subtaskIdx ? { ...st, completed: !st.completed } : st);
          return { ...task, subtasks: newSubtasks };
        }
        return task;
      }));
    };

    return (
      <ScrollView style={styles.tabContentScroll}>
        <View style={styles.tabContent}>
          <Text style={[styles.dashboardSectionTitle, { color: currentTheme.text }]}>Your Tasks</Text>
          {tasks.filter(t => !t.completed).length === 0 ? (
            <CustomCard style={{ backgroundColor: currentTheme.cardBackground, alignItems: "center" }} theme={currentTheme}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={60} color={currentTheme.secondaryText} />
              <Text style={[styles.emptyListText, { color: currentTheme.secondaryText }]}>
                No active tasks. Start by adding one!
              </Text>
            </CustomCard>
          ) : (
            tasks.filter(t => !t.completed).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={() => {
                  setSelectedTask(task);
                  setModalVisible(true);
                }}
                onComplete={() => handleCompleteTask(task.id)}
                onUncomplete={() => toggleTaskComplete(task.id)}
                onDelete={deleteTask}
                theme={currentTheme}
                accent={task.color || currentTheme.primary}
                onToggleSubtask={handleToggleSubtask}
              />
            ))
          )}

          <Text style={[styles.dashboardSectionTitle, { color: currentTheme.text, marginTop: 20 }]}>
            Task Statistics
          </Text>
          <CustomCard style={{ backgroundColor: currentTheme.cardBackground }}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Weekly Activity</Text>
              <CustomBadge
                text={`${tasks.filter((t) => t.completed).length} Completed`}
                backgroundColor={currentTheme.primary}
                textColor="#FFFFFF"
              />
            </View>
            <View style={styles.chartPlaceholder}>
              <View style={styles.chartBarsContainer}>
                {weeklyStatsData.map((data, index) => (
                  <View key={index} style={styles.chartColumn}>
                    <View
                      style={[styles.chartBar, { 
                        height: Math.max(data.completed * 5, 2), // Ensure minimum height for visibility
                        backgroundColor: currentTheme.primary,
                        minHeight: 2 // Always show something
                      }]}
                    />
                    <Text style={[styles.chartLabel, { color: currentTheme.secondaryText }]}>{data.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: currentTheme.primary }]} />
                  <Text style={[styles.legendText, { color: currentTheme.secondaryText }]}>Completed</Text>
                </View>
              </View>
              {weeklyStatsData.every(d => d.completed === 0) && (
                <Text style={[styles.emptyListText, { color: currentTheme.secondaryText, marginTop: 10 }]}>
                  No completed tasks this week. Start completing some tasks!
                </Text>
              )}
            </View>
          </CustomCard>

          <View style={styles.bottomSummaryGrid}>
            <CustomCard style={[styles.bottomSummaryCard, { backgroundColor: currentTheme.cardBackground }]}>
              <Text style={[styles.bottomSummaryTitle, { color: currentTheme.text }]}>Total Completed Tasks</Text>
              <Text style={[styles.bottomSummaryValue, { color: currentTheme.text }]}>
                {tasks.filter((t) => t.completed).length} Tasks
              </Text>
            </CustomCard>
            <CustomCard style={[styles.bottomSummaryCard, { backgroundColor: currentTheme.cardBackground }]}>
              <Text style={[styles.bottomSummaryTitle, { color: currentTheme.text }]}>Total Incomplete Tasks</Text>
              <Text style={[styles.bottomSummaryValue, { color: currentTheme.text }]}>
                {tasks.filter((t) => !t.completed).length} Tasks
              </Text>
            </CustomCard>
          </View>
        </View>
      </ScrollView>
    )
  }

  const DailyTasksRoute = ({ currentTheme, setSelectedTask, setModalVisible, dailyTasks, setDailyTasks }) => {
    const [newTaskName, setNewTaskName] = useState("")
    const [newTaskTime, setNewTaskTime] = useState("")
    const [showTimePicker, setShowTimePicker] = useState(false)
    const [pickerMode, setPickerMode] = useState("time")
    const [pickerTarget, setPickerTarget] = useState("daily")
    const today = new Date().toISOString().slice(0, 10)

    const addDailyTask = () => {
      if (newTaskName.trim()) {
        const newDailyTask = {
          id: Date.now(),
          name: newTaskName.trim(),
          lastCompletedDate: null,
          time: newTaskTime || null,
          completed: false,
          completedDate: null,
          notificationId: null,
        };
        if (newDailyTask.time) {
          scheduleDailyTaskNotification(newDailyTask).then(notificationId => {
            setDailyTasks([...dailyTasks, { ...newDailyTask, notificationId }]);
          });
        } else {
          setDailyTasks([...dailyTasks, newDailyTask]);
        }
        setNewTaskName("");
        setNewTaskTime("");
        console.log("✅ Daily task added:", newDailyTask.name);
      }
    };

    const toggleDailyTaskComplete = (id) => {
      setDailyTasks(
        dailyTasks.map((task) => {
          if (task.id === id) {
            const newCompletedStatus = !task.completed
            return {
              ...task,
              completed: newCompletedStatus,
              completedDate: newCompletedStatus ? today : null,
              lastCompletedDate: newCompletedStatus ? today : null,
            }
          }
          return task
        })
      )
      console.log("✅ Daily task toggled:", id)
    }

    const deleteDailyTask = (id) => {
      showConfirmation(
        "Are you sure you want to delete this daily task?",
        () => {
          setDailyTasks(dailyTasks => {
            const taskToDelete = dailyTasks.find(t => t.id === id);
            if (taskToDelete && taskToDelete.notificationId) {
              cancelDueDateNotification(taskToDelete.notificationId);
            }
            return dailyTasks.filter((task) => task.id !== id);
          });
          console.log("🗑️ Daily task deleted:", id)
        },
        () => {},
      )
    }

    return (
      <ScrollView style={styles.tabContentScroll}>
        <View style={styles.tabContent}>
          <CustomCard style={{ backgroundColor: currentTheme.cardBackground }} theme={currentTheme}>
            <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>Add New Daily Task</Text>
            <View style={styles.inputRow}>
              <CustomTextInput
                label="Task Name"
                value={newTaskName}
                onChangeText={setNewTaskName}
                style={styles.textInputFlex}
                onSubmitEditing={addDailyTask}
                placeholderTextColor={currentTheme.secondaryText}
                theme={currentTheme}
              />
              <CustomButton
                title={newTaskTime || "Time"}
                icon="clock"
                onPress={() => {
                  setPickerMode("time")
                  setPickerTarget("daily")
                  setShowTimePicker(true)
                }}
                outline
                color={currentTheme.primary}
                style={styles.textInputTimeButton}
              />
            </View>
            <CustomButton
              title="Add Daily Task"
              icon="plus"
              onPress={addDailyTask}
              color={currentTheme.primary}
              style={styles.fullWidthButton}
            />
          </CustomCard>

          {dailyTasks.length === 0 ? (
            <CustomCard style={{ backgroundColor: currentTheme.cardBackground, alignItems: "center" }} theme={currentTheme}>
              <MaterialCommunityIcons name="bell-outline" size={60} color={currentTheme.secondaryText} />
              <Text style={[styles.emptyListText, { color: currentTheme.secondaryText }]}>No daily tasks added yet. Start by adding one!</Text>
            </CustomCard>
          ) : (
            <>
              {/* Incomplete Tasks */}
              {dailyTasks.filter(t => !t.completed).length > 0 && (
                dailyTasks.filter(t => !t.completed).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={{ ...task, title: task.name }}
                    onComplete={() => toggleDailyTaskComplete(task.id)}
                    onUncomplete={() => toggleDailyTaskComplete(task.id)}
                    onDelete={deleteDailyTask}
                    theme={currentTheme}
                    accent={currentTheme.primary}
                  />
                ))
              )}
              {/* Completed Divider and Tasks */}
              {dailyTasks.filter(t => t.completed).length > 0 && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
                    <View style={[styles.dividerLine, { backgroundColor: currentTheme.border }]} />
                    <Text style={[styles.completedTitle, { color: currentTheme.secondaryText }]}>Completed</Text>
                    <View style={[styles.dividerLine, { backgroundColor: currentTheme.border }]} />
                  </View>
                  {dailyTasks.filter(t => t.completed).map((task) => (
                    <View key={task.id} style={{ opacity: 0.7 }}>
                      <TaskCard
                        task={{ ...task, title: task.name }}
                        onComplete={() => toggleDailyTaskComplete(task.id)}
                        onUncomplete={() => toggleDailyTaskComplete(task.id)}
                        onDelete={deleteDailyTask}
                        theme={currentTheme}
                        accent={currentTheme.primary}
                      />
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </View>

        <Modal isVisible={showTimePicker && pickerTarget === "daily"} onBackdropPress={() => setShowTimePicker(false)}>
          <DateTimePicker
            value={new Date()}
            mode="time"
            is24Hour={true}
            display="spinner"
            onChange={(event, selectedDate) => {
              if (event.type === 'set' && selectedDate) {
                const hours = selectedDate.getHours().toString().padStart(2, "0")
                const minutes = selectedDate.getMinutes().toString().padStart(2, "0")
                setNewTaskTime(`${hours}:${minutes}`)
                setShowTimePicker(false)
              } else if (event.type === 'dismissed') {
                setShowTimePicker(false)
              }
            }}
          />
        </Modal>
      </ScrollView>
    )
  }

  const BirthdaysRoute = ({ currentTheme, setSelectedTask, setModalVisible }) => {
    const [newBirthdayName, setNewBirthdayName] = useState("");
    const [newBirthdayDate, setNewBirthdayDate] = useState("");
    const [showBirthdayDatePicker, setShowBirthdayDatePicker] = useState(false);

    const addBirthday = () => {
      if (newBirthdayName.trim() && newBirthdayDate) {
        const [month, day] = newBirthdayDate.split("-");
        const newBday = { id: Date.now(), name: newBirthdayName.trim(), date: `${month}-${day}` };
        setBirthdays((prev) => [...prev, newBday]);
        setNewBirthdayName("");
        setNewBirthdayDate("");
        console.log("🎂 Birthday added:", newBday.name);
      }
    };

    const deleteBirthday = (id) => {
      showConfirmation(
        "Are you sure you want to delete this birthday?",
        () => {
          setBirthdays((prev) => prev.filter((b) => b.id !== id));
          console.log("🗑️ Birthday deleted:", id);
        },
        () => {},
      );
    };

    const celebrateBirthday = (id) => {
      const birthday = birthdays.find((b) => b.id === id);
      showConfirmation(`Happy Birthday to ${birthday.name}!`, () => {
        setConfettiVisible(true);
        console.log("🎉 Birthday celebrated:", birthday.name);
      });
    };

    const playBirthdaySound = async () => {
      // You can use expo-av for sound playback, or use Notifications with a custom sound
      // For now, just trigger a notification with a sound
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎂 Birthday!',
          body: 'It\'s someone\'s birthday today! 🎉',
          sound: 'default', // You can use a custom sound if you add it to your project
        },
        trigger: null,
      });
    };

    const scheduleBirthdayNotification = async (name, month, day) => {
      const now = new Date();
      let year = now.getFullYear();
      const birthdayThisYear = new Date(`${year}-${month}-${day}T00:00:00`);
      if (birthdayThisYear < now) {
        year += 1;
      }
      const nextBirthday = new Date(`${year}-${month}-${day}T00:00:00`);
      await Notifications.scheduleNotificationAsync({
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
    };

    return (
      <>
      <ScrollView style={styles.tabContentScroll}>
        <View style={styles.tabContent}>
            <CustomCard style={{ backgroundColor: currentTheme.cardBackground }} theme={currentTheme}>
            <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>Add New Birthday</Text>
            <View style={styles.inputRow}>
              <CustomTextInput
                label="Person's Name"
                value={newBirthdayName}
                onChangeText={setNewBirthdayName}
                style={styles.textInputFlex}
                placeholderTextColor={currentTheme.secondaryText}
                  theme={currentTheme}
              />
              <CustomButton
                  title={newBirthdayDate || "MM-DD"}
                icon="calendar"
                  onPress={() => setShowBirthdayDatePicker(true)}
                outline
                color={currentTheme.primary}
                style={styles.textInputDateButton}
              />
            </View>
            <CustomButton
              title="Add Birthday"
              icon="plus"
              onPress={addBirthday}
              color={currentTheme.primary}
              style={styles.fullWidthButton}
            />
          </CustomCard>

          {birthdays.length === 0 ? (
              <CustomCard style={{ backgroundColor: currentTheme.cardBackground, alignItems: "center" }} theme={currentTheme}>
              <MaterialCommunityIcons name="cake-variant" size={60} color={currentTheme.secondaryText} />
                <Text style={[styles.emptyListText, { color: currentTheme.secondaryText }]}>No birthdays added yet. Add a special date!</Text>
            </CustomCard>
          ) : (
            birthdays.map((birthday) => (
              <TaskCard
                key={birthday.id}
                task={{ ...birthday, title: birthday.name, completed: false }} // Birthdays don't have completion state
                type="birthday"
                onPress={() => celebrateBirthday(birthday.id)}
                onComplete={() => celebrateBirthday(birthday.id)}
                onUncomplete={() => {}} // No uncomplete for birthdays
                onDelete={deleteBirthday}
                theme={currentTheme}
                accent={currentTheme.primary}
              />
            ))
          )}
        </View>
        </ScrollView>
        {/* Move the Modal outside the ScrollView to prevent state resets */}
        <Modal
          isVisible={showBirthdayDatePicker}
          onBackdropPress={() => setShowBirthdayDatePicker(false)}
        >
          <DateTimePicker
            value={new Date()}
            mode="date"
            display="calendar"
            onChange={(event, selectedDate) => {
              if (event.type === 'set' && selectedDate) {
                const month = (selectedDate.getMonth() + 1).toString().padStart(2, "0");
                const day = selectedDate.getDate().toString().padStart(2, "0");
                setNewBirthdayDate(`${month}-${day}`);
              }
              setShowBirthdayDatePicker(false);
            }}
          />
        </Modal>
      </>
    );
  };

  // Renamed GeneralTasksRoute to TaskListScreen and redesigned
  const TaskListScreen = ({ tasks, setTasks, handleCompleteTask, toggleTaskComplete, deleteTask, handleToggleSubtask, currentTheme, setSelectedTask, setModalVisible }) => {
    const activeTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    return (
      <View style={[styles.screen, { backgroundColor: currentTheme.background }]}>
        <Text style={[styles.screenTitle, { color: currentTheme.text }]}>Your Tasks</Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        >
          {activeTasks.length > 0 ? (
            activeTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={() => {
                  setSelectedTask(task);
                  setModalVisible(true);
                }}
                onComplete={() => handleCompleteTask(task.id)}
                onUncomplete={() => toggleTaskComplete(task.id)}
                onDelete={deleteTask}
                theme={currentTheme}
                accent={task.color || currentTheme.primary}
                onToggleSubtask={handleToggleSubtask}
              />
            ))
          ) : (
            <View style={styles.emptyStateContainer}>
              <Text style={[styles.emptyStateText, { color: currentTheme.secondaryText }]}>No active tasks. Good job!</Text>
            </View>
          )}

          {completedTasks.length > 0 && (
            <>
              <View style={styles.completedDivider}>
                <View style={[styles.dividerLine, { backgroundColor: currentTheme.border }]} />
                <Text style={[styles.completedTitle, { color: currentTheme.secondaryText }]}>Completed</Text>
                <View style={[styles.dividerLine, { backgroundColor: currentTheme.border }]} />
            </View>

              {completedTasks.map((task) => (
                <View key={task.id} style={{ opacity: 0.7 }}>
              <TaskCard
                    task={task}
                    theme={currentTheme}
                    accent={task.color || currentTheme.secondaryText}
                onDelete={deleteTask}
                    onUncomplete={() => toggleTaskComplete(task.id)}
                    onToggleSubtask={handleToggleSubtask}
              />
        </View>
              ))}
            </>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: currentTheme.primary }]}
          onPress={() => {
            setSelectedTask(null);
            setModalVisible(true);
          }}
        >
          <MaterialCommunityIcons name="plus" size={30} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
    );
  };

  const FocusTimerRoute = ({ currentTheme }) => {
    const startTimer = () => {
      if (!isTimerRunning && timerRemaining > 0) {
        setIsTimerRunning(true)
        setShowTimerLockout(true)
        console.log("⏰ Timer started!")
      }
    }

    const pauseTimer = () => {
      setIsTimerRunning(false)
      console.log("⏸️ Timer paused!")
    }

    const resetTimer = () => {
      showConfirmation(
        "Are you sure you want to reset the timer?",
        () => {
          setIsTimerRunning(false)
          setTimerRemaining(timerDuration)
          setShowTimerLockout(false)
          console.log("🔄 Timer reset!")
        },
        () => {},
      )
    }

    const handleDurationChange = (minutes) => {
      const parsedMinutes = Number.parseInt(minutes, 10)
      if (!isNaN(parsedMinutes) && parsedMinutes > 0) {
        const newDuration = parsedMinutes * 60
        setTimerDuration(newDuration)
        if (!isTimerRunning) {
          setTimerRemaining(newDuration)
        }
        console.log("⏱️ Timer duration changed to:", parsedMinutes, "minutes")
      }
    }

    return (
      <ScrollView style={styles.tabContentScroll}>
        <View style={[styles.tabContent, { alignItems: "center" }]}>
          <CustomCard style={{ backgroundColor: currentTheme.cardBackground }}>
            <Text style={[styles.timerTitle, { color: currentTheme.primary }]}>Focus Study Timer</Text>

            <View style={styles.timerInputContainer}>
              <Text style={[styles.timerInputLabel, { color: currentTheme.text }]}>Set Duration (minutes):</Text>
              <CustomTextInput
                keyboardType="numeric"
                value={(timerDuration / 60).toString()}
                onChangeText={handleDurationChange}
                editable={!isTimerRunning}
                style={styles.timerDurationInput}
                placeholderTextColor={currentTheme.secondaryText}
                theme={currentTheme}
              />
            </View>

            <View
              style={[
                styles.timerDisplayContainer,
                {
                  backgroundColor: isTimerRunning ? currentTheme.success + "20" : currentTheme.background,
                  borderColor: isTimerRunning ? currentTheme.success : currentTheme.primary,
                  borderWidth: isTimerRunning ? 4 : 3,
                },
              ]}
            >
              <Text
                style={[
                  styles.timerDisplayText,
                  {
                    color: isTimerRunning ? currentTheme.success : currentTheme.primary,
                  },
                ]}
              >
                {formatTime(timerRemaining)}
              </Text>
              {isTimerRunning && (
                <Text style={[styles.timerStatusText, { color: currentTheme.success }]}>FOCUS MODE</Text>
              )}
            </View>

            <View style={styles.timerControls}>
              {!isTimerRunning ? (
                <CustomButton
                  title="Start"
                  icon="play"
                  onPress={startTimer}
                  disabled={timerRemaining === 0}
                  color={currentTheme.success}
                  style={styles.timerButton}
                />
              ) : (
                <CustomButton
                  title="Pause"
                  icon="pause"
                  onPress={pauseTimer}
                  color={currentTheme.warning}
                  style={styles.timerButton}
                />
              )}
              <CustomButton
                title="Reset"
                icon="refresh"
                onPress={resetTimer}
                color={currentTheme.error}
                style={styles.timerButton}
              />
            </View>
          </CustomCard>

          <View style={[styles.infoTextContainer, { backgroundColor: currentTheme.cardBackground }]}>
            <MaterialCommunityIcons
              name="information-outline"
              color={currentTheme.secondaryText}
              size={20}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.infoText, { color: currentTheme.secondaryText }]}>
              Focus mode will prevent you from exiting until the timer completes.
            </Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  const SearchRoute = ({ currentTheme, setSelectedTask, setModalVisible }) => {
    const filteredDailyTasks = dailyTasks.filter((task) => task.name.toLowerCase().includes(searchQuery.toLowerCase()))
    const filteredBirthdays = birthdays.filter((bday) => bday.name.toLowerCase().includes(searchQuery.toLowerCase()))
    const filteredTasks = tasks.filter((task) => (task.title || task.name).toLowerCase().includes(searchQuery.toLowerCase()))

    const hasResults = filteredDailyTasks.length > 0 || filteredBirthdays.length > 0 || filteredTasks.length > 0;

    return (
      <ScrollView style={styles.tabContentScroll}>
        <View style={styles.tabContent}>
          <CustomTextInput
            label="Search all tasks and birthdays"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor={currentTheme.secondaryText}
            icon="magnify"
            theme={currentTheme}
          />

          {!hasResults && searchQuery.length > 0 ? (
            <CustomCard style={{ backgroundColor: currentTheme.cardBackground, alignItems: "center" }} theme={currentTheme}>
              <MaterialCommunityIcons name="magnify-minus-outline" size={60} color={currentTheme.secondaryText} />
              <Text style={[styles.emptyListText, { color: currentTheme.secondaryText }]}>
                No results found for "{searchQuery}".
              </Text>
            </CustomCard>
          ) : (
            <>
              {filteredTasks.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: currentTheme.primary, marginTop: 20 }]}>
                    General Tasks
                  </Text>
                  {filteredTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onPress={() => {
                        setSelectedTask(task)
                        setModalVisible(true)
                      }}
                      onComplete={() => handleCompleteTask(task.id)}
                      onUncomplete={() => toggleTaskComplete(task.id)}
                      onDelete={deleteTask}
                      theme={currentTheme}
                      accent={currentTheme.primary}
                    />
                  ))}
                </>
              )}
              {filteredDailyTasks.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: currentTheme.primary, marginTop: 20 }]}>Daily Tasks</Text>
                  {filteredDailyTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={{ ...task, title: task.name }}
                      onComplete={() => {}}
                      onUncomplete={() => toggleTaskComplete(task.id)}
                      onDelete={deleteTask}
                      theme={currentTheme}
                      accent={currentTheme.primary}
                    />
                  ))}
                </>
              )}
              {filteredBirthdays.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: currentTheme.primary, marginTop: 20 }]}>Birthdays</Text>
                  {filteredBirthdays.map((bday) => (
                    <TaskCard
                      key={bday.id}
                      task={{ ...bday, title: bday.name }}
                      onComplete={() => {}}
                      onUncomplete={() => toggleTaskComplete(bday.id)}
                      onDelete={deleteTask}
                      theme={currentTheme}
                      accent={currentTheme.primary}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    )
  }



  const SettingsRoute = ({ currentTheme }) => {
    const [tempUserName, setTempUserName] = useState(userName)

    const handleSaveSettings = () => {
      setUserName(tempUserName)
      setThemeMode(themeMode) // Use themeMode directly, no need for temp
      setSelectedThemeName(selectedThemeName) // Use selectedThemeName directly
      showConfirmation("Settings saved successfully!", () => {})
    }

    const handleResetData = () => {
      showConfirmation(
        "Are you sure you want to reset all data? This action cannot be undone.",
        () => {
          setDailyTasks([])
          setBirthdays([])
          setTasks([])
          setTimerDuration(25 * 60)
          setTimerRemaining(25 * 60)
          setIsTimerRunning(false)
          setShowTimerLockout(false)
          showConfirmation("All data has been reset!", () => {})
        },
        () => {},
      )
    }

    return (
      <ScrollView style={[styles.settingsContainer, { backgroundColor: currentTheme.background }]}>
        <Text style={[styles.settingsHeader, { color: currentTheme.text }]}>Settings</Text>

        {/* User Profile Section */}
        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, { color: currentTheme.primary, borderBottomColor: currentTheme.border }]}>User Profile</Text>
          <View style={styles.settingsRow}>
            <Text style={[styles.settingsLabel, { color: currentTheme.text }]}>Name</Text>
            <CustomTextInput
              value={tempUserName}
              onChangeText={setTempUserName}
              style={{ flex: 0.6 }} // Adjust width as needed
              placeholder="Enter your name"
              placeholderTextColor={currentTheme.secondaryText}
              theme={currentTheme}
            />
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, { color: currentTheme.primary, borderBottomColor: currentTheme.border }]}>Appearance</Text>
          <View style={[styles.settingsRow, { flexDirection: 'column', alignItems: 'flex-start' }]}> 
            <Text style={[styles.settingsLabel, { color: currentTheme.text, marginBottom: 12 }]}>Theme Mode</Text>
            <CustomSegmentedButtons
              selectedValue={themeMode}
              onValueChange={setThemeMode}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "amoled", label: "AMOLED" },
              ]}
              theme={currentTheme}
            />
          </View>
          <View style={[styles.settingsRow, { flexDirection: 'column', alignItems: 'flex-start' }]}> 
            <Text style={[styles.settingsLabel, { color: currentTheme.text, marginBottom: 12 }]}>Color Theme</Text>
            <CustomSegmentedButtons
              selectedValue={selectedThemeName}
              onValueChange={setSelectedThemeName}
              options={[
                { value: "dribbble", label: "Dribbble" },
                { value: "clean", label: "Clean" },
                { value: "blue", label: "Blue" },
                { value: "green", label: "Green" },
                { value: "purple", label: "Purple" },
              ]}
              theme={currentTheme}
            />
          </View>
        </View>
        
        {/* About Section */}
        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, { color: currentTheme.primary, borderBottomColor: currentTheme.border }]}>About</Text>
          <TouchableOpacity style={styles.settingsAction} onPress={() => Linking.openURL("https://github.com/Omprakash-p06/KwestUpMobile")}> 
            <Text style={[styles.settingsActionText, { color: currentTheme.text }]}>GitHub Repository</Text>
            <MaterialCommunityIcons name="github" size={24} color={currentTheme.text} />
          </TouchableOpacity>
          <View style={styles.settingsAction}> 
            <Text style={[styles.settingsActionText, { color: currentTheme.text }]}>Developed by</Text>
            <Text style={[styles.settingsLabel, { color: currentTheme.secondaryText }]}>Omprakash Panda</Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  

  const CustomDrawerContent = (props) => {
    console.log("CustomDrawerContent rendered with props:", props)
    const navigation = useNavigation()
    const { state } = props
    const currentRouteName = state?.routes?.[state?.index]?.name || "Dashboard"

    const drawerItems = [
      { key: "Dashboard", title: "Dashboard", icon: "view-dashboard", route: "Dashboard" },
      { key: "Daily", title: "Daily Tasks", icon: "bell", route: "Daily" },
      { key: "Birthdays", title: "Birthdays", icon: "cake", route: "Birthdays" },
      { key: "Tasks", title: "Task List", icon: "clipboard-list", route: "Tasks" },
      { key: "Focus", title: "Focus Timer", icon: "timer", route: "Focus" },
      { key: "Settings", title: "Settings", icon: "cog", route: "Settings" },
      { key: "Search", title: "Search", icon: "magnify", route: "Search" },
    ]

    return (
      <SafeAreaView style={[styles.drawerContent, { backgroundColor: currentTheme.cardBackground }]}>
        <View style={styles.drawerHeader}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[(styles.drawerHeaderText || {}), { color: currentTheme.primary }]}>
              KwestUp
            </Text>
            <TouchableOpacity 
              onPress={() => {
                console.log("Closing drawer...")
                if (navigation && typeof navigation.closeDrawer === 'function') {
                  navigation.closeDrawer()
                } else {
                  console.log("Navigation or closeDrawer not available")
                }
              }}
              style={{ padding: 5 }}
            >
              <MaterialCommunityIcons name="close" size={24} color={currentTheme.text} />
            </TouchableOpacity>
          </View>
          {userName && (
            <Text style={[styles.drawerUserName, { color: currentTheme.secondaryText }]}>Welcome, {userName}!</Text>
          )}
        </View>
        <ScrollView style={styles.drawerItemsContainer}>
          {drawerItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.drawerItem,
                currentRouteName === item.route && { backgroundColor: currentTheme.primary + "20" },
              ]}
              onPress={() => {
                console.log("Navigating to:", item.route)
                if (navigation && typeof navigation.navigate === 'function') {
                  navigation.navigate(item.route)
                  if (typeof navigation.closeDrawer === 'function') {
                    navigation.closeDrawer()
                  }
                } else {
                  console.log("Navigation or navigate not available")
                }
              }}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={24}
                color={currentRouteName === item.route ? currentTheme.primary : currentTheme.text}
                style={styles.drawerItemIcon}
              />
              <Text
                style={[
                  styles.drawerItemText,
                  { color: currentRouteName === item.route ? currentTheme.primary : currentTheme.text },
                ]}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.drawerFooter}>
          <TouchableOpacity
            onPress={() => {
              const modes = ["light", "dark", "amoled"]
              const currentIndex = modes.indexOf(themeMode)
              const nextIndex = (currentIndex + 1) % modes.length
              setThemeMode(modes[nextIndex])
            }}
            style={styles.drawerFooterButton}
          >
            <MaterialCommunityIcons
              name={themeMode === "amoled" ? "monitor" : themeMode === "dark" ? "weather-night" : "weather-sunny"}
              size={24}
              color={currentTheme.text}
            />
            <Text style={[styles.drawerFooterText, { color: currentTheme.text }]}>
              {themeMode === "amoled" ? "AMOLED" : themeMode === "dark" ? "Dark Mode" : "Light Mode"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Helper to schedule a push notification
  async function schedulePushNotification({ title, body }) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  }

  // Helper to schedule a repeating daily notification for a daily task
  async function scheduleDailyTaskNotification(task) {
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
    } catch (e) {}
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <SafeAreaProvider>
        <PaperProvider theme={{ colors: currentTheme }}>
          <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
            <NavigationContainer theme={{ colors: { background: currentTheme.background } }}>
              <Drawer.Navigator
                initialRouteName="Dashboard"
                drawerContent={(props) => {
                  console.log("Drawer content called with props:", props)
                  return <CustomDrawerContent {...props} />
                }}
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
                  swipeEdgeWidth: Dimensions.get("window").width * 0.5,
                  overlayColor: "rgba(0, 0, 0, 0.5)",
                  drawerStyle: {
                    backgroundColor: currentTheme.cardBackground,
                    width: Dimensions.get("window").width * 0.75,
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
                    />
                  )}
                </Drawer.Screen>
                <Drawer.Screen name="Daily" options={{ title: "Daily Tasks" }}>
                  {() => <DailyTasksRoute currentTheme={currentTheme} setSelectedTask={setSelectedTask} setModalVisible={setModalVisible} dailyTasks={dailyTasks} setDailyTasks={setDailyTasks} />}
                </Drawer.Screen>
                <Drawer.Screen name="Birthdays" options={{ title: "Birthdays" }}>
                  {() => <BirthdaysRoute currentTheme={currentTheme} setSelectedTask={setSelectedTask} setModalVisible={setModalVisible} />}
                </Drawer.Screen>
                <Drawer.Screen name="Tasks" options={{ title: "Task List" }}>
                  {() => (
                    <TaskListScreen
                      tasks={tasks}
                      setTasks={setTasks}
                      handleCompleteTask={handleCompleteTask}
                      toggleTaskComplete={toggleTaskComplete}
                      deleteTask={deleteTask}
                      handleToggleSubtask={(taskId, subtaskIdx) => {
                        setTasks(prevTasks => prevTasks.map(task => {
                          if (task.id === taskId) {
                            const newSubtasks = task.subtasks.map((st, idx) => idx === subtaskIdx ? { ...st, completed: !st.completed } : st);
                            return { ...task, subtasks: newSubtasks };
                          }
                          return task;
                        }));
                      }}
                      currentTheme={currentTheme}
                      setSelectedTask={setSelectedTask}
                      setModalVisible={setModalVisible}
                    />
                  )}
                </Drawer.Screen>
                <Drawer.Screen name="Focus" options={{ title: "Focus Timer" }}>
                  {() => <FocusTimerRoute currentTheme={currentTheme} />}
                </Drawer.Screen>
                <Drawer.Screen name="Settings" options={{ title: "Settings" }}>
                  {() => <SettingsRoute currentTheme={currentTheme} />}
                </Drawer.Screen>
                <Drawer.Screen name="Search" options={{ title: "Search" }}>
                  {() => <SearchRoute currentTheme={currentTheme} setSelectedTask={setSelectedTask} setModalVisible={setModalVisible} />}
                </Drawer.Screen>
              </Drawer.Navigator>
            </NavigationContainer>
            {/* Modals moved outside NavigationContainer but still within PaperProvider */}
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
            <Modal
              isVisible={showNameDialog}
              onBackdropPress={() => {
                if (userName.trim()) setShowNameDialog(false)
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
                        setShowNameDialog(false)
                      }
                    }}
                    color={currentTheme.primary}
                    style={styles.dialogButton}
                    disabled={!userName.trim()}
                  />
                </View>
              </View>
            </Modal>
            <TaskEditModal
              visible={modalVisible}
              onClose={() => setModalVisible(false)}
              task={selectedTask}
              onSave={handleSaveTask}
              theme={currentTheme}
            />
            <TimerLockoutOverlay
              show={showTimerLockout}
              remainingTime={timerRemaining}
              onExitAttempt={() =>
                showConfirmation(
                  "You are currently in a focus session. Exiting now will disrupt your focus. Are you sure you want to stop?",
                  () => {
                    setIsTimerRunning(false)
                    setShowTimerLockout(false)
                    setTimerRemaining(timerDuration)
                    console.log("Focus session interrupted!")
                  },
                  () => {},
                )
              }
              currentTheme={currentTheme}
              formatTime={formatTime}
            />
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  // Custom Button Styles
  customButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  customButtonDisabled: {
    opacity: 0.7,
  },
  customButtonIcon: {
    marginRight: 8,
  },
  customButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  // Custom TextInput Styles
  customTextInputContainer: {
    marginBottom: 15,
  },
  customTextInputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
  },
  customTextInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1, // This is now controlled inline
    borderRadius: 8,
  },
  customTextInputIcon: {
    position: "absolute",
    left: 12,
  },
  customTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "transparent",
  },
  // Custom Card Styles
  customCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    // Base shadow is removed from here and applied dynamically in TaskCard
  },
  // Custom Badge Styles
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    flexDirection: "row", // To align text and icon if any
    alignItems: "center",
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  // Custom Switch Styles
  customSwitchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  customSwitchLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  customSwitchTrack: {
    width: 45,
    height: 25,
    borderRadius: 15,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  customSwitchThumb: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    position: "absolute",
  },
  // Custom Segmented Buttons Styles
  segmentedButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentedButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabContentScroll: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  textInputFlex: {
    flex: 1,
  },
  textInputTimeButton: {
    width: 100,
  },
  textInputDateButton: {
    width: 120,
  },
  fullWidthButton: {
    marginTop: 8,
  },
  medicalCardWrapper: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardCode: {
    fontSize: 14,
    opacity: 0.9,
    fontWeight: "500",
  },
  cardMenuButton: {
    padding: 5,
  },
  deleteButton: {
    padding: 8,
  },
  cardDetails: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  cardTags: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  taskTag: {
    marginRight: 8,
    marginBottom: 5,
  },
  cardAvatars: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  cardActionsOverlay: {
    // This is for the swipe actions, not visible in Dribbble UI
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  infoTextContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    fontStyle: "italic",
    flexShrink: 1,
    fontWeight: "500",
  },
  timerTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  timerInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  timerInputLabel: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: "600",
  },
  timerDurationInput: {
    width: 80,
    height: 40,
    textAlign: "center",
  },
  timerDisplayContainer: {
    marginBottom: 24,
    padding: 24,
    borderRadius: 16,
    borderWidth: 3,
    alignSelf: "center",
    elevation: 4,
    minWidth: 200,
    alignItems: "center",
  },
  timerDisplayText: {
    fontSize: 48,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlign: "center",
  },
  timerStatusText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 1,
  },
  timerControls: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
  },
  timerButton: {
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    elevation: 3,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingVertical: 4,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  settingInput: {
    flex: 1,
    marginLeft: 12,
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
  actionButton: {
    marginBottom: 8,
  },
  githubButton: {
    marginTop: 10,
    alignSelf: "center",
  },
  nameInput: {
    marginTop: 12,
    alignSelf: 'stretch', // Ensure it takes width in the dialog
  },
  aboutText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
    fontWeight: "500",
  },
  lockoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  lockoutContent: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "85%",
    maxWidth: 350,
    elevation: 10,
  },
  lockoutTitle: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  lockoutMessage: {
    fontSize: 18,
    marginBottom: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  lockoutTimer: {
    fontSize: 80,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 24,
    padding: 24,
    borderRadius: 100,
    borderWidth: 4,
  },
  modalOverlay: {
    justifyContent: "center",
    alignItems: "center",
  },
  dialogContent: {
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  dialogTitle: {
    textAlign: "center",
    fontWeight: "700",
    fontSize: 20,
    marginBottom: 10,
  },
  dialogMessage: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 20,
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  dialogButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  searchInput: {
    marginBottom: 20,
  },
  emptyListText: {
    textAlign: "center",
    paddingVertical: 20,
    fontSize: 16,
    fontWeight: "500",
  },
  insightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  insightValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  chartPlaceholder: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
  },
  // Drawer specific styles
  drawerContent: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 25 : 0, // Adjust for Android status bar
  },
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  drawerHeaderText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  drawerUserName: {
    fontSize: 16,
    marginTop: 5,
  },
  drawerItemsContainer: {
    flex: 1,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  drawerItemIcon: {
    marginRight: 15,
  },
  drawerItemText: {
    fontSize: 18,
    fontWeight: "500",
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
  },
  drawerFooterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  drawerFooterText: {
    fontSize: 16,
    marginLeft: 15,
  },
  // Dribbble Dashboard Styles
  dashboardSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryCard: {
    width: "48%", // Roughly half width for two columns
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  summaryCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  summaryCardCount: {
    fontSize: 32,
    fontWeight: "800",
  },
  summaryCardLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  chartBarsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 150,
    marginBottom: 10,
  },
  chartColumn: {
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "center",
    width: 20, // Width of each bar group
  },
  chartBar: {
    width: 8, // Width of individual bar
    borderRadius: 2,
    marginBottom: 2,
  },
  chartLabel: {
    fontSize: 12,
    marginTop: 5,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
  },
  bottomSummaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  bottomSummaryCard: {
    width: "48%",
    padding: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  bottomSummaryTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
  },
  bottomSummaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  // Dribbble Task List Styles
  taskListFilters: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
    backgroundColor: "#F0F0F0", // Light background for filters
    borderRadius: 10,
    padding: 5,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 100, // Above the bottom sub-nav
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  bottomSubNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 70,
    borderTopWidth: 1,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === "ios" ? 15 : 0, // Adjust for iPhone X notch
  },
  bottomSubNavItem: {
    alignItems: "center",
    padding: 5,
  },
  bottomSubNavItemText: {
    fontSize: 12,
    marginTop: 5,
    fontWeight: "500",
  },
  emptyListText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
    opacity: 0.7,
  },
  taskCard: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    elevation: 3, // Android shadow
    shadowOffset: { width: 0, height: 2 }, // iOS shadow
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  taskCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1, // Allow title to wrap
  },
  taskDueDate: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 16,
  },
  taskCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  taskStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  taskStatText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "500",
  },
  completeButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  completeButtonText: {
    fontWeight: "bold",
    fontSize: 14,
  },
  screen: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  completedDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  completedTitle: {
    marginHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  tabBarItem: {
    flex: 1,
    padding: 10,
    borderBottomWidth: 2,
    // This cannot be here, as currentTheme is not in scope for StyleSheet.create
    // borderBottomColor: currentTheme.primary,
  },
  tabBarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Settings Page Specific Styles
  settingsContainer: {
    flex: 1,
    padding: 16,
  },
  settingsHeader: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  settingsLabel: {
    fontSize: 16,
  },
  settingsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingsActionText: {
    fontSize: 16,
  },
})

export default App

