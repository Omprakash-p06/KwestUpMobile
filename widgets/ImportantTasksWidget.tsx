'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface ImportantTask {
  title: string;
  important: boolean;
  completed: boolean;
}

interface ImportantTasksWidgetProps {
  tasks: ImportantTask[];
}

export function ImportantTasksWidget({ tasks }: ImportantTasksWidgetProps) {
  const importantUnfinished = tasks.filter(t => t.important && !t.completed).slice(0, 5);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: '#131313',
        padding: 12,
      }}
      accessibilityLabel={`${importantUnfinished.length} important tasks remaining`}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
          borderBottomWidth: 1,
          borderColor: '#333333',
          paddingBottom: 6,
        }}
      >
        <FlexWidget
          style={{
            width: 4,
            height: 16,
            backgroundColor: '#ffffff',
            marginRight: 8,
          }}
        />
        <TextWidget
          text="KWESTUP"
          style={{
            fontSize: 10,
            fontFamily: 'sans-serif-medium',
            color: '#ffffff',
            letterSpacing: 2,
            fontWeight: 'bold',
          }}
        />
        <TextWidget
          text={` ${importantUnfinished.length} TASKS`}
          style={{
            fontSize: 10,
            fontFamily: 'sans-serif',
            color: '#888888',
            letterSpacing: 1,
          }}
        />
      </FlexWidget>

      {importantUnfinished.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="ALL TASKS COMPLETE"
            style={{
              fontSize: 13,
              fontFamily: 'sans-serif',
              color: '#4ade80',
              letterSpacing: 1,
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {importantUnfinished.map((task, idx) => (
            <FlexWidget
              key={`task-${idx}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FlexWidget
                style={{
                  width: 14,
                  height: 14,
                  borderWidth: 2,
                  borderColor: '#ffffff',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <TextWidget
                  text=""
                  style={{ fontSize: 8, color: '#ffffff' }}
                />
              </FlexWidget>
              <TextWidget
                text={task.title}
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontFamily: 'sans-serif',
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
