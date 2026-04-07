/**
 * D1-backed CRUD for places (geography-aware).
 * Places are shared geography nodes — no tenant filter on reads.
 * T3: write operations are tenant-scoped where applicable.
 */

import type { Place, PlaceId, TenantId } from '@webwaka/types';
import { GeographyType, GeographyLevel } from '@webwaka/geography';
import type { GeographyNode } from '@webwaka/geography';
import { generatePlaceId } from '../ids.js';

interface D1Like {
  prepare(query: string): {
    bind(...args: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }> };
    run(): Promise<unknown>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

export interface CreatePlaceInput {
  name: string;
  geographyType: GeographyType;
  level: GeographyLevel;
  parentId?: PlaceId;
}

interface PlaceRow {
  id: string;
  name: string;
  geography_type: string;
  level: number;
  parent_id: string | null;
  ancestry_path: string;
  tenant_id: string | null;
  created_at: string;
}

function rowToPlace(row: PlaceRow): Place {
  return {
    id: row.id as PlaceId,
    name: row.name,
    geographyType: row.geography_type as GeographyType,
    level: row.level as GeographyLevel,
    parentId: row.parent_id ? (row.parent_id as PlaceId) : undefined,
    ancestryPath: (JSON.parse(row.ancestry_path) as string[]).map((p) => p as PlaceId),
    tenantId: row.tenant_id as TenantId | undefined,
    createdAt: row.created_at,
  } as unknown as Place;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export async function createPlace(
  db: D1Like,
  _tenantId: TenantId,
  input: CreatePlaceInput,
): Promise<Place> {
  const id = generatePlaceId();
  const now = new Date().toISOString();

  // Build ancestry path — parent must exist
  let ancestryPath: string[] = [];
  if (input.parentId) {
    const parent = await getPlaceById(db, input.parentId);
    if (!parent) {
      throw new Error(`Parent place '${input.parentId}' not found.`);
    }
    const parentNode = parent as unknown as GeographyNode;
    ancestryPath = [...(Array.from(parentNode.ancestryPath as readonly string[]) ?? []), input.parentId as string];
  }

  await db
    .prepare(
      `INSERT INTO places (id, name, geography_type, level, parent_id, ancestry_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
    )
    .bind(
      id,
      input.name,
      input.geographyType,
      input.level,
      input.parentId ?? null,
      JSON.stringify(ancestryPath),
    )
    .run();

  return {
    id,
    name: input.name,
    geographyType: input.geographyType,
    level: input.level,
    parentId: input.parentId,
    ancestryPath,
    createdAt: now,
  } as unknown as Place;
}

export async function getPlaceById(
  db: D1Like,
  placeId: PlaceId,
): Promise<Place | null> {
  const row = await db
    .prepare(
      `SELECT id, name, geography_type, level, parent_id, ancestry_path, tenant_id, datetime(created_at,'unixepoch') AS created_at
       FROM places WHERE id = ?`,
    )
    .bind(placeId)
    .first<PlaceRow>();

  return row ? rowToPlace(row) : null;
}

export async function listPlacesByParent(
  db: D1Like,
  parentId: PlaceId,
): Promise<Place[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, geography_type, level, parent_id, ancestry_path, tenant_id, datetime(created_at,'unixepoch') AS created_at
       FROM places WHERE parent_id = ? ORDER BY name ASC`,
    )
    .bind(parentId)
    .all<PlaceRow>();

  return results.map(rowToPlace);
}
