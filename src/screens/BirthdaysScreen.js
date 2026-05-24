import React, { useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Modal from "react-native-modal";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";
import { CustomCard } from "../components/CustomCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomButton } from "../components/CustomButton";
import { TaskCard } from "../components/TaskCard";
import { styles } from "../theme/styles";

export const BirthdaysScreen = ({
  currentTheme,
  setSelectedTask,
  setModalVisible,
  birthdays,
  setBirthdays,
  showConfirmation,
  setConfettiVisible
}) => {
  const [newBirthdayName, setNewBirthdayName] = useState("");
  const [newBirthdayDate, setNewBirthdayDate] = useState("");
  const [showBirthdayDatePicker, setShowBirthdayDatePicker] = useState(false);

  const addBirthday = () => {
    if (newBirthdayName.trim() && newBirthdayDate) {
      const [month, day] = newBirthdayDate.split("-");
      const newBday = { id: Date.now(), name: newBirthdayName.trim(), date: `${month}-${day}` };
      setBirthdays((prev) => [...prev, newBday]);
      setNewBirthdayName("");
      setNewBirthdayDate("");
      console.log("🎂 Birthday added:", newBday.name);
    }
  };

  const deleteBirthday = (id) => {
    showConfirmation(
      "Are you sure you want to delete this birthday?",
      () => {
        setBirthdays((prev) => prev.filter((b) => b.id !== id));
        console.log("🗑️ Birthday deleted:", id);
      },
      () => {},
    );
  };

  const celebrateBirthday = (id) => {
    const birthday = birthdays.find((b) => b.id === id);
    showConfirmation(`Happy Birthday to ${birthday.name}!`, () => {
      setConfettiVisible(true);
      console.log("🎉 Birthday celebrated:", birthday.name);
    });
  };

  return (
    <>
      <ScrollView style={styles.tabContentScroll}>
        <View style={styles.tabContent}>
          <CustomCard style={{ backgroundColor: currentTheme.cardBackground }} theme={currentTheme}>
            <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>Add New Birthday</Text>
            <View style={styles.inputRow}>
              <CustomTextInput
                label="Person's Name"
                value={newBirthdayName}
                onChangeText={setNewBirthdayName}
                style={styles.textInputFlex}
                placeholderTextColor={currentTheme.secondaryText}
                theme={currentTheme}
              />
              <CustomButton
                title={newBirthdayDate || "MM-DD"}
                icon="calendar"
                onPress={() => setShowBirthdayDatePicker(true)}
                outline
                color={currentTheme.primary}
                style={styles.textInputDateButton}
              />
            </View>
            <CustomButton
              title="Add Birthday"
              icon="plus"
              onPress={addBirthday}
              color={currentTheme.primary}
              style={styles.fullWidthButton}
            />
          </CustomCard>

          {birthdays.length === 0 ? (
            <CustomCard style={{ backgroundColor: currentTheme.cardBackground, alignItems: "center" }} theme={currentTheme}>
              <MaterialCommunityIcons name="cake-variant" size={60} color={currentTheme.secondaryText} />
              <Text style={[styles.emptyListText, { color: currentTheme.secondaryText }]}>No birthdays added yet. Add a special date!</Text>
            </CustomCard>
          ) : (
            birthdays.map((birthday) => (
              <TaskCard
                key={birthday.id}
                task={{ ...birthday, title: birthday.name, completed: false }}
                type="birthday"
                onPress={() => celebrateBirthday(birthday.id)}
                onComplete={() => celebrateBirthday(birthday.id)}
                onUncomplete={() => {}}
                onDelete={deleteBirthday}
                theme={currentTheme}
                accent={currentTheme.primary}
              />
            ))
          )}
        </View>
      </ScrollView>
      
      <Modal
        isVisible={showBirthdayDatePicker}
        onBackdropPress={() => setShowBirthdayDatePicker(false)}
      >
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="calendar"
          onChange={(event, selectedDate) => {
            if (event.type === 'set' && selectedDate) {
              const month = (selectedDate.getMonth() + 1).toString().padStart(2, "0");
              const day = selectedDate.getDate().toString().padStart(2, "0");
              setNewBirthdayDate(`${month}-${day}`);
            }
            setShowBirthdayDatePicker(false);
          }}
        />
      </Modal>
    </>
  );
};
