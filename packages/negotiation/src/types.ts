/**
 * @webwaka/negotiation — Domain Types
 *
 * Negotiation is a PRICING CAPABILITY (like payment method), not a marketplace type.
 * Fixed pricing is the default and is never degraded.
 *
 * P9: All monetary values are INTEGER kobo. No floats anywhere.
 * Discounts are INTEGER basis points (bps). 100 bps = 1%.
 * T3: tenant_id is required on all DB entities.
 */

export type PricingMode = 'fixed' | 'negotiable' | 'hybrid';

export type SessionType = 'offer' | 'bulk_rfq' | 'service_quote';

export type SessionStatus = 'open' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export type OfferStatus = 'pending' | 'accepted' | 'countered' | 'declined' | 'expired';

export type OfferedBy = 'buyer' | 'seller';

export type ActorType = 'buyer' | 'seller' | 'system';

export type AuditEventType =
  | 'session_opened'
  | 'offer_submitted'
  | 'countered'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'auto_accepted';

export interface VendorPricingPolicy {
  id: string;
  workspace_id: string;
  tenant_id: string;
  default_pricing_mode: PricingMode;
  min_price_kobo: number | null;
  max_discount_bps: number;
  max_offer_rounds: number;
  offer_expiry_hours: number;
  auto_accept_threshold_bps: number | null;
  eligible_buyer_kyc_tier: number;
  wholesale_min_qty: number | null;
  created_at: number;
  updated_at: number;
}

export interface ListingPriceOverride {
  id: string;
  workspace_id: string;
  tenant_id: string;
  listing_type: string;
  listing_id: string;
  pricing_mode: PricingMode;
  listed_price_kobo: number;
  min_price_kobo: number | null;
  max_discount_bps: number | null;
  max_offer_rounds: number | null;
  offer_expiry_hours: number | null;
  auto_accept_threshold_bps: number | null;
  valid_until: number | null;
  created_at: number;
  updated_at: number;
}

export interface NegotiationSession {
  id: string;
  tenant_id: string;
  listing_type: string;
  listing_id: string;
  seller_workspace_id: string;
  buyer_ref_id: string;
  session_type: SessionType;
  status: SessionStatus;
  listed_price_kobo: number;
  initial_offer_kobo: number;
  final_price_kobo: number | null;
  rounds_used: number;
  max_rounds: number;
  expires_at: number;
  quantity: number;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface NegotiationOffer {
  id: string;
  session_id: string;
  tenant_id: string;
  round: number;
  offered_by: OfferedBy;
  amount_kobo: number;
  message: string | null;
  status: OfferStatus;
  created_at: number;
  responded_at: number | null;
}

export interface NegotiationAuditEntry {
  id: string;
  tenant_id: string;
  session_id: string;
  event_type: AuditEventType;
  actor_type: ActorType;
  actor_ref_id: string;
  amount_kobo: number | null;
  metadata: string;
  created_at: number;
}

export interface GuardrailsConfig {
  pricing_mode: PricingMode;
  min_price_kobo: number | null;
  max_discount_bps: number;
  max_offer_rounds: number;
  offer_expiry_hours: number;
  auto_accept_threshold_bps: number | null;
  eligible_buyer_kyc_tier: number;
  wholesale_min_qty: number | null;
}

export interface SellerAnalytics {
  total_sessions: number;
  open_sessions: number;
  accepted_sessions: number;
  declined_sessions: number;
  expired_sessions: number;
  cancelled_sessions: number;
  acceptance_rate_bps: number;
  avg_discount_depth_bps: number;
  avg_rounds_to_close: number;
}

export interface CreateSessionInput {
  tenant_id: string;
  listing_type: string;
  listing_id: string;
  seller_workspace_id: string;
  buyer_ref_id: string;
  session_type: SessionType;
  initial_offer_kobo: number;
  quantity?: number;
  notes?: string;
}

export interface CreateSessionRepoInput extends CreateSessionInput {
  listed_price_kobo: number;
}

export interface SubmitOfferInput {
  session_id: string;
  tenant_id: string;
  offered_by: OfferedBy;
  amount_kobo: number;
  message?: string;
  actor_workspace_id: string;
}

export interface UpsertPolicyInput {
  workspace_id: string;
  tenant_id: string;
  default_pricing_mode: PricingMode;
  min_price_kobo?: number | null;
  max_discount_bps?: number;
  max_offer_rounds?: number;
  offer_expiry_hours?: number;
  auto_accept_threshold_bps?: number | null;
  eligible_buyer_kyc_tier?: number;
  wholesale_min_qty?: number | null;
}

export interface UpsertListingOverrideInput {
  workspace_id: string;
  tenant_id: string;
  listing_type: string;
  listing_id: string;
  pricing_mode: PricingMode;
  listed_price_kobo: number;
  min_price_kobo?: number | null;
  max_discount_bps?: number | null;
  max_offer_rounds?: number | null;
  offer_expiry_hours?: number | null;
  auto_accept_threshold_bps?: number | null;
  valid_until?: number | null;
}

export interface PriceLockPayload {
  session_id: string;
  final_price_kobo: number;
  tenant_id: string;
  issued_at: number;
}

export class NegotiationBlockedError extends Error {
  readonly code = 'negotiation_blocked';
  constructor(listingType: string) {
    super(`Negotiation is not available for listing type: ${listingType}`);
    this.name = 'NegotiationBlockedError';
  }
}

export class NegotiationNotEnabledError extends Error {
  readonly code = 'mode_is_fixed';
  constructor() {
    super('This listing does not accept offers');
    this.name = 'NegotiationNotEnabledError';
  }
}

export class InsufficientKycError extends Error {
  readonly code = 'insufficient_kyc';
  constructor(required: number) {
    super(`KYC Tier ${required} required to make offers`);
    this.name = 'InsufficientKycError';
  }
}

export class DuplicateSessionError extends Error {
  readonly code = 'duplicate_session';
  constructor() {
    super('You already have an open offer on this listing');
    this.name = 'DuplicateSessionError';
  }
}

export class OfferBelowFloorError extends Error {
  readonly code = 'offer_below_floor';
  constructor() {
    super('Offer is below the minimum price for this listing');
    this.name = 'OfferBelowFloorError';
  }
}

export class OfferExceedsDiscountError extends Error {
  readonly code = 'offer_exceeds_discount';
  constructor() {
    super('Offer discount exceeds the maximum allowed for this listing');
    this.name = 'OfferExceedsDiscountError';
  }
}

export class SessionNotFoundError extends Error {
  readonly code = 'session_not_found';
  constructor(id: string) {
    super(`Negotiation session not found: ${id}`);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionClosedError extends Error {
  readonly code = 'session_closed';
  constructor(status: SessionStatus) {
    super(`Session is already ${status}`);
    this.name = 'SessionClosedError';
  }
}

export class MaxRoundsExceededError extends Error {
  readonly code = 'max_rounds_exceeded';
  constructor() {
    super('Maximum offer rounds reached. Session has been closed.');
    this.name = 'MaxRoundsExceededError';
  }
}

export class NoOpenOfferError extends Error {
  readonly code = 'no_open_offer';
  constructor() {
    super('No pending offer to accept');
    this.name = 'NoOpenOfferError';
  }
}

export class UnauthorizedNegotiationError extends Error {
  readonly code = 'unauthorized';
  constructor() {
    super('You are not authorized to perform this action on this session');
    this.name = 'UnauthorizedNegotiationError';
  }
}

export class InvalidPriceLockError extends Error {
  readonly code = 'invalid_price_lock';
  constructor(reason: string) {
    super(`Invalid price lock token: ${reason}`);
    this.name = 'InvalidPriceLockError';
  }
}

export class BelowWholesaleMinQtyError extends Error {
  readonly code = 'below_wholesale_min_qty';
  constructor(min: number) {
    super(`Minimum quantity for bulk orders is ${min}`);
    this.name = 'BelowWholesaleMinQtyError';
  }
}

export class InvalidSessionTypeForListingError extends Error {
  readonly code = 'invalid_session_type_for_listing';
  constructor(listingType: string, sessionType: string) {
    super(`Session type '${sessionType}' is not valid for listing type '${listingType}'`);
    this.name = 'InvalidSessionTypeForListingError';
  }
}
