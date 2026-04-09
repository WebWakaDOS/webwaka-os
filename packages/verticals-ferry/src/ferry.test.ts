/**
 * packages/verticals-ferry — FerryRepository tests
 * M12 Transport Extended — acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FerryRepository } from './ferry.js';
import {
  guardSeedToClaimed,
  guardClaimedToNimasaVerified,
  isValidFerryTransition,
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
              else if (tok.toLowerCase().includes('unixepoch')) { row[col] = Math.floor(Date.now() / 1000); }
              else if (tok.startsWith("'") && tok.endsWith("'")) { row[col] = tok.slice(1, -1); }
              else if (!Number.isNaN(Number(tok))) { row[col] = Number(tok); }
              else { row[col] = vals[bi++]; }
            });
            if (!row['status']) row['status'] = 'seeded';
            if (!row['created_at']) row['created_at'] = Math.floor(Date.now() / 1000);
            if (!row['updated_at']) row['updated_at'] = Math.floor(Date.now() / 1000);
            store.push(row);
          }
        } else if (sql.trim().toUpperCase().startsWith('UPDATE')) {
          const setM = sql.match(/SET\s+(.+?)\s+WHERE/is);
          if (setM) {
            const clauses = setM[1]!.split(',').map((c: string) => c.trim()).filter((c: string) => !c.toLowerCase().includes('updated_at') && !c.toLowerCase().includes('unixepoch'));
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
          vals.length >= 2 ? (r['id'] === vals[0] || r['workspace_id'] === vals[0]) && r['tenant_id'] === vals[1] : r['id'] === vals[0]
        );
        return (found ?? null) as T;
      },
      all: async <T>() => ({
        results: store.filter(r =>
          vals.length >= 2
            ? (r['profile_id'] === vals[0]) && r['tenant_id'] === vals[1]
            : true
        ),
      } as { results: T[] }),
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof FerryRepository>[0];
}

describe('FerryRepository', () => {
  let repo: FerryRepository;
  beforeEach(() => { repo = new FerryRepository(makeDb() as never); });

  it('creates a profile with seeded status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 't1', companyName: 'Lagos Ferry Lines' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Lagos Ferry Lines');
  });

  it('creates profile with NIMASA licence', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws2', tenantId: 't1', companyName: 'NIMASA Ferry', nimasaLicence: 'NIMASA-001', nrcCompliance: true });
    expect(p.nimasaLicence).toBe('NIMASA-001');
    expect(p.nrcCompliance).toBe(true);
  });

  it('finds profile by ID', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws3', tenantId: 't2', companyName: 'Delta Ferry' });
    expect((await repo.findProfileById(p.id, 't2'))!.id).toBe(p.id);
  });

  it('finds profile by workspace', async () => {
    await repo.createProfile({ workspaceId: 'ws4', tenantId: 't3', companyName: 'Bayelsa Ferry' });
    expect((await repo.findProfileByWorkspace('ws4', 't3'))!.workspaceId).toBe('ws4');
  });

  it('returns null for unknown profile', async () => {
    expect(await repo.findProfileById('none', 't1')).toBeNull();
  });

  it('transitions profile status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws5', tenantId: 't1', companyName: 'FSM Ferry' });
    const t = await repo.transitionStatus(p.id, 't1', 'claimed');
    expect(t!.status).toBe('claimed');
  });

  it('creates a vessel with NIMASA registration', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws6', tenantId: 't1', companyName: 'Vessel Co' });
    const v = await repo.createVessel({ profileId: p.id, tenantId: 't1', vesselName: 'MV Lagos Queen', capacityPassengers: 120, nimasaReg: 'NIM-2024-001', routeDescription: 'CMS to Badagry' });
    expect(v.vesselName).toBe('MV Lagos Queen');
    expect(v.capacityPassengers).toBe(120);
    expect(v.nimasaReg).toBe('NIM-2024-001');
  });

  it('rejects vessel with float capacityPassengers (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws7', tenantId: 't1', companyName: 'Float Cap' });
    await expect(repo.createVessel({ profileId: p.id, tenantId: 't1', vesselName: 'Bad Vessel', capacityPassengers: 120.5 })).rejects.toThrow('P9');
  });

  it('creates a trip with valid P9 kobo values', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws8', tenantId: 't1', companyName: 'Trip Ferry' });
    const v = await repo.createVessel({ profileId: p.id, tenantId: 't1', vesselName: 'MV River King', capacityPassengers: 80 });
    const trip = await repo.createTrip({ vesselId: v.id, profileId: p.id, tenantId: 't1', route: 'CMS-Ikorodu', passengerCount: 75, ticketPriceKobo: 50000, totalRevenueKobo: 3750000 });
    expect(trip.passengerCount).toBe(75);
    expect(trip.totalRevenueKobo).toBe(3750000);
    expect(trip.status).toBe('scheduled');
  });

  it('rejects trip with float ticketPriceKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws9', tenantId: 't1', companyName: 'Float Ticket' });
    const v = await repo.createVessel({ profileId: p.id, tenantId: 't1', vesselName: 'MV Error', capacityPassengers: 50 });
    await expect(repo.createTrip({ vesselId: v.id, profileId: p.id, tenantId: 't1', passengerCount: 10, ticketPriceKobo: 500.5, totalRevenueKobo: 5000 })).rejects.toThrow('P9');
  });

  it('updates trip status to arrived', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws10', tenantId: 't1', companyName: 'Arrive Ferry' });
    const v = await repo.createVessel({ profileId: p.id, tenantId: 't1', vesselName: 'MV Arrive', capacityPassengers: 60 });
    const trip = await repo.createTrip({ vesselId: v.id, profileId: p.id, tenantId: 't1', passengerCount: 50, ticketPriceKobo: 30000, totalRevenueKobo: 1500000 });
    const updated = await repo.updateTripStatus(trip.id, 't1', 'arrived', Math.floor(Date.now() / 1000));
    expect(updated!.status).toBe('arrived');
    expect(updated!.arrivalTime).not.toBeNull();
  });

  it('lists trips for profile', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws11', tenantId: 't1', companyName: 'List Ferry' });
    const v = await repo.createVessel({ profileId: p.id, tenantId: 't1', vesselName: 'MV List', capacityPassengers: 40 });
    await repo.createTrip({ vesselId: v.id, profileId: p.id, tenantId: 't1', passengerCount: 20, ticketPriceKobo: 20000, totalRevenueKobo: 400000 });
    await repo.createTrip({ vesselId: v.id, profileId: p.id, tenantId: 't1', passengerCount: 30, ticketPriceKobo: 20000, totalRevenueKobo: 600000 });
    const list = await repo.listTrips(p.id, 't1');
    expect(list.length).toBe(2);
  });

  it('FSM: valid transition seeded → claimed', () => {
    expect(isValidFerryTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: invalid transition claimed → active', () => {
    expect(isValidFerryTransition('claimed', 'active')).toBe(false);
  });

  it('guardSeedToClaimed: blocks KYC 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('guardClaimedToNimasaVerified: blocks without NIMASA licence', () => {
    expect(guardClaimedToNimasaVerified({ nimasaLicence: null, kycTier: 2 }).allowed).toBe(false);
  });

  it('guardClaimedToNimasaVerified: allows with NIMASA licence at Tier 2', () => {
    expect(guardClaimedToNimasaVerified({ nimasaLicence: 'NIM-001', kycTier: 2 }).allowed).toBe(true);
  });
});
