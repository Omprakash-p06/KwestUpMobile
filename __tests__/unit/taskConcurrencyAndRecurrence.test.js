import React from "react";
import { View, Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TaskProvider, useTasks } from "../../src/context/TaskContext";
import {
  calculateNextRecurrence,
  toggleSubtask,
  mergeTasksByUpdatedAt,
  toggleTask,
  renameTaskList,
  deleteTaskList,
} from "../../src/utils/taskMutations";
import { STORAGE_VERSION } from "../../src/utils/storage";
import { eventBus } from "../../src/behavior/eventBus";

let testContext = null;

const TestConsumer = () => {
  testContext = useTasks();
  return (
    <View>
      <Text>Task Concurrency Consumer</Text>
    </View>
  );
};

describe("Task Concurrency, Recurrence Clamping & Reconciliation Regression Suite", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    eventBus.clearListeners();
    eventBus.clearBuffer();
    jest.clearAllMocks();
    testContext = null;
  });

  describe("DEF-01: Rapid Concurrent Mutations in TaskContext", () => {
    it("handles rapid concurrent toggleTaskComplete without dropping either update", async () => {
      const initialTasks = [
        { id: "t1", title: "Task 1", completed: false, updatedAt: "2026-10-12T10:00:00.000Z" },
        { id: "t2", title: "Task 2", completed: false, updatedAt: "2026-10-12T10:00:00.000Z" },
      ];

      await act(async () => {
        renderer.create(
          <TaskProvider initialTasks={initialTasks}>
            <TestConsumer />
          </TaskProvider>
        );
      });

      expect(testContext.tasks).toHaveLength(2);
      expect(testContext.tasks[0].completed).toBe(false);
      expect(testContext.tasks[1].completed).toBe(false);

      // Fire both toggles synchronously within the same event loop tick
      await act(async () => {
        testContext.toggleTaskComplete("t1");
        testContext.toggleTaskComplete("t2");
      });

      // Both must be completed; neither must have overwritten the other
      expect(testContext.tasks[0].completed).toBe(true);
      expect(testContext.tasks[1].completed).toBe(true);
    });

    it("handles rapid sequential handleSaveTask calls without race overwrites", async () => {
      const initialTasks = [
        { id: "t1", title: "Original 1", completed: false, updatedAt: "2026-10-12T10:00:00.000Z" },
        { id: "t2", title: "Original 2", completed: false, updatedAt: "2026-10-12T10:00:00.000Z" },
      ];

      await act(async () => {
        renderer.create(
          <TaskProvider initialTasks={initialTasks}>
            <TestConsumer />
          </TaskProvider>
        );
      });

      await act(async () => {
        const p1 = testContext.handleSaveTask({ id: "t1", title: "Updated 1" });
        const p2 = testContext.handleSaveTask({ id: "t2", title: "Updated 2" });
        await Promise.all([p1, p2]);
      });

      const t1 = testContext.tasks.find((t) => t.id === "t1");
      const t2 = testContext.tasks.find((t) => t.id === "t2");

      expect(t1.title).toBe("Updated 1");
      expect(t2.title).toBe("Updated 2");
    });
  });

  describe("DEF-02: Persistence Reconciliation & Foreground Micro-Window", () => {
    it("mergeTasksByUpdatedAt preserves newer in-memory updates over older storage reads", () => {
      const inMemoryTasks = [
        { id: "t1", title: "In-Memory Edit", completed: true, updatedAt: "2026-10-12T12:00:10.000Z" },
        { id: "t2", title: "Fresh Memory Task", completed: false, updatedAt: "2026-10-12T12:00:05.000Z" },
      ];

      const storageTasks = [
        { id: "t1", title: "Stale Storage", completed: false, updatedAt: "2026-10-12T12:00:00.000Z" },
        { id: "t3", title: "Widget Task", completed: false, updatedAt: "2026-10-12T12:00:08.000Z" },
      ];

      const merged = mergeTasksByUpdatedAt(inMemoryTasks, storageTasks);

      expect(merged).toHaveLength(3);
      const t1 = merged.find((t) => t.id === "t1");
      expect(t1.title).toBe("In-Memory Edit");
      expect(t1.completed).toBe(true);

      const t2 = merged.find((t) => t.id === "t2");
      expect(t2.title).toBe("Fresh Memory Task");

      const t3 = merged.find((t) => t.id === "t3");
      expect(t3.title).toBe("Widget Task");
    });

    it("mergeTasksByUpdatedAt accepts newer storage updates over older in-memory tasks", () => {
      const inMemoryTasks = [
        { id: "t1", title: "Older In-Memory", completed: false, updatedAt: "2026-10-12T10:00:00.000Z" },
      ];

      const storageTasks = [
        { id: "t1", title: "Widget Completed", completed: true, updatedAt: "2026-10-12T11:00:00.000Z" },
      ];

      const merged = mergeTasksByUpdatedAt(inMemoryTasks, storageTasks);
      expect(merged).toHaveLength(1);
      expect(merged[0].completed).toBe(true);
      expect(merged[0].title).toBe("Widget Completed");
    });

    it("refreshTasksFromStorage does not clobber a recent in-memory mutation", async () => {
      const initialTasks = [
        { id: "t1", title: "Base Task", completed: false, updatedAt: "2026-10-12T12:00:00.000Z" },
      ];

      await act(async () => {
        renderer.create(
          <TaskProvider initialTasks={initialTasks}>
            <TestConsumer />
          </TaskProvider>
        );
      });

      // User completes task in-memory (updatedAt set to now)
      const nowTimestamp = "2026-10-12T12:00:05.000Z";
      await act(async () => {
        testContext.setTasks([
          { id: "t1", title: "Base Task", completed: true, updatedAt: nowTimestamp },
        ]);
      });

      // Background widget writes to storage with older timestamp for t1, but adding t2
      const storageKey = `kwestup_data_${STORAGE_VERSION}`;
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          tasks: [
            { id: "t1", title: "Base Task", completed: false, updatedAt: "2026-10-12T12:00:01.000Z" },
            { id: "t2", title: "Widget Task", completed: false, updatedAt: "2026-10-12T12:00:03.000Z" },
          ],
        })
      );

      // App returns to foreground and triggers refreshTasksFromStorage
      await act(async () => {
        await testContext.refreshTasksFromStorage();
      });

      // t1 must stay completed because memory was newer than storage read
      const t1 = testContext.tasks.find((t) => t.id === "t1");
      expect(t1.completed).toBe(true);

      // t2 from widget must also be present
      const t2 = testContext.tasks.find((t) => t.id === "t2");
      expect(t2).toBeDefined();
    });
  });

  describe("DEF-03: Monthly Recurrence Clamping (Jan 31 -> Feb 28/29)", () => {
    it("clamps Jan 31 to Feb 28 in a standard non-leap year (2026) without month skipping", () => {
      const task = {
        id: "recurring-1",
        title: "End of Month Review",
        recurrence: "monthly",
        dueDate: "2026-01-31T12:00:00.000Z",
      };

      const nextTask = calculateNextRecurrence(task, "2026-01-31T12:00:00.000Z");

      const dueDate = new Date(nextTask.dueDate);
      expect(dueDate.getUTCFullYear()).toBe(2026);
      expect(dueDate.getUTCMonth()).toBe(1); // February (0-indexed)
      expect(dueDate.getUTCDate()).toBe(28); // Clamped to Feb 28
      expect(nextTask.completed).toBe(false);
    });

    it("clamps Jan 31 to Feb 29 in a leap year (2024)", () => {
      const task = {
        id: "recurring-leap",
        title: "Leap Year Task",
        recurrence: "monthly",
        dueDate: "2024-01-31T12:00:00.000Z",
      };

      const nextTask = calculateNextRecurrence(task, "2024-01-31T12:00:00.000Z");

      const dueDate = new Date(nextTask.dueDate);
      expect(dueDate.getUTCFullYear()).toBe(2024);
      expect(dueDate.getUTCMonth()).toBe(1); // February
      expect(dueDate.getUTCDate()).toBe(29); // Clamped to Feb 29
    });

    it("clamps March 31 to April 30 without skipping into May", () => {
      const task = {
        id: "recurring-3",
        title: "Quarterly Audit",
        recurrence: "monthly",
        dueDate: "2026-03-31T12:00:00.000Z",
      };

      const nextTask = calculateNextRecurrence(task, "2026-03-31T12:00:00.000Z");

      const dueDate = new Date(nextTask.dueDate);
      expect(dueDate.getUTCFullYear()).toBe(2026);
      expect(dueDate.getUTCMonth()).toBe(3); // April
      expect(dueDate.getUTCDate()).toBe(30); // Clamped to April 30
    });
  });

  describe("DEF-04: Subtask Index Bounds Protection", () => {
    it("returns untouched tasks array and null updatedTask on negative subtask index", () => {
      const tasks = [
        {
          id: "t1",
          title: "Parent Task",
          subtasks: [{ title: "Sub 1", completed: false }],
          updatedAt: "2026-10-12T10:00:00.000Z",
        },
      ];

      const { updatedTasks, updatedTask } = toggleSubtask(tasks, "t1", -1);
      expect(updatedTask).toBeNull();
      expect(updatedTasks).toBe(tasks);
    });

    it("returns untouched tasks array and null updatedTask on out-of-bounds subtask index", () => {
      const tasks = [
        {
          id: "t1",
          title: "Parent Task",
          subtasks: [{ title: "Sub 1", completed: false }],
          updatedAt: "2026-10-12T10:00:00.000Z",
        },
      ];

      const { updatedTasks, updatedTask } = toggleSubtask(tasks, "t1", 5);
      expect(updatedTask).toBeNull();
      expect(updatedTasks).toBe(tasks);
    });

    it("returns untouched tasks array and null updatedTask when subtaskIdx equals subtasks.length exactly", () => {
      const tasks = [
        {
          id: "t1",
          title: "Parent Task",
          subtasks: [{ title: "Sub 0", completed: false }],
          updatedAt: "2026-10-12T10:00:00.000Z",
        },
      ];

      const { updatedTasks, updatedTask } = toggleSubtask(tasks, "t1", 1);
      expect(updatedTask).toBeNull();
      expect(updatedTasks).toBe(tasks);
    });

    it("returns untouched tasks array when task has no subtasks array", () => {
      const tasks = [
        { id: "t1", title: "No subtasks", updatedAt: "2026-10-12T10:00:00.000Z" },
      ];

      const { updatedTasks, updatedTask } = toggleSubtask(tasks, "t1", 0);
      expect(updatedTask).toBeNull();
      expect(updatedTasks).toBe(tasks);
    });
  });

  describe("Mutation Hardening: Boundary Cases & Recurrence Verification", () => {
    it("progressive recurrence advances dueDate (+1 day) and increments trailing number", () => {
      const task = {
        id: "p1",
        title: "Sprint 1",
        recurrence: "progressive",
        dueDate: "2026-10-12T12:00:00.000Z",
      };
      const next = calculateNextRecurrence(task, "2026-10-12T12:00:00.000Z");
      expect(next.title).toBe("Sprint 2");
      const nextDue = new Date(next.dueDate);
      expect(nextDue.getUTCDate()).toBe(13); // +1 day, not -1
    });

    it("toggleTask does not spawn recurrence when recurrence is 'none'", () => {
      const tasks = [{ id: "t1", title: "Task", recurrence: "none", completed: false }];
      const { toggledTask, spawnedTask } = toggleTask(tasks, "t1");
      expect(spawnedTask).toBeNull();
      expect(toggledTask.completed).toBe(true);
      expect(toggledTask.id).toBe("t1");
    });

    it("renameTaskList ignores blank or whitespace newName", () => {
      const lists = [{ id: "l1", name: "Original Name" }];
      const { updatedTaskLists, renamedList } = renameTaskList(lists, "l1", "   ");
      expect(updatedTaskLists[0].name).toBe("Original Name");
      expect(renamedList?.name).toBe("Original Name");
    });

    it("deleteTaskList preserves all lists when listId does not match", () => {
      const lists = [{ id: "l1", name: "List 1" }, { id: "l2", name: "List 2" }];
      const { updatedTaskLists, deletedList } = deleteTaskList(lists, "non-existent");
      expect(updatedTaskLists).toHaveLength(2);
      expect(deletedList).toBeNull();
    });

    it("mergeTasksByUpdatedAt safely filters out null or malformed tasks without id", () => {
      const inMemory = [null, { title: "No ID" }, { id: "t1", updatedAt: "2026-10-12T10:00:00.000Z" }];
      const stored = [null, { title: "No ID either" }, { id: "t2", updatedAt: "2026-10-12T10:00:00.000Z" }];
      const merged = mergeTasksByUpdatedAt(inMemory, stored);
      expect(merged).toHaveLength(2);
      expect(merged.map((t) => t.id)).toEqual(["t1", "t2"]);
    });
  });
});
