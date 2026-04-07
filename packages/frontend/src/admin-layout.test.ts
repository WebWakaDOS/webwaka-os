import { describe, it, expect } from 'vitest';
import { buildAdminLayout } from './admin-layout.js';
import type { TenantManifest } from './tenant-manifest.js';

const MANIFEST: TenantManifest = {
  tenantId: 'wsp_test',
  tenantSlug: 'acme',
  displayName: 'Acme Platform',
  branding: {
    primaryColour: '#1a1a2e',
    secondaryColour: '#e94560',
    fontFamily: 'Inter, sans-serif',
  },
  features: {
    discoveryEnabled: true,
    claimsEnabled: true,
    paymentsEnabled: true,
    analyticsEnabled: true,
  },
  allowedEntityTypes: ['individual', 'organization'],
  defaultLocale: 'en-NG',
  updatedAt: '2026-01-01 00:00:00',
};

describe('buildAdminLayout', () => {
  it('includes base nav items for all plans', () => {
    for (const plan of ['free', 'starter', 'growth', 'enterprise']) {
      const layout = buildAdminLayout(MANIFEST, plan);
      const keys = layout.navItems.map((n) => n.key);
      expect(keys).toContain('overview');
      expect(keys).toContain('profiles');
      expect(keys).toContain('billing');
      expect(keys).toContain('settings');
    }
  });

  it('free plan: canInvite=false, canUpgrade=true, no extra nav', () => {
    const layout = buildAdminLayout(MANIFEST, 'free');
    expect(layout.canInvite).toBe(false);
    expect(layout.canUpgrade).toBe(true);
    expect(layout.navItems).toHaveLength(4);  // only base items
  });

  it('starter plan: canInvite=true, has analytics nav', () => {
    const layout = buildAdminLayout(MANIFEST, 'starter');
    expect(layout.canInvite).toBe(true);
    const keys = layout.navItems.map((n) => n.key);
    expect(keys).toContain('analytics');
  });

  it('growth plan: has analytics + claims nav', () => {
    const layout = buildAdminLayout(MANIFEST, 'growth');
    const keys = layout.navItems.map((n) => n.key);
    expect(keys).toContain('analytics');
    expect(keys).toContain('claims');
  });

  it('enterprise plan: canUpgrade=false, has analytics + claims + api nav', () => {
    const layout = buildAdminLayout(MANIFEST, 'enterprise');
    expect(layout.canUpgrade).toBe(false);
    const keys = layout.navItems.map((n) => n.key);
    expect(keys).toContain('analytics');
    expect(keys).toContain('claims');
    expect(keys).toContain('api');
  });

  it('falls back to free caps for unknown plan', () => {
    const layout = buildAdminLayout(MANIFEST, 'legacy-plan');
    expect(layout.canInvite).toBe(false);
    expect(layout.canUpgrade).toBe(true);
  });

  it('sets workspaceId, tenantSlug, displayName, plan, branding', () => {
    const layout = buildAdminLayout(MANIFEST, 'growth');
    expect(layout.workspaceId).toBe('wsp_test');
    expect(layout.tenantSlug).toBe('acme');
    expect(layout.displayName).toBe('Acme Platform');
    expect(layout.plan).toBe('growth');
    expect(layout.branding.primaryColour).toBe('#1a1a2e');
  });
});
