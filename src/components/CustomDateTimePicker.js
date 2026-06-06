import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CustomButton } from "./CustomButton";

export const CustomDatePickerModal = ({ visible, value, onClose, onConfirm, theme }) => {
  const initialDate = value || new Date();
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  useEffect(() => {
    if (visible) {
      const activeDate = value || new Date();
      setSelectedYear(activeDate.getFullYear());
      setSelectedMonth(activeDate.getMonth());
      setSelectedDay(activeDate.getDate());
    }
  }, [visible, value]);

  const monthNames = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
  ];

  const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay();

  // Adjust selectedDay if it exceeds the new month's daysInMonth
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear, daysInMonth]);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const handleConfirm = () => {
    const newDate = new Date(selectedYear, selectedMonth, selectedDay);
    onConfirm(newDate);
    onClose();
  };

  // Generate day grid cells
  const gridCells = [];
  // Empty cells for alignment
  for (let i = 0; i < firstDayIndex; i++) {
    gridCells.push({ key: `empty-${i}`, dayNum: null });
  }
  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    gridCells.push({ key: `day-${i}`, dayNum: i });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialogCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.dialogTitle, { color: theme.text }]}>SELECT DATE VALUE</Text>

          {/* Month/Year selector header */}
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowBtn}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme.primary} />
            </TouchableOpacity>
            <View style={styles.monthYearTextContainer}>
              <Text style={[styles.monthText, { color: theme.text }]}>
                {monthNames[selectedMonth]} {selectedYear}
              </Text>
            </View>
            <TouchableOpacity onPress={handleNextMonth} style={styles.arrowBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekdaysRow}>
            {daysOfWeek.map((day, idx) => (
              <Text key={idx} style={[styles.weekdayText, { color: theme.secondaryText }]}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.gridContainer}>
            {Array.from({ length: Math.ceil(gridCells.length / 7) }).map((_, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {gridCells.slice(rowIndex * 7, (rowIndex + 1) * 7).map((cell, colIndex) => {
                  const isSelected = cell.dayNum === selectedDay;
                  return (
                    <TouchableOpacity
                      key={cell.key}
                      disabled={cell.dayNum === null}
                      onPress={() => setSelectedDay(cell.dayNum)}
                      style={[
                        styles.dayCell,
                        isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }
                      ]}
                    >
                      {cell.dayNum !== null && (
                        <Text
                          style={[
                            styles.dayText,
                            { color: isSelected ? theme.onPrimary : theme.text }
                          ]}
                        >
                          {cell.dayNum}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
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
  
  // States for hours, minutes, and AM/PM
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [isAm, setIsAm] = useState(true);

  useEffect(() => {
    if (visible) {
      const activeDate = value || new Date();
      const rawHours = activeDate.getHours();
      setMinutes(activeDate.getMinutes());
      
      if (is24Hour) {
        setHours(rawHours);
      } else {
        const displayHours = rawHours % 12 === 0 ? 12 : rawHours % 12;
        setHours(displayHours);
        setIsAm(rawHours < 12);
      }
    }
  }, [visible, value, is24Hour]);

  const incrementHours = () => {
    if (is24Hour) {
      setHours(prev => (prev + 1) % 24);
    } else {
      setHours(prev => {
        const next = prev + 1;
        return next > 12 ? 1 : next;
      });
    }
  };

  const decrementHours = () => {
    if (is24Hour) {
      setHours(prev => (prev - 1 + 24) % 24);
    } else {
      setHours(prev => {
        const next = prev - 1;
        return next < 1 ? 12 : next;
      });
    }
  };

  const incrementMinutes = () => {
    setMinutes(prev => (prev + 1) % 60);
  };

  const decrementMinutes = () => {
    setMinutes(prev => (prev - 1 + 60) % 60);
  };

  const handleConfirm = () => {
    let finalHours = hours;
    if (!is24Hour) {
      if (isAm) {
        finalHours = hours === 12 ? 0 : hours;
      } else {
        finalHours = hours === 12 ? 12 : hours + 12;
      }
    }
    
    const resultDate = new Date(initialDate);
    resultDate.setHours(finalHours);
    resultDate.setMinutes(minutes);
    resultDate.setSeconds(0);
    
    onConfirm(resultDate);
    onClose();
  };

  const formatNum = (num) => String(num).padStart(2, '0');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialogCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.dialogTitle, { color: theme.text }]}>SELECT TIME VALUE</Text>

          {/* Time Display */}
          <View style={styles.timePickerContainer}>
            {/* Hours */}
            <View style={styles.timeColumn}>
              <TouchableOpacity onPress={incrementHours} style={styles.adjustBtn}>
                <MaterialCommunityIcons name="chevron-up" size={32} color={theme.primary} />
              </TouchableOpacity>
              <Text style={[styles.timeValueText, { color: theme.text }]}>
                {is24Hour ? formatNum(hours) : hours}
              </Text>
              <TouchableOpacity onPress={decrementHours} style={styles.adjustBtn}>
                <MaterialCommunityIcons name="chevron-down" size={32} color={theme.primary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.timeSeparatorText, { color: theme.text }]}>:</Text>

            {/* Minutes */}
            <View style={styles.timeColumn}>
              <TouchableOpacity onPress={incrementMinutes} style={styles.adjustBtn}>
                <MaterialCommunityIcons name="chevron-up" size={32} color={theme.primary} />
              </TouchableOpacity>
              <Text style={[styles.timeValueText, { color: theme.text }]}>
                {formatNum(minutes)}
              </Text>
              <TouchableOpacity onPress={decrementMinutes} style={styles.adjustBtn}>
                <MaterialCommunityIcons name="chevron-down" size={32} color={theme.primary} />
              </TouchableOpacity>
            </View>

            {/* AM/PM toggle (if 12h) */}
            {!is24Hour && (
              <View style={styles.ampmColumn}>
                <TouchableOpacity 
                  onPress={() => setIsAm(prev => !prev)} 
                  style={[
                    styles.ampmBtn, 
                    { borderColor: theme.border, backgroundColor: theme.cardBackground }
                  ]}
                >
                  <Text style={[styles.ampmBtnText, { color: theme.primary }]}>
                    {isAm ? "AM" : "PM"}
                  </Text>
                </TouchableOpacity>
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
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
  },
  arrowBtn: {
    padding: 8,
  },
  monthYearTextContainer: {
    flex: 1,
    alignItems: "center",
  },
  monthText: {
    fontSize: 14,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  weekdaysRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#8883",
    paddingBottom: 4,
  },
  weekdayText: {
    width: 32,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  gridContainer: {
    width: "100%",
    gap: 4,
    marginBottom: 20,
  },
  gridRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
  },
  dayCell: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dayText: {
    fontSize: 12,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
  },
  timePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginVertical: 16,
    width: "100%",
  },
  timeColumn: {
    alignItems: "center",
    width: 60,
  },
  adjustBtn: {
    padding: 2,
  },
  timeValueText: {
    fontSize: 28,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    marginVertical: 4,
  },
  timeSeparatorText: {
    fontSize: 28,
    fontFamily: "JetBrainsMono-Bold",
    fontWeight: "900",
    marginBottom: 8,
  },
  ampmColumn: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 8,
  },
  ampmBtn: {
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 0,
  },
  ampmBtnText: {
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
