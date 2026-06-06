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
  // Logic: The handler now performs the filtering and slicing (top 5)
  // to prevent Binder transaction bloat. We just render what we get.
  
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
      accessibilityLabel={`${tasks.length} important tasks remaining`}
    >
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
          text="KWESTUP"
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#ffffff',
            letterSpacing: 2,
            fontWeight: 'bold',
          }}
        />
        <TextWidget
          text={` // ${tasks.length} ACTIVE`}
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#888888',
            letterSpacing: 1,
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
                  color: '#ffffff',
                  fontWeight: 'bold',
                }}
              />
              <TextWidget
                text={task.title}
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
