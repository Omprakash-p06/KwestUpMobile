'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface FocusTimerWidgetProps {
  remaining: number;
  isRunning: boolean;
}

export function FocusTimerWidget({ remaining, isRunning }: FocusTimerWidgetProps) {
  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

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
          text="FOCUS TIMER"
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: '#888888',
            letterSpacing: 2,
            marginBottom: 2,
          }}
        />

        <TextWidget
          text={timeString}
          style={{
            fontSize: 34,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: isRunning ? '#8E7BEF' : '#ffffff',
            marginBottom: 4,
          }}
        />

        <TextWidget
          text={isRunning ? '[ ACTIVE ]' : '[ STANDBY ]'}
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: isRunning ? '#8E7BEF' : '#666666',
            letterSpacing: 1,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
