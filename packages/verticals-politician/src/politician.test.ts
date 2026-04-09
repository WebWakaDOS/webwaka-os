/**
 * packages/verticals-politician — PoliticianRepository tests
 * M8b acceptance criteria: ≥15 tests for politician profile CRUD + FSM + T3 isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PoliticianRepository } from './politician.js';
import type { PoliticianProfile } from './types.js';

// ---------------------------------------------------------------------------
// Minimal in-memory D1 mock (captures SQL for T3 isolation assertions)
// ---------------------------------------------------------------------------

interface MockBindResult {
  sql: string;
  bindings: unknown[];
}

function makeDb(overrideRows?: Partial<Record<string, unknown>>): {
  db: ReturnType<typeof buildMockDb>;
  lastQuery: () => MockBindResult | null;
} {
  let _last: MockBindResult | null = null;

  const db = buildMockDb(overrideRows ?? {}, (sql, bindings) => {
    _last = { sql, bindings };
  });

  return { db, lastQuery: () => _last };
}

function buildMockDb(
  rows: Partial<Record<string, unknown>>,
  onQuery: (sql: string, bindings: unknown[]) => void,
) {
  const store: Map<string, unknown> = new Map(Object.entries(rows));

  const prepare = (sql: string) => ({
    bind: (...bindings: unknown[]) => {
      onQuery(sql, bindings);
      return {
        run: async () => {
          if (sql.startsWith('INSERT INTO politician_profiles')) {
            const id = bindings[0] as string;
            const row = {
              id,
              individual_id: bindings[1],
              workspace_id: bindings[2],
              tenant_id: bindings[3],
              office_type: bindings[4],
              jurisdiction_id: bindings[5],
              party_id: bindings[6] ?? null,
              nin_verified: 0,
              inec_filing_ref: null,
              term_start: null,
              term_end: null,
              status: 'seeded',
              created_at: Math.floor(Date.now() / 1000),
            };
            store.set(id, row);
          }
          if (sql.startsWith('UPDATE politician_profiles')) {
            const id = bindings[bindings.length - 2] as string;
            const existing = store.get(id);
            if (existing && typeof existing === 'object') {
              const updated = { ...(existing as object) };

              const setClauses = sql.match(/SET (.+?) WHERE/s)?.[1]?.split(',') ?? [];
              let bIdx = 0;
              for (const clause of setClauses) {
                const col = clause.trim().split(' = ')[0]?.trim();
                if (col) {
                  (updated as Record<string, unknown>)[col] = bindings[bIdx++];
                }
              }
              store.set(id, updated);
            }
          }
          if (sql.startsWith('DELETE FROM politician_profiles')) {
            const id = bindings[0] as string;
            store.delete(id);
          }
          return { success: true };
        },
        first: async <T>() => {
          const id = bindings[0] as string;
          const tenantId = bindings[1] as string | undefined;
          const row = store.get(id) as Record<string, unknown> | undefined;
          if (!row) return null as T;
          // T3 enforcement: if sql includes tenant_id check, enforce it
          if (tenantId !== undefined && sql.includes('tenant_id') && row['tenant_id'] !== tenantId) {
            return null as T;
          }
          return row as T;
        },
        all: async <T>() => {
          const results = Array.from(store.values()) as T[];
          return { results };
        },
      };
    },
  });

  return { prepare };
}

// ---------------------------------------------------------------------------
// Helper factory
// ---------------------------------------------------------------------------

function makeInput(overrides = {}) {
  return {
    individualId: 'ind_001',
    workspaceId: 'wsp_001',
    tenantId: 'tenant_a',
    officeType: 'senator' as const,
    jurisdictionId: 'jur_lagos',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PoliticianRepository — CRUD', () => {
  it('creates a politician profile with seeded status', async () => {
    const { db } = makeDb();
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const profile = await repo.create(makeInput({ id: 'pol_001' }));

    expect(profile.id).toBe('pol_001');
    expect(profile.status).toBe('seeded');
    expect(profile.officeType).toBe('senator');
    expect(profile.tenantId).toBe('tenant_a');
  });

  it('uses provided id if given', async () => {
    const { db } = makeDb();
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const profile = await repo.create(makeInput({ id: 'pol_custom' }));
    expect(profile.id).toBe('pol_custom');
  });

  it('generates uuid if id not provided', async () => {
    const { db } = makeDb();
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const profile = await repo.create(makeInput());
    expect(profile.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets ninVerified false on creation', async () => {
    const { db } = makeDb();
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const profile = await repo.create(makeInput({ id: 'pol_002' }));
    expect(profile.ninVerified).toBe(false);
  });

  it('sets partyId null when not provided', async () => {
    const { db } = makeDb();
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const profile = await repo.create(makeInput({ id: 'pol_003' }));
    expect(profile.partyId).toBeNull();
  });

  it('stores partyId when provided', async () => {
    const { db } = makeDb();
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const profile = await repo.create(makeInput({ id: 'pol_004', partyId: 'org_pdp' }));
    expect(profile.partyId).toBe('org_pdp');
  });

  it('returns null for findById with wrong tenantId (T3 isolation)', async () => {
    const { db } = makeDb({
      pol_005: {
        id: 'pol_005',
        individual_id: 'ind_001',
        workspace_id: 'wsp_001',
        tenant_id: 'tenant_b',
        office_type: 'governor',
        jurisdiction_id: 'jur_001',
        party_id: null,
        nin_verified: 0,
        inec_filing_ref: null,
        term_start: null,
        term_end: null,
        status: 'seeded',
        created_at: 1700000000,
      },
    });
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const result = await repo.findById('pol_005', 'tenant_a');
    expect(result).toBeNull();
  });

  it('findById returns profile for correct tenant', async () => {
    const { db } = makeDb({
      pol_006: {
        id: 'pol_006',
        individual_id: 'ind_001',
        workspace_id: 'wsp_001',
        tenant_id: 'tenant_a',
        office_type: 'governor',
        jurisdiction_id: 'jur_001',
        party_id: null,
        nin_verified: 0,
        inec_filing_ref: null,
        term_start: null,
        term_end: null,
        status: 'seeded',
        created_at: 1700000000,
      },
    });
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const result = await repo.findById('pol_006', 'tenant_a');
    expect(result).not.toBeNull();
    expect(result?.officeType).toBe('governor');
  });
});

describe('PoliticianRepository — FSM Transitions', () => {
  async function makeRepo(id: string, initialStatus: string) {
    const { db } = makeDb({
      [id]: {
        id,
        individual_id: 'ind_001',
        workspace_id: 'wsp_001',
        tenant_id: 'tenant_a',
        office_type: 'senator',
        jurisdiction_id: 'jur_001',
        party_id: null,
        nin_verified: 0,
        inec_filing_ref: null,
        term_start: null,
        term_end: null,
        status: initialStatus,
        created_at: 1700000000,
      },
    });
    const repo = new PoliticianRepository(db as unknown as D1Database);
    return repo;
  }

  it('transitions seeded → claimed', async () => {
    const repo = await makeRepo('pol_t01', 'seeded');
    const result = await repo.transition('pol_t01', 'tenant_a', 'claimed');
    expect(result?.status).toBe('claimed');
  });

  it('transitions claimed → candidate', async () => {
    const repo = await makeRepo('pol_t02', 'claimed');
    const result = await repo.transition('pol_t02', 'tenant_a', 'candidate');
    expect(result?.status).toBe('candidate');
  });

  it('transitions candidate → elected (admin)', async () => {
    const repo = await makeRepo('pol_t03', 'candidate');
    const result = await repo.transition('pol_t03', 'tenant_a', 'elected');
    expect(result?.status).toBe('elected');
  });

  it('transitions elected → in_office (sworn-in)', async () => {
    const repo = await makeRepo('pol_t04', 'elected');
    const result = await repo.transition('pol_t04', 'tenant_a', 'in_office');
    expect(result?.status).toBe('in_office');
  });

  it('transitions in_office → post_office (term end)', async () => {
    const repo = await makeRepo('pol_t05', 'in_office');
    const result = await repo.transition('pol_t05', 'tenant_a', 'post_office');
    expect(result?.status).toBe('post_office');
  });

  it('transition returns null for wrong tenantId (T3)', async () => {
    const repo = await makeRepo('pol_t06', 'seeded');
    const result = await repo.transition('pol_t06', 'wrong_tenant', 'claimed');
    expect(result).toBeNull();
  });
});

describe('PoliticianRepository — KYC guard functions', () => {
  it('guardSeedToClaimed blocks KYC Tier 1', async () => {
    const { guardSeedToClaimed } = await import('./types.js');
    const result = guardSeedToClaimed({ kycTier: 1, ninVerified: true });
    expect(result.allowed).toBe(false);
  });

  it('guardSeedToClaimed blocks missing NIN even at Tier 2', async () => {
    const { guardSeedToClaimed } = await import('./types.js');
    const result = guardSeedToClaimed({ kycTier: 2, ninVerified: false });
    expect(result.allowed).toBe(false);
  });

  it('guardSeedToClaimed allows KYC Tier 2 + NIN verified', async () => {
    const { guardSeedToClaimed } = await import('./types.js');
    const result = guardSeedToClaimed({ kycTier: 2, ninVerified: true });
    expect(result.allowed).toBe(true);
  });

  it('guardClaimedToCandidate blocks missing INEC filing ref', async () => {
    const { guardClaimedToCandidate } = await import('./types.js');
    const result = guardClaimedToCandidate({ kycTier: 2, inecFilingRef: null });
    expect(result.allowed).toBe(false);
  });

  it('guardClaimedToCandidate allows Tier 2 + INEC ref', async () => {
    const { guardClaimedToCandidate } = await import('./types.js');
    const result = guardClaimedToCandidate({ kycTier: 2, inecFilingRef: 'INEC-2024-001' });
    expect(result.allowed).toBe(true);
  });
});

describe('PoliticianRepository — Update', () => {
  it('update sets ninVerified true', async () => {
    const { db } = makeDb({
      pol_u01: {
        id: 'pol_u01',
        individual_id: 'ind_001',
        workspace_id: 'wsp_001',
        tenant_id: 'tenant_a',
        office_type: 'senator',
        jurisdiction_id: 'jur_001',
        party_id: null,
        nin_verified: 0,
        inec_filing_ref: null,
        term_start: null,
        term_end: null,
        status: 'claimed',
        created_at: 1700000000,
      },
    });
    const repo = new PoliticianRepository(db as unknown as D1Database);
    await repo.update('pol_u01', 'tenant_a', { ninVerified: true });
    const result = await repo.findById('pol_u01', 'tenant_a');
    expect(result?.ninVerified).toBe(true);
  });

  it('update is a no-op for empty input', async () => {
    const { db } = makeDb({
      pol_u02: {
        id: 'pol_u02',
        individual_id: 'ind_001',
        workspace_id: 'wsp_001',
        tenant_id: 'tenant_a',
        office_type: 'senator',
        jurisdiction_id: 'jur_001',
        party_id: null,
        nin_verified: 0,
        inec_filing_ref: null,
        term_start: null,
        term_end: null,
        status: 'seeded',
        created_at: 1700000000,
      },
    });
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const result = await repo.update('pol_u02', 'tenant_a', {});
    expect(result?.status).toBe('seeded');
  });
});

describe('PoliticianRepository — Delete', () => {
  it('delete returns true for existing row', async () => {
    const { db } = makeDb({
      pol_d01: {
        id: 'pol_d01',
        individual_id: 'ind_001',
        workspace_id: 'wsp_001',
        tenant_id: 'tenant_a',
        office_type: 'senator',
        jurisdiction_id: 'jur_001',
        party_id: null,
        nin_verified: 0,
        inec_filing_ref: null,
        term_start: null,
        term_end: null,
        status: 'post_office',
        created_at: 1700000000,
      },
    });
    const repo = new PoliticianRepository(db as unknown as D1Database);
    const result = await repo.delete('pol_d01', 'tenant_a');
    expect(result).toBe(true);
  });
});

describe('isValidPoliticianTransition', () => {
  it('validates all 6 expected transitions', async () => {
    const { isValidPoliticianTransition } = await import('./types.js');
    expect(isValidPoliticianTransition('seeded', 'claimed')).toBe(true);
    expect(isValidPoliticianTransition('claimed', 'candidate')).toBe(true);
    expect(isValidPoliticianTransition('candidate', 'elected')).toBe(true);
    expect(isValidPoliticianTransition('elected', 'in_office')).toBe(true);
    expect(isValidPoliticianTransition('in_office', 'post_office')).toBe(true);
    expect(isValidPoliticianTransition('in_office', 'active')).toBe(true);
  });

  it('rejects invalid transitions', async () => {
    const { isValidPoliticianTransition } = await import('./types.js');
    expect(isValidPoliticianTransition('seeded', 'elected')).toBe(false);
    expect(isValidPoliticianTransition('post_office', 'seeded')).toBe(false);
  });
});
