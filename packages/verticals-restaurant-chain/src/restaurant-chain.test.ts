/**
 * packages/verticals-restaurant-chain — RestaurantChainRepository tests
 * M9 Batch 2 acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RestaurantChainRepository } from './restaurant-chain.js';
import {
  guardSeedToClaimed,
  guardClaimedToNafdacVerified,
  isValidRestaurantChainTransition,
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
              ? (r['workspace_id'] === vals[0] || r['brand_id'] === vals[0] || r['outlet_id'] === vals[0]) && r['tenant_id'] === vals[1]
              : true
          ),
        } as { results: T[] };
      },
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof RestaurantChainRepository>[0];
}

describe('RestaurantChainRepository', () => {
  let repo: RestaurantChainRepository;
  beforeEach(() => { repo = new RestaurantChainRepository(makeDb() as never); });

  it('T001 — creates chain profile seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', brandName: 'Chicken Republic Nigeria' });
    expect(p.status).toBe('seeded');
    expect(p.brandName).toBe('Chicken Republic Nigeria');
  });

  it('T002 — finds by id (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', brandName: 'SR' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.brandName).toBe('SR');
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', brandName: 'X' });
    expect(await repo.findProfileById(p.id, 'evil')).toBeNull();
  });

  it('T004 — FSM seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', brandName: 'Y' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T005 — isValidRestaurantChainTransition seeded→claimed', () => {
    expect(isValidRestaurantChainTransition('seeded', 'claimed')).toBe(true);
  });

  it('T006 — rejects seeded→active', () => {
    expect(isValidRestaurantChainTransition('seeded', 'active')).toBe(false);
  });

  it('T007 — allows nafdac_verified→active', () => {
    expect(isValidRestaurantChainTransition('nafdac_verified', 'active')).toBe(true);
  });

  it('T008 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T009 — guardClaimedToNafdacVerified requires nafdacNumber', () => {
    expect(guardClaimedToNafdacVerified({ nafdacNumber: null }).allowed).toBe(false);
    expect(guardClaimedToNafdacVerified({ nafdacNumber: 'NAFDAC-001' }).allowed).toBe(true);
  });

  it('T010 — creates outlet', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', brandName: 'Z Brand' });
    const o = await repo.createOutlet({ brandId: p.id, workspaceId: 'ws1', tenantId: 'tn1', outletName: 'Ikeja Branch', state: 'Lagos', lga: 'Ikeja' });
    expect(o.outletName).toBe('Ikeja Branch');
    expect(o.brandId).toBe(p.id);
  });

  it('T011 — creates menu item with integer priceKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', brandName: 'A' });
    const o = await repo.createOutlet({ brandId: p.id, workspaceId: 'ws1', tenantId: 'tn1', outletName: 'Branch 1' });
    const item = await repo.createMenuItem({ outletId: o.id, workspaceId: 'ws1', tenantId: 'tn1', itemName: 'Jollof Rice', category: 'main', priceKobo: 3_500 });
    expect(item.priceKobo).toBe(3_500);
    expect(item.available).toBe(true);
  });

  it('T012 — rejects float priceKobo in menu item (P9)', async () => {
    await expect(repo.createMenuItem({ outletId: 'o1', workspaceId: 'ws1', tenantId: 'tn1', itemName: 'Suya', priceKobo: 2_500.5 })).rejects.toThrow('P9');
  });

  it('T013 — creates order with integer totalKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', brandName: 'B' });
    const o = await repo.createOutlet({ brandId: p.id, workspaceId: 'ws1', tenantId: 'tn1', outletName: 'B1' });
    const order = await repo.createOrder({ outletId: o.id, workspaceId: 'ws1', tenantId: 'tn1', orderType: 'dine_in', totalKobo: 12_500, tableNumber: 'T3' });
    expect(order.status).toBe('placed');
    expect(order.tableNumber).toBe('T3');
  });

  it('T014 — rejects float totalKobo in order (P9)', async () => {
    await expect(repo.createOrder({ outletId: 'o1', workspaceId: 'ws1', tenantId: 'tn1', orderType: 'takeaway', totalKobo: 10.5 })).rejects.toThrow('P9');
  });

  it('T015 — updates order status to kitchen', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', brandName: 'C' });
    const o = await repo.createOutlet({ brandId: p.id, workspaceId: 'ws1', tenantId: 'tn1', outletName: 'C1' });
    const order = await repo.createOrder({ outletId: o.id, workspaceId: 'ws1', tenantId: 'tn1', orderType: 'delivery', totalKobo: 7_000 });
    expect((await repo.updateOrderStatus(order.id, 'tn1', 'kitchen'))!.status).toBe('kitchen');
  });

  it('T016 — outletCount defaults to 1', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', brandName: 'D' });
    expect(p.outletCount).toBe(1);
  });
});
