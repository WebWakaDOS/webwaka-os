/**
 * packages/verticals-real-estate-agency — RealEstateAgencyRepository tests
 * M9 Batch 2 acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RealEstateAgencyRepository } from './real-estate-agency.js';
import {
  guardSeedToClaimed,
  guardClaimedToNiesvVerified,
  isValidRealEstateAgencyTransition,
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
              ? (r['workspace_id'] === vals[0] || r['listing_id'] === vals[0]) && r['tenant_id'] === vals[1]
              : true
          ),
        } as { results: T[] };
      },
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof RealEstateAgencyRepository>[0];
}

describe('RealEstateAgencyRepository', () => {
  let repo: RealEstateAgencyRepository;
  beforeEach(() => { repo = new RealEstateAgencyRepository(makeDb() as never); });

  it('T001 — creates profile seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', agencyName: 'Kemi Properties' });
    expect(p.status).toBe('seeded');
    expect(p.agencyName).toBe('Kemi Properties');
  });

  it('T002 — finds by id (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', agencyName: 'G Homes' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.agencyName).toBe('G Homes');
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', agencyName: 'X' });
    expect(await repo.findProfileById(p.id, 'other')).toBeNull();
  });

  it('T004 — FSM seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', agencyName: 'A' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T005 — isValidRealEstateAgencyTransition seeded→claimed', () => {
    expect(isValidRealEstateAgencyTransition('seeded', 'claimed')).toBe(true);
  });

  it('T006 — rejects seeded→niesv_verified', () => {
    expect(isValidRealEstateAgencyTransition('seeded', 'niesv_verified')).toBe(false);
  });

  it('T007 — allows niesv_verified→active', () => {
    expect(isValidRealEstateAgencyTransition('niesv_verified', 'active')).toBe(true);
  });

  it('T008 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T009 — guardClaimedToNiesvVerified requires both credentials', () => {
    expect(guardClaimedToNiesvVerified({ niesvNumber: null, esvarbonNumber: 'E1' }).allowed).toBe(false);
    expect(guardClaimedToNiesvVerified({ niesvNumber: 'N1', esvarbonNumber: null }).allowed).toBe(false);
    expect(guardClaimedToNiesvVerified({ niesvNumber: 'N1', esvarbonNumber: 'E1' }).allowed).toBe(true);
  });

  it('T010 — creates listing with priceKobo (P9)', async () => {
    const l = await repo.createListing({ workspaceId: 'ws1', tenantId: 'tn1', title: '3 Bedroom Flat Lekki', type: 'flat', transactionType: 'sale', priceKobo: 5_000_000_000 });
    expect(l.priceKobo).toBe(5_000_000_000);
    expect(l.status).toBe('available');
  });

  it('T011 — rejects float priceKobo in listing (P9)', async () => {
    await expect(repo.createListing({ workspaceId: 'ws1', tenantId: 'tn1', title: 'X', type: 'land', transactionType: 'rent', priceKobo: 1_000_000.5 })).rejects.toThrow('P9');
  });

  it('T012 — updates listing status to under_offer', async () => {
    const l = await repo.createListing({ workspaceId: 'ws1', tenantId: 'tn1', title: 'Y', type: 'duplex', transactionType: 'sale', priceKobo: 10_000_000_000 });
    const u = await repo.updateListingStatus(l.id, 'tn1', 'under_offer');
    expect(u!.status).toBe('under_offer');
  });

  it('T013 — creates enquiry', async () => {
    const l = await repo.createListing({ workspaceId: 'ws1', tenantId: 'tn1', title: 'Z', type: 'commercial', transactionType: 'rent', priceKobo: 500_000_000 });
    const e = await repo.createEnquiry({ listingId: l.id, workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '08030004444', clientName: 'Chukwu', enquiryType: 'viewing' });
    expect(e.status).toBe('new');
    expect(e.enquiryType).toBe('viewing');
  });

  it('T014 — creates commission with auto-calculated commissionKobo', async () => {
    const l = await repo.createListing({ workspaceId: 'ws1', tenantId: 'tn1', title: 'C1', type: 'flat', transactionType: 'sale', priceKobo: 1_000_000_000 });
    const c = await repo.createCommission({ listingId: l.id, workspaceId: 'ws1', tenantId: 'tn1', transactionType: 'sale', grossValueKobo: 1_000_000_000, commissionRatePct: 5 });
    expect(c.commissionKobo).toBe(50_000_000);
    expect(c.status).toBe('pending');
  });

  it('T015 — rejects float grossValueKobo in commission (P9)', async () => {
    await expect(repo.createCommission({ listingId: 'l1', workspaceId: 'ws1', tenantId: 'tn1', transactionType: 'rent', grossValueKobo: 500_000.75, commissionRatePct: 10 })).rejects.toThrow('P9');
  });

  it('T016 — updates commission status to received', async () => {
    const l = await repo.createListing({ workspaceId: 'ws1', tenantId: 'tn1', title: 'D1', type: 'flat', transactionType: 'sale', priceKobo: 200_000_000 });
    const c = await repo.createCommission({ listingId: l.id, workspaceId: 'ws1', tenantId: 'tn1', transactionType: 'sale', grossValueKobo: 200_000_000, commissionRatePct: 5 });
    const updated = await repo.updateCommissionStatus(c.id, 'tn1', 'received');
    expect(updated!.status).toBe('received');
  });
});
