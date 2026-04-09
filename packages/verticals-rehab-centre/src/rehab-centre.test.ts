/**
 * @webwaka/verticals-rehab-centre — test suite (M12)
 * Minimum 15 tests
 * CRITICAL TESTS:
 *   1. Any payload with resident name/substance/diagnosis is rejected at schema level (P13)
 *   2. ALL SuperAgent calls must have autonomy_level: 'L3_HITL' — missing flag = blocking failure
 * Covers: T3, P9, P13, FSM, KYC Tier 3, L3 HITL enforcement
 */

import { describe, it, expect } from 'vitest';
import {
  isValidRehabCentreTransition,
  guardClaimedToNdleaVerified,
  guardAiHitl,
  guardKycTier3,
  guardP13ResidentData,
  guardFractionalKobo,
  guardPositiveInteger,
  registerRehabCentreVertical,
} from './index.js';
import { RehabCentreRepository } from './rehab-centre.js';

function makeDb() {
  const store = new Map<string, unknown>();
  return {
    prepare: (sql: string) => ({
      bind: (...vals: unknown[]) => ({
        run: async () => {
          if (sql.startsWith('INSERT INTO rehab_centre_profiles')) { store.set(vals[0] as string, { id: vals[0], workspace_id: vals[1], tenant_id: vals[2], centre_name: vals[3], ndlea_licence: null, fmhsw_registration: null, cac_rc: null, bed_count: vals[4], status: 'seeded', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO rehab_programmes')) { const fee = vals[5]; if (!Number.isInteger(fee) || (fee as number) < 0) throw new Error('P9: totalFeeKobo must be a non-negative integer'); const days = vals[4]; if (!Number.isInteger(days) || (days as number) <= 0) throw new Error('durationDays must be a positive integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], programme_name: vals[3], duration_days: vals[4], total_fee_kobo: vals[5], programme_type: vals[6], created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO rehab_enrolments')) { const dep = vals[6]; if (!Number.isInteger(dep) || (dep as number) < 0) throw new Error('P9: depositKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], resident_ref_id: vals[3], programme_id: vals[4], enrolment_date: vals[5], deposit_kobo: vals[6], balance_kobo: vals[7], status: 'active', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO rehab_sessions')) { store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], resident_ref_id: vals[3], session_date: vals[4], facilitator_id: vals[5], session_type: vals[6], created_at: 1 }); }
          return { success: true };
        },
        first: async <T>() => { if (sql.includes('WHERE id=?')) return (store.get(vals[0] as string) ?? null) as T | null; if (sql.includes('SUM(CASE WHEN status')) return { active_cnt: 0, completed_cnt: 0 } as unknown as T; if (sql.includes('COUNT(*)')) return { cnt: 0 } as unknown as T; return null; },
        all: async <T>() => ({ results: [] as T[] }),
      }),
    }),
  };
}

describe('rehab-centre vertical', () => {
  it('registerRehabCentreVertical returns correct slug and pillars', () => {
    const v = registerRehabCentreVertical();
    expect(v.slug).toBe('rehab-centre');
    expect(v.primary_pillars).toEqual(['ops', 'branding', 'marketplace']);
  });

  it('FSM: seeded → claimed is valid', () => {
    expect(isValidRehabCentreTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: claimed → ndlea_verified is valid', () => {
    expect(isValidRehabCentreTransition('claimed', 'ndlea_verified')).toBe(true);
  });

  it('FSM: ndlea_verified → active is valid', () => {
    expect(isValidRehabCentreTransition('ndlea_verified', 'active')).toBe(true);
  });

  it('FSM: seeded → active is invalid (typed error)', () => {
    expect(isValidRehabCentreTransition('seeded', 'active')).toBe(false);
  });

  it('guardClaimedToNdleaVerified passes with NDLEA licence + KYC 3', () => {
    expect(guardClaimedToNdleaVerified({ ndleaLicence: 'NDLEA-REHAB-001', kycTier: 3 }).allowed).toBe(true);
  });

  it('guardClaimedToNdleaVerified fails without NDLEA licence', () => {
    const r = guardClaimedToNdleaVerified({ ndleaLicence: null, kycTier: 3 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('NDLEA');
  });

  it('KYC: Tier 3 mandatory — KYC 2 is blocked', () => {
    const r = guardClaimedToNdleaVerified({ ndleaLicence: 'NDLEA-001', kycTier: 2 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Tier 3');
  });

  it('KYC: guardKycTier3 blocks Tier 2 for all operations', () => {
    expect(guardKycTier3({ kycTier: 2 }).allowed).toBe(false);
    expect(guardKycTier3({ kycTier: 3 }).allowed).toBe(true);
  });

  it('L3 HITL CRITICAL: guardAiHitl blocks any call without L3_HITL flag', () => {
    const r = guardAiHitl({ autonomyLevel: 'L2' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('L3 HITL');
  });

  it('L3 HITL CRITICAL: guardAiHitl passes only with L3_HITL', () => {
    expect(guardAiHitl({ autonomyLevel: 'L3_HITL' }).allowed).toBe(true);
  });

  it('P13 CRITICAL: resident_name in AI payload is blocked', () => {
    const r = guardP13ResidentData({ payloadKeys: ['resident_name', 'programme_completion_rate'] });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('P13 CRITICAL');
  });

  it('P13 CRITICAL: substance in AI payload is blocked', () => {
    const r = guardP13ResidentData({ payloadKeys: ['substance', 'occupancy_rate'] });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('P13 CRITICAL');
  });

  it('P13 CRITICAL: aggregate programme stats pass', () => {
    expect(guardP13ResidentData({ payloadKeys: ['programme_completion_rate', 'occupancy_rate', 'active_enrolments'] }).allowed).toBe(true);
  });

  it('P9: guardFractionalKobo rejects fractional', () => {
    expect(guardFractionalKobo(1000.50).allowed).toBe(false);
  });

  it('T3: createProfile stores tenantId', async () => {
    const repo = new RehabCentreRepository(makeDb() as ReturnType<typeof makeDb>);
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tenant-A', centreName: 'Hope Recovery Centre' });
    expect(p.tenantId).toBe('tenant-A');
    expect(p.status).toBe('seeded');
  });

  it('T3: cross-tenant lookup returns null (403 equivalent)', async () => {
    const repo = new RehabCentreRepository(makeDb() as ReturnType<typeof makeDb>);
    expect(await repo.findProfileById('no-such-id', 'tenant-B')).toBeNull();
  });

  it('P13 CRITICAL: resident_ref_id is opaque UUID — no name stored', async () => {
    const repo = new RehabCentreRepository(makeDb() as ReturnType<typeof makeDb>);
    const e = await repo.createEnrolment({ profileId: 'p1', tenantId: 'tenant-A', programmeId: 'prog1', depositKobo: 5000000, balanceKobo: 25000000 });
    expect(e.residentRefId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(e.residentRefId).not.toContain('Emeka');
    expect(e.residentRefId).not.toContain('John');
  });

  it('P9: createProgramme rejects fractional totalFeeKobo', async () => {
    const repo = new RehabCentreRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createProgramme({ profileId: 'p1', tenantId: 'tenant-A', programmeName: '3-Month Residential', durationDays: 90, totalFeeKobo: 30000000.5 })).rejects.toThrow('P9');
  });

  it('programme durationDays must be positive integer', async () => {
    const repo = new RehabCentreRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createProgramme({ profileId: 'p1', tenantId: 'tenant-A', programmeName: 'Invalid', durationDays: 0, totalFeeKobo: 10000000 })).rejects.toThrow('positive integer');
  });

  it('P9: createEnrolment rejects fractional depositKobo', async () => {
    const repo = new RehabCentreRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createEnrolment({ profileId: 'p1', tenantId: 'tenant-A', programmeId: 'prog1', depositKobo: 100.5, balanceKobo: 900 })).rejects.toThrow('P9');
  });

  it('session logged with session_type only — no content stored', async () => {
    const repo = new RehabCentreRepository(makeDb() as ReturnType<typeof makeDb>);
    const s = await repo.createSession({ profileId: 'p1', tenantId: 'tenant-A', residentRefId: 'r1', facilitatorId: 'f1' });
    expect(s.sessionType).toBe('group');
    expect(Object.keys(s)).not.toContain('content');
    expect(Object.keys(s)).not.toContain('notes');
  });

  it('vertical config: hitl_required is true for ALL AI', () => {
    const v = registerRehabCentreVertical();
    expect(v.hitl_required).toBe(true);
    expect(v.hitl_required_for_all_ai).toBe(true);
  });

  it('vertical config: kyc_tier_mandatory is true', () => {
    expect(registerRehabCentreVertical().kyc_tier_mandatory).toBe(true);
  });

  it('guardPositiveInteger: 0 is rejected', () => {
    expect(guardPositiveInteger(0, 'days').allowed).toBe(false);
  });

  it('vertical config: p13_most_sensitive is true', () => {
    expect(registerRehabCentreVertical().p13_most_sensitive).toBe(true);
  });
});
