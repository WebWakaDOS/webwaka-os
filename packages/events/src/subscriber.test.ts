import { describe, it, expect, beforeEach } from 'vitest';
import {
  subscribe,
  dispatch,
  clearSubscriptions,
  handlerCount,
} from './subscriber.js';
import { EventType } from './event-types.js';
import type { DomainEvent } from './event-types.js';

function makeFakeEvent(eventType: EventType = EventType.EntityCreated): DomainEvent {
  return {
    id: 'evt_test001',
    aggregate: 'individual',
    aggregateId: 'ind_abc',
    eventType,
    tenantId: 'tnt_xyz',
    payload: { displayName: 'Test Entity' },
    version: 1,
    createdAt: new Date().toISOString(),
  };
}

describe('subscribe + dispatch', () => {
  beforeEach(() => {
    clearSubscriptions();
  });

  it('dispatches to a registered handler', async () => {
    const calls: DomainEvent[] = [];
    subscribe(EventType.EntityCreated, async (event) => {
      calls.push(event);
    });

    const event = makeFakeEvent(EventType.EntityCreated);
    const result = await dispatch(event);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(event);
    expect(result.handled).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('dispatches to multiple handlers (fan-out)', async () => {
    const log: string[] = [];
    subscribe(EventType.EntityCreated, async () => { log.push('A'); });
    subscribe(EventType.EntityCreated, async () => { log.push('B'); });

    const result = await dispatch(makeFakeEvent(EventType.EntityCreated));

    expect(log).toContain('A');
    expect(log).toContain('B');
    expect(result.handled).toBe(2);
  });

  it('does not dispatch to handlers for a different event type', async () => {
    const calls: DomainEvent[] = [];
    subscribe(EventType.PaymentSuccess, async (event) => { calls.push(event); });

    await dispatch(makeFakeEvent(EventType.EntityCreated));

    expect(calls).toHaveLength(0);
  });

  it('catches handler errors and returns them in result.errors', async () => {
    subscribe(EventType.ClaimAdvanced, async () => {
      throw new Error('handler exploded');
    });

    const event: DomainEvent = {
      ...makeFakeEvent(),
      eventType: EventType.ClaimAdvanced,
    };
    const result = await dispatch(event);

    expect(result.handled).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('handler exploded');
  });

  it('returns 0 handled when no handlers registered', async () => {
    const result = await dispatch(makeFakeEvent(EventType.EntityUpdated));
    expect(result.handled).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('handlerCount', () => {
  beforeEach(() => {
    clearSubscriptions();
  });

  it('returns 0 when no handlers registered', () => {
    expect(handlerCount(EventType.EntityCreated)).toBe(0);
  });

  it('returns correct count after subscribing', () => {
    subscribe(EventType.EntityCreated, async () => {});
    subscribe(EventType.EntityCreated, async () => {});
    expect(handlerCount(EventType.EntityCreated)).toBe(2);
  });

  it('counts per event type independently', () => {
    subscribe(EventType.EntityCreated, async () => {});
    subscribe(EventType.PaymentSuccess, async () => {});
    subscribe(EventType.PaymentSuccess, async () => {});
    expect(handlerCount(EventType.EntityCreated)).toBe(1);
    expect(handlerCount(EventType.PaymentSuccess)).toBe(2);
  });
});

describe('clearSubscriptions', () => {
  it('clears all handlers', () => {
    subscribe(EventType.EntityCreated, async () => {});
    subscribe(EventType.PaymentSuccess, async () => {});
    clearSubscriptions();
    expect(handlerCount(EventType.EntityCreated)).toBe(0);
    expect(handlerCount(EventType.PaymentSuccess)).toBe(0);
  });
});
