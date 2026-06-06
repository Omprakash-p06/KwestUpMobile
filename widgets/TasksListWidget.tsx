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
  tasks: TaskItem[];
}

export function TasksListWidget({ tasks }: TasksListWidgetProps) {
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
      accessibilityLabel={`${tasks.length} active tasks pending`}
    >
      {/* Header */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
          borderBottomWidth: 2,
          borderColor: '#ffffff',
          paddingBottom: 6,
        }}
      >
        <FlexWidget
          style={{
            width: 4,
            height: 12,
            backgroundColor: '#ffffff',
            marginRight: 6,
          }}
        />
        <TextWidget
          text="ALL TASKS"
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#ffffff',
            letterSpacing: 2,
            fontWeight: 'bold',
          }}
        />
        <TextWidget
          text={` // ${tasks.length} PENDING`}
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#888888',
            letterSpacing: 1,
          }}
        />
      </FlexWidget>

      {/* Tasks List */}
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
              clickAction="COMPLETE_TASK"
              clickActionData={{ taskId: task.id }}
            >
              <TextWidget
                text={task.completed ? '[X] ' : '[ ] '}
                style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: task.important ? '#ffffff' : '#888888',
                  fontWeight: 'bold',
                }}
              />
              <TextWidget
                text={task.important ? `* ${task.title}` : task.title}
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#ffffff',
                  numberOfLines: 1,
                }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
