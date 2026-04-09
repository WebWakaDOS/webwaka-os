/**
 * packages/verticals-spa — SpaRepository tests
 * M10 Batch 2 acceptance: ≥15 tests.
 * P13: client health intake data never passed to AI (enforced at route layer).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpaRepository } from './spa.js';
import {
  guardSeedToClaimed,
  guardClaimedToPermitVerified,
  isValidSpaTransition,
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
  return { prepare: prep } as unknown as ConstructorParameters<typeof SpaRepository>[0];
}

describe('SpaRepository', () => {
  let repo: SpaRepository;
  beforeEach(() => { repo = new SpaRepository(makeDb() as never); });

  it('T001 — creates spa profile seeded', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', spaName: 'Zara Wellness Spa', type: 'day_spa' });
    expect(p.status).toBe('seeded');
    expect(p.spaName).toBe('Zara Wellness Spa');
    expect(p.type).toBe('day_spa');
  });

  it('T002 — finds by id (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', spaName: 'X Spa', type: 'mobile' });
    expect((await repo.findProfileById(p.id, 'tn1'))!.id).toBe(p.id);
  });

  it('T003 — cross-tenant isolation (T3)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', spaName: 'Y', type: 'hotel_spa' });
    expect(await repo.findProfileById(p.id, 'evil')).toBeNull();
  });

  it('T004 — FSM seeded→claimed', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tn1', spaName: 'Z', type: 'day_spa' });
    expect((await repo.transitionProfile(p.id, 'tn1', 'claimed'))!.status).toBe('claimed');
  });

  it('T005 — isValidSpaTransition seeded→claimed', () => {
    expect(isValidSpaTransition('seeded', 'claimed')).toBe(true);
  });

  it('T006 — rejects seeded→active', () => {
    expect(isValidSpaTransition('seeded', 'active')).toBe(false);
  });

  it('T007 — allows permit_verified→active', () => {
    expect(isValidSpaTransition('permit_verified', 'active')).toBe(true);
  });

  it('T008 — guardSeedToClaimed blocks Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('T009 — guardClaimedToPermitVerified requires both credentials', () => {
    expect(guardClaimedToPermitVerified({ nascNumber: null, stateHealthPermit: 'SHP1' }).allowed).toBe(false);
    expect(guardClaimedToPermitVerified({ nascNumber: 'N1', stateHealthPermit: null }).allowed).toBe(false);
    expect(guardClaimedToPermitVerified({ nascNumber: 'N1', stateHealthPermit: 'SHP1' }).allowed).toBe(true);
  });

  it('T010 — creates service with integer priceKobo (P9)', async () => {
    const s = await repo.createService({ workspaceId: 'ws1', tenantId: 'tn1', serviceName: 'Swedish Massage 60 min', category: 'massage', durationMinutes: 60, priceKobo: 15_000_000 });
    expect(s.priceKobo).toBe(15_000_000);
    expect(s.category).toBe('massage');
  });

  it('T011 — rejects float priceKobo in service (P9)', async () => {
    await expect(repo.createService({ workspaceId: 'ws1', tenantId: 'tn1', serviceName: 'X', priceKobo: 5_000.5 })).rejects.toThrow('P9');
  });

  it('T012 — creates appointment', async () => {
    const s = await repo.createService({ workspaceId: 'ws1', tenantId: 'tn1', serviceName: 'Facial', priceKobo: 8_000_000 });
    const a = await repo.createAppointment({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '08030005555', serviceId: s.id, appointmentTime: Math.floor(Date.now() / 1000) + 3600, depositKobo: 3_000_000 });
    expect(a.status).toBe('booked');
    expect(a.depositKobo).toBe(3_000_000);
  });

  it('T013 — rejects float depositKobo (P9)', async () => {
    await expect(repo.createAppointment({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', serviceId: 'svc1', appointmentTime: 1, depositKobo: 5_000.25 })).rejects.toThrow('P9');
  });

  it('T014 — updates appointment status to in_session', async () => {
    const s = await repo.createService({ workspaceId: 'ws1', tenantId: 'tn1', serviceName: 'Hot Stone', priceKobo: 20_000_000 });
    const a = await repo.createAppointment({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', serviceId: s.id, appointmentTime: 1700000000 });
    expect((await repo.updateAppointmentStatus(a.id, 'tn1', 'in_session'))!.status).toBe('in_session');
  });

  it('T015 — creates membership with integer monthlyFeeKobo (P9)', async () => {
    const m = await repo.createMembership({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '08030006666', packageName: 'Gold', monthlyFeeKobo: 50_000_000, sessionsPerMonth: 8 });
    expect(m.packageName).toBe('Gold');
    expect(m.sessionsPerMonth).toBe(8);
    expect(m.sessionsUsed).toBe(0);
  });

  it('T016 — rejects float monthlyFeeKobo (P9)', async () => {
    await expect(repo.createMembership({ workspaceId: 'ws1', tenantId: 'tn1', clientPhone: '080', packageName: 'X', monthlyFeeKobo: 50_000.5 })).rejects.toThrow('P9');
  });

  it('T017 — defaultDurationMinutes is 60 for service', async () => {
    const s = await repo.createService({ workspaceId: 'ws1', tenantId: 'tn1', serviceName: 'Y Massage', priceKobo: 12_000_000 });
    expect(s.durationMinutes).toBe(60);
  });
});
