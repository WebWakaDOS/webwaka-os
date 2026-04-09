/**
 * packages/verticals-container-depot — ContainerDepotRepository tests
 * M12 Transport Extended — acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContainerDepotRepository } from './container-depot.js';
import {
  guardSeedToClaimed,
  guardClaimedToNcsVerified,
  isValidContainerDepotTransition,
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
  return { prepare: prep } as unknown as ConstructorParameters<typeof ContainerDepotRepository>[0];
}

describe('ContainerDepotRepository', () => {
  let repo: ContainerDepotRepository;
  beforeEach(() => { repo = new ContainerDepotRepository(makeDb() as never); });

  it('creates a profile with seeded status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 't1', companyName: 'Apapa Container Hub' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Apapa Container Hub');
  });

  it('creates profile with NCS and NPA licences', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws2', tenantId: 't1', companyName: 'Licensed Hub', ncsLicence: 'NCS-D001', npaLicence: 'NPA-D001', depotLocation: 'Tin Can Island' });
    expect(p.ncsLicence).toBe('NCS-D001');
    expect(p.npaLicence).toBe('NPA-D001');
    expect(p.depotLocation).toBe('Tin Can Island');
  });

  it('finds profile by ID', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws3', tenantId: 't2', companyName: 'Onne Hub' });
    expect((await repo.findProfileById(p.id, 't2'))!.id).toBe(p.id);
  });

  it('finds profile by workspace', async () => {
    await repo.createProfile({ workspaceId: 'ws4', tenantId: 't3', companyName: 'Calabar Hub' });
    expect((await repo.findProfileByWorkspace('ws4', 't3'))!.workspaceId).toBe('ws4');
  });

  it('returns null for unknown profile', async () => {
    expect(await repo.findProfileById('none', 't1')).toBeNull();
  });

  it('transitions profile status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws5', tenantId: 't1', companyName: 'FSM Hub' });
    const t = await repo.transitionStatus(p.id, 't1', 'claimed');
    expect(t!.status).toBe('claimed');
  });

  it('creates container record and computes storage charge', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws6', tenantId: 't1', companyName: 'Storage Hub' });
    const c = await repo.createContainerRecord({ profileId: p.id, tenantId: 't1', containerNumber: 'HLCU1234567', weightKg: 20000, dailyStorageRateKobo: 100000, daysInDepot: 5 });
    expect(c.storageChargeKobo).toBe(500000);
    expect(c.containerNumber).toBe('HLCU1234567');
    expect(c.status).toBe('received');
  });

  it('creates 20ft container by default', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws7', tenantId: 't1', companyName: 'Default Container' });
    const c = await repo.createContainerRecord({ profileId: p.id, tenantId: 't1', containerNumber: 'MSCU0000001', weightKg: 10000, dailyStorageRateKobo: 50000 });
    expect(c.containerType).toBe('20ft');
  });

  it('rejects container with float weightKg (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws8', tenantId: 't1', companyName: 'Float Weight' });
    await expect(repo.createContainerRecord({ profileId: p.id, tenantId: 't1', containerNumber: 'BAD001', weightKg: 100.5, dailyStorageRateKobo: 50000 })).rejects.toThrow('P9');
  });

  it('rejects container with float dailyStorageRateKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws9', tenantId: 't1', companyName: 'Float Rate' });
    await expect(repo.createContainerRecord({ profileId: p.id, tenantId: 't1', containerNumber: 'BAD002', weightKg: 100, dailyStorageRateKobo: 100.5 })).rejects.toThrow('P9');
  });

  it('lists container records', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws10', tenantId: 't1', companyName: 'List Hub' });
    await repo.createContainerRecord({ profileId: p.id, tenantId: 't1', containerNumber: 'C001', weightKg: 1000, dailyStorageRateKobo: 50000 });
    await repo.createContainerRecord({ profileId: p.id, tenantId: 't1', containerNumber: 'C002', weightKg: 2000, dailyStorageRateKobo: 75000 });
    const list = await repo.listContainerRecords(p.id, 't1');
    expect(list.length).toBe(2);
  });

  it('updates container status with NCS release number', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws11', tenantId: 't1', companyName: 'Release Hub' });
    const c = await repo.createContainerRecord({ profileId: p.id, tenantId: 't1', containerNumber: 'C003', weightKg: 5000, dailyStorageRateKobo: 80000 });
    const updated = await repo.updateContainerStatus(c.id, 't1', 'released', 'NCS-REL-001');
    expect(updated!.status).toBe('released');
    expect(updated!.ncsReleaseNumber).toBe('NCS-REL-001');
  });

  it('FSM: valid transition seeded → claimed', () => {
    expect(isValidContainerDepotTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: invalid transition claimed → active (skipping ncs_verified)', () => {
    expect(isValidContainerDepotTransition('claimed', 'active')).toBe(false);
  });

  it('guardSeedToClaimed: blocks KYC 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('guardClaimedToNcsVerified: blocks without NCS licence', () => {
    expect(guardClaimedToNcsVerified({ ncsLicence: null, npaLicence: 'NPA1', kycTier: 3 }).allowed).toBe(false);
  });

  it('guardClaimedToNcsVerified: blocks without NPA licence', () => {
    expect(guardClaimedToNcsVerified({ ncsLicence: 'NCS1', npaLicence: null, kycTier: 3 }).allowed).toBe(false);
  });

  it('guardClaimedToNcsVerified: allows all fields at KYC 3', () => {
    expect(guardClaimedToNcsVerified({ ncsLicence: 'NCS1', npaLicence: 'NPA1', kycTier: 3 }).allowed).toBe(true);
  });
});
