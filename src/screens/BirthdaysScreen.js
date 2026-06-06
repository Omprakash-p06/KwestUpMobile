import React, { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Modal from "react-native-modal";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { scheduleCustomBirthdayReminders, cancelCustomBirthdayReminders } from "../utils/notifications";

export const BirthdaysScreen = ({
  currentTheme,
  birthdays = [],
  setBirthdays,
  showConfirmation,
  setConfettiVisible
}) => {
  const [newBirthdayName, setNewBirthdayName] = useState("");
  const [newBirthdayDate, setNewBirthdayDate] = useState(null);
  const [newBirthdayTime, setNewBirthdayTime] = useState(new Date(1970, 0, 1, 9, 0));
  const [advanceReminder, setAdvanceReminder] = useState("none");
  const [includeYear, setIncludeYear] = useState(true);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const advanceOptions = [
    { value: "none", label: "ON_THE_DAY" },
    { value: "1_day", label: "1_DAY_BEFORE" },
    { value: "3_days", label: "3_DAYS_BEFORE" },
    { value: "1_week", label: "1_WEEK_BEFORE" },
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

      const notificationIds = await scheduleCustomBirthdayReminders(tempBday);
      const finalBday = { ...tempBday, notificationIds };

      setBirthdays((prev) => [...prev, finalBday]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset
      setNewBirthdayName("");
      setNewBirthdayDate(null);
      setNewBirthdayTime(new Date(1970, 0, 1, 9, 0));
      setAdvanceReminder("none");
      setIncludeYear(true);
    }
  };

  const deleteBirthday = (id) => {
    showConfirmation(
      "Are you sure you want to delete this birthday? All scheduled reminders will be permanently canceled.",
      async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const targetBday = birthdays.find(b => b.id === id);
        if (targetBday && targetBday.notificationIds) {
          await cancelCustomBirthdayReminders(targetBday.notificationIds);
        }
        setBirthdays((prev) => prev.filter((b) => b.id !== id));
      },
      () => {}
    );
  };

  const celebrateBirthday = (id) => {
    const birthday = birthdays.find((b) => b.id === id);
    showConfirmation(`Wish a happy birthday to ${birthday.name}!`, () => {
      setConfettiVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  // Compute countdowns
  const sortedBirthdays = [...birthdays].map(bday => {
    const dateStr = bday.birthDate || bday.date || "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = dateStr.split('-');
    let birthYear = null;
    let month = 0;
    let day = 1;

    if (parts.length === 3) {
      birthYear = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
    }

    const currentYear = today.getFullYear();
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

    let ageText = "";
    if (birthYear) {
      const upcomingAge = nextBday.getFullYear() - birthYear;
      ageText = `Turns ${upcomingAge}`;
    }

    return { ...bday, daysRemaining: diffDays, ageText };
  }).sort((a, b) => a.daysRemaining - b.daysRemaining);

  const formattedDatePickerText = newBirthdayDate 
    ? (includeYear ? newBirthdayDate.toLocaleDateString() : `${newBirthdayDate.getMonth() + 1}-${newBirthdayDate.getDate()}`)
    : "PICK BIRTH DATE";

  const formattedTimePickerText = `REMIND AT: ${newBirthdayTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase()}`;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollPadding}>
        
        {/* Header Title */}
        <View style={styles.headerSection}>
          <View style={[styles.badge, { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }]}>
            <Text style={[styles.badgeText, { color: currentTheme.onPrimary }]}>
              REGISTRY_SYS_V1.1
            </Text>
          </View>
          <Text style={[styles.title, { color: currentTheme.text }]}>ANNIVERSARY LOGS</Text>
        </View>

        {/* 1. Add New Birthday Chassis Card */}
        <LiquidGlassCard theme={currentTheme} style={styles.formChassis}>
          <View style={styles.chassisHeader}>
            <Text style={[styles.chassisTitle, { color: currentTheme.text }]}>NEW_ENTRY.cfg</Text>
          </View>

          <CustomTextInput
            label="Anniversary Name"
            value={newBirthdayName}
            onChangeText={newBirthdayName => setNewBirthdayName(newBirthdayName)}
            placeholder="ENTER NAME..."
            placeholderTextColor={currentTheme.secondaryText}
            theme={currentTheme}
            style={styles.textInput}
          />

          <View style={styles.pickerButtonsRow}>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.pickerBtn, { borderColor: currentTheme.border }]}
            >
              <MaterialCommunityIcons name="calendar" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.pickerBtnText, { color: currentTheme.text }]}>{formattedDatePickerText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={[styles.pickerBtn, { borderColor: currentTheme.border }]}
            >
              <MaterialCommunityIcons name="clock-outline" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.pickerBtnText, { color: currentTheme.text }]}>{formattedTimePickerText}</Text>
            </TouchableOpacity>
          </View>

          {newBirthdayDate && (
            <TouchableOpacity 
              onPress={() => setIncludeYear(prev => !prev)}
              style={styles.checkboxRow}
              activeOpacity={0.8}
            >
              <View 
                style={[
                  styles.squareCheck, 
                  { 
                    borderColor: currentTheme.primary,
                    backgroundColor: includeYear ? currentTheme.primary : "transparent"
                  }
                ]}
              >
                {includeYear && (
                  <MaterialCommunityIcons 
                    name="close" 
                    size={14} 
                    color={currentTheme.onPrimary} 
                  />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: currentTheme.text }]}>
                CALCULATE TARGET AGE (INCLUDE BIRTH YEAR)
              </Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.stickerLabel, { color: currentTheme.text }]}>ADVANCE ALARM OPTION:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {advanceOptions.map((option) => {
              const isSelected = advanceReminder === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setAdvanceReminder(option.value)}
                  style={[
                    styles.chipBtn,
                    {
                      backgroundColor: isSelected ? currentTheme.primary : "transparent",
                      borderColor: currentTheme.border,
                    }
                  ]}
                  activeOpacity={0.8}
                >
                  <Text 
                    style={[
                      styles.chipBtnText, 
                      { 
                        color: isSelected ? (currentTheme.onPrimary) : currentTheme.text,
                        fontWeight: isSelected ? "900" : "500",
                      }
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={addBirthday}
            disabled={!newBirthdayName.trim() || !newBirthdayDate}
            style={[
              styles.submitBtn, 
              { 
                backgroundColor: currentTheme.primary,
                borderColor: "#000000",
                opacity: (!newBirthdayName.trim() || !newBirthdayDate) ? 0.5 : 1
              }
            ]}
          >
            <MaterialCommunityIcons name="plus" size={18} color={currentTheme.onPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.submitBtnText, { color: currentTheme.onPrimary }]}>
              ADD TO REGISTRY
            </Text>
          </TouchableOpacity>
        </LiquidGlassCard>

        {/* 2. Sorted Anniversary List */}
        <Text style={[styles.stickerLabel, { color: currentTheme.text, marginTop: 12 }]}>UPCOMING ANNIVERSARIES:</Text>
        <View style={styles.listStack}>
          {sortedBirthdays.length === 0 ? (
            <LiquidGlassCard theme={currentTheme} style={styles.emptyCard}>
              <MaterialCommunityIcons name="cake-variant" size={48} color={currentTheme.secondaryText} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyText, { color: currentTheme.secondaryText }]}>
                REGISTRY EMPTY. NO ACTIVE LOGS.
              </Text>
            </LiquidGlassCard>
          ) : (
            sortedBirthdays.map((bday) => (
              <LiquidGlassCard key={bday.id} theme={currentTheme} style={styles.birthdayConsoleCard}>
                <View style={styles.consoleCardInner}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bdayNameText, { color: currentTheme.text }]}>
                      {bday.name.toUpperCase()}
                    </Text>
                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="cake-variant" size={14} color={currentTheme.primary} style={{ marginRight: 4 }} />
                      <Text style={[styles.metaDateText, { color: currentTheme.primary }]}>
                        {bday.birthDate}
                      </Text>
                      {bday.ageText && (
                        <>
                          <Text style={[styles.metaDivider, { color: currentTheme.secondaryText }]}>•</Text>
                          <Text style={[styles.metaAgeText, { color: currentTheme.secondaryText }]}>
                            {bday.ageText.toUpperCase()}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  <View style={styles.actionsColumn}>
                    <TouchableOpacity
                      onPress={() => celebrateBirthday(bday.id)}
                      style={[
                        styles.tagStickerBadge, 
                        { 
                          backgroundColor: bday.daysRemaining === 0 ? currentTheme.error + "22" : currentTheme.primary + "12",
                          borderColor: bday.daysRemaining === 0 ? currentTheme.error : currentTheme.primary,
                        }
                      ]}
                    >
                      <Text 
                        style={[
                          styles.tagStickerText, 
                          { color: bday.daysRemaining === 0 ? currentTheme.error : currentTheme.primary }
                        ]}
                      >
                        {bday.daysRemaining === 0 ? "TODAY" : `IN_${bday.daysRemaining}_DAYS`}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => deleteBirthday(bday.id)}
                      style={styles.deleteIconButton}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={currentTheme.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </LiquidGlassCard>
            ))
          )}
        </View>

      </ScrollView>

      {/* DateTimePicker Modals */}
      <Modal
        isVisible={showDatePicker}
        onBackdropPress={() => setShowDatePicker(false)}
        style={styles.modalOverlay}
      >
        <View style={[styles.dialogCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
          <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>
            SELECT DATE VALUE
          </Text>
          <DateTimePicker
            value={newBirthdayDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
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
        style={styles.modalOverlay}
      >
        <View style={[styles.dialogCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
          <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>
            SELECT REMINDER TIME
          </Text>
          <DateTimePicker
            value={newBirthdayTime}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              if (event.type === 'set' && selectedDate) {
                setNewBirthdayTime(selectedDate);
              }
              setShowTimePicker(false);
            }}
          />
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentScroll: {
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
  formChassis: {
    padding: 16,
    borderWidth: 2,
  },
  chassisHeader: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    paddingBottom: 6,
    marginBottom: 16,
  },
  chassisTitle: {
    fontSize: 13,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
  },
  textInput: {
    marginBottom: 12,
  },
  pickerButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  pickerBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  pickerBtnText: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "800",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 2,
    marginBottom: 16,
    gap: 8,
  },
  squareCheck: {
    width: 18,
    height: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  stickerLabel: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    paddingLeft: 2,
    marginBottom: 6,
  },
  chipsScroll: {
    paddingVertical: 4,
    marginBottom: 16,
  },
  chipBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipBtnText: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
  },
  submitBtn: {
    borderWidth: 3,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "950",
    fontFamily: "JetBrainsMono-Bold",
  },
  listStack: {
    flexDirection: "column",
    gap: 12,
  },
  emptyCard: {
    padding: 30,
    alignItems: "center",
    borderWidth: 2,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Regular",
  },
  birthdayConsoleCard: {
    padding: 14,
    borderWidth: 2,
  },
  consoleCardInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bdayNameText: {
    fontSize: 16,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaDateText: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  metaDivider: {
    fontSize: 12,
    marginHorizontal: 6,
  },
  metaAgeText: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "800",
  },
  actionsColumn: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
  },
  tagStickerBadge: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagStickerText: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  deleteIconButton: {
    padding: 4,
  },
  modalOverlay: {
    justifyContent: "center",
    alignItems: "center",
    margin: 20,
  },
  dialogCard: {
    borderWidth: 2.5,
    padding: 24,
    borderRadius: 0,
    width: "90%",
    maxWidth: 340,
    alignItems: "center",
  },
  dialogTitle: {
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    marginBottom: 16,
    textAlign: "center",
  },
});
