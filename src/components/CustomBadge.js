import React from "react";
import { View, Text } from "react-native";
import { styles } from "../theme/styles";

export const CustomBadge = ({ text, style, textColor, backgroundColor }) => {
  return (
    <View style={[styles.customBadge, { backgroundColor: backgroundColor || "#ccc" }, style]}>
      <Text style={[styles.customBadgeText, { color: textColor || "#000" }]}>{text}</Text>
    </View>
  );
};
