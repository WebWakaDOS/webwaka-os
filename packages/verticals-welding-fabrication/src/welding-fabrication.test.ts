/**
 * packages/verticals-welding-fabrication — WeldingFabricationRepository tests
 * M10 Batch 2 acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WeldingFabricationRepository } from './welding-fabrication.js';
import {
  guardSeedToClaimed,
  isValidWeldingTransition,
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
              ? (r['workspace_id'] === vals[0]) && r['tenant_id'] === vals[1]
              : true
          ),
        } as { results: T[] };
      },
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof WeldingFabricationRepository>[0];
}

describe('WeldingFabricationRepository', () => {
  let repo: WeldingFabricationRepository;
  beforeEach(() => { repo = new WeldingFabricationRepository(makeDb() as never); });

  it('T001 — creates shop profile seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'Dayo Welds', speciality: 'gate' });
    expect(p.status).toBe('seeded');
    expect(p.shopName).toBe('Dayo Welds');
    expect(p.speciality).toBe('gate');
  });

  it('T002 — finds by id (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'X Welds' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.id).toBe(p.id);
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'Y' });
    expect(await repo.findProfileById(p.id, 'evil')).toBeNull();
  });

  it('T004 — speciality defaults to general', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'Z Welds' });
    expect(p.speciality).toBe('general');
  });

  it('T005 — FSM seeded→claimed (3-state)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'A' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T006 — FSM claimed→active (3-state)', () => {
    expect(isValidWeldingTransition('claimed', 'active')).toBe(true);
  });

  it('T007 — no intermediate state: seeded→active blocked', () => {
    expect(isValidWeldingTransition('seeded', 'active')).toBe(false);
  });

  it('T008 — allows active→suspended', () => {
    expect(isValidWeldingTransition('active', 'suspended')).toBe(true);
  });

  it('T009 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T010 — guardSeedToClaimed passes Tier 1', () => {
    expect(guardSeedToClaimed({ kycTier: 1 }).allowed).toBe(true);
  });

  it('T011 — creates welding job with integer kobo amounts (P9)', async () => {
    const j = await repo.createJob({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '08030001010', description: 'Compound gate 4m wide', materialCostKobo: 50_000_000, labourCostKobo: 20_000_000, totalKobo: 70_000_000 });
    expect(j.totalKobo).toBe(70_000_000);
    expect(j.status).toBe('quoted');
  });

  it('T012 — rejects float materialCostKobo (P9)', async () => {
    await expect(repo.createJob({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', description: 'X', materialCostKobo: 1_000.5, labourCostKobo: 1_000, totalKobo: 2_000 })).rejects.toThrow('P9');
  });

  it('T013 — rejects float totalKobo (P9)', async () => {
    await expect(repo.createJob({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', description: 'Y', materialCostKobo: 1_000, labourCostKobo: 1_000, totalKobo: 2_000.5 })).rejects.toThrow('P9');
  });

  it('T014 — updates job status to in_progress', async () => {
    const j = await repo.createJob({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', description: 'Z', materialCostKobo: 30_000_000, labourCostKobo: 15_000_000, totalKobo: 45_000_000 });
    expect((await repo.updateJobStatus(j.id, 'tn1', 'in_progress'))!.status).toBe('in_progress');
  });

  it('T015 — creates welding material with integer unitCostKobo (P9)', async () => {
    const m = await repo.createMaterial({ workspaceId: 'ws1', tenantId: 'tn1', materialName: 'Mild Steel Bar 12mm', unit: 'kg', quantityInStock: 500, unitCostKobo: 120_000 });
    expect(m.materialName).toBe('Mild Steel Bar 12mm');
    expect(m.unit).toBe('kg');
    expect(m.unitCostKobo).toBe(120_000);
  });

  it('T016 — rejects float unitCostKobo in material (P9)', async () => {
    await expect(repo.createMaterial({ workspaceId: 'ws1', tenantId: 'tn1', materialName: 'Sheet', unit: 'sheet', unitCostKobo: 500.5 })).rejects.toThrow('P9');
  });

  it('T017 — lists jobs for workspace', async () => {
    await repo.createJob({ workspaceId: 'ws4', tenantId: 'tn1', clientPhone: '080', description: 'A', materialCostKobo: 10_000, labourCostKobo: 5_000, totalKobo: 15_000 });
    await repo.createJob({ workspaceId: 'ws4', tenantId: 'tn1', clientPhone: '081', description: 'B', materialCostKobo: 20_000, labourCostKobo: 8_000, totalKobo: 28_000 });
    const jobs = await repo.listJobs('ws4', 'tn1');
    expect(jobs.length).toBe(2);
  });
});
