/**
 * Tests for role-based access control helpers.
 * (security-baseline.md §3)
 */

import { describe, it, expect } from 'vitest';
import { Role } from '@webwaka/types';
import type { AuthContext } from '@webwaka/types';
import { asId } from '@webwaka/types';
import { hasMinimumRole, requireRole, requireSuperAdmin, AuthorizationError } from './roles.js';

function makeAuth(role: Role): AuthContext {
  return {
    userId: asId('user_001'),
    workspaceId: asId('ws_001'),
    tenantId: asId('tenant_001'),
    role,
  };
}

// ---------------------------------------------------------------------------
// hasMinimumRole
// ---------------------------------------------------------------------------

describe('hasMinimumRole', () => {
  it('super_admin satisfies all roles', () => {
    for (const role of Object.values(Role)) {
      expect(hasMinimumRole(Role.SuperAdmin, role)).toBe(true);
    }
  });

  it('member only satisfies member and public', () => {
    expect(hasMinimumRole(Role.Member, Role.Member)).toBe(true);
    expect(hasMinimumRole(Role.Member, Role.Public)).toBe(true);
    expect(hasMinimumRole(Role.Member, Role.Cashier)).toBe(false);
    expect(hasMinimumRole(Role.Member, Role.Admin)).toBe(false);
  });

  it('admin satisfies admin, manager, agent, cashier, member, public', () => {
    expect(hasMinimumRole(Role.Admin, Role.Admin)).toBe(true);
    expect(hasMinimumRole(Role.Admin, Role.Manager)).toBe(true);
    expect(hasMinimumRole(Role.Admin, Role.Agent)).toBe(true);
    expect(hasMinimumRole(Role.Admin, Role.SuperAdmin)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------

describe('requireRole', () => {
  it('does not throw when role is sufficient', () => {
    expect(() => requireRole(makeAuth(Role.Admin), Role.Manager)).not.toThrow();
  });

  it('throws AuthorizationError when role is insufficient', () => {
    expect(() => requireRole(makeAuth(Role.Member), Role.Manager)).toThrow(AuthorizationError);
  });

  it('throws with descriptive message', () => {
    try {
      requireRole(makeAuth(Role.Agent), Role.Admin);
    } catch (err) {
      expect((err as Error).message).toContain('admin');
      expect((err as Error).message).toContain('agent');
    }
  });
});

// ---------------------------------------------------------------------------
// requireSuperAdmin
// ---------------------------------------------------------------------------

describe('requireSuperAdmin', () => {
  it('does not throw for super_admin', () => {
    expect(() => requireSuperAdmin(makeAuth(Role.SuperAdmin))).not.toThrow();
  });

  it('throws for admin (not super_admin)', () => {
    expect(() => requireSuperAdmin(makeAuth(Role.Admin))).toThrow(AuthorizationError);
  });

  it('throws for any non-super_admin role', () => {
    for (const role of [Role.Admin, Role.Manager, Role.Agent, Role.Member, Role.Public]) {
      expect(() => requireSuperAdmin(makeAuth(role))).toThrow(AuthorizationError);
    }
  });
});
