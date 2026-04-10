/**
 * @webwaka/negotiation — Guardrail Evaluator
 *
 * Pure arithmetic functions. No side effects. No DB access.
 *
 * P9: All monetary values INTEGER kobo. All discounts INTEGER bps.
 * Math.floor used throughout (seller-favour rounding — never Math.round).
 * No parseFloat, no REAL, no floating-point literals.
 */

import type {
  VendorPricingPolicy,
  ListingPriceOverride,
  GuardrailsConfig,
  PricingMode,
} from './types.js';

export function resolveGuardrails(
  policy: VendorPricingPolicy,
  override: ListingPriceOverride | null,
): GuardrailsConfig {
  if (override === null) {
    return {
      pricing_mode: policy.default_pricing_mode,
      min_price_kobo: policy.min_price_kobo,
      max_discount_bps: policy.max_discount_bps,
      max_offer_rounds: policy.max_offer_rounds,
      offer_expiry_hours: policy.offer_expiry_hours,
      auto_accept_threshold_bps: policy.auto_accept_threshold_bps,
      eligible_buyer_kyc_tier: policy.eligible_buyer_kyc_tier,
      wholesale_min_qty: policy.wholesale_min_qty,
    };
  }

  return {
    pricing_mode: override.pricing_mode,
    min_price_kobo: override.min_price_kobo !== null ? override.min_price_kobo : policy.min_price_kobo,
    max_discount_bps: override.max_discount_bps !== null ? override.max_discount_bps : policy.max_discount_bps,
    max_offer_rounds: override.max_offer_rounds !== null ? override.max_offer_rounds : policy.max_offer_rounds,
    offer_expiry_hours: override.offer_expiry_hours !== null ? override.offer_expiry_hours : policy.offer_expiry_hours,
    auto_accept_threshold_bps:
      override.auto_accept_threshold_bps !== null
        ? override.auto_accept_threshold_bps
        : policy.auto_accept_threshold_bps,
    eligible_buyer_kyc_tier: policy.eligible_buyer_kyc_tier,
    wholesale_min_qty: policy.wholesale_min_qty,
  };
}

export function effectivePricingMode(
  policy: VendorPricingPolicy,
  override: ListingPriceOverride | null,
): PricingMode {
  if (override !== null) return override.pricing_mode;
  return policy.default_pricing_mode;
}

export function isOfferBelowFloor(
  offerKobo: number,
  guardrails: GuardrailsConfig,
): boolean {
  if (guardrails.min_price_kobo === null) return false;
  return offerKobo < guardrails.min_price_kobo;
}

export function isOfferExceedsMaxDiscount(
  offerKobo: number,
  listedPriceKobo: number,
  guardrails: GuardrailsConfig,
): boolean {
  if (listedPriceKobo <= 0) return false;
  const discountBps = Math.floor(((listedPriceKobo - offerKobo) * 10000) / listedPriceKobo);
  return discountBps > guardrails.max_discount_bps;
}

export function shouldAutoAccept(
  offerKobo: number,
  listedPriceKobo: number,
  thresholdBps: number | null,
): boolean {
  if (thresholdBps === null) return false;
  const minAutoAccept = Math.floor((listedPriceKobo * (10000 - thresholdBps)) / 10000);
  return offerKobo >= minAutoAccept;
}

export function computeExpiresAt(nowUnix: number, expiryHours: number): number {
  return nowUnix + expiryHours * 3600;
}

export function computeDiscountBps(listedPriceKobo: number, finalPriceKobo: number): number {
  if (listedPriceKobo <= 0) return 0;
  return Math.floor(((listedPriceKobo - finalPriceKobo) * 10000) / listedPriceKobo);
}
