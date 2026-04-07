/**
 * Opaque ID types for all root entities.
 * IDs are opaque strings — never sequential integers exposed to clients.
 * (Platform Invariant T3, Security Baseline §4)
 */

/** Branded string type for compile-time ID safety */
type BrandedId<Brand extends string> = string & { readonly __brand: Brand };

export type IndividualId = BrandedId<'Individual'>;
export type OrganizationId = BrandedId<'Organization'>;
export type PlaceId = BrandedId<'Place'>;
export type OfferingId = BrandedId<'Offering'>;
export type ProfileId = BrandedId<'Profile'>;
export type WorkspaceId = BrandedId<'Workspace'>;
export type BrandSurfaceId = BrandedId<'BrandSurface'>;
export type UserId = BrandedId<'User'>;
export type TenantId = BrandedId<'Tenant'>;
export type SubscriptionId = BrandedId<'Subscription'>;
export type ClaimId = BrandedId<'Claim'>;
export type PoliticalAssignmentId = BrandedId<'PoliticalAssignment'>;
export type JurisdictionId = BrandedId<'Jurisdiction'>;
export type TermId = BrandedId<'Term'>;
export type MembershipId = BrandedId<'Membership'>;
export type PartyAffiliationId = BrandedId<'PartyAffiliation'>;
export type AuditLogId = BrandedId<'AuditLog'>;

/**
 * Helper to cast a raw string to a typed ID.
 * Use only at trust boundaries (DB reads, API inputs after validation).
 */
export function asId<T extends BrandedId<string>>(raw: string): T {
  return raw as T;
}
