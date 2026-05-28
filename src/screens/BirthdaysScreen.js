import React, { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Modal from "react-native-modal";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { CustomCard } from "../components/CustomCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomButton } from "../components/CustomButton";
import { TaskCard } from "../components/TaskCard";
import { scheduleCustomBirthdayReminders, cancelCustomBirthdayReminders } from "../utils/notifications";
import { styles as globalStyles } from "../theme/styles";

export const BirthdaysScreen = ({
  currentTheme,
  birthdays = [],
  setBirthdays,
  showConfirmation,
  setConfettiVisible
}) => {
  const [newBirthdayName, setNewBirthdayName] = useState("");
  const [newBirthdayDate, setNewBirthdayDate] = useState(null); // Date object
  const [newBirthdayTime, setNewBirthdayTime] = useState(new Date(1970, 0, 1, 9, 0)); // 09:00 AM
  const [advanceReminder, setAdvanceReminder] = useState("none");
  const [includeYear, setIncludeYear] = useState(true);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const advanceOptions = [
    { value: "none", label: "On the Day" },
    { value: "1_day", label: "1 Day Before" },
    { value: "3_days", label: "3 Days Before" },
    { value: "1_week", label: "1 Week Before" },
  ];

  const addBirthday = async () => {
    if (newBirthdayName.trim() && newBirthdayDate) {
      let bdateStr = "";
      const month = (newBirthdayDate.getMonth() + 1).toString().padStart(2, "0");
      const day = newBirthdayDate.getDate().toString().padStart(2, "0");
      
      if (includeYear) {
        const year = newBirthdayDate.getFullYear();
        bdateStr = `${year}-${month}-${day}`;
      } else {
        bdateStr = `${month}-${day}`;
      }

      const hours = newBirthdayTime.getHours().toString().padStart(2, "0");
      const minutes = newBirthdayTime.getMinutes().toString().padStart(2, "0");
      const timeStr = `${hours}:${minutes}`;

      const tempBday = {
        id: Date.now().toString(),
        name: newBirthdayName.trim(),
        birthDate: bdateStr,
        remindAtTime: timeStr,
        advanceReminder: advanceReminder,
        notificationIds: []
      };

      // Schedule push reminders
      const notificationIds = await scheduleCustomBirthdayReminders(tempBday);
      const finalBday = { ...tempBday, notificationIds };

      setBirthdays((prev) => [...prev, finalBday]);

      // Trigger native success haptic click
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset form states
      setNewBirthdayName("");
      setNewBirthdayDate(null);
      setNewBirthdayTime(new Date(1970, 0, 1, 9, 0));
      setAdvanceReminder("none");
      setIncludeYear(true);
      console.log("🎂 Birthday added with reminders:", finalBday.name);
    }
  };

  const deleteBirthday = (id) => {
    showConfirmation(
      "Are you sure you want to delete this birthday? All scheduled reminders will be permanently canceled.",
      async () => {
        const targetBday = birthdays.find(b => b.id === id);
        if (targetBday && targetBday.notificationIds) {
          await cancelCustomBirthdayReminders(targetBday.notificationIds);
        }
        setBirthdays((prev) => prev.filter((b) => b.id !== id));
        console.log("🗑️ Birthday deleted:", id);
      },
      () => {},
    );
  };

  const celebrateBirthday = (id) => {
    const birthday = birthdays.find((b) => b.id === id);
    showConfirmation(`Wish a happy birthday to ${birthday.name}! 🎂🎉`, () => {
      setConfettiVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log("🎉 Birthday celebrated:", birthday.name);
    });
  };

  // Dynamically compute countdown values and sort by nearest upcoming date (lowest daysRemaining first)
  const sortedBirthdays = [...birthdays].map(bday => {
    const dateStr = bday.birthDate || bday.date || "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = dateStr.split('-');
    let month = 0;
    let day = 1;

    if (parts.length === 3) {
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
    }

    const currentYear = today.getFullYear();
    
    // Leap-safe date check
    let bdayThisYear = new Date(currentYear, month, day);
    if (bdayThisYear.getMonth() !== month) {
      bdayThisYear = new Date(currentYear, month, day + 1);
    }

    let nextBday = new Date(bdayThisYear);
    if (bdayThisYear < today) {
      nextBday.setFullYear(currentYear + 1);
      if (nextBday.getMonth() !== month) {
        nextBday = new Date(currentYear + 1, month, day + 1);
      }
    }

    const diffTime = nextBday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { ...bday, daysRemaining: diffDays };
  }).sort((a, b) => a.daysRemaining - b.daysRemaining);

  const formattedDatePickerText = newBirthdayDate 
    ? (includeYear ? newBirthdayDate.toLocaleDateString() : `${newBirthdayDate.getMonth() + 1}-${newBirthdayDate.getDate()}`)
    : "Pick Birth Date";

  const formattedTimePickerText = `Remind at: ${newBirthdayTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <>
      <ScrollView style={globalStyles.tabContentScroll} keyboardShouldPersistTaps="handled">
        <View style={globalStyles.tabContent}>
          
          {/* 1. Add New Birthday Form */}
          <CustomCard style={{ backgroundColor: currentTheme.cardBackground, padding: 20, borderRadius: 16 }} theme={currentTheme}>
            <Text style={[globalStyles.sectionTitle, { color: currentTheme.primary, marginBottom: 12 }]}>Add New Birthday</Text>
            
            <CustomTextInput
              label="Person's Name"
              value={newBirthdayName}
              onChangeText={setNewBirthdayName}
              style={{ marginBottom: 12 }}
              placeholderTextColor={currentTheme.secondaryText}
              theme={currentTheme}
            />

            <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 12 }}>
              {/* Date Selector */}
              <CustomButton
                title={formattedDatePickerText}
                icon="calendar"
                onPress={() => setShowDatePicker(true)}
                outline
                color={currentTheme.primary}
                style={{ flex: 1, marginRight: 8, minWidth: 120, marginBottom: 8 }}
              />

              {/* Time Selector */}
              <CustomButton
                title={formattedTimePickerText}
                icon="clock-outline"
                onPress={() => setShowTimePicker(true)}
                outline
                color={currentTheme.primary}
                style={{ flex: 1, minWidth: 120, marginBottom: 8 }}
              />
            </View>

            {/* Optional Birth Year Toggle Switch */}
            {newBirthdayDate && (
              <TouchableOpacity 
                onPress={() => setIncludeYear(prev => !prev)}
                style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, paddingLeft: 4 }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons 
                  name={includeYear ? "checkbox-marked" : "checkbox-blank-outline"} 
                  size={20} 
                  color={currentTheme.primary} 
                  style={{ marginRight: 6 }}
                />
                <Text style={{ color: currentTheme.text, fontSize: 13, fontWeight: "600" }}>Include Birth Year (for age calculation)</Text>
              </TouchableOpacity>
            )}

            {/* Custom Advance Reminder Chip Selector */}
            <Text style={{ color: currentTheme.text, fontWeight: "700", fontSize: 13, marginBottom: 8, paddingLeft: 2 }}>
              Advance Reminders
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4, marginBottom: 16 }}>
              {advanceOptions.map((option) => {
                const isSelected = advanceReminder === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setAdvanceReminder(option.value)}
                    style={{
                      backgroundColor: isSelected ? currentTheme.primary : (currentTheme.cardBackground === '#fff' ? '#F0F2F6' : '#2D3039'),
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      marginRight: 8,
                      borderWidth: 1.5,
                      borderColor: isSelected ? currentTheme.primary : (currentTheme.border || '#E5EAF1'),
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{
                      color: isSelected ? '#FFFFFF' : currentTheme.text,
                      fontWeight: isSelected ? "700" : "500",
                      fontSize: 12,
                    }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <CustomButton
              title="Add Birthday"
              icon="plus"
              onPress={addBirthday}
              color={currentTheme.primary}
              style={globalStyles.fullWidthButton}
              disabled={!newBirthdayName.trim() || !newBirthdayDate}
            />
          </CustomCard>

          {/* 2. Sorted Birthday List */}
          {sortedBirthdays.length === 0 ? (
            <CustomCard style={{ backgroundColor: currentTheme.cardBackground, alignItems: "center", padding: 30 }} theme={currentTheme}>
              <MaterialCommunityIcons name="cake-variant" size={60} color={currentTheme.secondaryText} style={{ marginBottom: 8 }} />
              <Text style={[globalStyles.emptyListText, { color: currentTheme.secondaryText }]}>No birthdays added yet. Add a special date!</Text>
            </CustomCard>
          ) : (
            sortedBirthdays.map((birthday) => (
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

      {/* 3. DateTimePicker Modals */}
      <Modal
        isVisible={showDatePicker}
        onBackdropPress={() => setShowDatePicker(false)}
        style={localStyles.modalOverlay}
      >
        <View style={[localStyles.pickerCard, { backgroundColor: currentTheme.cardBackground }]}>
          <Text style={{ color: currentTheme.text, fontWeight: "700", fontSize: 16, marginBottom: 12, textAlign: "center" }}>
            Select Birthday Date
          </Text>
          <DateTimePicker
            value={newBirthdayDate || new Date()}
            mode="date"
            display="calendar"
            onChange={(event, selectedDate) => {
              if (event.type === 'set' && selectedDate) {
                setNewBirthdayDate(selectedDate);
              }
              setShowDatePicker(false);
            }}
          />
        </View>
      </Modal>

      <Modal
        isVisible={showTimePicker}
        onBackdropPress={() => setShowTimePicker(false)}
        style={localStyles.modalOverlay}
      >
        <View style={[localStyles.pickerCard, { backgroundColor: currentTheme.cardBackground }]}>
          <Text style={{ color: currentTheme.text, fontWeight: "700", fontSize: 16, marginBottom: 12, textAlign: "center" }}>
            Select Reminder Time
          </Text>
          <DateTimePicker
            value={newBirthdayTime}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(event, selectedDate) => {
              if (event.type === 'set' && selectedDate) {
                setNewBirthdayTime(selectedDate);
              }
              setShowTimePicker(false);
            }}
          />
        </View>
      </Modal>
    </>
  );
};

const localStyles = StyleSheet.create({
  modalOverlay: {
    justifyContent: "center",
    alignItems: "center",
    margin: 0,
  },
  pickerCard: {
    width: "85%",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  }
});
