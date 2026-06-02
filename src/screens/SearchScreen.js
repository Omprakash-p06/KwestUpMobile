import React from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { TaskCard } from "../components/TaskCard";

export const SearchScreen = ({
  currentTheme,
  setSelectedTask,
  setModalVisible,
  dailyTasks = [],
  birthdays = [],
  tasks = [],
  searchQuery,
  setSearchQuery,
  handleCompleteTask,
  toggleTaskComplete,
  deleteTask
}) => {
  const filteredDailyTasks = dailyTasks.filter((task) => task.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredBirthdays = birthdays.filter((bday) => bday.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredTasks = tasks.filter((task) => (task.title || task.name).toLowerCase().includes(searchQuery.toLowerCase()));

  const hasResults = filteredDailyTasks.length > 0 || filteredBirthdays.length > 0 || filteredTasks.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollPadding}>
      
      {/* Page Header */}
      <View style={styles.headerSection}>
        <View style={[styles.badge, { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }]}>
          <Text style={[styles.badgeText, { color: currentTheme.onPrimary }]}>
            SEARCH_QUERY_SYS
          </Text>
        </View>
        <Text style={[styles.title, { color: currentTheme.text }]}>DATABASE SEARCH</Text>
      </View>

      {/* Etched Terminal Input field */}
      <View style={styles.inputWrapper}>
        <CustomTextInput
          label="QUERY PHRASE:"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          placeholder="SEARCH OBJECTIVES AND ANNIVERSARIES..."
          placeholderTextColor={currentTheme.secondaryText + "70"}
          icon="magnify"
          theme={currentTheme}
        />
      </View>

      {!hasResults && searchQuery.length > 0 ? (
        <LiquidGlassCard theme={currentTheme} style={styles.emptyCard}>
          <MaterialCommunityIcons name="magnify-minus-outline" size={48} color={currentTheme.secondaryText} style={{ marginBottom: 8 }} />
          <Text style={[styles.emptyText, { color: currentTheme.secondaryText }]}>
            NO SYSTEM MATCHES FOUND FOR: "{searchQuery.toUpperCase()}"
          </Text>
        </LiquidGlassCard>
      ) : (
        <View style={styles.resultsStack}>
          
          {/* 1. General Tasks Results */}
          {filteredTasks.length > 0 && (
            <View style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <MaterialCommunityIcons name="format-list-bulleted" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.categoryTitle, { color: currentTheme.text }]}>TASK_QUEUE_MATCHES</Text>
              </View>
              <View style={styles.cardList}>
                {filteredTasks.map((task) => (
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
                    accent={currentTheme.primary}
                  />
                ))}
              </View>
            </View>
          )}

          {/* 2. Daily Tasks Results */}
          {filteredDailyTasks.length > 0 && (
            <View style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <MaterialCommunityIcons name="calendar-clock" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.categoryTitle, { color: currentTheme.text }]}>DAILY_OBJECTIVE_MATCHES</Text>
              </View>
              <View style={styles.cardList}>
                {filteredDailyTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={{ ...task, title: task.name }}
                    onComplete={() => {}}
                    onUncomplete={() => toggleTaskComplete(task.id)}
                    onDelete={deleteTask}
                    theme={currentTheme}
                    accent={currentTheme.primary}
                  />
                ))}
              </View>
            </View>
          )}

          {/* 3. Birthdays Results */}
          {filteredBirthdays.length > 0 && (
            <View style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <MaterialCommunityIcons name="cake-variant" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.categoryTitle, { color: currentTheme.text }]}>ANNIVERSARY_MATCHES</Text>
              </View>
              <View style={styles.cardList}>
                {filteredBirthdays.map((bday) => (
                  <TaskCard
                    key={bday.id}
                    task={{ ...bday, title: bday.name }}
                    onComplete={() => {}}
                    onUncomplete={() => toggleTaskComplete(bday.id)}
                    onDelete={deleteTask}
                    theme={currentTheme}
                    accent={currentTheme.primary}
                  />
                ))}
              </View>
            </View>
          )}

        </View>
      )}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 60,
    gap: 16,
  },
  headerSection: {
    marginBottom: 8,
  },
  badge: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    fontFamily: "JetBrainsMono-Bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "JetBrainsMono-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    marginBottom: 8,
  },
  searchInput: {
    borderRadius: 0,
  },
  emptyCard: {
    padding: 30,
    alignItems: "center",
    borderWidth: 2,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Regular",
    textAlign: "center",
  },
  resultsStack: {
    flexDirection: "column",
    gap: 20,
  },
  categoryBlock: {
    flexDirection: "column",
    gap: 8,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    paddingBottom: 6,
    marginBottom: 4,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
  },
  cardList: {
    flexDirection: "column",
    gap: 2,
  },
});
