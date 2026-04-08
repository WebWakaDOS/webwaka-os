/**
 * SyncEngine — background sync coordinator.
 * (TDR-0010, Platform Invariant P6 + P11)
 *
 * Processes the offline queue in FIFO order (P11).
 * Server-wins conflict resolution (P11).
 * Called by Service Worker on `sync` event, or manually on reconnect.
 */

import type { SyncAdapter, SyncQueueItem } from './types.js';

export interface SyncResult {
  synced: number;
  conflicts: number;
  errors: number;
  total: number;
}

export class SyncEngine {
  constructor(
    private readonly adapter: SyncAdapter,
    private readonly apiBase: string,
    private readonly getAuthToken: () => Promise<string>,
  ) {}

  /**
   * Called by Service Worker on `sync` event.
   * Processes all pending + failed items in FIFO order (P11).
   */
  async processPendingQueue(): Promise<SyncResult> {
    const pending = await this.adapter.dequeue('pending');
    const failed = await this.adapter.dequeue('failed');

    // FIFO — Platform Invariant P11
    const items = [...pending, ...failed].sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    );

    let synced = 0;
    let conflicts = 0;
    let errors = 0;

    for (const item of items) {
      await this.adapter.updateStatus(item.id, 'syncing');
      try {
        const response = await this.postToServer(item);
        if (response.conflict) {
          await this.adapter.resolveConflict(item.id, {
            strategy: 'server-wins',
            resolvedAt: Date.now(),
          });
          conflicts++;
        } else {
          await this.adapter.updateStatus(item.id, 'synced');
          synced++;
        }
      } catch (err) {
        await this.adapter.updateStatus(item.id, 'failed', String(err));
        errors++;
      }
    }

    return { synced, conflicts, errors, total: items.length };
  }

  private async postToServer(item: SyncQueueItem): Promise<{ conflict: boolean }> {
    const token = await this.getAuthToken();
    const res = await fetch(`${this.apiBase}/sync/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        clientId: item.id,
        entity: item.entityType,
        operation: item.operation,
        payload: item.payload,
      }),
    });
    if (res.status === 409) return { conflict: true };
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    return { conflict: false };
  }
}
