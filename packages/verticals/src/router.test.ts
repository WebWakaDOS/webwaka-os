/**
 * packages/verticals — Router Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  extractEntitlements,
  checkActivationRequirements,
  assertVerticalActivationRequirements,
  VerticalActivationError,
} from './router.js';
import type { VerticalRecord, VerticalActivationContext } from './types.js';

function makeVerticalRecord(overrides: Partial<VerticalRecord> = {}): VerticalRecord {
  return {
    id: 'vtx_test',
    slug: 'test-vertical',
    display_name: 'Test Vertical',
    category: 'commerce',
    subcategory: null,
    priority: 2,
    status: 'active',
    entity_type: 'organization',
    fsm_states: '["seeded","claimed","active"]',
    required_kyc_tier: 1,
    requires_frsc: 0,
    requires_cac: 1,
    requires_it: 0,
    requires_community: 0,
    requires_social: 0,
    package_name: null,
    milestone_target: 'M9',
    notes: null,
    created_at: 1700000000,
    updated_at: 1700000000,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<VerticalActivationContext> = {}): VerticalActivationContext {
  return {
    workspaceId: 'wsp_test',
    tenantId: 'tenant_test',
    userId: 'usr_test',
    kycTier: 1,
    frscVerified: false,
    cacVerified: true,
    itVerified: false,
    ...overrides,
  };
}

describe('extractEntitlements', () => {
  it('extracts entitlements from VerticalRecord', () => {
    const record = makeVerticalRecord({
      required_kyc_tier: 2,
      requires_frsc: 1,
      requires_cac: 1,
      requires_it: 0,
      requires_community: 1,
      requires_social: 0,
    });

    const ents = extractEntitlements(record);
    expect(ents.required_kyc_tier).toBe(2);
    expect(ents.requires_frsc).toBe(true);
    expect(ents.requires_cac).toBe(true);
    expect(ents.requires_it).toBe(false);
    expect(ents.requires_community).toBe(true);
    expect(ents.requires_social).toBe(false);
  });

  it('maps integer flags correctly for non-required fields', () => {
    const record = makeVerticalRecord({
      requires_frsc: 0,
      requires_it: 0,
    });

    const ents = extractEntitlements(record);
    expect(ents.requires_frsc).toBe(false);
    expect(ents.requires_it).toBe(false);
  });
});

describe('checkActivationRequirements', () => {
  it('returns empty array when all requirements met', () => {
    const ents = extractEntitlements(makeVerticalRecord({ required_kyc_tier: 1, requires_cac: 1 }));
    const ctx = makeCtx({ kycTier: 2, cacVerified: true });
    expect(checkActivationRequirements(ents, ctx)).toHaveLength(0);
  });

  it('returns KYC requirement when tier insufficient', () => {
    const ents = extractEntitlements(makeVerticalRecord({ required_kyc_tier: 2 }));
    const ctx = makeCtx({ kycTier: 1 });
    const unmet = checkActivationRequirements(ents, ctx);
    expect(unmet.length).toBeGreaterThan(0);
    expect(unmet[0]).toContain('KYC Tier 2');
  });

  it('returns FRSC requirement when FRSC not verified', () => {
    const ents = extractEntitlements(makeVerticalRecord({ requires_frsc: 1, required_kyc_tier: 1 }));
    const ctx = makeCtx({ frscVerified: false, kycTier: 2 });
    const unmet = checkActivationRequirements(ents, ctx);
    expect(unmet.some((u) => u.includes('FRSC'))).toBe(true);
  });

  it('returns CAC requirement when CAC not verified', () => {
    const ents = extractEntitlements(makeVerticalRecord({ requires_cac: 1, required_kyc_tier: 1 }));
    const ctx = makeCtx({ cacVerified: false, kycTier: 2 });
    const unmet = checkActivationRequirements(ents, ctx);
    expect(unmet.some((u) => u.includes('CAC'))).toBe(true);
  });

  it('returns IT requirement when IT not verified', () => {
    const ents = extractEntitlements(makeVerticalRecord({ requires_it: 1, requires_cac: 0, required_kyc_tier: 1 }));
    const ctx = makeCtx({ itVerified: false, kycTier: 2 });
    const unmet = checkActivationRequirements(ents, ctx);
    expect(unmet.some((u) => u.includes('Incorporated Trustees'))).toBe(true);
  });

  it('returns multiple unmet requirements', () => {
    const ents = extractEntitlements(makeVerticalRecord({
      required_kyc_tier: 3,
      requires_frsc: 1,
      requires_cac: 1,
    }));
    const ctx = makeCtx({ kycTier: 1, frscVerified: false, cacVerified: false });
    const unmet = checkActivationRequirements(ents, ctx);
    expect(unmet.length).toBeGreaterThanOrEqual(3);
  });
});

describe('assertVerticalActivationRequirements', () => {
  it('does not throw when all requirements met', () => {
    const ents = extractEntitlements(makeVerticalRecord({ required_kyc_tier: 1, requires_cac: 1 }));
    const ctx = makeCtx({ kycTier: 2, cacVerified: true });
    expect(() => assertVerticalActivationRequirements(ents, ctx)).not.toThrow();
  });

  it('throws VerticalActivationError when requirements not met', () => {
    const ents = extractEntitlements(makeVerticalRecord({ required_kyc_tier: 2, requires_frsc: 1 }));
    const ctx = makeCtx({ kycTier: 1, frscVerified: false });
    expect(() => assertVerticalActivationRequirements(ents, ctx)).toThrow(VerticalActivationError);
  });

  it('VerticalActivationError contains slug and unmet requirements', () => {
    const record = makeVerticalRecord({ slug: 'motor-park', required_kyc_tier: 2, requires_frsc: 1 });
    const ents = extractEntitlements(record);
    const ctx = makeCtx({ kycTier: 1, frscVerified: false });

    try {
      assertVerticalActivationRequirements(ents, ctx);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(VerticalActivationError);
      const err = e as VerticalActivationError;
      expect(err.slug).toBe('motor-park');
      expect(err.unmetRequirements.length).toBeGreaterThan(0);
    }
  });
});

describe('getStaticEntitlements', () => {
  it('verifies static matrix contains all 17 P1-Original verticals', async () => {
    const { getStaticEntitlements } = await import('./entitlements.js');

    const p1Slugs = [
      'politician', 'political-party', 'motor-park', 'mass-transit',
      'rideshare', 'haulage', 'church', 'ngo', 'cooperative',
      'pos-business', 'market', 'professional', 'school', 'clinic',
      'creator', 'sole-trader', 'tech-hub',
    ];

    for (const slug of p1Slugs) {
      const ents = getStaticEntitlements(slug);
      expect(ents, `Missing static entitlements for ${slug}`).not.toBeNull();
      expect(ents?.slug).toBe(slug);
    }
  });

  it('returns null for unknown vertical slug', async () => {
    const { getStaticEntitlements } = await import('./entitlements.js');
    expect(getStaticEntitlements('totally-unknown-vertical')).toBeNull();
  });
});
