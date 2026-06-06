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
  const totalBlocks = 10;
  const filledBlocks = Math.round((progress / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const progressBar = `[${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}]`;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#131313',
        borderWidth: 2,
        borderColor: '#ffffff',
        padding: 16,
      }}
      accessibilityLabel={`Daily tasks: ${dailyTasksCompleted} of ${dailyTaskCount} completed`}
    >
      {/* Section label */}
      <TextWidget
        text="DAILY TASKS"
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#888888',
          letterSpacing: 2,
          marginBottom: 4,
        }}
      />

      {/* Completed / Total count */}
      <TextWidget
        text={`${dailyTasksCompleted} / ${dailyTaskCount}`}
        style={{
          fontSize: 32,
          fontFamily: 'monospace',
          fontWeight: 'bold',
          color: '#ffffff',
          marginBottom: 6,
        }}
      />

      {/* Progress bar and Percentage label */}
      {dailyTaskCount > 0 ? (
        <TextWidget
          text={progressBar}
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#ffffff',
            marginBottom: 4,
          }}
        />
      ) : null}

      {dailyTaskCount > 0 ? (
        <TextWidget
          text={`${progress}% COMPLETE`}
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#888888',
            letterSpacing: 1,
          }}
        />
      ) : (
        <TextWidget
          text="NO TASKS ACTIVE"
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#888888',
            letterSpacing: 1,
          }}
        />
      )}
    </FlexWidget>
  );
}
