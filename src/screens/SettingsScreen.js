import React, { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, Linking, ActivityIndicator, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomSegmentedButtons } from "../components/CustomSegmentedButtons";
import { CustomButton } from "../components/CustomButton";
import { QRScannerModal } from "../components/QRScannerModal";
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
  handleResetData,
  handleExecuteSync,
  lastSynced,
  isSyncing
}) => {
  const [tempUserName, setTempUserName] = useState(userName);
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  const handleSaveSettings = () => {
    setUserName(tempUserName);
    showConfirmation("Settings saved successfully!", () => {});
  };

  const handleScannedConnection = async (config) => {
    setIsScannerVisible(false);
    await handleExecuteSync(config);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <ScrollView style={[styles.settingsContainer, { backgroundColor: "transparent" }]}>
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
        
        {/* Data Synchronization Section */}
        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, { color: currentTheme.primary, borderBottomColor: currentTheme.border }]}>Data Synchronization</Text>
          <View style={{ marginTop: 10, marginBottom: 15 }}>
            <Text style={{ color: currentTheme.secondaryText, fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
              Synchronize your notes, tasks, and birthdays locally over Wi-Fi with the KwestUp PC desktop application.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: lastSynced ? "#4CAF50" : "#FF9800" }} />
              <Text style={{ color: currentTheme.text, fontSize: 13, fontWeight: "600" }}>
                {lastSynced ? `Last Synced: ${new Date(lastSynced).toLocaleString()}` : "Not Synchronized"}
              </Text>
            </View>
          </View>
          <CustomButton
            title={isSyncing ? "Synchronizing..." : "Synchronize with PC"}
            icon="sync"
            onPress={() => setIsScannerVisible(true)}
            color={currentTheme.primary}
            disabled={isSyncing}
          />
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

      {/* Syncing Loading Overlay */}
      {isSyncing && (
        <View style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999
        }}>
          <View style={{
            backgroundColor: currentTheme.surface || "#FFFFFF",
            padding: 24,
            borderRadius: 16,
            alignItems: "center",
            width: "80%",
            maxWidth: 300,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}>
            <ActivityIndicator size="large" color={currentTheme.primary} />
            <Text style={{ color: currentTheme.text, fontWeight: "700", marginTop: 16, fontSize: 16 }}>
              Synchronizing Vault...
            </Text>
            <Text style={{ color: currentTheme.secondaryText, fontSize: 13, marginTop: 6, textAlign: "center" }}>
              Exchanging files and database tables over local Wi-Fi.
            </Text>
          </View>
        </View>
      )}

      {/* Camera QR Barcode Scanner Overlay Modal */}
      <QRScannerModal
        isVisible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onConnectionScanned={handleScannedConnection}
        currentTheme={currentTheme}
      />
    </View>
  );
};
