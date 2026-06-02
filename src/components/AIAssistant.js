/**
 * KwestUp Mobile — Unified AI Assistant Modal
 * Floating AI action button + bottom sheet overlay for note actions
 * and natural language task/birthday quick creation using on-device LLM.
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
  TextInput,
  StyleSheet as RNStyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Modal from "react-native-modal";
import * as Haptics from "expo-haptics";
import {
  isModelDownloaded,
  downloadModel,
  summarizeNote,
  extractTasksFromNote,
  parseGlobalCommand,
  unloadModel,
  assistWriting,
  assistWritingCustom,
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
  onTaskCreated,
  onBirthdayCreated,
  onUpdateNoteContent,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [mode, setMode] = useState(null); // "summarize" | "extract" | "downloading" | "needDownload"
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [isInferring, setIsInferring] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [resultText, setResultText] = useState("");
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Quick Create States
  const [globalCommand, setGlobalCommand] = useState("");
  const [aiState, setAiState] = useState("idle"); // "idle" | "parsing" | "success" | "error"
  const [aiSuccessMessage, setAiSuccessMessage] = useState("");
  const [customNotePrompt, setCustomNotePrompt] = useState("");

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Premium subtle breathing animation for FAB button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Tactile digital scanning sweep loop (runs continuously)
  useEffect(() => {
    const scan = Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      })
    );
    scan.start();
    return () => scan.stop();
  }, [scanAnim]);

  const laserY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const resetState = () => {
    setMode(null);
    setStreamedText("");
    setResultText("");
    setExtractedTasks([]);
    setError(null);
    setIsInferring(false);
    setIsDownloading(false);
    setDownloadProgress(0);
    setGlobalCommand("");
    setAiState("idle");
    setAiSuccessMessage("");
    setCustomNotePrompt("");
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

  const handleAssist = async (commandType) => {
    if (!noteContent || noteContent.trim().length < 10) {
      Alert.alert("AI Writing Assistant", "Note is too short to edit. Add some content first.");
      return;
    }

    const modelReady = await isModelDownloaded();
    if (!modelReady) {
      setMode("needDownload");
      return;
    }

    setMode("assist");
    setIsInferring(true);
    setStreamedText("");
    setResultText("");
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await assistWriting(noteContent, commandType, (token) => {
        setStreamedText((prev) => prev + token);
      });
      setResultText(result || streamedText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(`Writing assistance failed: ${err.message}`);
    } finally {
      setIsInferring(false);
    }
  };

  const handleAssistCustom = async (userPrompt) => {
    if (!userPrompt || userPrompt.trim().length < 2) {
      Alert.alert("AI Writing Assistant", "Please enter a valid prompt instruction.");
      return;
    }
    if (!noteContent || noteContent.trim().length < 10) {
      Alert.alert("AI Writing Assistant", "Note is too short to edit. Add some content first.");
      return;
    }

    const modelReady = await isModelDownloaded();
    if (!modelReady) {
      setMode("needDownload");
      return;
    }

    setMode("assist");
    setIsInferring(true);
    setStreamedText("");
    setResultText("");
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await assistWritingCustom(noteContent, userPrompt.trim(), (token) => {
        setStreamedText((prev) => prev + token);
      });
      setResultText(result || streamedText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(`Writing assistance failed: ${err.message}`);
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

  const handleQuickCreate = async () => {
    if (!globalCommand || globalCommand.trim().length < 3) {
      Alert.alert("AI Quick Create", "Please type a short request (e.g. 'buy milk tomorrow').");
      return;
    }

    const modelReady = await isModelDownloaded();
    if (!modelReady) {
      setMode("needDownload");
      return;
    }

    setAiState("parsing");
    setError(null);
    setAiSuccessMessage("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const parsed = await parseGlobalCommand(globalCommand.trim());
      console.log("🤖 AI Global Parsed result:", parsed);

      if (parsed.type === "task" && onTaskCreated) {
        onTaskCreated(parsed);
        setAiSuccessMessage(`Created Task: "${parsed.title}"`);
        setAiState("success");
        setGlobalCommand("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (parsed.type === "birthday" && onBirthdayCreated) {
        await onBirthdayCreated(parsed);
        setAiSuccessMessage(`Created Birthday: "${parsed.name}"`);

        setAiState("success");
        setGlobalCommand("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error("Invalid command parsing structure.");
      }
    } catch (err) {
      console.error("AI command execution error:", err);
      setError(`Command parsing failed: ${err.message}`);
      setAiState("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <View style={styles.menuTitleRow}>
        <MaterialCommunityIcons name="robot-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.menuTitle, { color: currentTheme.text }]}>KwestUp AI</Text>
      </View>
      
      {/* 1. Note-specific tools (renders only if viewing/editing a note) */}
      {noteContent && noteContent.trim().length > 0 ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={[styles.sectionSubtitle, { color: currentTheme.primary, marginBottom: 8 }]}>
            ACTIVE NOTE: &ldquo;{noteTitle || "Untitled Note"}&rdquo;
          </Text>

          {/* Featured Markdown Improviser Card */}
          <TouchableOpacity
            style={[
              styles.featuredCard,
              {
                backgroundColor: currentTheme.primary + "12",
                borderColor: currentTheme.primary + "40",
                borderWidth: 1.5,
                overflow: "hidden", // Clips the sliding scan line inside card boundaries
              }
            ]}
            onPress={() => handleAssist("improvise")}
            activeOpacity={0.8}
          >
            {/* Sliding industrial neon scanner laser */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  top: laserY,
                  backgroundColor: currentTheme.primary,
                  shadowColor: currentTheme.primary,
                }
              ]}
            />
            <View style={styles.featuredIconContainer}>
              <MaterialCommunityIcons name="creation" size={24} color={currentTheme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featuredTitle, { color: currentTheme.text }]}>
                Improvise & Format Note
              </Text>
              <Text style={[styles.featuredDesc, { color: currentTheme.secondaryText }]}>
                Restructures your note into beautiful, polished Markdown headers and lists.
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.actionGridCard, { backgroundColor: currentTheme.primary + "10", borderColor: currentTheme.primary + "30" }]}
              onPress={handleSummarize}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="text-box-outline" size={20} color={currentTheme.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.actionGridTitle, { color: currentTheme.text }]}>Summarize</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionGridCard, { backgroundColor: currentTheme.primary + "10", borderColor: currentTheme.primary + "30" }]}
              onPress={() => handleAssist("improve")}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="auto-fix" size={20} color={currentTheme.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.actionGridTitle, { color: currentTheme.text }]}>Improve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionGridCard, { backgroundColor: currentTheme.primary + "10", borderColor: currentTheme.primary + "30" }]}
              onPress={() => handleAssist("grammar")}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="spellcheck" size={20} color={currentTheme.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.actionGridTitle, { color: currentTheme.text }]}>Grammar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionGridCard, { backgroundColor: currentTheme.primary + "10", borderColor: currentTheme.primary + "30" }]}
              onPress={() => handleAssist("longer")}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="text-box-plus-outline" size={20} color={currentTheme.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.actionGridTitle, { color: currentTheme.text }]}>Expand</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionGridCard, { backgroundColor: currentTheme.primary + "10", borderColor: currentTheme.primary + "30" }]}
              onPress={() => handleAssist("shorter")}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="text-box-minus-outline" size={20} color={currentTheme.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.actionGridTitle, { color: currentTheme.text }]}>Condense</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionGridCard, { backgroundColor: currentTheme.primary + "10", borderColor: currentTheme.primary + "30" }]}
              onPress={() => handleAssist("professional")}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="briefcase-outline" size={20} color={currentTheme.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.actionGridTitle, { color: currentTheme.text }]}>Formal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionGridCard, { backgroundColor: currentTheme.primary + "10", borderColor: currentTheme.primary + "30" }]}
              onPress={() => handleAssist("casual")}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="chat-outline" size={20} color={currentTheme.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.actionGridTitle, { color: currentTheme.text }]}>Casual</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionGridCard, { backgroundColor: currentTheme.primary + "10", borderColor: currentTheme.primary + "30" }]}
              onPress={handleExtractTasks}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={currentTheme.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.actionGridTitle, { color: currentTheme.text }]}>Tasks</Text>
            </TouchableOpacity>
          </View>

          {/* Custom Note Instruction Input */}
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <MaterialCommunityIcons name="pencil-box-multiple-outline" size={14} color={currentTheme.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.sectionSubtitle, { color: currentTheme.primary }]}>CUSTOM NOTE INSTRUCTION</Text>
            </View>
            <View style={[styles.glassInputContainer, { backgroundColor: currentTheme.primary + "06", borderColor: currentTheme.border }]}>
              <TextInput
                style={[styles.commandInput, { color: currentTheme.text }]}
                placeholder="e.g. 'translate to Spanish' or 'summarize as a list'"
                placeholderTextColor={currentTheme.secondaryText}
                value={customNotePrompt}
                onChangeText={setCustomNotePrompt}
                onSubmitEditing={() => handleAssistCustom(customNotePrompt)}
                editable={!isInferring}
              />
              {customNotePrompt.trim().length > 0 && (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: currentTheme.primary }]}
                  onPress={() => handleAssistCustom(customNotePrompt)}
                  disabled={isInferring}
                >
                  <Text style={styles.sendBtnText}>Apply</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ) : null}

      {/* 2. Global natural language parser */}
      <View style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <MaterialCommunityIcons name="lightning-bolt" size={14} color={currentTheme.primary} style={{ marginRight: 4 }} />
          <Text style={[styles.sectionSubtitle, { color: currentTheme.primary }]}>AI QUICK-CREATE</Text>
        </View>
        <Text style={{ color: currentTheme.secondaryText, fontSize: 13, marginBottom: 10, lineHeight: 18 }}>
          Instruct the AI in plain English to automatically schedule a Task or Birthday:
        </Text>
        
        {/* Styled Glass Input */}
        <View style={[styles.glassInputContainer, { backgroundColor: currentTheme.primary + "06", borderColor: currentTheme.border }]}>
          <TextInput
            style={[styles.commandInput, { color: currentTheme.text }]}
            placeholder="e.g. 'buy groceries tomorrow at 5pm' or 'Dad's birthday on Jan 15'"
            placeholderTextColor={currentTheme.secondaryText}
            value={globalCommand}
            onChangeText={(text) => {
              setGlobalCommand(text);
              if (aiState !== "idle") setAiState("idle");
            }}
            onSubmitEditing={handleQuickCreate}
            editable={aiState !== "parsing"}
          />
          {globalCommand.trim().length > 0 && aiState !== "parsing" && (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: currentTheme.primary }]}
              onPress={handleQuickCreate}
            >
              <Text style={styles.sendBtnText}>Create</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dynamic AI Execution States */}
        {aiState === "parsing" && (
          <View style={styles.aiStatusRow}>
            <ActivityIndicator size="small" color={currentTheme.primary} />
            <Text style={[styles.aiStatusText, { color: currentTheme.primary, fontWeight: "600" }]}>
              AI is parsing command offline...
            </Text>
          </View>
        )}

        {aiState === "success" && (
          <View style={[styles.aiBanner, { backgroundColor: "#4CAF5022", borderColor: "#4CAF50" }]}>
            <Text style={{ color: currentTheme.text, fontSize: 14, fontWeight: "600" }}>
              {aiSuccessMessage}
            </Text>
          </View>
        )}

        {aiState === "error" && (
          <View style={[styles.aiBanner, { backgroundColor: "#F4433622", borderColor: "#F44336" }]}>
            <Text style={{ color: currentTheme.text, fontSize: 14, fontWeight: "600" }}>
              {error || "Parsing failed. Please try again."}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.closeButton, { borderColor: currentTheme.border }]}
        onPress={handleClose}
      >
        <Text style={{ color: currentTheme.secondaryText, fontSize: 14, fontWeight: "600" }}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNeedDownload = () => (
    <View style={styles.menuContainer}>
      <View style={styles.menuTitleRow}>
        <MaterialCommunityIcons name="robot-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.menuTitle, { color: currentTheme.text }]}>Offline AI Setup</Text>
      </View>
      <Text style={[styles.menuSubtitle, { color: currentTheme.secondaryText }]}>
        The on-device Qwen2.5-0.5B-Instruct AI model (~460 MB) needs to be downloaded once. It runs 100% offline, keeping all your data safe on your device.
      </Text>

      <TouchableOpacity
        id="ai-download-btn"
        style={[styles.primaryButton, { backgroundColor: currentTheme.primary }]}
        onPress={handleDownloadModel}
      >
        <Text style={styles.primaryButtonText}>Download Offline AI Model</Text>
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
      <View style={styles.menuTitleRow}>
        <MaterialCommunityIcons name="download-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.menuTitle, { color: currentTheme.text }]}>Downloading AI Model</Text>
      </View>
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
      <Text style={[styles.menuSubtitle, { color: currentTheme.secondaryText, marginTop: 10 }]}>
        Please keep the application open. This is a one-time download setup.
      </Text>
    </View>
  );

  const renderSummarize = () => (
    <View style={styles.menuContainer}>
      <View style={styles.menuTitleRow}>
        <MaterialCommunityIcons name="text-box-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.menuTitle, { color: currentTheme.text }]}>Note Summary</Text>
      </View>
      {isInferring && !streamedText && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={currentTheme.primary} />
          <Text style={[styles.loadingLabel, { color: currentTheme.secondaryText }]}>
            Loading offline AI model...
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
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          {onUpdateNoteContent && (streamedText || resultText) && (
            <TouchableOpacity
              style={[styles.primaryButton, { flex: 1, backgroundColor: currentTheme.primary, marginVertical: 0, marginTop: 0 }]}
              onPress={() => {
                const summaryText = resultText || streamedText;
                onUpdateNoteContent("> [!NOTE]\n> **AI Summary**:\n> " + summaryText.split("\n").join("\n> ") + "\n\n" + noteContent);
                handleClose();
              }}
            >
              <Text style={styles.primaryButtonText}>Insert at Top</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.closeButton, { flex: 1, borderColor: currentTheme.border, marginTop: 0 }]}
            onPress={handleClose}
          >
            <Text style={{ color: currentTheme.secondaryText, fontSize: 14, fontWeight: "600" }}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderAssist = () => (
    <View style={styles.menuContainer}>
      <View style={styles.menuTitleRow}>
        <MaterialCommunityIcons name="auto-fix" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.menuTitle, { color: currentTheme.text }]}>Writing Assistant</Text>
      </View>
      {isInferring && !streamedText && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={currentTheme.primary} />
          <Text style={[styles.loadingLabel, { color: currentTheme.secondaryText }]}>
            AI is writing offline...
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
      {!isInferring && (streamedText || resultText) && onUpdateNoteContent && (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1, backgroundColor: currentTheme.primary }]}
            onPress={() => {
              onUpdateNoteContent(resultText || streamedText);
              handleClose();
            }}
          >
            <Text style={styles.primaryButtonText}>Replace Note</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1, backgroundColor: currentTheme.primary + "30" }]}
            onPress={() => {
              onUpdateNoteContent(noteContent + "\n\n" + (resultText || streamedText));
              handleClose();
            }}
          >
            <Text style={[styles.primaryButtonText, { color: currentTheme.text }]}>Append</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isInferring && (
        <TouchableOpacity
          style={[styles.closeButton, { borderColor: currentTheme.border }]}
          onPress={handleClose}
        >
          <Text style={{ color: currentTheme.secondaryText, fontSize: 14, fontWeight: "600" }}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderExtract = () => (
    <View style={styles.menuContainer}>
      <View style={styles.menuTitleRow}>
        <MaterialCommunityIcons name="clipboard-check-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.menuTitle, { color: currentTheme.text }]}>Extracted Tasks</Text>
      </View>
      {isInferring && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={currentTheme.primary} />
          <Text style={[styles.loadingLabel, { color: currentTheme.secondaryText }]}>
            Analyzing note items...
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
          <Text style={{ color: currentTheme.secondaryText, fontSize: 14, fontWeight: "600" }}>Close</Text>
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
      case "assist": return renderAssist();
      default: return renderMenu();
    }
  };

  return (
    <>
      {/* Floating Global AI Action Button — Redesigned Premium Glassmorphic UI */}
      <Animated.View style={[styles.fab, style, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          id="ai-assistant-fab"
          style={[
            styles.fabInner,
            {
              backgroundColor: currentTheme.primary + "CC", // Sleek translucent glass
              borderColor: "rgba(255, 255, 255, 0.25)",
              borderWidth: 1.5,
              shadowColor: currentTheme.primary,
              shadowOpacity: 0.6,
              shadowRadius: 12,
              elevation: 10,
            }
          ]}
          onPress={handleOpen}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="robot-outline" size={22} color="#FFFFFF" />
          <Text style={[styles.fabLabel, { color: "#FFFFFF", fontWeight: "900" }]}>AI</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Unified AI Bottom Sheet Modal */}
      <Modal
        isVisible={isModalVisible}
        onBackdropPress={mode === "downloading" || isInferring || aiState === "parsing" ? undefined : handleClose}
        style={styles.modal}
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        avoidKeyboard
      >
        <View style={[styles.sheet, { backgroundColor: currentTheme.cardBackground }]}>
          {renderContent()}
        </View>
      </Modal>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const rawStyles = {
  fab: {
    position: "absolute",
    bottom: 95,
    right: 20,
    zIndex: 1000,
  },
  fabInner: {
    width: 58,
    height: 58,
    borderRadius: 0, // perfect 90-degree square corners
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8E7BEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabLabel: { fontSize: 10, color: "#FFF", fontWeight: "800", marginTop: 2 },
  modal: { justifyContent: "flex-end", margin: 0 },
  sheet: {
    borderTopLeftRadius: 0, // perfect sharp console bounds
    borderTopRightRadius: 0,
    paddingTop: 16,
    paddingBottom: 36,
    paddingHorizontal: 20,
    minHeight: 220,
    maxHeight: "85%",
  },
  menuContainer: { paddingTop: 4 },
  menuTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  menuTitle: { fontSize: 20, fontWeight: "800" },
  menuSubtitle: { fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20, paddingHorizontal: 12 },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  actionRow: { flexDirection: "row", gap: 12 },
  actionCard: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 1.5,
    padding: 14,
    alignItems: "center",
  },
  actionIcon: { fontSize: 26, marginBottom: 6 },
  actionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  actionDesc: { fontSize: 11, textAlign: "center", lineHeight: 15 },
  
  glassInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 0,
    paddingHorizontal: 12,
    height: 52,
    overflow: "hidden",
  },
  commandInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
    paddingVertical: 0,
  },
  sendBtn: {
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },
  sendBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  aiStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingLeft: 4,
  },
  aiStatusText: {
    fontSize: 13,
  },
  aiBanner: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 10,
    marginTop: 10,
    alignItems: "center",
  },

  closeButton: {
    borderWidth: 1.5,
    borderRadius: 0,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  primaryButton: {
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  primaryButtonText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  progressBarTrack: {
    height: 8,
    borderRadius: 0,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 0 },
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
    borderBottomWidth: RNStyleSheet.hairlineWidth,
  },
  taskLabel: { fontSize: 14, flex: 1, lineHeight: 20 },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  actionGridCard: {
    width: "23%", // 4 columns layout
    borderRadius: 0,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionGridTitle: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  featuredCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 0,
    padding: 12,
    marginBottom: 12,
  },
  featuredIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  featuredTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  featuredDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 5,
  },
};

const injectFontFamily = (obj) => {
  const fontRegular = "HankenGrotesk-Regular";
  const fontMedium = "HankenGrotesk-Medium";
  const fontSemiBold = "HankenGrotesk-Bold";
  const fontBold = "HankenGrotesk-ExtraBold";

  const monoRegular = "JetBrainsMono-Regular";
  const monoMedium = "JetBrainsMono-Medium";
  const monoBold = "JetBrainsMono-Bold";

  for (const key in obj) {
    if (obj[key] && typeof obj[key] === "object") {
      const style = obj[key];
      // Check if this style has any text-related properties
      const hasTextProp =
        style.fontSize !== undefined ||
        style.color !== undefined ||
        style.lineHeight !== undefined ||
        style.textAlign !== undefined ||
        style.fontStyle !== undefined ||
        style.fontWeight !== undefined;

      if (hasTextProp) {
        const isMono = 
          (style.fontFamily && (style.fontFamily === "monospace" || style.fontFamily === "Menlo")) ||
          key.toLowerCase().includes("timer") || 
          key.toLowerCase().includes("mono") || 
          key.toLowerCase().includes("label") || 
          key.toLowerCase().includes("technical") || 
          key.toLowerCase().includes("code") ||
          key.toLowerCase().includes("logs") ||
          key.toLowerCase().includes("tag") ||
          key.toLowerCase().includes("version");

        if (isMono) {
          if (style.fontWeight && (style.fontWeight === "bold" || style.fontWeight === "700" || style.fontWeight === "800" || style.fontWeight === "900")) {
            style.fontFamily = monoBold;
          } else {
            style.fontFamily = monoMedium;
          }
          continue;
        }

        // Determine weight
        if (style.fontWeight) {
          const weight = String(style.fontWeight);
          if (weight === "bold" || weight === "700" || weight === "800" || weight === "900") {
            style.fontFamily = fontBold;
          } else if (weight === "600") {
            style.fontFamily = fontSemiBold;
          } else if (weight === "500") {
            style.fontFamily = fontMedium;
          } else {
            style.fontFamily = fontRegular;
          }
        } else {
          style.fontFamily = fontRegular;
        }
      }
    }
  }
};

injectFontFamily(rawStyles);

const styles = StyleSheet.create(rawStyles);
