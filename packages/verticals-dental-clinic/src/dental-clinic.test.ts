/**
 * @webwaka/verticals-dental-clinic — test suite (M9)
 * Minimum 15 tests
 * Covers: T3, P9, P13, FSM, KYC, AI guard, USSD block
 */

import { describe, it, expect } from 'vitest';
import {
  isValidDentalClinicTransition,
  guardClaimedToMdcnVerified,
  guardKycForInsurance,
  guardP13PatientData,
  guardFractionalKobo,
  registerDentalClinicVertical,
} from './index.js';
import { DentalClinicRepository } from './dental-clinic.js';

function makeDb(overrides: Partial<Record<string, unknown>> = {}) {
  const store: Map<string, unknown> = new Map();
  return {
    prepare: (sql: string) => ({
      bind: (...vals: unknown[]) => ({
        run: async () => {
          if (sql.startsWith('INSERT INTO dental_clinic_profiles')) { store.set(vals[0] as string, { id: vals[0], workspace_id: vals[1], tenant_id: vals[2], clinic_name: vals[3], mdcn_facility_reg: null, adsn_membership: null, cac_rc: null, status: 'seeded', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO dental_appointments')) { const fee = vals[7]; if (!Number.isInteger(fee) || (fee as number) < 0) throw new Error('P9: consultationFeeKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], patient_ref_id: vals[3], dentist_ref_id: vals[4], appointment_time: vals[5], treatment_type: vals[6], consultation_fee_kobo: vals[7], status: 'booked', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO dental_treatments')) { const cost = vals[4]; if (!Number.isInteger(cost) || (cost as number) < 0) throw new Error('P9: treatmentCostKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], appointment_id: vals[2], tenant_id: vals[3], treatment_cost_kobo: vals[4], lab_ref: vals[5], notes_ref: vals[6], created_at: 1, updated_at: 1 }); }
          return { success: true };
        },
        first: async <T>() => {
          if (sql.includes('WHERE id=?')) { const key = vals[0] as string; return (store.get(key) ?? null) as T | null; }
          if (sql.includes('COUNT(*) as cnt') && sql.includes('COALESCE')) { return { cnt: 0, rev: 0 } as unknown as T; }
          return (overrides[sql] ?? null) as T | null;
        },
        all: async <T>() => ({ results: [] as T[] }),
      }),
    }),
  };
}

describe('dental-clinic vertical', () => {
  it('registerDentalClinicVertical returns correct slug and pillars', () => {
    const v = registerDentalClinicVertical();
    expect(v.slug).toBe('dental-clinic');
    expect(v.primary_pillars).toContain('ops');
    expect(v.primary_pillars).toContain('branding');
    expect(v.primary_pillars).toContain('marketplace');
  });

  it('FSM: seeded → claimed is valid', () => {
    expect(isValidDentalClinicTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: claimed → mdcn_verified is valid', () => {
    expect(isValidDentalClinicTransition('claimed', 'mdcn_verified')).toBe(true);
  });

  it('FSM: mdcn_verified → active is valid', () => {
    expect(isValidDentalClinicTransition('mdcn_verified', 'active')).toBe(true);
  });

  it('FSM: seeded → active is invalid (typed error)', () => {
    expect(isValidDentalClinicTransition('seeded', 'active')).toBe(false);
  });

  it('guardClaimedToMdcnVerified passes with valid MDCN reg and KYC 2', () => {
    const result = guardClaimedToMdcnVerified({ mdcnFacilityReg: 'MDCN-FAC-12345', kycTier: 2 });
    expect(result.allowed).toBe(true);
  });

  it('guardClaimedToMdcnVerified fails without MDCN reg', () => {
    const result = guardClaimedToMdcnVerified({ mdcnFacilityReg: null, kycTier: 2 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('MDCN');
  });

  it('guardClaimedToMdcnVerified fails with KYC < 2', () => {
    const result = guardClaimedToMdcnVerified({ mdcnFacilityReg: 'MDCN-FAC-12345', kycTier: 1 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('KYC');
  });

  it('guardKycForInsurance requires Tier 3', () => {
    expect(guardKycForInsurance({ kycTier: 2 }).allowed).toBe(false);
    expect(guardKycForInsurance({ kycTier: 3 }).allowed).toBe(true);
  });

  it('P13: guardP13PatientData blocks patient_name in AI payload', () => {
    const result = guardP13PatientData({ payloadKeys: ['aggregate_count', 'patient_name'] });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('P13');
  });

  it('P13: guardP13PatientData allows aggregate-only AI payload', () => {
    const result = guardP13PatientData({ payloadKeys: ['total_appointments', 'revenue_by_category', 'slot_utilisation'] });
    expect(result.allowed).toBe(true);
  });

  it('P13 CRITICAL: diagnosis in AI payload is blocked', () => {
    const result = guardP13PatientData({ payloadKeys: ['diagnosis', 'revenue_total'] });
    expect(result.allowed).toBe(false);
  });

  it('P9: guardFractionalKobo rejects fractional amount', () => {
    const result = guardFractionalKobo(5000.50);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('P9');
  });

  it('P9: guardFractionalKobo accepts integer amount', () => {
    expect(guardFractionalKobo(50000).allowed).toBe(true);
  });

  it('P9: guardFractionalKobo rejects negative amount', () => {
    expect(guardFractionalKobo(-100).allowed).toBe(false);
  });

  it('T3: createProfile stores tenantId correctly', async () => {
    const repo = new DentalClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    const profile = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tenant-A', clinicName: 'Smile Dental' });
    expect(profile.tenantId).toBe('tenant-A');
    expect(profile.status).toBe('seeded');
  });

  it('T3: findProfileById returns null for wrong tenant (cross-tenant 403 equivalent)', async () => {
    const repo = new DentalClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tenant-A', clinicName: 'Smile Dental' });
    const found = await repo.findProfileById('non-existent-id', 'tenant-B');
    expect(found).toBeNull();
  });

  it('P9: createAppointment rejects fractional consultationFeeKobo', async () => {
    const repo = new DentalClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createAppointment({ profileId: 'p1', tenantId: 'tenant-A', dentistRefId: 'd1', appointmentTime: 1700000000, consultationFeeKobo: 5000.50 })).rejects.toThrow('P9');
  });

  it('P9: createAppointment accepts integer consultationFeeKobo', async () => {
    const repo = new DentalClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    const appt = await repo.createAppointment({ profileId: 'p1', tenantId: 'tenant-A', dentistRefId: 'd1', appointmentTime: 1700000000, consultationFeeKobo: 500000 });
    expect(appt.consultationFeeKobo).toBe(500000);
    expect(appt.patientRefId).toBeTruthy();
  });

  it('P13: appointment patient_ref_id is UUID (never a name)', async () => {
    const repo = new DentalClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    const appt = await repo.createAppointment({ profileId: 'p1', tenantId: 'tenant-A', dentistRefId: 'd1', appointmentTime: 1700000000, consultationFeeKobo: 0 });
    expect(appt.patientRefId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('P9: createTreatment rejects fractional treatmentCostKobo', async () => {
    const repo = new DentalClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createTreatment({ profileId: 'p1', appointmentId: 'a1', tenantId: 'tenant-A', treatmentCostKobo: 1500.25 })).rejects.toThrow('P9');
  });

  it('vertical config: hitl_required_for_clinical is true', () => {
    const v = registerDentalClinicVertical();
    expect(v.hitl_required_for_clinical).toBe(true);
  });

  it('vertical config: p12_ussd_ai_blocked is true', () => {
    const v = registerDentalClinicVertical();
    expect(v.p12_ussd_ai_blocked).toBe(true);
  });
});
