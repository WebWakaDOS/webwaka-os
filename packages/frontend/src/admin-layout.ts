/**
 * Admin layout model — used by the admin dashboard app to know which
 * navigation items are available for a workspace, based on its subscription plan.
 *
 * Milestone 6 — Frontend Composition Layer
 */

import type { TenantManifest } from './tenant-manifest.js';

// ---------------------------------------------------------------------------
// Navigation item
// ---------------------------------------------------------------------------

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon?: string;
  badge?: string;
}

// ---------------------------------------------------------------------------
// Admin layout model
// ---------------------------------------------------------------------------

export interface AdminLayout {
  workspaceId: string;
  tenantSlug: string;
  displayName: string;
  navItems: NavItem[];
  plan: string;
  canInvite: boolean;
  canUpgrade: boolean;
  branding: TenantManifest['branding'];
}

// ---------------------------------------------------------------------------
// Plan → feature gates
// ---------------------------------------------------------------------------

interface PlanCapabilities {
  canInvite: boolean;
  canUpgrade: boolean;
  extraNavItems: NavItem[];
}

const PLAN_CAPS: Record<string, PlanCapabilities> = {
  free: {
    canInvite: false,
    canUpgrade: true,
    extraNavItems: [],
  },
  starter: {
    canInvite: true,
    canUpgrade: true,
    extraNavItems: [
      { key: 'analytics', label: 'Analytics', href: '/admin/analytics', icon: 'chart' },
    ],
  },
  growth: {
    canInvite: true,
    canUpgrade: true,
    extraNavItems: [
      { key: 'analytics', label: 'Analytics', href: '/admin/analytics', icon: 'chart' },
      { key: 'claims', label: 'Claims', href: '/admin/claims', icon: 'badge-check' },
    ],
  },
  enterprise: {
    canInvite: true,
    canUpgrade: false,
    extraNavItems: [
      { key: 'analytics', label: 'Analytics', href: '/admin/analytics', icon: 'chart' },
      { key: 'claims', label: 'Claims', href: '/admin/claims', icon: 'badge-check' },
      { key: 'api', label: 'API Access', href: '/admin/api', icon: 'code' },
    ],
  },
};

const BASE_NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', href: '/admin', icon: 'home' },
  { key: 'profiles', label: 'Profiles', href: '/admin/profiles', icon: 'users' },
  { key: 'billing', label: 'Billing', href: '/admin/billing', icon: 'credit-card' },
  { key: 'settings', label: 'Settings', href: '/admin/settings', icon: 'settings' },
];

/**
 * Build an AdminLayout model from a tenant manifest + subscription plan.
 */
export function buildAdminLayout(
  manifest: TenantManifest,
  plan: string,
): AdminLayout {
  const caps = PLAN_CAPS[plan] ?? PLAN_CAPS['free']!;

  return {
    workspaceId: manifest.tenantId,
    tenantSlug: manifest.tenantSlug,
    displayName: manifest.displayName,
    navItems: [...BASE_NAV, ...caps.extraNavItems],
    plan,
    canInvite: caps.canInvite,
    canUpgrade: caps.canUpgrade,
    branding: manifest.branding,
  };
}
