import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Animated, StyleSheet, TextInput } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Modal from "react-native-modal";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomButton } from "../components/CustomButton";

export const TaskListScreen = ({
  tasks = [],
  setTasks,
  taskLists = [],
  handleCreateList,
  handleRenameList,
  handleDeleteList,
  handleToggleSubtask,
  handleCompleteTask,
  toggleTaskComplete,
  deleteTask,
  currentTheme,
  setSelectedTask,
  setModalVisible,
  showConfirmation
}) => {
  const navigation = useNavigation();
  const [activeIndex, setActiveIndex] = useState(0);

  // List CRUD Modals state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newListName, setNewListName] = useState("");

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameListName, setRenameListName] = useState("");
  const [selectedListId, setSelectedListId] = useState("");

  // AI Task Optimizer scanning loop
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

  const activeList = taskLists[activeIndex] || taskLists[0] || { id: "default_inbox", name: "My Tasks" };
  const listTasks = tasks.filter((t) => (t.listId || "default_inbox") === activeList.id);
  const activeTasks = listTasks.filter((t) => !t.completed);
  const completedTasks = listTasks.filter((t) => t.completed);

  // Calculate list progress/velocity
  const totalTasksCount = listTasks.length;
  const completedTasksCount = completedTasks.length;
  const velocity = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const handleTabPress = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveIndex(index);
  };

  const handleAddQuickTask = (title) => {
    if (!title.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      title: title.trim(),
      description: "",
      dueDate: null,
      listId: activeList.id,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={styles.container}>
      
      {/* 1. Category Tabs Section */}
      <View style={[styles.tabBarContainer, { borderBottomColor: currentTheme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {taskLists.map((list, index) => {
            const isActive = index === activeIndex;
            return (
              <TouchableOpacity
                key={list.id}
                onPress={() => handleTabPress(index)}
                style={[
                  styles.tabButton,
                  isActive && {
                    backgroundColor: currentTheme.cardBackground,
                    borderColor: currentTheme.border,
                    borderBottomColor: currentTheme.cardBackground,
                    borderWidth: 2,
                    borderTopWidth: 3,
                    borderBottomWidth: 0,
                  }
                ]}
                activeOpacity={0.8}
              >
                <Text 
                  style={[
                    styles.tabButtonText, 
                    { 
                      color: isActive ? currentTheme.primary : currentTheme.secondaryText,
                      fontFamily: isActive ? "JetBrainsMono-Bold" : "JetBrainsMono-Regular",
                    }
                  ]}
                >
                  {list.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          style={[styles.newListBadge, { borderColor: currentTheme.primary }]}
          onPress={() => setCreateModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={16} color={currentTheme.primary} />
          <Text style={[styles.newListBadgeText, { color: currentTheme.primary }]}>NEW</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollPadding}>
        
        {/* 2. AI Task Optimizer (Glass AI) */}
        <View style={[styles.glassAi, { borderColor: currentTheme.primary + "40" }]}>
          <Animated.View style={[styles.scanLine, { top: laserY, backgroundColor: currentTheme.primary, shadowColor: currentTheme.primary }]} />
          <View style={styles.glassAiInner}>
            <View>
              <View style={styles.glassAiHeader}>
                <MaterialCommunityIcons name="auto-fix" size={18} color={currentTheme.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.glassAiTitle, { color: currentTheme.text }]}>AI_TASK_OPTIMIZER</Text>
              </View>
              <Text style={[styles.glassAiDesc, { color: currentTheme.secondaryText }]}>
                Analyzing {activeTasks.length} objectives in queue. Systems nominal.
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.glassAiBtn, { backgroundColor: currentTheme.primary }]}
              onPress={() => navigation.navigate("Notes")}
            >
              <Text style={[styles.glassAiBtnText, { color: currentTheme.onPrimary }]}>
                PLAN
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Project Chassis Box */}
        <LiquidGlassCard theme={currentTheme} style={styles.projectChassis}>
          <View style={styles.chassisHeader}>
            <View style={[styles.chassisBadge, { backgroundColor: currentTheme.primary }]}>
              <Text style={[styles.chassisBadgeText, { color: currentTheme.onPrimary }]}>
                PROJECT // {activeList.name.toUpperCase()}
              </Text>
            </View>
            <View style={styles.chassisActions}>
              {activeList.id !== "default_inbox" && (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedListId(activeList.id);
                      setRenameListName(activeList.name);
                      setRenameModalVisible(true);
                    }}
                    style={{ marginRight: 8 }}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={currentTheme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      handleDeleteList(activeList.id);
                    }}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={currentTheme.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* ── Active Objectives ─────────────────────── */}
          <View style={styles.taskListQueue}>
            {activeTasks.length === 0 ? (
              <Text style={[styles.emptyLabelText, { color: currentTheme.secondaryText }]}>
                NO ACTIVE OBJECTIVES. ALL CLEAR.
              </Text>
            ) : (
              activeTasks.map((task) => (
                <View key={task.id} style={[styles.taskRowItem, { borderColor: currentTheme.border + "20" }]}>
                  <TouchableOpacity
                    onPress={() => toggleTaskComplete(task.id)}
                    style={[
                      styles.squareCheck,
                      {
                        borderColor: currentTheme.primary,
                        backgroundColor: "transparent"
                      }
                    ]}
                  />

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.taskRowTitle,
                        { color: task.color || currentTheme.text }
                      ]}
                    >
                      {task.title}
                    </Text>
                    {task.description ? (
                      <Text style={[styles.taskRowDesc, { color: currentTheme.secondaryText }]} numberOfLines={2}>
                        {task.description}
                      </Text>
                    ) : null}
                    <Text style={[styles.taskRowMeta, { color: currentTheme.secondaryText }]}>
                      PRIORITY: {(task.priority || (task.important ? "high" : "normal")).toUpperCase()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedTask(task);
                      setModalVisible(true);
                    }}
                    style={{ marginRight: 4 }}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={18} color={currentTheme.secondaryText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      showConfirmation(
                        `Delete "${task.title}"?`,
                        () => deleteTask(task.id),
                        () => {}
                      )
                    }
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={currentTheme.error || "#F44336"} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Inline Quick Add Typewriter Objective Row */}
            <View style={[styles.quickAddRow, { borderTopColor: currentTheme.border + "30" }]}>
              <MaterialCommunityIcons name="plus" size={16} color={currentTheme.secondaryText} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.quickAddInput, { color: currentTheme.text }]}
                placeholder="ADD OBJECTIVE..."
                placeholderTextColor={currentTheme.secondaryText + "60"}
                onSubmitEditing={(e) => {
                  handleAddQuickTask(e.nativeEvent.text);
                  e.currentTarget.clear();
                }}
                returnKeyType="done"
              />
            </View>
          </View>
        </LiquidGlassCard>

        {/* ── Completed Objectives Card ─────────────── */}
        {completedTasks.length > 0 && (
          <LiquidGlassCard theme={currentTheme} style={styles.taskQueueCard}>
            <View style={styles.taskQueueHeader}>
              <View style={[styles.sectionBadge, { backgroundColor: currentTheme.border + "30" }]}>
                <Text style={[styles.sectionBadgeText, { color: currentTheme.secondaryText }]}>COMPLETED</Text>
              </View>
              <Text style={[styles.taskQueueTitle, { color: currentTheme.secondaryText }]}>
                {completedTasks.length} OBJECTIVE{completedTasks.length !== 1 ? "S" : ""}
              </Text>
            </View>

            <View style={styles.taskListQueue}>
              {completedTasks.map((task) => (
                <View key={task.id} style={[styles.taskRowItem, { borderColor: currentTheme.border + "20" }]}>
                  <TouchableOpacity
                    onPress={() => toggleTaskComplete(task.id)}
                    style={[
                      styles.squareCheck,
                      {
                        borderColor: currentTheme.primary,
                        backgroundColor: currentTheme.primary
                      }
                    ]}
                  >
                    <MaterialCommunityIcons name="close" size={12} color={currentTheme.onPrimary} />
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.taskRowTitle,
                        {
                          color: currentTheme.secondaryText,
                          textDecorationLine: "line-through",
                          opacity: 0.6
                        }
                      ]}
                    >
                      {task.title}
                    </Text>
                    {task.description ? (
                      <Text style={[styles.taskRowDesc, { color: currentTheme.secondaryText }]} numberOfLines={1}>
                        {task.description}
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      showConfirmation(
                        `Delete "${task.title}"?`,
                        () => deleteTask(task.id),
                        () => {}
                      )
                    }
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={currentTheme.error || "#F44336"} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </LiquidGlassCard>
        )}

        {/* 4. Asymmetric Velocity & Terminal Card */}
        <LiquidGlassCard theme={currentTheme} style={styles.velocityCard}>
          <View style={[styles.velocityStatsColumn, { borderRightColor: currentTheme.border + "30" }]}>
            <Text style={[styles.velocitySticker, { color: currentTheme.secondaryText }]}>TOTAL_VELOCITY</Text>
            <Text style={[styles.velocityNumber, { color: currentTheme.text }]}>{velocity}%</Text>
            <View style={[styles.velocityProgressTrack, { backgroundColor: currentTheme.border + "20" }]}>
              <View style={[styles.velocityProgressFill, { width: `${velocity}%`, backgroundColor: currentTheme.primary }]} />
            </View>
          </View>

          <View style={styles.terminalMessageColumn}>
            <Text style={[styles.terminalLabel, { color: currentTheme.primary }]}>NETWORK_STATUS: OPTIMAL</Text>
            <View style={[styles.terminalConsole, { backgroundColor: "rgba(0,0,0,0.1)", borderColor: currentTheme.border + "20" }]}>
              <Text style={[styles.terminalText, { color: currentTheme.secondaryText }]}>
                SYSTEM_MESSAGE: Objective pipeline synced with KWEST_SYS_V1 controller.
              </Text>
            </View>
          </View>
        </LiquidGlassCard>

      </ScrollView>

      {/* Floating Action Button (FAB) to add task */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: currentTheme.primary,
            borderColor: currentTheme.text || "#000000",
          },
        ]}
        onPress={() => {
          setSelectedTask(null);
          setModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={24} color={currentTheme.onPrimary} />
      </TouchableOpacity>

      {/* Create List Modal */}
      <Modal
        isVisible={createModalVisible}
        onBackdropPress={() => setCreateModalVisible(false)}
        style={styles.modalAlign}
      >
        <View style={[styles.dialogCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
          <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>
            CREATE NEW OBJECTIVE QUEUE
          </Text>
          <CustomTextInput
            value={newListName}
            onChangeText={setNewListName}
            placeholder="Queue Label (e.g. WORK, SYSTEM)"
            theme={currentTheme}
            placeholderTextColor={currentTheme.secondaryText}
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity
              onPress={() => {
                setNewListName("");
                setCreateModalVisible(false);
              }}
              style={[styles.dialogBtn, { borderColor: currentTheme.border }]}
            >
              <Text style={[styles.dialogBtnText, { color: currentTheme.text }]}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                handleCreateList(newListName);
                setNewListName("");
                setCreateModalVisible(false);
              }}
              disabled={!newListName.trim()}
              style={[styles.dialogBtnPrimary, { backgroundColor: currentTheme.primary }]}
            >
              <Text style={[styles.dialogBtnPrimaryText, { color: currentTheme.onPrimary }]}>CREATE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename List Modal */}
      <Modal
        isVisible={renameModalVisible}
        onBackdropPress={() => setRenameModalVisible(false)}
        style={styles.modalAlign}
      >
        <View style={[styles.dialogCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
          <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>
            RENAME OBJECTIVE QUEUE
          </Text>
          <CustomTextInput
            value={renameListName}
            onChangeText={setRenameListName}
            placeholder="New Label"
            theme={currentTheme}
            placeholderTextColor={currentTheme.secondaryText}
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity
              onPress={() => {
                setRenameListName("");
                setRenameModalVisible(false);
              }}
              style={[styles.dialogBtn, { borderColor: currentTheme.border }]}
            >
              <Text style={[styles.dialogBtnText, { color: currentTheme.text }]}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                handleRenameList(selectedListId, renameListName);
                setRenameListName("");
                setRenameModalVisible(false);
              }}
              disabled={!renameListName.trim()}
              style={[styles.dialogBtnPrimary, { backgroundColor: currentTheme.primary }]}
            >
              <Text style={[styles.dialogBtnPrimaryText, { color: currentTheme.onPrimary }]}>RENAME</Text>
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
  tabBarContainer: {
    borderBottomWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    backgroundColor: "transparent",
  },
  tabBarScroll: {
    paddingVertical: 10,
    alignItems: "flex-end",
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tabButtonText: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  newListBadge: {
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 16,
  },
  newListBadgeText: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    marginLeft: 2,
  },
  contentScroll: {
    flex: 1,
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 60,
    gap: 16,
  },
  glassAi: {
    borderWidth: 2,
    padding: 16,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.3,
  },
  glassAiInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  glassAiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  glassAiTitle: {
    fontSize: 13,
    fontWeight: "950",
    fontFamily: "JetBrainsMono-Bold",
  },
  glassAiDesc: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Regular",
  },
  glassAiBtn: {
    borderWidth: 3,
    borderColor: "#000000",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  glassAiBtnText: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  projectChassis: {
    padding: 16,
    borderWidth: 2,
  },
  chassisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    paddingBottom: 8,
    marginBottom: 12,
  },
  chassisBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chassisBadgeText: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  chassisActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  taskListQueue: {
    flexDirection: "column",
    gap: 8,
  },
  emptyLabelText: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Regular",
    textAlign: "center",
    paddingVertical: 20,
    opacity: 0.6,
  },
  taskRowItem: {
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
    alignItems: "center",
    justifyContent: "center",
  },
  taskRowTitle: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "JetBrainsMono-Bold",
  },
  taskRowDesc: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Regular",
    marginTop: 4,
    opacity: 0.9,
  },
  taskRowMeta: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Regular",
    marginTop: 2,
    opacity: 0.8,
  },
  quickAddRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
  },
  quickAddInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    padding: 0,
  },
  velocityCard: {
    borderWidth: 2,
    flexDirection: "row",
    padding: 0,
    overflow: "hidden",
  },
  velocityStatsColumn: {
    flex: 1,
    padding: 16,
    borderRightWidth: 1.5,
    justifyContent: "center",
  },
  velocitySticker: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Bold",
    marginBottom: 4,
  },
  velocityNumber: {
    fontSize: 32,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    marginBottom: 6,
  },
  velocityProgressTrack: {
    height: 6,
    overflow: "hidden",
  },
  velocityProgressFill: {
    height: "100%",
  },
  terminalMessageColumn: {
    flex: 1.5,
    padding: 16,
    justifyContent: "center",
  },
  terminalLabel: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    marginBottom: 6,
  },
  terminalConsole: {
    borderWidth: 1,
    padding: 8,
  },
  terminalText: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Regular",
    lineHeight: 14,
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
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  sectionBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: 1,
  },
});
