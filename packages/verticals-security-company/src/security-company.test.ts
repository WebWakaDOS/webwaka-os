/**
 * packages/verticals-security-company — SecurityCompanyRepository tests
 * M9 Batch 2 acceptance: ≥15 tests.
 * P13: guard PII (names, ID numbers) never passed to AI (enforced at route layer).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityCompanyRepository } from './security-company.js';
import {
  guardSeedToClaimed,
  guardClaimedToPscVerified,
  isValidSecurityCompanyTransition,
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
              ? (r['workspace_id'] === vals[0] || r['site_id'] === vals[0]) && r['tenant_id'] === vals[1]
              : true
          ),
        } as { results: T[] };
      },
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof SecurityCompanyRepository>[0];
}

describe('SecurityCompanyRepository', () => {
  let repo: SecurityCompanyRepository;
  beforeEach(() => { repo = new SecurityCompanyRepository(makeDb() as never); });

  it('T001 — creates profile seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Eagle Eye Guards' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Eagle Eye Guards');
  });

  it('T002 — finds profile by id (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'AX Security' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.id).toBe(p.id);
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'X' });
    expect(await repo.findProfileById(p.id, 'evil')).toBeNull();
  });

  it('T004 — guardCount defaults to 0', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Y' });
    expect(p.guardCount).toBe(0);
  });

  it('T005 — FSM seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', companyName: 'Z' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T006 — isValidSecurityCompanyTransition seeded→claimed', () => {
    expect(isValidSecurityCompanyTransition('seeded', 'claimed')).toBe(true);
  });

  it('T007 — rejects seeded→active', () => {
    expect(isValidSecurityCompanyTransition('seeded', 'active')).toBe(false);
  });

  it('T008 — allows psc_verified→active', () => {
    expect(isValidSecurityCompanyTransition('psc_verified', 'active')).toBe(true);
  });

  it('T009 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T010 — guardClaimedToPscVerified requires both credentials', () => {
    expect(guardClaimedToPscVerified({ pscLicence: null, pscaiNumber: 'P1' }).allowed).toBe(false);
    expect(guardClaimedToPscVerified({ pscLicence: 'L1', pscaiNumber: null }).allowed).toBe(false);
    expect(guardClaimedToPscVerified({ pscLicence: 'L1', pscaiNumber: 'P1' }).allowed).toBe(true);
  });

  it('T011 — creates guard with integer salary (P9)', async () => {
    const g = await repo.createGuard({ workspaceId: 'ws1', tenantId: 'tn1', guardName: 'Emeka Nwosu', monthlySalaryKobo: 80_000_000 });
    expect(g.monthlySalaryKobo).toBe(80_000_000);
    expect(g.status).toBe('active');
  });

  it('T012 — rejects float salary (P9)', async () => {
    await expect(repo.createGuard({ workspaceId: 'ws1', tenantId: 'tn1', guardName: 'X', monthlySalaryKobo: 80_000.50 })).rejects.toThrow('P9');
  });

  it('T013 — creates security site with integer monthly fee (P9)', async () => {
    const s = await repo.createSite({ workspaceId: 'ws1', tenantId: 'tn1', siteName: 'Lekki Phase 1', guardCountRequired: 3, monthlyFeeKobo: 500_000_000 });
    expect(s.monthlyFeeKobo).toBe(500_000_000);
    expect(s.guardCountRequired).toBe(3);
  });

  it('T014 — rejects float monthlyFeeKobo (P9)', async () => {
    await expect(repo.createSite({ workspaceId: 'ws1', tenantId: 'tn1', siteName: 'X', monthlyFeeKobo: 1000.50 })).rejects.toThrow('P9');
  });

  it('T015 — creates incident report', async () => {
    const s = await repo.createSite({ workspaceId: 'ws1', tenantId: 'tn1', siteName: 'Y Site', monthlyFeeKobo: 300_000_000 });
    const i = await repo.createIncident({ siteId: s.id, workspaceId: 'ws1', tenantId: 'tn1', reportDate: Math.floor(Date.now() / 1000), incidentType: 'trespassing', description: 'Unauthorized entry detected' });
    expect(i.incidentType).toBe('trespassing');
    expect(i.siteId).toBe(s.id);
  });

  it('T016 — updates guard status to suspended', async () => {
    const g = await repo.createGuard({ workspaceId: 'ws1', tenantId: 'tn1', guardName: 'John', monthlySalaryKobo: 60_000_000 });
    expect((await repo.updateGuardStatus(g.id, 'tn1', 'suspended'))!.status).toBe('suspended');
  });
});
