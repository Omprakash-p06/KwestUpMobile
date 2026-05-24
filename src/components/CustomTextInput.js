import React from "react";
import { View, Text, TextInput } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { styles } from "../theme/styles";

export const CustomTextInput = ({ label, value, onChangeText, style, icon, theme, placeholder, ...props }) => {
  const currentTheme = theme || { text: "#333", secondaryText: "#666", border: "#ccc", cardBackground: "#f9f9f9" };
  return (
    <View style={[styles.customTextInputContainer, style]}>
      {label && <Text style={[styles.customTextInputLabel, { color: currentTheme.text }]}>{label}</Text>}
      <View style={[
        styles.customTextInputWrapper,
        {
          borderColor: currentTheme.secondaryText, // Use a more visible color for the border
          backgroundColor: currentTheme.cardBackground,
        },
      ]}>
        {icon && <MaterialCommunityIcons name={icon} size={20} color={currentTheme.secondaryText} style={styles.customTextInputIcon} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={[
            styles.customTextInput,
            icon && { paddingLeft: 40 },
            { color: currentTheme.text, backgroundColor: 'transparent' },
          ]}
          placeholder={placeholder || "Enter text"}
          placeholderTextColor={currentTheme.secondaryText}
          {...props}
        />
      </View>
    </View>
  );
};
