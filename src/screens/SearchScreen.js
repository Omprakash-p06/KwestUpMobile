import React from "react";
import { ScrollView, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomCard } from "../components/CustomCard";
import { TaskCard } from "../components/TaskCard";
import { styles } from "../theme/styles";

export const SearchScreen = ({
  currentTheme,
  setSelectedTask,
  setModalVisible,
  dailyTasks,
  birthdays,
  tasks,
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
    <ScrollView style={styles.tabContentScroll}>
      <View style={styles.tabContent}>
        <CustomTextInput
          label="Search all tasks and birthdays"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          placeholderTextColor={currentTheme.secondaryText}
          icon="magnify"
          theme={currentTheme}
        />

        {!hasResults && searchQuery.length > 0 ? (
          <CustomCard style={{ backgroundColor: currentTheme.cardBackground, alignItems: "center" }} theme={currentTheme}>
            <MaterialCommunityIcons name="magnify-minus-outline" size={60} color={currentTheme.secondaryText} />
            <Text style={[styles.emptyListText, { color: currentTheme.secondaryText }]}>
              No results found for &ldquo;{searchQuery}&rdquo;.
            </Text>
          </CustomCard>
        ) : (
          <>
            {filteredTasks.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: currentTheme.primary, marginTop: 20 }]}>
                  General Tasks
                </Text>
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
              </>
            )}
            {filteredDailyTasks.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: currentTheme.primary, marginTop: 20 }]}>Daily Tasks</Text>
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
              </>
            )}
            {filteredBirthdays.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: currentTheme.primary, marginTop: 20 }]}>Birthdays</Text>
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
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
};
