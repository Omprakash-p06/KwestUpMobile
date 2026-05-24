import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { styles } from "../theme/styles";

export const CustomButton = ({ title, onPress, icon, style, textStyle, color, outline, disabled }) => {
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
