/**
 * Tests for entitlement-aware access evaluation.
 * (entitlement-model.md, Platform Invariant T5)
 */

import { describe, it, expect } from 'vitest';
import { PlatformLayer, SubscriptionPlan, SubscriptionStatus, Role } from '@webwaka/types';
import type { EntitlementContext } from '@webwaka/types';
import { asId } from '@webwaka/types';
import {
  hasLayerAccess,
  requireLayerAccess,
  isSubscriptionUsable,
  requireUsableSubscription,
  EntitlementError,
} from './entitlements.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<EntitlementContext> = {}): EntitlementContext {
  return {
    userId: asId('user_001'),
    workspaceId: asId('ws_001'),
    tenantId: asId('tenant_001'),
    role: Role.Admin,
    subscriptionPlan: SubscriptionPlan.Growth,
    subscriptionStatus: SubscriptionStatus.Active,
    activeLayers: [PlatformLayer.Discovery, PlatformLayer.Operational],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// hasLayerAccess
// ---------------------------------------------------------------------------

describe('hasLayerAccess', () => {
  it('returns true for an active layer', () => {
    const ctx = makeCtx();
    expect(hasLayerAccess(ctx, PlatformLayer.Discovery)).toBe(true);
  });

  it('returns false for an inactive layer', () => {
    const ctx = makeCtx();
    expect(hasLayerAccess(ctx, PlatformLayer.Commerce)).toBe(false);
  });

  it('returns false when subscription is past_due', () => {
    const ctx = makeCtx({
      subscriptionStatus: SubscriptionStatus.PastDue,
      activeLayers: [PlatformLayer.Discovery],
    });
    expect(hasLayerAccess(ctx, PlatformLayer.Discovery)).toBe(false);
  });

  it('returns true when subscription is trialing', () => {
    const ctx = makeCtx({
      subscriptionStatus: SubscriptionStatus.Trialing,
      activeLayers: [PlatformLayer.Discovery],
    });
    expect(hasLayerAccess(ctx, PlatformLayer.Discovery)).toBe(true);
  });

  it('returns false when subscription is cancelled', () => {
    const ctx = makeCtx({
      subscriptionStatus: SubscriptionStatus.Cancelled,
      activeLayers: [PlatformLayer.Discovery],
    });
    expect(hasLayerAccess(ctx, PlatformLayer.Discovery)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requireLayerAccess
// ---------------------------------------------------------------------------

describe('requireLayerAccess', () => {
  it('does not throw when layer is active', () => {
    const ctx = makeCtx();
    expect(() => requireLayerAccess(ctx, PlatformLayer.Operational)).not.toThrow();
  });

  it('throws EntitlementError when layer is not active', () => {
    const ctx = makeCtx();
    expect(() => requireLayerAccess(ctx, PlatformLayer.Commerce))
      .toThrow(EntitlementError);
  });

  it('throws with informative message', () => {
    const ctx = makeCtx();
    try {
      requireLayerAccess(ctx, PlatformLayer.WhiteLabel);
    } catch (err) {
      expect(err).toBeInstanceOf(EntitlementError);
      expect((err as Error).message).toContain('white_label');
    }
  });
});

// ---------------------------------------------------------------------------
// isSubscriptionUsable
// ---------------------------------------------------------------------------

describe('isSubscriptionUsable', () => {
  it('returns true for active', () => {
    expect(isSubscriptionUsable(makeCtx({ subscriptionStatus: SubscriptionStatus.Active }))).toBe(true);
  });

  it('returns true for trialing', () => {
    expect(isSubscriptionUsable(makeCtx({ subscriptionStatus: SubscriptionStatus.Trialing }))).toBe(true);
  });

  it('returns false for past_due', () => {
    expect(isSubscriptionUsable(makeCtx({ subscriptionStatus: SubscriptionStatus.PastDue }))).toBe(false);
  });

  it('returns false for cancelled', () => {
    expect(isSubscriptionUsable(makeCtx({ subscriptionStatus: SubscriptionStatus.Cancelled }))).toBe(false);
  });

  it('returns false for suspended', () => {
    expect(isSubscriptionUsable(makeCtx({ subscriptionStatus: SubscriptionStatus.Suspended }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requireUsableSubscription
// ---------------------------------------------------------------------------

describe('requireUsableSubscription', () => {
  it('does not throw for active subscription', () => {
    expect(() => requireUsableSubscription(makeCtx())).not.toThrow();
  });

  it('throws EntitlementError for suspended subscription', () => {
    expect(() =>
      requireUsableSubscription(makeCtx({ subscriptionStatus: SubscriptionStatus.Suspended })),
    ).toThrow(EntitlementError);
  });
});
