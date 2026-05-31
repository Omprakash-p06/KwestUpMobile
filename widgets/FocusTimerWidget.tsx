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
        backgroundColor: '#1a1a2e',
        borderRadius: 16,
        padding: 16,
      }}
      accessibilityLabel={`Focus timer: ${timeString}${isRunning ? ', active' : ', paused'}`}
    >
      {/* Timer label */}
      <TextWidget
        text="FOCUS TIMER"
        style={{
          fontSize: 10,
          fontFamily: 'sans-serif-medium',
          color: '#94a3b8',
          letterSpacing: 2,
          marginBottom: 8,
        }}
      />

      {/* MM:SS countdown */}
      <TextWidget
        text={timeString}
        style={{
          fontSize: 32,
          fontFamily: 'sans-serif-medium',
          color: '#ffffff',
          fontWeight: 'bold',
        }}
      />

      {/* Running / Paused status */}
      <TextWidget
        text={isRunning ? '● Focus Active' : '○ Timer Paused'}
        style={{
          fontSize: 14,
          fontFamily: 'sans-serif',
          color: isRunning ? '#4ade80' : '#94a3b8',
          marginTop: 4,
        }}
      />
    </FlexWidget>
  );
}
