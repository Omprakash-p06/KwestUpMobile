import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions, Modal, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TaskCard } from "../components/TaskCard";
import { CustomButton } from "../components/CustomButton";
import { CustomTextInput } from "../components/CustomTextInput";

export const TaskListScreen = ({
  tasks,
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(Dimensions.get("window").width);

  // List CRUD Modals state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newListName, setNewListName] = useState("");

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameListName, setRenameListName] = useState("");
  const [selectedListId, setSelectedListId] = useState("");

  const scrollViewRef = useRef(null);

  // Safeguard index if lists are deleted
  useEffect(() => {
    if (activeIndex >= taskLists.length && taskLists.length > 0) {
      const nextIdx = taskLists.length - 1;
      setActiveIndex(nextIdx);
      scrollViewRef.current?.scrollTo({ x: nextIdx * containerWidth, animated: false });
    }
  }, [taskLists, activeIndex, containerWidth]);

  const handleTabPress = (index) => {
    setActiveIndex(index);
    scrollViewRef.current?.scrollTo({ x: index * containerWidth, animated: true });
  };

  const handleScroll = (event) => {
    const xOffset = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(xOffset / containerWidth);
    if (nextIndex !== activeIndex && nextIndex >= 0 && nextIndex < taskLists.length) {
      setActiveIndex(nextIndex);
    }
  };

  const activeList = taskLists[activeIndex] || taskLists[0] || { id: "default_inbox", name: "My Tasks" };

  return (
    <View
      style={{ flex: 1, backgroundColor: "transparent" }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* 1. Header & List Controls */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{
            fontSize: 24,
            fontWeight: "800",
            color: currentTheme.text,
            marginRight: 10,
          }}>
            {activeList.name}
          </Text>
          {activeList.id !== "default_inbox" && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedListId(activeList.id);
                  setRenameListName(activeList.name);
                  setRenameModalVisible(true);
                }}
                style={{ padding: 4, marginRight: 4 }}
              >
                <MaterialCommunityIcons name="pencil-outline" size={20} color={currentTheme.secondaryText} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  handleDeleteList(activeList.id);
                }}
                style={{ padding: 4 }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={currentTheme.error || "#F44336"} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setCreateModalVisible(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: currentTheme.primary + "16",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
          }}
        >
          <MaterialCommunityIcons name="plus" size={18} color={currentTheme.primary} style={{ marginRight: 2 }} />
          <Text style={{ color: currentTheme.primary, fontWeight: "700", fontSize: 13 }}>New List</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Top Navigation Tabs */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: currentTheme.border || "#E5EAF1" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
        >
          {taskLists.map((list, index) => {
            const isActive = index === activeIndex;
            return (
              <TouchableOpacity
                key={list.id}
                onPress={() => handleTabPress(index)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 18,
                  backgroundColor: isActive ? currentTheme.primary : "transparent",
                  marginRight: 8,
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  color: isActive ? "#FFFFFF" : currentTheme.secondaryText,
                  fontWeight: isActive ? "800" : "600",
                  fontSize: 13,
                }}>
                  {list.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Horizontal Paging Sheets */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {taskLists.map((list) => {
          const listTasks = tasks.filter((t) => (t.listId || "default_inbox") === list.id);
          const activeTasks = listTasks.filter((t) => !t.completed);
          const completedTasks = listTasks
            .filter((t) => t.completed)
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

          return (
            <View key={list.id} style={{ width: containerWidth, flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 }}
                keyboardShouldPersistTaps="handled"
              >
                {activeTasks.length > 0 ? (
                  activeTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onPress={() => {
                        setSelectedTask(task);
                        setModalVisible(true);
                      }}
                      onComplete={() => handleCompleteTask(task.id)}
                      onUncomplete={() => toggleTaskComplete(task.id)}
                      onDelete={deleteTask}
                      theme={currentTheme}
                      accent={task.color || currentTheme.primary}
                      onToggleSubtask={handleToggleSubtask}
                    />
                  ))
                ) : (
                  <View style={styles.emptyStateContainer}>
                    <Text style={{ color: currentTheme.secondaryText, fontWeight: "600", textAlign: "center", marginTop: 40 }}>
                      No active tasks in this list. Good job!
                    </Text>
                  </View>
                )}

                {completedTasks.length > 0 && (
                  <>
                    <View style={styles.completedDivider}>
                      <View style={[styles.dividerLine, { backgroundColor: currentTheme.border }]} />
                      <Text style={{ color: currentTheme.secondaryText, fontSize: 13, fontWeight: "600", marginHorizontal: 8 }}>
                        Completed
                      </Text>
                      <View style={[styles.dividerLine, { backgroundColor: currentTheme.border }]} />
                    </View>

                    {completedTasks.map((task) => (
                      <View key={task.id} style={{ opacity: 0.7 }}>
                        <TaskCard
                          task={task}
                          theme={currentTheme}
                          accent={task.color || currentTheme.secondaryText}
                          onDelete={deleteTask}
                          onUncomplete={() => toggleTaskComplete(task.id)}
                          onToggleSubtask={handleToggleSubtask}
                        />
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* 4. Floating Action Button to Add Task */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: currentTheme.primary,
            position: "absolute",
            bottom: 30,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8,
          },
        ]}
        onPress={() => {
          setSelectedTask({ listId: activeList.id });
          setModalVisible(true);
        }}
      >
        <MaterialCommunityIcons name="plus" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 5. Create List Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: currentTheme.cardBackground }]}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: currentTheme.text, marginBottom: 12 }}>
              Create New Task List
            </Text>
            <CustomTextInput
              value={newListName}
              onChangeText={setNewListName}
              placeholder="List name (e.g. Work, Shopping)"
              theme={currentTheme}
              placeholderTextColor={currentTheme.secondaryText}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 16 }}>
              <CustomButton
                title="Cancel"
                outline
                color={currentTheme.primary}
                onPress={() => {
                  setNewListName("");
                  setCreateModalVisible(false);
                }}
                style={{ marginRight: 8 }}
              />
              <CustomButton
                title="Create"
                color={currentTheme.primary}
                disabled={!newListName.trim()}
                onPress={() => {
                  handleCreateList(newListName);
                  setNewListName("");
                  setCreateModalVisible(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. Rename List Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: currentTheme.cardBackground }]}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: currentTheme.text, marginBottom: 12 }}>
              Rename Task List
            </Text>
            <CustomTextInput
              value={renameListName}
              onChangeText={setRenameListName}
              placeholder="New list name"
              theme={currentTheme}
              placeholderTextColor={currentTheme.secondaryText}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 16 }}>
              <CustomButton
                title="Cancel"
                outline
                color={currentTheme.primary}
                onPress={() => {
                  setRenameListName("");
                  setRenameModalVisible(false);
                }}
                style={{ marginRight: 8 }}
              />
              <CustomButton
                title="Rename"
                color={currentTheme.primary}
                disabled={!renameListName.trim()}
                onPress={() => {
                  handleRenameList(selectedListId, renameListName);
                  setRenameListName("");
                  setRenameModalVisible(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  completedDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    opacity: 0.5,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "85%",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
