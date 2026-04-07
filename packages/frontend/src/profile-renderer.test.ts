import { describe, it, expect } from 'vitest';
import { renderProfile, renderProfileList } from './profile-renderer.js';
import type { ProfileRow } from './profile-renderer.js';
import type { TenantManifest } from './tenant-manifest.js';

const MANIFEST: TenantManifest = {
  tenantId: 'wsp_test',
  tenantSlug: 'test-tenant',
  displayName: 'Test Tenant',
  branding: {
    primaryColour: '#1a1a2e',
    secondaryColour: '#e94560',
    fontFamily: 'Inter, sans-serif',
  },
  features: {
    discoveryEnabled: true,
    claimsEnabled: true,
    paymentsEnabled: false,
    analyticsEnabled: false,
  },
  allowedEntityTypes: ['individual', 'organization'],
  defaultLocale: 'en-NG',
  updatedAt: '2026-01-01 00:00:00',
};

const BASE_ROW: ProfileRow = {
  id: 'prf_001',
  entity_id: 'ind_001',
  entity_type: 'individual',
  display_name: 'Emeka Obi',
  headline: 'Senator, Anambra East',
  avatar_url: null,
  place_id: 'anambra',
  visibility: 'public',
  claim_status: null,
  content: null,
  created_at: '2026-01-01 00:00:00',
};

describe('renderProfile', () => {
  it('renders basic profile correctly', () => {
    const profile = renderProfile(BASE_ROW, MANIFEST);

    expect(profile.id).toBe('prf_001');
    expect(profile.entityId).toBe('ind_001');
    expect(profile.displayName).toBe('Emeka Obi');
    expect(profile.isVerified).toBe(false);
    expect(profile.isClaimed).toBe(false);
  });

  it('marks profile as claimed and verified when claim_status is approved', () => {
    const row = { ...BASE_ROW, claim_status: 'approved' };
    const profile = renderProfile(row, MANIFEST);

    expect(profile.isClaimed).toBe(true);
    expect(profile.isVerified).toBe(true);
  });

  it('canClaim is true when profile not claimed and claims enabled', () => {
    const profile = renderProfile(BASE_ROW, MANIFEST);
    expect(profile.canClaim).toBe(true);
  });

  it('canClaim is false when profile is already claimed', () => {
    const row = { ...BASE_ROW, claim_status: 'approved' };
    const profile = renderProfile(row, MANIFEST);
    expect(profile.canClaim).toBe(false);
  });

  it('canClaim is false when claims feature is disabled', () => {
    const manifest = {
      ...MANIFEST,
      features: { ...MANIFEST.features, claimsEnabled: false },
    };
    const profile = renderProfile(BASE_ROW, manifest);
    expect(profile.canClaim).toBe(false);
  });

  it('parses JSON content field', () => {
    const row = { ...BASE_ROW, content: JSON.stringify({ bio: 'A long bio text.' }) };
    const profile = renderProfile(row, MANIFEST);
    expect(profile.content).toEqual({ bio: 'A long bio text.' });
  });

  it('returns empty object for invalid JSON content', () => {
    const row = { ...BASE_ROW, content: 'bad json{{' };
    const profile = renderProfile(row, MANIFEST);
    expect(profile.content).toEqual({});
  });

  it('includes tenant branding in rendered profile', () => {
    const profile = renderProfile(BASE_ROW, MANIFEST);
    expect(profile.branding.primaryColour).toBe('#1a1a2e');
    expect(profile.branding.secondaryColour).toBe('#e94560');
  });
});

describe('renderProfileList', () => {
  it('filters out non-public profiles', () => {
    const rows: ProfileRow[] = [
      { ...BASE_ROW, id: 'prf_pub', visibility: 'public' },
      { ...BASE_ROW, id: 'prf_priv', visibility: 'private' },
      { ...BASE_ROW, id: 'prf_semi', visibility: 'semi' },
    ];

    const profiles = renderProfileList(rows, MANIFEST);

    expect(profiles).toHaveLength(2);
    expect(profiles.map((p) => p.id)).toContain('prf_pub');
    expect(profiles.map((p) => p.id)).toContain('prf_semi');
    expect(profiles.map((p) => p.id)).not.toContain('prf_priv');
  });

  it('returns empty array for empty input', () => {
    expect(renderProfileList([], MANIFEST)).toEqual([]);
  });
});
