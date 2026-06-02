import React, { useCallback, useEffect, useRef } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { CustomButton } from "../components/CustomButton";

export const DashboardScreen = ({
  tasks = [],
  notes = [],
  currentTheme,
  handleCompleteTask,
  setSelectedTask,
  setModalVisible,
  toggleTaskComplete,
  deleteTask,
  setTasks,
  // Linked Timer parameters passed from state
  timerRemaining = 25 * 60,
  isTimerRunning = false,
  setIsTimerRunning,
  setTimerRemaining,
}) => {
  const navigation = useNavigation();

  // Looping laser scan animation for AI Bento insights panel
  const scanAnim = useRef(new Animated.Value(0)).current;
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

  // Helper to format remaining timer: MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleToggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (setIsTimerRunning) {
      setIsTimerRunning(!isTimerRunning);
    }
  };

  const handleToggleSubtask = (taskId, subtaskIdx) => {
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        const newSubtasks = task.subtasks.map((st, idx) => idx === subtaskIdx ? { ...st, completed: !st.completed } : st);
        return { ...task, subtasks: newSubtasks };
      }
      return task;
    }));
  };

  // Filter top 3 incomplete priority tasks
  const priorityTasks = tasks.filter(t => !t.completed).slice(0, 3);

  // Filter 3 most recently updated notes
  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* ─── BENTO GRID LAYOUT ─── */}
      <View style={styles.gridStack}>
        
        {/* 1. Hero Focus Section */}
        <LiquidGlassCard theme={currentTheme} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={[styles.badge, { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }]}>
              <Text style={[styles.badgeText, { color: currentTheme.background === "#E4E2E1" ? "#FFFFFF" : "#000000" }]}>
                {isTimerRunning ? "ACTIVE_SESSION" : "STANDBY_SESSION"}
              </Text>
            </View>
            <Text style={[styles.heroTimerText, { color: currentTheme.text }]}>
              {formatTime(timerRemaining)}
            </Text>
          </View>
          
          <Text style={[styles.heroTitle, { color: currentTheme.text }]}>
            Deep Work Cycle: Project Alpha
          </Text>
          <Text style={[styles.heroDesc, { color: currentTheme.secondaryText }]}>
            Systems are nominal. Priority tasks are locked. Maintain flow state for optimized output.
          </Text>

          <View style={styles.heroActions}>
            <TouchableOpacity
              onPress={handleToggleTimer}
              activeOpacity={0.8}
              style={[
                styles.invertBtn,
                {
                  backgroundColor: isTimerRunning ? currentTheme.error + "22" : currentTheme.primary,
                  borderColor: isTimerRunning ? currentTheme.error : currentTheme.border,
                }
              ]}
            >
              <MaterialCommunityIcons 
                name={isTimerRunning ? "pause" : "play"} 
                size={18} 
                color={isTimerRunning ? currentTheme.error : (currentTheme.background === "#E4E2E1" ? "#FFFFFF" : "#000000")} 
              />
              <Text 
                style={[
                  styles.invertBtnText, 
                  { color: isTimerRunning ? currentTheme.error : (currentTheme.background === "#E4E2E1" ? "#FFFFFF" : "#000000") }
                ]}
              >
                {isTimerRunning ? "PAUSE FOCUS" : "RESUME FOCUS"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("Focus")}
              style={[styles.outlineBtn, { borderColor: currentTheme.border }]}
            >
              <Text style={[styles.outlineBtnText, { color: currentTheme.text }]}>
                OPEN DIAL
              </Text>
            </TouchableOpacity>
          </View>
        </LiquidGlassCard>

        {/* 2. AI Assist Feature (Glassmorphic) */}
        <View style={[styles.glassPanel, { borderColor: currentTheme.primary + "40" }]}>
          <Animated.View style={[styles.scanLine, { top: laserY, backgroundColor: currentTheme.primary, shadowColor: currentTheme.primary }]} />
          
          <View style={styles.aiHeader}>
            <MaterialCommunityIcons name="psychology" size={24} color={currentTheme.primary} />
            <View style={[styles.tagOutline, { borderColor: currentTheme.primary }]}>
              <Text style={[styles.tagOutlineText, { color: currentTheme.primary }]}>AI_READY</Text>
            </View>
          </View>

          <View>
            <Text style={[styles.aiTitle, { color: currentTheme.text }]}>NEURAL INSIGHTS</Text>
            <Text style={[styles.aiDesc, { color: currentTheme.secondaryText }]}>
              I've detected 3 blockers in your active sprint. Shall we execute system optimizations?
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.glassBtn, { borderColor: currentTheme.primary }]}
            onPress={() => navigation.navigate("Notes")}
          >
            <Text style={[styles.glassBtnText, { color: currentTheme.primary }]}>
              EXECUTE OPTIMIZATION
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. Upcoming Tasks (Priority Queue) */}
        <LiquidGlassCard theme={currentTheme} style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listTitleContainer}>
              <MaterialCommunityIcons name="format-list-bulleted" size={18} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.listCardTitle, { color: currentTheme.text }]}>PRIORITY_QUEUE</Text>
            </View>
            <Text style={[styles.listCardSticker, { color: currentTheme.secondaryText }]}>
              {tasks.filter(t => !t.completed).length} REMAINING
            </Text>
          </View>

          <View style={styles.taskQueue}>
            {priorityTasks.length === 0 ? (
              <Text style={[styles.emptyListLabel, { color: currentTheme.secondaryText }]}>
                NO OBJECTIVES ACTIVE IN SYSTEMS
              </Text>
            ) : (
              priorityTasks.map((task) => (
                <View key={task.id} style={[styles.taskItemRow, { borderColor: currentTheme.border + "30" }]}>
                  <TouchableOpacity
                    onPress={() => handleCompleteTask(task.id)}
                    style={[styles.squareCheck, { borderColor: currentTheme.primary }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskItemText, { color: currentTheme.text }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={[styles.taskItemMeta, { color: currentTheme.secondaryText }]}>
                      {task.dueDate ? `DUE: ${new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "LOGGED IN QUEUE"}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedTask(task);
                      setModalVisible(true);
                    }}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={20} color={currentTheme.secondaryText} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </LiquidGlassCard>

        {/* 4. Recent Notes (Knowledge Base) */}
        <LiquidGlassCard theme={currentTheme} style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listTitleContainer}>
              <MaterialCommunityIcons name="description" size={18} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.listCardTitle, { color: currentTheme.text }]}>KNOWLEDGE_BASE</Text>
            </View>
            <Text style={[styles.listCardSticker, { color: currentTheme.secondaryText }]}>
              {notes.length} DOCUMENTS
            </Text>
          </View>

          <View style={styles.taskQueue}>
            {recentNotes.length === 0 ? (
              <Text style={[styles.emptyListLabel, { color: currentTheme.secondaryText }]}>
                KNOWLEDGE BASE UNINITIALIZED
              </Text>
            ) : (
              recentNotes.map((note) => (
                <TouchableOpacity
                  key={note.id}
                  style={[styles.taskItemRow, { borderColor: currentTheme.border + "30" }]}
                  onPress={() => navigation.navigate("Notes")}
                >
                  <MaterialCommunityIcons name="note-text-outline" size={18} color={currentTheme.primary} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskItemText, { color: currentTheme.text }]} numberOfLines={1}>
                      {note.title}
                    </Text>
                    <Text style={[styles.taskItemMeta, { color: currentTheme.secondaryText }]}>
                      {note.folder || "UNCATEGORIZED"} • {new Date(note.updatedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={currentTheme.secondaryText} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </LiquidGlassCard>

      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  gridStack: {
    flexDirection: "column",
    gap: 16,
  },
  heroCard: {
    padding: 20,
    borderWidth: 2,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    fontFamily: "JetBrainsMono-Bold",
  },
  heroTimerText: {
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "JetBrainsMono-Bold",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "HankenGrotesk-ExtraBold",
    lineHeight: 28,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  heroDesc: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "HankenGrotesk-Regular",
    marginBottom: 20,
  },
  heroActions: {
    flexDirection: "row",
    gap: 12,
  },
  invertBtn: {
    flex: 1.2,
    height: 48,
    borderWidth: 2,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  invertBtnText: {
    fontSize: 13,
    fontWeight: "900",
    fontFamily: "HankenGrotesk-ExtraBold",
    letterSpacing: 0.5,
  },
  outlineBtn: {
    flex: 0.8,
    height: 48,
    borderWidth: 2,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: "900",
    fontFamily: "HankenGrotesk-ExtraBold",
  },
  glassPanel: {
    borderWidth: 2,
    padding: 20,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    backdropFilter: "blur(32px)", // styled visual parameter
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  tagOutline: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagOutlineText: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "HankenGrotesk-ExtraBold",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  aiDesc: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "HankenGrotesk-Regular",
    marginBottom: 16,
  },
  glassBtn: {
    borderWidth: 2,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  glassBtnText: {
    fontSize: 12,
    fontWeight: "900",
    fontFamily: "HankenGrotesk-ExtraBold",
    letterSpacing: 0.5,
  },
  listCard: {
    padding: 16,
    borderWidth: 2,
  },
  listCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 12,
    borderColor: "rgba(128,128,128,0.2)",
  },
  listTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  listCardTitle: {
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: 0.5,
  },
  listCardSticker: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Regular",
  },
  taskQueue: {
    flexDirection: "column",
    gap: 8,
  },
  emptyListLabel: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Regular",
    textAlign: "center",
    paddingVertical: 16,
    opacity: 0.6,
  },
  taskItemRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 12,
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  squareCheck: {
    width: 20,
    height: 20,
    borderWidth: 2,
  },
  taskItemText: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "HankenGrotesk-Bold",
  },
  taskItemMeta: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Regular",
    marginTop: 2,
    opacity: 0.8,
  },
});
