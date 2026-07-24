'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface ImportantTask {
  id: string;
  title: string;
  important: boolean;
  completed: boolean;
}

interface ImportantTasksWidgetProps {
  tasks: ImportantTask[];
}

export function ImportantTasksWidget({ tasks }: ImportantTasksWidgetProps) {
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
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
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
            text="IMPORTANT_QUEUE.log"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#F44336',
              fontWeight: 'bold',
            }}
          />
          <TextWidget
            text={`ACTIVE: ${tasks.length}`}
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#888888',
            }}
          />
        </FlexWidget>

        {tasks.length === 0 ? (
          <FlexWidget
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <TextWidget
              text="ALL CLEAR // SYSTEM SECURE"
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
            {tasks.map((task, idx) => (
              <FlexWidget
                key={`task-${idx}`}
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
                    backgroundColor: task.completed ? '#F44336' : '#121212',
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

                <TextWidget
                  text={task.title}
                  style={{
                    width: 'match_parent',
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: '#ffffff',
                  }}
                />
              </FlexWidget>
            ))}
          </FlexWidget>
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
