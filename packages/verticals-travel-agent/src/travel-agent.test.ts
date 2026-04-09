/**
 * packages/verticals-travel-agent — TravelAgentRepository tests
 * M9 Batch 2 acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TravelAgentRepository } from './travel-agent.js';
import {
  guardSeedToClaimed,
  guardClaimedToNantaVerified,
  isValidTravelAgentTransition,
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
  return { prepare: prep } as unknown as ConstructorParameters<typeof TravelAgentRepository>[0];
}

describe('TravelAgentRepository', () => {
  let repo: TravelAgentRepository;
  beforeEach(() => { repo = new TravelAgentRepository(makeDb() as never); });

  it('T001 — creates profile seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', agencyName: 'Chukwu Travels' });
    expect(p.status).toBe('seeded');
    expect(p.agencyName).toBe('Chukwu Travels');
  });

  it('T002 — finds by id (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', agencyName: 'X Travel' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.agencyName).toBe('X Travel');
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', agencyName: 'Y' });
    expect(await repo.findProfileById(p.id, 'evil')).toBeNull();
  });

  it('T004 — FSM seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', agencyName: 'Z' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T005 — isValidTravelAgentTransition seeded→claimed', () => {
    expect(isValidTravelAgentTransition('seeded', 'claimed')).toBe(true);
  });

  it('T006 — rejects seeded→nanta_verified', () => {
    expect(isValidTravelAgentTransition('seeded', 'nanta_verified')).toBe(false);
  });

  it('T007 — allows nanta_verified→active', () => {
    expect(isValidTravelAgentTransition('nanta_verified', 'active')).toBe(true);
  });

  it('T008 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T009 — guardClaimedToNantaVerified requires nantaNumber', () => {
    expect(guardClaimedToNantaVerified({ nantaNumber: null }).allowed).toBe(false);
    expect(guardClaimedToNantaVerified({ nantaNumber: 'NANTA-001' }).allowed).toBe(true);
  });

  it('T010 — creates travel package with integer pricePerPaxKobo (P9)', async () => {
    const pkg = await repo.createPackage({ workspaceId: 'ws1', tenantId: 'tn1', packageName: 'Dubai 7 Nights', destination: 'Dubai', type: 'holiday', durationDays: 7, pricePerPaxKobo: 750_000_000 });
    expect(pkg.pricePerPaxKobo).toBe(750_000_000);
    expect(pkg.type).toBe('holiday');
  });

  it('T011 — rejects float pricePerPaxKobo (P9)', async () => {
    await expect(repo.createPackage({ workspaceId: 'ws1', tenantId: 'tn1', packageName: 'X', destination: 'Y', type: 'domestic', pricePerPaxKobo: 500_000.5 })).rejects.toThrow('P9');
  });

  it('T012 — creates booking with integer amounts (P9)', async () => {
    const pkg = await repo.createPackage({ workspaceId: 'ws1', tenantId: 'tn1', packageName: 'Hajj 2025', destination: 'Mecca', type: 'hajj', pricePerPaxKobo: 2_500_000_000 });
    const b = await repo.createBooking({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '08030009999', packageId: pkg.id, travelDate: 1800000000, paxCount: 2, totalKobo: 5_000_000_000, depositKobo: 1_000_000_000, balanceKobo: 4_000_000_000 });
    expect(b.status).toBe('enquiry');
    expect(b.paxCount).toBe(2);
    expect(b.visaStatus).toBe('not_required');
  });

  it('T013 — rejects float totalKobo in booking (P9)', async () => {
    await expect(repo.createBooking({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', packageId: 'p1', travelDate: 1, totalKobo: 5_000_000.50, depositKobo: 0, balanceKobo: 0 })).rejects.toThrow('P9');
  });

  it('T014 — updates booking status to confirmed', async () => {
    const pkg = await repo.createPackage({ workspaceId: 'ws1', tenantId: 'tn1', packageName: 'Abuja Getaway', destination: 'Abuja', type: 'domestic', pricePerPaxKobo: 100_000_000 });
    const b = await repo.createBooking({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', packageId: pkg.id, travelDate: 1700000000, totalKobo: 100_000_000, depositKobo: 30_000_000, balanceKobo: 70_000_000 });
    expect((await repo.updateBookingStatus(b.id, 'tn1', 'confirmed'))!.status).toBe('confirmed');
  });

  it('T015 — updates visa status to approved', async () => {
    const pkg = await repo.createPackage({ workspaceId: 'ws1', tenantId: 'tn1', packageName: 'UK Tour', destination: 'London', type: 'holiday', pricePerPaxKobo: 1_200_000_000 });
    const b = await repo.createBooking({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '081', packageId: pkg.id, travelDate: 1900000000, totalKobo: 1_200_000_000, depositKobo: 300_000_000, balanceKobo: 900_000_000, visaStatus: 'applied' });
    expect(b.visaStatus).toBe('applied');
    const u = await repo.updateVisaStatus(b.id, 'tn1', 'approved');
    expect(u!.visaStatus).toBe('approved');
  });

  it('T016 — lists packages for workspace', async () => {
    await repo.createPackage({ workspaceId: 'ws3', tenantId: 'tn1', packageName: 'A', destination: 'X', type: 'corporate', pricePerPaxKobo: 200_000_000 });
    await repo.createPackage({ workspaceId: 'ws3', tenantId: 'tn1', packageName: 'B', destination: 'Y', type: 'umrah', pricePerPaxKobo: 300_000_000 });
    const pkgs = await repo.listPackages('ws3', 'tn1');
    expect(pkgs.length).toBe(2);
  });
});
