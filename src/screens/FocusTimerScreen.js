import React, { useEffect, useRef } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { CustomTextInput } from "../components/CustomTextInput";

export const FocusTimerScreen = ({
  currentTheme,
  timerDuration = 25 * 60,
  timerRemaining = 25 * 60,
  isTimerRunning = false,
  setIsTimerRunning,
  setTimerRemaining,
  setTimerDuration,
  setShowTimerLockout,
  showConfirmation
}) => {

  // Looping neon laser sweep inside the Focus Coach card
  const scanAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const scan = Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      })
    );
    scan.start();
    return () => scan.stop();
  }, [scanAnim]);

  const laserY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startTimer = () => {
    if (!isTimerRunning && timerRemaining > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsTimerRunning(true);
    }
  };

  const pauseTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsTimerRunning(false);
  };

  const resetTimer = () => {
    showConfirmation(
      "Confirm reset of objective timer?",
      () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsTimerRunning(false);
        setTimerRemaining(timerDuration);
        setShowTimerLockout(false);
      },
      () => {}
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
    }
  };

  // Animated second hand rotation
  const needleRotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const target = timerDuration > 0 ? ((timerDuration - timerRemaining) / timerDuration) * 360 : 0;
    Animated.timing(needleRotation, {
      toValue: target,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [timerRemaining, timerDuration, needleRotation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* 1. Timer Status Indicators */}
      <View style={styles.statusRow}>
        <View style={[styles.badge, { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }]}>
          <View style={[styles.dot, { backgroundColor: isTimerRunning ? currentTheme.error : currentTheme.success }]} />
          <Text style={[styles.badgeText, { color: currentTheme.onPrimary }]}>
            {isTimerRunning ? "DEEP_WORK_PHASE" : "TIMER_STANDBY"}
          </Text>
        </View>
        <View style={[styles.outlineBadge, { borderColor: currentTheme.border }]}>
          <Text style={[styles.outlineBadgeText, { color: currentTheme.secondaryText }]}>
            INTERVAL STATUS: NOMINAL
          </Text>
        </View>
      </View>

      {/* 2. Mechanical Dial Container */}
      <View style={[styles.dialOuter, { borderColor: currentTheme.border }]}>
        
        {/* Decorative ticks */}
        <View style={[styles.dialTicksCircle, { borderColor: currentTheme.border + "30" }]} />
        
        {/* Dial Numberings */}
        <View style={styles.dialNumbersContainer}>
          <Text style={[styles.dialNumberText, { color: currentTheme.secondaryText }]}>60</Text>
          <View style={styles.dialNumberRowMiddle}>
            <Text style={[styles.dialNumberText, { color: currentTheme.secondaryText }]}>45</Text>
            <Text style={[styles.dialNumberText, { color: currentTheme.secondaryText }]}>15</Text>
          </View>
          <Text style={[styles.dialNumberText, { color: currentTheme.secondaryText }]}>30</Text>
        </View>

        {/* Animated Second Hand */}
        <Animated.View 
          style={[
            styles.dialNeedleWrapper, 
            { transform: [{ rotate: needleRotation.interpolate({
              inputRange: [0, 360],
              outputRange: ['0deg', '360deg']
            })}] }
          ]}
          pointerEvents="none"
        >
          <View style={[styles.dialNeedle, { backgroundColor: currentTheme.primary, shadowColor: currentTheme.primary }]} />
          <View style={[styles.dialNeedleTip, { backgroundColor: currentTheme.primary }]} />
        </Animated.View>

        {/* Central Hub Viewport */}
        <View style={[styles.dialCentralHub, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
          <Text style={[styles.dialTimeText, { color: currentTheme.text }]}>
            {formatTime(timerRemaining)}
          </Text>
          <Text style={[styles.dialLabel, { color: currentTheme.secondaryText }]}>
            SECONDS REMAINING
          </Text>
        </View>

      </View>

      {/* 3. Set Duration Input Panel */}
      <View style={[styles.durationInputRow, { borderColor: currentTheme.border }]}>
        <Text style={[styles.durationLabel, { color: currentTheme.text }]}>SET TIMER DURATION:</Text>
        <CustomTextInput
          keyboardType="numeric"
          value={(timerDuration / 60).toString()}
          onChangeText={handleDurationChange}
          editable={!isTimerRunning}
          style={styles.durationInput}
          placeholderTextColor={currentTheme.secondaryText}
          theme={currentTheme}
        />
        <Text style={[styles.durationLabel, { color: currentTheme.secondaryText }]}>MINS</Text>
      </View>

      {/* 4. Controls Section Grid */}
      <View style={styles.controlsGrid}>
        <TouchableOpacity
          onPress={resetTimer}
          style={[styles.controlBtn, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}
        >
          <MaterialCommunityIcons name="restart" size={20} color={currentTheme.primary} />
          <Text style={[styles.controlBtnText, { color: currentTheme.text }]}>RESET</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={isTimerRunning ? pauseTimer : startTimer}
          disabled={timerRemaining === 0}
          style={[
            styles.controlBtnPrimary, 
            { 
              backgroundColor: currentTheme.primary, 
              borderColor: "#000000"
            }
          ]}
        >
          <MaterialCommunityIcons 
            name={isTimerRunning ? "pause" : "play"} 
            size={20} 
            color={currentTheme.onPrimary} 
          />
          <Text 
            style={[
              styles.controlBtnPrimaryText, 
              { color: currentTheme.onPrimary }
            ]}
          >
            {isTimerRunning ? "PAUSE" : "START"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            handleDurationChange(timerDuration === 25 * 60 ? "5" : "25");
          }}
        >
          <MaterialCommunityIcons name="alt-route" size={20} color={currentTheme.primary} />
          <Text style={[styles.controlBtnText, { color: currentTheme.text }]}>PHASE</Text>
        </TouchableOpacity>
      </View>

      {/* 5. AI Assist Coach Card */}
      <View style={[styles.glassCoachCard, { borderColor: currentTheme.primary + "40" }]}>
        <Animated.View style={[styles.scanLine, { top: laserY, backgroundColor: currentTheme.primary, shadowColor: currentTheme.primary }]} />
        <View style={styles.coachHeader}>
          <View style={styles.coachTitleBlock}>
            <MaterialCommunityIcons name="robot-outline" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.coachTitleText, { color: currentTheme.text }]}>AI_COACH</Text>
          </View>
          <Text style={[styles.coachVersionText, { color: currentTheme.secondaryText }]}>v1.0.44_ACTIVE</Text>
        </View>

        <Text style={[styles.coachQuoteText, { color: currentTheme.text }]}>
          {"\"Focus metrics indicate high system alignment. Flow optimization active. All peripheral interrupts and alert pathways are temporarily isolated.\""}
        </Text>
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    alignItems: "center",
    gap: 20,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  badge: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    fontFamily: "JetBrainsMono-Bold",
  },
  outlineBadge: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  outlineBadgeText: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Bold",
  },
  dialOuter: {
    width: 280,
    height: 280,
    borderRadius: 140, // circular dial boundaries
    borderWidth: 4,
    backgroundColor: "rgba(0,0,0,0.02)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  dialTicksCircle: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  dialNumbersContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    padding: 12,
    justifyContent: "space-between",
    alignItems: "center",
  },
  dialNumberRowMiddle: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  dialNumberText: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "800",
  },
  dialNeedleWrapper: {
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  dialNeedle: {
    width: 2,
    height: 80,
    marginTop: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
  dialNeedleTip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 82,
  },
  dialCentralHub: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  dialTimeText: {
    fontSize: 48,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
  },
  dialLabel: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  durationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
    width: "100%",
    maxWidth: 320,
  },
  durationLabel: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "800",
  },
  durationInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    padding: 0,
    textAlign: "center",
    height: "100%",
  },
  controlsGrid: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    maxWidth: 340,
  },
  controlBtn: {
    flex: 1,
    height: 54,
    borderWidth: 2,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  controlBtnText: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  controlBtnPrimary: {
    flex: 1.5,
    height: 54,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 4,
  },
  controlBtnPrimaryText: {
    fontSize: 12,
    fontWeight: "950",
    fontFamily: "JetBrainsMono-Bold",
  },
  glassCoachCard: {
    borderWidth: 2,
    padding: 16,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    width: "100%",
    maxWidth: 340,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.25,
  },
  coachHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  coachTitleBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  coachTitleText: {
    fontSize: 12,
    fontWeight: "950",
    fontFamily: "JetBrainsMono-Bold",
  },
  coachVersionText: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Regular",
  },
  coachQuoteText: {
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
    fontFamily: "JetBrainsMono-Regular",
  },
});
