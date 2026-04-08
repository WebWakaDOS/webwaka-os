/**
 * packages/verticals — Entitlements Matrix
 * WebWaka OS M8 — Verticals Framework
 *
 * Static entitlements matrix for all 17 P1-Original verticals.
 * P2/P3 verticals are seeded in D1 via infra/db/seeds/0004_verticals-master.csv.
 *
 * Platform Invariant P2: Centrally maintained — never duplicated per vertical.
 */

import type { VerticalEntitlements } from './types.js';

export const VERTICAL_ENTITLEMENTS: Readonly<Record<string, VerticalEntitlements>> = {
  'politician': {
    slug: 'politician',
    required_kyc_tier: 2,
    requires_frsc: false,
    requires_cac: false,
    requires_it: false,
    requires_community: true,
    requires_social: true,
  },
  'political-party': {
    slug: 'political-party',
    required_kyc_tier: 2,
    requires_frsc: false,
    requires_cac: true,
    requires_it: false,
    requires_community: true,
    requires_social: true,
  },
  'motor-park': {
    slug: 'motor-park',
    required_kyc_tier: 2,
    requires_frsc: true,
    requires_cac: true,
    requires_it: false,
    requires_community: false,
    requires_social: false,
  },
  'mass-transit': {
    slug: 'mass-transit',
    required_kyc_tier: 2,
    requires_frsc: true,
    requires_cac: true,
    requires_it: false,
    requires_community: false,
    requires_social: false,
  },
  'rideshare': {
    slug: 'rideshare',
    required_kyc_tier: 2,
    requires_frsc: true,
    requires_cac: true,
    requires_it: false,
    requires_community: false,
    requires_social: false,
  },
  'haulage': {
    slug: 'haulage',
    required_kyc_tier: 3,
    requires_frsc: true,
    requires_cac: true,
    requires_it: false,
    requires_community: false,
    requires_social: false,
  },
  'church': {
    slug: 'church',
    required_kyc_tier: 1,
    requires_frsc: false,
    requires_cac: false,
    requires_it: true,
    requires_community: true,
    requires_social: false,
  },
  'ngo': {
    slug: 'ngo',
    required_kyc_tier: 1,
    requires_frsc: false,
    requires_cac: false,
    requires_it: true,
    requires_community: true,
    requires_social: false,
  },
  'cooperative': {
    slug: 'cooperative',
    required_kyc_tier: 2,
    requires_frsc: false,
    requires_cac: true,
    requires_it: false,
    requires_community: true,
    requires_social: false,
  },
  'pos-business': {
    slug: 'pos-business',
    required_kyc_tier: 1,
    requires_frsc: false,
    requires_cac: true,
    requires_it: false,
    requires_community: false,
    requires_social: false,
  },
  'market': {
    slug: 'market',
    required_kyc_tier: 1,
    requires_frsc: false,
    requires_cac: false,
    requires_it: false,
    requires_community: false,
    requires_social: false,
  },
  'professional': {
    slug: 'professional',
    required_kyc_tier: 2,
    requires_frsc: false,
    requires_cac: false,
    requires_it: false,
    requires_community: false,
    requires_social: true,
  },
  'school': {
    slug: 'school',
    required_kyc_tier: 1,
    requires_frsc: false,
    requires_cac: true,
    requires_it: false,
    requires_community: true,
    requires_social: false,
  },
  'clinic': {
    slug: 'clinic',
    required_kyc_tier: 2,
    requires_frsc: false,
    requires_cac: true,
    requires_it: false,
    requires_community: false,
    requires_social: false,
  },
  'creator': {
    slug: 'creator',
    required_kyc_tier: 1,
    requires_frsc: false,
    requires_cac: false,
    requires_it: false,
    requires_community: true,
    requires_social: true,
  },
  'sole-trader': {
    slug: 'sole-trader',
    required_kyc_tier: 1,
    requires_frsc: false,
    requires_cac: false,
    requires_it: false,
    requires_community: false,
    requires_social: true,
  },
  'tech-hub': {
    slug: 'tech-hub',
    required_kyc_tier: 1,
    requires_frsc: false,
    requires_cac: false,
    requires_it: false,
    requires_community: true,
    requires_social: false,
  },
} as const;

/**
 * Get entitlements for a vertical slug.
 * Returns null if not in the static matrix (use D1 lookup for P2/P3).
 */
export function getStaticEntitlements(slug: string): VerticalEntitlements | null {
  return VERTICAL_ENTITLEMENTS[slug] ?? null;
}
