import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import {
  getVaultPath,
  ensureVaultsDir,
  getVaults,
  createVault,
  deleteVault,
  getActiveVaultId,
  setActiveVaultId,
  renameVault,
} from '../../src/utils/vaultService';
import {
  initNotesFolder,
  saveNoteFile,
  readNoteFile,
  deleteNoteFile,
  deleteFolderFile,
  getAllNotesFromFilesystem,
} from '../../src/utils/fileStorage';

describe('vaultService & fileStorage Unit Tests', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    if (FileSystem.__resetFS) {
      FileSystem.__resetFS();
    }
    jest.clearAllMocks();
  });

  describe('vaultService Path & Directory Initialization', () => {
    it('returns structured vault path under Notes/Vaults/<vaultId>/', () => {
      const path = getVaultPath('personal-vault');
      expect(path).toBe(`${FileSystem.documentDirectory}Notes/Vaults/personal-vault/`);
    });

    it('ensures top-level Notes/Vaults/ directory exists', async () => {
      await ensureVaultsDir();
      const info = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}Notes/Vaults/`);
      expect(info.exists).toBe(true);
      expect(info.isDirectory).toBe(true);
    });
  });

  describe('vaultService CRUD & Active Vault State', () => {
    it('creates a new vault with generated id, adds it to storage, and creates its folder', async () => {
      const newVault = await createVault('Project Alpha');
      expect(newVault).toBeDefined();
      expect(newVault.name).toBe('Project Alpha');
      expect(newVault.id).toBeDefined();

      const vaults = await getVaults();
      expect(vaults.length).toBe(1);
      expect(vaults[0].name).toBe('Project Alpha');

      const vaultDir = await FileSystem.getInfoAsync(getVaultPath(newVault.id));
      expect(vaultDir.exists).toBe(true);
      expect(vaultDir.isDirectory).toBe(true);
    });

    it('manages active vault selection and persistence', async () => {
      await setActiveVaultId('vault-xyz');
      const activeId = await getActiveVaultId();
      expect(activeId).toBe('vault-xyz');
    });

    it('renames an existing vault', async () => {
      const vault = await createVault('Original Name');
      await renameVault(vault.id, 'Renamed Vault');

      const vaults = await getVaults();
      const updated = vaults.find((v) => v.id === vault.id);
      expect(updated.name).toBe('Renamed Vault');
    });

    it('deletes a vault and removes its filesystem directory', async () => {
      const vault = await createVault('To Be Deleted');
      const vaultPath = getVaultPath(vault.id);
      expect((await FileSystem.getInfoAsync(vaultPath)).exists).toBe(true);

      await deleteVault(vault.id);

      const remaining = await getVaults();
      expect(remaining.find((v) => v.id === vault.id)).toBeUndefined();

      const afterDeleteDir = await FileSystem.getInfoAsync(vaultPath);
      expect(afterDeleteDir.exists).toBe(false);
    });
  });

  describe('fileStorage Note Persistence & Sanitization', () => {
    it('saves a markdown note into a specific vault and folder, sanitizing title characters', async () => {
      const vaultId = 'test-vault';
      await initNotesFolder(vaultId);

      // Title contains special symbols that must be sanitized
      const unsanitizedTitle = 'Sprint: Planning / Architecture?';
      const content = '# Sprint Tasks\n- [ ] Task 1';

      const saveResult = await saveNoteFile(vaultId, 'Work', unsanitizedTitle, content);
      expect(saveResult.success).toBe(true);
      expect(saveResult.filePath).toBeDefined();
      expect(saveResult.filePath).toContain('Sprint__Planning___Architecture_.md');
      expect(saveResult.filePath).toMatch(/\.md$/);

      const fileInfo = await FileSystem.getInfoAsync(saveResult.filePath);
      expect(fileInfo.exists).toBe(true);

      const readBack = await readNoteFile(vaultId, 'Work', unsanitizedTitle);
      expect(readBack).toBe(content);
    });

    it('reads note content correctly and returns empty string for non-existent note', async () => {
      const vaultId = 'read-vault';
      await initNotesFolder(vaultId);

      await saveNoteFile(vaultId, 'Personal', 'Shopping', 'Apples\nOranges');
      const content = await readNoteFile(vaultId, 'Personal', 'Shopping');
      expect(content).toBe('Apples\nOranges');

      const nonExistent = await readNoteFile(vaultId, 'Personal', 'Does_Not_Exist');
      expect(nonExistent).toBe('');
    });

    it('deletes a note file from the vault folder', async () => {
      const vaultId = 'del-vault';
      await initNotesFolder(vaultId);

      const saveResult = await saveNoteFile(vaultId, 'Drafts', 'Old Note', 'Trash');
      expect((await FileSystem.getInfoAsync(saveResult.filePath)).exists).toBe(true);

      const deleteResult = await deleteNoteFile(vaultId, 'Drafts', 'Old Note');
      expect(deleteResult.success).toBe(true);

      expect((await FileSystem.getInfoAsync(saveResult.filePath)).exists).toBe(false);
    });

    it('deletes an entire folder and notes inside it', async () => {
      const vaultId = 'del-folder-vault';
      await initNotesFolder(vaultId);

      const saveResult = await saveNoteFile(vaultId, 'Temporary', 'Note 1', 'Content');
      expect((await FileSystem.getInfoAsync(saveResult.filePath)).exists).toBe(true);

      const folderDeleteResult = await deleteFolderFile(vaultId, 'Temporary');
      expect(folderDeleteResult.success).toBe(true);

      expect((await FileSystem.getInfoAsync(saveResult.filePath)).exists).toBe(false);
    });

    it('scans vault directory and discovers all saved notes', async () => {
      const vaultId = 'scan-vault';
      await initNotesFolder(vaultId);

      await saveNoteFile(vaultId, 'Ideas', 'Idea 1', 'Content 1');
      await saveNoteFile(vaultId, 'Ideas', 'Idea 2', 'Content 2');
      await saveNoteFile(vaultId, 'Tasks', 'Task A', 'Content A');

      const notes = await getAllNotesFromFilesystem(vaultId);
      expect(notes.length).toBe(3);
      expect(notes.map((n) => n.folder)).toContain('Ideas');
      expect(notes.map((n) => n.folder)).toContain('Tasks');
    });
  });
});
