'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface FocusTimerWidgetProps {
  remaining: number;
  isRunning: boolean;
}

/**
 * FocusTimerWidget — Android home-screen widget showing the Focus Timer countdown.
 *
 * Pure function — NO hooks, NO React Native components (View, Text).
 * Uses only FlexWidget and TextWidget from react-native-android-widget.
 *
 * Props:
 *   remaining  — seconds remaining on the timer
 *   isRunning  — whether the timer is currently counting down
 */
export function FocusTimerWidget({ remaining, isRunning }: FocusTimerWidgetProps) {
  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

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
      accessibilityLabel={`Focus timer: ${timeString}${isRunning ? ', active' : ', paused'}`}
    >
      {/* Timer label */}
      <TextWidget
        text="FOCUS TIMER"
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#888888',
          letterSpacing: 2,
          marginBottom: 4,
        }}
      />

      {/* MM:SS countdown */}
      <TextWidget
        text={timeString}
        style={{
          fontSize: 36,
          fontFamily: 'monospace',
          fontWeight: 'bold',
          color: '#ffffff',
          marginBottom: 6,
        }}
      />

      {/* Running / Paused status */}
      <TextWidget
        text={isRunning ? '[ ACTIVE ]' : '[ STANDBY ]'}
        style={{
          fontSize: 11,
          fontFamily: 'monospace',
          color: isRunning ? '#ffffff' : '#888888',
          letterSpacing: 1,
        }}
      />
    </FlexWidget>
  );
}
