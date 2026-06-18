import React, { useState, useEffect } from "react";
import { ScrollView, View, Text, TouchableOpacity, Linking, ActivityIndicator, StyleSheet, Modal, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomSegmentedButtons } from "../components/CustomSegmentedButtons";
import { CustomButton } from "../components/CustomButton";
import { QRScannerModal } from "../components/QRScannerModal";
import { isModelDownloaded, unloadModel, downloadModel } from "../utils/aiService";
import { APP_VERSION } from "../utils/storage";
import { checkForUpdates } from "../utils/diagnostics";
import { exportArchive, importArchive } from "../utils/exportService";

const MODEL_PATH = `${FileSystem.documentDirectory}models/qwen2.5-0.5b-instruct-q4_k_m.gguf`;

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
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await checkForUpdates();
      if (result && result.hasUpdate) {
        showConfirmation(
          `A new update is available: ${result.latestVersion}\n\nWould you like to visit the release page to download it?`,
          () => {
            if (result.releaseUrl) {
              Linking.openURL(result.releaseUrl).catch((err) =>
                console.error("Failed to open update URL:", err)
              );
            }
          },
          () => {}
        );
      } else {
        showConfirmation("Your application is fully updated to the latest release version.", () => {});
      }
    } catch (err) {
      showConfirmation("Failed to check for updates: " + err.message, () => {});
    } finally {
      setCheckingUpdate(false);
    }
  };
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [modelDownloaded, setModelDownloaded] = useState(false);
  const [modelSize, setModelSize] = useState(null);
  const [checkingModel, setCheckingModel] = useState(false);
  const [deletingModel, setDeletingModel] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [downloadError, setDownloadError] = useState(null);

  // ── DATA ARCHIVE state ────────────────────────────────────────────────────
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [archiveModalMode, setArchiveModalMode] = useState("export"); // "export" | "import"
  const [processingMode, setProcessingMode] = useState("export");
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [archiveProgress, setArchiveProgress] = useState(0);
  const [archiveProcessing, setArchiveProcessing] = useState(false);
  const [archiveError, setArchiveError] = useState(null);
  const [passphraseError, setPassphraseError] = useState(null);
  const [selectedArchiveFile, setSelectedArchiveFile] = useState(null);

  const handleDownloadModel = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await downloadModel(({ progress, bytesReceived, totalBytes: total }) => {
        setDownloadProgress(progress);
        setDownloadedBytes(bytesReceived);
        setTotalBytes(total);
      });
      setModelDownloaded(true);
      try {
        const info = await FileSystem.getInfoAsync(MODEL_PATH);
        if (info.exists) setModelSize(info.size);
      } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showConfirmation("AI model downloaded successfully! Offline AI features are now enabled.", () => {});
    } catch (err) {
      setDownloadError(err.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDownloading(false);
    }
  };

  const checkModel = async () => {
    setCheckingModel(true);
    const dl = await isModelDownloaded();
    setModelDownloaded(dl);
    if (dl) {
      try {
        const info = await FileSystem.getInfoAsync(MODEL_PATH);
        if (info.exists) setModelSize(info.size);
      } catch {}
    } else {
      setModelSize(null);
    }
    setCheckingModel(false);
  };

  useEffect(() => {
    checkModel();
  }, []);

  const handleDeleteModel = () => {
    showConfirmation(
      "Delete the downloaded AI model? This will free up storage space, but you'll need to download it again to use AI features.",
      async () => {
        setDeletingModel(true);
        try {
          await unloadModel();
          await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
          setModelDownloaded(false);
          setModelSize(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showConfirmation("AI model deleted successfully.", () => {});
        } catch (err) {
          showConfirmation("Failed to delete model: " + err.message, () => {});
        }
        setDeletingModel(false);
      },
      () => {}
    );
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

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

  // ── DATA ARCHIVE handlers ─────────────────────────────────────────────────
  const handleExportPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExportPassphrase("");
    setConfirmPassphrase("");
    setPassphraseError(null);
    setArchiveModalMode("export");
    setArchiveModalVisible(true);
  };

  const handleImportPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setSelectedArchiveFile(result.assets[0]);
        setImportPassphrase("");
        setPassphraseError(null);
        setArchiveModalMode("import");
        setArchiveModalVisible(true);
      }
    } catch (err) {
      setArchiveError("Failed to open file picker. Please try again.");
    }
  };

  const handleExportConfirm = async () => {
    if (!exportPassphrase) {
      setPassphraseError("PASSPHRASE CANNOT BE EMPTY");
      return;
    }
    if (exportPassphrase !== confirmPassphrase) {
      setPassphraseError("PASSPHRASES DO NOT MATCH");
      return;
    }
    setArchiveModalVisible(false);
    setProcessingMode("export");
    setArchiveProcessing(true);
    setArchiveProgress(0);
    setArchiveError(null);
    try {
      await exportArchive(exportPassphrase, (progress) => {
        setArchiveProgress(progress);
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setArchiveError(err.message || "ARCHIVE ERROR: Failed to export.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setArchiveProcessing(false);
      setArchiveProgress(0);
    }
  };

  const handleImportConfirm = async () => {
    if (!importPassphrase) {
      setPassphraseError("PASSPHRASE CANNOT BE EMPTY");
      return;
    }
    if (!selectedArchiveFile) {
      setPassphraseError("NO ARCHIVE FILE SELECTED");
      return;
    }
    setArchiveModalVisible(false);
    setProcessingMode("import");
    setArchiveProcessing(true);
    setArchiveProgress(0);
    setArchiveError(null);
    try {
      await importArchive(
        selectedArchiveFile.uri,
        importPassphrase,
        (progress) => setArchiveProgress(progress)
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "RESTORE COMPLETE",
        "Archive restored successfully. Please restart the app to reload your data.",
        [{ text: "OK" }]
      );
    } catch (err) {
      const msg = err.message || "ARCHIVE ERROR";
      if (msg.includes("INVALID PASSPHRASE") || msg.includes("CORRUPTED ARCHIVE")) {
        setPassphraseError(msg);
        setArchiveModalVisible(true);
      } else {
        setArchiveError(msg);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setArchiveProcessing(false);
      setArchiveProgress(0);
      setSelectedArchiveFile(null);
    }
  };

  const handleModalCancel = () => {
    setArchiveModalVisible(false);
    setPassphraseError(null);
    setExportPassphrase("");
    setConfirmPassphrase("");
    setImportPassphrase("");
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollPadding}>
        
        {/* Page Header */}
        <View style={styles.headerSection}>
          <View style={[styles.badge, { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }]}>
            <Text style={[styles.badgeText, { color: currentTheme.onPrimary }]}>
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
            <MaterialCommunityIcons name="content-save-outline" size={16} color={currentTheme.onPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.saveBtnText, { color: currentTheme.onPrimary }]}>
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

        {/* 4. AI Model Section */}
        <LiquidGlassCard theme={currentTheme} style={styles.configCard}>
          <View style={styles.chassisHeader}>
            <Text style={[styles.chassisTitle, { color: currentTheme.text }]}>AI_MODULE.sys</Text>
          </View>

          <View style={[styles.consoleLog, { backgroundColor: "rgba(0,0,0,0.1)", borderColor: currentTheme.border + "20" }]}>
            <View style={styles.statusIndicatorRow}>
              {checkingModel ? (
                <ActivityIndicator size="small" color={currentTheme.primary} style={{ marginRight: 6 }} />
              ) : (
                <View style={[styles.indicatorDot, { backgroundColor: modelDownloaded ? "#4CAF50" : "#FF9800" }]} />
              )}
              <Text style={[styles.consoleLogText, { color: currentTheme.text, fontWeight: "900" }]}>
                {checkingModel ? "SCANNING..." : modelDownloaded ? "MODEL: DOWNLOADED" : isDownloading ? "MODEL: DOWNLOADING..." : "MODEL: NOT FOUND"}
              </Text>
            </View>
            {modelDownloaded && modelSize && (
              <Text style={[styles.consoleLogText, { color: currentTheme.secondaryText, marginTop: 4 }]}>
                SIZE: {formatBytes(modelSize)} — qwen2.5-0.5b-instruct-q4_k_m.gguf
              </Text>
            )}
            {!modelDownloaded && !checkingModel && !isDownloading && (
              <Text style={[styles.consoleLogText, { color: currentTheme.secondaryText, marginTop: 4 }]}>
                Offline AI model (~460 MB) runs 100% locally on your device, keeping all data fully private.
              </Text>
            )}
            {isDownloading && (
              <View style={{ marginTop: 8 }}>
                <View style={[styles.progressBarTrack, { backgroundColor: currentTheme.border }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { backgroundColor: currentTheme.primary, width: `${Math.round(downloadProgress * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.consoleLogText, { color: currentTheme.text }]}>
                  Downloading: {Math.round(downloadProgress * 100)}% — {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
                </Text>
              </View>
            )}
            {downloadError && (
              <Text style={[styles.consoleLogText, { color: currentTheme.error, marginTop: 4, fontWeight: "bold" }]}>
                ERROR: {downloadError}
              </Text>
            )}
          </View>

          {modelDownloaded && (
            <TouchableOpacity
              style={[styles.destroyBtn, { backgroundColor: currentTheme.error + "20", borderColor: currentTheme.error }]}
              onPress={handleDeleteModel}
              disabled={deletingModel}
            >
              {deletingModel ? (
                <ActivityIndicator size="small" color={currentTheme.error} style={{ marginRight: 6 }} />
              ) : (
                <MaterialCommunityIcons name="delete-outline" size={18} color={currentTheme.error} style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.destroyBtnText, { color: currentTheme.error }]}>
                {deletingModel ? "DELETING..." : "DELETE AI MODEL"}
              </Text>
            </TouchableOpacity>
          )}

          {!modelDownloaded && !checkingModel && (
            <TouchableOpacity
              style={[styles.syncBtn, { borderColor: currentTheme.primary }]}
              onPress={handleDownloadModel}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={currentTheme.primary} style={{ marginRight: 6 }} />
              ) : (
                <MaterialCommunityIcons name="download-outline" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.syncBtnText, { color: currentTheme.primary }]}>
                {isDownloading ? "DOWNLOADING AI MODEL..." : "DOWNLOAD OFFLINE AI MODEL"}
              </Text>
            </TouchableOpacity>
          )}
        </LiquidGlassCard>

        {/* DATA ARCHIVE Card */}
        <LiquidGlassCard theme={currentTheme} style={styles.configCard}>
          <View style={styles.chassisHeader}>
            <Text style={[styles.chassisTitle, { color: currentTheme.text }]}>DATA ARCHIVE.sys</Text>
          </View>

          <Text style={[styles.sysDescText, { color: currentTheme.secondaryText }]}>
            Packs all vaults, notes, tasks, birthdays, and preferences into a single AES-256 encrypted .kwestup backup file.
          </Text>

          {archiveError && (
            <View style={[styles.archiveErrorBanner, { borderColor: currentTheme.error, backgroundColor: currentTheme.error + "22" }]}>
              <Text style={[styles.archiveErrorText, { color: currentTheme.error }]}>
                {archiveError}
              </Text>
              <TouchableOpacity onPress={() => setArchiveError(null)}>
                <MaterialCommunityIcons name="close" size={16} color={currentTheme.error} />
              </TouchableOpacity>
            </View>
          )}

          {archiveProcessing ? (
            <View style={styles.archiveProgressContainer}>
              <View style={[styles.progressBarTrack, { backgroundColor: currentTheme.border }]}>
                <View style={[styles.progressBarFill, { backgroundColor: currentTheme.primary, width: `${Math.round(archiveProgress * 100)}%` }]} />
              </View>
              <Text style={[styles.archiveProgressLabel, { color: currentTheme.secondaryText }]}>
                {processingMode === "export"
                  ? (archiveProgress < 0.5 ? "COLLECTING DATA..." : archiveProgress < 0.8 ? "ENCRYPTING..." : "SHARING...")
                  : (archiveProgress < 0.3 ? "READING ARCHIVE..." : archiveProgress < 0.6 ? "DECRYPTING..." : "RESTORING DATA...")}
                {"  "}{Math.round(archiveProgress * 100)}%
              </Text>
            </View>
          ) : (
            <View style={styles.archiveButtonRow}>
              <CustomButton
                title="EXPORT ENCRYPTED"
                onPress={handleExportPress}
                style={styles.archiveButton}
              />
              <CustomButton
                title="RESTORE BACKUP"
                onPress={handleImportPress}
                variant="outline"
                style={styles.archiveButton}
              />
            </View>
          )}
        </LiquidGlassCard>

        {/* 5. Reset Data Section */}
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
            onPress={() => Linking.openURL("https://github.com/Omprakash-p06/KwestUp")}
          > 
            <Text style={[styles.aboutLabelText, { color: currentTheme.text }]}>REPOSITORY RESOURCE</Text>
            <MaterialCommunityIcons name="github" size={20} color={currentTheme.text} />
          </TouchableOpacity>

          <View style={[styles.aboutItemRow, { borderColor: currentTheme.border + "12" }]}> 
            <Text style={[styles.aboutLabelText, { color: currentTheme.text }]}>DEVELOPMENT AGENT</Text>
            <Text style={[styles.aboutValText, { color: currentTheme.secondaryText }]}>OMPRAKASH PANDA</Text>
          </View>

          <View style={[styles.aboutItemRow, { borderColor: currentTheme.border + "12" }]}> 
            <Text style={[styles.aboutLabelText, { color: currentTheme.text }]}>APP VERSION</Text>
            <Text style={[styles.aboutValText, { color: currentTheme.primary }]}>{APP_VERSION}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.aboutItemRow, { borderColor: currentTheme.border + "12" }]}
            onPress={handleCheckForUpdates}
            disabled={checkingUpdate}
          > 
            <Text style={[styles.aboutLabelText, { color: currentTheme.text }]}>CHECK FOR UPDATES</Text>
            {checkingUpdate ? (
              <ActivityIndicator size="small" color={currentTheme.primary} />
            ) : (
              <MaterialCommunityIcons name="update" size={20} color={currentTheme.primary} />
            )}
          </TouchableOpacity>
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

      {/* DATA ARCHIVE Passphrase Modal */}
      <Modal
        visible={archiveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleModalCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.archiveModalContent, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
            <Text style={[styles.archiveModalTitle, { color: currentTheme.text }]}>
              {archiveModalMode === "export" ? "EXPORT ENCRYPTED" : "RESTORE BACKUP"}
            </Text>
            <View style={[styles.chassisHeader, { borderBottomColor: currentTheme.border, marginBottom: 16 }]} />

            {archiveModalMode === "import" && (
              <View style={[styles.archiveWarningBox, { borderColor: currentTheme.error, backgroundColor: currentTheme.error + "18" }]}>
                <MaterialCommunityIcons name="alert" size={14} color={currentTheme.error} style={{ marginTop: 2 }} />
                <Text style={[styles.archiveWarningText, { color: currentTheme.error }]}>
                  WARNING: This will overwrite all existing data. This action cannot be undone.
                </Text>
              </View>
            )}

            {archiveModalMode === "export" ? (
              <>
                <Text style={[styles.archiveFieldLabel, { color: currentTheme.text }]}>ENTER PASSPHRASE</Text>
                <CustomTextInput
                  value={exportPassphrase}
                  onChangeText={setExportPassphrase}
                  secureTextEntry
                  placeholder="••••••••"
                />
                <Text style={[styles.archiveFieldLabel, { color: currentTheme.text, marginTop: 12 }]}>CONFIRM PASSPHRASE</Text>
                <CustomTextInput
                  value={confirmPassphrase}
                  onChangeText={(t) => { setConfirmPassphrase(t); setPassphraseError(null); }}
                  secureTextEntry
                  placeholder="••••••••"
                />
              </>
            ) : (
              <>
                <Text style={[styles.archiveFieldLabel, { color: currentTheme.text }]}>ENTER PASSPHRASE</Text>
                <CustomTextInput
                  value={importPassphrase}
                  onChangeText={(t) => { setImportPassphrase(t); setPassphraseError(null); }}
                  secureTextEntry
                  placeholder="••••••••"
                />
              </>
            )}

            {passphraseError && (
              <Text style={[styles.archiveFieldError, { color: currentTheme.error }]}>{passphraseError}</Text>
            )}

            <View style={styles.archiveModalActions}>
              <CustomButton
                title="CANCEL"
                onPress={handleModalCancel}
                variant="outline"
                style={styles.archiveModalBtn}
              />
              <CustomButton
                title={archiveModalMode === "export" ? "CONFIRM" : "CONTINUE"}
                onPress={archiveModalMode === "export" ? handleExportConfirm : handleImportConfirm}
                style={styles.archiveModalBtn}
                disabled={archiveModalMode === "export" ? exportPassphrase.length === 0 : importPassphrase.length === 0}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    fontFamily: "JetBrainsMono-Bold",
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
    fontFamily: "JetBrainsMono-Bold",
  },
  visualRow: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  sysDescText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "JetBrainsMono-Regular",
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
    fontFamily: "JetBrainsMono-Bold",
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
    fontFamily: "JetBrainsMono-Bold",
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
    fontFamily: "JetBrainsMono-Regular",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 0,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 0,
  },
  // ── DATA ARCHIVE styles ───────────────────────────────────────────────────
  archiveButtonRow: {
    gap: 8,
    marginTop: 4,
  },
  archiveButton: {
    marginTop: 4,
  },
  archiveProgressContainer: {
    marginTop: 12,
  },
  archiveProgressLabel: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: 0.5,
    marginTop: 6,
    textTransform: "uppercase",
  },
  archiveErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    gap: 8,
  },
  archiveErrorText: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Regular",
    flex: 1,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  archiveModalContent: {
    borderRadius: 8,
    borderWidth: 2,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  archiveModalTitle: {
    fontSize: 14,
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  archiveWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  archiveWarningText: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Regular",
    flex: 1,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  archiveFieldLabel: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  archiveFieldError: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 6,
  },
  archiveModalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  archiveModalBtn: {
    flex: 1,
  },
});
