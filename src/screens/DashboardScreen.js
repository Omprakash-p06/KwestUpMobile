import React, { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { injectFontFamily } from "../theme/styles";

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
      const date = t.completedDate || t.completedAt || t.updatedAt;
      if (!date) return false;
      return new Date(date).toDateString() === dayStr;
    }).length;
  });

  const max = Math.max(...counts, 1);
  const total = counts.reduce((s, c) => s + c, 0);

  // Streak: count trailing days (today backwards) with at least 1 completion
  let streak = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    if (counts[i] > 0) streak++;
    else break;
  }

  const activeDays = counts.filter((c) => c > 0).length;
  const completionRate = Math.round((activeDays / DAYS) * 100);

  return { labels: buckets.map((b) => dayLabels[new Date(b).getDay()]), counts, max, total, streak, completionRate };
};

const computeBirthdayDaysRemaining = (bday) => {
  const dateStr = bday.birthDate || bday.date || "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dateStr.split("-");
  let month = 0, day = 1;
  if (parts.length === 3) {
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    month = parseInt(parts[0], 10) - 1;
    day = parseInt(parts[1], 10);
  } else return { ...bday, daysRemaining: 999 };

  const currentYear = today.getFullYear();
  let nextBday = new Date(currentYear, month, day);
  if (nextBday.getMonth() !== month) nextBday = new Date(currentYear, month, day + 1);
  if (nextBday < today) {
    nextBday = new Date(currentYear + 1, month, day);
    if (nextBday.getMonth() !== month) nextBday = new Date(currentYear + 1, month, day + 1);
  }
  const diffDays = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { ...bday, daysRemaining: diffDays };
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

  // Force a re-render each time the Dashboard screen is focused so
  // unticking/ticking tasks from other screens always reflects here.
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusTick((t) => t + 1);
    }, [])
  );

  const priorityTasks = useMemo(
    () => tasks.filter(t => !t.completed).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, focusTick]
  );

  const enrichedBirthdays = useMemo(
    () => [...birthdays].map(computeBirthdayDaysRemaining).sort((a, b) => a.daysRemaining - b.daysRemaining),
    [birthdays]
  );

  const upcomingBirthdays = useMemo(
    () => enrichedBirthdays.filter(b => b.daysRemaining <= 30).slice(0, 5),
    [enrichedBirthdays]
  );

  // Recompute chart data on every tasks change OR when screen re-focuses
  const { labels, counts, max, total, streak, completionRate } = useMemo(
    () => getDailyCompletions(tasks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, focusTick]
  );

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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                      <Text style={[styles.taskItemMeta, { color: currentTheme.secondaryText, marginTop: 0 }]}>
                        {task.dueDate ? `DUE: ${new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}` : "LOGGED IN QUEUE"}
                      </Text>
                      {task.recurrence && task.recurrence !== "none" && (
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: currentTheme.primary + "15", paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: currentTheme.primary + "20" }}>
                          <MaterialCommunityIcons name="sync" size={8} color={currentTheme.primary} style={{ marginRight: 2 }} />
                          <Text style={{ fontSize: 8, fontFamily: "JetBrainsMono-Bold", color: currentTheme.primary, letterSpacing: 0.5 }}>
                            {task.recurrence.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
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

        {/* 2. Consistency Metrics */}
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

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderColor: currentTheme.primary + "40", backgroundColor: currentTheme.primary + "10" }]}>
              <Text style={[styles.statValue, { color: currentTheme.primary }]}>{streak}</Text>
              <Text style={[styles.statLabel, { color: currentTheme.secondaryText }]}>DAY{`\n`}STREAK</Text>
            </View>
            <View style={[styles.statBox, { borderColor: currentTheme.border + "40", backgroundColor: currentTheme.surface }]}>
              <Text style={[styles.statValue, { color: currentTheme.text }]}>{total}</Text>
              <Text style={[styles.statLabel, { color: currentTheme.secondaryText }]}>TOTAL{`\n`}DONE</Text>
            </View>
            <View style={[styles.statBox, { borderColor: currentTheme.border + "40", backgroundColor: currentTheme.surface }]}>
              <Text style={[styles.statValue, { color: completionRate >= 70 ? currentTheme.primary : currentTheme.secondaryText }]}>{completionRate}%</Text>
              <Text style={[styles.statLabel, { color: currentTheme.secondaryText }]}>ACTIVE{`\n`}RATE</Text>
            </View>
          </View>

          {/* Bar chart */}
          <View style={styles.graphContainer}>
            {counts.map((count, idx) => {
              const barHeight = (count / max) * 100;
              const isToday = idx === counts.length - 1;
              return (
                <View key={idx} style={styles.graphCol}>
                  <Text style={[styles.graphBarLabel, { color: isToday ? currentTheme.primary : currentTheme.secondaryText }]}>
                    {count > 0 ? count : ""}
                  </Text>
                  <View style={[styles.graphBarWrapper, { borderColor: isToday ? currentTheme.primary + "60" : currentTheme.border + "40" }]}>
                    <View
                      style={[
                        styles.graphBar,
                        {
                          height: `${Math.max(barHeight, count > 0 ? 8 : 4)}%`,
                          backgroundColor: isToday ? currentTheme.primary : count > 0 ? currentTheme.primary + "80" : currentTheme.border + "30",
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.graphDayLabel, { color: isToday ? currentTheme.primary : currentTheme.secondaryText, fontWeight: isToday ? "900" : "normal" }]}>
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

const rawStyles = {
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
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 8,
    fontFamily: "JetBrainsMono-Regular",
    textAlign: "center",
    marginTop: 2,
    letterSpacing: 0.5,
  },
};

injectFontFamily(rawStyles);
const styles = StyleSheet.create(rawStyles);
