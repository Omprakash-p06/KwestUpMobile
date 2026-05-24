import React, { useState, useEffect } from "react";
import { Modal as RNModal, View, ScrollView, Text, TextInput, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CustomButton } from "./CustomButton";

export const colorPalette = [
  '#8E7BEF', // purple
  '#FFC107', // yellow
  '#8BC34A', // green
  '#F381C1', // pink
  '#FFB366', // orange
  '#2196F3', // blue
  '#F44336', // red
  '#A799FF', // light purple
];

export const TaskEditModal = ({ visible, onClose, task, onSave, theme }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [color, setColor] = useState(colorPalette[0]);
  const [important, setImportant] = useState(false);
  const [dueDate, setDueDate] = useState(null);
  const [dueDateText, setDueDateText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  const [tempDate, setTempDate] = useState(null);

  // Reset modal state when opening for a new task or closing
  useEffect(() => {
    if (visible) {
      if (task) {
        setTitle(task?.title || task?.name || '');
        setDescription(task?.description || '');
        setSubtasks(task?.subtasks ? [...task.subtasks] : []);
        setColor(task?.color || colorPalette[0]);
        setImportant(!!task?.important);
        setDueDate(task?.dueDate ? new Date(task.dueDate) : null);
        setDueDateText(task?.dueDate ? new Date(task.dueDate).toLocaleString() : '');
      } else {
        setTitle('');
        setDescription('');
        setSubtasks([]);
        setColor(colorPalette[0]);
        setImportant(false);
        setDueDate(null);
        setDueDateText('');
      }
    } else {
      setTitle('');
      setDescription('');
      setSubtasks([]);
      setColor(colorPalette[0]);
      setImportant(false);
      setDueDate(null);
      setDueDateText('');
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
    let finalDueDate = dueDate;
    if (!finalDueDate && dueDateText) {
      const parsed = new Date(dueDateText);
      if (!isNaN(parsed.getTime())) finalDueDate = parsed;
    }
    onSave({ ...task, title, name: title, description, subtasks, color, important, dueDate: finalDueDate ? finalDueDate.toISOString() : undefined });
    onClose();
  };
  const handleDateChange = (event, selectedDate) => {
    if (pickerMode === 'date' && selectedDate) {
      setTempDate(selectedDate);
      setPickerMode('time');
      setShowDatePicker(true);
    } else if (pickerMode === 'time' && selectedDate) {
      const combined = new Date(tempDate || dueDate || new Date());
      combined.setHours(selectedDate.getHours());
      combined.setMinutes(selectedDate.getMinutes());
      combined.setSeconds(0);
      setDueDate(combined);
      setDueDateText(combined.toLocaleString());
      setShowDatePicker(false);
      setPickerMode('date');
      setTempDate(null);
    } else {
      setShowDatePicker(false);
      setPickerMode('date');
      setTempDate(null);
    }
  };

  return (
    <RNModal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center' }}>
        <ScrollView
          style={{ maxHeight: '90%', width: '90%' }}
          contentContainerStyle={{ backgroundColor: theme.cardBackground, borderRadius: 16, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Edit Task</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Task Title"
            style={{ borderColor: theme.primary, borderWidth: 1, borderRadius: 8, color: theme.text, padding: 8, marginBottom: 12 }}
            placeholderTextColor={theme.secondaryText}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            style={{ borderColor: theme.border, borderWidth: 1, borderRadius: 8, color: theme.text, padding: 8, marginBottom: 12, minHeight: 40 }}
            placeholderTextColor={theme.secondaryText}
            multiline
          />
          {/* Due Date/Time Picker and Manual Entry */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity onPress={() => { setPickerMode('date'); setShowDatePicker(true); }} style={{ marginRight: 8, marginBottom: 4 }}>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>{dueDate ? `Due: ${dueDate.toLocaleString()}` : '+ Pick Due Date & Time'}</Text>
            </TouchableOpacity>
            <Text style={{ color: theme.secondaryText, marginHorizontal: 4, marginBottom: 4 }}>or</Text>
            <TextInput
              value={dueDateText}
              onChangeText={setDueDateText}
              placeholder="YYYY-MM-DD HH:MM"
              style={{ borderColor: theme.border, borderWidth: 1, borderRadius: 8, color: theme.text, padding: 6, minWidth: 120, maxWidth: 180, flexShrink: 1, marginBottom: 4 }}
              placeholderTextColor={theme.secondaryText}
            />
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={dueDate || new Date()}
              mode={pickerMode}
              is24Hour={true}
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}
          <Text style={{ color: theme.text, fontWeight: '600', marginBottom: 8, marginTop: 8 }}>Subtasks</Text>
          {subtasks.map((st, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity onPress={() => handleSubtaskToggle(idx)} style={{ marginRight: 8 }}>
                <MaterialCommunityIcons name={st.completed ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={theme.primary} />
              </TouchableOpacity>
              <TextInput
                value={st.text}
                onChangeText={text => handleSubtaskChange(idx, text)}
                placeholder={`Subtask ${idx + 1}`}
                style={{ flex: 1, borderBottomWidth: 1, borderColor: theme.border, color: theme.text, padding: 4 }}
                placeholderTextColor={theme.secondaryText}
              />
              <TouchableOpacity onPress={() => handleDeleteSubtask(idx)} style={{ marginLeft: 8 }}>
                <MaterialCommunityIcons name="delete" size={20} color={theme.error || '#F44336'} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={handleAddSubtask} style={{ marginVertical: 8 }}>
            <Text style={{ color: theme.primary, fontWeight: 'bold' }}>+ Add Subtask</Text>
          </TouchableOpacity>
          {/* Color selection */}
          <Text style={{ color: theme.text, fontWeight: '600', marginTop: 16, marginBottom: 4 }}>Card Color</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
            {colorPalette.map((c, idx) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: 14, backgroundColor: c, marginRight: 10, marginBottom: 8,
                  borderWidth: color === c ? 3 : 1,
                  borderColor: color === c ? theme.primary : theme.border,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                {color === c && <MaterialCommunityIcons name="check" size={18} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
          {/* Important toggle */}
          <TouchableOpacity onPress={() => setImportant(i => !i)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <MaterialCommunityIcons name={important ? 'star' : 'star-outline'} size={22} color={important ? '#FFD700' : theme.secondaryText} style={{ marginRight: 6 }} />
            <Text style={{ color: theme.text, fontWeight: '600' }}>Mark as Important</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
            <CustomButton title="Cancel" onPress={onClose} outline color={theme.primary} style={{ marginRight: 8 }} />
            <CustomButton title="Save" onPress={handleSave} color={theme.primary} />
          </View>
        </ScrollView>
      </View>
    </RNModal>
  );
};
