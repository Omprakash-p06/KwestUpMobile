import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated from "react-native-reanimated";
import { styles } from "../theme/styles";

export const CustomSwitch = ({ value, onValueChange, label, color, theme }) => {
  const currentTheme = theme || { text: "#333", primary: "#8E7BEF" }
  const switchColor = color || currentTheme.primary
  return (
    <TouchableOpacity onPress={() => onValueChange(!value)} style={styles.customSwitchContainer}>
      <Text style={[styles.customSwitchLabel, { color: currentTheme.text }]}>{label}</Text>
      <View style={[styles.customSwitchTrack, { backgroundColor: value ? switchColor : "#ccc" }]}>
        <Animated.View style={[styles.customSwitchThumb, { left: value ? 22 : 2 }]} />
      </View>
    </TouchableOpacity>
  );
};
