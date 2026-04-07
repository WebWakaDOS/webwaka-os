/**
 * Subscription and entitlement types.
 * (docs/governance/entitlement-model.md)
 *
 * Subscription is the FINAL determinant of what any entity can access.
 */

import type { SubscriptionId, WorkspaceId, TenantId } from './ids.js';
import type {
  SubscriptionPlan,
  SubscriptionStatus,
  PlatformLayer,
} from './enums.js';

// ---------------------------------------------------------------------------
// Subscription record
// ---------------------------------------------------------------------------

export interface Subscription {
  readonly id: SubscriptionId;
  readonly workspaceId: WorkspaceId;
  readonly tenantId: TenantId;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  /** Unix timestamp seconds */
  readonly currentPeriodStart: number;
  /** Unix timestamp seconds */
  readonly currentPeriodEnd: number;
  readonly cancelAtPeriodEnd: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Entitlement dimensions (entitlement-model.md)
// ---------------------------------------------------------------------------

export interface EntitlementDimensions {
  /** Which platform layers are unlocked */
  readonly activeLayers: ReadonlyArray<PlatformLayer>;
  /** Maximum team members in a workspace. null = unlimited */
  readonly maxUsers: number | null;
  /** Maximum managed Places. null = unlimited */
  readonly maxBranches: number | null;
  /** Maximum active Offerings. null = unlimited */
  readonly maxOfferings: number | null;
  /** Whether a Brand Surface can be activated */
  readonly brandingRights: boolean;
  /** Whether partner-level branding is permitted */
  readonly whiteLabelDepth: boolean;
  /** Whether sub-partners may be created */
  readonly delegationRights: boolean;
  /** Discovery index status and featured placement */
  readonly visibilityRights: boolean;
  /** Which AI capabilities are accessible */
  readonly aiRights: boolean;
  /** Whether regulated modules can be activated */
  readonly sensitiveSectorRights: boolean;
}

// ---------------------------------------------------------------------------
// Access evaluation input
// (entitlement-model.md — every access decision must consider all 7 factors)
// ---------------------------------------------------------------------------

export interface AccessEvaluationInput {
  readonly entityType: string;
  readonly workspaceMembership: boolean;
  readonly role: string;
  readonly claimState: string;
  readonly subscriptionPlan: SubscriptionPlan;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly requiredLayer: PlatformLayer;
  readonly geographyScopeRequired: boolean;
}
