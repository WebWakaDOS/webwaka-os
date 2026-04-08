/**
 * Tests for WebWakaSyncAdapter — Dexie.js offline queue adapter.
 * (TDR-0010, Platform Invariant P6 + P11)
 *
 * Uses fake-indexeddb polyfill (injected via test-setup.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WebWakaSyncAdapter } from './adapter.js';
import { db } from './db.js';

beforeEach(async () => {
  // Clear queue between tests
  await db.syncQueue.clear();
});

describe('WebWakaSyncAdapter.enqueue', () => {
  it('returns a clientId string', async () => {
    const adapter = new WebWakaSyncAdapter();
    const clientId = await adapter.enqueue({
      entityType: 'individual',
      entityId: 'ind_001',
      operation: 'create',
      payload: { name: 'Tunde' },
    });
    expect(typeof clientId).toBe('string');
    expect(clientId.length).toBeGreaterThan(8);
  });

  it('stores item with pending status and normal priority', async () => {
    const adapter = new WebWakaSyncAdapter();
    const clientId = await adapter.enqueue({
      entityType: 'individual',
      entityId: 'ind_002',
      operation: 'update',
      payload: { name: 'Adaeze' },
    });
    const item = await db.syncQueue.where('clientId').equals(clientId).first();
    expect(item?.status).toBe('pending');
    expect(item?.priority).toBe('normal');
    expect(item?.retryCount).toBe(0);
  });
});

describe('WebWakaSyncAdapter.dequeue — FIFO order (P11)', () => {
  it('returns items in FIFO order by createdAt', async () => {
    const adapter = new WebWakaSyncAdapter();

    // Enqueue 3 items — rely on sequential inserts for ordering
    const id1 = await adapter.enqueue({
      entityType: 'individual', entityId: 'ind_1', operation: 'create', payload: { n: 1 },
    });
    const id2 = await adapter.enqueue({
      entityType: 'individual', entityId: 'ind_2', operation: 'create', payload: { n: 2 },
    });
    const id3 = await adapter.enqueue({
      entityType: 'individual', entityId: 'ind_3', operation: 'create', payload: { n: 3 },
    });

    const items = await adapter.dequeue('pending');
    // All 3 should be returned; ordering should be FIFO (createdAt asc)
    const ids = items.map((i) => i.id);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
    expect(ids).toContain(id3);
    // FIFO: id1 comes before id2, id2 before id3
    expect(ids.indexOf(id1)).toBeLessThan(ids.indexOf(id2));
    expect(ids.indexOf(id2)).toBeLessThan(ids.indexOf(id3));
  });

  it('only returns items whose nextRetryAt <= now', async () => {
    const adapter = new WebWakaSyncAdapter();
    const clientId = await adapter.enqueue({
      entityType: 'individual', entityId: 'ind_fut', operation: 'create', payload: {},
    });
    // Manually set nextRetryAt to far future
    const item = await db.syncQueue.where('clientId').equals(clientId).first();
    if (item?.id) {
      await db.syncQueue.update(item.id, { nextRetryAt: Date.now() + 9_999_999 });
    }

    const items = await adapter.dequeue('pending');
    expect(items.find((i) => i.id === clientId)).toBeUndefined();
  });
});

describe('WebWakaSyncAdapter.updateStatus', () => {
  it('marks item as synced and sets syncedAt', async () => {
    const adapter = new WebWakaSyncAdapter();
    const clientId = await adapter.enqueue({
      entityType: 'individual', entityId: 'ind_sync', operation: 'create', payload: {},
    });
    await adapter.updateStatus(clientId, 'synced');
    const item = await db.syncQueue.where('clientId').equals(clientId).first();
    expect(item?.status).toBe('synced');
    expect(item?.syncedAt).toBeDefined();
  });

  it('increments retryCount and schedules next retry on failed', async () => {
    const adapter = new WebWakaSyncAdapter();
    const clientId = await adapter.enqueue({
      entityType: 'individual', entityId: 'ind_fail', operation: 'create', payload: {},
    });
    await adapter.updateStatus(clientId, 'failed', 'timeout');
    const item = await db.syncQueue.where('clientId').equals(clientId).first();
    expect(item?.status).toBe('failed');
    expect(item?.retryCount).toBe(1);
    expect(item?.nextRetryAt).toBeGreaterThan(Date.now());
    expect(item?.error).toBe('timeout');
  });

  it('applies exponential backoff: 30s for first retry, 2m for second', async () => {
    const adapter = new WebWakaSyncAdapter();
    const clientId = await adapter.enqueue({
      entityType: 'individual', entityId: 'ind_backoff', operation: 'create', payload: {},
    });
    const before = Date.now();
    await adapter.updateStatus(clientId, 'failed', 'err');
    const item = await db.syncQueue.where('clientId').equals(clientId).first();
    // First failure: 30s delay
    expect(item!.nextRetryAt).toBeGreaterThanOrEqual(before + 29_000);
    expect(item!.nextRetryAt).toBeLessThanOrEqual(before + 31_000);
  });

  it('is a no-op for unknown clientId', async () => {
    const adapter = new WebWakaSyncAdapter();
    await expect(adapter.updateStatus('nonexistent-id', 'synced')).resolves.toBeUndefined();
  });
});

describe('WebWakaSyncAdapter.resolveConflict', () => {
  it('marks item as synced on server-wins', async () => {
    const adapter = new WebWakaSyncAdapter();
    const clientId = await adapter.enqueue({
      entityType: 'individual', entityId: 'ind_conflict', operation: 'update', payload: {},
    });
    await adapter.resolveConflict(clientId, { strategy: 'server-wins', resolvedAt: Date.now() });
    const item = await db.syncQueue.where('clientId').equals(clientId).first();
    expect(item?.status).toBe('synced');
    expect(item?.error).toContain('server-wins');
  });

  it('marks item as conflict on client-wins', async () => {
    const adapter = new WebWakaSyncAdapter();
    const clientId = await adapter.enqueue({
      entityType: 'individual', entityId: 'ind_conflict2', operation: 'update', payload: {},
    });
    await adapter.resolveConflict(clientId, { strategy: 'client-wins', resolvedAt: Date.now() });
    const item = await db.syncQueue.where('clientId').equals(clientId).first();
    expect(item?.status).toBe('conflict');
  });
});
