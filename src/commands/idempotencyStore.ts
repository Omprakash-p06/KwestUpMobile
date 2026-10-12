/**
 * KwestUp 4.0 — Durable Command Idempotency Store
 *
 * Persists the outcome of executed commands so idempotency survives process
 * restarts. The in-memory cache in `commandExecutor` is intentionally bounded
 * and lost on cold start; a replayed command (e.g. an Android widget action or
 * a notification action dispatched again after a restart) would otherwise
 * execute a second time and could corrupt persisted state
 * (see `.planning/codebase/CONCERNS.md` → command execution boundary).
 *
 * Design notes:
 * - Records live in a single versioned JSON blob under one key.
 * - Every mutation (including the initial load) is serialized through an
 *   internal promise queue, so concurrent commands cannot race each other's
 *   read-modify-write on that blob.
 * - Expired records are pruned lazily on read and compacted on write.
 * - The store is best-effort: a storage failure is logged and treated as a
 *   cache miss rather than blocking command execution.
 *
 * Source: rulebook/machine/rules.json (SYS_IDEMPOTENT_COMMAND_001),
 *         4.0/KwestUp_4.0_Master_Plan.md §7
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import type { CommandExecutionResult } from './types';

export const DURABLE_IDEMPOTENCY_KEY = 'kwestup_idempotency_v1';
export const DURABLE_IDEMPOTENCY_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const DURABLE_IDEMPOTENCY_MAX_ENTRIES = 200;

export interface DurableIdempotencyRecord {
  result: CommandExecutionResult;
  timestamp: number;
}

type IdempotencyStore = Record<string, DurableIdempotencyRecord>;

let cache: IdempotencyStore | null = null;
let loading: Promise<IdempotencyStore> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

/** Serializes a mutation behind any in-flight mutation. */
function enqueue(op: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(op, op);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Single-flight load of the persisted store into memory. */
function ensureLoaded(): Promise<IdempotencyStore> {
  if (cache) {
    return Promise.resolve(cache);
  }
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(DURABLE_IDEMPOTENCY_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        cache = parsed && typeof parsed === 'object' ? (parsed as IdempotencyStore) : {};
      } catch (err) {
        logger.warn('Failed to load durable idempotency store; starting empty:', err);
        cache = {};
      }
      return cache as IdempotencyStore;
    })();
    void loading.then(
      () => {
        loading = null;
      },
      () => {
        loading = null;
      }
    );
  }
  return loading;
}

/** Drops expired records and caps the store to the most recent N entries. */
function prune(store: IdempotencyStore, now: number): IdempotencyStore {
  const live = Object.entries(store).filter(
    ([, record]) => now - record.timestamp <= DURABLE_IDEMPOTENCY_TTL_MS
  );
  live.sort((a, b) => a[1].timestamp - b[1].timestamp);
  const kept = live.slice(-DURABLE_IDEMPOTENCY_MAX_ENTRIES);
  const next: IdempotencyStore = {};
  for (const [key, record] of kept) {
    next[key] = record;
  }
  return next;
}

/**
 * Returns the persisted result for `key` when a non-expired record exists.
 * Expired records are pruned from memory lazily (and compacted on the next
 * write) so reads never perform a write.
 */
export async function readIdempotencyRecord(
  key: string,
  now: number = Date.now()
): Promise<CommandExecutionResult | null> {
  if (!key) {
    return null;
  }
  const store = await ensureLoaded();
  const record = store[key];
  if (!record) {
    return null;
  }
  if (now - record.timestamp > DURABLE_IDEMPOTENCY_TTL_MS) {
    delete store[key];
    return null;
  }
  return record.result;
}

/**
 * Persists a successful command result. The whole read-modify-write is
 * serialized so parallel commands cannot lose each other's records.
 */
export function writeIdempotencyRecord(
  key: string,
  result: CommandExecutionResult,
  now: number = Date.now()
): Promise<void> {
  if (!key) {
    return Promise.resolve();
  }
  return enqueue(async () => {
    const store = await ensureLoaded();
    store[key] = { result, timestamp: now };
    const pruned = prune(store, now);
    cache = pruned;
    await AsyncStorage.setItem(DURABLE_IDEMPOTENCY_KEY, JSON.stringify(pruned));
  });
}

/** Number of records currently held in memory (after the last load/prune). */
export function getDurableIdempotencyStoreSize(): number {
  return cache ? Object.keys(cache).length : 0;
}

/**
 * Synchronously empties the in-memory view and clears persisted records.
 * Used by `clearIdempotencyCache()` so tests and cache invalidation start
 * clean without awaiting the async removal.
 */
export function resetDurableIdempotencyCacheSync(): void {
  cache = {};
  loading = null;
  void enqueue(() => AsyncStorage.removeItem(DURABLE_IDEMPOTENCY_KEY)).catch(() => {
    // Ignore; the in-memory view is already empty.
  });
}

/** Awaits removal of all persisted records and unloads the in-memory view. */
export async function clearDurableIdempotencyStore(): Promise<void> {
  await enqueue(() => AsyncStorage.removeItem(DURABLE_IDEMPOTENCY_KEY));
  cache = null;
  loading = null;
}
