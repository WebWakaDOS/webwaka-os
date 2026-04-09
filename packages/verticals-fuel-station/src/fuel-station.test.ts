/**
 * packages/verticals-fuel-station — FuelStationRepository tests
 * M9 Batch 2 acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FuelStationRepository } from './fuel-station.js';
import {
  guardSeedToClaimed,
  guardClaimedToNuprcVerified,
  isValidFuelStationTransition,
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
              ? (r['workspace_id'] === vals[0] || r['station_id'] === vals[0] || r['pump_id'] === vals[0]) && r['tenant_id'] === vals[1]
              : true
          ),
        } as { results: T[] };
      },
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof FuelStationRepository>[0];
}

describe('FuelStationRepository', () => {
  let repo: FuelStationRepository;
  beforeEach(() => { repo = new FuelStationRepository(makeDb() as never); });

  it('T001 — creates profile with status seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', stationName: 'Chima Petrol' });
    expect(p.status).toBe('seeded');
    expect(p.stationName).toBe('Chima Petrol');
  });

  it('T002 — finds profile by id + tenantId (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', stationName: 'Kanu Filling' });
    const found = await repo.findProfileById(p.id, 'tn1');
    expect(found!.id).toBe(p.id);
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', stationName: 'X' });
    expect(await repo.findProfileById(p.id, 'tn-other')).toBeNull();
  });

  it('T004 — updates nuprcLicence', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', stationName: 'X' });
    const u = await repo.updateProfile(p.id, 'tn1', { nuprcLicence: 'NUP-001' });
    expect(u!.nuprcLicence).toBe('NUP-001');
  });

  it('T005 — FSM seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', stationName: 'Y' });
    const after = await repo.transitionProfile(p.id, 'tn1', 'claimed');
    expect(after!.status).toBe('claimed');
  });

  it('T006 — isValidFuelStationTransition seeded→claimed', () => {
    expect(isValidFuelStationTransition('seeded', 'claimed')).toBe(true);
  });

  it('T007 — isValidFuelStationTransition rejects seeded→active', () => {
    expect(isValidFuelStationTransition('seeded', 'active')).toBe(false);
  });

  it('T008 — isValidFuelStationTransition nuprc_verified→active', () => {
    expect(isValidFuelStationTransition('nuprc_verified', 'active')).toBe(true);
  });

  it('T009 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T010 — guardSeedToClaimed passes Tier 1', () => {
    expect(guardSeedToClaimed({ kycTier: 1 }).allowed).toBe(true);
  });

  it('T011 — guardClaimedToNuprcVerified requires nuprcLicence', () => {
    expect(guardClaimedToNuprcVerified({ nuprcLicence: null }).allowed).toBe(false);
    expect(guardClaimedToNuprcVerified({ nuprcLicence: 'NUP-001' }).allowed).toBe(true);
  });

  it('T012 — creates pump with PMS product', async () => {
    const station = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', stationName: 'S1' });
    const pump = await repo.createPump({ stationId: station.id, workspaceId: 'ws1', tenantId: 'tn1', pumpNumber: 'P1', product: 'PMS', currentPriceKoboPerLitre: 85_000 });
    expect(pump.product).toBe('PMS');
    expect(pump.currentPriceKoboPerLitre).toBe(85_000);
  });

  it('T013 — rejects float price per litre (P9)', async () => {
    const station = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', stationName: 'S2' });
    await expect(repo.createPump({ stationId: station.id, workspaceId: 'ws1', tenantId: 'tn1', pumpNumber: 'P2', product: 'AGO', currentPriceKoboPerLitre: 85.5 })).rejects.toThrow('P9');
  });

  it('T014 — creates daily reading with integer litres_sold_ml', async () => {
    const station = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', stationName: 'S3' });
    const pump = await repo.createPump({ stationId: station.id, workspaceId: 'ws1', tenantId: 'tn1', pumpNumber: 'P3', product: 'DPK', currentPriceKoboPerLitre: 55_000 });
    const reading = await repo.createDailyReading({ pumpId: pump.id, workspaceId: 'ws1', tenantId: 'tn1', shiftDate: Math.floor(Date.now() / 1000), openingMeter: 0, closingMeter: 10_000, litresSoldMl: 10_000_000, cashReceivedKobo: 550_000 });
    expect(reading.litresSoldMl).toBe(10_000_000);
    expect(reading.cashReceivedKobo).toBe(550_000);
  });

  it('T015 — rejects float litresSoldMl', async () => {
    await expect(repo.createDailyReading({ pumpId: 'p1', workspaceId: 'ws1', tenantId: 'tn1', shiftDate: 1, openingMeter: 0, closingMeter: 1, litresSoldMl: 1.5, cashReceivedKobo: 100 })).rejects.toThrow('integer');
  });

  it('T016 — creates tank stock with integer capacityMl', async () => {
    const station = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', stationName: 'S4' });
    const tank = await repo.createTankStock({ stationId: station.id, workspaceId: 'ws1', tenantId: 'tn1', product: 'PMS', capacityMl: 33_000_000, currentLevelMl: 15_000_000 });
    expect(tank.capacityMl).toBe(33_000_000);
    expect(tank.currentLevelMl).toBe(15_000_000);
  });

  it('T017 — rejects zero or negative capacityMl', async () => {
    await expect(repo.createTankStock({ stationId: 's1', workspaceId: 'ws1', tenantId: 'tn1', product: 'AGO', capacityMl: 0 })).rejects.toThrow();
  });
});
