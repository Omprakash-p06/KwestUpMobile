# Phase 2 Technical Research: Google Tasks-style Task Management

This document provides technical ecosystem research, data schemas, and UI design patterns for implementing **Phase 2: Google Tasks-style Task Management** in KwestUp Mobile.

---

## Standard Stack

* **State & Core Storage**: `AsyncStorage` (from `@react-native-async-storage/async-storage`) remains our source of truth. Keeping all tasks and lists in a unified JSON structure under `kwestup_data_${STORAGE_VERSION}` keeps the codebase fast and allows seamless sync with the Electron PC client.
* **Layout Paging**: Native `<ScrollView>` with `horizontal`, `pagingEnabled`, and `decelerationRate="fast"`. This utilizes native OS physics for page snapping, ensuring maximum performance and zero jitter compared to custom JS-based touch-responders.
* **Animations**: `react-native-reanimated` (already installed) to animate the task checking feedback (scale-pop) and progress bar transitions.
* **Gestures**: `react-native-gesture-handler` (already installed) wrapped in `GestureHandlerRootView` is pre-configured and ready for drag/swipe behaviors.
* **Icons**: `@expo/vector-icons` (MaterialCommunityIcons) for list management (plus, edit, delete, folder, checkbox) and priority stars.

---

## Architecture Patterns

### 1. Unified Task & List Schema
To support custom categories (Task Lists) while preserving full compatibility with our flat-file local sync, tasks are mapped to custom lists using a relational list identifier.

```typescript
// Custom list model
interface TaskListCategory {
  id: string;
  name: string;
  createdAt: string;
}

// Updated Task model
interface Task {
  id: string;
  listId: string;        // Relational pointer (defaults to "default_inbox")
  title: string;
  description?: string;  // Multi-line notes
  dueDate?: string;      // ISO string
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  completedAt?: string;
  color?: string;        // Visual accent hex
  important: boolean;
  subtasks: Subtask[];
  notificationId?: string;
}

// Subtask model
interface Subtask {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
}
```

### 2. Tab Bar + ViewPager Sync Pattern
To simulate the smooth swipeable list navigation of Google Tasks, we coordinate a horizontal scrollbar of category tabs at the top with a horizontal paging `ScrollView` containing the task list cards below.

* **Bidirectional Sync**: 
  1. Swiping the lower scroll view triggers `onMomentumScrollEnd` to update the active tab index.
  2. Tapping a tab triggers `scrollTo` on the scroll view ref to snap to the correct offset.

### 3. Dynamic Progress Selection
Progress is computed dynamically on the fly to avoid redundant states that could desynchronize.
```javascript
const getTaskProgress = (task) => {
  const total = task.subtasks ? task.subtasks.length : 0;
  if (total === 0) return { percent: 0, text: '' };
  
  const completed = task.subtasks.filter(st => st.completed).length;
  return {
    percent: completed / total,
    text: `${completed}/${total} completed`
  };
};
```

---

## Don't Hand-Roll

* **Horizontal Swipe Snapping**: Do **not** use custom raw touch responders or hand-rolled gesture mathematics to snap lists horizontally. Use React Native's `<ScrollView horizontal pagingEnabled>` which leverages OS native scroll momentum and snaps flawlessly across iOS, Android, and Web.
* **State Managers**: Do **not** introduce complex Redux, MobX, or SQLite databases at this stage. Keep the data flow in standard React state within `App.js` and use props to delegate downward, maintaining the lightweight local-first design that simplifies synchronization.

---

## Common Pitfalls

* **Dynamic Screen Width Transitions**: If the device rotates, hardcoded layouts based on initial `Dimensions.get("window").width` will break.
  * *Fix*: Use the `onLayout` handler of the container or dynamic Tailwind-like percentages to dynamically calculate screen widths for scroll paging.
* **ScrollView keyboardDismissMode Issues**: Interacting with subtasks or editing tasks inside swipable views can cause the keyboard to hide unexpectedly.
  * *Fix*: Set `keyboardShouldPersistTaps="handled"` on the horizontal scroll container and outer screen layouts.
* **Deep Nested Object Mutations**: Directly mutating `tasks[index].subtasks[subIndex].completed = true` in React breaks state change detection and skips UI re-renders.
  * *Fix*: Always use shallow copying arrays/objects:
    ```javascript
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      subtasks: t.subtasks.map((st, i) => i === idx ? { ...st, completed: !st.completed } : st)
    } : t));
    ```

---

## Code Examples

### Horizontal ViewPager Paging
An elegant wrapper component to handle list swiping:

```javascript
import React, { useRef, useState } from 'react';
import { View, ScrollView, Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SwipeableTaskContainer = ({ taskLists, renderListScreen }) => {
  const scrollViewRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleTabPress = (index) => {
    setActiveIndex(index);
    scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const handleScroll = (event) => {
    const xOffset = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(xOffset / SCREEN_WIDTH);
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  };

  return (
    <View style={styles.container}>
      {/* Category Horizontal Tab Bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {taskLists.map((list, index) => (
            <TabItem
              key={list.id}
              title={list.name}
              active={index === activeIndex}
              onPress={() => handleTabPress(index)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Swipeable Sheets */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
      >
        {taskLists.map((list) => (
          <View key={list.id} style={{ width: SCREEN_WIDTH }}>
            {renderListScreen(list)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { height: 50, borderBottomWidth: 1, borderColor: '#eee' }
});
```

### Animated Subtask Checkmark
A micro-interaction built using Reanimated for that premium feeling when completing a subtask:

```javascript
import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const AnimatedSubtaskCheckbox = ({ checked, onPress, theme }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.7, { damping: 4 }, () => {
      scale.value = withSpring(1);
    });
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={animatedStyle}>
        <MaterialCommunityIcons
          name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={22}
          color={checked ? theme.primary : theme.secondaryText}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};
```
