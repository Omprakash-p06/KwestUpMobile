import {
  toggleTask,
  calculateNextRecurrence,
  completeTask,
  saveTask,
  deleteTask,
  toggleSubtask,
  createTaskList,
  renameTaskList,
  deleteTaskList,
} from "../../src/utils/taskMutations";

describe("taskMutations Unit Tests", () => {
  const fixedNow = "2026-09-27T12:00:00.000Z";
  const fixedToday = "2026-09-27";

  describe("toggleTask & calculateNextRecurrence", () => {
    it("toggles non-recurring task from incomplete to complete with timestamps", () => {
      const tasks = [
        { id: "task-1", title: "Buy Groceries", completed: false },
        { id: "task-2", title: "Read Book", completed: false },
      ];

      const { updatedTasks, toggledTask } = toggleTask(tasks, "task-1", {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(updatedTasks).toHaveLength(2);
      expect(toggledTask.completed).toBe(true);
      expect(toggledTask.completedDate).toBe(fixedToday);
      expect(toggledTask.completedAt).toBe(fixedNow);

      const target = updatedTasks.find((t) => t.id === "task-1");
      expect(target.completed).toBe(true);
    });

    it("toggles completed non-recurring task back to incomplete, clearing timestamps", () => {
      const tasks = [
        {
          id: "task-1",
          title: "Buy Groceries",
          completed: true,
          completedDate: "2026-09-26",
          completedAt: "2026-09-26T10:00:00.000Z",
        },
      ];

      const { updatedTasks, toggledTask } = toggleTask(tasks, "task-1", {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(updatedTasks).toHaveLength(1);
      expect(toggledTask.completed).toBe(false);
      expect(toggledTask.completedDate).toBeNull();
      expect(toggledTask.completedAt).toBeNull();
    });

    it("spawns next occurrence for daily recurring task (+1 day) and removes parent", () => {
      const initialDueDate = "2026-09-27T10:00:00.000Z";
      const tasks = [
        {
          id: "rec-daily",
          title: "Daily Standup",
          dueDate: initialDueDate,
          recurrence: "daily",
          completed: false,
          notificationId: "notif-123",
        },
      ];

      const { updatedTasks, spawnedTask } = toggleTask(tasks, "rec-daily", {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(updatedTasks).toHaveLength(1);
      expect(spawnedTask).toBeDefined();
      expect(spawnedTask.id).not.toBe("rec-daily");
      expect(spawnedTask.title).toBe("Daily Standup");
      expect(spawnedTask.completed).toBe(false);
      expect(spawnedTask.completedDate).toBeNull();
      expect(spawnedTask.notificationId).toBeNull();

      const expectedDueDate = new Date("2026-09-28T10:00:00.000Z").toISOString();
      expect(spawnedTask.dueDate).toBe(expectedDueDate);

      // Verify the old parent is removed from the active list
      expect(updatedTasks.find((t) => t.id === "rec-daily")).toBeUndefined();
      expect(updatedTasks[0].id).toBe(spawnedTask.id);
    });

    it("spawns next occurrence for weekly recurring task (+7 days)", () => {
      const initialDueDate = "2026-09-20T08:00:00.000Z";
      const tasks = [
        {
          id: "rec-weekly",
          title: "Weekly Planning",
          dueDate: initialDueDate,
          recurrence: "weekly",
          completed: false,
        },
      ];

      const { spawnedTask } = toggleTask(tasks, "rec-weekly", { now: fixedNow });
      const expectedDueDate = new Date("2026-09-27T08:00:00.000Z").toISOString();
      expect(spawnedTask.dueDate).toBe(expectedDueDate);
    });

    it("spawns next occurrence for monthly recurring task (+1 month)", () => {
      const initialDueDate = "2026-08-15T15:00:00.000Z";
      const tasks = [
        {
          id: "rec-monthly",
          title: "Pay Rent",
          dueDate: initialDueDate,
          recurrence: "monthly",
          completed: false,
        },
      ];

      const { spawnedTask } = toggleTask(tasks, "rec-monthly", { now: fixedNow });
      const expectedDueDate = new Date("2026-09-15T15:00:00.000Z").toISOString();
      expect(spawnedTask.dueDate).toBe(expectedDueDate);
    });

    it("handles progressive recurrence by incrementing trailing numbers in title (+1 day)", () => {
      const tasks = [
        {
          id: "prog-1",
          title: "Day 1 Workout",
          dueDate: "2026-09-27T07:00:00.000Z",
          recurrence: "progressive",
          completed: false,
        },
        {
          id: "prog-2",
          title: "Task 99",
          dueDate: "2026-09-27T07:00:00.000Z",
          recurrence: "progressive",
          completed: false,
        },
        {
          id: "prog-3",
          title: "Project Alpha",
          dueDate: "2026-09-27T07:00:00.000Z",
          recurrence: "progressive",
          completed: false,
        },
      ];

      // "Day 1 Workout" -> "Day 2 Workout"
      const res1 = toggleTask(tasks, "prog-1", { now: fixedNow });
      expect(res1.spawnedTask.title).toBe("Day 2 Workout");

      // "Task 99" -> "Task 100"
      const res2 = toggleTask(tasks, "prog-2", { now: fixedNow });
      expect(res2.spawnedTask.title).toBe("Task 100");

      // "Project Alpha" -> "Project Alpha - 2" (no initial number)
      const res3 = toggleTask(tasks, "prog-3", { now: fixedNow });
      expect(res3.spawnedTask.title).toBe("Project Alpha - 2");
    });

    it("handles invalid or missing dueDate by safely falling back to current timestamp", () => {
      const task = {
        id: "rec-bad-date",
        title: "Broken Date Task",
        dueDate: "invalid-date-string",
        recurrence: "daily",
        completed: false,
      };

      const spawned = calculateNextRecurrence(task, fixedNow);
      expect(isNaN(new Date(spawned.dueDate).getTime())).toBe(false);
      // Next day from fixedNow (2026-09-27 -> 2026-09-28)
      expect(new Date(spawned.dueDate).getDate()).toBe(28);
    });
  });

  describe("completeTask", () => {
    it("explicitly sets completed status with timestamps", () => {
      const tasks = [{ id: "t1", title: "Complete me", completed: false }];
      const { updatedTasks, completedTask } = completeTask(tasks, "t1", {
        now: fixedNow,
        todayDate: fixedToday,
      });

      expect(completedTask.completed).toBe(true);
      expect(completedTask.completedDate).toBe(fixedToday);
      expect(completedTask.completedAt).toBe(fixedNow);
      expect(updatedTasks[0].completed).toBe(true);
    });
  });

  describe("saveTask", () => {
    it("appends new task with generated id and default inbox listId", () => {
      const tasks = [];
      const newTaskData = { title: "New Item", description: "Details" };
      const { updatedTasks, savedTask } = saveTask(tasks, newTaskData, { now: fixedNow });

      expect(updatedTasks).toHaveLength(1);
      expect(savedTask.id).toBeDefined();
      expect(savedTask.listId).toBe("default_inbox");
      expect(savedTask.title).toBe("New Item");
      expect(savedTask.completed).toBe(false);
      expect(savedTask.createdAt).toBe(fixedNow);
    });

    it("updates existing task while preserving unchanged properties", () => {
      const tasks = [
        {
          id: "t1",
          title: "Original",
          listId: "work",
          createdAt: "2026-01-01T00:00:00.000Z",
          completed: false,
        },
      ];

      const { updatedTasks, savedTask } = saveTask(
        tasks,
        { id: "t1", title: "Updated Title", important: true },
        { now: fixedNow }
      );

      expect(updatedTasks).toHaveLength(1);
      expect(savedTask.title).toBe("Updated Title");
      expect(savedTask.listId).toBe("work");
      expect(savedTask.important).toBe(true);
      expect(savedTask.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(savedTask.updatedAt).toBe(fixedNow);
    });
  });

  describe("deleteTask", () => {
    it("filters out task by ID and returns deleted item", () => {
      const tasks = [
        { id: "t1", title: "Keep" },
        { id: "t2", title: "Delete" },
      ];

      const { updatedTasks, deletedTask } = deleteTask(tasks, "t2");
      expect(updatedTasks).toHaveLength(1);
      expect(updatedTasks[0].id).toBe("t1");
      expect(deletedTask.id).toBe("t2");
    });
  });

  describe("toggleSubtask", () => {
    it("toggles target subtask completed state and updates completedAt", () => {
      const tasks = [
        {
          id: "t1",
          title: "Parent Task",
          subtasks: [
            { id: "st-1", text: "Sub 1", completed: false },
            { id: "st-2", text: "Sub 2", completed: true },
          ],
        },
      ];

      const { updatedTasks, updatedTask } = toggleSubtask(tasks, "t1", 0, { now: fixedNow });
      expect(updatedTask.subtasks[0].completed).toBe(true);
      expect(updatedTask.subtasks[0].completedAt).toBe(fixedNow);
      expect(updatedTask.subtasks[1].completed).toBe(true); // unchanged
      expect(updatedTasks[0].subtasks[0].completed).toBe(true);
    });
  });

  describe("taskLists management", () => {
    it("creates a new task list with trimmed name", () => {
      const lists = [{ id: "default_inbox", name: "My Tasks" }];
      const { updatedTaskLists, createdList } = createTaskList(lists, "  Work Tasks  ");

      expect(updatedTaskLists).toHaveLength(2);
      expect(createdList.name).toBe("Work Tasks");
      expect(createdList.id).toBeDefined();
    });

    it("renames an existing task list", () => {
      const lists = [{ id: "list-1", name: "Old Name" }];
      const { updatedTaskLists, renamedList } = renameTaskList(lists, "list-1", "New Name");

      expect(renamedList.name).toBe("New Name");
      expect(updatedTaskLists[0].name).toBe("New Name");
    });

    it("deletes a custom task list but protects default_inbox", () => {
      const lists = [
        { id: "default_inbox", name: "My Tasks" },
        { id: "custom-list", name: "Groceries" },
      ];

      // Attempt to delete custom list -> succeeds
      const res1 = deleteTaskList(lists, "custom-list");
      expect(res1.updatedTaskLists).toHaveLength(1);
      expect(res1.deletedList.id).toBe("custom-list");

      // Attempt to delete default_inbox -> protected
      const res2 = deleteTaskList(lists, "default_inbox");
      expect(res2.updatedTaskLists).toHaveLength(2);
      expect(res2.deletedList).toBeNull();
    });
  });
});
