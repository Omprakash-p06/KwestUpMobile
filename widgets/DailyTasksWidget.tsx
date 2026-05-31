'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface DailyTasksWidgetProps {
  dailyTaskCount: number;
  dailyTasksCompleted: number;
}

/**
 * DailyTasksWidget — Android home-screen widget showing daily task completion progress.
 *
 * Pure function — NO hooks, NO React Native components (View, Text).
 * Uses only FlexWidget and TextWidget from react-native-android-widget.
 *
 * Props:
 *   dailyTaskCount      — total number of daily tasks
 *   dailyTasksCompleted — number of completed daily tasks
 */
export function DailyTasksWidget({ dailyTaskCount, dailyTasksCompleted }: DailyTasksWidgetProps) {
  const progress =
    dailyTaskCount > 0 ? Math.round((dailyTasksCompleted / dailyTaskCount) * 100) : 0;

  const allDone = dailyTaskCount > 0 && dailyTasksCompleted === dailyTaskCount;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        borderRadius: 16,
        padding: 16,
      }}
      accessibilityLabel={`Daily tasks: ${dailyTasksCompleted} of ${dailyTaskCount} completed`}
    >
      {/* Section label */}
      <TextWidget
        text="DAILY TASKS"
        style={{
          fontSize: 10,
          fontFamily: 'sans-serif-medium',
          color: '#94a3b8',
          letterSpacing: 2,
          marginBottom: 8,
        }}
      />

      {/* Completed / Total count */}
      <TextWidget
        text={`${dailyTasksCompleted} / ${dailyTaskCount}`}
        style={{
          fontSize: 36,
          fontFamily: 'sans-serif-medium',
          fontWeight: 'bold',
          color: allDone ? '#4ade80' : '#ffffff',
        }}
      />

      {/* Percentage label — only shown when there are tasks */}
      {dailyTaskCount > 0 && (
        <TextWidget
          text={`${progress}% complete`}
          style={{
            fontSize: 12,
            fontFamily: 'sans-serif',
            color: progress === 100 ? '#4ade80' : '#94a3b8',
            marginTop: 4,
          }}
        />
      )}
    </FlexWidget>
  );
}
