import React, { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomSegmentedButtons } from "../components/CustomSegmentedButtons";
import { CustomButton } from "../components/CustomButton";
import { styles } from "../theme/styles";

export const SettingsScreen = ({
  currentTheme,
  userName,
  setUserName,
  themeMode,
  setThemeMode,
  selectedThemeName,
  setSelectedThemeName,
  showConfirmation,
  handleResetData
}) => {
  const [tempUserName, setTempUserName] = useState(userName);

  const handleSaveSettings = () => {
    setUserName(tempUserName);
    showConfirmation("Settings saved successfully!", () => {});
  };

  return (
    <ScrollView style={[styles.settingsContainer, { backgroundColor: currentTheme.background }]}>
      <Text style={[styles.settingsHeader, { color: currentTheme.text }]}>Settings</Text>

      {/* User Profile Section */}
      <View style={styles.settingsSection}>
        <Text style={[styles.settingsSectionTitle, { color: currentTheme.primary, borderBottomColor: currentTheme.border }]}>User Profile</Text>
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: currentTheme.text }]}>Name</Text>
          <CustomTextInput
            value={tempUserName}
            onChangeText={setTempUserName}
            style={{ flex: 0.6 }}
            placeholder="Enter your name"
            placeholderTextColor={currentTheme.secondaryText}
            theme={currentTheme}
          />
        </View>
        <CustomButton
          title="Save Profile"
          icon="content-save"
          onPress={handleSaveSettings}
          color={currentTheme.primary}
          style={{ marginTop: 10 }}
        />
      </View>

      {/* Appearance Section */}
      <View style={styles.settingsSection}>
        <Text style={[styles.settingsSectionTitle, { color: currentTheme.primary, borderBottomColor: currentTheme.border }]}>Appearance</Text>
        <View style={[styles.settingsRow, { flexDirection: 'column', alignItems: 'flex-start' }]}> 
          <Text style={[styles.settingsLabel, { color: currentTheme.text, marginBottom: 12 }]}>Theme Mode</Text>
          <CustomSegmentedButtons
            selectedValue={themeMode}
            onValueChange={setThemeMode}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "amoled", label: "AMOLED" },
            ]}
            theme={currentTheme}
          />
        </View>
        <View style={[styles.settingsRow, { flexDirection: 'column', alignItems: 'flex-start' }]}> 
          <Text style={[styles.settingsLabel, { color: currentTheme.text, marginBottom: 12 }]}>Color Theme</Text>
          <CustomSegmentedButtons
            selectedValue={selectedThemeName}
            onValueChange={setSelectedThemeName}
            options={[
              { value: "dribbble", label: "Dribbble" },
              { value: "clean", label: "Clean" },
              { value: "blue", label: "Blue" },
              { value: "green", label: "Green" },
              { value: "purple", label: "Purple" },
            ]}
            theme={currentTheme}
          />
        </View>
      </View>
      
      {/* Reset Data Section */}
      <View style={styles.settingsSection}>
        <Text style={[styles.settingsSectionTitle, { color: currentTheme.error || "#F44336", borderBottomColor: currentTheme.border }]}>Danger Zone</Text>
        <CustomButton
          title="Reset All Data"
          icon="alert-octagon"
          onPress={handleResetData}
          color={currentTheme.error || "#F44336"}
          style={{ marginTop: 10 }}
        />
      </View>
      
      {/* About Section */}
      <View style={styles.settingsSection}>
        <Text style={[styles.settingsSectionTitle, { color: currentTheme.primary, borderBottomColor: currentTheme.border }]}>About</Text>
        <TouchableOpacity style={styles.settingsAction} onPress={() => Linking.openURL("https://github.com/Omprakash-p06/KwestUpMobile")}> 
          <Text style={[styles.settingsActionText, { color: currentTheme.text }]}>GitHub Repository</Text>
          <MaterialCommunityIcons name="github" size={24} color={currentTheme.text} />
        </TouchableOpacity>
        <View style={styles.settingsAction}> 
          <Text style={[styles.settingsActionText, { color: currentTheme.text }]}>Developed by</Text>
          <Text style={[styles.settingsLabel, { color: currentTheme.secondaryText }]}>Omprakash Panda</Text>
        </View>
      </View>
    </ScrollView>
  );
};
