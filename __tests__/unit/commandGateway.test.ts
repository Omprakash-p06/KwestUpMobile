/**
 * Unit Test Suite: Command Gateway Validation & Execution Layer
 *
 * Requirements Covered: [CMD-01]
 * Codebase Alignment: ARCHITECTURE.md, CONCERNS.md, CONVENTIONS.md, TESTING.md
 */

import {
  validateCommand,
  checkCommandCapability,
  SUPPORTED_COMMAND_ACTIONS,
} from '../../src/commands/commandValidator';
import {
  executeCommand,
  registerCommandHandler,
  unregisterCommandHandler,
  clearCommandHandlers,
  clearIdempotencyCache,
  getIdempotencyCacheSize,
  purgeExpiredEntries,
  MAX_IDEMPOTENCY_CACHE_SIZE,
  IDEMPOTENCY_TTL_MS,
} from '../../src/commands/commandExecutor';
import { DispatchedCommand } from '../../src/commands/types';
import { eventBus } from '../../src/behavior/eventBus';

describe('commandGateway', () => {
  beforeEach(() => {
    clearCommandHandlers();
    clearIdempotencyCache();
    eventBus.clearListeners();
    eventBus.clearBuffer();
  });

  describe('Command Validator (validateCommand & checkCommandCapability)', () => {
    it('validates supported actions capability catalog', () => {
      SUPPORTED_COMMAND_ACTIONS.forEach((action) => {
        const capability = checkCommandCapability(action);
        expect(capability.supported).toBe(true);
      });

      const unsupported = checkCommandCapability('WIPE_ALL_DATA');
      expect(unsupported.supported).toBe(false);
      expect(unsupported.rulesApplied).toContain('SYS_COMMAND_CAPABILITY_CHECK_001');
    });

    it('rejects null or non-object commands', () => {
      const resNull = validateCommand(null as any);
      expect(resNull.valid).toBe(false);
      expect(resNull.errors[0]).toMatch(/non-null object/i);

      const resArray = validateCommand([] as any);
      expect(resArray.valid).toBe(false);
    });

    it('validates idempotencyKey length and presence', () => {
      const shortKeyCmd: DispatchedCommand<'CREATE_IDENTITY'> = {
        action: 'CREATE_IDENTITY',
        idempotencyKey: 'abc', // < 4 chars
        payload: { statement: 'I am a reader' },
      };
      const resShort = validateCommand(shortKeyCmd);
      expect(resShort.valid).toBe(false);
      expect(resShort.errors[0]).toMatch(/idempotencyKey/i);

      const longKeyCmd: DispatchedCommand<'CREATE_IDENTITY'> = {
        action: 'CREATE_IDENTITY',
        idempotencyKey: 'x'.repeat(129),
        payload: { statement: 'I am a reader' },
      };
      const resLong = validateCommand(longKeyCmd);
      expect(resLong.valid).toBe(false);
      expect(resLong.errors[0]).toMatch(/idempotencyKey/i);
    });

    it('rejects unsupported actions via SYS_COMMAND_CAPABILITY_CHECK_001', () => {
      const badActionCmd = {
        action: 'NATIVE_FS_DELETE',
        idempotencyKey: 'test-key-1234',
        payload: {},
      } as any;

      const res = validateCommand(badActionCmd);
      expect(res.valid).toBe(false);
      expect(res.rulesApplied).toContain('SYS_COMMAND_CAPABILITY_CHECK_001');
      expect(res.errors[0]).toMatch(/Unsupported command action/i);
    });

    it('validates CREATE_HABIT schema and parameter rules', () => {
      const validCmd: DispatchedCommand<'CREATE_HABIT'> = {
        action: 'CREATE_HABIT',
        idempotencyKey: 'create-cmd-001',
        payload: {
          identityId: 'id-writer-1',
          title: 'Morning Writing',
          behavior: 'Write 500 words on novel',
          minimumAction: 'Write 1 sentence',
          normalTarget: 'Write 500 words',
          frequency: 'daily',
          cueType: 'time',
          cueTime: '08:30',
        },
      };
      expect(validateCommand(validCmd).valid).toBe(true);

      // Missing cueTime when cueType is 'time'
      const missingTimeCmd: DispatchedCommand<'CREATE_HABIT'> = {
        ...validCmd,
        payload: { ...validCmd.payload, cueTime: undefined },
      };
      const resTime = validateCommand(missingTimeCmd);
      expect(resTime.valid).toBe(false);
      expect(resTime.errors.some((e) => e.includes('cueTime'))).toBe(true);

      // Invalid cueTime format (e.g. 25:00 or 8:30)
      const badTimeCmd: DispatchedCommand<'CREATE_HABIT'> = {
        ...validCmd,
        payload: { ...validCmd.payload, cueTime: '25:00' },
      };
      expect(validateCommand(badTimeCmd).valid).toBe(false);

      // Custom schedule weekday checks
      const customCmd: DispatchedCommand<'CREATE_HABIT'> = {
        ...validCmd,
        payload: {
          ...validCmd.payload,
          frequency: 'custom',
          customSchedule: { weekdays: [1, 3, 5] },
        },
      };
      expect(validateCommand(customCmd).valid).toBe(true);

      const invalidCustomCmd: DispatchedCommand<'CREATE_HABIT'> = {
        ...validCmd,
        payload: {
          ...validCmd.payload,
          frequency: 'custom',
          customSchedule: { weekdays: [1, 7] }, // 7 is invalid (0..6)
        },
      };
      // Optional identityId validation
      const withoutIdentityCmd: DispatchedCommand<'CREATE_HABIT'> = {
        ...validCmd,
        payload: {
          title: 'Daily Meditation',
          behavior: 'Meditate for 10 minutes',
          minimumAction: 'Sit quietly for 1 minute',
          normalTarget: 'Meditate 10 minutes',
          frequency: 'daily',
          cueType: 'morning',
        },
      };
      expect(validateCommand(withoutIdentityCmd).valid).toBe(true);

      const emptyIdentityCmd: DispatchedCommand<'CREATE_HABIT'> = {
        ...withoutIdentityCmd,
        payload: {
          ...withoutIdentityCmd.payload,
          identityId: '   ',
        },
      };
      expect(validateCommand(emptyIdentityCmd).valid).toBe(false);
    });

    it('strictly forbids engine-owned fields and unknown fields in UPDATE_HABIT', () => {
      const forbiddenFields = [
        'status',
        'streakCount',
        'bestStreak',
        'totalEvidenceVotes',
        'lastCompletedDate',
        'createdAt',
        'id',
      ];

      for (const field of forbiddenFields) {
        const cmd: DispatchedCommand<'UPDATE_HABIT'> = {
          action: 'UPDATE_HABIT',
          idempotencyKey: `upd-${field}-123`,
          payload: {
            habitId: 'h-1',
            updates: {
              title: 'New Title',
              [field]: 'tampered_value',
            } as any,
          },
        };
        const res = validateCommand(cmd);
        expect(res.valid).toBe(false);
        expect(res.errors.some((e) => e.includes(`Field "${field}" is engine-owned`))).toBe(true);
      }

      // Rejects unknown arbitrary fields
      const unknownFieldCmd: DispatchedCommand<'UPDATE_HABIT'> = {
        action: 'UPDATE_HABIT',
        idempotencyKey: 'upd-unknown-1234',
        payload: {
          habitId: 'h-1',
          updates: {
            title: 'New Title',
            unknownKey: 'rogue',
          } as any,
        },
      };
      const resUnknown = validateCommand(unknownFieldCmd);
      expect(resUnknown.valid).toBe(false);
      expect(resUnknown.errors.some((e) => e.includes('Field "unknownKey" is not a permitted update field'))).toBe(true);

      // Validates stretchTarget
      const invalidStretchCmd: DispatchedCommand<'UPDATE_HABIT'> = {
        action: 'UPDATE_HABIT',
        idempotencyKey: 'upd-stretch-1234',
        payload: {
          habitId: 'h-1',
          updates: {
            stretchTarget: 's'.repeat(101),
          },
        },
      };
      expect(validateCommand(invalidStretchCmd).valid).toBe(false);

      // Valid update with allowed keys passes
      const validUpdCmd: DispatchedCommand<'UPDATE_HABIT'> = {
        action: 'UPDATE_HABIT',
        idempotencyKey: 'upd-valid-1234',
        payload: {
          habitId: 'h-1',
          updates: {
            title: 'Refined Writing Habit',
            minimumAction: 'Write 2 sentences',
            stretchTarget: 'Write 1000 words',
          },
        },
      };
      expect(validateCommand(validUpdCmd).valid).toBe(true);
    });

    it('enforces explicit user confirmation for AI actor in DELETE_HABIT and ARCHIVE_HABIT', () => {
      // User actor does not require explicit confirmation flag
      const userDelCmd: DispatchedCommand<'DELETE_HABIT'> = {
        action: 'DELETE_HABIT',
        actor: 'user',
        idempotencyKey: 'del-user-1234',
        payload: { habitId: 'h-1' },
      };
      expect(validateCommand(userDelCmd).valid).toBe(true);

      // AI actor without confirmation fails
      const aiDelUnconfirmed: DispatchedCommand<'DELETE_HABIT'> = {
        action: 'DELETE_HABIT',
        actor: 'ai',
        confirmed: false,
        idempotencyKey: 'del-ai-1234',
        payload: { habitId: 'h-1' },
      };
      const resAiDel = validateCommand(aiDelUnconfirmed);
      expect(resAiDel.valid).toBe(false);
      expect(resAiDel.errors[0]).toMatch(/requires explicit user confirmation/i);

      // AI actor with confirmation passes
      const aiDelConfirmed: DispatchedCommand<'DELETE_HABIT'> = {
        ...aiDelUnconfirmed,
        confirmed: true,
      };
      expect(validateCommand(aiDelConfirmed).valid).toBe(true);

      // AI actor with ARCHIVE_HABIT unconfirmed fails
      const aiArchiveUnconfirmed: DispatchedCommand<'ARCHIVE_HABIT'> = {
        action: 'ARCHIVE_HABIT',
        actor: 'ai',
        confirmed: false,
        idempotencyKey: 'arch-ai-1234',
        payload: { habitId: 'h-1', actor: 'user', reason: 'User completed project' },
      };
      expect(validateCommand(aiArchiveUnconfirmed).valid).toBe(false);

      const aiArchiveConfirmed: DispatchedCommand<'ARCHIVE_HABIT'> = {
        ...aiArchiveUnconfirmed,
        confirmed: true,
      };
      expect(validateCommand(aiArchiveConfirmed).valid).toBe(true);
    });

    it('validates LOG_HABIT completedAt and duration', () => {
      const validLogCmd: DispatchedCommand<'LOG_HABIT'> = {
        action: 'LOG_HABIT',
        idempotencyKey: 'log-cmd-001',
        payload: {
          habitId: 'h-1',
          completedAt: '2026-10-11T12:00:00.000Z',
          durationMinutes: 15,
          frictionCategory: 'effort',
        },
      };
      expect(validateCommand(validLogCmd).valid).toBe(true);

      // Malformed ISO date
      const badDateCmd: DispatchedCommand<'LOG_HABIT'> = {
        ...validLogCmd,
        payload: { ...validLogCmd.payload, completedAt: 'not-a-date' },
      };
      expect(validateCommand(badDateCmd).valid).toBe(false);

      // Negative duration
      const negativeDurationCmd: DispatchedCommand<'LOG_HABIT'> = {
        ...validLogCmd,
        payload: { ...validLogCmd.payload, durationMinutes: -5 },
      };
      expect(validateCommand(negativeDurationCmd).valid).toBe(false);
    });

    it('validates START_RECOVERY, DISMISS_INTERVENTION, and ADJUST_DIFFICULTY', () => {
      // START_RECOVERY
      const validRecovery: DispatchedCommand<'START_RECOVERY'> = {
        action: 'START_RECOVERY',
        idempotencyKey: 'rec-cmd-001',
        payload: { habitId: 'h-1', reason: 'mental' },
      };
      expect(validateCommand(validRecovery).valid).toBe(true);

      const invalidRecovery: DispatchedCommand<'START_RECOVERY'> = {
        action: 'START_RECOVERY',
        idempotencyKey: 'rec-cmd-002',
        payload: { habitId: 'h-1', reason: 'alien_abduction' as any },
      };
      expect(validateCommand(invalidRecovery).valid).toBe(false);

      // DISMISS_INTERVENTION
      const validDismiss: DispatchedCommand<'DISMISS_INTERVENTION'> = {
        action: 'DISMISS_INTERVENTION',
        idempotencyKey: 'dis-cmd-001',
        payload: { interventionId: 'int-1', reason: 'acted' },
      };
      expect(validateCommand(validDismiss).valid).toBe(true);

      // ADJUST_DIFFICULTY
      const validAdjust: DispatchedCommand<'ADJUST_DIFFICULTY'> = {
        action: 'ADJUST_DIFFICULTY',
        idempotencyKey: 'adj-cmd-001',
        payload: { habitId: 'h-1', direction: 'easier', newMinimumAction: 'Do 1 pushup' },
      };
      expect(validateCommand(validAdjust).valid).toBe(true);

      const invalidAdjust: DispatchedCommand<'ADJUST_DIFFICULTY'> = {
        action: 'ADJUST_DIFFICULTY',
        idempotencyKey: 'adj-cmd-002',
        payload: { habitId: 'h-1', direction: 'sideways' as any, newMinimumAction: 'Do 1 pushup' },
      };
      expect(validateCommand(invalidAdjust).valid).toBe(false);
    });
  });

  describe('Command Executor (executeCommand & Idempotency Cache)', () => {
    it('returns error on invalid command schema without invoking handler', async () => {
      const mockHandler = jest.fn();
      registerCommandHandler('CREATE_IDENTITY', mockHandler);

      const invalidCmd: DispatchedCommand<'CREATE_IDENTITY'> = {
        action: 'CREATE_IDENTITY',
        idempotencyKey: 'x', // too short
        payload: { statement: '' },
      };

      const result = await executeCommand(invalidCmd);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('returns error when no handler is registered for action', async () => {
      const cmd: DispatchedCommand<'CREATE_IDENTITY'> = {
        action: 'CREATE_IDENTITY',
        idempotencyKey: 'identity-cmd-001',
        payload: { statement: 'I am a disciplined runner' },
      };

      const result = await executeCommand(cmd);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler registered');
    });

    it('successfully executes registered handler and emits COMMAND_EXECUTED telemetry', async () => {
      const executedEvents: any[] = [];
      const unsub = eventBus.subscribe('COMMAND_EXECUTED', (evt) => {
        executedEvents.push(evt);
      });

      const mockHandler = jest.fn().mockResolvedValue({
        entityId: 'identity-100',
        message: 'Identity created successfully',
        rulesApplied: ['HABIT_IDENTITY_ANCHOR_001'],
      });
      registerCommandHandler('CREATE_IDENTITY', mockHandler);

      const cmd: DispatchedCommand<'CREATE_IDENTITY'> = {
        action: 'CREATE_IDENTITY',
        actor: 'user',
        idempotencyKey: 'identity-cmd-002',
        payload: { statement: 'I am a focused writer' },
      };

      const result = await executeCommand(cmd);

      expect(result.success).toBe(true);
      expect(result.entityId).toBe('identity-100');
      expect(result.message).toBe('Identity created successfully');
      expect(result.requestId).toBe('identity-cmd-002');
      expect(result.rulesApplied).toContain('HABIT_IDENTITY_ANCHOR_001');
      expect(mockHandler).toHaveBeenCalledTimes(1);

      // Verify eventBus telemetry emission
      expect(executedEvents).toHaveLength(1);
      expect(executedEvents[0].type).toBe('COMMAND_EXECUTED');
      expect(executedEvents[0].source).toBe('app'); // user mapped to 'app'
      expect(executedEvents[0].payload.action).toBe('CREATE_IDENTITY');

      unsub();
    });

    it('deduplicates identical idempotencyKey within TTL window citing SYS_IDEMPOTENT_COMMAND_001', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        entityId: 'habit-200',
        message: 'Habit logged',
      });
      registerCommandHandler('LOG_HABIT', mockHandler);

      const cmd: DispatchedCommand<'LOG_HABIT'> = {
        action: 'LOG_HABIT',
        actor: 'widget',
        idempotencyKey: 'widget-log-tap-999',
        payload: {
          habitId: 'habit-200',
          completedAt: '2026-10-11T12:00:00.000Z',
        },
      };

      // First execution
      const firstResult = await executeCommand(cmd);
      expect(firstResult.success).toBe(true);
      expect(mockHandler).toHaveBeenCalledTimes(1);

      // Replay with identical idempotencyKey
      const replayResult = await executeCommand(cmd);
      expect(replayResult.success).toBe(true);
      expect(replayResult.entityId).toBe('habit-200');
      expect(replayResult.rulesApplied).toContain('SYS_IDEMPOTENT_COMMAND_001');

      // Handler MUST NOT be executed a second time
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('expires idempotency entries past IDEMPOTENCY_TTL_MS allowing re-execution', async () => {
      const mockHandler = jest.fn().mockImplementation((payload) => ({
        entityId: payload.habitId,
        message: 'Logged habit',
      }));
      registerCommandHandler('LOG_HABIT', mockHandler);

      const cmd: DispatchedCommand<'LOG_HABIT'> = {
        action: 'LOG_HABIT',
        idempotencyKey: 'cmd-ttl-test-1234',
        payload: {
          habitId: 'habit-ttl-1',
          completedAt: '2026-10-11T12:00:00.000Z',
        },
      };

      const now = Date.now();
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

      await executeCommand(cmd);
      expect(mockHandler).toHaveBeenCalledTimes(1);

      // Advance time beyond TTL
      dateSpy.mockReturnValue(now + IDEMPOTENCY_TTL_MS + 1000);

      // Re-executing same idempotencyKey should purge stale entry and invoke handler again
      const resultAfterTtl = await executeCommand(cmd);
      expect(resultAfterTtl.success).toBe(true);
      expect(mockHandler).toHaveBeenCalledTimes(2);

      dateSpy.mockRestore();
    });

    it('purgeExpiredEntries purges expired cache records', async () => {
      const mockHandler = jest.fn().mockReturnValue({ message: 'Success' });
      registerCommandHandler('CREATE_IDENTITY', mockHandler);

      const now = Date.now();
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

      await executeCommand({
        action: 'CREATE_IDENTITY',
        idempotencyKey: 'key-to-expire-1',
        payload: { statement: 'Identity 1' },
      });
      await executeCommand({
        action: 'CREATE_IDENTITY',
        idempotencyKey: 'key-to-expire-2',
        payload: { statement: 'Identity 2' },
      });

      expect(getIdempotencyCacheSize()).toBe(2);

      // Advance time beyond TTL
      const purged = purgeExpiredEntries(now + IDEMPOTENCY_TTL_MS + 5000);
      expect(purged).toBe(2);
      expect(getIdempotencyCacheSize()).toBe(0);

      dateSpy.mockRestore();
    });

    it('evicts oldest cache entries when reaching MAX_IDEMPOTENCY_CACHE_SIZE', async () => {
      const mockHandler = jest.fn().mockImplementation((payload) => ({
        entityId: payload.statement,
        message: 'Created',
      }));
      registerCommandHandler('CREATE_IDENTITY', mockHandler);

      // Fill cache up to MAX_IDEMPOTENCY_CACHE_SIZE + 5
      for (let i = 0; i < MAX_IDEMPOTENCY_CACHE_SIZE + 5; i++) {
        const cmd: DispatchedCommand<'CREATE_IDENTITY'> = {
          action: 'CREATE_IDENTITY',
          idempotencyKey: `idempotency-key-${i.toString().padStart(4, '0')}`,
          payload: { statement: `Identity ${i}` },
        };
        await executeCommand(cmd);
      }

      expect(getIdempotencyCacheSize()).toBe(MAX_IDEMPOTENCY_CACHE_SIZE);

      // Oldest entry (key-0000) should have been evicted
      const evictedCmd: DispatchedCommand<'CREATE_IDENTITY'> = {
        action: 'CREATE_IDENTITY',
        idempotencyKey: 'idempotency-key-0000',
        payload: { statement: 'Identity 0' },
      };
      await executeCommand(evictedCmd);

      // Handler should be called again because key-0000 was evicted
      expect(mockHandler).toHaveBeenCalledTimes(MAX_IDEMPOTENCY_CACHE_SIZE + 6);
    });

    it('isolates handler exceptions and emits COMMAND_FAILED without crashing caller', async () => {
      const failedEvents: any[] = [];
      const unsub = eventBus.subscribe('COMMAND_FAILED', (evt) => {
        failedEvents.push(evt);
      });

      const failingHandler = jest.fn().mockRejectedValue(new Error('Storage disk I/O failure'));
      registerCommandHandler('START_RECOVERY', failingHandler);

      const cmd: DispatchedCommand<'START_RECOVERY'> = {
        action: 'START_RECOVERY',
        actor: 'user',
        idempotencyKey: 'recovery-fail-001',
        payload: { habitId: 'h-1', reason: 'effort' },
      };

      const result = await executeCommand(cmd);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage disk I/O failure');
      expect(result.message).toBe('');
      expect(result.requestId).toBe('recovery-fail-001');

      // Event emitted
      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0].type).toBe('COMMAND_FAILED');
      expect(failedEvents[0].payload.error).toBe('Storage disk I/O failure');

      unsub();
    });

    it('supports unregisterCommandHandler', async () => {
      const handler = jest.fn().mockReturnValue({ message: 'Done' });
      registerCommandHandler('CREATE_IDENTITY', handler);
      unregisterCommandHandler('CREATE_IDENTITY');

      const cmd: DispatchedCommand<'CREATE_IDENTITY'> = {
        action: 'CREATE_IDENTITY',
        idempotencyKey: 'unreg-key-1234',
        payload: { statement: 'Test unregister' },
      };

      const result = await executeCommand(cmd);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler registered');
    });
  });
});
