'use no memo';

import React from 'react';
import { FlexWidget, TextWidget, ListWidget } from 'react-native-android-widget';

interface TaskItem {
  id: string;
  title: string;
  important: boolean;
  completed: boolean;
  isTicking?: boolean;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'progressive';
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
  // Only show uncompleted tasks (or tasks currently running the tick animation)
  const activeTasks = tasks.filter((t) => !t.completed || t.isTicking);

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
              marginLeft: 12,
            }}
          />
        </FlexWidget>

        {/* Task Rows */}
        <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
          {activeTasks.length === 0 ? (
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
            <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
              {activeTasks.map((task, idx) => {
                const isDoneOrTicking = task.completed || task.isTicking;
                return (
                  <FlexWidget
                    key={`widget-task-${task.id || idx}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDoneOrTicking ? '#201a33' : '#161616',
                      borderWidth: 1,
                      borderTopColor: isDoneOrTicking ? '#30264d' : '#202020',
                      borderLeftColor: isDoneOrTicking ? '#30264d' : '#202020',
                      borderBottomColor: isDoneOrTicking ? '#151121' : '#0d0d0d',
                      borderRightColor: isDoneOrTicking ? '#151121' : '#0d0d0d',
                      paddingHorizontal: 6,
                      paddingVertical: 5,
                      marginBottom: 4,
                    }}
                    clickAction={isDoneOrTicking ? undefined : "TOGGLE_TASK"}
                    clickActionData={isDoneOrTicking ? undefined : { taskId: task.id }}
                  >
                    {/* Tactile Checkbox Button */}
                    <FlexWidget
                      style={{
                        width: 14,
                        height: 14,
                        borderWidth: 1.5,
                        borderTopColor: isDoneOrTicking ? '#0a0a0a' : '#2b2b2b',
                        borderLeftColor: isDoneOrTicking ? '#0a0a0a' : '#2b2b2b',
                        borderBottomColor: isDoneOrTicking ? '#2b2b2b' : '#0a0a0a',
                        borderRightColor: isDoneOrTicking ? '#2b2b2b' : '#0a0a0a',
                        backgroundColor: isDoneOrTicking ? '#8E7BEF' : '#121212',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                      }}
                    >
                      {isDoneOrTicking && (
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
                      text={task.important && !isDoneOrTicking ? `* ${task.title}` : task.title}
                      style={{
                        width: 'match_parent',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: isDoneOrTicking ? '#8E7BEF' : '#ffffff',
                      }}
                    />

                    {/* Recurrence Repeat Marker */}
                    {task.recurrence && task.recurrence !== 'none' && !isDoneOrTicking && (
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
                );
              })}
            </ListWidget>
          )}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
