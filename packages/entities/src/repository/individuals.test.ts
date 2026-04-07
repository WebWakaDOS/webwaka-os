/**
 * Tests for the individuals repository with in-memory D1 mock.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantId, IndividualId } from '@webwaka/types';
import { createIndividual, getIndividualById, listIndividualsByTenant, updateIndividual } from './individuals.js';

const TENANT_ID = 'tenant_test_001' as TenantId;

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------

interface D1Stmt {
  bind(...args: unknown[]): D1Stmt;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

function makeMockDb() {
  const store: Record<string, unknown>[] = [];

  function makeRow(id: string, name: string, tenantId: string, placeId: string | null, metadata: string | null): Record<string, unknown> {
    return { id, name, entity_type: 'individual', tenant_id: tenantId, place_id: placeId, metadata, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }

  return {
    _store: store,
    prepare: (sql: string): D1Stmt => {
      let boundArgs: unknown[] = [];
      const stmt: D1Stmt = {
        bind: (...args: unknown[]) => { boundArgs = args; return stmt; },
        run: vi.fn(() => {
          if (sql.startsWith('INSERT INTO individuals')) {
            const [id, name, , tenantId, placeId, metadata] = boundArgs;
            store.push(makeRow(id as string, name as string, tenantId as string, placeId as string | null, metadata as string | null));
          }
          if (sql.startsWith('UPDATE individuals')) {
            const id = boundArgs[boundArgs.length - 2];
            const tenantId = boundArgs[boundArgs.length - 1];
            const idx = store.findIndex((r) => r['id'] === id && r['tenant_id'] === tenantId);
            if (idx !== -1) {
              if (boundArgs[0]) (store[idx] as Record<string, unknown>)['name'] = boundArgs[0];
            }
          }
          return Promise.resolve({});
        }),
        first: <T>(): Promise<T | null> => {
          const id = boundArgs[0];
          const tenantId = boundArgs[1];
          return Promise.resolve((store.find((r) => r['id'] === id && r['tenant_id'] === tenantId) ?? null) as T | null);
        },
        all: <T>(): Promise<{ results: T[] }> => {
          const tenantId = boundArgs[0];
          const limit = boundArgs[boundArgs.length - 1] as number;
          const results = store.filter((r) => r['tenant_id'] === tenantId).slice(0, limit);
          return Promise.resolve({ results: results as unknown as T[] });
        },
      };
      return stmt;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createIndividual', () => {
  it('creates an individual and returns it with correct fields', async () => {
    const db = makeMockDb();
    const result = await createIndividual(db, TENANT_ID, { name: 'Amaka Obi' });

    expect(result.id).toMatch(/^ind_/);
    expect((result as unknown as Record<string, unknown>)['name']).toBe('Amaka Obi');
    expect((result as unknown as Record<string, unknown>)['tenantId']).toBe(TENANT_ID);
  });

  it('stores metadata when provided', async () => {
    const db = makeMockDb();
    const result = await createIndividual(db, TENANT_ID, {
      name: 'Chidi Okeke',
      metadata: { nin: '12345678901' },
    });

    expect((result as unknown as Record<string, unknown>)['metadata']).toEqual({ nin: '12345678901' });
  });
});

describe('getIndividualById', () => {
  it('returns null when not found', async () => {
    const db = makeMockDb();
    const result = await getIndividualById(db, TENANT_ID, 'ind_nonexistent' as IndividualId);
    expect(result).toBeNull();
  });

  it('returns the individual when found', async () => {
    const db = makeMockDb();
    const created = await createIndividual(db, TENANT_ID, { name: 'Fatima Bello' });
    const found = await getIndividualById(db, TENANT_ID, created.id);
    expect(found).not.toBeNull();
  });
});

describe('listIndividualsByTenant', () => {
  it('returns paginated results for a tenant', async () => {
    const db = makeMockDb();
    await createIndividual(db, TENANT_ID, { name: 'Person A' });
    await createIndividual(db, TENANT_ID, { name: 'Person B' });

    const result = await listIndividualsByTenant(db, TENANT_ID, { limit: 10 });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.nextCursor).toBeNull();
  });
});

describe('updateIndividual', () => {
  it('returns null when individual not found', async () => {
    const db = makeMockDb();
    const result = await updateIndividual(db, TENANT_ID, 'ind_ghost' as IndividualId, { name: 'Ghost' });
    expect(result).toBeNull();
  });
});
