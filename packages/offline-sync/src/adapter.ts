/**
 * WebWakaSyncAdapter — Dexie.js implementation of the SyncAdapter interface.
 * (TDR-0010, Platform Invariant P6 + P11)
 *
 * Maps between the SyncQueueItem contract (types.ts) and the Dexie OfflineQueueItem schema.
 * SyncQueueItem.id  ↔  OfflineQueueItem.clientId
 */

import { db, type OfflineQueueItem } from './db.js';
import type { SyncAdapter, SyncQueueItem, ConflictResolution, SyncStatus } from './types.js';
import { generateId } from './utils.js';

export class WebWakaSyncAdapter implements SyncAdapter {

  async enqueue(
    item: Omit<SyncQueueItem, 'id' | 'attemptCount' | 'status' | 'createdAt' | 'lastAttemptAt' | 'error'>,
  ): Promise<string> {
    const clientId = generateId();
    await db.syncQueue.add({
      clientId,
      type: item.operation as OfflineQueueItem['type'],
      entity: item.entityType as string,
      payload: item.payload as Record<string, unknown>,
      priority: 'normal',
      status: 'pending',
      retryCount: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
    });
    return clientId;
  }

  async dequeue(status: SyncStatus): Promise<SyncQueueItem[]> {
    const dexieStatus = mapToDexieStatus(status);
    const items = await db.syncQueue
      .where('status').equals(dexieStatus)
      .and((item) => item.nextRetryAt <= Date.now())
      .sortBy('createdAt'); // FIFO — Platform Invariant P11
    return items.map(mapToSyncQueueItem);
  }

  async updateStatus(id: string, status: SyncStatus, error?: string): Promise<void> {
    const item = await db.syncQueue.where('clientId').equals(id).first();
    if (!item?.id) return;
    const dexieStatus = mapToDexieStatus(status);
    await db.syncQueue.update(item.id, {
      status: dexieStatus,
      ...(error !== undefined ? { error } : {}),
      ...(status === 'synced' ? { syncedAt: Date.now() } : {}),
      ...(status === 'failed' ? {
        retryCount: item.retryCount + 1,
        nextRetryAt: computeNextRetry(item.retryCount),
      } : {}),
    });
  }

  async resolveConflict(id: string, resolution: ConflictResolution): Promise<void> {
    const item = await db.syncQueue.where('clientId').equals(id).first();
    if (!item?.id) return;
    // Server-wins: mark as synced regardless. Platform Invariant P11.
    await db.syncQueue.update(item.id, {
      status: resolution.strategy === 'server-wins' ? 'synced' : 'conflict',
      error: `conflict:${resolution.strategy}`,
      syncedAt: Date.now(),
    });
  }
}

// Exponential backoff: 30s → 2m → 10m → 30m → 1h (max)
function computeNextRetry(retryCount: number): number {
  const delays = [30_000, 120_000, 600_000, 1_800_000, 3_600_000];
  const delay = delays[Math.min(retryCount, delays.length - 1)] ?? 3_600_000;
  return Date.now() + delay;
}

function mapToDexieStatus(status: SyncStatus): OfflineQueueItem['status'] {
  switch (status) {
    case 'pending': return 'pending';
    case 'syncing': return 'syncing';
    case 'synced': return 'synced';
    case 'failed': return 'failed';
    case 'conflict': return 'conflict';
  }
}

function mapToSyncQueueItem(item: OfflineQueueItem): SyncQueueItem {
  return {
    id: item.clientId,
    entityType: item.entity as SyncQueueItem['entityType'],
    entityId: '',           // Not stored separately in Dexie — use payload.id if needed
    operation: item.type as SyncQueueItem['operation'],
    payload: item.payload,
    attemptCount: item.retryCount,
    status: item.status as SyncQueueItem['status'],
    createdAt: item.createdAt,
    lastAttemptAt: item.syncedAt ?? null,
    error: item.error ?? null,
  };
}
