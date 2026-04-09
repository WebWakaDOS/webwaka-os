/**
 * packages/verticals-construction — ConstructionRepository tests
 * M9 Batch 2 acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConstructionRepository } from './construction.js';
import {
  guardSeedToClaimed,
  guardClaimedToCorenVerified,
  isValidConstructionTransition,
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
          vals.length >= 2 ? r['id'] === vals[0] && r['tenant_id'] === vals[1] :
          r['id'] === vals[0]
        );
        return (found ?? null) as T;
      },
      all: async <T>() => {
        return {
          results: store.filter(r =>
            vals.length >= 2
              ? (r['workspace_id'] === vals[0] || r['id'] === vals[0] || r['project_id'] === vals[0]) && r['tenant_id'] === vals[1]
              : true
          ),
        } as { results: T[] };
      },
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof ConstructionRepository>[0];
}

describe('ConstructionRepository', () => {
  let repo: ConstructionRepository;
  beforeEach(() => { repo = new ConstructionRepository(makeDb() as never); });

  it('T001 — creates profile with status seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Emeka Builders Ltd' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Emeka Builders Ltd');
  });

  it('T002 — finds profile by id + tenantId (T3 scope)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'AB Construct' });
    const found = await repo.findProfileById(p.id, 'tn1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(p.id);
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'AB Construct' });
    const found = await repo.findProfileById(p.id, 'tn-other');
    expect(found).toBeNull();
  });

  it('T004 — updates profile companyName', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Old Name' });
    const updated = await repo.updateProfile(p.id, 'tn1', { companyName: 'New Name' });
    expect(updated!.companyName).toBe('New Name');
  });

  it('T005 — FSM transition seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'X Builders' });
    const after = await repo.transitionProfile(p.id, 'tn1', 'claimed');
    expect(after!.status).toBe('claimed');
  });

  it('T006 — isValidConstructionTransition allows seeded→claimed', () => {
    expect(isValidConstructionTransition('seeded', 'claimed')).toBe(true);
  });

  it('T007 — isValidConstructionTransition rejects seeded→active', () => {
    expect(isValidConstructionTransition('seeded', 'active')).toBe(false);
  });

  it('T008 — isValidConstructionTransition allows coren_verified→active', () => {
    expect(isValidConstructionTransition('coren_verified', 'active')).toBe(true);
  });

  it('T009 — guardSeedToClaimed blocks KYC Tier 0', () => {
    const g = guardSeedToClaimed({ kycTier: 0 });
    expect(g.allowed).toBe(false);
  });

  it('T010 — guardSeedToClaimed allows KYC Tier 1+', () => {
    const g = guardSeedToClaimed({ kycTier: 1 });
    expect(g.allowed).toBe(true);
  });

  it('T011 — guardClaimedToCorenVerified requires both numbers', () => {
    expect(guardClaimedToCorenVerified({ corenNumber: null, corbonNumber: 'CB-123' }).allowed).toBe(false);
    expect(guardClaimedToCorenVerified({ corenNumber: 'CR-001', corbonNumber: null }).allowed).toBe(false);
    expect(guardClaimedToCorenVerified({ corenNumber: 'CR-001', corbonNumber: 'CB-123' }).allowed).toBe(true);
  });

  it('T012 — creates project with contractValueKobo (P9)', async () => {
    const proj = await repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', projectName: 'Lagos Office', clientName: 'Emeka', clientPhone: '08030000001', location: 'VI, Lagos', contractValueKobo: 50_000_000 });
    expect(proj.contractValueKobo).toBe(50_000_000);
    expect(proj.status).toBe('bid');
  });

  it('T013 — rejects non-integer contractValueKobo (P9)', async () => {
    await expect(repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', projectName: 'X', clientName: 'Y', clientPhone: '080', location: 'Lagos', contractValueKobo: 1.5 })).rejects.toThrow('P9');
  });

  it('T014 — updates project status', async () => {
    const proj = await repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', projectName: 'P', clientName: 'C', clientPhone: '080', location: 'L', contractValueKobo: 1_000 });
    const updated = await repo.updateProjectStatus(proj.id, 'tn1', 'awarded');
    expect(updated!.status).toBe('awarded');
  });

  it('T015 — creates milestone with amountKobo (P9)', async () => {
    const proj = await repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', projectName: 'P', clientName: 'C', clientPhone: '080', location: 'L', contractValueKobo: 10_000 });
    const m = await repo.createMilestone({ projectId: proj.id, workspaceId: 'ws1', tenantId: 'tn1', milestoneName: 'Foundation', amountKobo: 2_000 });
    expect(m.amountKobo).toBe(2_000);
    expect(m.status).toBe('pending');
  });

  it('T016 — rejects non-integer amountKobo (P9)', async () => {
    await expect(repo.createMilestone({ projectId: 'p1', workspaceId: 'ws1', tenantId: 'tn1', milestoneName: 'X', amountKobo: 0.5 })).rejects.toThrow('P9');
  });

  it('T017 — updates milestone status to paid', async () => {
    const proj = await repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', projectName: 'P2', clientName: 'C2', clientPhone: '080', location: 'L', contractValueKobo: 5_000 });
    const m = await repo.createMilestone({ projectId: proj.id, workspaceId: 'ws1', tenantId: 'tn1', milestoneName: 'Roofing', amountKobo: 1_500 });
    const paid = await repo.updateMilestoneStatus(m.id, 'tn1', 'paid');
    expect(paid!.status).toBe('paid');
  });

  it('T018 — creates material with unitCostKobo (P9)', async () => {
    const proj = await repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', projectName: 'P3', clientName: 'C3', clientPhone: '080', location: 'L', contractValueKobo: 8_000 });
    const mat = await repo.createMaterial({ projectId: proj.id, workspaceId: 'ws1', tenantId: 'tn1', materialName: 'Cement', quantity: 100, unitCostKobo: 3_500 });
    expect(mat.materialName).toBe('Cement');
    expect(mat.unitCostKobo).toBe(3_500);
  });
});
