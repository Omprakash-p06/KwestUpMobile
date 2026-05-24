import React, { useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Modal from "react-native-modal";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CustomCard } from "../components/CustomCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomButton } from "../components/CustomButton";
import { TaskCard } from "../components/TaskCard";
import { scheduleDailyTaskNotification, cancelDueDateNotification } from "../utils/notifications";
import { styles } from "../theme/styles";

export const DailyTasksScreen = ({
  currentTheme,
  setSelectedTask,
  setModalVisible,
  dailyTasks,
  setDailyTasks,
  showConfirmation
}) => {
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState("time");
  const [pickerTarget, setPickerTarget] = useState("daily");
  const today = new Date().toISOString().slice(0, 10);

  const addDailyTask = () => {
    if (newTaskName.trim()) {
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
      console.log("✅ Daily task added:", newDailyTask.name);
    }
  };

  const toggleDailyTaskComplete = (id) => {
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
    console.log("✅ Daily task toggled:", id);
  };

  const deleteDailyTask = (id) => {
    showConfirmation(
      "Are you sure you want to delete this daily task?",
      () => {
        setDailyTasks(dailyTasks => {
          const taskToDelete = dailyTasks.find(t => t.id === id);
          if (taskToDelete && taskToDelete.notificationId) {
            cancelDueDateNotification(taskToDelete.notificationId);
          }
          return dailyTasks.filter((task) => task.id !== id);
        });
        console.log("🗑️ Daily task deleted:", id);
      },
      () => {},
    );
  };

  return (
    <ScrollView style={styles.tabContentScroll}>
      <View style={styles.tabContent}>
        <CustomCard style={{ backgroundColor: currentTheme.cardBackground }} theme={currentTheme}>
          <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>Add New Daily Task</Text>
          <View style={styles.inputRow}>
            <CustomTextInput
              label="Task Name"
              value={newTaskName}
              onChangeText={setNewTaskName}
              style={styles.textInputFlex}
              onSubmitEditing={addDailyTask}
              placeholderTextColor={currentTheme.secondaryText}
              theme={currentTheme}
            />
            <CustomButton
              title={newTaskTime || "Time"}
              icon="clock"
              onPress={() => {
                setPickerMode("time");
                setPickerTarget("daily");
                setShowTimePicker(true);
              }}
              outline
              color={currentTheme.primary}
              style={styles.textInputTimeButton}
            />
          </View>
          <CustomButton
            title="Add Daily Task"
            icon="plus"
            onPress={addDailyTask}
            color={currentTheme.primary}
            style={styles.fullWidthButton}
          />
        </CustomCard>

        {dailyTasks.length === 0 ? (
          <CustomCard style={{ backgroundColor: currentTheme.cardBackground, alignItems: "center" }} theme={currentTheme}>
            <MaterialCommunityIcons name="bell-outline" size={60} color={currentTheme.secondaryText} />
            <Text style={[styles.emptyListText, { color: currentTheme.secondaryText }]}>No daily tasks added yet. Start by adding one!</Text>
          </CustomCard>
        ) : (
          <>
            {/* Incomplete Tasks */}
            {dailyTasks.filter(t => !t.completed).length > 0 && (
              dailyTasks.filter(t => !t.completed).map((task) => (
                <TaskCard
                  key={task.id}
                  task={{ ...task, title: task.name }}
                  onComplete={() => toggleDailyTaskComplete(task.id)}
                  onUncomplete={() => toggleDailyTaskComplete(task.id)}
                  onDelete={deleteDailyTask}
                  theme={currentTheme}
                  accent={currentTheme.primary}
                />
              ))
            )}
            {/* Completed Divider and Tasks */}
            {dailyTasks.filter(t => t.completed).length > 0 && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
                  <View style={[styles.dividerLine, { backgroundColor: currentTheme.border }]} />
                  <Text style={[styles.completedTitle, { color: currentTheme.secondaryText }]}>Completed</Text>
                  <View style={[styles.dividerLine, { backgroundColor: currentTheme.border }]} />
                </View>
                {dailyTasks.filter(t => t.completed).map((task) => (
                  <View key={task.id} style={{ opacity: 0.7 }}>
                    <TaskCard
                      task={{ ...task, title: task.name }}
                      onComplete={() => toggleDailyTaskComplete(task.id)}
                      onUncomplete={() => toggleDailyTaskComplete(task.id)}
                      onDelete={deleteDailyTask}
                      theme={currentTheme}
                      accent={currentTheme.primary}
                    />
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </View>

      <Modal isVisible={showTimePicker && pickerTarget === "daily"} onBackdropPress={() => setShowTimePicker(false)}>
        <DateTimePicker
          value={new Date()}
          mode="time"
          is24Hour={true}
          display="spinner"
          onChange={(event, selectedDate) => {
            if (event.type === 'set' && selectedDate) {
              const hours = selectedDate.getHours().toString().padStart(2, "0");
              const minutes = selectedDate.getMinutes().toString().padStart(2, "0");
              setNewTaskTime(`${hours}:${minutes}`);
              setShowTimePicker(false);
            } else if (event.type === 'dismissed') {
              setShowTimePicker(false);
            }
          }}
        />
      </Modal>
    </ScrollView>
  );
};
