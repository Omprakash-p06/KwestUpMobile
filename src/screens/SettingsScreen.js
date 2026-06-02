import React, { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, Linking, ActivityIndicator, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomSegmentedButtons } from "../components/CustomSegmentedButtons";
import { CustomButton } from "../components/CustomButton";
import { QRScannerModal } from "../components/QRScannerModal";

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setUserName(tempUserName);
    showConfirmation("System configuration saved successfully!", () => {});
  };

  const handleScannedConnection = async (config) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsScannerVisible(false);
    await handleExecuteSync(config);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollPadding}>
        
        {/* Page Header */}
        <View style={styles.headerSection}>
          <View style={[styles.badge, { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }]}>
            <Text style={[styles.badgeText, { color: currentTheme.background === "#E4E2E1" ? "#FFFFFF" : "#000000" }]}>
              SYSTEM_CONFIG_V1.4
            </Text>
          </View>
          <Text style={[styles.title, { color: currentTheme.text }]}>SETTINGS CENTER</Text>
        </View>

        {/* 1. User Profile Section */}
        <LiquidGlassCard theme={currentTheme} style={styles.configCard}>
          <View style={styles.chassisHeader}>
            <Text style={[styles.chassisTitle, { color: currentTheme.text }]}>PROFILE_CONTROLLER.cfg</Text>
          </View>
          
          <View style={styles.settingsRow}>
            <Text style={[styles.settingsLabel, { color: currentTheme.text }]}>USER NAME:</Text>
            <CustomTextInput
              value={tempUserName}
              onChangeText={setTempUserName}
              style={styles.textInputFlex}
              placeholder="ENTER NAME..."
              placeholderTextColor={currentTheme.secondaryText}
              theme={currentTheme}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: currentTheme.primary }]}
            onPress={handleSaveSettings}
          >
            <MaterialCommunityIcons name="content-save-outline" size={16} color={currentTheme.background === "#E4E2E1" ? "#FFFFFF" : "#000000"} style={{ marginRight: 6 }} />
            <Text style={[styles.saveBtnText, { color: currentTheme.background === "#E4E2E1" ? "#FFFFFF" : "#000000" }]}>
              SAVE PROFILE PARAMETERS
            </Text>
          </TouchableOpacity>
        </LiquidGlassCard>

        {/* 2. Appearance Section */}
        <LiquidGlassCard theme={currentTheme} style={styles.configCard}>
          <View style={styles.chassisHeader}>
            <Text style={[styles.chassisTitle, { color: currentTheme.text }]}>VISUAL_INTERFACE.cfg</Text>
          </View>

          <View style={styles.visualRow}>
            <Text style={[styles.settingsLabel, { color: currentTheme.text, marginBottom: 8 }]}>THEME MODE SELECTOR:</Text>
            <CustomSegmentedButtons
              selectedValue={themeMode}
              onValueChange={setThemeMode}
              options={[
                { value: "light", label: "LIGHT" },
                { value: "dark", label: "DARK" },
                { value: "amoled", label: "AMOLED" },
              ]}
              theme={currentTheme}
            />
          </View>

          <View style={[styles.visualRow, { marginTop: 12 }]}>
            <Text style={[styles.settingsLabel, { color: currentTheme.text, marginBottom: 8 }]}>ACCENT SHADER SELECTION:</Text>
            <CustomSegmentedButtons
              selectedValue={selectedThemeName}
              onValueChange={setSelectedThemeName}
              options={[
                { value: "dribbble", label: "DRIBBBLE" },
                { value: "clean", label: "CLEAN" },
                { value: "blue", label: "BLUE" },
                { value: "green", label: "GREEN" },
                { value: "purple", label: "PURPLE" },
              ]}
              theme={currentTheme}
            />
          </View>
        </LiquidGlassCard>

        {/* 3. Data Synchronization Section */}
        <LiquidGlassCard theme={currentTheme} style={styles.configCard}>
          <View style={styles.chassisHeader}>
            <Text style={[styles.chassisTitle, { color: currentTheme.text }]}>WI-FI_TRANSCEIVER.sys</Text>
          </View>
          
          <Text style={[styles.sysDescText, { color: currentTheme.secondaryText }]}>
            Exchanges dynamic markdown files, vaults, and database transaction tables over local Wi-Fi with KwestUp PC desktop console.
          </Text>

          <View style={[styles.consoleLog, { backgroundColor: "rgba(0,0,0,0.1)", borderColor: currentTheme.border + "20" }]}>
            <View style={styles.statusIndicatorRow}>
              <View style={[styles.indicatorDot, { backgroundColor: lastSynced ? "#4CAF50" : "#FF9800" }]} />
              <Text style={[styles.consoleLogText, { color: currentTheme.text, fontWeight: "900" }]}>
                {lastSynced ? `LAST_SYNC: ${new Date(lastSynced).toLocaleString().toUpperCase()}` : "STATUS: UNCOUPLED"}
              </Text>
            </View>
            <Text style={[styles.consoleLogText, { color: currentTheme.secondaryText, marginTop: 4 }]}>
              TRANSMITTER: nominal_ready
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.syncBtn, { borderColor: currentTheme.primary }]}
            onPress={() => setIsScannerVisible(true)}
            disabled={isSyncing}
          >
            <MaterialCommunityIcons name="sync" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.syncBtnText, { color: currentTheme.primary }]}>
              {isSyncing ? "SYNCHRONIZING..." : "CONNECT WITH PC TRANSCEIVER"}
            </Text>
          </TouchableOpacity>
        </LiquidGlassCard>

        {/* 4. Reset Data Section */}
        <LiquidGlassCard theme={currentTheme} style={[styles.configCard, { borderColor: currentTheme.error }]}>
          <View style={[styles.chassisHeader, { borderBottomColor: currentTheme.error }]}>
            <Text style={[styles.chassisTitle, { color: currentTheme.error }]}>DANGER_DESTRUCT.sys</Text>
          </View>
          
          <Text style={[styles.sysDescText, { color: currentTheme.secondaryText, marginBottom: 12 }]}>
            Wipes all cached databases, local notes, vaults, and configuration logs immediately. Action cannot be undone.
          </Text>

          <TouchableOpacity
            style={[styles.destroyBtn, { backgroundColor: currentTheme.error + "20", borderColor: currentTheme.error }]}
            onPress={handleResetData}
          >
            <MaterialCommunityIcons name="alert-octagon" size={18} color={currentTheme.error} style={{ marginRight: 6 }} />
            <Text style={[styles.destroyBtnText, { color: currentTheme.error }]}>
              PURGE ALL DATABASE REGISTRIES
            </Text>
          </TouchableOpacity>
        </LiquidGlassCard>

        {/* 5. About Section */}
        <LiquidGlassCard theme={currentTheme} style={styles.configCard}>
          <View style={styles.chassisHeader}>
            <Text style={[styles.chassisTitle, { color: currentTheme.text }]}>SYSTEM_METRICS.log</Text>
          </View>

          <TouchableOpacity 
            style={[styles.aboutItemRow, { borderColor: currentTheme.border + "12" }]}
            onPress={() => Linking.openURL("https://github.com/Omprakash-p06/KwestUpMobile")}
          > 
            <Text style={[styles.aboutLabelText, { color: currentTheme.text }]}>REPOSITORY RESOURCE</Text>
            <MaterialCommunityIcons name="github" size={20} color={currentTheme.text} />
          </TouchableOpacity>

          <View style={[styles.aboutItemRow, { borderColor: currentTheme.border + "12" }]}> 
            <Text style={[styles.aboutLabelText, { color: currentTheme.text }]}>DEVELOPMENT AGENT</Text>
            <Text style={[styles.aboutValText, { color: currentTheme.secondaryText }]}>OMPRAKASH PANDA</Text>
          </View>
        </LiquidGlassCard>

      </ScrollView>

      {/* Syncing Loading Overlay */}
      {isSyncing && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
            <ActivityIndicator size="large" color={currentTheme.primary} />
            <Text style={[styles.loadingTitleText, { color: currentTheme.text }]}>
              SYNCHRONIZING VAULT...
            </Text>
            <Text style={[styles.loadingDescText, { color: currentTheme.secondaryText }]}>
              Exchanging files and database tables over local Wi-Fi transceiver channels.
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentScroll: {
    flex: 1,
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 60,
    gap: 16,
  },
  headerSection: {
    marginBottom: 8,
  },
  badge: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    fontFamily: "JetBrainsMono-Bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "HankenGrotesk-ExtraBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  configCard: {
    padding: 16,
    borderWidth: 2,
  },
  chassisHeader: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    paddingBottom: 6,
    marginBottom: 16,
  },
  chassisTitle: {
    fontSize: 13,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  settingsLabel: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  textInputFlex: {
    flex: 1,
    borderRadius: 0,
  },
  saveBtn: {
    borderWidth: 3,
    borderColor: "#000000",
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: "900",
    fontFamily: "HankenGrotesk-ExtraBold",
  },
  visualRow: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  sysDescText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "HankenGrotesk-Regular",
    marginBottom: 12,
  },
  consoleLog: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  statusIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  indicatorDot: {
    width: 6,
    height: 6,
  },
  consoleLogText: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Bold",
  },
  syncBtn: {
    borderWidth: 2,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: "900",
    fontFamily: "HankenGrotesk-ExtraBold",
  },
  destroyBtn: {
    borderWidth: 2,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  destroyBtnText: {
    fontSize: 12,
    fontWeight: "950",
    fontFamily: "HankenGrotesk-ExtraBold",
  },
  aboutItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  aboutLabelText: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  aboutValText: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Regular",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loadingCard: {
    borderWidth: 2.5,
    padding: 24,
    borderRadius: 0,
    alignItems: "center",
    width: "80%",
    maxWidth: 300,
  },
  loadingTitleText: {
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    marginTop: 16,
    textAlign: "center",
  },
  loadingDescText: {
    fontSize: 12,
    fontFamily: "HankenGrotesk-Regular",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
});
