import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TaskCard } from "../components/TaskCard";
import { styles } from "../theme/styles";

export const TaskListScreen = ({
  tasks,
  setTasks,
  handleCompleteTask,
  toggleTaskComplete,
  deleteTask,
  handleToggleSubtask,
  currentTheme,
  setSelectedTask,
  setModalVisible
}) => {
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  return (
    <View style={[styles.screen, { backgroundColor: currentTheme.background }]}>
      <Text style={[styles.screenTitle, { color: currentTheme.text }]}>Your Tasks</Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
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
            <Text style={[styles.emptyStateText, { color: currentTheme.secondaryText }]}>No active tasks. Good job!</Text>
          </View>
        )}

        {completedTasks.length > 0 && (
          <>
            <View style={styles.completedDivider}>
              <View style={[styles.dividerLine, { backgroundColor: currentTheme.border }]} />
              <Text style={[styles.completedTitle, { color: currentTheme.secondaryText }]}>Completed</Text>
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

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: currentTheme.primary }]}
        onPress={() => {
          setSelectedTask(null);
          setModalVisible(true);
        }}
      >
        <MaterialCommunityIcons name="plus" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};
