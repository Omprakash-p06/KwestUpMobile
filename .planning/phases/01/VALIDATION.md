# Validation: Phase 1 (Markdown Notes)

This document outlines the testing and validation criteria for the **Notion/Obsidian Markdown Notes** phase.

---

## User Acceptance Criteria (UAT)

### UAT-1: Notes Explorer Navigation
- **Action**: Open the main side navigation drawer and click "Notes".
- **Result**: The app switches to the Notes screen. The sidebar displays folders (including Uncategorized) and a list of hashtags.

### UAT-2: Creating and Saving Notes
- **Action**: Click the "+ Note" button in the notes list.
- **Result**: A new note titled "Untitled Note" is created. Enter edit mode, change the title, add tags, and type markdown content (e.g. headings, bolding). Click save.
- **Result**: The note persists. Relaunching the app loads the note and all metadata from AsyncStorage.

### UAT-3: Markdown Rendering (Preview)
- **Action**: Write standard headers `# H1` and `## H2`, bold `**bold**`, bullets `- list`, and checkboxes `- [ ] todo` in edit mode. Switch to preview mode.
- **Result**: The content is beautifully styled. Checking a todo checklist checkbox displays as complete.

### UAT-4: Folder Organization & Filter
- **Action**: Click "New Folder" icon, create folder "School". Move a note to folder "School" inside the meta editor. Click "School" folder in sidebar.
- **Result**: The notes list is filtered to display only notes located in the "School" folder.

---

## Technical Verification

### 1. Code Review & Linting
- Ensure all files are styled properly and follow standard Javascript style guidelines.
- Execute ESLint validation:
  ```bash
  npm run lint
  ```
- **Falsifiable Pass**: Output contains `0 errors`.

### 2. Storage Persistence Integrity
- Open AsyncStorage files or check AsyncStorage logs.
- **Falsifiable Pass**: Saved data string includes `"notes": [...]` array with full objects containing `id`, `title`, `content`, `folder`, `tags`, `createdAt`, and `updatedAt`.
