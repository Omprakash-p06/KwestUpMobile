import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { styles } from "../theme/styles";

export const CustomSegmentedButtons = ({ options, selectedValue, onValueChange, theme }) => {
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
