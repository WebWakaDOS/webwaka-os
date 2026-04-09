/**
 * packages/verticals-political-party — PoliticalPartyRepository tests
 * M8b scaffold: ≥10 tests for party CRUD + FSM guards + T3 isolation.
 */

import { describe, it, expect } from 'vitest';
import { PoliticalPartyRepository } from './political-party.js';
import {
  guardPartyClaimToActive,
  isValidPartyTransition,
} from './types.js';

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------

function buildPartyDb() {
  const store: Map<string, unknown> = new Map();

  const prepare = (sql: string) => ({
    bind: (...bindings: unknown[]) => ({
      run: async () => {
        if (sql.includes('INSERT INTO political_party_profiles')) {
          const id = bindings[0] as string;
          store.set(id, {
            id,
            organization_id: bindings[1],
            workspace_id: bindings[2],
            tenant_id: bindings[3],
            party_name: bindings[4],
            abbreviation: bindings[5] ?? null,
            cac_reg_number: null,
            inec_reg_number: null,
            chairperson_id: null,
            status: 'seeded',
            created_at: Math.floor(Date.now() / 1000),
          });
        }
        if (sql.includes('UPDATE political_party_profiles')) {
          const id = bindings[bindings.length - 2] as string;
          const existing = store.get(id) as Record<string, unknown> | undefined;
          if (existing) {
            store.set(id, { ...existing });
          }
        }
        return { success: true };
      },
      first: async <T>() => {
        const id = bindings[0] as string;
        const tenantId = bindings[1] as string;
        const row = store.get(id) as Record<string, unknown> | undefined;
        if (!row || row['tenant_id'] !== tenantId) return null as T;
        return row as T;
      },
      all: async <T>() => {
        const wsId = bindings[0] as string;
        const tenantId = bindings[1] as string;
        const results = Array.from(store.values()).filter((r) => {
          const row = r as Record<string, unknown>;
          return row['workspace_id'] === wsId && row['tenant_id'] === tenantId;
        }) as T[];
        return { results };
      },
    }),
  });

  return { prepare };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PoliticalPartyRepository — Create', () => {
  it('creates a party profile with seeded status', async () => {
    const db = buildPartyDb();
    const repo = new PoliticalPartyRepository(db as unknown as D1Database);

    const party = await repo.create({
      id: 'party_001',
      organizationId: 'org_001',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      partyName: 'All Progressives Congress',
      abbreviation: 'APC',
    });

    expect(party.id).toBe('party_001');
    expect(party.partyName).toBe('All Progressives Congress');
    expect(party.abbreviation).toBe('APC');
    expect(party.status).toBe('seeded');
  });

  it('starts with null cacRegNumber and inecRegNumber', async () => {
    const db = buildPartyDb();
    const repo = new PoliticalPartyRepository(db as unknown as D1Database);

    const party = await repo.create({
      id: 'party_002',
      organizationId: 'org_002',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      partyName: 'Peoples Democratic Party',
    });

    expect(party.cacRegNumber).toBeNull();
    expect(party.inecRegNumber).toBeNull();
    expect(party.chairpersonId).toBeNull();
  });
});

describe('PoliticalPartyRepository — T3 Isolation', () => {
  it('findById returns null for wrong tenant (T3)', async () => {
    const db = buildPartyDb();
    const repo = new PoliticalPartyRepository(db as unknown as D1Database);

    await repo.create({
      id: 'party_t01',
      organizationId: 'org_001',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_b',
      partyName: 'Test Party',
    });

    const result = await repo.findById('party_t01', 'tenant_a');
    expect(result).toBeNull();
  });

  it('findByWorkspace excludes other tenants (T3)', async () => {
    const db = buildPartyDb();
    const repo = new PoliticalPartyRepository(db as unknown as D1Database);

    await repo.create({ id: 'party_w01', organizationId: 'org_1', workspaceId: 'wsp_001', tenantId: 'tenant_a', partyName: 'Party A' });
    await repo.create({ id: 'party_w02', organizationId: 'org_2', workspaceId: 'wsp_001', tenantId: 'tenant_b', partyName: 'Party B' });

    const results = await repo.findByWorkspace('wsp_001', 'tenant_a');
    expect(results.every((r) => r.tenantId === 'tenant_a')).toBe(true);
  });
});

describe('guardPartyClaimToActive', () => {
  it('blocks activation without CAC registration', () => {
    const result = guardPartyClaimToActive({ cacRegNumber: null });
    expect(result.allowed).toBe(false);
  });

  it('allows activation with CAC registration number', () => {
    const result = guardPartyClaimToActive({ cacRegNumber: 'RC-12345' });
    expect(result.allowed).toBe(true);
  });
});

describe('isValidPartyTransition', () => {
  it('allows seeded → claimed', () => {
    expect(isValidPartyTransition('seeded', 'claimed')).toBe(true);
  });

  it('allows claimed → active', () => {
    expect(isValidPartyTransition('claimed', 'active')).toBe(true);
  });

  it('allows active → suspended', () => {
    expect(isValidPartyTransition('active', 'suspended')).toBe(true);
  });

  it('allows suspended → active (re-activation)', () => {
    expect(isValidPartyTransition('suspended', 'active')).toBe(true);
  });

  it('allows active → deprecated', () => {
    expect(isValidPartyTransition('active', 'deprecated')).toBe(true);
  });

  it('rejects seeded → deprecated (no direct path)', () => {
    expect(isValidPartyTransition('seeded', 'deprecated')).toBe(false);
  });

  it('rejects deprecated → active (terminal state)', () => {
    expect(isValidPartyTransition('deprecated', 'active')).toBe(false);
  });
});
