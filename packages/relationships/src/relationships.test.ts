/**
 * Tests for @webwaka/relationships repository.
 * Uses an in-memory D1 mock — no real database binding required.
 */

import { describe, it, expect, vi } from 'vitest';
import { EntityType } from '@webwaka/types';
import type { TenantId } from '@webwaka/types';
import { RelationshipKind } from './types.js';
import { createRelationship, listRelationships, deleteRelationship } from './repository.js';

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant_test_001' as TenantId;

function makeMockDb() {
  const store: Record<string, unknown>[] = [];

  const prepare = (sql: string) => {
    let boundArgs: unknown[] = [];

    const stmt = {
      bind: (...args: unknown[]) => {
        boundArgs = args;
        return stmt;
      },
      run: vi.fn(() => {
        if (sql.startsWith('INSERT INTO relationships')) {
          const [id, kind, subject_type, subject_id, object_type, object_id, tenant_id, metadata] = boundArgs;
          store.push({ id, kind, subject_type, subject_id, object_type, object_id, tenant_id, metadata, created_at: new Date().toISOString() });
        }
        if (sql.startsWith('DELETE FROM relationships')) {
          const [deleteId, tenantId] = boundArgs;
          const idx = store.findIndex((r) => r['id'] === deleteId && r['tenant_id'] === tenantId);
          if (idx !== -1) store.splice(idx, 1);
        }
        return Promise.resolve({});
      }),
      first: vi.fn(() => Promise.resolve(null)),
      all: <T>(): Promise<{ results: T[] }> => {
        const results = store.filter((row) => {
          if (sql.includes('tenant_id = ?') && row['tenant_id'] !== boundArgs[0]) return false;
          if (boundArgs[1] !== undefined && sql.includes('subject_id = ?') && row['subject_id'] !== boundArgs[1]) return false;
          if (boundArgs[1] !== undefined && sql.includes('kind = ?') && row['kind'] !== boundArgs[1]) return false;
          return true;
        });
        return Promise.resolve({ results: results as unknown as T[] });
      },
    };

    return stmt;
  };

  return { prepare, _store: store };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('@webwaka/relationships — createRelationship', () => {
  it('creates a relationship and returns it', async () => {
    const db = makeMockDb();
    const result = await createRelationship(db, TENANT_ID, {
      kind: RelationshipKind.Owns,
      subjectType: EntityType.Individual,
      subjectId: 'ind_001',
      objectType: EntityType.Organization,
      objectId: 'org_001',
    });

    expect(result.id).toMatch(/^rel_/);
    expect(result.kind).toBe('owns');
    expect(result.subjectType).toBe('individual');
    expect(result.tenantId).toBe(TENANT_ID);
  });

  it('stores metadata when provided', async () => {
    const db = makeMockDb();
    const result = await createRelationship(db, TENANT_ID, {
      kind: RelationshipKind.AffiliatedWith,
      subjectType: EntityType.Individual,
      subjectId: 'ind_001',
      objectType: EntityType.Organization,
      objectId: 'org_002',
      metadata: { role: 'chairman', since: '2024-01-01' },
    });

    expect(result.metadata).toEqual({ role: 'chairman', since: '2024-01-01' });
  });
});

describe('@webwaka/relationships — listRelationships', () => {
  it('returns all relationships for a tenant', async () => {
    const db = makeMockDb();
    await createRelationship(db, TENANT_ID, {
      kind: RelationshipKind.Manages,
      subjectType: EntityType.Individual,
      subjectId: 'ind_001',
      objectType: EntityType.Place,
      objectId: 'plc_001',
    });
    await createRelationship(db, TENANT_ID, {
      kind: RelationshipKind.LocatedIn,
      subjectType: EntityType.Organization,
      subjectId: 'org_001',
      objectType: EntityType.Place,
      objectId: 'plc_002',
    });

    const results = await listRelationships(db, TENANT_ID);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

describe('@webwaka/relationships — deleteRelationship', () => {
  it('deletes a relationship by ID and tenantId', async () => {
    const db = makeMockDb();
    const rel = await createRelationship(db, TENANT_ID, {
      kind: RelationshipKind.Owns,
      subjectType: EntityType.Individual,
      subjectId: 'ind_002',
      objectType: EntityType.Offering,
      objectId: 'off_001',
    });

    const ok = await deleteRelationship(db, TENANT_ID, rel.id);
    expect(ok).toBe(true);
  });
});

describe('@webwaka/relationships — RelationshipKind', () => {
  it('covers all 15 relationship kinds', () => {
    const kinds = Object.values(RelationshipKind);
    expect(kinds).toHaveLength(15);
    expect(kinds).toContain('owns');
    expect(kinds).toContain('holds_office');
    expect(kinds).toContain('jurisdiction_over');
  });
});
