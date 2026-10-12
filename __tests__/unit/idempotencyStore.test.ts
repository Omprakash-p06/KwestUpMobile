import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readIdempotencyRecord,
  writeIdempotencyRecord,
  clearDurableIdempotencyStore,
  getDurableIdempotencyStoreSize,
  DURABLE_IDEMPOTENCY_KEY,
  DURABLE_IDEMPOTENCY_MAX_ENTRIES,
  DURABLE_IDEMPOTENCY_TTL_MS,
} from '../../src/commands/idempotencyStore';
import type { CommandExecutionResult } from '../../src/commands/types';

const result = (id: string): CommandExecutionResult => ({
  success: true,
  entityId: `entity-${id}`,
  message: `executed ${id}`,
  requestId: id,
  rulesApplied: ['SYS_IDEMPOTENT_COMMAND_001'],
});

describe('idempotencyStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearDurableIdempotencyStore();
  });

  it('returns null for an unknown key', async () => {
    expect(await readIdempotencyRecord('missing')).toBeNull();
  });

  it('round-trips a persisted record', async () => {
    await writeIdempotencyRecord('cmd-1', result('cmd-1'));
    expect(await readIdempotencyRecord('cmd-1')).toEqual(result('cmd-1'));
  });

  it('reads records from storage after a simulated cold start', async () => {
    // Simulate a previous session writing directly to storage, then a fresh
    // process loading with an empty in-memory cache (cache was cleared above).
    const seeded = {
      'cmd-seeded': { result: result('cmd-seeded'), timestamp: Date.now() },
    };
    await AsyncStorage.setItem(DURABLE_IDEMPOTENCY_KEY, JSON.stringify(seeded));

    expect(await readIdempotencyRecord('cmd-seeded')).toEqual(result('cmd-seeded'));
  });

  it('ignores records older than the TTL', async () => {
    const now = 1700000000000;
    await writeIdempotencyRecord('cmd-old', result('cmd-old'), now);
    // Within the TTL the record is still honored.
    expect(await readIdempotencyRecord('cmd-old', now + DURABLE_IDEMPOTENCY_TTL_MS - 1)).toEqual(
      result('cmd-old')
    );
    // Past the TTL it is ignored (and pruned from the in-memory view).
    expect(await readIdempotencyRecord('cmd-old', now + DURABLE_IDEMPOTENCY_TTL_MS + 1)).toBeNull();
  });

  it('caps the store to the most recent N entries', async () => {
    const base = 1700000000000;
    const total = DURABLE_IDEMPOTENCY_MAX_ENTRIES + 25;
    for (let i = 0; i < total; i += 1) {
      await writeIdempotencyRecord(`cmd-${i}`, result(`cmd-${i}`), base + i);
    }

    expect(getDurableIdempotencyStoreSize()).toBeLessThanOrEqual(DURABLE_IDEMPOTENCY_MAX_ENTRIES);
    // The oldest entries are the ones dropped.
    expect(await readIdempotencyRecord('cmd-0', base + total)).toBeNull();
    // The newest entry survives.
    expect(await readIdempotencyRecord(`cmd-${total - 1}`, base + total)).toEqual(
      result(`cmd-${total - 1}`)
    );
  });

  it('does not lose records when commands complete concurrently', async () => {
    const now = Date.now();
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        writeIdempotencyRecord(`par-${i}`, result(`par-${i}`), now + i)
      )
    );

    expect(getDurableIdempotencyStoreSize()).toBe(20);
    const persisted = JSON.parse((await AsyncStorage.getItem(DURABLE_IDEMPOTENCY_KEY)) || '{}');
    expect(Object.keys(persisted)).toHaveLength(20);
  });

  it('treats a corrupted persisted blob as empty rather than throwing', async () => {
    await clearDurableIdempotencyStore();
    await AsyncStorage.setItem(DURABLE_IDEMPOTENCY_KEY, 'not valid json {');
    expect(await readIdempotencyRecord('anything')).toBeNull();
  });
});
