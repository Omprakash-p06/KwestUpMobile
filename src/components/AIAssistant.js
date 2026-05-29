/**
 * KwestUp Mobile — AI Assistant Modal
 * Floating AI action button + bottom sheet overlay for note summarization
 * and task extraction using the on-device llama.rn LLM.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
} from "react-native";
import Modal from "react-native-modal";
import * as Haptics from "expo-haptics";
import {
  isModelDownloaded,
  downloadModel,
  summarizeNote,
  extractTasksFromNote,
  unloadModel,
} from "../utils/aiService";

// ─── Helper: format bytes ────────────────────────────────────────────────────
const formatBytes = (bytes) => {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb < 1024 ? `${mb.toFixed(0)} MB` : `${(mb / 1024).toFixed(2)} GB`;
};

// ─── Main Component ──────────────────────────────────────────────────────────
export const AIAssistant = ({
  currentTheme,
  noteContent,
  noteTitle,
  onTasksExtracted,
  style,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [mode, setMode] = useState(null); // "summarize" | "extract" | "downloading" | "loading"
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [isInferring, setIsInferring] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [resultText, setResultText] = useState("");
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for FAB button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const resetState = () => {
    setMode(null);
    setStreamedText("");
    setResultText("");
    setExtractedTasks([]);
    setError(null);
    setIsInferring(false);
    setIsDownloading(false);
    setDownloadProgress(0);
  };

  const handleOpen = async () => {
    resetState();
    setIsModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClose = async () => {
    setIsModalVisible(false);
    await unloadModel();
    resetState();
  };

  const handleDownloadModel = async () => {
    setMode("downloading");
    setIsDownloading(true);
    setError(null);
    try {
      await downloadModel(({ progress, bytesReceived, totalBytes: total }) => {
        setDownloadProgress(progress);
        setDownloadedBytes(bytesReceived);
        setTotalBytes(total);
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsDownloading(false);
      setMode(null);
    } catch (err) {
      setError(`Download failed: ${err.message}`);
      setIsDownloading(false);
      setMode(null);
    }
  };

  const handleSummarize = async () => {
    if (!noteContent || noteContent.trim().length < 20) {
      Alert.alert("AI Summarize", "Note is too short to summarize. Add more content first.");
      return;
    }

    const modelReady = await isModelDownloaded();
    if (!modelReady) {
      setMode("needDownload");
      return;
    }

    setMode("summarize");
    setIsInferring(true);
    setStreamedText("");
    setError(null);

    try {
      const summary = await summarizeNote(noteContent, (token) => {
        setStreamedText((prev) => prev + token);
      });
      setResultText(summary || streamedText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(`Summarization failed: ${err.message}`);
    } finally {
      setIsInferring(false);
    }
  };

  const handleExtractTasks = async () => {
    if (!noteContent || noteContent.trim().length < 20) {
      Alert.alert("AI Extract Tasks", "Note is too short. Add more content first.");
      return;
    }

    const modelReady = await isModelDownloaded();
    if (!modelReady) {
      setMode("needDownload");
      return;
    }

    setMode("extract");
    setIsInferring(true);
    setExtractedTasks([]);
    setError(null);

    try {
      const tasks = await extractTasksFromNote(noteContent);
      setExtractedTasks(tasks);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(`Task extraction failed: ${err.message}`);
    } finally {
      setIsInferring(false);
    }
  };

  const handleAddAllTasks = () => {
    if (onTasksExtracted && extractedTasks.length > 0) {
      onTasksExtracted(extractedTasks);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsModalVisible(false);
      resetState();
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <Text style={[styles.menuTitle, { color: currentTheme.text }]}>
        ✨ AI Assistant
      </Text>
      <Text style={[styles.menuSubtitle, { color: currentTheme.secondaryText }]}>
        {noteTitle ? `"${noteTitle}"` : "Select an action"}
      </Text>

      <View style={styles.actionRow}>
        <TouchableOpacity
          id="ai-summarize-btn"
          style={[styles.actionCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.primary + "40" }]}
          onPress={handleSummarize}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>📝</Text>
          <Text style={[styles.actionTitle, { color: currentTheme.text }]}>Summarize</Text>
          <Text style={[styles.actionDesc, { color: currentTheme.secondaryText }]}>
            Condense note into bullet points
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          id="ai-extract-btn"
          style={[styles.actionCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.primary + "40" }]}
          onPress={handleExtractTasks}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>✅</Text>
          <Text style={[styles.actionTitle, { color: currentTheme.text }]}>Extract Tasks</Text>
          <Text style={[styles.actionDesc, { color: currentTheme.secondaryText }]}>
            Pull action items into Tasks
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.closeButton, { borderColor: currentTheme.border }]}
        onPress={handleClose}
      >
        <Text style={{ color: currentTheme.secondaryText, fontSize: 14 }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNeedDownload = () => (
    <View style={styles.menuContainer}>
      <Text style={[styles.menuTitle, { color: currentTheme.text }]}>🤖 AI Model Required</Text>
      <Text style={[styles.menuSubtitle, { color: currentTheme.secondaryText }]}>
        The on-device Qwen3-0.6B AI model (~250 MB) needs to be downloaded once. This runs 100% offline after that.
      </Text>

      <TouchableOpacity
        id="ai-download-btn"
        style={[styles.primaryButton, { backgroundColor: currentTheme.primary }]}
        onPress={handleDownloadModel}
      >
        <Text style={styles.primaryButtonText}>Download AI Model</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.closeButton, { borderColor: currentTheme.border }]}
        onPress={handleClose}
      >
        <Text style={{ color: currentTheme.secondaryText, fontSize: 14 }}>Not Now</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDownloading = () => (
    <View style={styles.menuContainer}>
      <Text style={[styles.menuTitle, { color: currentTheme.text }]}>⬇️ Downloading Model</Text>
      <View style={[styles.progressBarTrack, { backgroundColor: currentTheme.border }]}>
        <View
          style={[
            styles.progressBarFill,
            { backgroundColor: currentTheme.primary, width: `${Math.round(downloadProgress * 100)}%` },
          ]}
        />
      </View>
      <Text style={[styles.progressLabel, { color: currentTheme.secondaryText }]}>
        {Math.round(downloadProgress * 100)}% — {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
      </Text>
      <Text style={[styles.menuSubtitle, { color: currentTheme.secondaryText }]}>
        Please keep the app open. This is a one-time download.
      </Text>
    </View>
  );

  const renderSummarize = () => (
    <View style={styles.menuContainer}>
      <Text style={[styles.menuTitle, { color: currentTheme.text }]}>📝 Note Summary</Text>
      {isInferring && !streamedText && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={currentTheme.primary} />
          <Text style={[styles.loadingLabel, { color: currentTheme.secondaryText }]}>
            Loading AI model...
          </Text>
        </View>
      )}
      {(streamedText || resultText) && (
        <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.resultText, { color: currentTheme.text }]}>
            {resultText || streamedText}
            {isInferring && <Text style={{ color: currentTheme.primary }}>▌</Text>}
          </Text>
        </ScrollView>
      )}
      {error && (
        <Text style={[styles.errorText, { color: "#F44336" }]}>{error}</Text>
      )}
      {!isInferring && (
        <TouchableOpacity
          style={[styles.closeButton, { borderColor: currentTheme.border }]}
          onPress={handleClose}
        >
          <Text style={{ color: currentTheme.secondaryText, fontSize: 14 }}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderExtract = () => (
    <View style={styles.menuContainer}>
      <Text style={[styles.menuTitle, { color: currentTheme.text }]}>✅ Extracted Tasks</Text>
      {isInferring && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={currentTheme.primary} />
          <Text style={[styles.loadingLabel, { color: currentTheme.secondaryText }]}>
            Analyzing note...
          </Text>
        </View>
      )}
      {!isInferring && extractedTasks.length > 0 && (
        <>
          <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
            {extractedTasks.map((task, idx) => (
              <View key={idx} style={[styles.taskRow, { borderColor: currentTheme.border }]}>
                <Text style={{ color: currentTheme.primary, fontSize: 16, marginRight: 8 }}>•</Text>
                <Text style={[styles.taskLabel, { color: currentTheme.text }]}>{task}</Text>
              </View>
            ))}
          </ScrollView>
          {onTasksExtracted && (
            <TouchableOpacity
              id="ai-add-tasks-btn"
              style={[styles.primaryButton, { backgroundColor: currentTheme.primary }]}
              onPress={handleAddAllTasks}
            >
              <Text style={styles.primaryButtonText}>
                Add {extractedTasks.length} Task{extractedTasks.length !== 1 ? "s" : ""} to My Tasks
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
      {!isInferring && extractedTasks.length === 0 && !error && (
        <Text style={[styles.menuSubtitle, { color: currentTheme.secondaryText }]}>
          No actionable tasks found in this note.
        </Text>
      )}
      {error && <Text style={[styles.errorText, { color: "#F44336" }]}>{error}</Text>}
      {!isInferring && (
        <TouchableOpacity
          style={[styles.closeButton, { borderColor: currentTheme.border }]}
          onPress={handleClose}
        >
          <Text style={{ color: currentTheme.secondaryText, fontSize: 14 }}>Close</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderContent = () => {
    switch (mode) {
      case "needDownload": return renderNeedDownload();
      case "downloading": return renderDownloading();
      case "summarize": return renderSummarize();
      case "extract": return renderExtract();
      default: return renderMenu();
    }
  };

  return (
    <>
      {/* Floating AI Button */}
      <Animated.View style={[styles.fab, style, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          id="ai-assistant-fab"
          style={[styles.fabInner, { backgroundColor: currentTheme.primary }]}
          onPress={handleOpen}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>✨</Text>
          <Text style={styles.fabLabel}>AI</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* AI Assistant Modal */}
      <Modal
        isVisible={isModalVisible}
        onBackdropPress={mode === "downloading" || isInferring ? undefined : handleClose}
        style={styles.modal}
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <View style={[styles.sheet, { backgroundColor: currentTheme.cardBackground }]}>
          {renderContent()}
        </View>
      </Modal>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 90,
    right: 20,
    zIndex: 100,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8E7BEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { fontSize: 18 },
  fabLabel: { fontSize: 10, color: "#FFF", fontWeight: "800", marginTop: -2 },
  modal: { justifyContent: "flex-end", margin: 0 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    minHeight: 200,
    maxHeight: "80%",
  },
  menuContainer: { paddingTop: 8 },
  menuTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  menuSubtitle: { fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20, paddingHorizontal: 16 },
  actionRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    alignItems: "center",
  },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  actionDesc: { fontSize: 12, textAlign: "center", lineHeight: 16 },
  closeButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  primaryButtonText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 4 },
  progressLabel: { fontSize: 13, textAlign: "center", marginBottom: 12 },
  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 20, gap: 12 },
  loadingLabel: { fontSize: 14 },
  resultScroll: { maxHeight: 260, marginBottom: 12 },
  resultText: { fontSize: 15, lineHeight: 24 },
  errorText: { fontSize: 13, textAlign: "center", marginBottom: 8 },
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskLabel: { fontSize: 14, flex: 1, lineHeight: 20 },
});
