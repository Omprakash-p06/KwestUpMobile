'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface TaskItem {
  id: string;
  title: string;
  important: boolean;
  completed: boolean;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}

interface TasksListWidgetProps {
  tasks?: TaskItem[];
}

/**
 * TasksListWidget — Android home-screen widget showing active tasks.
 * Designed with a premium retro-mechanical skeuomorphic plate.
 */
export function TasksListWidget({
  tasks = [],
}: TasksListWidgetProps) {
  // Sort tasks: uncompleted first, then completed. Limit to 6 to fit resizable frame sizes.
  const sortedTasks = [...tasks]
    .sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return 0;
    })
    .slice(0, 6);

  const activeCount = tasks.filter(t => !t.completed).length;

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
      accessibilityLabel="Workspace active tasks queue widget"
    >
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          flexDirection: 'column',
          backgroundColor: '#121212',
          borderWidth: 1.5,
          borderTopColor: '#0a0a0a',
          borderLeftColor: '#0a0a0a',
          borderBottomColor: '#2b2b2b',
          borderRightColor: '#2b2b2b',
          padding: 10,
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
            paddingHorizontal: 8,
            paddingVertical: 5,
            marginBottom: 8,
          }}
        >
          <TextWidget
            text="SYS_QUEUE.log"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#8E7BEF',
              fontWeight: 'bold',
            }}
          />
          <TextWidget
            text={`ACTIVE: ${activeCount}`}
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#888888',
            }}
          />
        </FlexWidget>

        {/* Task Rows */}
        <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
          {sortedTasks.length === 0 ? (
            <FlexWidget
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <TextWidget
                text="SYSTEM CLEAR // STANDBY"
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#666666',
                  letterSpacing: 1,
                }}
              />
            </FlexWidget>
          ) : (
            <FlexWidget style={{ flexDirection: 'column' }}>
              {sortedTasks.map((task, idx) => (
                <FlexWidget
                  key={`widget-task-${task.id || idx}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#161616',
                    borderWidth: 1,
                    borderTopColor: '#202020',
                    borderLeftColor: '#202020',
                    borderBottomColor: '#0d0d0d',
                    borderRightColor: '#0d0d0d',
                    paddingHorizontal: 6,
                    paddingVertical: 5,
                    marginBottom: 4,
                  }}
                  clickAction="TOGGLE_TASK"
                  clickActionData={{ taskId: task.id }}
                >
                  {/* Tactile Checkbox Button */}
                  <FlexWidget
                    style={{
                      width: 14,
                      height: 14,
                      borderWidth: 1.5,
                      borderTopColor: task.completed ? '#0a0a0a' : '#2b2b2b',
                      borderLeftColor: task.completed ? '#0a0a0a' : '#2b2b2b',
                      borderBottomColor: task.completed ? '#2b2b2b' : '#0a0a0a',
                      borderRightColor: task.completed ? '#2b2b2b' : '#0a0a0a',
                      backgroundColor: task.completed ? '#8E7BEF' : '#121212',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                    }}
                  >
                    {task.completed && (
                      <TextWidget
                        text="✔"
                        style={{
                          fontSize: 9,
                          color: '#ffffff',
                          fontWeight: 'bold',
                        }}
                      />
                    )}
                  </FlexWidget>

                  {/* Task Title */}
                  <TextWidget
                    text={task.important && !task.completed ? `* ${task.title}` : task.title}
                    style={{
                      flex: 1,
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: task.completed ? '#666666' : '#ffffff',
                      textDecorationLine: task.completed ? 'line-through' : 'none',
                    }}
                  />

                  {/* Recurrence Repeat Marker */}
                  {task.recurrence && task.recurrence !== 'none' && !task.completed && (
                    <TextWidget
                      text="⟳"
                      style={{
                        fontSize: 12,
                        color: '#8E7BEF',
                        fontWeight: 'bold',
                        marginLeft: 4,
                      }}
                    />
                  )}
                </FlexWidget>
              ))}
            </FlexWidget>
          )}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
