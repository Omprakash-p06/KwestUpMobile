import React, { useState, useEffect, useRef } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { CustomButton } from "./CustomButton";

const ITEM_HEIGHT = 44;

export const CustomDatePickerModal = ({ visible, value, onClose, onConfirm, theme }) => {
  const initialDate = value || new Date();
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  const yearListRef = useRef(null);
  const monthListRef = useRef(null);
  const dayListRef = useRef(null);

  const monthNames = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
  ];

  // Years from 1930 to 2050
  const years = Array.from({ length: 2050 - 1930 + 1 }, (_, i) => 1930 + i);
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Adjust selected day if it exceeds current month's days
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear, daysInMonth]);

  // Scroll to active items when visible
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        // Scroll Year
        const yIndex = years.indexOf(selectedYear);
        if (yIndex !== -1 && yearListRef.current) {
          yearListRef.current.scrollToIndex({ index: yIndex, animated: false, viewPosition: 0.5 });
        }
        // Scroll Month
        if (monthListRef.current) {
          monthListRef.current.scrollToIndex({ index: selectedMonth, animated: false, viewPosition: 0.5 });
        }
        // Scroll Day
        const dIndex = days.indexOf(selectedDay);
        if (dIndex !== -1 && dayListRef.current) {
          dayListRef.current.scrollToIndex({ index: dIndex, animated: false, viewPosition: 0.5 });
        }
      }, 100);
    }
  }, [visible]);

  const handleConfirm = () => {
    const newDate = new Date(selectedYear, selectedMonth, selectedDay);
    onConfirm(newDate);
    onClose();
  };

  const renderItem = ({ item, isSelected, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.scrollItem,
        isSelected && { backgroundColor: theme.primary }
      ]}
    >
      <Text style={[
        styles.scrollItemText,
        { color: isSelected ? theme.onPrimary : theme.text }
      ]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialogCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.dialogTitle, { color: theme.text }]}>SELECT DATE VALUE</Text>

          {/* Three Column Scroll View */}
          <View style={styles.columnsContainer}>
            {/* Month Column */}
            <View style={styles.columnWrapper}>
              <Text style={[styles.columnHeader, { color: theme.secondaryText }]}>MONTH</Text>
              <FlatList
                ref={monthListRef}
                data={monthNames}
                keyExtractor={(item) => item}
                renderItem={({ item, index }) => renderItem({
                  item,
                  isSelected: index === selectedMonth,
                  onPress: () => setSelectedMonth(index)
                })}
                style={styles.columnList}
                getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                showsVerticalScrollIndicator={false}
              />
            </View>

            {/* Day Column */}
            <View style={styles.columnWrapper}>
              <Text style={[styles.columnHeader, { color: theme.secondaryText }]}>DAY</Text>
              <FlatList
                ref={dayListRef}
                data={days}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => renderItem({
                  item: String(item).padStart(2, '0'),
                  isSelected: item === selectedDay,
                  onPress: () => setSelectedDay(item)
                })}
                style={styles.columnList}
                getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                showsVerticalScrollIndicator={false}
              />
            </View>

            {/* Year Column */}
            <View style={styles.columnWrapper}>
              <Text style={[styles.columnHeader, { color: theme.secondaryText }]}>YEAR</Text>
              <FlatList
                ref={yearListRef}
                data={years}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => renderItem({
                  item,
                  isSelected: item === selectedYear,
                  onPress: () => setSelectedYear(item)
                })}
                style={styles.columnList}
                getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>

          {/* Dialog Action Buttons */}
          <View style={styles.buttonRow}>
            <CustomButton title="CANCEL" onPress={onClose} outline color={theme.primary} style={{ marginRight: 8, flex: 1 }} />
            <CustomButton title="CONFIRM" onPress={handleConfirm} color={theme.primary} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const CustomTimePickerModal = ({ visible, value, onClose, onConfirm, theme, is24Hour = false }) => {
  const initialDate = value || new Date();
  
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [isAm, setIsAm] = useState(true);

  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);

  // Generate hours (1-12 or 0-23)
  const hours = is24Hour 
    ? Array.from({ length: 24 }, (_, i) => i) 
    : Array.from({ length: 12 }, (_, i) => i + 1);

  // Generate minutes (0-59)
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  useEffect(() => {
    if (visible) {
      const activeDate = value || new Date();
      const rawHours = activeDate.getHours();
      const rawMinutes = activeDate.getMinutes();
      
      setSelectedMinute(rawMinutes);

      let currentHour;
      if (is24Hour) {
        currentHour = rawHours;
      } else {
        currentHour = rawHours % 12 === 0 ? 12 : rawHours % 12;
        setIsAm(rawHours < 12);
      }
      setSelectedHour(currentHour);

      setTimeout(() => {
        // Scroll Hour
        const hIndex = hours.indexOf(currentHour);
        if (hIndex !== -1 && hourListRef.current) {
          hourListRef.current.scrollToIndex({ index: hIndex, animated: false, viewPosition: 0.5 });
        }
        // Scroll Minute
        if (minuteListRef.current) {
          minuteListRef.current.scrollToIndex({ index: rawMinutes, animated: false, viewPosition: 0.5 });
        }
      }, 100);
    }
  }, [visible, value, is24Hour]);

  const handleConfirm = () => {
    let finalHours = selectedHour;
    if (!is24Hour) {
      if (isAm) {
        finalHours = selectedHour === 12 ? 0 : selectedHour;
      } else {
        finalHours = selectedHour === 12 ? 12 : selectedHour + 12;
      }
    }
    
    const resultDate = new Date(initialDate);
    resultDate.setHours(finalHours);
    resultDate.setMinutes(selectedMinute);
    resultDate.setSeconds(0);
    
    onConfirm(resultDate);
    onClose();
  };

  const formatNum = (num) => String(num).padStart(2, '0');

  const renderItem = ({ item, isSelected, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.scrollItem,
        isSelected && { backgroundColor: theme.primary }
      ]}
    >
      <Text style={[
        styles.scrollItemText,
        { color: isSelected ? theme.onPrimary : theme.text }
      ]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialogCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.dialogTitle, { color: theme.text }]}>SELECT TIME VALUE</Text>

          {/* Time Picker Columns */}
          <View style={styles.columnsContainer}>
            {/* Hour Column */}
            <View style={styles.columnWrapper}>
              <Text style={[styles.columnHeader, { color: theme.secondaryText }]}>HOUR</Text>
              <FlatList
                ref={hourListRef}
                data={hours}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => renderItem({
                  item: is24Hour ? formatNum(item) : String(item),
                  isSelected: item === selectedHour,
                  onPress: () => setSelectedHour(item)
                })}
                style={styles.columnList}
                getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                showsVerticalScrollIndicator={false}
              />
            </View>

            {/* Minute Column */}
            <View style={styles.columnWrapper}>
              <Text style={[styles.columnHeader, { color: theme.secondaryText }]}>MINUTE</Text>
              <FlatList
                ref={minuteListRef}
                data={minutes}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => renderItem({
                  item: formatNum(item),
                  isSelected: item === selectedMinute,
                  onPress: () => setSelectedMinute(item)
                })}
                style={styles.columnList}
                getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                showsVerticalScrollIndicator={false}
              />
            </View>

            {/* AM/PM Column (if 12h) */}
            {!is24Hour && (
              <View style={styles.columnWrapper}>
                <Text style={[styles.columnHeader, { color: theme.secondaryText }]}>AM/PM</Text>
                <View style={[styles.columnList, { justifyContent: "center", gap: 12 }]}>
                  <TouchableOpacity
                    onPress={() => setIsAm(true)}
                    style={[
                      styles.scrollItem,
                      isAm && { backgroundColor: theme.primary }
                    ]}
                  >
                    <Text style={[
                      styles.scrollItemText,
                      { color: isAm ? theme.onPrimary : theme.text }
                    ]}>
                      AM
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setIsAm(false)}
                    style={[
                      styles.scrollItem,
                      !isAm && { backgroundColor: theme.primary }
                    ]}
                  >
                    <Text style={[
                      styles.scrollItemText,
                      { color: !isAm ? theme.onPrimary : theme.text }
                    ]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Dialog Action Buttons */}
          <View style={styles.buttonRow}>
            <CustomButton title="CANCEL" onPress={onClose} outline color={theme.primary} style={{ marginRight: 8, flex: 1 }} />
            <CustomButton title="CONFIRM" onPress={handleConfirm} color={theme.primary} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogCard: {
    borderWidth: 2.5,
    padding: 20,
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
  columnsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    height: 200,
    marginBottom: 20,
  },
  columnWrapper: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  columnHeader: {
    fontSize: 10,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  columnList: {
    flex: 1,
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#8883",
  },
  scrollItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  scrollItemText: {
    fontSize: 14,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 10,
  },
});
