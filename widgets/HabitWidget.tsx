'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetTouchpoint } from '../src/behavior/types';

export interface HabitWidgetProps {
  touchpoint?: WidgetTouchpoint;
}

/**
 * HabitWidget — Android home-screen widget for behavioral interventions,
 * 2-minute starter actions, and "Never Miss Twice" recovery protocols.
 * Designed with KwestUp's tactile industrial console aesthetic.
 */
export function HabitWidget({ touchpoint }: HabitWidgetProps) {
  const currentTouchpoint: WidgetTouchpoint = touchpoint || {
    type: 'standby',
    title: 'SYS_STANDBY',
    subtitle: 'ALL PROTOCOLS SATISFIED // STANDBY',
    actionLabel: '[ STANDBY ]',
    actionType: 'STANDBY',
    rulesApplied: ['WIDGET_PRIORITY_001'],
  };

  const isRecovery = currentTouchpoint.type === 'recovery';
  const isTodayDue = currentTouchpoint.type === 'today_due';
  const isNextAction = currentTouchpoint.type === 'next_action';
  const isStandby = currentTouchpoint.type === 'standby';

  // Accent color mapping based on priority hierarchy
  let tagColor: `#${string}` = '#888888';
  let tagText = '[ SYS_STANDBY ]';
  let buttonColor: `#${string}` = '#444444';
  let buttonBorder: `#${string}` = '#2b2b2b';

  if (isRecovery) {
    tagColor = '#F44336'; // High priority recovery red
    tagText = '[ RECOVERY PROTOCOL ]';
    buttonColor = '#2b1414';
    buttonBorder = '#F44336';
  } else if (isTodayDue) {
    tagColor = '#8E7BEF'; // Core habit purple
    tagText = '[ TODAY OBJECTIVE ]';
    buttonColor = '#1e1833';
    buttonBorder = '#8E7BEF';
  } else if (isNextAction) {
    tagColor = '#80CBC4'; // 2-min starter cyan
    tagText = '[ 2-MIN MINIMUM ]';
    buttonColor = '#142b27';
    buttonBorder = '#80CBC4';
  }

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
          justifyContent: 'space-between',
          backgroundColor: '#121212',
          borderWidth: 1.5,
          borderTopColor: '#0a0a0a',
          borderLeftColor: '#0a0a0a',
          borderBottomColor: '#2b2b2b',
          borderRightColor: '#2b2b2b',
          padding: 8,
        }}
      >
        {/* Terminal Header Bar */}
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1a1a1a',
            borderWidth: 1.5,
            borderTopColor: '#2c2c2c',
            borderLeftColor: '#2c2c2c',
            borderBottomColor: '#0f0f0f',
            borderRightColor: '#0f0f0f',
            paddingHorizontal: 6,
            paddingVertical: 3,
            width: 'match_parent',
          }}
        >
          <TextWidget
            text={tagText}
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: tagColor,
              fontWeight: 'bold',
            }}
          />
          <TextWidget
            text="BEHAVIOR_CORE.01"
            style={{
              fontSize: 8,
              fontFamily: 'monospace',
              color: '#666666',
            }}
          />
        </FlexWidget>

        {/* Behavioral Content Plate */}
        <FlexWidget
          style={{
            flexDirection: 'column',
            width: 'match_parent',
            paddingVertical: 4,
          }}
        >
          <TextWidget
            text={currentTouchpoint.title}
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: '#ffffff',
              marginBottom: 2,
            }}
          />
          <TextWidget
            text={currentTouchpoint.subtitle}
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#aaaaaa',
            }}
          />
        </FlexWidget>

        {/* Action Button */}
        <FlexWidget
          clickAction={
            isStandby ? undefined : (currentTouchpoint.actionType as string)
          }
          clickActionData={
            isStandby || !currentTouchpoint.habitId
              ? undefined
              : { habitId: currentTouchpoint.habitId }
          }
          style={{
            height: 28,
            width: 'match_parent',
            backgroundColor: buttonColor,
            borderWidth: 1.5,
            borderTopColor: isStandby ? '#2b2b2b' : buttonBorder,
            borderLeftColor: isStandby ? '#2b2b2b' : buttonBorder,
            borderBottomColor: '#0a0a0a',
            borderRightColor: '#0a0a0a',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 8,
          }}
        >
          <TextWidget
            text={currentTouchpoint.actionLabel}
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: isStandby ? '#666666' : tagColor,
              letterSpacing: 1,
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

export default HabitWidget;
