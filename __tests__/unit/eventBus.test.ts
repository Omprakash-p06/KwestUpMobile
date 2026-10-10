import React from 'react';
// @ts-ignore - react-test-renderer types not installed
import renderer, { act } from 'react-test-renderer';
import { View, Text } from 'react-native';
import {
  eventBus,
  useDomainEvent,
  generateEventId,
  MAX_EVENT_BUFFER_SIZE,
} from '../../src/behavior/eventBus';
import { logger } from '../../src/utils/logger';
import { DomainEvent } from '../../src/behavior/types';

describe('src/behavior/eventBus', () => {
  let loggerErrorSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    eventBus.clearListeners();
    eventBus.clearBuffer();
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    loggerDebugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
    loggerDebugSpy.mockRestore();
  });

  describe('generateEventId', () => {
    it('generates unique event IDs with prefix and entropy', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();
      expect(id1).toMatch(/^evt_\d+_[a-z0-9]+_\d+$/);
      expect(id2).toMatch(/^evt_\d+_[a-z0-9]+_\d+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('TC-EVT-01: Subscription & Dispatch', () => {
    it('dispatches emitted event to registered type-specific listener', () => {
      const listener = jest.fn();
      eventBus.subscribe('TASK_CREATED', listener);

      const event = eventBus.emit({
        type: 'TASK_CREATED',
        entityId: 'task-123',
        source: 'app',
        payload: { title: 'Implement EventBus' },
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.type).toBe('TASK_CREATED');
      expect(event.entityId).toBe('task-123');
      expect(event.payload).toEqual({ title: 'Implement EventBus' });
    });

    it('does not trigger listeners registered for different event types', () => {
      const taskListener = jest.fn();
      const billListener = jest.fn();

      eventBus.subscribe('TASK_CREATED', taskListener);
      eventBus.subscribe('BILL_CREATED', billListener);

      eventBus.emit({
        type: 'TASK_CREATED',
        entityId: 'task-1',
        source: 'app',
      });

      expect(taskListener).toHaveBeenCalledTimes(1);
      expect(billListener).not.toHaveBeenCalled();
    });

    it('notifies multiple listeners for the same event type', () => {
      const listenerA = jest.fn();
      const listenerB = jest.fn();

      eventBus.subscribe('TASK_COMPLETED', listenerA);
      eventBus.subscribe('TASK_COMPLETED', listenerB);

      eventBus.emit({
        type: 'TASK_COMPLETED',
        entityId: 'task-2',
        source: 'app',
      });

      expect(listenerA).toHaveBeenCalledTimes(1);
      expect(listenerB).toHaveBeenCalledTimes(1);
    });
  });

  describe('TC-EVT-02: Wildcard Subscription (subscribeAll)', () => {
    it('receives events of any type across the domain', () => {
      const wildcardListener = jest.fn();
      eventBus.subscribeAll(wildcardListener);

      eventBus.emit({
        type: 'TASK_CREATED',
        entityId: 'task-1',
        source: 'app',
      });

      eventBus.emit({
        type: 'BILL_PAID',
        entityId: 'bill-1',
        source: 'app',
      });

      eventBus.emit({
        type: 'FOCUS_COMPLETED',
        entityId: 'focus-1',
        source: 'app',
      });

      expect(wildcardListener).toHaveBeenCalledTimes(3);
    });
  });

  describe('TC-EVT-03: Unsubscribe Cleanup', () => {
    it('stops invoking listener after unsubscription', () => {
      const listener = jest.fn();
      const unsubscribe = eventBus.subscribe('TASK_DELETED', listener);

      eventBus.emit({
        type: 'TASK_DELETED',
        entityId: 'task-1',
        source: 'app',
      });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventBus.emit({
        type: 'TASK_DELETED',
        entityId: 'task-2',
        source: 'app',
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscription is idempotent and safe to call repeatedly', () => {
      const listener = jest.fn();
      const unsubscribe = eventBus.subscribe('HABIT_COMPLETED', listener);

      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();

      expect(eventBus.listenerCount('HABIT_COMPLETED')).toBe(0);
    });

    it('unsubscribing wildcard listener stops wildcard delivery', () => {
      const wildcardListener = jest.fn();
      const unsubscribe = eventBus.subscribeAll(wildcardListener);

      eventBus.emit({ type: 'WIDGET_ACTION', entityId: 'w-1', source: 'widget' });
      expect(wildcardListener).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventBus.emit({ type: 'WIDGET_ACTION', entityId: 'w-2', source: 'widget' });
      expect(wildcardListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('TC-EVT-04 & TC-EVT-05: Error Isolation', () => {
    it('TC-EVT-04: synchronous exception in one listener does not disrupt others or throw from emit', () => {
      const brokenListener = jest.fn().mockImplementation(() => {
        throw new Error('Fatal listener crash');
      });
      const healthyListener = jest.fn();

      eventBus.subscribe('TASK_COMPLETED', brokenListener);
      eventBus.subscribe('TASK_COMPLETED', healthyListener);

      let returnedEvent: DomainEvent<'TASK_COMPLETED'> | undefined;
      expect(() => {
        returnedEvent = eventBus.emit({
          type: 'TASK_COMPLETED',
          entityId: 'task-99',
          source: 'app',
        });
      }).not.toThrow();

      expect(returnedEvent).toBeDefined();
      expect(brokenListener).toHaveBeenCalledTimes(1);
      expect(healthyListener).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'EventBus listener error:',
        expect.objectContaining({
          error: 'Fatal listener crash',
          eventType: 'TASK_COMPLETED',
        })
      );
    });

    it('TC-EVT-05: async rejection in listener is caught and logged without unhandled rejection', async () => {
      const asyncCrashingListener = jest.fn().mockRejectedValue(new Error('Async failure'));
      eventBus.subscribe('BILL_CREATED', asyncCrashingListener);

      eventBus.emit({
        type: 'BILL_CREATED',
        entityId: 'bill-99',
        source: 'app',
      });

      // Allow microtasks to settle
      await Promise.resolve();

      expect(asyncCrashingListener).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'EventBus async listener error:',
        expect.objectContaining({
          error: 'Async failure',
          eventType: 'BILL_CREATED',
        })
      );
    });
  });

  describe('TC-EVT-06: Circular Telemetry Ring Buffer', () => {
    it('records events in chronological order up to MAX_EVENT_BUFFER_SIZE', () => {
      for (let i = 0; i < 10; i++) {
        eventBus.emit({
          type: 'TASK_CREATED',
          entityId: `task-${i}`,
          source: 'app',
          payload: { index: i },
        });
      }

      const recent = eventBus.getRecentEvents();
      expect(recent).toHaveLength(10);
      expect(recent[0].entityId).toBe('task-0');
      expect(recent[9].entityId).toBe('task-9');
    });

    it('evicts oldest events when buffer exceeds MAX_EVENT_BUFFER_SIZE (FIFO)', () => {
      const totalEvents = MAX_EVENT_BUFFER_SIZE + 15;
      for (let i = 0; i < totalEvents; i++) {
        eventBus.emit({
          type: 'TASK_CREATED',
          entityId: `task-${i}`,
          source: 'app',
          payload: { index: i },
        });
      }

      const recent = eventBus.getRecentEvents();
      expect(recent).toHaveLength(MAX_EVENT_BUFFER_SIZE);
      // First 15 events should have been evicted
      expect(recent[0].entityId).toBe('task-15');
      expect(recent[recent.length - 1].entityId).toBe(`task-${totalEvents - 1}`);
    });

    it('respects limit parameter when querying recent events', () => {
      for (let i = 0; i < 20; i++) {
        eventBus.emit({
          type: 'TASK_CREATED',
          entityId: `task-${i}`,
          source: 'app',
        });
      }

      const lastFive = eventBus.getRecentEvents(5);
      expect(lastFive).toHaveLength(5);
      expect(lastFive[4].entityId).toBe('task-19');
      expect(lastFive[0].entityId).toBe('task-15');
    });

    it('clears buffer with clearBuffer', () => {
      eventBus.emit({ type: 'TASK_CREATED', entityId: 'task-1', source: 'app' });
      expect(eventBus.getRecentEvents()).toHaveLength(1);

      eventBus.clearBuffer();
      expect(eventBus.getRecentEvents()).toHaveLength(0);
    });
  });

  describe('TC-EVT-07: Defensive Immutability', () => {
    it('deep-freezes emitted event to prevent listener mutation leakage', () => {
      const mutatorListener = (event: DomainEvent) => {
        try {
          (event as any).entityId = 'hacked-id';
        } catch {
          // In strict mode modifying frozen object throws
        }
      };

      const verificationListener = jest.fn();

      eventBus.subscribe('TASK_COMPLETED', mutatorListener);
      eventBus.subscribe('TASK_COMPLETED', verificationListener);

      const event = eventBus.emit({
        type: 'TASK_COMPLETED',
        entityId: 'original-id',
        source: 'app',
      });

      expect(Object.isFrozen(event)).toBe(true);
      expect(verificationListener).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'original-id' })
      );
    });
  });

  describe('Re-entrancy & Concurrent Mutation Safety', () => {
    it('safely handles a listener that emits another event during its execution', () => {
      const secondaryListener = jest.fn();
      eventBus.subscribe('BILL_PAID', secondaryListener);

      eventBus.subscribe('TASK_COMPLETED', () => {
        eventBus.emit({
          type: 'BILL_PAID',
          entityId: 'cascaded-bill',
          source: 'app',
        });
      });

      eventBus.emit({
        type: 'TASK_COMPLETED',
        entityId: 'trigger-task',
        source: 'app',
      });

      expect(secondaryListener).toHaveBeenCalledTimes(1);
      expect(secondaryListener).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'cascaded-bill' })
      );
    });

    it('safely handles a listener that unsubscribes itself during execution', () => {
      let unsubscribe: () => void;
      const selfUnsubscribingListener = jest.fn().mockImplementation(() => {
        unsubscribe();
      });
      const siblingListener = jest.fn();

      unsubscribe = eventBus.subscribe('BIRTHDAY_CREATED', selfUnsubscribingListener);
      eventBus.subscribe('BIRTHDAY_CREATED', siblingListener);

      // First dispatch: both listeners should run
      eventBus.emit({
        type: 'BIRTHDAY_CREATED',
        entityId: 'bday-1',
        source: 'app',
      });

      expect(selfUnsubscribingListener).toHaveBeenCalledTimes(1);
      expect(siblingListener).toHaveBeenCalledTimes(1);

      // Second dispatch: self-unsubscribed listener should NOT run, sibling still runs
      eventBus.emit({
        type: 'BIRTHDAY_CREATED',
        entityId: 'bday-2',
        source: 'app',
      });

      expect(selfUnsubscribingListener).toHaveBeenCalledTimes(1);
      expect(siblingListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('listenerCount & clearListeners', () => {
    it('correctly tracks and clears listener counts', () => {
      expect(eventBus.listenerCount()).toBe(0);

      const unsub1 = eventBus.subscribe('TASK_CREATED', () => {});
      const unsub2 = eventBus.subscribe('TASK_CREATED', () => {});
      const unsub3 = eventBus.subscribeAll(() => {});

      expect(eventBus.listenerCount('TASK_CREATED')).toBe(3); // 2 typed + 1 wildcard
      expect(eventBus.listenerCount('BILL_PAID')).toBe(1); // 0 typed + 1 wildcard
      expect(eventBus.listenerCount()).toBe(3);

      unsub1();
      expect(eventBus.listenerCount('TASK_CREATED')).toBe(2);

      eventBus.clearListeners();
      expect(eventBus.listenerCount()).toBe(0);

      unsub2();
      unsub3();
      expect(eventBus.listenerCount()).toBe(0);
    });
  });

  describe('TC-EVT-08: React Hook useDomainEvent', () => {
    const TestComponent = ({
      eventType,
      onEvent,
    }: {
      eventType: any;
      onEvent: (event: any) => void;
    }) => {
      useDomainEvent(eventType, onEvent);
      return React.createElement(
        View,
        null,
        React.createElement(Text, null, 'Testing Hook')
      );
    };

    it('subscribes on mount and receives events', () => {
      const handleEvent = jest.fn();
      let testRenderer!: renderer.ReactTestRenderer;

      act(() => {
        testRenderer = renderer.create(
          React.createElement(TestComponent, {
            eventType: 'TASK_CREATED',
            onEvent: handleEvent,
          })
        );
      });

      expect(eventBus.listenerCount('TASK_CREATED')).toBe(1);

      act(() => {
        eventBus.emit({
          type: 'TASK_CREATED',
          entityId: 'task-hook-1',
          source: 'app',
        });
      });

      expect(handleEvent).toHaveBeenCalledTimes(1);
      expect(handleEvent).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'task-hook-1' })
      );

      // Unmount component
      act(() => {
        testRenderer.unmount();
      });

      expect(eventBus.listenerCount('TASK_CREATED')).toBe(0);

      // Subsequent emission does not trigger handler
      act(() => {
        eventBus.emit({
          type: 'TASK_CREATED',
          entityId: 'task-hook-2',
          source: 'app',
        });
      });

      expect(handleEvent).toHaveBeenCalledTimes(1);
    });

    it('handles null eventType safely without subscribing', () => {
      const handleEvent = jest.fn();
      act(() => {
        renderer.create(
          React.createElement(TestComponent, {
            eventType: null,
            onEvent: handleEvent,
          })
        );
      });

      expect(eventBus.listenerCount()).toBe(0);
    });
  });
});
