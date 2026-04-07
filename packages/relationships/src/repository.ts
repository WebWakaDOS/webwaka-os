/**
 * D1-backed relationship repository.
 * (T3: every query includes tenant_id)
 */

import type { TenantId } from '@webwaka/types';
import type { Relationship, CreateRelationshipInput, RelationshipFilter } from './types.js';

// Minimal D1 interface for testability (avoids hard @cloudflare/workers-types dep at compile time)
interface D1Like {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }> };
    run(): Promise<unknown>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

function generateId(): string {
  return `rel_${crypto.randomUUID().replace(/-/g, '')}`;
}

interface RelationshipRow {
  id: string;
  kind: string;
  subject_type: string;
  subject_id: string;
  object_type: string;
  object_id: string;
  tenant_id: string;
  metadata: string | null;
  created_at: string;
}

function rowToRelationship(row: RelationshipRow): Relationship {
  return {
    id: row.id,
    kind: row.kind as Relationship['kind'],
    subjectType: row.subject_type as Relationship['subjectType'],
    subjectId: row.subject_id,
    objectType: row.object_type as Relationship['objectType'],
    objectId: row.object_id,
    tenantId: row.tenant_id as TenantId,
    ...(row.metadata ? { metadata: JSON.parse(row.metadata) as Record<string, unknown> } : {}),
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Repository operations (T3: all queries include tenant_id)
// ---------------------------------------------------------------------------

/**
 * Create a new relationship between two entities.
 */
export async function createRelationship(
  db: D1Like,
  tenantId: TenantId,
  input: CreateRelationshipInput,
): Promise<Relationship> {
  const id = generateId();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO relationships (id, kind, subject_type, subject_id, object_type, object_id, tenant_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
    )
    .bind(
      id,
      input.kind,
      input.subjectType,
      input.subjectId,
      input.objectType,
      input.objectId,
      tenantId,
      input.metadata ? JSON.stringify(input.metadata) : null,
    )
    .run();

  return {
    id,
    kind: input.kind,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    objectType: input.objectType,
    objectId: input.objectId,
    tenantId,
    ...(input.metadata ? { metadata: input.metadata } : {}),
    createdAt: now,
  };
}

/**
 * List relationships with optional filters. T3: always scoped to tenantId.
 */
export async function listRelationships(
  db: D1Like,
  tenantId: TenantId,
  filter: RelationshipFilter = {},
): Promise<Relationship[]> {
  const conditions: string[] = ['tenant_id = ?'];
  const bindings: unknown[] = [tenantId];

  if (filter.subjectId !== undefined) {
    conditions.push('subject_id = ?');
    bindings.push(filter.subjectId);
  }
  if (filter.subjectType !== undefined) {
    conditions.push('subject_type = ?');
    bindings.push(filter.subjectType);
  }
  if (filter.objectId !== undefined) {
    conditions.push('object_id = ?');
    bindings.push(filter.objectId);
  }
  if (filter.objectType !== undefined) {
    conditions.push('object_type = ?');
    bindings.push(filter.objectType);
  }
  if (filter.kind !== undefined) {
    conditions.push('kind = ?');
    bindings.push(filter.kind);
  }

  const sql = `SELECT id, kind, subject_type, subject_id, object_type, object_id, tenant_id, metadata, datetime(created_at, 'unixepoch') AS created_at FROM relationships WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;

  const { results } = await db.prepare(sql).bind(...bindings).all<RelationshipRow>();
  return results.map(rowToRelationship);
}

/**
 * Delete a relationship by ID. T3: scoped to tenantId — cannot delete another tenant's data.
 */
export async function deleteRelationship(
  db: D1Like,
  tenantId: TenantId,
  id: string,
): Promise<boolean> {
  await db
    .prepare('DELETE FROM relationships WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .run();
  return true;
}
