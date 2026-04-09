/**
 * packages/verticals-property-developer — PropertyDeveloperRepository tests
 * M9 Batch 2 acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PropertyDeveloperRepository } from './property-developer.js';
import {
  guardSeedToClaimed,
  guardClaimedToSurconVerified,
  guardPropertyOperation,
  isValidPropertyDeveloperTransition,
} from './types.js';

function makeDb() {
  const store: Record<string, unknown>[] = [];
  const prep = (sql: string) => {
    const bindFn = (...vals: unknown[]) => ({
      run: async () => {
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
          const colM = sql.match(/\(([^)]+)\)\s+VALUES/i);
          const valM = sql.match(/VALUES\s*\(([^)]+)\)/i);
          if (colM && valM) {
            const cols = colM[1]!.split(',').map((c: string) => c.trim());
            const tokens = valM[1]!.split(',').map((v: string) => v.trim());
            const row: Record<string, unknown> = {};
            let bi = 0;
            cols.forEach((col: string, i: number) => {
              const tok = tokens[i] ?? '?';
              if (tok === '?') { row[col] = vals[bi++]; }
              else if (tok.toUpperCase() === 'NULL') { row[col] = null; }
              else if (tok.toLowerCase() === 'unixepoch()') { row[col] = Math.floor(Date.now() / 1000); }
              else if (tok.startsWith("'") && tok.endsWith("'")) { row[col] = tok.slice(1, -1); }
              else if (!Number.isNaN(Number(tok))) { row[col] = Number(tok); }
              else { row[col] = vals[bi++]; }
            });
            if (!row['status']) row['status'] = 'seeded';
            if (!row['created_at']) row['created_at'] = Math.floor(Date.now() / 1000);
            store.push(row);
          }
        } else if (sql.trim().toUpperCase().startsWith('UPDATE')) {
          const setM = sql.match(/SET\s+(.+?)\s+WHERE/i);
          if (setM) {
            const clauses = setM[1]!.split(',').map((s: string) => s.trim()).filter((s: string) => !s.includes('updated_at'));
            const id = vals[vals.length - 2] as string;
            const tid = vals[vals.length - 1] as string;
            const idx = store.findIndex(r => r['id'] === id && r['tenant_id'] === tid);
            if (idx >= 0) {
              clauses.forEach((clause: string, i: number) => {
                const col = clause.split('=')[0]!.trim();
                (store[idx] as Record<string, unknown>)[col] = vals[i];
              });
            }
          }
        }
        return { success: true };
      },
      first: async <T>() => {
        if (!sql.trim().toUpperCase().startsWith('SELECT')) return null as T;
        const found = store.find(r =>
          vals.length >= 2 ? r['id'] === vals[0] && r['tenant_id'] === vals[1] : r['id'] === vals[0]
        );
        return (found ?? null) as T;
      },
      all: async <T>() => {
        return {
          results: store.filter(r =>
            vals.length >= 2
              ? (r['workspace_id'] === vals[0] || r['estate_id'] === vals[0] || r['unit_id'] === vals[0]) && r['tenant_id'] === vals[1]
              : true
          ),
        } as { results: T[] };
      },
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof PropertyDeveloperRepository>[0];
}

describe('PropertyDeveloperRepository', () => {
  let repo: PropertyDeveloperRepository;
  beforeEach(() => { repo = new PropertyDeveloperRepository(makeDb() as never); });

  it('T001 — creates profile with status seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Lagos Homes Ltd' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Lagos Homes Ltd');
  });

  it('T002 — finds by id + tenantId (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Abuja Dev' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.id).toBe(p.id);
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'X Dev' });
    expect(await repo.findProfileById(p.id, 'evil')).toBeNull();
  });

  it('T004 — FSM seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'X' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T005 — isValidPropertyDeveloperTransition seeded→claimed', () => {
    expect(isValidPropertyDeveloperTransition('seeded', 'claimed')).toBe(true);
  });

  it('T006 — rejects seeded→surcon_verified', () => {
    expect(isValidPropertyDeveloperTransition('seeded', 'surcon_verified')).toBe(false);
  });

  it('T007 — allows surcon_verified→active', () => {
    expect(isValidPropertyDeveloperTransition('surcon_verified', 'active')).toBe(true);
  });

  it('T008 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T009 — guardSeedToClaimed allows Tier 1+', () => {
    expect(guardSeedToClaimed({ kycTier: 1 }).allowed).toBe(true);
  });

  it('T010 — guardClaimedToSurconVerified requires both numbers', () => {
    expect(guardClaimedToSurconVerified({ surconNumber: null, toprecNumber: 'T1' }).allowed).toBe(false);
    expect(guardClaimedToSurconVerified({ surconNumber: 'S1', toprecNumber: null }).allowed).toBe(false);
    expect(guardClaimedToSurconVerified({ surconNumber: 'S1', toprecNumber: 'T1' }).allowed).toBe(true);
  });

  it('T011 — guardPropertyOperation requires KYC Tier 3', () => {
    expect(guardPropertyOperation({ kycTier: 2 }).allowed).toBe(false);
    expect(guardPropertyOperation({ kycTier: 3 }).allowed).toBe(true);
  });

  it('T012 — creates estate', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Y Dev' });
    const e = await repo.createEstate({ workspaceId: 'ws1', tenantId: 'tn1', estateName: 'Pearl Gardens', totalUnits: 50 });
    expect(e.estateName).toBe('Pearl Gardens');
    expect(e.totalUnits).toBe(50);
    expect(e.status).toBe('planning');
    void p;
  });

  it('T013 — creates unit with priceKobo (P9)', async () => {
    const e = await repo.createEstate({ workspaceId: 'ws1', tenantId: 'tn1', estateName: 'E1', totalUnits: 10 });
    const u = await repo.createUnit({ estateId: e.id, workspaceId: 'ws1', tenantId: 'tn1', unitType: '3bed', unitNumber: 'A1', floorAreaSqm: 120, priceKobo: 5_000_000_000 });
    expect(u.priceKobo).toBe(5_000_000_000);
    expect(u.status).toBe('available');
  });

  it('T014 — rejects float priceKobo (P9)', async () => {
    const e = await repo.createEstate({ workspaceId: 'ws1', tenantId: 'tn1', estateName: 'E2', totalUnits: 5 });
    await expect(repo.createUnit({ estateId: e.id, workspaceId: 'ws1', tenantId: 'tn1', unitType: '2bed', unitNumber: 'B1', floorAreaSqm: 80, priceKobo: 5_000_000.5 })).rejects.toThrow('P9');
  });

  it('T015 — updates unit status to reserved', async () => {
    const e = await repo.createEstate({ workspaceId: 'ws1', tenantId: 'tn1', estateName: 'E3', totalUnits: 3 });
    const u = await repo.createUnit({ estateId: e.id, workspaceId: 'ws1', tenantId: 'tn1', unitType: 'duplex', unitNumber: 'C1', floorAreaSqm: 200, priceKobo: 8_000_000_000 });
    const updated = await repo.updateUnitStatus(u.id, 'tn1', 'reserved');
    expect(updated!.status).toBe('reserved');
  });

  it('T016 — creates allocation with instalmentPlan serialised as JSON', async () => {
    const e = await repo.createEstate({ workspaceId: 'ws1', tenantId: 'tn1', estateName: 'E4', totalUnits: 2 });
    const u = await repo.createUnit({ estateId: e.id, workspaceId: 'ws1', tenantId: 'tn1', unitType: '2bed', unitNumber: 'D1', floorAreaSqm: 60, priceKobo: 2_000_000_000 });
    const alloc = await repo.createAllocation({ unitId: u.id, workspaceId: 'ws1', tenantId: 'tn1', buyerPhone: '08030001234', buyerName: 'Mr Jide', totalPriceKobo: 2_000_000_000, depositKobo: 400_000_000, instalmentPlan: [{ amountKobo: 200_000_000, dueDate: 1700000000 }] });
    expect(alloc.instalmentPlan).toHaveLength(1);
    expect(alloc.instalmentPlan[0]!.amountKobo).toBe(200_000_000);
  });
});
