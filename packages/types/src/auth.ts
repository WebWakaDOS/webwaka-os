/**
 * Auth and access control types.
 * (TDR-0008, security-baseline.md)
 *
 * Identity without tenant context is insufficient.
 * Tenant context without identity is insufficient.
 */

import type { UserId, WorkspaceId, TenantId } from './ids.js';
import type { Role, PlatformLayer, SubscriptionPlan, SubscriptionStatus } from './enums.js';

// ---------------------------------------------------------------------------
// JWT payload shape (security-baseline.md §2)
// ---------------------------------------------------------------------------

export interface JwtPayload {
  /** Subject — authenticated user ID */
  readonly sub: UserId;
  /** Workspace the user is currently operating in */
  readonly workspace_id: WorkspaceId;
  /** Tenant this workspace belongs to (for row-level isolation) */
  readonly tenant_id: TenantId;
  /** User's role within the workspace */
  readonly role: Role;
  /** Issued at (Unix seconds) */
  readonly iat: number;
  /** Expiry (Unix seconds) */
  readonly exp: number;
}

// ---------------------------------------------------------------------------
// Request auth context — populated by middleware from a validated JWT
// ---------------------------------------------------------------------------

export interface AuthContext {
  readonly userId: UserId;
  readonly workspaceId: WorkspaceId;
  readonly tenantId: TenantId;
  readonly role: Role;
}

// ---------------------------------------------------------------------------
// Entitlement context — augments AuthContext with subscription info
// ---------------------------------------------------------------------------

export interface EntitlementContext extends AuthContext {
  readonly subscriptionPlan: SubscriptionPlan;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly activeLayers: ReadonlyArray<PlatformLayer>;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

import type { MembershipId } from './ids.js';

export interface Membership {
  readonly id: MembershipId;
  readonly workspaceId: WorkspaceId;
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly role: Role;
  readonly createdAt: string;
  readonly updatedAt: string;
}
