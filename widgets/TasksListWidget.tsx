'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface TaskItem {
  id: string;
  title: string;
  important: boolean;
  completed: boolean;
}

interface TasksListWidgetProps {
  activeTab?: 'tasks' | 'daily' | 'timer';
  tasks?: TaskItem[];
  dailyTaskCount?: number;
  dailyTasksCompleted?: number;
  timerRemaining?: number;
  isTimerRunning?: boolean;
}

export function TasksListWidget({
  activeTab = 'tasks',
  tasks = [],
  dailyTaskCount = 0,
  dailyTasksCompleted = 0,
  timerRemaining = 0,
  isTimerRunning = false,
}: TasksListWidgetProps) {
  // Daily tasks calculations
  const progress = dailyTaskCount > 0 ? Math.round((dailyTasksCompleted / dailyTaskCount) * 100) : 0;
  const totalBlocks = 10;
  const filledBlocks = dailyTaskCount > 0 ? Math.round((progress / 100) * totalBlocks) : 0;
  const emptyBlocks = totalBlocks - filledBlocks;
  const progressBar = `[${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}]`;

  // Focus timer calculations
  const minutes = Math.floor(timerRemaining / 60);
  const secs = timerRemaining % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: '#131313',
        borderWidth: 2,
        borderColor: '#ffffff',
        padding: 12,
      }}
      accessibilityLabel={`Workspace widget. Active tab: ${activeTab}`}
    >
      {/* Skeuomorphic Industrial Tab Bar */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
          borderBottomWidth: 2,
          borderColor: '#ffffff',
          paddingBottom: 6,
        }}
      >
        <FlexWidget clickAction="SWITCH_TAB" clickActionData={{ tab: 'tasks' }}>
          <TextWidget
            text="[ TASKS ]"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: activeTab === 'tasks' ? '#ffffff' : '#888888',
              fontWeight: activeTab === 'tasks' ? 'bold' : 'normal',
            }}
          />
        </FlexWidget>
        <TextWidget
          text=" // "
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#888888',
          }}
        />
        <FlexWidget clickAction="SWITCH_TAB" clickActionData={{ tab: 'daily' }}>
          <TextWidget
            text="[ DAILY ]"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: activeTab === 'daily' ? '#ffffff' : '#888888',
              fontWeight: activeTab === 'daily' ? 'bold' : 'normal',
            }}
          />
        </FlexWidget>
        <TextWidget
          text=" // "
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#888888',
          }}
        />
        <FlexWidget clickAction="SWITCH_TAB" clickActionData={{ tab: 'timer' }}>
          <TextWidget
            text="[ TIMER ]"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: activeTab === 'timer' ? '#ffffff' : '#888888',
              fontWeight: activeTab === 'timer' ? 'bold' : 'normal',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Conditionally render content depending on the active tab */}
      {activeTab === 'tasks' && (
        <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
          {tasks.length === 0 ? (
            <FlexWidget
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <TextWidget
                text="STATUS: ALL CLEAR"
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#ffffff',
                  letterSpacing: 1,
                }}
              />
            </FlexWidget>
          ) : (
            <FlexWidget
              style={{
                flexDirection: 'column',
              }}
            >
              {tasks.map((task, idx) => (
                <FlexWidget
                  key={`task-${idx}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                  clickAction="TOGGLE_TASK"
                  clickActionData={{ taskId: task.id }}
                >
                  <TextWidget
                    text={task.completed ? '[X] ' : '[ ] '}
                    style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: task.completed ? '#888888' : (task.important ? '#ffffff' : '#888888'),
                      fontWeight: 'bold',
                    }}
                  />
                  <TextWidget
                    text={task.important && !task.completed ? `* ${task.title}` : task.title}
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: task.completed ? '#888888' : '#ffffff',
                      numberOfLines: 1,
                    }}
                  />
                </FlexWidget>
              ))}
            </FlexWidget>
          )}
        </FlexWidget>
      )}

      {activeTab === 'daily' && (
        <FlexWidget
          style={{
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="DAILY OBJECTIVES"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#888888',
              letterSpacing: 2,
              marginBottom: 6,
            }}
          />
          <TextWidget
            text={`${dailyTasksCompleted} / ${dailyTaskCount}`}
            style={{
              fontSize: 28,
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: '#ffffff',
              marginBottom: 8,
            }}
          />
          {dailyTaskCount > 0 ? (
            <FlexWidget
              style={{
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <TextWidget
                text={progressBar}
                style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: '#ffffff',
                  marginBottom: 4,
                }}
              />
              <TextWidget
                text={`${progress}% COMPLETE`}
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#888888',
                  letterSpacing: 1,
                }}
              />
            </FlexWidget>
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
      )}

      {activeTab === 'timer' && (
        <FlexWidget
          style={{
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="FOCUS TIMER"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#888888',
              letterSpacing: 2,
              marginBottom: 6,
            }}
          />
          <TextWidget
            text={timeString}
            style={{
              fontSize: 32,
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: '#ffffff',
              marginBottom: 8,
            }}
          />
          <TextWidget
            text={isTimerRunning ? '[ ACTIVE ]' : '[ STANDBY ]'}
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: isTimerRunning ? '#ffffff' : '#888888',
              letterSpacing: 1,
            }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
