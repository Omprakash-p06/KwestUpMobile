import React from 'react';
import { View, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateCommand } from '../../src/commands/commandValidator';
import { DispatchedCommand } from '../../src/commands/types';
import { getVaultPath } from '../../src/utils/vaultService';
import { saveNoteFile, readNoteFile } from '../../src/utils/fileStorage';
import { isUserDataKey, clearAllCaches } from '../../src/utils/storage';
import { BirthdayProvider, useBirthdays } from '../../src/context/BirthdayContext';
import { eventBus } from '../../src/behavior/eventBus';

let birthdayContextValue: any = null;
const BirthdayTestConsumer = () => {
  birthdayContextValue = useBirthdays();
  return (
    <View>
      <Text>Birthday Consumer</Text>
    </View>
  );
};

describe('Logic Defect Fixes Regression Suite (DEF-05 through DEF-08)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    eventBus.clearListeners();
    eventBus.clearBuffer();
    jest.clearAllMocks();
    birthdayContextValue = null;
  });

  describe('DEF-05: Vault & FileStorage Path Traversal Protection', () => {
    it('getVaultPath sanitizes directory traversal characters from vaultId', () => {
      const maliciousId = '../../../etc/passwd';
      const resolvedPath = getVaultPath(maliciousId);

      // Path must NOT contain traversal tokens '../'
      expect(resolvedPath).not.toContain('../');
      expect(resolvedPath).toContain('Notes/Vaults/');
      // Traversal characters should be replaced with underscores
      expect(resolvedPath).toContain('_________etc_passwd');
    });

    it('saveNoteFile and readNoteFile sanitize folder traversal so notes stay in vault', async () => {
      const maliciousFolder = '../../escape';
      const noteTitle = 'Safe Note';
      const noteContent = '# Hello Vault';

      const saveResult = await saveNoteFile('default', maliciousFolder, noteTitle, noteContent);
      expect(saveResult.success).toBe(true);
      expect(saveResult.filePath).not.toContain('../../');
      expect(saveResult.filePath).toContain('Notes/Vaults/default/');

      const readContent = await readNoteFile('default', maliciousFolder, noteTitle);
      expect(readContent).toBe(noteContent);
    });
  });

  describe('DEF-06: Command Gateway Actor Resolution & AI Confirmation', () => {
    it('validates PAUSE_HABIT using root command.actor when payload.actor is omitted', () => {
      const command: DispatchedCommand = {
        action: 'PAUSE_HABIT',
        idempotencyKey: 'test-idemp-pause-001',
        actor: 'user',
        payload: {
          habitId: 'habit-123',
          reason: 'Travelling abroad',
        } as any,
      };

      const result = validateCommand(command);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('validates ARCHIVE_HABIT when initiated by user without payload.actor', () => {
      const command: DispatchedCommand = {
        action: 'ARCHIVE_HABIT',
        idempotencyKey: 'test-idemp-archive-001',
        actor: 'user',
        payload: {
          habitId: 'habit-123',
          reason: 'No longer needed',
        } as any,
      };

      const result = validateCommand(command);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('allows AI-initiated ARCHIVE_HABIT when command.confirmed is true', () => {
      const command: DispatchedCommand = {
        action: 'ARCHIVE_HABIT',
        idempotencyKey: 'test-idemp-archive-ai-002',
        actor: 'ai',
        confirmed: true,
        payload: {
          habitId: 'habit-123',
          reason: 'Confirmed by user through assistant',
        } as any,
      };

      const result = validateCommand(command);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects AI-initiated ARCHIVE_HABIT when command.confirmed is false or omitted', () => {
      const command: DispatchedCommand = {
        action: 'ARCHIVE_HABIT',
        idempotencyKey: 'test-idemp-archive-ai-003',
        actor: 'ai',
        confirmed: false,
        payload: {
          habitId: 'habit-123',
          reason: 'AI suggested archive',
        } as any,
      };

      const result = validateCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Destructive action ARCHIVE_HABIT initiated by AI requires explicit user confirmation'
      );
    });

    it('validates RESUME_HABIT using root command.actor', () => {
      const command: DispatchedCommand = {
        action: 'RESUME_HABIT',
        idempotencyKey: 'test-idemp-resume-001',
        actor: 'engine',
        payload: {
          habitId: 'habit-123',
          reason: 'Vacation schedule completed',
        } as any,
      };

      const result = validateCommand(command);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('DEF-07: Durable Idempotency Store Protection in isUserDataKey', () => {
    it('isUserDataKey returns true for kwestup_idempotency_v1 key', () => {
      expect(isUserDataKey('kwestup_idempotency_v1')).toBe(true);
      expect(isUserDataKey('kwestup_idempotency_custom')).toBe(true);
    });

    it('clearAllCaches preserves durable idempotency keys while deleting cache keys', async () => {
      await AsyncStorage.setItem('kwestup_idempotency_v1', JSON.stringify({ 'req-1': { success: true } }));
      await AsyncStorage.setItem('kwestup_ui_cache', 'transient-cache-data');
      await AsyncStorage.setItem('kwestup_temp_cache', 'temp-data');

      await clearAllCaches();

      const preservedIdempotency = await AsyncStorage.getItem('kwestup_idempotency_v1');
      expect(preservedIdempotency).not.toBeNull();

      const clearedUiCache = await AsyncStorage.getItem('kwestup_ui_cache');
      expect(clearedUiCache).toBeNull();
    });
  });

  describe('DEF-08: BirthdayContext Telemetry birthDate Fallback', () => {
    it('emits BIRTHDAY_CREATED with populated date when record provides birthDate', async () => {
      await act(async () => {
        renderer.create(
          <BirthdayProvider initialBirthdays={[]}>
            <BirthdayTestConsumer />
          </BirthdayProvider>
        );
      });

      const birthdayInput = {
        name: 'Sarah Connor',
        birthDate: '1984-05-12',
      };

      await act(async () => {
        await birthdayContextValue.handleSaveBirthday(birthdayInput);
      });

      const events = eventBus.getRecentEvents();
      const bdayEvent = events.find((e) => e.type === 'BIRTHDAY_CREATED');

      expect(bdayEvent).toBeDefined();
      expect(bdayEvent?.payload?.name).toBe('Sarah Connor');
      // Must not be undefined! Must resolve to '1984-05-12'
      expect(bdayEvent?.payload?.date).toBe('1984-05-12');
    });
  });
});
