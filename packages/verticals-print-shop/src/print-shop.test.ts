/**
 * packages/verticals-print-shop — PrintShopRepository tests
 * M9 Batch 2 acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrintShopRepository } from './print-shop.js';
import {
  guardSeedToClaimed,
  guardClaimedToCacVerified,
  isValidPrintShopTransition,
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
  return { prepare: prep } as unknown as ConstructorParameters<typeof PrintShopRepository>[0];
}

describe('PrintShopRepository', () => {
  let repo: PrintShopRepository;
  beforeEach(() => { repo = new PrintShopRepository(makeDb() as never); });

  it('T001 — creates profile with status seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'Remi Prints' });
    expect(p.status).toBe('seeded');
    expect(p.shopName).toBe('Remi Prints');
  });

  it('T002 — finds profile by id (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'X Prints' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.shopName).toBe('X Prints');
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'Y' });
    expect(await repo.findProfileById(p.id, 'tn-other')).toBeNull();
  });

  it('T004 — sonRegistered defaults to false', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'Z' });
    expect(p.sonRegistered).toBe(false);
  });

  it('T005 — FSM seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', shopName: 'A' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T006 — isValidPrintShopTransition seeded→claimed', () => {
    expect(isValidPrintShopTransition('seeded', 'claimed')).toBe(true);
  });

  it('T007 — isValidPrintShopTransition rejects seeded→active', () => {
    expect(isValidPrintShopTransition('seeded', 'active')).toBe(false);
  });

  it('T008 — isValidPrintShopTransition cac_verified→active', () => {
    expect(isValidPrintShopTransition('cac_verified', 'active')).toBe(true);
  });

  it('T009 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T010 — guardSeedToClaimed passes Tier 1', () => {
    expect(guardSeedToClaimed({ kycTier: 1 }).allowed).toBe(true);
  });

  it('T011 — guardClaimedToCacVerified requires cacNumber', () => {
    expect(guardClaimedToCacVerified({ cacNumber: null }).allowed).toBe(false);
    expect(guardClaimedToCacVerified({ cacNumber: 'RC-123456' }).allowed).toBe(true);
  });

  it('T012 — creates print job with integer prices (P9)', async () => {
    const job = await repo.createJob({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '08030001111', jobType: 'flyer', quantity: 1000, unitPriceKobo: 500, totalKobo: 500_000 });
    expect(job.totalKobo).toBe(500_000);
    expect(job.status).toBe('received');
  });

  it('T013 — rejects float unitPriceKobo (P9)', async () => {
    await expect(repo.createJob({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', jobType: 'banner', unitPriceKobo: 1.5, totalKobo: 1500 })).rejects.toThrow('P9');
  });

  it('T014 — updates job status to printing', async () => {
    const job = await repo.createJob({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', jobType: 'brochure', quantity: 50, unitPriceKobo: 2_000, totalKobo: 100_000 });
    const updated = await repo.updateJobStatus(job.id, 'tn1', 'printing');
    expect(updated!.status).toBe('printing');
  });

  it('T015 — creates paper stock with integer unitCostKobo (P9)', async () => {
    const stock = await repo.createStock({ workspaceId: 'ws1', tenantId: 'tn1', paperType: 'Glossy Art Paper', gsm: 150, sheetSize: 'A4', quantityInStock: 500, unitCostKobo: 8_000 });
    expect(stock.paperType).toBe('Glossy Art Paper');
    expect(stock.unitCostKobo).toBe(8_000);
  });

  it('T016 — rejects float unitCostKobo in stock (P9)', async () => {
    await expect(repo.createStock({ workspaceId: 'ws1', tenantId: 'tn1', paperType: 'Bond', unitCostKobo: 7.99 })).rejects.toThrow('P9');
  });

  it('T017 — lists jobs for workspace (T3)', async () => {
    await repo.createJob({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', jobType: 'signage', unitPriceKobo: 10_000, totalKobo: 10_000 });
    await repo.createJob({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '081', jobType: 'packaging', unitPriceKobo: 5_000, totalKobo: 5_000 });
    const jobs = await repo.listJobs('ws1', 'tn1');
    expect(jobs.length).toBe(2);
  });
});
