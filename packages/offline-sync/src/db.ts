/**
 * Dexie.js IndexedDB schema for @webwaka/offline-sync.
 * (TDR-0010, Platform Invariant P6)
 *
 * Browser/PWA only — NOT for Cloudflare Workers runtime.
 * Workers use D1 directly.
 */

import Dexie, { type Table } from 'dexie';

export interface OfflineQueueItem {
  id?: number;                        // Auto-increment (Dexie internal)
  clientId: string;                   // UUID — sent to server for idempotency
  type: 'create' | 'update' | 'delete' | 'agent_transaction';
  entity: string;                     // 'profiles' | 'agent_transactions' | etc.
  payload: Record<string, unknown>;
  priority: 'critical' | 'high' | 'normal' | 'low';
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  retryCount: number;
  nextRetryAt: number;                // Ms since epoch
  createdAt: number;
  syncedAt?: number;
  error?: string;
}

export class WebWakaOfflineDB extends Dexie {
  syncQueue!: Table<OfflineQueueItem>;

  constructor() {
    super('webwaka_offline_v1');
    this.version(1).stores({
      syncQueue: '++id, clientId, status, priority, nextRetryAt, entity, createdAt',
    });
  }
}

export const db = new WebWakaOfflineDB();
