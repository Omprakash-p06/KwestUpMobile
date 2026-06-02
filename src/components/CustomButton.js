import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export const CustomButton = ({ title, onPress, icon, style, textStyle, outline, disabled, color }) => {
  const isOutlined = !!outline;
  const btnColor = color || (isOutlined ? "#000000" : "#FFFFFF");
  const pressedColor = isOutlined ? "#FFFFFF" : "#000000";

  const isLightColor = (hex) => {
    if (!hex) return false;
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  };

  const contrastText = isLightColor(btnColor) ? "#000000" : "#FFFFFF";
  const contrastPressed = isLightColor(pressedColor) ? "#000000" : "#FFFFFF";

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
        const bg = pressed ? pressedColor : btnColor;
        const bd = pressed ? btnColor : pressedColor;

        return [
          styles.baseButton,
          disabled && styles.disabledButton,
          { backgroundColor: bg, borderColor: bd },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const textColor = disabled ? "#888888" : (pressed ? contrastPressed : contrastText);

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
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: 0.05,
    textTransform: "uppercase",
  },
  buttonIcon: {
    marginRight: 8,
  },
});
