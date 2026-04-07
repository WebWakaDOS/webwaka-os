import { describe, it, expect } from 'vitest';
import { rebuildSearchIndexFromEvents } from './search.js';
import { EventType } from '../event-types.js';

function makeDb(eventRows: unknown[] = []) {
  return {
    prepare(sql: string) {
      return {
        bind: (..._args: unknown[]) => ({
          run: async () => ({ success: true }),
          first: async <T>(): Promise<T | null> => null,
          all: async <T>() => {
            if (sql.includes('event_log')) {
              return { results: eventRows as T[] };
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

describe('rebuildSearchIndexFromEvents', () => {
  it('returns zeroed result when no events', async () => {
    const db = makeDb([]);
    const result = await rebuildSearchIndexFromEvents(db);

    expect(result.processed).toBe(0);
    expect(result.indexed).toBe(0);
    expect(result.deindexed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('counts indexed events correctly', async () => {
    const rows = [
      {
        id: 'evt_001',
        aggregate: 'individual',
        aggregate_id: 'ind_abc',
        event_type: EventType.SearchIndexed,
        tenant_id: 'tnt_1',
        payload: JSON.stringify({
          entityId: 'ind_abc',
          entityType: 'individual',
          displayName: 'Emeka Obi',
          placeId: 'lagos',
        }),
        version: 1,
        created_at: '2026-01-01 00:00:00',
      },
    ];

    const db = makeDb(rows);
    const result = await rebuildSearchIndexFromEvents(db);

    expect(result.processed).toBe(1);
    expect(result.indexed).toBe(1);
    expect(result.deindexed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('counts deindexed events correctly', async () => {
    const rows = [
      {
        id: 'evt_002',
        aggregate: 'individual',
        aggregate_id: 'ind_del',
        event_type: EventType.SearchDeindexed,
        tenant_id: 'tnt_1',
        payload: JSON.stringify({
          entityId: 'ind_del',
          entityType: 'individual',
          displayName: 'Deleted Entity',
        }),
        version: 2,
        created_at: '2026-01-02 00:00:00',
      },
    ];

    const db = makeDb(rows);
    const result = await rebuildSearchIndexFromEvents(db);

    expect(result.processed).toBe(1);
    expect(result.deindexed).toBe(1);
    expect(result.indexed).toBe(0);
  });

  it('handles invalid JSON payload as an error', async () => {
    const rows = [
      {
        id: 'evt_bad',
        aggregate: 'individual',
        aggregate_id: 'ind_bad',
        event_type: EventType.SearchIndexed,
        tenant_id: 'tnt_1',
        payload: 'not-valid-json{{{',
        version: 1,
        created_at: '2026-01-01 00:00:00',
      },
    ];

    const db = makeDb(rows);
    const result = await rebuildSearchIndexFromEvents(db);

    expect(result.processed).toBe(1);
    expect(result.indexed).toBe(0);
    expect(result.errors).toHaveLength(1);
  });
});
