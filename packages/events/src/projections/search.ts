/**
 * Search index projection — rebuilds search_entries from event_log.
 * Called by the projections Cloudflare Worker on event replay.
 *
 * Milestone 6 — Event Bus Layer
 */

import { EventType } from '../event-types.js';
import type { SearchIndexedPayload } from '../event-types.js';

interface D1Like {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    run(): Promise<{ success: boolean }>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

interface EventRow {
  id: string;
  aggregate: string;
  aggregate_id: string;
  event_type: string;
  tenant_id: string;
  payload: string;
  version: number;
  created_at: string;
}

export interface RebuildResult {
  processed: number;
  indexed: number;
  deindexed: number;
  errors: string[];
}

/**
 * Replay search.indexed and search.deindexed events from event_log
 * to rebuild the search_entries FTS5 table.
 */
export async function rebuildSearchIndexFromEvents(db: D1Like): Promise<RebuildResult> {
  const result: RebuildResult = { processed: 0, indexed: 0, deindexed: 0, errors: [] };

  const rows = await db
    .prepare(
      `SELECT id, aggregate, aggregate_id, event_type, tenant_id, payload, version,
              datetime(created_at,'unixepoch') AS created_at
       FROM event_log
       WHERE event_type IN (?, ?)
       ORDER BY created_at ASC`,
    )
    .bind(EventType.SearchIndexed, EventType.SearchDeindexed)
    .all<EventRow>();

  for (const row of rows.results) {
    result.processed++;
    try {
      const payload = JSON.parse(row.payload) as SearchIndexedPayload;

      if (row.event_type === EventType.SearchIndexed) {
        await db
          .prepare(
            `INSERT OR REPLACE INTO search_entries
               (id, entity_type, display_name, place_id, tenant_id, visibility, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'public', unixepoch(), unixepoch())`,
          )
          .bind(payload.entityId, payload.entityType, payload.displayName, payload.placeId ?? null, row.tenant_id)
          .run();
        result.indexed++;
      } else {
        await db
          .prepare('DELETE FROM search_entries WHERE id = ?')
          .bind(payload.entityId)
          .run();
        result.deindexed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`[${row.id}] ${msg}`);
    }
  }

  return result;
}
