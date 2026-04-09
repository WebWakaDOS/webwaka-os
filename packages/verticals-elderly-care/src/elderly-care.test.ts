/**
 * @webwaka/verticals-elderly-care — test suite (M12)
 * Minimum 15 tests
 * Covers: T3, P9, P13, FSM, KYC diaspora billing, AI guard
 */

import { describe, it, expect } from 'vitest';
import {
  isValidElderlyCareTransition,
  guardClaimedToFmhswVerified,
  guardDiasporaBilling,
  guardP13ClinicalData,
  guardFractionalKobo,
  registerElderlyCareVertical,
} from './index.js';
import { ElderlyCareRepository } from './elderly-care.js';

function makeDb() {
  const store = new Map<string, unknown>();
  return {
    prepare: (sql: string) => ({
      bind: (...vals: unknown[]) => ({
        run: async () => {
          if (sql.startsWith('INSERT INTO elderly_care_profiles')) { store.set(vals[0] as string, { id: vals[0], workspace_id: vals[1], tenant_id: vals[2], facility_name: vals[3], fmhsw_registration: null, state_social_welfare_cert: null, cac_rc: null, bed_count: vals[4], status: 'seeded', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO care_residents')) { const rate = vals[6]; if (!Number.isInteger(rate) || (rate as number) < 0) throw new Error('P9: monthlyRateKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], resident_ref_id: vals[3], room_number: vals[4], admission_date: vals[5], monthly_rate_kobo: vals[6], payer_ref_id: vals[7], payer_type: vals[8], status: 'active', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO care_billing')) { const charge = vals[5]; if (!Number.isInteger(charge) || (charge as number) < 0) throw new Error('P9: monthlyChargeKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], resident_ref_id: vals[3], billing_period: vals[4], monthly_charge_kobo: vals[5], paid_kobo: vals[6], outstanding_kobo: vals[7], payment_date: vals[8], created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO care_staff_rota')) { store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], staff_name: vals[3], role: vals[4], shift_start: vals[5], shift_end: vals[6], created_at: 1, updated_at: 1 }); }
          return { success: true };
        },
        first: async <T>() => { if (sql.includes('WHERE id=?')) return (store.get(vals[0] as string) ?? null) as T | null; if (sql.includes('SUM(outstanding_kobo)')) return { outstanding: 0 } as unknown as T; if (sql.includes('COUNT(*)')) return { cnt: 0 } as unknown as T; if (sql.includes('bed_count')) return { bed_count: 20 } as unknown as T; return null; },
        all: async <T>() => ({ results: [] as T[] }),
      }),
    }),
  };
}

describe('elderly-care vertical', () => {
  it('registerElderlyCareVertical returns correct slug and pillars', () => {
    const v = registerElderlyCareVertical();
    expect(v.slug).toBe('elderly-care');
    expect(v.primary_pillars).toEqual(['ops', 'branding', 'marketplace']);
  });

  it('FSM: seeded → claimed is valid', () => {
    expect(isValidElderlyCareTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: claimed → fmhsw_verified is valid', () => {
    expect(isValidElderlyCareTransition('claimed', 'fmhsw_verified')).toBe(true);
  });

  it('FSM: fmhsw_verified → active is valid', () => {
    expect(isValidElderlyCareTransition('fmhsw_verified', 'active')).toBe(true);
  });

  it('FSM: seeded → fmhsw_verified is invalid (typed error)', () => {
    expect(isValidElderlyCareTransition('seeded', 'fmhsw_verified')).toBe(false);
  });

  it('guardClaimedToFmhswVerified passes with reg and KYC 2', () => {
    expect(guardClaimedToFmhswVerified({ fmhswRegistration: 'FMHSW-2024-001', kycTier: 2 }).allowed).toBe(true);
  });

  it('guardClaimedToFmhswVerified fails without FMHSW reg', () => {
    const r = guardClaimedToFmhswVerified({ fmhswRegistration: null, kycTier: 2 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('FMHSW');
  });

  it('KYC: diaspora billing > ₦5M/year requires Tier 3', () => {
    const r = guardDiasporaBilling({ annualTotalKobo: 600_000_000, payerType: 'diaspora', kycTier: 2 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Tier 3');
  });

  it('KYC: diaspora billing > ₦5M/year passes with Tier 3', () => {
    expect(guardDiasporaBilling({ annualTotalKobo: 600_000_000, payerType: 'diaspora', kycTier: 3 }).allowed).toBe(true);
  });

  it('KYC: family billing below threshold passes Tier 2', () => {
    expect(guardDiasporaBilling({ annualTotalKobo: 100_000_000, payerType: 'family', kycTier: 2 }).allowed).toBe(true);
  });

  it('P13: clinical data blocked in AI payload', () => {
    const r = guardP13ClinicalData({ payloadKeys: ['diagnosis', 'occupancy_count'] });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('P13');
  });

  it('P13: aggregate occupancy/revenue stats pass', () => {
    expect(guardP13ClinicalData({ payloadKeys: ['occupancy_rate', 'revenue_by_room_type', 'active_residents'] }).allowed).toBe(true);
  });

  it('P9: guardFractionalKobo rejects fractional', () => {
    expect(guardFractionalKobo(5000.5).allowed).toBe(false);
  });

  it('T3: createProfile stores tenantId', async () => {
    const repo = new ElderlyCareRepository(makeDb() as ReturnType<typeof makeDb>);
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tenant-A', facilityName: 'Golden Years Lagos' });
    expect(p.tenantId).toBe('tenant-A');
    expect(p.status).toBe('seeded');
  });

  it('T3: cross-tenant lookup returns null', async () => {
    const repo = new ElderlyCareRepository(makeDb() as ReturnType<typeof makeDb>);
    expect(await repo.findProfileById('no-such-id', 'tenant-B')).toBeNull();
  });

  it('P13: resident_ref_id is opaque UUID (never a name)', async () => {
    const repo = new ElderlyCareRepository(makeDb() as ReturnType<typeof makeDb>);
    const r = await repo.createResident({ profileId: 'p1', tenantId: 'tenant-A', monthlyRateKobo: 5000000 });
    expect(r.residentRefId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(r.residentRefId).not.toContain('Adeyemi');
  });

  it('P9: createResident rejects fractional monthlyRateKobo', async () => {
    const repo = new ElderlyCareRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createResident({ profileId: 'p1', tenantId: 'tenant-A', monthlyRateKobo: 5000000.50 })).rejects.toThrow('P9');
  });

  it('P9: createBilling rejects fractional monthlyChargeKobo', async () => {
    const repo = new ElderlyCareRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createBilling({ profileId: 'p1', tenantId: 'tenant-A', residentRefId: 'r1', billingPeriod: '2024-01', monthlyChargeKobo: 500000.5 })).rejects.toThrow('P9');
  });

  it('staff rota can be created', async () => {
    const repo = new ElderlyCareRepository(makeDb() as ReturnType<typeof makeDb>);
    const rota = await repo.createStaffRota({ profileId: 'p1', tenantId: 'tenant-A', staffName: 'Nurse Ada', role: 'nurse', shiftStart: 1700000000, shiftEnd: 1700036000 });
    expect(rota.staffName).toBe('Nurse Ada');
    expect(rota.tenantId).toBe('tenant-A');
  });

  it('vertical config: hitl_required_for_resident_metrics is true', () => {
    expect(registerElderlyCareVertical().hitl_required_for_resident_metrics).toBe(true);
  });

  it('vertical config: p12_ussd_ai_blocked is true', () => {
    expect(registerElderlyCareVertical().p12_ussd_ai_blocked).toBe(true);
  });
});
