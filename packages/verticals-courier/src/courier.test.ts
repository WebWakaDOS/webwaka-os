/**
 * packages/verticals-courier — CourierRepository tests
 * M9 Transport Extended — acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CourierRepository } from './courier.js';
import {
  guardSeedToClaimed,
  guardClaimedToCacVerified,
  isValidCourierTransition,
} from './types.js';

function makeDb() {
  const store: Record<string, unknown>[] = [];
  const prep = (sql: string) => {
    const bindFn = (...vals: unknown[]) => ({
      run: async () => {
        const s = sql.trim().toUpperCase();
        if (s.startsWith('INSERT')) {
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
        } else if (s.startsWith('UPDATE')) {
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
              (store[idx] as Record<string, unknown>)['updated_at'] = Math.floor(Date.now() / 1000);
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
            ? (r['profile_id'] === vals[0] || r['parcel_id'] === vals[0]) && r['tenant_id'] === vals[1]
            : true
        ),
      } as { results: T[] }),
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof CourierRepository>[0];
}

describe('CourierRepository', () => {
  let repo: CourierRepository;
  beforeEach(() => { repo = new CourierRepository(makeDb() as never); });

  it('creates a profile with seeded status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 't1', companyName: 'Swift Couriers' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Swift Couriers');
  });

  it('creates profile with NCC registration flag', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws2', tenantId: 't1', companyName: 'NCC Couriers', nccRegistered: true, cacRc: 'RC1234' });
    expect(p.nccRegistered).toBe(true);
    expect(p.cacRc).toBe('RC1234');
  });

  it('finds profile by ID', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws3', tenantId: 't2', companyName: 'Abuja Riders' });
    const found = await repo.findProfileById(p.id, 't2');
    expect(found).not.toBeNull();
  });

  it('finds profile by workspace', async () => {
    await repo.createProfile({ workspaceId: 'ws4', tenantId: 't3', companyName: 'Kano Couriers' });
    const found = await repo.findProfileByWorkspace('ws4', 't3');
    expect(found!.workspaceId).toBe('ws4');
  });

  it('returns null for unknown profile', async () => {
    expect(await repo.findProfileById('noexist', 't1')).toBeNull();
  });

  it('transitions profile status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws5', tenantId: 't1', companyName: 'Transit Co' });
    const t = await repo.transitionStatus(p.id, 't1', 'claimed');
    expect(t!.status).toBe('claimed');
  });

  it('creates rider and lists riders', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws6', tenantId: 't1', companyName: 'Rider Co' });
    await repo.createRider({ profileId: p.id, tenantId: 't1', riderName: 'Emeka', vehicleType: 'motorcycle' });
    const riders = await repo.listRiders(p.id, 't1');
    expect(riders.length).toBe(1);
    expect(riders[0]!.riderName).toBe('Emeka');
  });

  it('creates parcel with valid kobo/gram values', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws7', tenantId: 't1', companyName: 'Parcel Co' });
    const parcel = await repo.createParcel({ profileId: p.id, tenantId: 't1', trackingCode: 'TRK001', weightGrams: 500, deliveryFeeKobo: 150000 });
    expect(parcel.trackingCode).toBe('TRK001');
    expect(parcel.status).toBe('intake');
    expect(parcel.weightGrams).toBe(500);
  });

  it('rejects parcel with float weightGrams (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws8', tenantId: 't1', companyName: 'Bad Parcel' });
    await expect(repo.createParcel({ profileId: p.id, tenantId: 't1', trackingCode: 'TRK002', weightGrams: 500.5, deliveryFeeKobo: 100 })).rejects.toThrow('P9');
  });

  it('rejects parcel with negative deliveryFeeKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws9', tenantId: 't1', companyName: 'Neg Fee' });
    await expect(repo.createParcel({ profileId: p.id, tenantId: 't1', trackingCode: 'TRK003', weightGrams: 100, deliveryFeeKobo: -500 })).rejects.toThrow('P9');
  });

  it('updates parcel status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws10', tenantId: 't1', companyName: 'Status Co' });
    const parcel = await repo.createParcel({ profileId: p.id, tenantId: 't1', trackingCode: 'TRK004', weightGrams: 200, deliveryFeeKobo: 100000 });
    const updated = await repo.updateParcelStatus(parcel.id, 't1', 'picked_up');
    expect(updated!.status).toBe('picked_up');
  });

  it('creates COD remittance with valid kobo values', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws11', tenantId: 't1', companyName: 'COD Corp' });
    const parcel = await repo.createParcel({ profileId: p.id, tenantId: 't1', trackingCode: 'TRK005', weightGrams: 300, deliveryFeeKobo: 100000, codAmountKobo: 500000 });
    const cod = await repo.createCodRemittance({ parcelId: parcel.id, tenantId: 't1', collectedKobo: 500000, remittedKobo: 500000 });
    expect(cod.collectedKobo).toBe(500000);
  });

  it('rejects COD remittance with float collectedKobo (P9)', async () => {
    await expect(repo.createCodRemittance({ parcelId: 'pid', tenantId: 't1', collectedKobo: 100.5, remittedKobo: 100 })).rejects.toThrow('P9');
  });

  it('FSM: valid transition seeded → claimed', () => {
    expect(isValidCourierTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: invalid transition seeded → active', () => {
    expect(isValidCourierTransition('seeded', 'active')).toBe(false);
  });

  it('FSM: valid transition cac_verified → active', () => {
    expect(isValidCourierTransition('cac_verified', 'active')).toBe(true);
  });

  it('guardSeedToClaimed: blocks KYC 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('guardClaimedToCacVerified: blocks without CAC RC', () => {
    expect(guardClaimedToCacVerified({ cacRc: null, kycTier: 2 }).allowed).toBe(false);
  });

  it('guardClaimedToCacVerified: allows with CAC RC at Tier 2', () => {
    expect(guardClaimedToCacVerified({ cacRc: 'RC001', kycTier: 2 }).allowed).toBe(true);
  });
});
