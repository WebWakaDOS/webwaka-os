/**
 * Platform-wide enums derived from approved governance documents.
 * Universal Entity Model, Geography Taxonomy, Political Taxonomy, Entitlement Model.
 */

// ---------------------------------------------------------------------------
// Root entity type discriminant
// ---------------------------------------------------------------------------

export const EntityType = {
  Individual: 'individual',
  Organization: 'organization',
  Place: 'place',
  Offering: 'offering',
  Profile: 'profile',
  Workspace: 'workspace',
  BrandSurface: 'brand_surface',
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

// ---------------------------------------------------------------------------
// Geography hierarchy levels (geography-taxonomy.md)
// ---------------------------------------------------------------------------

export const GeographyLevel = {
  Country: 1,
  GeopoliticalZone: 2,
  State: 3,
  LocalGovernmentArea: 4,
  Ward: 5,
  Community: 6,
  Household: 7,
  FacilityPlace: 8,
} as const;

export type GeographyLevel = (typeof GeographyLevel)[keyof typeof GeographyLevel];

export const GeographyType = {
  Country: 'country',
  GeopoliticalZone: 'geopolitical_zone',
  State: 'state',
  LocalGovernmentArea: 'local_government_area',
  Ward: 'ward',
  Community: 'community',
  Household: 'household',
  // Facility sub-types
  Market: 'market',
  MotorPark: 'motor_park',
  Warehouse: 'warehouse',
  Office: 'office',
  Branch: 'branch',
  Hub: 'hub',
  ConstituencyOffice: 'constituency_office',
  Campus: 'campus',
  Clinic: 'clinic',
  School: 'school',
} as const;

export type GeographyType = (typeof GeographyType)[keyof typeof GeographyType];

/** Which geography types are facility-level (level 8) */
export const FACILITY_GEOGRAPHY_TYPES: ReadonlySet<GeographyType> = new Set([
  GeographyType.Market,
  GeographyType.MotorPark,
  GeographyType.Warehouse,
  GeographyType.Office,
  GeographyType.Branch,
  GeographyType.Hub,
  GeographyType.ConstituencyOffice,
  GeographyType.Campus,
  GeographyType.Clinic,
  GeographyType.School,
]);

// ---------------------------------------------------------------------------
// Political office types and territory types (political-taxonomy.md)
// ---------------------------------------------------------------------------

export const PoliticalOfficeType = {
  Councilor: 'councilor',
  LocalGovernmentChairman: 'local_government_chairman',
  StateHouseOfAssemblyMember: 'state_house_of_assembly_member',
  HouseOfRepresentativesMember: 'house_of_representatives_member',
  Senator: 'senator',
  Governor: 'governor',
  President: 'president',
} as const;

export type PoliticalOfficeType = (typeof PoliticalOfficeType)[keyof typeof PoliticalOfficeType];

export const PoliticalTerritoryType = {
  Ward: 'ward',
  LocalGovernmentArea: 'local_government_area',
  StateConstituency: 'state_constituency',
  FederalConstituency: 'federal_constituency',
  SenatorialDistrict: 'senatorial_district',
  State: 'state',
  Country: 'country',
} as const;

export type PoliticalTerritoryType =
  (typeof PoliticalTerritoryType)[keyof typeof PoliticalTerritoryType];

// ---------------------------------------------------------------------------
// Claim lifecycle states (claim-first-onboarding.md)
// ---------------------------------------------------------------------------

export const ClaimLifecycleState = {
  Seeded: 'seeded',
  Claimable: 'claimable',
  ClaimPending: 'claim_pending',
  Verified: 'verified',
  Managed: 'managed',
  Branded: 'branded',
  Monetized: 'monetized',
  Delegated: 'delegated',
} as const;

export type ClaimLifecycleState = (typeof ClaimLifecycleState)[keyof typeof ClaimLifecycleState];

// ---------------------------------------------------------------------------
// Verification and publication states
// ---------------------------------------------------------------------------

export const VerificationState = {
  Unverified: 'unverified',
  Pending: 'pending',
  Verified: 'verified',
  Rejected: 'rejected',
  RequiresEnhanced: 'requires_enhanced', // sensitive-sector e.g. political, medical
} as const;

export type VerificationState = (typeof VerificationState)[keyof typeof VerificationState];

export const PublicationState = {
  Draft: 'draft',
  Published: 'published',
  Unlisted: 'unlisted',
  Archived: 'archived',
  Suspended: 'suspended',
} as const;

export type PublicationState = (typeof PublicationState)[keyof typeof PublicationState];

// ---------------------------------------------------------------------------
// Subscription / entitlement enums (entitlement-model.md)
// ---------------------------------------------------------------------------

export const SubscriptionPlan = {
  Free: 'free',
  Starter: 'starter',
  Growth: 'growth',
  Pro: 'pro',
  Enterprise: 'enterprise',
  Partner: 'partner',
  SubPartner: 'sub_partner',
} as const;

export type SubscriptionPlan = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const SubscriptionStatus = {
  Active: 'active',
  Trialing: 'trialing',
  PastDue: 'past_due',
  Cancelled: 'cancelled',
  Suspended: 'suspended',
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PlatformLayer = {
  Discovery: 'discovery',
  Operational: 'operational',
  Commerce: 'commerce',
  Transport: 'transport',
  Civic: 'civic',
  Political: 'political',
  Institutional: 'institutional',
  Professional: 'professional',
  Creator: 'creator',
  WhiteLabel: 'white_label',
  AI: 'ai',
} as const;

export type PlatformLayer = (typeof PlatformLayer)[keyof typeof PlatformLayer];

// ---------------------------------------------------------------------------
// Role types (security-baseline.md §3)
// ---------------------------------------------------------------------------

export const Role = {
  SuperAdmin: 'super_admin',
  Admin: 'admin',
  Manager: 'manager',
  Agent: 'agent',
  Cashier: 'cashier',
  Member: 'member',
  Public: 'public',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// ---------------------------------------------------------------------------
// Relationship types (relationship-schema.md)
// ---------------------------------------------------------------------------

export const RelationshipType = {
  Owns: 'owns',
  Manages: 'manages',
  Claims: 'claims',
  AffiliatedWith: 'affiliated_with',
  BelongsTo: 'belongs_to',
  DelegatesTo: 'delegates_to',
  Offers: 'offers',
  PublishesTo: 'publishes_to',
  ListedIn: 'listed_in',
  LocatedIn: 'located_in',
  OperatesIn: 'operates_in',
  Serves: 'serves',
  Hosts: 'hosts',
  HoldsOffice: 'holds_office',
  JurisdictionOver: 'jurisdiction_over',
} as const;

export type RelationshipType = (typeof RelationshipType)[keyof typeof RelationshipType];
