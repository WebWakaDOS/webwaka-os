/**
 * packages/verticals-airport-shuttle — AirportShuttleRepository tests
 * M12 Transport Extended — acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AirportShuttleRepository } from './airport-shuttle.js';
import {
  guardSeedToClaimed,
  guardClaimedToFaanVerified,
  isValidAirportShuttleTransition,
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
  return { prepare: prep } as unknown as ConstructorParameters<typeof AirportShuttleRepository>[0];
}

describe('AirportShuttleRepository', () => {
  let repo: AirportShuttleRepository;
  beforeEach(() => { repo = new AirportShuttleRepository(makeDb() as never); });

  it('creates a profile with seeded status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 't1', companyName: 'Lagos Airport Shuttle' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Lagos Airport Shuttle');
  });

  it('creates profile with FAAN permit', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws2', tenantId: 't1', companyName: 'FAAN Shuttle', faanPermit: 'FAAN-001', cacRc: 'RC123' });
    expect(p.faanPermit).toBe('FAAN-001');
    expect(p.cacRc).toBe('RC123');
  });

  it('finds profile by ID', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws3', tenantId: 't2', companyName: 'Abuja Shuttle' });
    const found = await repo.findProfileById(p.id, 't2');
    expect(found!.id).toBe(p.id);
  });

  it('finds profile by workspace', async () => {
    await repo.createProfile({ workspaceId: 'ws4', tenantId: 't3', companyName: 'PH Shuttle' });
    const found = await repo.findProfileByWorkspace('ws4', 't3');
    expect(found!.workspaceId).toBe('ws4');
  });

  it('returns null for unknown profile', async () => {
    expect(await repo.findProfileById('none', 't1')).toBeNull();
  });

  it('transitions profile status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws5', tenantId: 't1', companyName: 'FSM Shuttle' });
    const t = await repo.transitionStatus(p.id, 't1', 'claimed');
    expect(t!.status).toBe('claimed');
  });

  it('creates a vehicle', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws6', tenantId: 't1', companyName: 'Vehicle Co' });
    const v = await repo.createVehicle({ profileId: p.id, tenantId: 't1', vehiclePlate: 'LG123AB', type: 'SUV', capacity: 6 });
    expect(v.vehiclePlate).toBe('LG123AB');
    expect(v.type).toBe('SUV');
    expect(v.capacity).toBe(6);
  });

  it('creates a booking with valid fareKobo', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws7', tenantId: 't1', companyName: 'Booking Co' });
    const b = await repo.createBooking({ profileId: p.id, tenantId: 't1', fareKobo: 500000, pickupAirport: 'MMIA', destination: 'Victoria Island' });
    expect(b.fareKobo).toBe(500000);
    expect(b.status).toBe('booked');
    expect(b.pickupAirport).toBe('MMIA');
  });

  it('rejects booking with float fareKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws8', tenantId: 't1', companyName: 'Float Fare' });
    await expect(repo.createBooking({ profileId: p.id, tenantId: 't1', fareKobo: 500.5 })).rejects.toThrow('P9');
  });

  it('rejects booking with negative fareKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws9', tenantId: 't1', companyName: 'Neg Fare' });
    await expect(repo.createBooking({ profileId: p.id, tenantId: 't1', fareKobo: -1000 })).rejects.toThrow('P9');
  });

  it('lists bookings for profile', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws10', tenantId: 't1', companyName: 'List Co' });
    await repo.createBooking({ profileId: p.id, tenantId: 't1', fareKobo: 100000 });
    await repo.createBooking({ profileId: p.id, tenantId: 't1', fareKobo: 200000 });
    const list = await repo.listBookings(p.id, 't1');
    expect(list.length).toBe(2);
  });

  it('updates booking status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws11', tenantId: 't1', companyName: 'Update Shuttle' });
    const b = await repo.createBooking({ profileId: p.id, tenantId: 't1', fareKobo: 300000 });
    const updated = await repo.updateBookingStatus(b.id, 't1', 'confirmed');
    expect(updated!.status).toBe('confirmed');
  });

  it('FSM: valid transition seeded → claimed', () => {
    expect(isValidAirportShuttleTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: invalid transition seeded → active', () => {
    expect(isValidAirportShuttleTransition('seeded', 'active')).toBe(false);
  });

  it('FSM: valid transitions from suspended', () => {
    expect(isValidAirportShuttleTransition('suspended', 'active')).toBe(true);
  });

  it('guardSeedToClaimed: blocks KYC 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('guardClaimedToFaanVerified: blocks without FAAN permit', () => {
    expect(guardClaimedToFaanVerified({ faanPermit: null, kycTier: 2 }).allowed).toBe(false);
  });

  it('guardClaimedToFaanVerified: allows with FAAN permit at Tier 2', () => {
    expect(guardClaimedToFaanVerified({ faanPermit: 'FAAN-001', kycTier: 2 }).allowed).toBe(true);
  });
});
