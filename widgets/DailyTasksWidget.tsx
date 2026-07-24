'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface DailyTasksWidgetProps {
  dailyTaskCount: number;
  dailyTasksCompleted: number;
}

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
        backgroundColor: '#1b1b1b',
        borderWidth: 3,
        borderTopColor: '#3c3c3c',
        borderLeftColor: '#3c3c3c',
        borderBottomColor: '#0a0a0a',
        borderRightColor: '#0a0a0a',
        padding: 2,
      }}
    >
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#121212',
          borderWidth: 1.5,
          borderTopColor: '#0a0a0a',
          borderLeftColor: '#0a0a0a',
          borderBottomColor: '#2b2b2b',
          borderRightColor: '#2b2b2b',
          padding: 10,
        }}
      >
        <TextWidget
          text="DAILY OBJECTIVES"
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: '#888888',
            letterSpacing: 2,
            marginBottom: 2,
          }}
        />

        <TextWidget
          text={`${dailyTasksCompleted} / ${dailyTaskCount}`}
          style={{
            fontSize: 32,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: 4,
          }}
        />

        {dailyTaskCount > 0 ? (
          <TextWidget
            text={progressBar}
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#8e7bef',
              marginBottom: 2,
            }}
          />
        ) : null}

        <TextWidget
          text={dailyTaskCount > 0 ? `${progress}% COMPLETE` : 'NO OBJECTIVES CHARGED'}
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: '#666666',
            letterSpacing: 1,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
