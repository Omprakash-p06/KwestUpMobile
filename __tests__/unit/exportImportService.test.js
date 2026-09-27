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

    it('produces v2 envelope format with 128-bit hex salt, iv, and 100,000 PBKDF2 iterations', () => {
      const ciphertext = encryptBackup(samplePayload, samplePassphrase);
      const envelope = JSON.parse(ciphertext);
      expect(envelope.v).toBe(2);
      expect(envelope.kdf).toBe('PBKDF2');
      expect(envelope.hasher).toBe('SHA256');
      expect(envelope.iterations).toBe(100000);
      expect(typeof envelope.salt).toBe('string');
      expect(envelope.salt.length).toBe(32); // 16 bytes = 32 hex chars
      expect(typeof envelope.iv).toBe('string');
      expect(envelope.iv.length).toBe(32);   // 16 bytes = 32 hex chars
      expect(typeof envelope.ciphertext).toBe('string');
      expect(envelope.ciphertext.length).toBeGreaterThan(0);
    });

    it('generates distinct ciphertexts when encrypting identical payload and passphrase (random salt & IV)', () => {
      const ciphertext1 = encryptBackup(samplePayload, samplePassphrase);
      const ciphertext2 = encryptBackup(samplePayload, samplePassphrase);
      expect(ciphertext1).not.toBe(ciphertext2);

      const env1 = JSON.parse(ciphertext1);
      const env2 = JSON.parse(ciphertext2);
      expect(env1.salt).not.toBe(env2.salt);
      expect(env1.iv).not.toBe(env2.iv);
      expect(env1.ciphertext).not.toBe(env2.ciphertext);

      expect(decryptBackup(ciphertext1, samplePassphrase)).toEqual(samplePayload);
      expect(decryptBackup(ciphertext2, samplePassphrase)).toEqual(samplePayload);
    });

    it('transparently decrypts legacy v1 archives generated with static salt and 1k iterations', () => {
      // Recreate legacy v1 encryption
      const CryptoJS = require('crypto-js');
      const legacySalt = CryptoJS.enc.Hex.parse('4b77657374557053616c745f7632');
      const legacyKey = CryptoJS.PBKDF2(samplePassphrase, legacySalt, { keySize: 256 / 32, iterations: 1000 });
      const legacyCiphertext = CryptoJS.AES.encrypt(JSON.stringify(samplePayload), legacyKey, { iv: legacySalt }).toString();

      const decrypted = decryptBackup(legacyCiphertext, samplePassphrase);
      expect(decrypted).toEqual(samplePayload);
      expect(decrypted.metadata.appVersion).toBe('3.5.0');
    });

    it('throws error when envelope fields are tampered with', () => {
      const ciphertext = encryptBackup(samplePayload, samplePassphrase);
      const envelope = JSON.parse(ciphertext);
      envelope.salt = '00000000000000000000000000000000'; // corrupt salt
      expect(() => {
        decryptBackup(JSON.stringify(envelope), samplePassphrase);
      }).toThrow('Unable to decrypt archive. Please verify the passphrase.');
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
