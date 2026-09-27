import { pingSyncServer, performSync } from '../../src/utils/syncService';

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
      expect(result).toEqual(mockSyncedResult);

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
