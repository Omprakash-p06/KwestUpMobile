import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LiquidGlassCard } from '../components/LiquidGlassCard';
import { LiquidGlassBackground } from '../components/LiquidGlassBackground';
import { CustomTextInput } from '../components/CustomTextInput';
import { TaskCard } from '../components/TaskCard';

export const SearchScreen = ({
  currentTheme,
  setSelectedTask,
  setModalVisible,
  dailyTasks = [],
  birthdays = [],
  tasks = [],
  notes = [],
  searchQuery,
  setSearchQuery,
  toggleTaskComplete,
  deleteTask,
  setDailyTasks,
}) => {
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return tasks.filter(t => 
      (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [tasks, searchQuery]);

  const filteredDailyTasks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return dailyTasks.filter(t => 
      t.name && t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [dailyTasks, searchQuery]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return notes.filter(n => 
      (n.title && n.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (n.content && n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [notes, searchQuery]);

  const filteredBirthdays = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return birthdays.filter(b => 
      b.name && b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [birthdays, searchQuery]);

  const hasResults = 
    filteredTasks.length > 0 || 
    filteredDailyTasks.length > 0 || 
    filteredNotes.length > 0 || 
    filteredBirthdays.length > 0;

  const handleToggleDailyTask = (taskId) => {
    const today = new Date().toISOString().slice(0, 10);
    setDailyTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        const newCompletedStatus = !task.completed;
        return {
          ...task,
          completed: newCompletedStatus,
          completedDate: newCompletedStatus ? today : null,
          lastCompletedDate: newCompletedStatus ? today : null,
        };
      }
      return task;
    }));
  };

  const handleOpenTask = (task) => {
    setSelectedTask(task);
    setModalVisible(true);
  };

  return (
    <LiquidGlassBackground theme={currentTheme}>
      <View style={styles.searchHeader}>
        <CustomTextInput
          placeholder="ENTER_QUERY_PARAMETERS..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon="magnify"
          theme={currentTheme}
        />
      </View>

      <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.scrollPadding}>
        {!hasResults && searchQuery.length > 0 ? (
          <LiquidGlassCard theme={currentTheme} style={styles.emptyCard}>
            <MaterialCommunityIcons name="magnify-minus-outline" size={48} color={currentTheme.secondaryText} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyText, { color: currentTheme.secondaryText }]}>
              {"NO SYSTEM MATCHES FOUND FOR: " + searchQuery.toUpperCase()}
            </Text>
          </LiquidGlassCard>
        ) : (
          <View style={styles.resultsStack}>
            
            {/* 1. General Tasks Results */}
            {filteredTasks.length > 0 && (
              <View style={styles.categoryBlock}>
                <View style={styles.categoryHeader}>
                  <MaterialCommunityIcons name="format-list-bulleted" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.categoryTitle, { color: currentTheme.text }]}>TASK_QUEUE_MATCHES</Text>
                </View>
                {filteredTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    theme={currentTheme}
                    onPress={() => handleOpenTask(task)}
                    onComplete={() => toggleTaskComplete(task.id)}
                    onUncomplete={() => toggleTaskComplete(task.id)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </View>
            )}

            {/* 2. Daily Tasks Results */}
            {filteredDailyTasks.length > 0 && (
              <View style={styles.categoryBlock}>
                <View style={styles.categoryHeader}>
                  <MaterialCommunityIcons name="calendar-check" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.categoryTitle, { color: currentTheme.text }]}>DIARY_MATCHES</Text>
                </View>
                {filteredDailyTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    theme={currentTheme}
                    onComplete={() => handleToggleDailyTask(task.id)}
                    onUncomplete={() => handleToggleDailyTask(task.id)}
                  />
                ))}
              </View>
            )}

            {/* 3. Birthdays Results */}
            {filteredBirthdays.length > 0 && (
              <View style={styles.categoryBlock}>
                <View style={styles.categoryHeader}>
                  <MaterialCommunityIcons name="cake-variant" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.categoryTitle, { color: currentTheme.text }]}>BIRTHDAY_MATCHES</Text>
                </View>
                {filteredBirthdays.map(bday => (
                  <TaskCard
                    key={bday.id}
                    task={bday}
                    theme={currentTheme}
                    type="birthday"
                  />
                ))}
              </View>
            )}

            {/* 4. Notes Results */}
            {filteredNotes.length > 0 && (
              <View style={styles.categoryBlock}>
                <View style={styles.categoryHeader}>
                  <MaterialCommunityIcons name="note-text-outline" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.categoryTitle, { color: currentTheme.text }]}>DATA_MODULE_MATCHES</Text>
                </View>
                {filteredNotes.map(note => (
                  <LiquidGlassCard key={note.id} theme={currentTheme} style={styles.noteResult}>
                    <Text style={[styles.noteTitle, { color: currentTheme.text }]}>{note.title}</Text>
                    <Text style={[styles.noteSnippet, { color: currentTheme.secondaryText }]} numberOfLines={2}>
                      {note.content}
                    </Text>
                  </LiquidGlassCard>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </LiquidGlassBackground>
  );
};

const styles = StyleSheet.create({
  searchHeader: {
    padding: 16,
    paddingTop: 8,
  },
  resultsScroll: {
    flex: 1,
  },
  scrollPadding: {
    paddingBottom: 40,
  },
  emptyCard: {
    margin: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'JetBrainsMono-Bold',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  resultsStack: {
    padding: 16,
    paddingTop: 0,
  },
  categoryBlock: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  categoryTitle: {
    fontFamily: 'JetBrainsMono-Bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  noteResult: {
    marginBottom: 10,
    padding: 12,
  },
  noteTitle: {
    fontFamily: 'JetBrainsMono-Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  noteSnippet: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 12,
  },
});
