/**
 * packages/verticals-nurtw — NurtwRepository tests
 * M12 Transport Extended — acceptance: ≥15 tests.
 * AI: L3 HITL — member names and vehicles NOT passed to AI layer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NurtwRepository } from './nurtw.js';
import {
  guardSeedToClaimed,
  guardClaimedToNurtwVerified,
  isValidNurtwTransition,
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
            ? (r['profile_id'] === vals[0] || r['member_id'] === vals[0]) && r['tenant_id'] === vals[1]
            : true
        ),
      } as { results: T[] }),
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof NurtwRepository>[0];
}

describe('NurtwRepository', () => {
  let repo: NurtwRepository;
  beforeEach(() => { repo = new NurtwRepository(makeDb() as never); });

  it('creates a union profile with seeded status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 't1', unionName: 'NURTW Mushin Park Chapter' });
    expect(p.status).toBe('seeded');
    expect(p.unionName).toBe('NURTW Mushin Park Chapter');
    expect(p.chapterLevel).toBe('park');
  });

  it('creates profile with state chapter level', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws2', tenantId: 't1', unionName: 'NURTW Lagos State', chapterLevel: 'state', state: 'Lagos', nurtwRegistration: 'NURTW-LG-001' });
    expect(p.chapterLevel).toBe('state');
    expect(p.state).toBe('Lagos');
    expect(p.nurtwRegistration).toBe('NURTW-LG-001');
  });

  it('finds profile by ID', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws3', tenantId: 't2', unionName: 'NURTW Kano' });
    expect((await repo.findProfileById(p.id, 't2'))!.id).toBe(p.id);
  });

  it('finds profile by workspace', async () => {
    await repo.createProfile({ workspaceId: 'ws4', tenantId: 't3', unionName: 'NURTW Abuja' });
    expect((await repo.findProfileByWorkspace('ws4', 't3'))!.workspaceId).toBe('ws4');
  });

  it('returns null for unknown profile', async () => {
    expect(await repo.findProfileById('none', 't1')).toBeNull();
  });

  it('transitions profile status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws5', tenantId: 't1', unionName: 'NURTW FSM Test' });
    const t = await repo.transitionStatus(p.id, 't1', 'claimed');
    expect(t!.status).toBe('claimed');
  });

  it('creates a union member', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws6', tenantId: 't1', unionName: 'NURTW Member Test' });
    const m = await repo.createMember({ profileId: p.id, tenantId: 't1', memberName: 'Alhaji Musa', vehiclePlate: 'KN001DX', vehicleType: 'bus', monthlyDuesKobo: 500000 });
    expect(m.memberName).toBe('Alhaji Musa');
    expect(m.monthlyDuesKobo).toBe(500000);
    expect(m.duesStatus).toBe('current');
  });

  it('rejects member with float monthlyDuesKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws7', tenantId: 't1', unionName: 'NURTW Float Test' });
    await expect(repo.createMember({ profileId: p.id, tenantId: 't1', memberName: 'Float Member', monthlyDuesKobo: 500.5 })).rejects.toThrow('P9');
  });

  it('creates dues log and validates P9', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws8', tenantId: 't1', unionName: 'NURTW Dues Test' });
    const m = await repo.createMember({ profileId: p.id, tenantId: 't1', memberName: 'Dues Member', monthlyDuesKobo: 500000 });
    const d = await repo.createDuesLog({ memberId: m.id, profileId: p.id, tenantId: 't1', amountKobo: 500000 });
    expect(d.amountKobo).toBe(500000);
    expect(d.memberId).toBe(m.id);
  });

  it('rejects dues log with zero amountKobo (P9)', async () => {
    await expect(repo.createDuesLog({ memberId: 'm1', profileId: 'p1', tenantId: 't1', amountKobo: 0 })).rejects.toThrow('P9');
  });

  it('rejects dues log with float amountKobo (P9)', async () => {
    await expect(repo.createDuesLog({ memberId: 'm1', profileId: 'p1', tenantId: 't1', amountKobo: 500.5 })).rejects.toThrow('P9');
  });

  it('creates welfare claim', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws9', tenantId: 't1', unionName: 'NURTW Welfare Test' });
    const m = await repo.createMember({ profileId: p.id, tenantId: 't1', memberName: 'Welfare Member', monthlyDuesKobo: 500000 });
    const w = await repo.createWelfareClaim({ memberId: m.id, profileId: p.id, tenantId: 't1', claimType: 'accident', amountKobo: 2000000 });
    expect(w.status).toBe('submitted');
    expect(w.amountKobo).toBe(2000000);
    expect(w.claimType).toBe('accident');
  });

  it('rejects welfare claim with float amountKobo (P9)', async () => {
    await expect(repo.createWelfareClaim({ memberId: 'm1', profileId: 'p1', tenantId: 't1', amountKobo: 2000.5 })).rejects.toThrow('P9');
  });

  it('updates welfare claim status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws10', tenantId: 't1', unionName: 'NURTW Update Welfare' });
    const m = await repo.createMember({ profileId: p.id, tenantId: 't1', memberName: 'Update Member', monthlyDuesKobo: 100000 });
    const w = await repo.createWelfareClaim({ memberId: m.id, profileId: p.id, tenantId: 't1', amountKobo: 1000000 });
    const updated = await repo.updateWelfareClaimStatus(w.id, 't1', 'approved');
    expect(updated!.status).toBe('approved');
  });

  it('lists welfare claims for profile', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws11', tenantId: 't1', unionName: 'NURTW List Welfare' });
    const m = await repo.createMember({ profileId: p.id, tenantId: 't1', memberName: 'List Member', monthlyDuesKobo: 200000 });
    await repo.createWelfareClaim({ memberId: m.id, profileId: p.id, tenantId: 't1', amountKobo: 500000 });
    await repo.createWelfareClaim({ memberId: m.id, profileId: p.id, tenantId: 't1', amountKobo: 750000 });
    const list = await repo.listWelfareClaims(p.id, 't1');
    expect(list.length).toBe(2);
  });

  it('FSM: valid transition seeded → claimed', () => {
    expect(isValidNurtwTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: invalid transition claimed → active (must be nurtw_verified first)', () => {
    expect(isValidNurtwTransition('claimed', 'active')).toBe(false);
  });

  it('guardSeedToClaimed: blocks KYC 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('guardClaimedToNurtwVerified: blocks without NURTW registration', () => {
    expect(guardClaimedToNurtwVerified({ nurtwRegistration: null, kycTier: 2 }).allowed).toBe(false);
  });

  it('guardClaimedToNurtwVerified: allows with registration at KYC 2', () => {
    expect(guardClaimedToNurtwVerified({ nurtwRegistration: 'NURTW-001', kycTier: 2 }).allowed).toBe(true);
  });
});
