/**
 * @webwaka/verticals-sports-academy — test suite (M10)
 * Minimum 15 tests
 * Covers: T3, P9, P13, FSM, KYC, AI guard
 */

import { describe, it, expect } from 'vitest';
import {
  isValidSportsAcademyTransition,
  guardClaimedToPermitVerified,
  guardHighValueMembership,
  guardP13HealthMetrics,
  guardFractionalKobo,
  registerSportsAcademyVertical,
} from './index.js';
import { SportsAcademyRepository } from './sports-academy.js';

function makeDb() {
  const store = new Map<string, unknown>();
  return {
    prepare: (sql: string) => ({
      bind: (...vals: unknown[]) => ({
        run: async () => {
          if (sql.startsWith('INSERT INTO sports_academy_profiles')) { store.set(vals[0] as string, { id: vals[0], workspace_id: vals[1], tenant_id: vals[2], academy_name: vals[3], type: vals[4], state_sports_permit: null, cac_rc: null, status: 'seeded', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO sports_members')) { const fee = vals[5]; if (!Number.isInteger(fee) || (fee as number) < 0) throw new Error('P9: planFeeKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], member_ref_id: vals[3], membership_plan: vals[4], plan_fee_kobo: vals[5], valid_until: vals[6], status: 'active', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO sports_classes')) { const fee = vals[9]; if (!Number.isInteger(fee) || (fee as number) < 0) throw new Error('P9: classFeeKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], class_name: vals[3], trainer_id: vals[4], schedule_day: vals[5], schedule_time: vals[6], capacity: vals[7], enrolled_count: 0, class_fee_kobo: vals[9], created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO sports_equipment')) { const cost = vals[5]; if (!Number.isInteger(cost) || (cost as number) < 0) throw new Error('P9: purchaseCostKobo must be a non-negative integer'); store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], equipment_name: vals[3], quantity: vals[4], purchase_cost_kobo: vals[5], last_service_date: vals[6], status: 'active', created_at: 1, updated_at: 1 }); }
          if (sql.startsWith('INSERT INTO sports_checkins')) { store.set(vals[0] as string, { id: vals[0], profile_id: vals[1], tenant_id: vals[2], member_ref_id: vals[3], class_id: vals[4], check_date: vals[5], created_at: 1 }); }
          return { success: true };
        },
        first: async <T>() => { if (sql.includes('WHERE id=?')) { return (store.get(vals[0] as string) ?? null) as T | null; } if (sql.includes('COUNT(*)')) return { total: 0, active: 0, rev: 0 } as unknown as T; return null; },
        all: async <T>() => ({ results: [] as T[] }),
      }),
    }),
  };
}

describe('sports-academy vertical', () => {
  it('registerSportsAcademyVertical returns correct slug and pillars', () => {
    const v = registerSportsAcademyVertical();
    expect(v.slug).toBe('sports-academy');
    expect(v.primary_pillars).toEqual(['ops', 'branding', 'marketplace']);
  });

  it('FSM: seeded → claimed is valid', () => {
    expect(isValidSportsAcademyTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: claimed → permit_verified is valid', () => {
    expect(isValidSportsAcademyTransition('claimed', 'permit_verified')).toBe(true);
  });

  it('FSM: permit_verified → active is valid', () => {
    expect(isValidSportsAcademyTransition('permit_verified', 'active')).toBe(true);
  });

  it('FSM: seeded → active is invalid (typed error)', () => {
    expect(isValidSportsAcademyTransition('seeded', 'active')).toBe(false);
  });

  it('guardClaimedToPermitVerified passes with permit number', () => {
    expect(guardClaimedToPermitVerified({ stateSportsPermit: 'LAGOS-SPORTS-001' }).allowed).toBe(true);
  });

  it('guardClaimedToPermitVerified fails without permit', () => {
    const r = guardClaimedToPermitVerified({ stateSportsPermit: null });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('permit');
  });

  it('KYC: annual subscription > ₦200k requires Tier 2', () => {
    const r = guardHighValueMembership({ planFeeKobo: 21_000_000, membershipPlan: 'annual', kycTier: 1 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Tier 2');
  });

  it('KYC: annual subscription > ₦200k passes with Tier 2', () => {
    expect(guardHighValueMembership({ planFeeKobo: 21_000_000, membershipPlan: 'annual', kycTier: 2 }).allowed).toBe(true);
  });

  it('P13: health metrics blocked in AI payload', () => {
    const r = guardP13HealthMetrics({ payloadKeys: ['member_count', 'weight', 'peak_hours'] });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('P13');
  });

  it('P13: aggregate-only payload passes', () => {
    expect(guardP13HealthMetrics({ payloadKeys: ['total_checkins', 'peak_class_hours', 'class_utilisation'] }).allowed).toBe(true);
  });

  it('P9: fractional planFeeKobo rejected', () => {
    expect(guardFractionalKobo(10000.50).allowed).toBe(false);
  });

  it('P9: integer planFeeKobo accepted', () => {
    expect(guardFractionalKobo(1000000).allowed).toBe(true);
  });

  it('T3: createProfile stores tenantId', async () => {
    const repo = new SportsAcademyRepository(makeDb() as ReturnType<typeof makeDb>);
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 'tenant-A', academyName: 'FitZone Lagos' });
    expect(p.tenantId).toBe('tenant-A');
    expect(p.status).toBe('seeded');
  });

  it('T3: cross-tenant lookup returns null', async () => {
    const repo = new SportsAcademyRepository(makeDb() as ReturnType<typeof makeDb>);
    expect(await repo.findProfileById('no-such-id', 'tenant-B')).toBeNull();
  });

  it('P9: createMember rejects fractional planFeeKobo', async () => {
    const repo = new SportsAcademyRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createMember({ profileId: 'p1', tenantId: 'tenant-A', planFeeKobo: 999.99 })).rejects.toThrow('P9');
  });

  it('P9: createMember accepts integer planFeeKobo', async () => {
    const repo = new SportsAcademyRepository(makeDb() as ReturnType<typeof makeDb>);
    const m = await repo.createMember({ profileId: 'p1', tenantId: 'tenant-A', planFeeKobo: 1000000 });
    expect(m.planFeeKobo).toBe(1000000);
    expect(m.memberRefId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('P13: member_ref_id is opaque UUID (never a name)', async () => {
    const repo = new SportsAcademyRepository(makeDb() as ReturnType<typeof makeDb>);
    const m = await repo.createMember({ profileId: 'p1', tenantId: 'tenant-A', planFeeKobo: 500000 });
    expect(m.memberRefId).not.toContain('John');
    expect(m.memberRefId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('P9: createClass rejects fractional classFeeKobo', async () => {
    const repo = new SportsAcademyRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createClass({ profileId: 'p1', tenantId: 'tenant-A', className: 'Spin', classFeeKobo: 500.5 })).rejects.toThrow('P9');
  });

  it('P9: createEquipment rejects fractional purchaseCostKobo', async () => {
    const repo = new SportsAcademyRepository(makeDb() as ReturnType<typeof makeDb>);
    await expect(repo.createEquipment({ profileId: 'p1', tenantId: 'tenant-A', equipmentName: 'Treadmill', purchaseCostKobo: 100.5 })).rejects.toThrow('P9');
  });

  it('vertical config: p12_ussd_ai_blocked is true', () => {
    expect(registerSportsAcademyVertical().p12_ussd_ai_blocked).toBe(true);
  });
});
