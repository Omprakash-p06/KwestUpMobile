import React, { useCallback, useEffect, useRef } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { LiquidGlassCard } from "../components/LiquidGlassCard";

const DAYS = 7;
const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

const getDailyCompletions = (tasks) => {
  const now = new Date();
  const buckets = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    return d.toDateString();
  }).reverse();

  const counts = buckets.map((dayStr) => {
    return tasks.filter((t) => {
      if (!t.completed) return false;
      const date = t.completedAt || t.updatedAt;
      if (!date) return false;
      return new Date(date).toDateString() === dayStr;
    }).length;
  });

  const max = Math.max(...counts, 1);
  return { labels: buckets.map((b) => dayLabels[new Date(b).getDay()]), counts, max };
};

export const DashboardScreen = ({
  tasks = [],
  notes = [],
  birthdays = [],
  currentTheme,
  setSelectedTask,
  setModalVisible,
  toggleTaskComplete,
}) => {
  const navigation = useNavigation();

  const priorityTasks = tasks.filter(t => !t.completed).slice(0, 5);

  const upcomingBirthdays = [...birthdays]
    .filter(b => b.daysRemaining !== undefined && b.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 5);

  const { labels, counts, max } = getDailyCompletions(tasks);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.gridStack}>

        {/* 1. Upcoming Tasks (Priority Queue) */}
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
                    onPress={() => toggleTaskComplete(task.id)}
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

        {/* 2. Consistency Graph */}
        <LiquidGlassCard theme={currentTheme} style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listTitleContainer}>
              <MaterialCommunityIcons name="chart-bar" size={18} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.listCardTitle, { color: currentTheme.text }]}>CONSISTENCY_METRICS</Text>
            </View>
            <Text style={[styles.listCardSticker, { color: currentTheme.secondaryText }]}>
              {DAYS}-DAY TREND
            </Text>
          </View>

          <View style={styles.graphContainer}>
            {counts.map((count, idx) => {
              const barHeight = (count / max) * 100;
              return (
                <View key={idx} style={styles.graphCol}>
                  <Text style={[styles.graphBarLabel, { color: currentTheme.secondaryText }]}>
                    {count}
                  </Text>
                  <View style={[styles.graphBarWrapper, { borderColor: currentTheme.border + "40" }]}>
                    <View
                      style={[
                        styles.graphBar,
                        {
                          height: `${Math.max(barHeight, 4)}%`,
                          backgroundColor: currentTheme.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.graphDayLabel, { color: currentTheme.secondaryText }]}>
                    {labels[idx]}
                  </Text>
                </View>
              );
            })}
          </View>
        </LiquidGlassCard>

        {/* 3. Upcoming Birthdays */}
        <LiquidGlassCard theme={currentTheme} style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <View style={styles.listTitleContainer}>
              <MaterialCommunityIcons name="cake-variant" size={18} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.listCardTitle, { color: currentTheme.text }]}>BIRTHDAY_LOG</Text>
            </View>
            <Text style={[styles.listCardSticker, { color: currentTheme.secondaryText }]}>
              {upcomingBirthdays.length} UPCOMING
            </Text>
          </View>

          <View style={styles.taskQueue}>
            {upcomingBirthdays.length === 0 ? (
              <Text style={[styles.emptyListLabel, { color: currentTheme.secondaryText }]}>
                NO BIRTHDAYS LOGGED IN SYSTEMS
              </Text>
            ) : (
              upcomingBirthdays.map((bday) => (
                <View key={bday.id} style={[styles.taskItemRow, { borderColor: currentTheme.border + "30" }]}>
                  <MaterialCommunityIcons name="cake-variant" size={18} color={currentTheme.primary} style={{ marginRight: 6 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskItemText, { color: currentTheme.text }]} numberOfLines={1}>
                      {bday.name}
                    </Text>
                    <Text style={[styles.taskItemMeta, { color: currentTheme.secondaryText }]}>
                      {bday.birthDate || bday.date}
                    </Text>
                  </View>
                  <View style={[styles.badgeSmall, { backgroundColor: bday.daysRemaining === 0 ? currentTheme.error + "22" : currentTheme.primary + "18", borderColor: bday.daysRemaining === 0 ? currentTheme.error : currentTheme.primary }]}>
                    <Text style={[styles.badgeSmallText, { color: bday.daysRemaining === 0 ? currentTheme.error : currentTheme.primary }]}>
                      {bday.daysRemaining === 0 ? "TODAY" : `${bday.daysRemaining}D`}
                    </Text>
                  </View>
                </View>
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
    fontFamily: "JetBrainsMono-Bold",
  },
  taskItemMeta: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Regular",
    marginTop: 2,
    opacity: 0.8,
  },
  graphContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 140,
    paddingTop: 16,
  },
  graphCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  graphBarLabel: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Bold",
    marginBottom: 4,
  },
  graphBarWrapper: {
    width: 24,
    flex: 1,
    justifyContent: "flex-end",
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: 90,
  },
  graphBar: {
    width: "100%",
  },
  graphDayLabel: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Bold",
    marginTop: 4,
  },
  badgeSmall: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeSmallText: {
    fontSize: 9,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
});
