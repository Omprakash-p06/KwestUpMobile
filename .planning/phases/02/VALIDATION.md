# Validation: Phase 2 (Google Tasks-style Task Management)

This document outlines the testing and validation criteria for the **Google Tasks-style Task Management** phase.

---

## User Acceptance Criteria (UAT)

### UAT-1: Swipeable Category Paging Navigation
- **Action**: Open the main side navigation drawer and click "Task List".
- **Result**: The app switches to the Task List screen. A horizontal tab bar of categories displays at the top (e.g. "My Tasks"), and custom task cards display in a list page below.
- **Action**: Swipe horizontally left or right across the screen body.
- **Result**: The layout snaps cleanly to the next list sheet, and the active top category selection updates immediately.
- **Action**: Tap a non-active tab in the top tab bar.
- **Result**: The swiper snaps smoothly to the chosen category list page.

### UAT-2: Custom List CRUD Operations
- **Action**: Click "New List" button at the top right of the Task List header.
- **Result**: A slide-up dialog opens. Type "Shopping List" and click "Create".
- **Result**: A new category list "Shopping List" is appended, and its empty state page ("No active tasks in this list. Good job!") renders.
- **Action**: Click the pencil edit icon next to the active custom list header.
- **Result**: A slide-up dialog opens. Rename the list to "Groceries" and click "Rename".
- **Result**: The header text updates to "Groceries" immediately.
- **Action**: Add tasks inside "Groceries". Tap the trash can delete icon next to the header, and click "OK" inside the warning dialog.
- **Result**: The list "Groceries" is deleted, all scheduled due-date alerts for its tasks are canceled, and active index safe-returns to "My Tasks".

### UAT-3: Checklist Subtasks & Progress indicators
- **Action**: Click the Floating Action Button, create a task "Prepare Code Review", add 3 subtasks, and click "Save".
- **Result**: The task card renders showing:
  - Text description `0/3 completed` next to a progress bar with 0% fill.
  - Checkboxes for the three subtasks on the card body.
- **Action**: Check 1 subtask checkbox directly on the task card body.
- **Result**: The subtask text is crossed out, and the progress text dynamically updates to `1/3 (33%)` while the progress bar animates to 33% width fill.

### UAT-4: List Re-allocation Editor
- **Action**: Create custom lists "Coding" and "Inbox". Create a task inside "Inbox". Click the task to open the Edit Modal.
- **Result**: A chip selector row displaying "Coding" and "Inbox" options renders under the description field.
- **Action**: Select the "Coding" chip and click "Save".
- **Result**: The task disappears from the "Inbox" sheet and is moved successfully into the "Coding" sheet.

---

## Technical Verification

### 1. Code Review & Linting
- Verify that the code uses shallow coping updates (`map`) to avoid deep mutation state failures.
- Execute ESLint validation:
  ```bash
  npm run lint
  ```
- **Falsifiable Pass**: Output contains `0 errors`.

### 2. Storage Persistence Integrity
- Inspect the serialized array cached under `kwestup_data_${STORAGE_VERSION}` inside AsyncStorage.
- **Falsifiable Pass**:
  - `taskLists` array exists containing custom lists objects.
  - `tasks` array contains objects with `listId: string` relational links.
