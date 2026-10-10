import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import {
  DomainEventType,
  DomainEvent,
  DomainEventInput,
  DomainEventListener,
} from './types';

export const MAX_EVENT_BUFFER_SIZE = 100;

let eventCounter = 0;

/**
 * Generates an event ID using a monotonic timestamp + entropy + sequence counter.
 * Mitigates CONCERNS.md lines 14-38.
 */
export const generateEventId = (): string => {
  eventCounter = (eventCounter + 1) % 100000;
  const timestamp = Date.now();
  const entropy = Math.random().toString(36).slice(2, 9);
  return `evt_${timestamp}_${entropy}_${eventCounter}`;
};

/**
 * Deep clones plain object structures to isolate inputs from callers.
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
  } catch {
    // Fall back to JSON clone if structuredClone fails on non-cloneable references
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep freezes an object and its nested properties recursively.
 * Guarantees true defensive immutability across subscribers and telemetry buffer (WR-04).
 */
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
      const val = (obj as Record<string, unknown>)[key];
      if (val && typeof val === 'object') {
        deepFreeze(val);
      }
    }
  }
  return obj;
}

export interface DomainEventBus {
  subscribe<T extends DomainEventType>(
    type: T,
    listener: DomainEventListener<T>
  ): () => void;

  subscribeAll(
    listener: DomainEventListener<DomainEventType>
  ): () => void;

  emit<T extends DomainEventType>(
    eventInput: DomainEventInput<T>
  ): DomainEvent<T>;

  getRecentEvents(limit?: number): DomainEvent[];

  clearBuffer(): void;

  clearListeners(): void;

  listenerCount(type?: DomainEventType): number;
}

class EventBus implements DomainEventBus {
  private typedListeners = new Map<DomainEventType, Set<DomainEventListener<any>>>();
  private wildcardListeners = new Set<DomainEventListener<DomainEventType>>();
  private eventHistory: DomainEvent[] = [];

  /**
   * Subscribe to a specific domain event type.
   * Returns an idempotent unsubscription function.
   */
  public subscribe<T extends DomainEventType>(
    type: T,
    listener: DomainEventListener<T>
  ): () => void {
    if (typeof listener !== 'function') {
      return () => {};
    }

    let listeners = this.typedListeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.typedListeners.set(type, listeners);
    }
    listeners.add(listener as DomainEventListener<any>);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      const current = this.typedListeners.get(type);
      if (current) {
        current.delete(listener as DomainEventListener<any>);
        if (current.size === 0) {
          this.typedListeners.delete(type);
        }
      }
    };
  }

  /**
   * Subscribe to all domain events (wildcard listener).
   * Returns an idempotent unsubscription function.
   */
  public subscribeAll(
    listener: DomainEventListener<DomainEventType>
  ): () => void {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.wildcardListeners.add(listener);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.wildcardListeners.delete(listener);
    };
  }

  /**
   * Emit a domain event.
   * Isolates listener execution: thrown errors or rejections in listeners
   * are logged via logger.error and never disrupt other listeners or the caller.
   */
  public emit<T extends DomainEventType>(
    eventInput: DomainEventInput<T>
  ): DomainEvent<T> {
    const id = eventInput.id || generateEventId();
    const timestamp = eventInput.timestamp || new Date().toISOString();

    // WR-04: Deep clone input structures and deep freeze event to prevent mutation leakage
    const clonedMetadata = eventInput.metadata ? deepClone(eventInput.metadata) : undefined;
    const clonedPayload = eventInput.payload ? deepClone(eventInput.payload) : undefined;

    const event: DomainEvent<T> = deepFreeze({
      ...eventInput,
      id,
      timestamp,
      metadata: clonedMetadata,
      payload: clonedPayload,
    });

    // Note (IN-02): Payloads may contain entity details (e.g. titles, amounts) retained in memory
    // within the 100-event ring buffer. Never persist or export raw event buffer without redaction.
    // Record into telemetry ring buffer (FIFO)
    this.recordEvent(event);

    logger.debug('EventBus emitted event:', {
      type: event.type,
      entityId: event.entityId,
      source: event.source,
    });

    // Snapshot listeners to ensure safe iteration even if listeners mutate registration
    const typeSet = this.typedListeners.get(event.type);
    const typedSnapshot: DomainEventListener<any>[] = typeSet ? Array.from(typeSet) : [];
    const wildcardSnapshot: DomainEventListener<DomainEventType>[] = Array.from(this.wildcardListeners);

    // Dispatch to typed listeners
    for (const listener of typedSnapshot) {
      try {
        const result = listener(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('EventBus async listener error:', {
              error: message,
              eventType: event.type,
            });
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('EventBus listener error:', {
          error: message,
          eventType: event.type,
        });
      }
    }

    // Dispatch to wildcard listeners
    for (const listener of wildcardSnapshot) {
      try {
        const result = listener(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('EventBus async listener error:', {
              error: message,
              eventType: event.type,
            });
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('EventBus listener error:', {
          error: message,
          eventType: event.type,
        });
      }
    }

    return event;
  }

  /**
   * Return a snapshot of recent events from the circular ring buffer.
   */
  public getRecentEvents(limit?: number): DomainEvent[] {
    if (typeof limit === 'number' && limit > 0) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * Clear all buffered events in the ring buffer.
   */
  public clearBuffer(): void {
    this.eventHistory.length = 0;
  }

  /**
   * Clear all registered listeners. Useful for test isolation.
   */
  public clearListeners(): void {
    this.typedListeners.clear();
    this.wildcardListeners.clear();
  }

  /**
   * Get count of listeners for a specific event type, or total listeners.
   */
  public listenerCount(type?: DomainEventType): number {
    if (type) {
      return (this.typedListeners.get(type)?.size || 0) + this.wildcardListeners.size;
    }
    let totalTyped = 0;
    for (const set of this.typedListeners.values()) {
      totalTyped += set.size;
    }
    return totalTyped + this.wildcardListeners.size;
  }

  private recordEvent(event: DomainEvent<any>): void {
    if (this.eventHistory.length >= MAX_EVENT_BUFFER_SIZE) {
      this.eventHistory.shift();
    }
    this.eventHistory.push(event);
  }
}

export const eventBus = new EventBus();

/**
 * React hook for declarative domain event subscriptions.
 * Automatically handles subscription lifecycle and unmount cleanup.
 */
export const useDomainEvent = <T extends DomainEventType>(
  type: T | null,
  listener: DomainEventListener<T>
): void => {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!type) return;

    const unsubscribe = eventBus.subscribe(type, (event) => {
      if (listenerRef.current) {
        return listenerRef.current(event);
      }
      return undefined;
    });

    return unsubscribe;
  }, [type]);
};

export default eventBus;
