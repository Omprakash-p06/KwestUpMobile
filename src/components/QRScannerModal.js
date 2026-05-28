import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from "react-native";
import Modal from "react-native-modal";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export const QRScannerModal = ({ isVisible, onClose, onConnectionScanned, currentTheme }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isManual, setIsManual] = useState(false);

  // Manual fields state
  const [manualIp, setManualIp] = useState("");
  const [manualPort, setManualPort] = useState("5001");
  const [manualToken, setManualToken] = useState("");
  const [formError, setFormError] = useState("");

  // Reset scanned state when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      setScanned(false);
      setIsManual(false);
      setFormError("");
    }
  }, [isVisible]);

  const handleBarcodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    
    try {
      const payload = JSON.parse(data);
      if (payload.ip && payload.port && payload.token) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConnectionScanned(payload);
      } else {
        throw new Error("Invalid payload schema");
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      alert("Invalid KwestUp QR Code payload detected. Please scan the QR Code served by the PC server.");
      // Resume scanning after 3 seconds
      setTimeout(() => setScanned(false), 3000);
    }
  };

  const handleManualSubmit = () => {
    setFormError("");
    
    const sanitizedIp = manualIp.trim();
    const sanitizedPort = manualPort.trim();
    const sanitizedToken = manualToken.trim();

    if (!sanitizedIp) {
      setFormError("PC IP Address is required.");
      return;
    }
    if (!sanitizedPort) {
      setFormError("Server Port is required.");
      return;
    }
    if (!sanitizedToken) {
      setFormError("Security Token is required.");
      return;
    }

    // IP validation regex (simple check)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(sanitizedIp) && sanitizedIp !== "localhost" && sanitizedIp !== "127.0.0.1") {
      setFormError("Please enter a valid IP address (e.g. 192.168.1.15).");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConnectionScanned({
      ip: sanitizedIp,
      port: parseInt(sanitizedPort, 10),
      token: sanitizedToken
    });
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackButtonPress={onClose}
      onBackdropPress={onClose}
      style={{ margin: 0 }}
      avoidKeyboard
      useNativeDriver
      propagateSwipe
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
      >
        <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
          
          {/* Header Panel */}
          <View style={[styles.header, { borderBottomColor: currentTheme.border }]}>
            <Text style={[styles.headerTitle, { color: currentTheme.text }]}>
              {isManual ? "Manual PC Sync Setup" : "Scan Sync QR Code"}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIconButton}>
              <MaterialCommunityIcons name="close" size={24} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <View style={styles.body}>
            {!isManual ? (
              // Camera QR Viewport
              <View style={styles.cameraContainer}>
                {!permission ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="large" color={currentTheme.primary} />
                    <Text style={{ color: currentTheme.secondaryText, marginTop: 12 }}>
                      Loading camera...
                    </Text>
                  </View>
                ) : !permission.granted ? (
                  <View style={styles.permissionContainer}>
                    <MaterialCommunityIcons name="camera-off" size={60} color={currentTheme.secondaryText} style={{ marginBottom: 16 }} />
                    <Text style={[styles.infoText, { color: currentTheme.text }]}>
                      Camera access is needed to scan the sync QR code displayed on KwestUp PC.
                    </Text>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: currentTheme.primary }]}
                      onPress={requestPermission}
                    >
                      <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>Grant Camera Permission</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={StyleSheet.absoluteFillObject}>
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      facing="back"
                      onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    />
                    
                    {/* Dark mask overlay targeting scanned frame */}
                    <View style={styles.overlay}>
                      <View style={styles.topMask} />
                      <View style={styles.middleRow}>
                        <View style={styles.sideMask} />
                        <View style={[styles.scannerBox, { borderColor: currentTheme.primary }]}>
                          <View style={[styles.corner, styles.topLeft, { borderColor: currentTheme.primary }]} />
                          <View style={[styles.corner, styles.topRight, { borderColor: currentTheme.primary }]} />
                          <View style={[styles.corner, styles.bottomLeft, { borderColor: currentTheme.primary }]} />
                          <View style={[styles.corner, styles.bottomRight, { borderColor: currentTheme.primary }]} />
                        </View>
                        <View style={styles.sideMask} />
                      </View>
                      <View style={styles.bottomMask}>
                        <Text style={styles.scannerInstruction}>
                          Center the QR code served at http://localhost:5001/ on your PC screen
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              // Manual configuration form
              <ScrollView contentContainerStyle={styles.formScroll}>
                <Text style={[styles.formSub, { color: currentTheme.secondaryText }]}>
                  If your device camera is unavailable or you are testing on an emulator, type the PC sync configurations directly below.
                </Text>

                {formError ? (
                  <View style={[styles.errorBox, { backgroundColor: currentTheme.error + "15", borderColor: currentTheme.error }]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={20} color={currentTheme.error} style={{ marginRight: 8 }} />
                    <Text style={[styles.errorText, { color: currentTheme.error }]}>{formError}</Text>
                  </View>
                ) : null}

                {/* IP Field */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: currentTheme.text }]}>PC IP Address</Text>
                  <View style={[styles.inputWrapper, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}>
                    <MaterialCommunityIcons name="ip-network" size={20} color={currentTheme.secondaryText} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { color: currentTheme.text }]}
                      placeholder="e.g. 192.168.1.15"
                      placeholderTextColor={currentTheme.secondaryText}
                      value={manualIp}
                      onChangeText={setManualIp}
                      keyboardType="numeric"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Port Field */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: currentTheme.text }]}>Sync Server Port</Text>
                  <View style={[styles.inputWrapper, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}>
                    <MaterialCommunityIcons name="server" size={20} color={currentTheme.secondaryText} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { color: currentTheme.text }]}
                      placeholder="5001"
                      placeholderTextColor={currentTheme.secondaryText}
                      value={manualPort}
                      onChangeText={setManualPort}
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Token Field */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: currentTheme.text }]}>Security Token</Text>
                  <View style={[styles.inputWrapper, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}>
                    <MaterialCommunityIcons name="key-variant" size={20} color={currentTheme.secondaryText} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { color: currentTheme.text }]}
                      placeholder="Sync key printed in server console"
                      placeholderTextColor={currentTheme.secondaryText}
                      value={manualToken}
                      onChangeText={setManualToken}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: currentTheme.primary }]}
                  onPress={handleManualSubmit}
                >
                  <Text style={styles.submitBtnText}>Establish Connection</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>

          {/* Footer Navigation */}
          <View style={[styles.footer, { borderTopColor: currentTheme.border, backgroundColor: currentTheme.surface }]}>
            <TouchableOpacity
              style={[
                styles.navBtn,
                !isManual && { backgroundColor: currentTheme.primary + "15" }
              ]}
              onPress={() => setIsManual(false)}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={22}
                color={!isManual ? currentTheme.primary : currentTheme.secondaryText}
              />
              <Text
                style={[
                  styles.navBtnText,
                  { color: !isManual ? currentTheme.primary : currentTheme.secondaryText }
                ]}
              >
                Scan QR Code
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navBtn,
                isManual && { backgroundColor: currentTheme.primary + "15" }
              ]}
              onPress={() => setIsManual(true)}
            >
              <MaterialCommunityIcons
                name="keyboard-outline"
                size={22}
                color={isManual ? currentTheme.primary : currentTheme.secondaryText}
              />
              <Text
                style={[
                  styles.navBtnText,
                  { color: isManual ? currentTheme.primary : currentTheme.secondaryText }
                ]}
              >
                Manual Setup
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "85%",
    width: "100%",
    overflow: "hidden",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  closeIconButton: {
    padding: 4,
  },
  body: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    backgroundColor: "transparent",
  },
  infoText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topMask: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  middleRow: {
    flexDirection: "row",
    height: 250,
  },
  sideMask: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  scannerBox: {
    width: 250,
    height: 250,
    position: "relative",
    borderWidth: 1,
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  bottomMask: {
    flex: 1.2,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 30,
  },
  scannerInstruction: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.85,
  },
  formScroll: {
    padding: 20,
  },
  formSub: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
  },
  submitButton: {
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    borderTopWidth: 1,
    height: 70,
    paddingBottom: Platform.OS === "ios" ? 10 : 0,
  },
  navBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    gap: 4,
  },
  navBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
