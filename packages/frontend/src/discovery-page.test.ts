import { describe, it, expect } from 'vitest';
import { buildDiscoveryPage, normaliseDiscoveryQuery } from './discovery-page.js';
import type { TenantManifest } from './tenant-manifest.js';
import type { RenderedProfile } from './profile-renderer.js';

const MANIFEST: TenantManifest = {
  tenantId: 'wsp_test',
  tenantSlug: 'ng-senate',
  displayName: 'Nigeria Senate',
  branding: {
    primaryColour: '#1a1a2e',
    secondaryColour: '#e94560',
  },
  features: {
    discoveryEnabled: true,
    claimsEnabled: true,
    paymentsEnabled: false,
    analyticsEnabled: false,
  },
  allowedEntityTypes: ['individual'],
  defaultLocale: 'en-NG',
  updatedAt: '2026-01-01 00:00:00',
};

function makeProfile(id: string): RenderedProfile {
  return {
    id,
    entityId: `ind_${id}`,
    entityType: 'individual',
    displayName: `Senator ${id}`,
    headline: null,
    avatarUrl: null,
    placeId: 'lagos',
    isVerified: false,
    isClaimed: false,
    content: {},
    branding: { primaryColour: '#1a1a2e', secondaryColour: '#e94560' },
    canClaim: true,
  };
}

describe('buildDiscoveryPage', () => {
  it('builds a discovery page with correct pagination', () => {
    const profiles = [makeProfile('p1'), makeProfile('p2')];
    const page = buildDiscoveryPage(MANIFEST, profiles, 42, {
      tenantSlug: 'ng-senate',
      page: 2,
      perPage: 20,
    });

    expect(page.total).toBe(42);
    expect(page.page).toBe(2);
    expect(page.perPage).toBe(20);
    expect(page.totalPages).toBe(3);  // ceil(42/20)
    expect(page.profiles).toHaveLength(2);
    expect(page.manifest).toBe(MANIFEST);
  });

  it('defaults to page 1 when not provided', () => {
    const page = buildDiscoveryPage(MANIFEST, [], 0, { tenantSlug: 'test' });
    expect(page.page).toBe(1);
    expect(page.totalPages).toBe(1);  // max(1, ceil(0/20))
  });

  it('includes facets when provided', () => {
    const facets = {
      entityTypes: [{ label: 'Individual', value: 'individual', count: 10 }],
      places: [{ label: 'Lagos', value: 'lagos', count: 5 }],
    };

    const page = buildDiscoveryPage(MANIFEST, [], 15, { tenantSlug: 'test' }, facets);

    expect(page.facets.entityTypes).toHaveLength(1);
    expect(page.facets.places).toHaveLength(1);
    expect(page.facets.entityTypes[0]?.value).toBe('individual');
  });

  it('returns empty facets when not provided', () => {
    const page = buildDiscoveryPage(MANIFEST, [], 0, { tenantSlug: 'test' });
    expect(page.facets.entityTypes).toEqual([]);
    expect(page.facets.places).toEqual([]);
  });
});

describe('normaliseDiscoveryQuery', () => {
  it('normalises a full query', () => {
    const q = normaliseDiscoveryQuery({
      tenantSlug: 'ng-senate',
      q: 'emeka',
      entityType: 'individual',
      placeId: 'anambra',
      page: '3',
      perPage: '10',
    });

    expect(q.tenantSlug).toBe('ng-senate');
    expect(q.q).toBe('emeka');
    expect(q.entityType).toBe('individual');
    expect(q.page).toBe(3);
    expect(q.perPage).toBe(10);
  });

  it('defaults page to 1 and perPage to 20', () => {
    const q = normaliseDiscoveryQuery({ tenantSlug: 'test' });
    expect(q.page).toBe(1);
    expect(q.perPage).toBe(20);
  });

  it('clamps perPage to max 100', () => {
    const q = normaliseDiscoveryQuery({ tenantSlug: 'test', perPage: '999' });
    expect(q.perPage).toBe(100);
  });

  it('clamps page to min 1', () => {
    const q = normaliseDiscoveryQuery({ tenantSlug: 'test', page: '-5' });
    expect(q.page).toBe(1);
  });

  it('returns undefined for absent optional fields', () => {
    const q = normaliseDiscoveryQuery({ tenantSlug: 'test' });
    expect(q.q).toBeUndefined();
    expect(q.entityType).toBeUndefined();
    expect(q.placeId).toBeUndefined();
  });
});
