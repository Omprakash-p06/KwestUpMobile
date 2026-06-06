import React, { useState, useEffect } from "react";
import { Modal as RNModal, View, ScrollView, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CustomDatePickerModal, CustomTimePickerModal } from "./CustomDateTimePicker";
import { CustomButton } from "./CustomButton";

const formatDateToInputString = (date) => {
  if (!date) return "";
  const pad = (num) => String(num).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
};

const parseInputDate = (text) => {
  if (!text || text.trim() === '') return null;
  const match = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (match) {
    const [_, yyyy, mm, dd, hh, min] = match;
    const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh), parseInt(min), 0);
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(text.trim().replace(' ', 'T'));
  if (!isNaN(fallback.getTime())) return fallback;
  return null;
};

export const colorPalette = [
  '#8E7BEF',
  '#FFC107',
  '#8BC34A',
  '#F381C1',
  '#FFB366',
  '#2196F3',
  '#F44336',
  '#A799FF',
];

const PRIORITIES = [
  { key: 'high', label: 'HIGH', icon: 'flag', color: '#F44336' },
  { key: 'normal', label: 'NORMAL', icon: 'flag-outline', color: '#FFC107' },
  { key: 'low', label: 'LOW', icon: 'flag-variant-outline', color: '#8BC34A' },
];

export const TaskEditModal = ({ visible, onClose, task, onSave, theme, taskLists = [] }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [color, setColor] = useState(colorPalette[0]);
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState(null);
  const [dueDateText, setDueDateText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(null);
  const [listId, setListId] = useState('default_inbox');

  useEffect(() => {
    if (visible) {
      if (task) {
        setTitle(task?.title || task?.name || '');
        setDescription(task?.description || '');
        setSubtasks(task?.subtasks ? [...task.subtasks] : []);
        setColor(task?.color || colorPalette[0]);
        setPriority(task?.priority || (task?.important ? 'high' : 'normal'));
        const initialDueDate = task?.dueDate ? new Date(task.dueDate) : null;
        setDueDate(initialDueDate);
        setDueDateText(formatDateToInputString(initialDueDate));
        setListId(task?.listId || 'default_inbox');
      } else {
        setTitle('');
        setDescription('');
        setSubtasks([]);
        setColor(colorPalette[0]);
        setPriority('normal');
        setDueDate(null);
        setDueDateText('');
        setListId('default_inbox');
      }
    } else {
      setTitle('');
      setDescription('');
      setSubtasks([]);
      setColor(colorPalette[0]);
      setPriority('normal');
      setDueDate(null);
      setDueDateText('');
      setListId('default_inbox');
    }
  }, [visible, task]);

  const handleSubtaskToggle = (idx) => {
    setSubtasks((prev) => prev.map((st, i) => i === idx ? { ...st, completed: !st.completed } : st));
  };
  const handleSubtaskChange = (idx, text) => {
    setSubtasks((prev) => prev.map((st, i) => i === idx ? { ...st, text } : st));
  };
  const handleAddSubtask = () => {
    setSubtasks((prev) => [...prev, { text: '', completed: false }]);
  };
  const handleDeleteSubtask = (idx) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleSave = () => {
    let finalDueDate = null;
    if (dueDateText && dueDateText.trim() !== '') {
      const parsed = parseInputDate(dueDateText);
      if (parsed) {
        finalDueDate = parsed;
      } else {
        finalDueDate = dueDate;
      }
    }
    onSave({
      ...task,
      title,
      name: title,
      description,
      subtasks,
      color,
      priority,
      important: priority === 'high',
      listId,
      dueDate: finalDueDate ? finalDueDate.toISOString() : undefined
    });
    onClose();
  };

  const handleDatePickerConfirm = (selectedDate) => {
    setTempDate(selectedDate);
    setShowDatePicker(false);
    setShowTimePicker(true);
  };

  const handleTimePickerConfirm = (selectedTime) => {
    const combined = new Date(tempDate || dueDate || new Date());
    combined.setFullYear(tempDate ? tempDate.getFullYear() : combined.getFullYear());
    combined.setMonth(tempDate ? tempDate.getMonth() : combined.getMonth());
    combined.setDate(tempDate ? tempDate.getDate() : combined.getDate());
    combined.setHours(selectedTime.getHours());
    combined.setMinutes(selectedTime.getMinutes());
    combined.setSeconds(0);
    setDueDate(combined);
    setDueDateText(formatDateToInputString(combined));
    setShowTimePicker(false);
    setTempDate(null);
  };

  return (
    <RNModal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.modalTitle, { color: theme.text }]}>{task ? 'EDIT_OBJECTIVE' : 'NEW_OBJECTIVE'}</Text>

          <View style={[styles.fieldGroup, { borderBottomColor: theme.border + '30' }]}>
            <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>TITLE</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="OBJECTIVE TITLE"
              style={[styles.textInput, { borderColor: theme.border, color: theme.text }]}
              placeholderTextColor={theme.secondaryText}
            />
          </View>

          <View style={[styles.fieldGroup, { borderBottomColor: theme.border + '30' }]}>
            <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>DESCRIPTION</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="DESCRIPTION (OPTIONAL)"
              style={[styles.textInput, { borderColor: theme.border, color: theme.text, minHeight: 60 }]}
              placeholderTextColor={theme.secondaryText}
              multiline
            />
          </View>

          <View style={[styles.fieldGroup, { borderBottomColor: theme.border + '30' }]}>
            <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setPriority(p.key)}
                  style={[
                    styles.priorityBtn,
                    {
                      borderColor: priority === p.key ? p.color : theme.border,
                      backgroundColor: priority === p.key ? p.color + '20' : 'transparent',
                    }
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name={p.icon} size={16} color={priority === p.key ? p.color : theme.secondaryText} />
                  <Text style={[styles.priorityBtnText, { color: priority === p.key ? p.color : theme.secondaryText }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {taskLists && taskLists.length > 0 && (
            <View style={[styles.fieldGroup, { borderBottomColor: theme.border + '30' }]}>
              <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>TASK LIST</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listScroll}>
                {taskLists.map((list) => {
                  const isSelected = list.id === listId;
                  return (
                    <TouchableOpacity
                      key={list.id}
                      onPress={() => setListId(list.id)}
                      style={[
                        styles.listPill,
                        {
                          backgroundColor: isSelected ? theme.primary : 'transparent',
                          borderColor: isSelected ? theme.primary : theme.border,
                        }
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={{
                        color: isSelected ? theme.onPrimary : theme.text,
                        fontFamily: 'JetBrainsMono-Bold',
                        fontSize: 11,
                        fontWeight: '900',
                      }}>
                        {list.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={[styles.fieldGroup, { borderBottomColor: theme.border + '30' }]}>
            <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>DUE DATE</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickBtn}>
                <Text style={[styles.datePickText, { color: theme.primary }]}>
                  {dueDate ? `DUE: ${formatDateToInputString(dueDate)}` : '+ PICK DATE & TIME'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.dateOrText, { color: theme.secondaryText }]}>OR</Text>
              <TextInput
                value={dueDateText}
                onChangeText={setDueDateText}
                placeholder="YYYY-MM-DD HH:MM"
                style={[styles.dateInput, { borderColor: theme.border, color: theme.text }]}
                placeholderTextColor={theme.secondaryText}
              />
            </View>
            <CustomDatePickerModal
              visible={showDatePicker}
              value={dueDate}
              onClose={() => setShowDatePicker(false)}
              onConfirm={handleDatePickerConfirm}
              theme={theme}
            />
            <CustomTimePickerModal
              visible={showTimePicker}
              value={dueDate}
              onClose={() => setShowTimePicker(false)}
              onConfirm={handleTimePickerConfirm}
              theme={theme}
              is24Hour={true}
            />
          </View>

          <View style={[styles.fieldGroup, { borderBottomColor: theme.border + '30' }]}>
            <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>SUBTASKS</Text>
            {subtasks.map((st, idx) => (
              <View key={idx} style={styles.subtaskRow}>
                <TouchableOpacity onPress={() => handleSubtaskToggle(idx)} style={styles.subtaskCheck}>
                  <MaterialCommunityIcons name={st.completed ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={theme.primary} />
                </TouchableOpacity>
                <TextInput
                  value={st.text}
                  onChangeText={text => handleSubtaskChange(idx, text)}
                  placeholder={`SUBTASK ${idx + 1}`}
                  style={[styles.subtaskInput, { borderBottomColor: theme.border, color: theme.text }]}
                  placeholderTextColor={theme.secondaryText}
                />
                <TouchableOpacity onPress={() => handleDeleteSubtask(idx)} style={styles.subtaskDelete}>
                  <MaterialCommunityIcons name="delete" size={18} color={theme.error || '#F44336'} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={handleAddSubtask} style={styles.addSubtaskBtn}>
              <MaterialCommunityIcons name="plus" size={16} color={theme.primary} />
              <Text style={[styles.addSubtaskText, { color: theme.primary }]}>ADD SUBTASK</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.fieldGroup, { borderBottomColor: theme.border + '30' }]}>
            <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>CARD COLOR</Text>
            <View style={styles.colorRow}>
              {colorPalette.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c, borderColor: color === c ? theme.primary : theme.border },
                  ]}
                >
                  {color === c && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.buttonRow}>
            <CustomButton title="CANCEL" onPress={onClose} outline color={theme.primary} style={{ marginRight: 8 }} />
            <CustomButton title="SAVE" onPress={handleSave} color={theme.primary} />
          </View>
        </ScrollView>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    maxHeight: '90%',
    width: '90%',
  },
  modalContent: {
    borderWidth: 2.5,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'JetBrainsMono-Bold',
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  fieldGroup: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'JetBrainsMono-Bold',
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1.5,
    padding: 10,
    fontSize: 13,
    fontFamily: 'JetBrainsMono-Regular',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  priorityBtnText: {
    fontSize: 11,
    fontFamily: 'JetBrainsMono-Bold',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  listScroll: {
    paddingVertical: 4,
    gap: 8,
  },
  listPill: {
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  datePickBtn: {
    marginBottom: 4,
  },
  datePickText: {
    fontSize: 12,
    fontFamily: 'JetBrainsMono-Bold',
    fontWeight: '900',
  },
  dateOrText: {
    fontSize: 10,
    fontFamily: 'JetBrainsMono-Bold',
    marginHorizontal: 4,
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1.5,
    padding: 8,
    fontSize: 12,
    fontFamily: 'JetBrainsMono-Regular',
    minWidth: 140,
    flexShrink: 1,
    marginBottom: 4,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subtaskCheck: {
    marginRight: 8,
  },
  subtaskInput: {
    flex: 1,
    borderBottomWidth: 1.5,
    padding: 6,
    fontSize: 12,
    fontFamily: 'JetBrainsMono-Regular',
  },
  subtaskDelete: {
    marginLeft: 8,
  },
  addSubtaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    gap: 6,
  },
  addSubtaskText: {
    fontSize: 11,
    fontFamily: 'JetBrainsMono-Bold',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
});
