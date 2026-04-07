/**
 * Role-based access control helpers.
 * (security-baseline.md §3)
 *
 * Role hierarchy (highest → lowest):
 * super_admin > admin > manager > agent > cashier > member > public
 *
 * Roles are enforced at the middleware layer, NOT in business logic or DB queries.
 */

import { Role } from '@webwaka/types';
import type { AuthContext } from '@webwaka/types';

// ---------------------------------------------------------------------------
// Role hierarchy (ordered high → low privilege)
// ---------------------------------------------------------------------------

const ROLE_HIERARCHY: ReadonlyArray<Role> = [
  Role.SuperAdmin,
  Role.Admin,
  Role.Manager,
  Role.Agent,
  Role.Cashier,
  Role.Member,
  Role.Public,
];

function getRoleLevel(role: Role): number {
  const idx = ROLE_HIERARCHY.indexOf(role);
  if (idx === -1) {
    throw new Error(`Unknown role: ${role}`);
  }
  return idx;
}

/**
 * Returns true if the given role has at least the required privilege level.
 *
 * Example: hasMinimumRole('manager', 'agent') → true (manager outranks agent)
 */
export function hasMinimumRole(actualRole: Role, minimumRole: Role): boolean {
  return getRoleLevel(actualRole) <= getRoleLevel(minimumRole);
}

// ---------------------------------------------------------------------------
// Authorization errors
// ---------------------------------------------------------------------------

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// ---------------------------------------------------------------------------
// requireRole guard
// ---------------------------------------------------------------------------

/**
 * Throws AuthorizationError if the auth context does not satisfy the minimum role.
 *
 * Usage in a Hono handler:
 *   requireRole(ctx.auth, Role.Manager);
 */
export function requireRole(auth: AuthContext, minimumRole: Role): void {
  if (!hasMinimumRole(auth.role, minimumRole)) {
    throw new AuthorizationError(
      `Access denied. Required role: ${minimumRole}, actual role: ${auth.role}`,
    );
  }
}

/**
 * Asserts that the auth context has super_admin role.
 * Super admin routes require an EXPLICIT check — not just any admin. (security-baseline.md §3)
 */
export function requireSuperAdmin(auth: AuthContext): void {
  if (auth.role !== Role.SuperAdmin) {
    throw new AuthorizationError(
      'Access denied. Super admin role required for this operation.',
    );
  }
}
