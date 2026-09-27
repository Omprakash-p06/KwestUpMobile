import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  encryptBackup,
  decryptBackup,
  exportArchive,
  importArchive,
} from '../../src/utils/exportService';

describe('exportService & importService Unit Tests', () => {
  const samplePassphrase = 'SuperSecretPassphrase123!';
  const samplePayload = {
    metadata: {
      appVersion: '3.5.0',
      storageVersion: 'v5.0',
      createdAt: '2026-09-27T12:00:00.000Z',
      vaultCount: 1,
      totalNotes: 2,
    },
    storage: {
      kwestup_tasks_v5: JSON.stringify([{ id: 'task-1', title: 'Buy milk', completed: false }]),
      kwestup_birthdays_v5: JSON.stringify([{ id: 'bday-1', name: 'Alice', date: '1995-10-15' }]),
    },
    vaults: [
      {
        id: 'default',
        name: 'Personal',
        createdAt: '2026-01-01T00:00:00.000Z',
        notes: [
          {
            folder: 'Work',
            title: 'Meeting Notes',
            content: '# Meeting\nDiscussed architecture and testing.',
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    if (FileSystem.__resetFS) {
      FileSystem.__resetFS();
    }
    jest.clearAllMocks();
  });

  describe('encryptBackup and decryptBackup round-trip', () => {
    it('successfully encrypts and decrypts a backup payload with the correct passphrase', () => {
      const ciphertext = encryptBackup(samplePayload, samplePassphrase);
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext.length).toBeGreaterThan(50);
      expect(ciphertext).not.toContain('Meeting Notes');

      const decrypted = decryptBackup(ciphertext, samplePassphrase);
      expect(decrypted).toEqual(samplePayload);
      expect(decrypted.metadata.appVersion).toBe('3.5.0');
      expect(decrypted.vaults[0].notes[0].title).toBe('Meeting Notes');
    });

    it('throws error when decrypting with an incorrect passphrase', () => {
      const ciphertext = encryptBackup(samplePayload, samplePassphrase);
      expect(() => {
        decryptBackup(ciphertext, 'WrongPassphrase!');
      }).toThrow('Unable to decrypt archive. Please verify the passphrase.');
    });

    it('throws error when decrypting corrupted or malformed ciphertext', () => {
      expect(() => {
        decryptBackup('invalid-not-hex-ciphertext', samplePassphrase);
      }).toThrow('Unable to decrypt archive. Please verify the passphrase.');
    });
  });

  describe('exportArchive pipeline', () => {
    it('packages storage and vault data into an encrypted archive and shares it', async () => {
      await AsyncStorage.setItem('kwestup_tasks_v5.0', JSON.stringify([{ id: '1', title: 'Task' }]));
      const progressUpdates = [];
      const onProgress = (p) => progressUpdates.push(p);

      await exportArchive(samplePassphrase, onProgress);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(Sharing.shareAsync).toHaveBeenCalled();
      const sharedUri = Sharing.shareAsync.mock.calls[0][0];
      expect(sharedUri).toMatch(/\.kwestup$/);

      // Verify temp file was cleaned up
      const tempFileInfo = await FileSystem.getInfoAsync(sharedUri);
      expect(tempFileInfo.exists).toBe(false);
    });
  });

  describe('importArchive pipeline', () => {
    it('reads encrypted archive, decrypts, restores storage and note files', async () => {
      const archivePath = `${FileSystem.documentDirectory}test-backup.kwestup`;
      const ciphertext = encryptBackup(samplePayload, samplePassphrase);
      await FileSystem.writeAsStringAsync(archivePath, ciphertext);

      const progressUpdates = [];
      const onProgress = (p) => progressUpdates.push(p);

      await importArchive(archivePath, samplePassphrase, onProgress);

      expect(progressUpdates).toContain(1.0);
      // Verify storage was restored
      const restoredTasks = await AsyncStorage.getItem('kwestup_tasks_v5');
      expect(restoredTasks).toContain('Buy milk');

      // Verify vault notes were restored on filesystem
      const notePath = `${FileSystem.documentDirectory}Notes/Vaults/default/Work/Meeting Notes.md`;
      const noteInfo = await FileSystem.getInfoAsync(notePath);
      expect(noteInfo.exists).toBe(true);

      const noteContent = await FileSystem.readAsStringAsync(notePath);
      expect(noteContent).toContain('Discussed architecture and testing.');
    });

    it('rejects archive when passphrase is wrong', async () => {
      const archivePath = `${FileSystem.documentDirectory}test-backup.kwestup`;
      const ciphertext = encryptBackup(samplePayload, samplePassphrase);
      await FileSystem.writeAsStringAsync(archivePath, ciphertext);

      await expect(importArchive(archivePath, 'WrongPassword', jest.fn())).rejects.toThrow(
        'INVALID PASSPHRASE OR CORRUPTED ARCHIVE'
      );
    });
  });
});
