import React from "react";
import { View, Text } from "react-native";
import { CustomButton } from "./CustomButton";
import { styles } from "../theme/styles";

export const TimerLockoutOverlay = ({ show, remainingTime, onExitAttempt, currentTheme, formatTime }) => {
  if (!show) return null;
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
          Keep going, you&apos;re doing great!
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
  );
};
