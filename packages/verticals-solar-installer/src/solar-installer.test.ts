/**
 * packages/verticals-solar-installer — SolarInstallerRepository tests
 * M9 Batch 2 acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SolarInstallerRepository } from './solar-installer.js';
import {
  guardSeedToClaimed,
  guardClaimedToNercVerified,
  isValidSolarInstallerTransition,
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
              ? (r['workspace_id'] === vals[0] || r['project_id'] === vals[0]) && r['tenant_id'] === vals[1]
              : true
          ),
        } as { results: T[] };
      },
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof SolarInstallerRepository>[0];
}

describe('SolarInstallerRepository', () => {
  let repo: SolarInstallerRepository;
  beforeEach(() => { repo = new SolarInstallerRepository(makeDb() as never); });

  it('T001 — creates profile seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Sun Power NG' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Sun Power NG');
  });

  it('T002 — finds by id (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'X Solar' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.id).toBe(p.id);
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Y' });
    expect(await repo.findProfileById(p.id, 'other')).toBeNull();
  });

  it('T004 — FSM seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Z' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T005 — isValidSolarInstallerTransition seeded→claimed', () => {
    expect(isValidSolarInstallerTransition('seeded', 'claimed')).toBe(true);
  });

  it('T006 — rejects seeded→nerc_verified', () => {
    expect(isValidSolarInstallerTransition('seeded', 'nerc_verified')).toBe(false);
  });

  it('T007 — allows nerc_verified→active', () => {
    expect(isValidSolarInstallerTransition('nerc_verified', 'active')).toBe(true);
  });

  it('T008 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T009 — guardClaimedToNercVerified requires both credentials', () => {
    expect(guardClaimedToNercVerified({ nercRegistration: null, nemsaCert: 'NC1' }).allowed).toBe(false);
    expect(guardClaimedToNercVerified({ nercRegistration: 'NR1', nemsaCert: null }).allowed).toBe(false);
    expect(guardClaimedToNercVerified({ nercRegistration: 'NR1', nemsaCert: 'NC1' }).allowed).toBe(true);
  });

  it('T010 — creates project with integer watts and kobo (P9)', async () => {
    const proj = await repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '08030002222', systemSizeWatts: 5000, panelCount: 10, batteryCapacityWh: 10000, totalCostKobo: 3_000_000_000 });
    expect(proj.systemSizeWatts).toBe(5000);
    expect(proj.totalCostKobo).toBe(3_000_000_000);
    expect(proj.status).toBe('survey');
  });

  it('T011 — rejects float systemSizeWatts', async () => {
    await expect(repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', systemSizeWatts: 5000.5, totalCostKobo: 1_000_000 })).rejects.toThrow('integer');
  });

  it('T012 — rejects float totalCostKobo (P9)', async () => {
    await expect(repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', systemSizeWatts: 3000, totalCostKobo: 1_000_000.50 })).rejects.toThrow('P9');
  });

  it('T013 — updates project status to installation', async () => {
    const proj = await repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', systemSizeWatts: 2000, totalCostKobo: 800_000_000 });
    const u = await repo.updateProjectStatus(proj.id, 'tn1', 'installation');
    expect(u!.status).toBe('installation');
  });

  it('T014 — creates solar component (panel)', async () => {
    const proj = await repo.createProject({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', systemSizeWatts: 1000, totalCostKobo: 500_000_000 });
    const comp = await repo.createComponent({ projectId: proj.id, workspaceId: 'ws1', tenantId: 'tn1', componentType: 'panel', brand: 'JA Solar', quantity: 4, unitCostKobo: 55_000_000 });
    expect(comp.componentType).toBe('panel');
    expect(comp.quantity).toBe(4);
  });

  it('T015 — rejects float unitCostKobo in component (P9)', async () => {
    await expect(repo.createComponent({ projectId: 'p1', workspaceId: 'ws1', tenantId: 'tn1', componentType: 'inverter', unitCostKobo: 100.5 })).rejects.toThrow('P9');
  });

  it('T016 — lists projects for workspace', async () => {
    await repo.createProject({ workspaceId: 'ws2', tenantId: 'tn1', clientPhone: '080', systemSizeWatts: 1000, totalCostKobo: 200_000_000 });
    await repo.createProject({ workspaceId: 'ws2', tenantId: 'tn1', clientPhone: '081', systemSizeWatts: 2000, totalCostKobo: 400_000_000 });
    const projs = await repo.listProjects('ws2', 'tn1');
    expect(projs.length).toBe(2);
  });
});
