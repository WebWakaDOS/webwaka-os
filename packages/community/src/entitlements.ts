/**
 * Community-specific entitlement guards.
 * Platform Invariant T5 — paid tiers / courses gated by plan.
 *
 * Guards: assertPaidTiersEnabled, assertCoursesEnabled, assertMaxSpaces
 */

export interface CommunityEntitlements {
  maxCommunitySpaces: number;
  paidTiersEnabled: boolean;
  coursesEnabled: boolean;
}

export const FREE_COMMUNITY_ENTITLEMENTS: CommunityEntitlements = {
  maxCommunitySpaces: 1,
  paidTiersEnabled: false,
  coursesEnabled: false,
};

export const PRO_COMMUNITY_ENTITLEMENTS: CommunityEntitlements = {
  maxCommunitySpaces: 5,
  paidTiersEnabled: true,
  coursesEnabled: true,
};

export const ENTERPRISE_COMMUNITY_ENTITLEMENTS: CommunityEntitlements = {
  maxCommunitySpaces: -1,
  paidTiersEnabled: true,
  coursesEnabled: true,
};

/**
 * Throws if the plan does not support paid membership tiers.
 */
export function assertPaidTiersEnabled(ents: CommunityEntitlements): void {
  if (!ents.paidTiersEnabled) {
    throw new Error(
      'ENTITLEMENT_DENIED: Paid membership tiers require a Pro or Enterprise plan',
    );
  }
}

/**
 * Throws if the plan does not support course creation.
 */
export function assertCoursesEnabled(ents: CommunityEntitlements): void {
  if (!ents.coursesEnabled) {
    throw new Error(
      'ENTITLEMENT_DENIED: Course creation requires a Pro or Enterprise plan',
    );
  }
}

/**
 * Throws if adding another space would exceed the plan limit.
 * -1 means unlimited (Enterprise).
 */
export function assertMaxSpaces(currentCount: number, ents: CommunityEntitlements): void {
  if (ents.maxCommunitySpaces !== -1 && currentCount >= ents.maxCommunitySpaces) {
    throw new Error(
      `ENTITLEMENT_DENIED: Maximum of ${ents.maxCommunitySpaces} community space(s) allowed on your current plan`,
    );
  }
}
