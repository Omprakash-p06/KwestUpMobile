import React from "react";
import { View, Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TaskProvider, useTasks } from "../../src/context/TaskContext";
import { STORAGE_VERSION } from "../../src/utils/storage";

let contextValue = null;

const TestTaskConsumer = () => {
  contextValue = useTasks();
  return (
    <View>
      <Text>Test Consumer</Text>
    </View>
  );
};

describe("TaskContext & Provider Unit Tests", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    contextValue = null;
  });

  it("provides initial tasks and renders correctly", async () => {
    const initialTasks = [
      { id: "task-1", title: "First Task", completed: false },
      { id: "task-2", title: "Second Task", completed: true },
    ];

    await act(async () => {
      renderer.create(
        <TaskProvider initialTasks={initialTasks}>
          <TestTaskConsumer />
        </TaskProvider>
      );
    });

    expect(contextValue).toBeDefined();
    expect(contextValue.tasks).toHaveLength(2);
    expect(contextValue.tasks[0].title).toBe("First Task");
    expect(contextValue.tasks[0].completed).toBe(false);
    expect(contextValue.tasks[1].completed).toBe(true);
  });

  it("toggles task completion via toggleTaskComplete", async () => {
    const initialTasks = [{ id: "t1", title: "Toggle Me", completed: false }];

    await act(async () => {
      renderer.create(
        <TaskProvider initialTasks={initialTasks}>
          <TestTaskConsumer />
        </TaskProvider>
      );
    });

    expect(contextValue.tasks[0].completed).toBe(false);

    await act(async () => {
      contextValue.toggleTaskComplete("t1");
    });

    expect(contextValue.tasks[0].completed).toBe(true);
  });

  it("adds new task via handleSaveTask", async () => {
    await act(async () => {
      renderer.create(
        <TaskProvider initialTasks={[]}>
          <TestTaskConsumer />
        </TaskProvider>
      );
    });

    expect(contextValue.tasks).toHaveLength(0);

    await act(async () => {
      await contextValue.handleSaveTask({ title: "New Context Task" });
    });

    expect(contextValue.tasks).toHaveLength(1);
    expect(contextValue.tasks[0].title).toBe("New Context Task");
    expect(contextValue.tasks[0].listId).toBe("default_inbox");
  });

  it("deletes a task via deleteTask", async () => {
    const initialTasks = [{ id: "del-1", title: "Delete Me", completed: false }];

    await act(async () => {
      renderer.create(
        <TaskProvider initialTasks={initialTasks}>
          <TestTaskConsumer />
        </TaskProvider>
      );
    });

    expect(contextValue.tasks).toHaveLength(1);

    await act(async () => {
      contextValue.deleteTask("del-1");
    });

    expect(contextValue.tasks).toHaveLength(0);
  });

  it("synchronizes with AsyncStorage when refreshTasksFromStorage is invoked (widget parity)", async () => {
    const initialTasks = [{ id: "t1", title: "In-Memory Task", completed: false }];

    await act(async () => {
      renderer.create(
        <TaskProvider initialTasks={initialTasks}>
          <TestTaskConsumer />
        </TaskProvider>
      );
    });

    expect(contextValue.tasks).toHaveLength(1);

    // Simulate home-screen widget writing an updated tasks array directly to AsyncStorage
    const storageKey = `kwestup_data_${STORAGE_VERSION}`;
    const externalWidgetData = {
      tasks: [
        { id: "t1", title: "In-Memory Task", completed: true },
        { id: "widget-spawned-task", title: "Spawned by Widget", completed: false },
      ],
      taskLists: [{ id: "default_inbox", name: "My Tasks" }],
    };
    await AsyncStorage.setItem(storageKey, JSON.stringify(externalWidgetData));

    // Trigger foreground refresh
    await act(async () => {
      await contextValue.refreshTasksFromStorage();
    });

    // In-memory state must now match storage
    expect(contextValue.tasks).toHaveLength(2);
    expect(contextValue.tasks[0].completed).toBe(true);
    expect(contextValue.tasks[1].title).toBe("Spawned by Widget");
  });
});
