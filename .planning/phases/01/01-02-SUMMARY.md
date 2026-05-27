# Summary: 01-02 — Notes List UI, Sidebar Explorer & Markdown Editor

**Phase:** 01-notes  
**Plan:** 02  
**Status:** COMPLETE  
**Completed:** 2026-05-28

---

## What Was Built

### Task 1: Add Notes Option to Custom Drawer Navigation ✅
- `{ key: "Notes", title: "Notes", icon: "notebook", route: "Notes" }` added to the `drawerItems` array in `CustomDrawerContent.js`.
- `NotesScreen` imported and registered as `<Drawer.Screen name="Notes">` inside `AppNavigator.js`.
- Props `notes`, `setNotes`, `showConfirmation`, and `currentTheme` passed correctly.

### Task 2: Build Folders Sidebar & Search UI ✅
- Folders extracted dynamically from notes array via `useMemo` hooks.
- Tags extracted at runtime by scanning raw markdown body content for `#hashtag` patterns via `extractHashtags()`.
- Left sidebar explorer displaying:
  - **FOLDERS** section with "All Notes" and per-folder entries.
  - **TAGS** section with "All Tags" and per-tag filter entries.
  - Folder creation modal via folder-plus icon.
- Main panel includes:
  - Search bar filtering by title and content (live).
  - Breadcrumb path header showing active folder and tag selection.
  - FlatList of note cards with title, content snippet, tag badges, and date.
  - Empty state illustration with icon.

### Task 3: Build Markdown Editor & Preview Engine ✅
- **Dual-mode editor** via `editorTab` state (`"edit"` | `"preview"`):
  - **Edit Mode**: Large `TextInput` body, title input, folder input, and a fixed Markdown Toolbar with H1, H2, bold, italic, checkbox, and bullet point buttons.
  - **Preview Mode**: Custom line-by-line regex parser rendering H1, H2, H3 styled headers; bullet points; checked/unchecked checkboxes with `MaterialCommunityIcons`; bold/italic inline spans via `parseInlineMarkdown`.
- `renderMarkdown(text)` and `parseInlineMarkdown(text)` functions implemented.

---

## Architecture Upgrade (Beyond Original Plan)

Per user's architectural directive at the Phase 1 discussion gate, the persistence model was upgraded:

1. **Obsidian-style file system**: Notes saved as `.md` files in `Notes/{Folder}/{Title}.md` on-device. File path used as primary key (`id`).
2. **Notion-style instant sync (auto-save)**:
   - 1-second debounced `useEffect` on `editContent` auto-saves to disk silently.
   - `handleBack()` and `handleToggleTab()` commit pending edits before navigation transitions.
3. **Rename/Move safety**: Title or folder changes trigger a move operation (write new file → delete old file) with conflict detection.
4. **Filesystem wipe on reset**: `wipeNotesFilesystem()` called in `App.js` data reset handler.

---

## Acceptance Criteria Verified

- [x] `src/navigation/CustomDrawerContent.js` contains `"Notes"` key in `drawerItems`
- [x] `src/navigation/AppNavigator.js` imports `NotesScreen` and registers `<Drawer.Screen name="Notes">`
- [x] `src/screens/NotesScreen.js` contains folder/tag extraction via `useMemo` hooks
- [x] `src/screens/NotesScreen.js` contains `FlatList` notes display and folder-adding modal with `isFolderModalVisible`
- [x] `src/screens/NotesScreen.js` contains `renderMarkdown` and `parseInlineMarkdown` functions
- [x] `src/screens/NotesScreen.js` contains markdown toolbar with `insertMarkdown` triggers
- [x] `npm run lint` → **0 errors**
