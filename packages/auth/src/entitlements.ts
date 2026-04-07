/**
 * Entitlement-aware access evaluation scaffold.
 * (docs/governance/entitlement-model.md, Platform Invariant T5)
 *
 * Every non-public feature access is checked against the tenant's active
 * subscription entitlements. This module provides the evaluation primitives.
 *
 * Full entitlement enforcement uses @packages/entitlements (Milestone 2+).
 * This scaffold defines the interface contracts.
 */

import type { EntitlementContext } from '@webwaka/types';
import { SubscriptionStatus, PlatformLayer } from '@webwaka/types';
import { AuthorizationError } from './roles.js';

// ---------------------------------------------------------------------------
// Entitlement evaluation errors
// ---------------------------------------------------------------------------

export class EntitlementError extends AuthorizationError {
  constructor(message: string) {
    super(message);
    this.name = 'EntitlementError';
  }
}

// ---------------------------------------------------------------------------
// Layer access guard
// ---------------------------------------------------------------------------

/**
 * Checks if the entitlement context has access to a specific platform layer.
 *
 * Platform Invariant T5: Every non-public feature access is checked
 * against the tenant's active subscription entitlements.
 */
export function hasLayerAccess(
  ctx: EntitlementContext,
  requiredLayer: PlatformLayer,
): boolean {
  if (ctx.subscriptionStatus !== SubscriptionStatus.Active &&
      ctx.subscriptionStatus !== SubscriptionStatus.Trialing) {
    return false;
  }
  return ctx.activeLayers.includes(requiredLayer);
}

/**
 * Throws EntitlementError if the context does not have access to the layer.
 */
export function requireLayerAccess(
  ctx: EntitlementContext,
  requiredLayer: PlatformLayer,
): void {
  if (!hasLayerAccess(ctx, requiredLayer)) {
    throw new EntitlementError(
      `Access denied. Platform layer '${requiredLayer}' is not active on ` +
      `subscription plan '${ctx.subscriptionPlan}' (status: ${ctx.subscriptionStatus}).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Subscription status guard
// ---------------------------------------------------------------------------

/**
 * Returns true if the subscription is in a usable (active/trialing) state.
 */
export function isSubscriptionUsable(ctx: EntitlementContext): boolean {
  return (
    ctx.subscriptionStatus === SubscriptionStatus.Active ||
    ctx.subscriptionStatus === SubscriptionStatus.Trialing
  );
}

/**
 * Throws EntitlementError if the subscription is not in a usable state.
 */
export function requireUsableSubscription(ctx: EntitlementContext): void {
  if (!isSubscriptionUsable(ctx)) {
    throw new EntitlementError(
      `Access denied. Subscription status is '${ctx.subscriptionStatus}'. ` +
      'An active or trialing subscription is required.',
    );
  }
}
