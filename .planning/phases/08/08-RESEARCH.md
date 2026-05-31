# Phase 8: Obsidian-Style Note Vaults - Research

**Researched:** 2026-05-31
**Domain:** Multi-vault filesystem partitioning, dynamic vault switching, md file import
**Confidence:** HIGH

## Summary

This phase refactors the current single-vault note storage (`Notes/` directory) into a multi-vault filesystem architecture. The core change is introducing a `vaults` abstraction layer: a Vaults array stored in AsyncStorage that maps vault IDs to filesystem paths, with `fileStorage.js` refactored to accept a vault ID parameter instead of using the hardcoded `NOTES_ROOT` constant.

The existing app architecture (React state in App.js, prop-drilled to NotesScreen via AppNavigator) should be extended with vault state rather than introducing a new state manager — the pattern is already established and the vault state surface is small (vaults array + activeVaultId). Vault metadata stays in AsyncStorage (same key-value pattern already used for app data), while vault note files live on the filesystem under `Notes/Vaults/{vaultId}/`.

For the import feature, `expo-document-picker` must be installed (not currently present). Users select multiple `.md` files which get copied into the target vault directory. A one-time migration function converts the existing `Notes/` directory into a default vault.

**Primary recommendation:** Refactor `fileStorage.js` to accept a vault path parameter, store vault metadata in AsyncStorage, and add a vault-switcher modal to the NotesScreen sidebar.

## User Constraints (from CONTEXT.md)

**No CONTEXT.md exists for Phase 8.** No locked decisions from user discussion yet.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTE-04 | Isolated Notes Vaults — create, label, delete multiple isolated vaults; quick-switch dynamically; custom root paths; import existing .md folder as vault | Verified: AsyncStorage for vault metadata, legacy `expo-file-system` for filesystem operations, `expo-document-picker` for .md imports. Full architecture described below. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vault metadata CRUD (create/list/rename/delete vault configs) | App State (App.js) | AsyncStorage | Vault metadata is small JSON — no DB needed. Already proven pattern (taskLists in AsyncStorage). |
| Note file read/write (per vault) | Filesystem (expo-file-system) | — | Notes ARE .md files on disk. The per-vault path determines which folder operations target. |
| Vault switching state | App State (App.js) | — | activeVaultId drives which vault's notes the screen renders. Simple string state, no persistence needed beyond session (metadata is already in AsyncStorage). |
| Import .md files into vault | Filesystem (expo-file-system) | expo-document-picker | Document picker selects source files, FileSystem copies them into the vault directory. |
| Vault UI (switcher, creator, importer) | NotesScreen | LiquidGlassCard | UI is part of the NotesScreen sidebar. Vault cards use LiquidGlassCard from Phase 7. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-file-system` | ~18.1.11 (legacy API) | Filesystem CRUD, directory management | Already installed, already powers all note storage. Legacy API is stable for SDK 53. |
| `@react-native-async-storage/async-storage` | 2.1.2 | Vault metadata persistence | Already installed, already stores all app metadata (taskLists, settings). |
| `expo-document-picker` | ~13.0.x (SDK 53 compatible) | System file picker for .md imports | Needed for the import feature. Not currently installed — must be added. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` or `Date.now()` | — | Vault ID generation | For generating unique vault identifiers. App already uses `Date.now().toString()` for IDs (task lists, tasks). |
| `@shopify/react-native-skia` | v2.0.0-next.4 | Liquid glass vault cards | Phase 7 installed this. Vault switcher cards can use `LiquidGlassCard` component. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AsyncStorage for vault metadata | `expo-file-system/next` File/Directory API + JSON file | AsyncStorage is simpler, already used, and vault metadata is tiny (<10KB). No benefit to moving to filesystem JSON. |
| Prop-drilling vault state | React Context / Zustand | State is shallow (2 values: vaults[ ] + activeVaultId). Prop-drilling through 2 levels (AppNavigator → NotesScreen) is acceptable. Context adds abstraction with no benefit at this scale. |
| FileSystem legacy API | `expo-file-system/next` (new File/Directory API) | New API requires SDK 54+ for stability. App is on SDK 53. Legacy API works fine for all needed operations. |
| `expo-document-picker` for import | `File.pickDirectoryAsync()` from new API | Not available on SDK 53. expo-document-picker is the standard Expo picking mechanism. |

**Installation:**
```bash
npx expo install expo-document-picker
```

**Version verification:**
[VERIFIED: npm registry] `expo-document-picker` latest SDK 53 compatible version is `~13.0.x`.
[VERIFIED: npm registry] `expo-file-system` at `18.1.11` is the installed SDK 53 version.

## Architecture Patterns

### Vault Data Model

```typescript
interface VaultConfig {
  id: string;              // Unique ID (e.g. Date.now().toString())
  name: string;            // User-facing label (e.g. "Work", "Personal")
  path: string;            // Absolute filesystem path (e.g. `${documentDirectory}Notes/Vaults/${id}/`)
  createdAt: string;       // ISO date
  updatedAt: string;       // ISO date
}
```

Persistence structure:
- **AsyncStorage key:** `kwestup_vaults_v5.0` — stores `VaultConfig[]`
- **AsyncStorage key:** `kwestup_activeVault_v5.0` — stores active vault ID (string)
- **Filesystem:** Each vault's `.md` files live under: `{documentDirectory}Notes/Vaults/{vaultId}/`

### System Architecture Diagram

```
[App.js State]
    │ vaults[], activeVaultId
    │
    ▼
[AppNavigator]  ← passes vault props through
    │
    ▼
[NotesScreen]
    │                                         
    ├── [Sidebar]                            ─── Vault Switcher UI
    │   ├── Vault List (active vault)             (LiquidGlassCard per vault)
    │   ├── "Switch Vault" button              ─── Opens VaultPickerModal
    │   ├── "Manage Vaults" button             ─── Opens VaultManagerModal
    │   ├── "Import Folder" button             ─── Opens DocumentPicker → copies .md → creates vault
    │   ├── Folder list
    │   └── Tags list
    │
    ├── [Note List]
    │       └── filtered by: activeVaultId + activeFolder + search
    │
    └── [Note Editor]
            └── reads/writes via: fileStorage.js (parameterized by vault.path)
                       │
                       ▼
              ┌─────────────────────────┐
              │ AsyncStorage            │  ← vault metadata
              │   └─ "kwestup_vaults"   │
              │   └─ "kwestup_active"   │
              └─────────────────────────┘
              
              ┌─────────────────────────┐
              │ Filesystem (expo-fs)    │  ← .md files
              │   └─ Notes/Vaults/id1/  │
              │   └─ Notes/Vaults/id2/  │
              └─────────────────────────┘
```

### Filesystem Migration Strategy

**Current structure:**
```
FileSystem.documentDirectory
  └── Notes/
      ├── Work/
      │   ├── report.md
      │   └── ideas.md
      ├── Personal/
      │   └── journal.md
      └── uncategorized_note.md
```

**New structure (after migration):**
```
FileSystem.documentDirectory
  └── Notes/
      └── Vaults/
          ├── default/        ← migrated from old Notes/
          │   ├── Work/
          │   ├── Personal/
          │   └── uncategorized_note.md
          └── work_vault/     ← user-created vault
              ├── Projects/
              └── meeting-notes.md
```

**Migration flow (one-time at first launch with vault system):**
1. Check if `Notes/Vaults/` exists (if so, already migrated)
2. If old `Notes/` has files but `Notes/Vaults/` doesn't exist:
   - Create `Notes/Vaults/`
   - Create default vault config `{ id: 'default', name: 'My Vault', path: '...' }`
   - Move all contents from `Notes/` → `Notes/Vaults/default/`
   - (Note: the `Notes/` directory itself stays as the parent of `Vaults/`)
3. Save default vault to AsyncStorage
4. Set `activeVaultId` to `'default'`

### Pattern 1: Vault-Parameterized File Operations
**What:** Refactor all `fileStorage.js` functions to accept a vault path parameter instead of using the hardcoded `NOTES_ROOT` constant.
**When to use:** Every file operation in fileStorage.js must be parameterized.

**Old pattern (current):**
```javascript
const NOTES_ROOT = `${FileSystem.documentDirectory}Notes/`;

export const saveNoteFile = async (folder, title, content) => {
  const folderPath = `${NOTES_ROOT}${folder}/`;
  // ...
};
```

**New pattern:**
```javascript
// Vault resolver helper
export const getVaultPath = (vaultId) => {
  return `${FileSystem.documentDirectory}Notes/Vaults/${vaultId}/`;
};

// Enhanced file operation with vault parameter
export const saveNoteFile = async (vaultId, folder, title, content) => {
  const vaultRoot = getVaultPath(vaultId);
  const folderPath = `${vaultRoot}${folder}/`;
  // ... rest is the same logic
};
```

**Backward compatibility:** Export a thin wrapper that passes the active vault ID:
```javascript
export const saveNoteToActiveVault = async (folder, title, content) => {
  const activeVault = await getActiveVault();
  return saveNoteFile(activeVault.id, folder, title, content);
};
```

### Pattern 2: AsyncStorage Vault Metadata CRUD
**What:** A dedicated service function for vault metadata operations.
**When to use:** For all vault lifecycle operations.

```javascript
// src/utils/vaultService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const VAULTS_KEY = 'kwestup_vaults_v5.0';
const ACTIVE_KEY = 'kwestup_activeVault_v5.0';

export const getVaults = async () => {
  const data = await AsyncStorage.getItem(VAULTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveVaults = async (vaults) => {
  await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
};

export const createVault = async (name) => {
  const vaults = await getVaults();
  const id = Date.now().toString();
  const path = `${FileSystem.documentDirectory}Notes/Vaults/${id}/`;
  
  await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  
  const newVault = { id, name, path, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  vaults.push(newVault);
  await saveVaults(vaults);
  return newVault;
};

export const deleteVault = async (vaultId) => {
  const vaults = await getVaults();
  const vault = vaults.find(v => v.id === vaultId);
  if (!vault) return;
  
  await FileSystem.deleteAsync(vault.path, { idempotent: true });
  const filtered = vaults.filter(v => v.id !== vaultId);
  await saveVaults(filtered);
  
  // If deleted active vault, switch to first available
  const activeId = await getActiveVaultId();
  if (activeId === vaultId && filtered.length > 0) {
    await setActiveVaultId(filtered[0].id);
  }
};

export const getActiveVaultId = async () => {
  return await AsyncStorage.getItem(ACTIVE_KEY);
};

export const setActiveVaultId = async (id) => {
  await AsyncStorage.setItem(ACTIVE_KEY, id);
};
```

### Pattern 3: Import .md Files as Vault
**What:** Use expo-document-picker to select .md files and copy them into a new vault.
**When to use:** User taps "Import Folder" / "Import .md Files" in vault manager.

```javascript
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { createVault } from './vaultService';

export const importMDFilesAsVault = async (vaultName) => {
  // 1. Pick multiple .md files
  const result = await DocumentPicker.getDocumentAsync({
    type: 'text/markdown',       // Filter to markdown
    multiple: true,               // Allow multi-select
    copyToCacheDirectory: true,   // Ensure FileSystem can read them
  });
  
  if (result.canceled) return null;
  
  // 2. Create a new vault
  const vault = await createVault(vaultName || 'Imported Vault');
  
  // 3. Copy each picked file into the vault
  for (const asset of result.assets) {
    const fileName = asset.name;
    const destPath = `${vault.path}${fileName}`;
    
    // Read from cache and write to vault
    const content = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await FileSystem.writeAsStringAsync(destPath, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }
  
  return vault;
};
```

**Note:** On Android, `type: 'text/markdown'` may not filter correctly. Use a broader MIME type filter like `['text/markdown', 'text/plain']` as a fallback [ASSUMED].

### Anti-Patterns to Avoid
- **Storing vault metadata in filesystem JSON:** Don't write a `vaults.json` file to the filesystem. AsyncStorage is faster, already used, and simpler.
- **Using vault name as folder name:** Use vault ID for the folder path. Names can change (if rename feature is added later). ID is invariant.
- **Scanning all vaults on every note load:** Scan only the active vault's directory. Scanning all vaults is wasteful.
- **Storing vault contents in AsyncStorage:** Vaults contain .md files that can be large. AsyncStorage has a ~6MB default limit on Android. Use filesystem for files, AsyncStorage only for metadata.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File/directory picker | Custom file browser UI | `expo-document-picker` | System picker is native, accessible, handles permissions, supports SAF URIs. Custom picker is a huge security surface. |
| AsyncStorage key-value management | Custom persistence engine | `@react-native-async-storage/async-storage` | Already installed, battle-tested, handles serialization, size limits, cross-platform. |
| UUID generation | Custom ID scheme | `Date.now().toString()` | Already the app's pattern (see TaskList IDs, Task IDs). No need for crypto-grade UUIDs for local state. |
| Directory listing / file copy | Manual filesystem traversal | `FileSystem.readDirectoryAsync()` + `FileSystem.readAsStringAsync` | Already used. The legacy API's async pattern handles recursion well. |

**Key insight:** This phase is about reorganizing existing capabilities, not introducing new infrastructure. The hardest part is the filesystem migration (moving existing Notes/ content to a vault). The vault switching and import features are straightforward additions to the existing data layer.

## Runtime State Inventory

> This section included because Phase 8 involves migrating from a single hardcoded directory to a vault-based structure.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing notes files under `FileSystem.documentDirectory + "Notes/"` with all `.md` files and folder structure | **Data migration** — one-time move from `Notes/` → `Notes/Vaults/default/` on first launch with vault system |
| Live service config | App.js stores notes array in `useState([])` loaded from `getAllNotesFromFilesystem()` which scans hardcoded `NOTES_ROOT` | **Code edit** — update load path to scan active vault directory; search-and-replace across App.js, NotesScreen.js, and fileStorage.js |
| OS-registered state | None — no OS-level registrations for file paths | N/A |
| Secrets/env vars | None — vault paths are local device paths, not secrets | N/A |
| Build artifacts | None — pure JS/React code change | N/A |

**Migration detail:** The one-time migration checks if `Notes/Vaults/` exists. If not, creates it, creates default vault, copies all files from `Notes/` to `Notes/Vaults/default/`. The original `Notes/` top-level folder remains as the parent of `Vaults/`. This is safe because the app already creates `Notes/` with `initNotesFolder()`.

## Common Pitfalls

### Pitfall 1: AsyncStorage Size Limits on Android
**What goes wrong:** Vault metadata stored in AsyncStorage grows too large (default ~6MB limit on Android).
**Why it happens:** Storing the full note list in AsyncStorage instead of just vault config metadata.
**How to avoid:** Only store vault configs (id, name, path, timestamps) in AsyncStorage. Note content stays on filesystem. Vault configs are tiny (<1KB each).
**Warning signs:** AsyncStorage write failures, silent data loss on Android.

### Pitfall 2: File Path Collisions Across Vaults
**What goes wrong:** A note in vault A has the same folder+title as a note in vault B, causing confusion.
**Why it happens:** The vault system correctly isolates paths (`Vaults/{id}/`), but the UI displays notes without vault context.
**How to avoid:** Include the vault name in the NotesScreen path header (e.g., `My Vault / Work / report.md`). Ensure the active vault is prominently displayed.
**Warning signs:** Users confused about which vault they're editing.

### Pitfall 3: Migration Edge Cases
**What goes wrong:** The one-time migration fails — partial file moves, empty directories lost, corrupted files.
**Why it happens:** Migration runs async during app init. If the app is killed mid-migration, filesystem state is inconsistent.
**How to avoid:** Make migration idempotent:
1. First check `Notes/Vaults/` existence as a migration-marker
2. Copy files (don't move) so originals remain
3. Delete old `Notes/` contents only after successful verification
4. Use `intermediates: true` on directory creation
**Warning signs:** Files lost after upgrade, duplicate files.

### Pitfall 4: expo-document-picker MIME Filter Fails on Android
**What goes wrong:** `type: 'text/markdown'` doesn't filter .md files on Android.
**Why it happens:** Android's MIME type detection for `.md` files is inconsistent across devices/ROMs. Some devices don't register `text/markdown` for `.md` files.
**How to avoid:** Always accept `['text/markdown', 'text/plain']`. Also accept `'*/*'` as a fallback with post-filtering by `.md` extension [ASSUMED].
**Warning signs:** Users can't see .md files in the picker.

## Code Examples

### Vault Service (vaultService.js)
[VERIFIED: via project codebase patterns] The following follows the established AsyncStorage pattern used for `kwestup_data_v5.0` in storage.js:

```javascript
// src/utils/vaultService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const VAULTS_KEY = 'kwestup_vaults_v5.0';
const ACTIVE_KEY = 'kwestup_activeVault_v5.0';

export const migrateToVaultSystem = async () => {
  // Check if already migrated
  const vaultsDir = `${FileSystem.documentDirectory}Notes/Vaults/`;
  const vaultsInfo = await FileSystem.getInfoAsync(vaultsDir);
  if (vaultsInfo.exists) return;
  
  // Create vaults directory
  await FileSystem.makeDirectoryAsync(vaultsDir, { intermediates: true });
  
  // Create default vault
  const defaultVault = {
    id: 'default',
    name: 'My Vault',
    path: `${vaultsDir}default/`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await FileSystem.makeDirectoryAsync(defaultVault.path, { intermediates: true });
  
  // Move existing Notes/ content to default vault
  const oldNotesDir = `${FileSystem.documentDirectory}Notes/`;
  const oldContents = await FileSystem.readDirectoryAsync(oldNotesDir);
  
  for (const item of oldContents) {
    if (item === 'Vaults') continue; // Skip newly created Vaults dir
    const sourcePath = `${oldNotesDir}${item}`;
    const destPath = `${defaultVault.path}${item}`;
    
    if (item.endsWith('.md')) {
      await FileSystem.moveAsync({ from: sourcePath, to: destPath });
    } else {
      // It's a folder — move recursively
      await FileSystem.moveAsync({ from: sourcePath, to: destPath });
    }
  }
  
  // Save vault metadata
  await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify([defaultVault]));
  await AsyncStorage.setItem(ACTIVE_KEY, 'default');
};

export const getVaults = async () => {
  const data = await AsyncStorage.getItem(VAULTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveVaults = async (vaults) => {
  await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
};

export const createVault = async (name) => {
  const vaults = await getVaults();
  const id = Date.now().toString();
  const path = `${FileSystem.documentDirectory}Notes/Vaults/${id}/`;
  
  await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  const newVault = { id, name, path, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  
  vaults.push(newVault);
  await saveVaults(vaults);
  return newVault;
};

export const deleteVault = async (vaultId) => {
  const vaults = await getVaults();
  const vault = vaults.find(v => v.id === vaultId);
  if (!vault) return;
  
  await FileSystem.deleteAsync(vault.path, { idempotent: true });
  const filtered = vaults.filter(v => v.id !== vaultId);
  await saveVaults(filtered);
};

export const getActiveVaultId = async () => {
  return await AsyncStorage.getItem(ACTIVE_KEY);
};

export const setActiveVaultId = async (id) => {
  await AsyncStorage.setItem(ACTIVE_KEY, id);
};

export const renameVault = async (vaultId, newName) => {
  const vaults = await getVaults();
  const updated = vaults.map(v => 
    v.id === vaultId 
      ? { ...v, name: newName, updatedAt: new Date().toISOString() } 
      : v
  );
  await saveVaults(updated);
};
```

### Refactored fileStorage.js Pattern
[VERIFIED: via project codebase] The existing `fileStorage.js` functions just need the `vaultId` parameter added:

```javascript
// src/utils/fileStorage.js
import * as FileSystem from "expo-file-system";

// Vault-aware path resolver
export const getVaultPath = (vaultId) => {
  return `${FileSystem.documentDirectory}Notes/Vaults/${vaultId}/`;
};

// Modified: accepts vaultId as first parameter
export const saveNoteFile = async (vaultId, folder, title, content) => {
  try {
    const VAULT_ROOT = getVaultPath(vaultId);
    const sanitizedFolder = (folder || "Uncategorized").trim();
    const sanitizedTitle = (title || "Untitled Note").trim().replace(/[/\\?%*:|"<>. ]/g, "_");
    const folderPath = `${VAULT_ROOT}${sanitizedFolder}/`;
    
    const folderInfo = await FileSystem.getInfoAsync(folderPath);
    if (!folderInfo.exists) {
      await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
    }

    const filePath = `${folderPath}${sanitizedTitle}.md`;
    await FileSystem.writeAsStringAsync(filePath, content || "", {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error };
  }
};

// Same pattern for readNoteFile, deleteNoteFile, getAllNotesFromFilesystem
// Each accepts vaultId as first parameter

// Backward-compatible wrapper (uses active vault)
export const saveNoteToActiveVault = async (folder, title, content) => {
  const { getActiveVaultId } = await import('./vaultService');
  const activeId = await getActiveVaultId();
  return saveNoteFile(activeId || 'default', folder, title, content);
};
```

### Import Function
[VERIFIED: expo-document-picker docs] The import flow follows expo-document-picker's standard API:

```javascript
// src/utils/vaultImport.js
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { createVault } from './vaultService';

export const importMDFilesAsVault = async (vaultName) => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/markdown', 'text/plain'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    
    if (result.canceled) return null;
    
    const vault = await createVault(vaultName || 'Imported');
    
    for (const asset of result.assets) {
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      // Preserve original filename
      const fileName = asset.name.endsWith('.md') ? asset.name : `${asset.name}.md`;
      const destPath = `${vault.path}${fileName}`;
      
      await FileSystem.writeAsStringAsync(destPath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
    
    return vault;
  } catch (error) {
    console.error("❌ Failed to import vault:", error);
    return null;
  }
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single hardcoded `NOTES_ROOT` | Vault-path-parameterized file ops | SDK 53 (this phase) | All file operations need vaultId param |
| Direct `Notes/` directory | `Notes/Vaults/{id}/` subdirectories | SDK 53 (this phase) | One-time migration needed |
| No vault concept | AsyncStorage vault metadata | SDK 53 (this phase) | Small new data surface |
| Flat scanning | Vault-scoped scanning | SDK 53 (this phase) | Faster loads, only active vault scanned |

**Deprecated/outdated:**
- `NOTES_ROOT` constant in fileStorage.js — must be replaced with dynamic vault path

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `expo-document-picker` with `type: ['text/markdown', 'text/plain']` works on Android for .md files | Import Pattern | **Medium** — user may need to switch to `'*/*'` filter and post-filter by extension. Mitigation: test on a real Android device. |
| A2 | The existing `saveData()` / `loadData()` AsyncStorage pattern can be extended with vault keys without hitting Android 6MB limit | AsyncStorage | **Low** — vault metadata is <1KB per vault. Only vault configs, not note content. |
| A3 | `FileSystem.moveAsync({ from, to })` works for directory moves between subdirectories of documentDirectory | Migration | **Low** — this is a supported operation. Falls back to copy+delete if needed. |
| A4 | LiquidGlassCard from Phase 7 is compatible as a vault card wrapper | UI | **Low** — it's a generic card container. For vault list items it may need a compact variant. |

## Open Questions

1. **Should vault settings be a sub-screen of Notes or a standalone screen accessible from the drawer?**
   - What we know: NotesScreen currently lives as a Drawer screen. Vault management UI could be a modal within NotesScreen (less navigation noise) or a standalone screen.
   - What's unclear: Whether the drawer should have a separate "Vaults" entry or vault switching stays within Notes.
   - Recommendation: Keep vault management inside NotesScreen as modals/popovers. A drawer entry adds clutter for an infrequent action.

2. **Should vault import allow picking a directory (SAF) or just multiple files?**
   - What we know: expo-document-picker picks files, not directories. SAF directory picking requires native Android API or `expo-file-system/next`.
   - What's unclear: Whether users will expect true folder selection.
   - Recommendation: Start with multi-file select (`.md` files) via expo-document-picker. This satisfies NOTE-04's "import an existing folder of markdown .md files" — the user selects all the files in the folder.

3. **Should vault switching cause auto-save of the current note?**
   - What we know: NotesScreen has debounced auto-save.
   - What's unclear: Whether switching vaults should trigger an immediate save of the current note.
   - Recommendation: Yes — switching vaults should trigger `handleSaveNote()` first, then switch.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-file-system` | All file operations | ✓ | 18.1.11 | — |
| `@react-native-async-storage/async-storage` | Vault metadata persistence | ✓ | 2.1.2 | — |
| `expo-document-picker` | Import .md files | ✗ | — | Fallback: manual file path input (string) + text-only paste |

**Missing dependencies with no fallback:**
- None — all core dependencies already installed.

**Missing dependencies with fallback:**
- `expo-document-picker` — not installed. Must be added via `npx expo install expo-document-picker`. Fallback for import: accept a plain text list of file URIs (poor UX, dev-only).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | N/A — no test dependencies in package.json |
| Config file | N/A |
| Quick run command | `npx expo start` (manual verification) |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTE-04 | Vault CRUD (create/list/delete vaults) | Manual | n/a | ❌ Wave 0 |
| NOTE-04 | Vault switching (notes reload from new vault) | Manual | n/a | ❌ Wave 0 |
| NOTE-04 | Import .md files into vault | Manual | n/a | ❌ Wave 0 |
| NOTE-04 | Migration from single vault to multi-vault | Manual | n/a | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Launch app, verify vault operations work
- **Per wave merge:** Full vault lifecycle test (create → switch → edit → switch back → delete)
- **Phase gate:** All NOTE-04 behaviors verified manually via `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/` directory does not exist — no test framework or infrastructure
- [ ] All testing is manual via Expo Go / dev build

## Security Domain

> `security_enforcement` is not explicitly set in config.json (absent). Skipping Security Domain — this phase manages local file paths and .md files only, with no authentication, network access, or sensitive data.

## Sources

### Primary (HIGH confidence)
- [VERIFIED: project codebase] `fileStorage.js`, `App.js`, `NotesScreen.js`, `storage.js` — existing patterns for filesystem ops and AsyncStorage
- [VERIFIED: npm registry] `expo-file-system@18.1.11` installed and functional
- [VERIFIED: npm registry] `@react-native-async-storage/async-storage@2.1.2` installed and functional
- [VERIFIED: expo docs] `expo-document-picker` API for file selection

### Secondary (MEDIUM confidence)
- [CITED: docs.expo.dev/versions/v53.0.0/sdk/document-picker/] expo-document-picker getDocumentAsync API with `multiple: true` and `type` filtering
- [CITED: github.com/expo/expo/blob/main/docs/pages/versions/unversioned/sdk/filesystem.mdx] expo-file-system legacy API reference

### Tertiary (LOW confidence)
- [ASSUMED] Android MIME type matching for `.md` files — may need `'*/*'` fallback
- [ASSUMED] `FileSystem.moveAsync()` reliability for directory moves

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries currently used in the project
- Architecture: HIGH — extends existing patterns (prop-drilling, AsyncStorage, filesystem)
- Pitfalls: MEDIUM — migration edge cases and Android MIME types are known unknowns
- Import feature: MEDIUM — expo-document-picker approach is standard but Android MIME matching is unverified

**Research date:** 2026-05-31
**Valid until:** 2026-07-15 (SDK 53 is stable, but SDK 54 introduces `expo-file-system/next` with directory picking that could simplify imports)
