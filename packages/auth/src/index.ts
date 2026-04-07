/**
 * @webwaka/auth — JWT validation, workspace-scoped auth, role guards,
 * and entitlement-aware access control.
 *
 * (TDR-0008, security-baseline.md)
 *
 * Design: Identity + Tenant context are BOTH required. Neither alone is sufficient.
 */

export * from './jwt.js';
export * from './roles.js';
export * from './entitlements.js';
export * from './middleware.js';
