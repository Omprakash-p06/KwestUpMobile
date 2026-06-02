import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Color from "color";
import { styles } from "../theme/styles";
import { LiquidGlassCard } from "./LiquidGlassCard";

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
    // birthDate is task.birthDate or task.date
    const dateStr = task.birthDate || task.date || "";
    
    // Calculate stats safely
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

    let ageText = "";
    if (birthYear) {
      const upcomingAge = nextBday.getFullYear() - birthYear;
      const currentAge = upcomingAge - 1;
      if (diffDays === 0) {
        ageText = `Turns ${upcomingAge} today!`;
      } else {
        ageText = `Turns ${upcomingAge} (Age: ${currentAge})`;
      }
    }

    let countdownText = "";
    if (diffDays === 0) {
      countdownText = "TODAY!";
    } else if (diffDays === 1) {
      countdownText = "tomorrow!";
    } else {
      countdownText = `in ${diffDays} days`;
    }

    // Format display date: "Month Day" e.g. "Oct 15"
    const monthsName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const displayDate = `${monthsName[month]} ${day}`;

    return (
      <LiquidGlassCard
        theme={currentTheme}
        style={{
          marginVertical: 10,
          marginHorizontal: 2,
          borderWidth: 1.5,
          borderColor,
          ...importantGlow,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ color: textColor, fontWeight: '700', fontSize: 17, marginBottom: 2 }}>{task.title || task.name || 'Birthday'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
              <MaterialCommunityIcons name="cake-variant" size={18} color={cardAccent} style={{ marginRight: 4 }} />
              <Text style={{ color: cardAccent, fontWeight: '700', fontSize: 14, marginRight: 8 }}>{displayDate}</Text>
              <Text style={{ color: currentTheme.secondaryText || '#888', fontSize: 13, marginRight: 8 }}>•</Text>
              <Text style={{ color: diffDays === 0 ? (currentTheme.success || '#4CAF50') : cardAccent, fontWeight: '700', fontSize: 14 }}>{countdownText}</Text>
            </View>
            {ageText ? (
              <Text style={{ color: currentTheme.secondaryText || '#888', fontSize: 13, marginTop: 4, fontWeight: '600' }}>
                {ageText}
              </Text>
            ) : null}
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
      </LiquidGlassCard>
    );
  }

  const completed = task.subtasks ? task.subtasks.filter(st => st.completed).length : 0;
  const total = task.subtasks ? task.subtasks.length : 0;
  const progress = total > 0 ? completed / total : 0;
  
  return (
    <LiquidGlassCard
      theme={currentTheme}
      style={{
        marginVertical: 10,
        marginHorizontal: 2,
        borderWidth: 1.5,
        borderColor,
        ...importantGlow,
      }}
    >
      <View style={{ width: '100%' }}>
        <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: cardAccent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2, zIndex: 2 }}>
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
          <Text style={{ color: cardAccent, fontWeight: '600', fontSize: 13, marginRight: 8 }}>PROGRESS</Text>
          <View style={{ flex: 1, height: 7, backgroundColor: currentTheme.border || '#F0F2F6', borderRadius: 4, overflow: 'hidden', marginRight: 8 }}>
            <View style={{ width: `${(task.subtasks && task.subtasks.length > 0 ? (task.subtasks.filter(st => st.completed).length / task.subtasks.length) : 0) * 100}%`, height: 7, backgroundColor: cardAccent, borderRadius: 4, opacity: (task.subtasks && task.subtasks.length > 0) ? 1 : 0.25 }} />
          </View>
          <Text style={{ color: cardAccent, fontWeight: '700', fontSize: 13 }}>
            {task.subtasks && task.subtasks.length > 0 
              ? `${task.subtasks.filter(st => st.completed).length}/${task.subtasks.length} (${Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)}%)` 
              : '0%'}
          </Text>
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
    </LiquidGlassCard>
  );
};
