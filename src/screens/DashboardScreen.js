import React, { useCallback } from "react";
import { ScrollView, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CustomCard } from "../components/CustomCard";
import { TaskCard } from "../components/TaskCard";
import { CustomBadge } from "../components/CustomBadge";
import { styles } from "../theme/styles";

export const DashboardScreen = ({
  tasks,
  currentTheme,
  handleCompleteTask,
  setSelectedTask,
  setModalVisible,
  toggleTaskComplete,
  deleteTask,
  setTasks
}) => {
  // Function to get weekly task statistics
  const getWeeklyTaskStats = useCallback(() => {
    console.log("📊 Generating weekly stats for tasks:", tasks.length, "total tasks");
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Get date 6 days ago for a 7-day window

    const dailyStats = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      const dateString = date.toISOString().slice(0, 10);
      const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" }).charAt(0);
      dailyStats[dateString] = {
        date: dateString,
        completed: 0,
        label: dayLabel,
      };
    }

    // Count completed tasks for each day
    tasks.forEach((task) => {
      if (task.completed && task.completedAt) {
        const taskDate = new Date(task.completedAt);
        const dateString = taskDate.toISOString().slice(0, 10);
        
        if (dailyStats[dateString]) {
          dailyStats[dateString].completed++;
        }
      } else if (task.completed && task.completedDate) {
        const dateString = task.completedDate;
        if (dailyStats[dateString]) {
          dailyStats[dateString].completed++;
        }
      }
    });

    return Object.values(dailyStats);
  }, [tasks]);

  const weeklyStatsData = getWeeklyTaskStats();

  const handleToggleSubtask = (taskId, subtaskIdx) => {
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        const newSubtasks = task.subtasks.map((st, idx) => idx === subtaskIdx ? { ...st, completed: !st.completed } : st);
        return { ...task, subtasks: newSubtasks };
      }
      return task;
    }));
  };

  return (
    <ScrollView style={styles.tabContentScroll}>
      <View style={styles.tabContent}>
        <Text style={[styles.dashboardSectionTitle, { color: currentTheme.text }]}>Your Tasks</Text>
        {tasks.filter(t => !t.completed).length === 0 ? (
          <CustomCard style={{ backgroundColor: currentTheme.cardBackground, alignItems: "center" }} theme={currentTheme}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={60} color={currentTheme.secondaryText} />
            <Text style={[styles.emptyListText, { color: currentTheme.secondaryText }]}>
              No active tasks. Start by adding one!
            </Text>
          </CustomCard>
        ) : (
          tasks.filter(t => !t.completed).map((task) => (
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
        )}

        <Text style={[styles.dashboardSectionTitle, { color: currentTheme.text, marginTop: 20 }]}>
          Task Statistics
        </Text>
        <CustomCard style={{ backgroundColor: currentTheme.cardBackground }}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Weekly Activity</Text>
            <CustomBadge
              text={`${tasks.filter((t) => t.completed).length} Completed`}
              backgroundColor={currentTheme.primary}
              textColor="#FFFFFF"
            />
          </View>
          <View style={styles.chartPlaceholder}>
            <View style={styles.chartBarsContainer}>
              {weeklyStatsData.map((data, index) => (
                <View key={index} style={styles.chartColumn}>
                  <View
                    style={[styles.chartBar, { 
                      height: Math.max(data.completed * 5, 2),
                      backgroundColor: currentTheme.primary,
                      minHeight: 2
                    }]}
                  />
                  <Text style={[styles.chartLabel, { color: currentTheme.secondaryText }]}>{data.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: currentTheme.primary }]} />
                <Text style={[styles.legendText, { color: currentTheme.secondaryText }]}>Completed</Text>
              </View>
            </View>
            {weeklyStatsData.every(d => d.completed === 0) && (
              <Text style={[styles.emptyListText, { color: currentTheme.secondaryText, marginTop: 10 }]}>
                No completed tasks this week. Start completing some tasks!
              </Text>
            )}
          </View>
        </CustomCard>

        <View style={styles.bottomSummaryGrid}>
          <CustomCard style={[styles.bottomSummaryCard, { backgroundColor: currentTheme.cardBackground }]}>
            <Text style={[styles.bottomSummaryTitle, { color: currentTheme.text }]}>Total Completed Tasks</Text>
            <Text style={[styles.bottomSummaryValue, { color: currentTheme.text }]}>
              {tasks.filter((t) => t.completed).length} Tasks
            </Text>
          </CustomCard>
          <CustomCard style={[styles.bottomSummaryCard, { backgroundColor: currentTheme.cardBackground }]}>
            <Text style={[styles.bottomSummaryTitle, { color: currentTheme.text }]}>Total Incomplete Tasks</Text>
            <Text style={[styles.bottomSummaryValue, { color: currentTheme.text }]}>
              {tasks.filter((t) => !t.completed).length} Tasks
            </Text>
          </CustomCard>
        </View>
      </View>
    </ScrollView>
  );
};
