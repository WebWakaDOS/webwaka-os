/**
 * packages/verticals-tailor — TailorRepository tests
 * M10 Batch 2 acceptance: ≥15 tests.
 * Measurements stored as integer cm×10; P13: never passed to AI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TailorRepository } from './tailor.js';
import {
  guardSeedToClaimed,
  isValidTailorTransition,
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
              ? (r['workspace_id'] === vals[0] || r['client_id'] === vals[0]) && r['tenant_id'] === vals[1]
              : true
          ),
        } as { results: T[] };
      },
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof TailorRepository>[0];
}

describe('TailorRepository', () => {
  let repo: TailorRepository;
  beforeEach(() => { repo = new TailorRepository(makeDb() as never); });

  it('T001 — creates tailor profile seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', businessName: 'Taiwo Styles', type: 'bespoke' });
    expect(p.status).toBe('seeded');
    expect(p.businessName).toBe('Taiwo Styles');
  });

  it('T002 — finds by id (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', businessName: 'X Tailor' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.id).toBe(p.id);
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', businessName: 'Y' });
    expect(await repo.findProfileById(p.id, 'evil')).toBeNull();
  });

  it('T004 — type defaults to all when not specified', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', businessName: 'Z Tailor' });
    expect(p.type).toBe('all');
  });

  it('T005 — FSM seeded→claimed (3-state)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', businessName: 'A' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T006 — FSM claimed→active (3-state)', () => {
    expect(isValidTailorTransition('claimed', 'active')).toBe(true);
  });

  it('T007 — no coren_verified state in tailor (3-state only)', () => {
    expect(isValidTailorTransition('seeded', 'active')).toBe(false);
  });

  it('T008 — allows active→suspended', () => {
    expect(isValidTailorTransition('active', 'suspended')).toBe(true);
  });

  it('T009 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T010 — guardSeedToClaimed allows Tier 1', () => {
    expect(guardSeedToClaimed({ kycTier: 1 }).allowed).toBe(true);
  });

  it('T011 — creates client with measurements (integer cm×10)', async () => {
    const c = await repo.createClient({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '08030007777', measurements: { bust: 960, waist: 760, hip: 1000 } });
    expect(c.clientPhone).toBe('08030007777');
    expect(c.measurements.bust).toBe(960);
  });

  it('T012 — creates tailor order with integer prices (P9)', async () => {
    const c = await repo.createClient({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '08030008888' });
    const o = await repo.createOrder({ clientId: c.id, workspaceId: 'ws1', tenantId: 'tn1', styleDescription: 'Ankara Senator', priceKobo: 25_000_000, depositKobo: 10_000_000, balanceKobo: 15_000_000 });
    expect(o.priceKobo).toBe(25_000_000);
    expect(o.status).toBe('intake');
  });

  it('T013 — rejects float priceKobo in order (P9)', async () => {
    await expect(repo.createOrder({ clientId: 'c1', workspaceId: 'ws1', tenantId: 'tn1', styleDescription: 'X', priceKobo: 5_000.5, depositKobo: 0, balanceKobo: 0 })).rejects.toThrow('P9');
  });

  it('T014 — updates order status to sewing', async () => {
    const c = await repo.createClient({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080' });
    const o = await repo.createOrder({ clientId: c.id, workspaceId: 'ws1', tenantId: 'tn1', styleDescription: 'Agbada', priceKobo: 50_000_000, depositKobo: 20_000_000, balanceKobo: 30_000_000 });
    expect((await repo.updateOrderStatus(o.id, 'tn1', 'sewing'))!.status).toBe('sewing');
  });

  it('T015 — creates fabric stock with integer costPerMetreKobo (P9)', async () => {
    const f = await repo.createFabricStock({ workspaceId: 'ws1', tenantId: 'tn1', fabricName: 'Ankara', colour: 'Blue', metresAvailableCm: 2000, costPerMetreKobo: 3_500_000 });
    expect(f.fabricName).toBe('Ankara');
    expect(f.costPerMetreKobo).toBe(3_500_000);
    expect(f.metresAvailableCm).toBe(2000);
  });

  it('T016 — rejects float costPerMetreKobo (P9)', async () => {
    await expect(repo.createFabricStock({ workspaceId: 'ws1', tenantId: 'tn1', fabricName: 'Lace', costPerMetreKobo: 7_500.75 })).rejects.toThrow('P9');
  });

  it('T017 — measurements default to empty object', async () => {
    const c = await repo.createClient({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '09011112222' });
    expect(c.measurements).toEqual({});
  });
});
