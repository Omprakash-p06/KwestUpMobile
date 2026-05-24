import React from "react";
import { View } from "react-native";
import { styles } from "../theme/styles";

export const CustomCard = ({ children, style, theme }) => {
  const currentTheme = theme || { cardBackground: "#FFFFFF" }
  return <View style={[styles.customCard, { backgroundColor: currentTheme.cardBackground }, style]}>{children}</View>
};
