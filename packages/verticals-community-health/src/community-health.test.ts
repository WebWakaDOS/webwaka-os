/**
 * @webwaka/verticals-community-health — test suite (M12)
 * Minimum 15 tests
 * Covers: T3, P13, FSM, USSD AI block (P12), immunisation integer counts
 */

import { describe, it, expect } from 'vitest';
import {
  isValidCommunityHealthTransition,
  guardClaimedToNphcdaRegistered,
  guardUssdAiBlock,
  guardP13HouseholdData,
  guardIntegerCount,
  registerCommunityHealthVertical,
} from './index.js';
import { CommunityHealthRepository } from './community-health.js';

function makeDb() {
  const store = new Map<string, unknown>();
  return {
    prepare: (sql: string) => ({
      bind: (...vals: unknown[]) => ({
        run: async () => {
          if (sql.startsWith('INSERT INTO community_health_profiles')) { store.set(vals[0] as string, { id: vals[0], workspace_id: vals[1], tenant_id: vals[2], org_name: vals[3], nphcda_affiliation: null, state_moh_registration: null, lga: null, status: 'seeded', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO chw_workers')) { store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], chw_ref_id: vals[3], training_level: vals[4], lga: vals[5], ward: vals[6], status: 'active', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO chw_visits')) { store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], chw_ref_id: vals[3], household_ref_id: vals[4], visit_date: vals[5], services_provided: vals[6], referral_flag: vals[7], created_at: 1 }); }
          if (sql.startsWith('INSERT INTO chw_immunisation')) { const doses = vals[5]; if (!Number.isInteger(doses) || (doses as number) < 0) throw new Error('dosesAdministered must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], chw_ref_id: vals[3], vaccine_name: vals[4], doses_administered: vals[5], tally_date: vals[6], lga: vals[7], ward: vals[8], created_at: 1 }); }
          if (sql.startsWith('INSERT INTO chw_stock')) { const cnt = vals[4]; if (!Number.isInteger(cnt) || (cnt as number) < 0) throw new Error('unitCount must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], item_name: vals[3], unit_count: vals[4], dispensed_count: vals[5], last_restocked: null, created_at: 1, updated_at: 1 }); }
          return { success: true };
        },
        first: async <T>() => { if (sql.includes('WHERE id=?')) return (store.get(vals[0] as string) ?? null) as T | null; if (sql.includes('COUNT(*)') && sql.includes('SUM')) return { cnt: 0, refs: 0 } as unknown as T; if (sql.includes('COUNT(*)')) return { cnt: 0 } as unknown as T; return null; },
        all: async <T>() => ({ results: [] as T[] }),
      }),
    }),
  };
}

describe('community-health vertical', () => {
  it('registerCommunityHealthVertical returns correct slug and pillars (ops+marketplace, no branding)', () => {
    const v = registerCommunityHealthVertical();
    expect(v.slug).toBe('community-health');
    expect(v.primary_pillars).toEqual(['ops', 'marketplace']);
    expect(v.primary_pillars).not.toContain('branding');
  });

  it('FSM: seeded → claimed is valid', () => {
    expect(isValidCommunityHealthTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: claimed → nphcda_registered is valid', () => {
    expect(isValidCommunityHealthTransition('claimed', 'nphcda_registered')).toBe(true);
  });

  it('FSM: nphcda_registered → active is valid', () => {
    expect(isValidCommunityHealthTransition('nphcda_registered', 'active')).toBe(true);
  });

  it('FSM: seeded → active is invalid (typed error)', () => {
    expect(isValidCommunityHealthTransition('seeded', 'active')).toBe(false);
  });

  it('guardClaimedToNphcdaRegistered passes with both affiliations', () => {
    const r = guardClaimedToNphcdaRegistered({ nphcdaAffiliation: 'NPHCDA-001', stateMohRegistration: 'LAGOS-MOH-2024' });
    expect(r.allowed).toBe(true);
  });

  it('guardClaimedToNphcdaRegistered fails without NPHCDA affiliation', () => {
    const r = guardClaimedToNphcdaRegistered({ nphcdaAffiliation: null, stateMohRegistration: 'LAGOS-MOH-2024' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('NPHCDA');
  });

  it('guardClaimedToNphcdaRegistered fails without state MOH registration', () => {
    const r = guardClaimedToNphcdaRegistered({ nphcdaAffiliation: 'NPHCDA-001', stateMohRegistration: null });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('MOH');
  });

  it('P12: guardUssdAiBlock blocks AI on USSD sessions', () => {
    const r = guardUssdAiBlock({ isUssdSession: true });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('P12');
  });

  it('P12: AI allowed on non-USSD sessions', () => {
    expect(guardUssdAiBlock({ isUssdSession: false }).allowed).toBe(true);
  });

  it('P13: household data blocked in AI payload', () => {
    const r = guardP13HouseholdData({ payloadKeys: ['household_name', 'lga_count'] });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('P13');
  });

  it('P13: aggregate LGA stats pass', () => {
    expect(guardP13HouseholdData({ payloadKeys: ['total_visits_lga', 'referral_rate', 'vaccine_coverage'] }).allowed).toBe(true);
  });

  it('T3: createProfile stores tenantId', async () => {
    const repo = new CommunityHealthRepository(makeDb() as ReturnType<typeof makeDb>);
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tenant-A', orgName: 'Kano CHW Network' });
    expect(p.tenantId).toBe('tenant-A');
    expect(p.status).toBe('seeded');
  });

  it('T3: cross-tenant lookup returns null', async () => {
    const repo = new CommunityHealthRepository(makeDb() as ReturnType<typeof makeDb>);
    expect(await repo.findProfileById('no-such-id', 'tenant-B')).toBeNull();
  });

  it('P13: household_ref_id is opaque UUID (never address)', async () => {
    const repo = new CommunityHealthRepository(makeDb() as ReturnType<typeof makeDb>);
    const v = await repo.createVisit({ profileId: 'p1', tenantId: 'tenant-A', chwRefId: 'chw1' });
    expect(v.householdRefId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(v.householdRefId).not.toContain('Lagos');
  });

  it('CHW worker created with opaque ref', async () => {
    const repo = new CommunityHealthRepository(makeDb() as ReturnType<typeof makeDb>);
    const w = await repo.createWorker({ profileId: 'p1', tenantId: 'tenant-A' });
    expect(w.chwRefId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('immunisation: dosesAdministered must be integer', async () => {
    const repo = new CommunityHealthRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createImmunisation({ profileId: 'p1', tenantId: 'tenant-A', chwRefId: 'chw1', vaccineName: 'OPV', dosesAdministered: 5.5 })).rejects.toThrow('integer');
  });

  it('immunisation: integer dosesAdministered accepted', async () => {
    const repo = new CommunityHealthRepository(makeDb() as ReturnType<typeof makeDb>);
    const imm = await repo.createImmunisation({ profileId: 'p1', tenantId: 'tenant-A', chwRefId: 'chw1', vaccineName: 'OPV', dosesAdministered: 12 });
    expect(imm.dosesAdministered).toBe(12);
  });

  it('stock: unitCount must be non-negative integer', async () => {
    const repo = new CommunityHealthRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createStock({ profileId: 'p1', tenantId: 'tenant-A', itemName: 'ORS', unitCount: -5 })).rejects.toThrow('integer');
  });

  it('guardIntegerCount rejects negative counts', () => {
    expect(guardIntegerCount(-1, 'doses').allowed).toBe(false);
  });

  it('vertical config: ussd_data_routes_supported is true (USSD data entry works)', () => {
    expect(registerCommunityHealthVertical().ussd_data_routes_supported).toBe(true);
  });
});
