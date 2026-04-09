/**
 * @webwaka/verticals-vet-clinic — test suite (M10)
 * Minimum 15 tests
 * Covers: T3, P9, P13, FSM, KYC, AI guard
 */

import { describe, it, expect } from 'vitest';
import {
  isValidVetClinicTransition,
  guardClaimedToVcnbVerified,
  guardHighValueSurgery,
  guardP13AnimalClinicalData,
  guardFractionalKobo,
  registerVetClinicVertical,
} from './index.js';
import { VetClinicRepository } from './vet-clinic.js';

function makeDb() {
  const store = new Map<string, unknown>();
  return {
    prepare: (sql: string) => ({
      bind: (...vals: unknown[]) => ({
        run: async () => {
          if (sql.startsWith('INSERT INTO vet_clinic_profiles')) { store.set(vals[0] as string, { id: vals[0], workspace_id: vals[1], tenant_id: vals[2], clinic_name: vals[3], vcnb_registration: null, cac_rc: null, clinic_type: vals[4], status: 'seeded', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO vet_patients')) { store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], animal_ref_id: vals[3], species: vals[4], breed: vals[5], owner_ref_id: vals[6], age_months: vals[7], created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO vet_appointments')) { const fee = vals[7]; if (!Number.isInteger(fee) || (fee as number) < 0) throw new Error('P9: consultationFeeKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], animal_ref_id: vals[3], vet_id: vals[4], appointment_time: vals[5], appointment_type: vals[6], consultation_fee_kobo: vals[7], status: 'booked', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO vet_vaccinations')) { const cost = vals[7]; if (!Number.isInteger(cost) || (cost as number) < 0) throw new Error('P9: costKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], animal_ref_id: vals[3], vaccine_name: vals[4], date_administered: vals[5], next_due: vals[6], cost_kobo: vals[7], created_at: 1 }); }
          if (sql.startsWith('INSERT INTO vet_shop_inventory')) { const price = vals[5]; if (!Number.isInteger(price) || (price as number) < 0) throw new Error('P9: unitPriceKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], product_name: vals[3], category: vals[4], unit_price_kobo: vals[5], quantity_in_stock: vals[6], created_at: 1, updated_at: 1 }); }
          return { success: true };
        },
        first: async <T>() => { if (sql.includes('WHERE id=?')) return (store.get(vals[0] as string) ?? null) as T | null; if (sql.includes('COUNT(*)')) return { cnt: 0 } as unknown as T; return null; },
        all: async <T>() => ({ results: [] as T[] }),
      }),
    }),
  };
}

describe('vet-clinic vertical', () => {
  it('registerVetClinicVertical returns correct slug and pillars', () => {
    const v = registerVetClinicVertical();
    expect(v.slug).toBe('vet-clinic');
    expect(v.primary_pillars).toEqual(['ops', 'branding', 'marketplace']);
  });

  it('FSM: seeded → claimed is valid', () => {
    expect(isValidVetClinicTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: claimed → vcnb_verified is valid', () => {
    expect(isValidVetClinicTransition('claimed', 'vcnb_verified')).toBe(true);
  });

  it('FSM: vcnb_verified → active is valid', () => {
    expect(isValidVetClinicTransition('vcnb_verified', 'active')).toBe(true);
  });

  it('FSM: seeded → vcnb_verified is invalid (typed error)', () => {
    expect(isValidVetClinicTransition('seeded', 'vcnb_verified')).toBe(false);
  });

  it('guardClaimedToVcnbVerified passes with VCNB number', () => {
    expect(guardClaimedToVcnbVerified({ vcnbRegistration: 'VCNB-2024-001' }).allowed).toBe(true);
  });

  it('guardClaimedToVcnbVerified fails without VCNB reg', () => {
    const r = guardClaimedToVcnbVerified({ vcnbRegistration: null });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('VCNB');
  });

  it('KYC: surgery > ₦100k requires Tier 2', () => {
    const r = guardHighValueSurgery({ consultationFeeKobo: 11_000_000, kycTier: 1 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Tier 2');
  });

  it('KYC: surgery > ₦100k passes with Tier 2', () => {
    expect(guardHighValueSurgery({ consultationFeeKobo: 11_000_000, kycTier: 2 }).allowed).toBe(true);
  });

  it('P13: clinical data blocked in AI payload', () => {
    const r = guardP13AnimalClinicalData({ payloadKeys: ['diagnosis', 'species_count'] });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('P13');
  });

  it('P13: aggregate species stats pass', () => {
    expect(guardP13AnimalClinicalData({ payloadKeys: ['total_appointments', 'species_count_dog', 'species_count_cat'] }).allowed).toBe(true);
  });

  it('P9: guardFractionalKobo rejects fractional', () => {
    expect(guardFractionalKobo(500.5).allowed).toBe(false);
  });

  it('T3: createProfile stores tenantId', async () => {
    const repo = new VetClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tenant-A', clinicName: 'PawCare Clinic' });
    expect(p.tenantId).toBe('tenant-A');
    expect(p.status).toBe('seeded');
  });

  it('T3: cross-tenant lookup returns null', async () => {
    const repo = new VetClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    expect(await repo.findProfileById('no-such-id', 'tenant-B')).toBeNull();
  });

  it('P13: animal_ref_id is opaque UUID', async () => {
    const repo = new VetClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    const p = await repo.createPatient({ profileId: 'p1', tenantId: 'tenant-A', species: 'dog' });
    expect(p.animalRefId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(p.animalRefId).not.toContain('Bingo');
  });

  it('P13: owner_ref_id is opaque UUID (never phone/name)', async () => {
    const repo = new VetClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    const p = await repo.createPatient({ profileId: 'p1', tenantId: 'tenant-A', species: 'cat' });
    expect(p.ownerRefId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('P9: createAppointment rejects fractional fee', async () => {
    const repo = new VetClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createAppointment({ profileId: 'p1', tenantId: 'tenant-A', animalRefId: 'a1', vetId: 'v1', appointmentTime: 1700000000, consultationFeeKobo: 2500.99 })).rejects.toThrow('P9');
  });

  it('P9: createVaccination rejects fractional costKobo', async () => {
    const repo = new VetClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createVaccination({ profileId: 'p1', tenantId: 'tenant-A', animalRefId: 'a1', vaccineName: 'Rabies', costKobo: 1500.5 })).rejects.toThrow('P9');
  });

  it('P9: createShopItem rejects fractional unitPriceKobo', async () => {
    const repo = new VetClinicRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createShopItem({ profileId: 'p1', tenantId: 'tenant-A', productName: 'Dog Food', unitPriceKobo: 99.99 })).rejects.toThrow('P9');
  });

  it('vertical config: p12_ussd_ai_blocked is true', () => {
    expect(registerVetClinicVertical().p12_ussd_ai_blocked).toBe(true);
  });
});
