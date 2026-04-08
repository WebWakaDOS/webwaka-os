/**
 * @webwaka/offline-sync — PWA offline sync runtime.
 * (TDR-0010, Platform Invariant P6 + P11)
 *
 * Browser/PWA only — NOT for Cloudflare Workers runtime.
 * Workers use D1 directly.
 *
 * M7b: Full Dexie.js + SyncEngine + Service Worker implementation.
 */

export type {
  SyncStatus,
  SyncQueueItem,
  ConflictResolution,
  SyncAdapter,
} from './types.js';

export { WebWakaOfflineDB, db } from './db.js';
export type { OfflineQueueItem, FeedCacheItem, CourseContentItem } from './db.js';
export { WebWakaSyncAdapter } from './adapter.js';
export { SyncEngine } from './sync-engine.js';
export type { SyncResult } from './sync-engine.js';
export { observeNetworkState, getNetworkState } from './offline-indicator.js';
export type { NetworkState } from './offline-indicator.js';
export { registerSyncServiceWorker } from './service-worker.js';
export { generateId } from './utils.js';
