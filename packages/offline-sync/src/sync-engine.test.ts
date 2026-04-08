/**
 * Tests for SyncEngine — background sync coordinator.
 * (TDR-0010, Platform Invariant P11 — FIFO + server-wins)
 *
 * Uses mock adapter and mock fetch — no real network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from './sync-engine.js';
import type { SyncAdapter, SyncQueueItem, ConflictResolution, SyncStatus } from './types.js';

function makeMockItem(overrides: Partial<SyncQueueItem> = {}): SyncQueueItem {
  return {
    id: `client-${Math.random()}`,
    entityType: 'individual',
    entityId: 'ind_001',
    operation: 'create',
    payload: { name: 'Test' },
    attemptCount: 0,
    status: 'pending',
    createdAt: Date.now(),
    lastAttemptAt: null,
    error: null,
    ...overrides,
  };
}

function makeMockAdapter(pendingItems: SyncQueueItem[] = [], failedItems: SyncQueueItem[] = []): SyncAdapter {
  const updateStatus = vi.fn().mockResolvedValue(undefined);
  const resolveConflict = vi.fn().mockResolvedValue(undefined);
  return {
    enqueue: vi.fn().mockResolvedValue('clientId'),
    dequeue: vi.fn().mockImplementation((status: SyncStatus) => {
      if (status === 'pending') return Promise.resolve(pendingItems);
      if (status === 'failed') return Promise.resolve(failedItems);
      return Promise.resolve([]);
    }),
    updateStatus,
    resolveConflict,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('SyncEngine.processPendingQueue', () => {
  it('returns zero counts when queue is empty', async () => {
    const adapter = makeMockAdapter();
    const engine = new SyncEngine(adapter, 'https://api.test', async () => 'token');
    const result = await engine.processPendingQueue();
    expect(result).toEqual({ synced: 0, conflicts: 0, errors: 0, total: 0 });
  });

  it('syncs pending items and increments synced count', async () => {
    const item = makeMockItem();
    const adapter = makeMockAdapter([item]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const engine = new SyncEngine(adapter, 'https://api.test', async () => 'token');
    const result = await engine.processPendingQueue();
    expect(result.synced).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('handles 409 conflict as server-wins (P11)', async () => {
    const item = makeMockItem();
    const adapter = makeMockAdapter([item]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }));

    const engine = new SyncEngine(adapter, 'https://api.test', async () => 'token');
    const result = await engine.processPendingQueue();
    expect(result.conflicts).toBe(1);
    expect(result.synced).toBe(0);
    expect(adapter.resolveConflict).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({ strategy: 'server-wins' }),
    );
  });

  it('counts fetch error as error and calls updateStatus(failed)', async () => {
    const item = makeMockItem();
    const adapter = makeMockAdapter([item]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const engine = new SyncEngine(adapter, 'https://api.test', async () => 'token');
    const result = await engine.processPendingQueue();
    expect(result.errors).toBe(1);
    expect(adapter.updateStatus).toHaveBeenCalledWith(item.id, 'failed', expect.stringContaining('Network error'));
  });

  it('processes items in FIFO order by createdAt (P11)', async () => {
    const now = Date.now();
    const order: string[] = [];
    const item1 = makeMockItem({ id: 'first', createdAt: now - 2000 });
    const item2 = makeMockItem({ id: 'second', createdAt: now - 1000 });
    const item3 = makeMockItem({ id: 'third', createdAt: now });

    // Adapter returns in reverse order — engine should sort FIFO
    const adapter = makeMockAdapter([item3, item1, item2]);
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string) as { clientId: string };
      order.push(body.clientId);
      return Promise.resolve({ ok: true, status: 200 });
    }));

    const engine = new SyncEngine(adapter, 'https://api.test', async () => 'token');
    await engine.processPendingQueue();
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('marks each item as syncing before posting to server', async () => {
    const item = makeMockItem({ id: 'item-x' });
    const adapter = makeMockAdapter([item]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const engine = new SyncEngine(adapter, 'https://api.test', async () => 'token');
    await engine.processPendingQueue();
    expect(adapter.updateStatus).toHaveBeenCalledWith('item-x', 'syncing');
    expect(adapter.updateStatus).toHaveBeenCalledWith('item-x', 'synced');
  });

  it('combines pending + failed items in single FIFO pass', async () => {
    const now = Date.now();
    const pending = makeMockItem({ id: 'p1', createdAt: now - 3000 });
    const failed = makeMockItem({ id: 'f1', createdAt: now - 1000, status: 'failed' });
    const adapter = makeMockAdapter([pending], [failed]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const engine = new SyncEngine(adapter, 'https://api.test', async () => 'token');
    const result = await engine.processPendingQueue();
    expect(result.total).toBe(2);
    expect(result.synced).toBe(2);
  });
});
