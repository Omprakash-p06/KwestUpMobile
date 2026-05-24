import React from "react";
import { ScrollView, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CustomCard } from "../components/CustomCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomButton } from "../components/CustomButton";
import { styles } from "../theme/styles";

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const FocusTimerScreen = ({
  currentTheme,
  timerDuration,
  timerRemaining,
  isTimerRunning,
  setIsTimerRunning,
  setTimerRemaining,
  setTimerDuration,
  setShowTimerLockout,
  showConfirmation
}) => {
  const startTimer = () => {
    if (!isTimerRunning && timerRemaining > 0) {
      setIsTimerRunning(true);
      setShowTimerLockout(true);
      console.log("⏰ Timer started!");
    }
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
    console.log("⏸️ Timer paused!");
  };

  const resetTimer = () => {
    showConfirmation(
      "Are you sure you want to reset the timer?",
      () => {
        setIsTimerRunning(false);
        setTimerRemaining(timerDuration);
        setShowTimerLockout(false);
        console.log("🔄 Timer reset!");
      },
      () => {},
    );
  };

  const handleDurationChange = (minutes) => {
    const parsedMinutes = Number.parseInt(minutes, 10);
    if (!isNaN(parsedMinutes) && parsedMinutes > 0) {
      const newDuration = parsedMinutes * 60;
      setTimerDuration(newDuration);
      if (!isTimerRunning) {
        setTimerRemaining(newDuration);
      }
      console.log("⏱️ Timer duration changed to:", parsedMinutes, "minutes");
    }
  };

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
  );
};
