import React, { useState, useEffect, useRef } from "react";
import { ScrollView, View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Modal from "react-native-modal";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { scheduleDailyTaskNotification, cancelDueDateNotification } from "../utils/notifications";
import { CustomTextInput } from "../components/CustomTextInput";

export const DailyTasksScreen = ({
  currentTheme,
  setSelectedTask,
  setModalVisible,
  dailyTasks = [],
  setDailyTasks,
  showConfirmation
}) => {
  const navigation = useNavigation();
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());
  const today = new Date().toISOString().slice(0, 10);

  // AI activator sweep animation
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

  const addDailyTask = () => {
    if (newTaskName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newDailyTask = {
        id: Date.now(),
        name: newTaskName.trim(),
        lastCompletedDate: null,
        time: newTaskTime || null,
        completed: false,
        completedDate: null,
        notificationId: null,
      };

      if (newDailyTask.time) {
        scheduleDailyTaskNotification(newDailyTask).then(notificationId => {
          setDailyTasks([...dailyTasks, { ...newDailyTask, notificationId }]);
        });
      } else {
        setDailyTasks([...dailyTasks, newDailyTask]);
      }
      setNewTaskName("");
      setNewTaskTime("");
      setAddModalVisible(false);
    }
  };

  const handleTimeChange = (event, selectedDate) => {
    setShowTimePicker(false);
    if (selectedDate) {
      setTempTime(selectedDate);
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      setNewTaskTime(`${hours}:${minutes}`);
    }
  };

  const toggleDailyTaskComplete = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDailyTasks(
      dailyTasks.map((task) => {
        if (task.id === id) {
          const newCompletedStatus = !task.completed;
          return {
            ...task,
            completed: newCompletedStatus,
            completedDate: newCompletedStatus ? today : null,
            lastCompletedDate: newCompletedStatus ? today : null,
          };
        }
        return task;
      })
    );
  };

  const deleteDailyTask = (id) => {
    showConfirmation(
      "Confirm deletion of objective from system?",
      () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setDailyTasks(dailyTasks => {
          const taskToDelete = dailyTasks.find(t => t.id === id);
          if (taskToDelete && taskToDelete.notificationId) {
            cancelDueDateNotification(taskToDelete.notificationId);
          }
          return dailyTasks.filter((task) => task.id !== id);
        });
      }
    );
  };

  // Calculate efficiency
  const totalCount = dailyTasks.length;
  const completedCount = dailyTasks.filter(t => t.completed).length;
  const efficiency = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        
        {/* Page Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.headerMetaRow}>
            <View style={[styles.badge, { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }]}>
              <Text style={[styles.badgeText, { color: currentTheme.onPrimary }]}>
                DAILY_LOG_V1.0
              </Text>
            </View>
            <View style={[styles.glassBadge, { borderColor: currentTheme.border }]}>
              <MaterialCommunityIcons name="clock-outline" size={12} color={currentTheme.text} style={{ marginRight: 4 }} />
              <Text style={[styles.glassBadgeText, { color: currentTheme.text }]}>
                {dailyTasks.filter(t => !t.completed).length} ACTIVE OBJECTIVES
              </Text>
            </View>
          </View>
          <Text style={[styles.title, { color: currentTheme.text }]}>SYSTEM OBJECTIVES</Text>
        </View>

        {/* Task Canvas (Ruled Ledger / Machined Steel Plate) */}
        <LiquidGlassCard theme={currentTheme} style={styles.canvasCard}>
          <View style={styles.canvasHeader}>
            <Text style={[styles.canvasHeaderTitle, { color: currentTheme.text }]}>Active_Tasks.sys</Text>
            <Text style={[styles.canvasHeaderDate, { color: currentTheme.secondaryText }]}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
            </Text>
          </View>

          <View style={styles.taskContainer}>
            {dailyTasks.length === 0 ? (
              <Text style={[styles.emptyLabel, { color: currentTheme.secondaryText }]}>
                NO SYSTEM OBJECTIVES CHARGED. ENTER NEW DIRECTIVE BELOW.
              </Text>
            ) : (
              dailyTasks.map((task) => (
                <View key={task.id} style={styles.objectiveRow}>
                  <TouchableOpacity
                    onPress={() => toggleDailyTaskComplete(task.id)}
                    style={[
                      styles.squareCheck, 
                      { 
                        borderColor: currentTheme.primary,
                        backgroundColor: task.completed ? currentTheme.primary : "transparent"
                      }
                    ]}
                    activeOpacity={0.7}
                  >
                    {task.completed && (
                      <MaterialCommunityIcons 
                        name="close" 
                        size={14} 
                        color={currentTheme.onPrimary} 
                        style={{ fontWeight: "bold" }} 
                      />
                    )}
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <Text 
                      style={[
                        styles.objectiveText, 
                        { 
                          color: task.completed ? currentTheme.secondaryText : currentTheme.text,
                          textDecorationLine: task.completed ? "line-through" : "none",
                          opacity: task.completed ? 0.6 : 1
                        }
                      ]}
                    >
                      {task.name}
                    </Text>
                    
                    <View style={styles.objectiveMeta}>
                      <Text style={[styles.metaSticker, { color: currentTheme.secondaryText, borderColor: currentTheme.border + "40" }]}>
                        {task.time ? `DUE: ${task.time}` : "OBJECTIVE"}
                      </Text>
                      {task.completed && (
                        <Text style={[styles.metaTime, { color: currentTheme.secondaryText }]}>
                          DONE
                        </Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity onPress={() => deleteDailyTask(task.id)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={currentTheme.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Borderless Typewriter input for Quick Add */}
            <View style={[styles.typewriterRow, { borderTopColor: currentTheme.border + "30" }]}>
              <MaterialCommunityIcons name="plus" size={18} color={currentTheme.secondaryText} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.typewriterInput, { color: currentTheme.text }]}
                value={newTaskName}
                onChangeText={setNewTaskName}
                placeholder="ADD NEW SYSTEM OBJECTIVE..."
                placeholderTextColor={currentTheme.secondaryText + "80"}
                onSubmitEditing={addDailyTask}
                returnKeyType="done"
              />
              {newTaskName.trim().length > 0 && (
                <TouchableOpacity onPress={addDailyTask}>
                  <MaterialCommunityIcons name="check" size={20} color={currentTheme.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Verified Stamp Overlay */}
          <View style={styles.stampContainer}>
            <View style={[styles.stampOutline, { borderColor: currentTheme.border + "30" }]}>
              <Text style={[styles.stampBrand, { color: currentTheme.border + "40" }]}>KWESTUP</Text>
              <Text style={[styles.stampVer, { color: currentTheme.border + "30" }]}>VERIFIED AUTHENTIC</Text>
            </View>
          </View>
        </LiquidGlassCard>

        {/* Side Actions Area */}
        <View style={styles.sideArea}>
          
          {/* 1. AI Activator Button */}
          <TouchableOpacity
            style={[styles.aiActivator, { backgroundColor: currentTheme.primary, borderColor: currentTheme.border }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("Notes")}
          >
            <Animated.View style={[styles.scanLine, { top: laserY, backgroundColor: currentTheme.onPrimary }]} />
            <View style={styles.aiActivatorInner}>
              <MaterialCommunityIcons 
                name="robot-outline" 
                size={24} 
                color={currentTheme.onPrimary} 
              />
              <Text 
                style={[
                  styles.aiActivatorText, 
                  { color: currentTheme.onPrimary }
                ]}
              >
                AI ASSIST_ACTIVATE
              </Text>
            </View>
          </TouchableOpacity>

          {/* 2. Insights Card (Brushed Metal) */}
          <View style={[styles.insightsCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
            <View style={styles.insightsHeader}>
              <MaterialCommunityIcons name="chart-bar" size={18} color={currentTheme.primary} />
              <Text style={[styles.insightsHeaderTitle, { color: currentTheme.text }]}>SYSTEM INSIGHTS</Text>
            </View>
            
            <Text style={[styles.insightsDesc, { color: currentTheme.secondaryText }]}>
              Current productivity cycle is at <Text style={{ color: currentTheme.primary, fontWeight: "900" }}>{efficiency}%</Text> efficiency. Focus on completing objectives to optimize throughput.
            </Text>

            <View style={[styles.progressTrack, { backgroundColor: currentTheme.border + "20", borderColor: currentTheme.border + "40" }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${efficiency}%`, 
                    backgroundColor: currentTheme.primary,
                    shadowColor: currentTheme.primary,
                  }
                ]} 
              />
            </View>
          </View>

        </View>

      </ScrollView>

      {/* Floating Action Button (FAB) to add daily task */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: currentTheme.primary,
            borderColor: currentTheme.text || "#000000",
          },
        ]}
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={24} color={currentTheme.onPrimary} />
      </TouchableOpacity>

      {/* Create Daily Task Modal */}
      <Modal
        isVisible={addModalVisible}
        onBackdropPress={() => {
          setNewTaskName("");
          setNewTaskTime("");
          setAddModalVisible(false);
        }}
        style={styles.modalAlign}
      >
        <View style={[styles.dialogCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
          <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>
            CREATE NEW DAILY OBJECTIVE
          </Text>
          <CustomTextInput
            value={newTaskName}
            onChangeText={setNewTaskName}
            placeholder="Objective name (e.g. Drink Water)"
            theme={currentTheme}
            placeholderTextColor={currentTheme.secondaryText}
          />

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.timePickerBtn, { borderColor: currentTheme.border, flex: 1, backgroundColor: currentTheme.cardBackground }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={[styles.timePickerBtnText, { color: currentTheme.primary }]}>
                {newTaskTime ? `⏰ TIME: ${newTaskTime}` : "⏰ SET REMINDER (OPTIONAL)"}
              </Text>
            </TouchableOpacity>
            {newTaskTime ? (
              <TouchableOpacity
                style={[styles.timePickerBtn, { borderColor: currentTheme.error, paddingHorizontal: 12, backgroundColor: currentTheme.cardBackground }]}
                onPress={() => setNewTaskTime("")}
              >
                <MaterialCommunityIcons name="close" size={16} color={currentTheme.error} />
              </TouchableOpacity>
            ) : null}
          </View>

          {showTimePicker && (
            <DateTimePicker
              value={tempTime}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={handleTimeChange}
            />
          )}

          <View style={styles.dialogActions}>
            <TouchableOpacity
              onPress={() => {
                setNewTaskName("");
                setNewTaskTime("");
                setAddModalVisible(false);
              }}
              style={[styles.dialogBtn, { borderColor: currentTheme.border }]}
            >
              <Text style={[styles.dialogBtnText, { color: currentTheme.text }]}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={addDailyTask}
              disabled={!newTaskName.trim()}
              style={[styles.dialogBtnPrimary, { backgroundColor: currentTheme.primary }]}
            >
              <Text style={[styles.dialogBtnPrimaryText, { color: currentTheme.onPrimary }]}>CREATE</Text>
            </TouchableOpacity>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 20,
  },
  headerMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
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
  glassBadge: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  glassBadgeText: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "JetBrainsMono-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  canvasCard: {
    padding: 16,
    borderWidth: 2,
    minHeight: 350,
  },
  canvasHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
    paddingBottom: 8,
    marginBottom: 16,
  },
  canvasHeaderTitle: {
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    textTransform: "uppercase",
  },
  canvasHeaderDate: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Bold",
  },
  taskContainer: {
    flexDirection: "column",
    gap: 12,
  },
  emptyLabel: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Regular",
    textAlign: "center",
    lineHeight: 18,
    paddingVertical: 30,
    opacity: 0.7,
  },
  objectiveRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 12,
  },
  squareCheck: {
    width: 20,
    height: 20,
    borderWidth: 2,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  objectiveText: {
    fontSize: 15,
    fontWeight: "800",
    fontFamily: "JetBrainsMono-Bold",
    lineHeight: 20,
  },
  objectiveMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  metaSticker: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Bold",
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  metaTime: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Regular",
    opacity: 0.6,
  },
  typewriterRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 16,
  },
  typewriterInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    padding: 0,
  },
  stampContainer: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  stampOutline: {
    borderWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: "12deg" }],
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.35,
  },
  stampBrand: {
    fontSize: 16,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: 0.5,
  },
  stampVer: {
    fontSize: 8,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  sideArea: {
    marginTop: 20,
    flexDirection: "column",
    gap: 16,
  },
  aiActivator: {
    borderWidth: 2,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    height: 60,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
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
  },
  aiActivatorInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiActivatorText: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    letterSpacing: 1,
  },
  insightsCard: {
    borderWidth: 2,
    padding: 16,
    borderRadius: 0,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  insightsHeaderTitle: {
    fontSize: 12,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
  },
  insightsDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "JetBrainsMono-Regular",
    marginBottom: 12,
  },
  progressTrack: {
    height: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 6,
  },
  modalAlign: {
    justifyContent: "center",
    margin: 20,
  },
  dialogCard: {
    borderWidth: 2.5,
    padding: 24,
    borderRadius: 0,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  dialogBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dialogBtnText: {
    fontSize: 12,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
  },
  dialogBtnPrimary: {
    borderWidth: 3,
    borderColor: "#000000",
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dialogBtnPrimaryText: {
    fontSize: 12,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
  },
  timePickerBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  timePickerBtnText: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
});
