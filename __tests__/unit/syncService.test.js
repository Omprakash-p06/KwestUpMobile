import { pingSyncServer, performSync, validateSyncConfig, validateSyncPayload } from '../../src/utils/syncService';

describe('syncService Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  const validConfig = {
    ip: '192.168.1.50',
    port: 8080,
    token: 'test-secure-token-abc-123',
  };

  const sampleLocalData = {
    notes: [{ title: 'Sync Note', content: 'Sync Content' }],
    tasks: [{ id: 'task-1', title: 'Task to sync' }],
    taskLists: [{ id: 'list-1', name: 'Work' }],
    birthdays: [{ name: 'Bob', date: '1990-01-01' }],
    themeMode: 'dark',
    selectedThemeName: 'industrial',
    userName: 'Omprakash',
  };

  describe('validateSyncConfig', () => {
    it('accepts valid IPv4 address, port, and security token', () => {
      const validated = validateSyncConfig(validConfig);
      expect(validated.ip).toBe('192.168.1.50');
      expect(validated.port).toBe(8080);
      expect(validated.token).toBe('test-secure-token-abc-123');
    });

    it('accepts localhost and valid local hostnames', () => {
      expect(validateSyncConfig({ ip: 'localhost', port: 3000, token: 'secret-token' }).ip).toBe('localhost');
      expect(validateSyncConfig({ ip: 'my-desktop.local', port: 3000, token: 'secret-token' }).ip).toBe('my-desktop.local');
    });

    it('rejects path injections, fragments, and invalid IP addresses', () => {
      expect(() => validateSyncConfig({ ...validConfig, ip: '192.168.1.50/malicious' })).toThrow('is malformed');
      expect(() => validateSyncConfig({ ...validConfig, ip: 'evil.com#frag' })).toThrow('is malformed');
      expect(() => validateSyncConfig({ ...validConfig, ip: '999.999.999.999' })).toThrow('is malformed');
      expect(() => validateSyncConfig({ ...validConfig, ip: '' })).toThrow('missing or invalid IP');
    });

    it('rejects ports out of bounds (1-65535)', () => {
      expect(() => validateSyncConfig({ ...validConfig, port: 0 })).toThrow('out of bounds');
      expect(() => validateSyncConfig({ ...validConfig, port: 70000 })).toThrow('out of bounds');
      expect(() => validateSyncConfig({ ...validConfig, port: 'not-a-port' })).toThrow('out of bounds');
    });

    it('rejects missing or insufficiently long security tokens', () => {
      expect(() => validateSyncConfig({ ...validConfig, token: '' })).toThrow('missing or insufficiently long');
      expect(() => validateSyncConfig({ ...validConfig, token: 'abc' })).toThrow('missing or insufficiently long');
      expect(() => validateSyncConfig({ ...validConfig, token: null })).toThrow('missing or insufficiently long');
    });
  });

  describe('validateSyncPayload', () => {
    it('accepts valid payload and defaults missing taskLists to empty array', () => {
      const payload = {
        notes: [{ title: 'Note 1', content: 'C1' }],
        tasks: [{ id: '1', title: 'T1' }],
        birthdays: [{ name: 'B1', date: '2000-01-01' }],
      };
      const validated = validateSyncPayload(payload);
      expect(validated.notes.length).toBe(1);
      expect(Array.isArray(validated.taskLists)).toBe(true);
    });

    it('rejects non-object and null payloads', () => {
      expect(() => validateSyncPayload(null)).toThrow('Malformed server response');
      expect(() => validateSyncPayload('invalid')).toThrow('Malformed server response');
      expect(() => validateSyncPayload([1, 2, 3])).toThrow('Malformed server response');
    });

    it('rejects payload missing notes, tasks, or birthdays arrays', () => {
      expect(() => validateSyncPayload({ tasks: [], birthdays: [] })).toThrow("missing required 'notes' array");
      expect(() => validateSyncPayload({ notes: [], birthdays: [] })).toThrow("missing required 'tasks' array");
      expect(() => validateSyncPayload({ notes: [], tasks: [] })).toThrow("missing required 'birthdays' array");
    });
  });

  describe('pingSyncServer', () => {
    it('returns true when ping succeeds with status: "online"', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ status: 'online' }),
      });

      const isOnline = await pingSyncServer(validConfig);
      expect(isOnline).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://192.168.1.50:8080/ping',
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('returns false when ping response is not ok or status is not online', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const isOnline = await pingSyncServer(validConfig);
      expect(isOnline).toBe(false);
    });

    it('returns false when network fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network unreachable'));

      const isOnline = await pingSyncServer(validConfig);
      expect(isOnline).toBe(false);
    });
  });

  describe('performSync', () => {
    it('throws error without network calls when config is invalid', async () => {
      global.fetch = jest.fn();
      await expect(performSync({ ip: 'invalid/path', port: 8080, token: 'tok' }, sampleLocalData)).rejects.toThrow(
        'is malformed'
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws descriptive error when PC sync server is offline', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network unreachable'));

      await expect(performSync(validConfig, sampleLocalData)).rejects.toThrow(
        'Unable to connect to the PC Sync Server.'
      );
    });

    it('sends POST /sync with bearer token and returns synced data on success', async () => {
      const mockSyncedResult = {
        notes: [...sampleLocalData.notes, { title: 'PC Note', content: 'From PC' }],
        tasks: sampleLocalData.tasks,
        birthdays: sampleLocalData.birthdays,
      };

      // First call is ping, second call is /sync
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ status: 'online' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockSyncedResult),
        });

      const result = await performSync(validConfig, sampleLocalData);
      expect(result.notes.length).toBe(2);
      expect(result.tasks).toEqual(sampleLocalData.tasks);

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'http://192.168.1.50:8080/sync',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-secure-token-abc-123',
          }),
        })
      );
    });

    it('rejects when server returns 200 OK but sends malformed payload without notes', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ status: 'online' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ invalid: true }),
        });

      await expect(performSync(validConfig, sampleLocalData)).rejects.toThrow(
        "missing required 'notes' array"
      );
    });

    it('throws authorization error on 401 or 403 status', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ status: 'online' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        });

      await expect(performSync(validConfig, sampleLocalData)).rejects.toThrow(
        'Authorization Forbidden: The scanned security token is invalid or expired. Please re-scan.'
      );
    });
  });
});
