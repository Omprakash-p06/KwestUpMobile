import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Color from "color";
import { styles } from "../theme/styles";

export const TaskCard = ({ task, onPress, onComplete, onUncomplete, onDelete, theme, accent, type, onToggleSubtask }) => {
  const { colors: themeColors } = useTheme();
  const currentTheme = theme || themeColors;
  const cardBg = currentTheme.cardBackground || '#fff';
  const cardAccent = accent || currentTheme.primary;
  const borderColor = task.important ? cardAccent : (currentTheme.border || '#E5EAF1');
  const isAccentDark = Color(cardAccent).isDark();
  const accentTextColor = isAccentDark ? '#fff' : '#222';
  const textColor = isAccentDark && task.color ? '#fff' : (currentTheme.text || '#222');
  const glowColor = (cardAccent && (Color(cardAccent).isDark() || Color(currentTheme.cardBackground).isDark())) ? '#a799ff' : cardAccent;
  
  const importantGlow = task.important
    ? {
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 18,
        elevation: 16,
        borderWidth: 2,
        borderColor: glowColor,
        ...(Platform.OS === 'web' ? { boxShadow: `0 0 16px 2px ${glowColor}` } : {}),
      }
    : {};

  if (type === 'birthday') {
    return (
      <View style={{
        backgroundColor: cardBg,
        borderRadius: 18,
        padding: 20,
        marginVertical: 10,
        marginHorizontal: 2,
        borderWidth: 1.5,
        borderColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        minHeight: 80,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...importantGlow,
      }}>
        <View>
          <Text style={{ color: textColor, fontWeight: '700', fontSize: 17, marginBottom: 2 }}>{task.title || task.name || 'Birthday'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <MaterialCommunityIcons name="cake-variant" size={18} color={cardAccent} style={{ marginRight: 4 }} />
            <Text style={{ color: cardAccent, fontWeight: '600', fontSize: 14 }}>{task.date}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {task.completed ? (
            <TouchableOpacity 
              onPress={() => onUncomplete && onUncomplete(task.id)} 
              style={{ marginLeft: 8, backgroundColor: currentTheme.warning + '22', borderRadius: 8, padding: 8 }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={22} color={currentTheme.warning || '#D32F2F'} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={() => onComplete && onComplete(task.id)} 
              style={{ backgroundColor: cardAccent, borderRadius: 8, padding: 8 }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={22} color={accentTextColor} />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => onDelete && onDelete(task.id)} 
            style={{ marginLeft: 8, backgroundColor: currentTheme.error + '22', borderRadius: 8, padding: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={currentTheme.error || '#D32F2F'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const completed = task.subtasks ? task.subtasks.filter(st => st.completed).length : 0;
  const total = task.subtasks ? task.subtasks.length : 0;
  const progress = total > 0 ? completed / total : 0;
  
  return (
    <View style={{
      backgroundColor: cardBg,
      borderRadius: 18,
      padding: 20,
      marginVertical: 10,
      marginHorizontal: 2,
      borderWidth: 1.5,
      borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
      minHeight: 120,
      ...importantGlow,
    }}>
      <View style={{ position: 'absolute', top: 14, right: 18, backgroundColor: cardAccent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2 }}>
        <Text style={{ color: accentTextColor, fontWeight: '700', fontSize: 12 }}>{(task.completed ? 'COMPLETED' : (task.subtasks && task.subtasks.some(st => st.completed) ? 'IN PROGRESS' : 'NOT STARTED')).toUpperCase()}</Text>
      </View>
      <TouchableOpacity onPress={onPress ? () => onPress(task) : null} activeOpacity={onPress ? 0.93 : 1}>
        <Text style={{ color: textColor, fontWeight: '700', fontSize: 17, marginBottom: 2 }} numberOfLines={1}>{task.title || task.name || 'Untitled'}</Text>
        {task.description ? <Text style={{ color: currentTheme.secondaryText || '#888', fontSize: 14, marginBottom: 6 }} numberOfLines={2}>{task.description}</Text> : null}
      </TouchableOpacity>
      {task.dueDate && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <MaterialCommunityIcons name="calendar-clock" size={17} color={cardAccent} style={{ marginRight: 4 }} />
          <Text style={{ color: cardAccent, fontWeight: '600', fontSize: 13 }}>{new Date(task.dueDate).toLocaleString()}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 2 }}>
        <Text style={{ color: cardAccent, fontWeight: '600', fontSize: 13, marginRight: 8 }}>TASK PROGRESS</Text>
        <View style={{ flex: 1, height: 7, backgroundColor: currentTheme.border || '#F0F2F6', borderRadius: 4, overflow: 'hidden', marginRight: 8 }}>
          <View style={{ width: `${(task.subtasks && task.subtasks.length > 0 ? (task.subtasks.filter(st => st.completed).length / task.subtasks.length) : 0) * 100}%`, height: 7, backgroundColor: cardAccent, borderRadius: 4, opacity: (task.subtasks && task.subtasks.length > 0) ? 1 : 0.25 }} />
        </View>
        <Text style={{ color: cardAccent, fontWeight: '700', fontSize: 13 }}>{task.subtasks && task.subtasks.length > 0 ? `${Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)}%` : '0%'}</Text>
      </View>
      {task.subtasks && task.subtasks.length > 0 && (
        <View style={{ marginBottom: 8, marginLeft: 2 }}>
          <Text style={{ color: cardAccent, fontWeight: '600', fontSize: 13, marginBottom: 2 }}>{`SUB-TASKS: ${task.subtasks.length}`}</Text>
          {task.subtasks.slice(0, 4).map((st, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <TouchableOpacity onPress={() => onToggleSubtask && onToggleSubtask(task.id, idx)}>
                <MaterialCommunityIcons
                  name={st.completed ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={17}
                  color={st.completed ? cardAccent : (currentTheme.secondaryText || '#B0B0B0')}
                  style={{ marginRight: 6 }}
                />
              </TouchableOpacity>
              <Text style={{ color: st.completed ? (currentTheme.secondaryText || '#B0B0B0') : textColor, textDecorationLine: st.completed ? 'line-through' : 'none', opacity: st.completed ? 0.6 : 1, fontSize: 14 }} numberOfLines={1}>{st.text}</Text>
            </View>
          ))}
          {task.subtasks.length > 4 && (
            <Text style={{ color: cardAccent, fontSize: 12, marginLeft: 24 }}>+{task.subtasks.length - 4} more subtasks</Text>
          )}
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8 }}>
        {task.completed ? (
          <TouchableOpacity 
            onPress={() => onUncomplete && onUncomplete(task.id)} 
            style={{ marginLeft: 8, backgroundColor: currentTheme.warning + '22', borderRadius: 8, padding: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={22} color={currentTheme.warning || '#D32F2F'} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={() => onComplete && onComplete(task.id)} 
            style={{ backgroundColor: cardAccent, borderRadius: 8, padding: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={accentTextColor} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          onPress={() => onDelete && onDelete(task.id)} 
          style={{ marginLeft: 8, backgroundColor: currentTheme.error + '22', borderRadius: 8, padding: 8 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={currentTheme.error || '#D32F2F'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
