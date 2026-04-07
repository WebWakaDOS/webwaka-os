/**
 * Plan capability matrix for WebWaka OS.
 * (entitlement-model.md, TDR-0005)
 *
 * Every plan's capabilities are defined here — the single source of truth
 * for what each subscription tier can access.
 */

import type { SubscriptionPlan } from '@webwaka/types';
import { PlatformLayer } from '@webwaka/types';

// ---------------------------------------------------------------------------
// Plan config shape
// ---------------------------------------------------------------------------

export interface PlanConfig {
  /** Maximum team members in a workspace. -1 = unlimited */
  maxUsers: number;
  /** Maximum managed Place nodes. -1 = unlimited */
  maxPlaces: number;
  /** Maximum active Offerings. -1 = unlimited */
  maxOfferings: number;
  /** Platform layers accessible on this plan */
  layers: PlatformLayer[];
  /** Whether custom branding (logo, colours) is permitted */
  brandingRights: boolean;
  /** 0=none, 1=partner branding, 2=sub-partner white-label */
  whiteLabelDepth: 0 | 1 | 2;
  /** Whether the workspace can create partner sub-workspaces */
  delegationRights: boolean;
  /** Whether AI-powered features are accessible */
  aiRights: boolean;
  /** Whether regulated/sensitive-sector modules are accessible (political, medical, etc.) */
  sensitiveSectorRights: boolean;
}

// ---------------------------------------------------------------------------
// Plan configuration matrix
// Single source of truth — all entitlement decisions derive from here.
// ---------------------------------------------------------------------------

export const PLAN_CONFIGS: Readonly<Record<SubscriptionPlan, PlanConfig>> = {
  free: {
    maxUsers: 3,
    maxPlaces: 1,
    maxOfferings: 5,
    layers: [PlatformLayer.Discovery],
    brandingRights: false,
    whiteLabelDepth: 0,
    delegationRights: false,
    aiRights: false,
    sensitiveSectorRights: false,
  },
  starter: {
    maxUsers: 10,
    maxPlaces: 3,
    maxOfferings: 25,
    layers: [PlatformLayer.Discovery, PlatformLayer.Operational],
    brandingRights: true,
    whiteLabelDepth: 0,
    delegationRights: false,
    aiRights: false,
    sensitiveSectorRights: false,
  },
  growth: {
    maxUsers: 50,
    maxPlaces: 10,
    maxOfferings: 100,
    layers: [
      PlatformLayer.Discovery,
      PlatformLayer.Operational,
      PlatformLayer.Commerce,
    ],
    brandingRights: true,
    whiteLabelDepth: 0,
    delegationRights: false,
    aiRights: true,
    sensitiveSectorRights: false,
  },
  pro: {
    maxUsers: 200,
    maxPlaces: 50,
    maxOfferings: -1,
    layers: [
      PlatformLayer.Discovery,
      PlatformLayer.Operational,
      PlatformLayer.Commerce,
      PlatformLayer.Transport,
      PlatformLayer.Professional,
      PlatformLayer.Creator,
    ],
    brandingRights: true,
    whiteLabelDepth: 1,
    delegationRights: false,
    aiRights: true,
    sensitiveSectorRights: false,
  },
  enterprise: {
    maxUsers: -1,
    maxPlaces: -1,
    maxOfferings: -1,
    layers: Object.values(PlatformLayer),
    brandingRights: true,
    whiteLabelDepth: 2,
    delegationRights: true,
    aiRights: true,
    sensitiveSectorRights: true,
  },
  partner: {
    maxUsers: -1,
    maxPlaces: -1,
    maxOfferings: -1,
    layers: Object.values(PlatformLayer),
    brandingRights: true,
    whiteLabelDepth: 2,
    delegationRights: true,
    aiRights: true,
    sensitiveSectorRights: true,
  },
  sub_partner: {
    maxUsers: -1,
    maxPlaces: 100,
    maxOfferings: -1,
    layers: [
      PlatformLayer.Discovery,
      PlatformLayer.Operational,
      PlatformLayer.Commerce,
      PlatformLayer.WhiteLabel,
    ],
    brandingRights: true,
    whiteLabelDepth: 1,
    delegationRights: false,
    aiRights: true,
    sensitiveSectorRights: false,
  },
} as const;
