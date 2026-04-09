/**
 * packages/verticals-dispatch-rider — DispatchRiderRepository tests
 * M9 Transport Extended — acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DispatchRiderRepository } from './dispatch-rider.js';
import {
  guardSeedToClaimed,
  guardClaimedToFrscVerified,
  isValidDispatchRiderTransition,
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
            ? (r['profile_id'] === vals[0] || r['rider_id'] === vals[0]) && r['tenant_id'] === vals[1]
            : true
        ),
      } as { results: T[] }),
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof DispatchRiderRepository>[0];
}

describe('DispatchRiderRepository', () => {
  let repo: DispatchRiderRepository;
  beforeEach(() => { repo = new DispatchRiderRepository(makeDb() as never); });

  it('creates a profile with seeded status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 't1', companyName: 'Rapid Dispatch' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Rapid Dispatch');
  });

  it('creates profile with CAC number', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws2', tenantId: 't1', companyName: 'Dispatch Co', cacRc: 'RC555' });
    expect(p.cacRc).toBe('RC555');
  });

  it('finds profile by ID scoped to tenant', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws3', tenantId: 't2', companyName: 'Kano Dispatch' });
    const found = await repo.findProfileById(p.id, 't2');
    expect(found).not.toBeNull();
    expect(found!.tenantId).toBe('t2');
  });

  it('finds profile by workspace', async () => {
    await repo.createProfile({ workspaceId: 'ws4', tenantId: 't3', companyName: 'PH Dispatch' });
    const found = await repo.findProfileByWorkspace('ws4', 't3');
    expect(found!.workspaceId).toBe('ws4');
  });

  it('returns null for unknown profile', async () => {
    expect(await repo.findProfileById('none', 't1')).toBeNull();
  });

  it('transitions status via transitionStatus', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws5', tenantId: 't1', companyName: 'FSM Co' });
    const t = await repo.transitionStatus(p.id, 't1', 'claimed');
    expect(t!.status).toBe('claimed');
  });

  it('creates a rider record', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws6', tenantId: 't1', companyName: 'Rider Base' });
    const r = await repo.createRider({ profileId: p.id, tenantId: 't1', riderName: 'Chukwu', commissionPct: 20 });
    expect(r.riderName).toBe('Chukwu');
    expect(r.commissionPct).toBe(20);
  });

  it('rejects rider with commission > 100', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws7', tenantId: 't1', companyName: 'Bad Pct' });
    await expect(repo.createRider({ profileId: p.id, tenantId: 't1', riderName: 'Error', commissionPct: 150 })).rejects.toThrow();
  });

  it('creates a dispatch job with valid kobo', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws8', tenantId: 't1', companyName: 'Job Co' });
    const j = await repo.createJob({ profileId: p.id, tenantId: 't1', feeKobo: 200000, pickupAddress: '12 Lagos St' });
    expect(j.status).toBe('created');
    expect(j.feeKobo).toBe(200000);
  });

  it('rejects job with float feeKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws9', tenantId: 't1', companyName: 'Float Fee' });
    await expect(repo.createJob({ profileId: p.id, tenantId: 't1', feeKobo: 50.5 })).rejects.toThrow('P9');
  });

  it('updates job status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws10', tenantId: 't1', companyName: 'Update Job' });
    const j = await repo.createJob({ profileId: p.id, tenantId: 't1', feeKobo: 100000 });
    const updated = await repo.updateJobStatus(j.id, 't1', 'assigned', 'rider-1');
    expect(updated!.status).toBe('assigned');
  });

  it('creates rider earnings with P9 validation', async () => {
    const earning = await repo.createRiderEarning({ riderId: 'r1', jobId: 'j1', tenantId: 't1', grossFeeKobo: 200000, commissionKobo: 40000, netPayoutKobo: 160000 });
    expect(earning.grossFeeKobo).toBe(200000);
    expect(earning.netPayoutKobo).toBe(160000);
  });

  it('rejects earnings with float grossFeeKobo (P9)', async () => {
    await expect(repo.createRiderEarning({ riderId: 'r1', jobId: 'j1', tenantId: 't1', grossFeeKobo: 200.5, commissionKobo: 40, netPayoutKobo: 160 })).rejects.toThrow('P9');
  });

  it('FSM: valid transition seeded → claimed', () => {
    expect(isValidDispatchRiderTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: invalid transition claimed → active (must be frsc_verified first)', () => {
    expect(isValidDispatchRiderTransition('claimed', 'active')).toBe(false);
  });

  it('guardSeedToClaimed: blocks KYC 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('guardClaimedToFrscVerified: blocks without frsc licence', () => {
    expect(guardClaimedToFrscVerified({ frscLicenceOnFile: false, kycTier: 2 }).allowed).toBe(false);
  });

  it('guardClaimedToFrscVerified: allows with frsc licence at KYC 2', () => {
    expect(guardClaimedToFrscVerified({ frscLicenceOnFile: true, kycTier: 2 }).allowed).toBe(true);
  });
});
