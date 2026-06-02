import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export const CustomButton = ({ title, onPress, icon, style, textStyle, outline, disabled }) => {
  const isOutlined = !!outline;

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) onPress();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => {
        // Base mechanical button styles
        const buttonStyles = [
          styles.baseButton,
          disabled ? styles.disabledButton : {}
        ];

        if (!disabled) {
          if (!isOutlined) {
            // Primary Active color inversion: White <-> Black
            buttonStyles.push({
              backgroundColor: pressed ? "#000000" : "#FFFFFF",
              borderColor: pressed ? "#FFFFFF" : "#000000",
              borderTopColor: pressed ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
              borderLeftColor: pressed ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
              borderBottomColor: pressed ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.3)",
              borderRightColor: pressed ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.3)",
            });
          } else {
            // Secondary Active color inversion: Black <-> White
            buttonStyles.push({
              backgroundColor: pressed ? "#FFFFFF" : "#000000",
              borderColor: pressed ? "#000000" : "#FFFFFF",
              borderTopColor: pressed ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)",
              borderLeftColor: pressed ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)",
              borderBottomColor: pressed ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)",
              borderRightColor: pressed ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)",
            });
          }
        }

        return [buttonStyles, style];
      }}
    >
      {({ pressed }) => {
        // Resolve dynamic text/icon colors based on pressed state
        let textColor = "#FFFFFF";
        if (disabled) {
          textColor = "#888888";
        } else if (!isOutlined) {
          textColor = pressed ? "#FFFFFF" : "#2F3131";
        } else {
          textColor = pressed ? "#000000" : "#FFFFFF";
        }

        return (
          <>
            {icon && (
              <MaterialCommunityIcons
                name={icon}
                size={20}
                color={textColor}
                style={styles.buttonIcon}
              />
            )}
            <Text style={[styles.buttonText, { color: textColor }, textStyle]}>
              {title || ""}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    borderRadius: 0, // perfect 90-degree square corners
    borderWidth: 2,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    
    // raised outward shadows
    shadowColor: "#000000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 6,
  },
  disabledButton: {
    backgroundColor: "#222222",
    borderColor: "#444444",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "HankenGrotesk-ExtraBold",
    letterSpacing: 0.05,
    textTransform: "uppercase",
  },
  buttonIcon: {
    marginRight: 8,
  },
});
