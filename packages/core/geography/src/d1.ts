/**
 * D1-backed geography index builder.
 * (Issue #11 — Milestone 2 carry-over)
 *
 * Loads all places from the D1 `places` table and builds an in-memory
 * GeographyIndex. Called once at Worker startup or request-time if not cached.
 *
 * Requires: `packages/core/geography` as a dependency.
 * Requires: `@cloudflare/workers-types` for D1Database type in the consuming app.
 */

import { asId } from '@webwaka/types';
import type { PlaceId, TenantId } from '@webwaka/types';
import { buildIndex } from './hierarchy.js';
import type { GeographyIndex } from './hierarchy.js';
import type { GeographyNode } from './types.js';
import { GeographyType, GeographyLevel } from './types.js';

// ---------------------------------------------------------------------------
// D1 row shape
// ---------------------------------------------------------------------------

interface PlaceRow {
  id: string;
  name: string;
  geography_type: string;
  level: number;
  parent_id: string | null;
  ancestry_path: string; // JSON-encoded PlaceId[]
  tenant_id: string | null;
}

// ---------------------------------------------------------------------------
// Index builder
// ---------------------------------------------------------------------------

/**
 * Loads all places from the D1 `places` table and returns a GeographyIndex.
 *
 * The index is an in-memory ReadonlyMap keyed by PlaceId. Designed to be
 * cached in a Workers KV or in-request cache by the calling API route.
 *
 * @param db - Cloudflare D1Database binding (from Worker env)
 */
export async function buildIndexFromD1(
  db: { prepare: (query: string) => { all: <T>() => Promise<{ results: T[] }> } },
): Promise<GeographyIndex> {
  const { results } = await db
    .prepare(
      'SELECT id, name, geography_type, level, parent_id, ancestry_path, tenant_id FROM places ORDER BY level ASC',
    )
    .all<PlaceRow>();

  const nodes: GeographyNode[] = results.map((row) => ({
    id: asId<PlaceId>(row.id),
    name: row.name,
    level: row.level as GeographyLevel,
    geographyType: row.geography_type as GeographyType,
    parentId: row.parent_id ? asId<PlaceId>(row.parent_id) : null,
    ancestryPath: (JSON.parse(row.ancestry_path) as string[]).map((p) => asId<PlaceId>(p)),
    tenantId: row.tenant_id ? asId<TenantId>(row.tenant_id) : null,
  }));

  return buildIndex(nodes);
}
