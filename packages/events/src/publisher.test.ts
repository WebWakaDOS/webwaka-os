import { describe, it, expect } from 'vitest';
import { publishEvent, getAggregateEvents } from './publisher.js';
import { EventType } from './event-types.js';

function makeDb(queryResults: Record<string, unknown> = {}) {
  const log: { sql: string; args: unknown[] }[] = [];

  return {
    _log: log,
    prepare(sql: string) {
      return {
        bind: (...args: unknown[]) => ({
          run: async () => {
            log.push({ sql, args });
            return { success: true };
          },
          first: async <T>(): Promise<T | null> => {
            for (const [key, value] of Object.entries(queryResults)) {
              if (sql.includes(key)) return value as T;
            }
            return null;
          },
          all: async <T>() => {
            for (const [key, value] of Object.entries(queryResults)) {
              if (sql.includes(key)) return { results: value as T[] };
            }
            return { results: [] as T[] };
          },
        }),
        run: async () => ({ success: true }),
        first: async <T>(): Promise<T | null> => null,
        all: async <T>() => ({ results: [] as T[] }),
      };
    },
  };
}

describe('publishEvent', () => {
  it('returns a domain event with an assigned version', async () => {
    const db = makeDb({ 'max_version': { max_version: 0 } });

    const event = await publishEvent(db, {
      aggregate: 'individual',
      aggregateId: 'ind_abc',
      eventType: EventType.EntityCreated,
      tenantId: 'tnt_xyz',
      payload: { entityType: 'individual', displayName: 'Emeka Obi' },
    });

    expect(event.id).toMatch(/^evt_/);
    expect(event.version).toBe(1);
    expect(event.aggregate).toBe('individual');
    expect(event.aggregateId).toBe('ind_abc');
    expect(event.eventType).toBe(EventType.EntityCreated);
    expect(event.tenantId).toBe('tnt_xyz');
  });

  it('increments version when aggregate has existing events', async () => {
    const db = makeDb({ 'max_version': { max_version: 3 } });

    const event = await publishEvent(db, {
      aggregate: 'individual',
      aggregateId: 'ind_abc',
      eventType: EventType.EntityUpdated,
      tenantId: 'tnt_xyz',
      payload: {},
    });

    expect(event.version).toBe(4);
  });

  it('sets version to 1 when no prior events exist (null max)', async () => {
    const db = makeDb({});

    const event = await publishEvent(db, {
      aggregate: 'workspace',
      aggregateId: 'wsp_new',
      eventType: EventType.WorkspaceActivated,
      tenantId: 'tnt_1',
      payload: {},
    });

    expect(event.version).toBe(1);
  });

  it('serialises payload correctly', async () => {
    const db = makeDb({ 'max_version': { max_version: 0 } });

    const payload = { workspaceId: 'wsp_1', amountKobo: 5000_00, plan: 'starter', paystackRef: 'ref_xyz' };
    const event = await publishEvent(db, {
      aggregate: 'payment',
      aggregateId: 'ref_xyz',
      eventType: EventType.PaymentSuccess,
      tenantId: 'tnt_pay',
      payload,
    });

    expect(event.payload).toEqual(payload);
  });
});

describe('getAggregateEvents', () => {
  it('returns empty array when no events exist', async () => {
    const db = makeDb({});
    const events = await getAggregateEvents(db, 'individual', 'ind_missing');
    expect(events).toEqual([]);
  });

  it('maps rows to domain events correctly', async () => {
    const rows = [
      {
        id: 'evt_001',
        aggregate: 'individual',
        aggregate_id: 'ind_abc',
        event_type: EventType.EntityCreated,
        tenant_id: 'tnt_xyz',
        payload: JSON.stringify({ entityType: 'individual', displayName: 'Test' }),
        version: 1,
        created_at: '2026-01-01 00:00:00',
      },
    ];

    const db = makeDb({ 'ORDER BY version ASC': rows });
    const events = await getAggregateEvents(db, 'individual', 'ind_abc');

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe('evt_001');
    expect(events[0]?.version).toBe(1);
    expect(events[0]?.payload).toEqual({ entityType: 'individual', displayName: 'Test' });
  });
});
