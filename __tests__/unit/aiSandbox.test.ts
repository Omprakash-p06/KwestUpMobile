/**
 * Unit Test Suite: AI Execution Sandbox & Adversarial Defenses
 *
 * Requirements Covered: [CMD-01]
 * Codebase Alignment: ARCHITECTURE.md, CONCERNS.md, rulebook/ai/intent-parser.md
 */

import {
  sanitizeAiPayload,
  executeAiCommand,
} from '../../src/commands/aiSandbox';
import {
  registerCommandHandler,
  clearCommandHandlers,
  clearIdempotencyCache,
} from '../../src/commands/commandExecutor';
import { eventBus } from '../../src/behavior/eventBus';

describe('aiSandbox', () => {
  beforeEach(() => {
    clearCommandHandlers();
    clearIdempotencyCache();
    eventBus.clearListeners();
    eventBus.clearBuffer();
  });

  describe('Adversarial Payload Sanitization (sanitizeAiPayload)', () => {
    it('rejects null, non-objects, and arrays as root payload', () => {
      expect(() => sanitizeAiPayload(null)).toThrow(/plain, non-null object/i);
      expect(() => sanitizeAiPayload('string-payload')).toThrow(/plain, non-null object/i);
      expect(() => sanitizeAiPayload([1, 2, 3])).toThrow(/plain, non-null object/i);
    });

    it('strips prototype pollution attacks (__proto__, constructor, prototype)', () => {
      const maliciousPayload = JSON.parse(`{
        "title": "Legitimate Habit",
        "__proto__": { "polluted": true },
        "nested": {
          "constructor": { "prototype": { "admin": true } },
          "validKey": "validValue"
        }
      }`);

      const sanitized = sanitizeAiPayload(maliciousPayload);

      expect((sanitized as any).__proto__.polluted).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).admin).toBeUndefined();
      expect(sanitized.title).toBe('Legitimate Habit');
      expect((sanitized.nested as any).validKey).toBe('validValue');
      expect(Object.prototype.hasOwnProperty.call(sanitized.nested, 'constructor')).toBe(false);
      expect((Object.prototype as any).admin).toBeUndefined();
    });

    it('rejects attempts to inject local storage keys (kwestup_*)', () => {
      const storageKeyInValue = {
        title: 'kwestup_habits_v1',
        behavior: 'Write code',
      };
      expect(() => sanitizeAiPayload(storageKeyInValue)).toThrow(
        /Prohibited storage key injection detected/i
      );

      const storageKeyInKey = {
        kwestup_identities_v1: 'dump',
        title: 'Valid Habit',
      };
      expect(() => sanitizeAiPayload(storageKeyInKey)).toThrow(
        /Prohibited pattern detected in key/i
      );
    });

    it('rejects path traversal attempts (../, file://, Windows drives, UNC shares, Unix root paths)', () => {
      const traversalPayload = {
        title: 'Read Books',
        behavior: '../../etc/passwd',
      };
      expect(() => sanitizeAiPayload(traversalPayload)).toThrow(
        /Prohibited path traversal sequence detected/i
      );

      const fileSchemePayload = {
        title: 'Read Books',
        cueLocation: 'file:///system/priv-app',
      };
      expect(() => sanitizeAiPayload(fileSchemePayload)).toThrow(
        /Prohibited path traversal sequence detected/i
      );

      const windowsDrivePayload = {
        title: 'Read Books',
        cueLocation: 'C:\\Windows\\System32\\cmd.exe',
      };
      expect(() => sanitizeAiPayload(windowsDrivePayload)).toThrow(
        /Prohibited path traversal sequence detected/i
      );

      const uncPayload = {
        title: 'Read Books',
        cueLocation: '\\\\fileserver\\share\\data',
      };
      expect(() => sanitizeAiPayload(uncPayload)).toThrow(
        /Prohibited path traversal sequence detected/i
      );

      const unixRootPayload = {
        title: 'Read Books',
        cueLocation: '/etc/shadow',
      };
      expect(() => sanitizeAiPayload(unixRootPayload)).toThrow(
        /Prohibited path traversal sequence detected/i
      );

      // Legitimate user text containing slash is permitted
      const legitimateSlashPayload = {
        title: 'Morning / Evening Walk',
        behavior: 'Walk 10,000 steps/day',
      };
      expect(() => sanitizeAiPayload(legitimateSlashPayload)).not.toThrow();
    });

    it('rejects non-JSON primitive types (functions, symbols, class instances)', () => {
      const payloadWithFn = {
        title: 'Morning Yoga',
        runMaliciousCode: () => 'evil',
      };
      expect(() => sanitizeAiPayload(payloadWithFn)).toThrow(/Unsupported data type "function"/i);

      const payloadWithSymbol = {
        title: 'Morning Yoga',
        sym: Symbol('hack'),
      };
      expect(() => sanitizeAiPayload(payloadWithSymbol)).toThrow(/Unsupported data type "symbol"/i);

      const payloadWithDate = {
        title: 'Morning Yoga',
        date: new Date(),
      };
      expect(() => sanitizeAiPayload(payloadWithDate)).toThrow(/Non-plain object instance rejected/i);
    });

    it('preserves legitimate primitives and nested structures', () => {
      const validPayload = {
        title: 'Evening Reading',
        behavior: 'Read 20 pages',
        minimumAction: 'Read 1 page',
        normalTarget: 'Read 20 pages',
        frequency: 'daily',
        cueType: 'evening',
        customSchedule: {
          weekdays: [1, 2, 3],
        },
      };

      const sanitized = sanitizeAiPayload(validPayload);
      expect(sanitized).toEqual(validPayload);
    });
  });

  describe('Sandboxed Execution Pipeline (executeAiCommand)', () => {
    it('handles malformed JSON strings safely without crashing', async () => {
      const result = await executeAiCommand('{ action: CREATE_HABIT broken json ');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Malformed JSON string/i);
    });

    it('rejects invalid top-level shape or missing action', async () => {
      const resNonObj = await executeAiCommand(12345);
      expect(resNonObj.success).toBe(false);
      expect(resNonObj.error).toMatch(/non-null object/i);

      const resNoAction = await executeAiCommand({ payload: {} });
      expect(resNoAction.success).toBe(false);
      expect(resNoAction.error).toMatch(/Missing or invalid "action"/i);
    });

    it('enforces destructive command confirmation gate for DELETE_HABIT and ARCHIVE_HABIT', async () => {
      // DELETE_HABIT unconfirmed
      const delCmd = {
        action: 'DELETE_HABIT',
        payload: { habitId: 'habit-to-delete' },
      };
      const resDel = await executeAiCommand(delCmd);
      expect(resDel.success).toBe(false);
      expect(resDel.requiresConfirmation).toBe(true);
      expect(resDel.rulesApplied).toContain('SYS_AI_CONFIRMATION_GATE_001');
      expect(resDel.message).toMatch(/requires user confirmation/i);

      // ARCHIVE_HABIT unconfirmed
      const archCmd = {
        action: 'ARCHIVE_HABIT',
        payload: { habitId: 'habit-to-archive', actor: 'user', reason: 'User completed project' },
      };
      const resArch = await executeAiCommand(archCmd);
      expect(resArch.success).toBe(false);
      expect(resArch.requiresConfirmation).toBe(true);

      // With explicit confirmation, passes gate and dispatches to executor
      registerCommandHandler('DELETE_HABIT', async (p) => ({
        entityId: p.habitId,
        message: 'Deleted successfully',
      }));

      const resConfirmed = await executeAiCommand(delCmd, { confirmed: true });
      expect(resConfirmed.success).toBe(true);
      expect(resConfirmed.entityId).toBe('habit-to-delete');
    });

    it('prevents untrusted AI input from self-authorizing destructive actions via embedded confirmed: true', async () => {
      registerCommandHandler('DELETE_HABIT', async (p) => ({
        entityId: p.habitId,
        message: 'Deleted',
      }));

      const adversarialSelfConfirmingCmd = {
        action: 'DELETE_HABIT',
        payload: { habitId: 'habit-to-delete' },
        confirmed: true, // Attempted self-authorization
      };

      // Called without caller options.confirmed === true
      const result = await executeAiCommand(adversarialSelfConfirmingCmd);
      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.rulesApplied).toContain('SYS_AI_CONFIRMATION_GATE_001');
    });

    it('accepts intent parser "params" alias as payload', async () => {
      registerCommandHandler('CREATE_IDENTITY', async (p) => ({
        entityId: 'id-runner',
        message: 'Identity created',
      }));

      const intentParserOutput = {
        action: 'CREATE_IDENTITY',
        params: {
          statement: 'I am a consistent marathon runner',
        },
      };

      const result = await executeAiCommand(intentParserOutput);
      expect(result.success).toBe(true);
      expect(result.entityId).toBe('id-runner');
      expect(result.requestId).toMatch(/^cmd_ai_/);
    });

    it('rejects AI command containing storage key or path injection in payload', async () => {
      const maliciousCmd = {
        action: 'CREATE_IDENTITY',
        params: {
          statement: 'kwestup_identities_v1 leak',
        },
      };

      const result = await executeAiCommand(maliciousCmd);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Prohibited storage key injection/i);
    });
  });
});
