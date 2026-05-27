# Summary: 01-01 — Core Persistence Layer for Notes

**Phase:** 01-notes  
**Plan:** 01  
**Status:** COMPLETE  
**Completed:** 2026-05-28

---

## What Was Built

### Task 1: Initialize Notes State in App.js ✅
- `const [notes, setNotes] = useState([]);` added at line 45 in `App.js`.
- `notes={notes}` and `setNotes={setNotes}` passed as props through `AppNavigator`.

### Task 2: Implement Notes Persistence ✅
- **Architecture change**: Instead of storing notes as a JSON blob in AsyncStorage, each note is stored as a real `.md` file in the device's Document Directory at `Notes/{Folder}/{Title}.md` using `expo-file-system`.
- `loadData` calls `getAllNotesFromFilesystem()` which recursively scans the `Notes/` directory tree and builds the notes state array dynamically.
- Notes metadata (folder, title, tags) is extracted directly from filesystem paths and raw content.

### Task 3: Integrate Reset Logic ✅
- `setNotes([])` called inside `handleResetData`.
- Additionally, `await wipeNotesFilesystem()` recursively deletes the entire `Notes/` directory on disk to prevent orphaned raw `.md` files surviving a factory reset.

---

## Architecture Note (Obsidian-style + Notion-style)

The original plan specified AsyncStorage-only persistence. Per user request during the Phase 1 discussion gate, the implementation was upgraded to a **raw Markdown filesystem vault** (Obsidian-style), with a 1-second debounced auto-save effect (Notion-style). The global `notes` in-memory array in `App.js` serves as a fast metadata cache for search/filter, while the filesystem is the source of truth.

---

## Acceptance Criteria Verified

- [x] `const [notes, setNotes] = useState([]);` present in `App.js`
- [x] `notes={notes}` passed to `AppNavigator`
- [x] `getAllNotesFromFilesystem()` called inside `loadData` (both happy path and catch blocks)
- [x] `setNotes([])` and `wipeNotesFilesystem()` both called inside `handleResetData`
- [x] `npm run lint` → **0 errors**
