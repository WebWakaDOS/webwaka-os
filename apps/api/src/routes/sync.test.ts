/**
 * Tests for POST /sync/apply (M7b — offline sync endpoint)
 * Platform Invariant P11 — server-wins conflict, FIFO replay.
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { syncRoutes } from './sync.js';
import type { AuthContext } from '@webwaka/types';

function makeApp(dbOverride?: object): Hono {
  const app = new Hono();

  const defaultDB = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: <T>() => {
          if (sql.includes('sync_queue_log')) return Promise.resolve(null as T);
          return Promise.resolve(null as T);
        },
        run: () => Promise.resolve({ success: true }),
        all: <T>() => Promise.resolve({ results: [] as T[] }),
      }),
    })),
  };

  app.use('*', async (c, next) => {
    c.set('auth', {
      userId: 'usr_test_001',
      tenantId: 'tenant_001',
      workspaceId: 'wsp_001',
      role: 'admin',
      permissions: [],
    } as unknown as AuthContext);
    c.env = { DB: dbOverride ?? defaultDB } as never;
    await next();
  });

  app.route('/sync', syncRoutes);
  return app;
}

describe('POST /sync/apply', () => {
  it('returns 200 with applied:true for valid request', async () => {
    const app = makeApp();
    const res = await app.request('/sync/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'client-uuid-001',
        entity: 'individual',
        operation: 'create',
        payload: { name: 'Tunde Oyelaran' },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['applied']).toBe(true);
    expect(body['clientId']).toBe('client-uuid-001');
  });

  it('returns 400 when clientId is missing', async () => {
    const app = makeApp();
    const res = await app.request('/sync/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'individual', operation: 'create', payload: {} }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when entity is missing', async () => {
    const app = makeApp();
    const res = await app.request('/sync/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'c1', operation: 'create', payload: {} }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-syncable entity type', async () => {
    const app = makeApp();
    const res = await app.request('/sync/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'c2',
        entity: 'random_entity',
        operation: 'create',
        payload: {},
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(String(body['error'])).toContain('not syncable');
  });

  it('returns 400 for invalid operation', async () => {
    const app = makeApp();
    const res = await app.request('/sync/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'c3',
        entity: 'individual',
        operation: 'upsert',
        payload: {},
      }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 idempotent response for already-applied clientId', async () => {
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: <T>() => {
            if (sql.includes('sync_queue_log')) {
              return Promise.resolve({ id: 'sync_existing', status: 'applied' } as T);
            }
            return Promise.resolve(null as T);
          },
          run: () => Promise.resolve({ success: true }),
          all: <T>() => Promise.resolve({ results: [] as T[] }),
        }),
      })),
    };
    const app = makeApp(db);
    const res = await app.request('/sync/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'already-applied',
        entity: 'individual',
        operation: 'create',
        payload: {},
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['idempotent']).toBe(true);
  });

  it('returns 409 conflict for previously conflicted clientId', async () => {
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: <T>() => {
            if (sql.includes('sync_queue_log')) {
              return Promise.resolve({ id: 'sync_conflict', status: 'conflict' } as T);
            }
            return Promise.resolve(null as T);
          },
          run: () => Promise.resolve({ success: true }),
          all: <T>() => Promise.resolve({ results: [] as T[] }),
        }),
      })),
    };
    const app = makeApp(db);
    const res = await app.request('/sync/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'conflicted-client',
        entity: 'individual',
        operation: 'update',
        payload: {},
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as Record<string, unknown>;
    expect(body['conflict']).toBe(true);
  });

  it('returns 400 for malformed JSON body', async () => {
    const app = makeApp();
    const res = await app.request('/sync/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });
});
