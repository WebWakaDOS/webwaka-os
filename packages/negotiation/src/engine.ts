/**
 * @webwaka/negotiation — NegotiationEngine
 *
 * FSM: open → (offer submitted) → open | accepted
 *               ↓ (decline / cancel / expiry)
 *         declined | cancelled | expired
 *
 * P9: All monetary values INTEGER kobo.
 * Blocked verticals are a hard gate at engine layer — cannot be bypassed by caller.
 *
 * listing_type convention (underscore, matching DB column values):
 *   'used_car'         → verticals-used-car-dealer
 *   'spare_part'       → verticals-spare-parts
 *   'logistics_route'  → verticals-logistics-delivery (charter/bulk only)
 *
 * SINGLE_ITEM_LISTING_TYPES: listing reserved on accept; released on payment timeout.
 */

import { NegotiationRepository } from './repository.js';
import {
  resolveGuardrails,
  effectivePricingMode,
  isOfferBelowFloor,
  isOfferExceedsMaxDiscount,
  shouldAutoAccept,
} from './guardrails.js';
import type {
  NegotiationSession,
  NegotiationOffer,
  CreateSessionInput,
  SubmitOfferInput,
} from './types.js';
import {
  NegotiationBlockedError,
  NegotiationNotEnabledError,
  InsufficientKycError,
  DuplicateSessionError,
  OfferBelowFloorError,
  OfferExceedsDiscountError,
  SessionNotFoundError,
  SessionClosedError,
  MaxRoundsExceededError,
  NoOpenOfferError,
  UnauthorizedNegotiationError,
  BelowWholesaleMinQtyError,
  InvalidSessionTypeForListingError,
} from './types.js';

// ---------------------------------------------------------------------------
// Blocked verticals — hard gate. Negotiation DISABLED for these listing types.
// Rationale:
//   pharmacy_chain  — drug pricing regulated by NAFDAC/PCN
//   food_vendor     — real-time FMCG; negotiation impractical
//   bakery          — perishable FMCG
//   petrol_station  — PMS price regulated by NNPCL
//   internet_cafe   — per-minute/session rates are fixed
//   govt_school     — fees set by government
//   orphanage       — P13 absolute; no commercial negotiation
//   okada_keke      — platform standardises fares (anti-exploitation)
//   laundry         — per-item/kg pricing; no negotiation value
//   laundry_service — same as laundry
//   beauty_salon    — service menu pricing
//   optician        — clinical + product pricing must be consistent
// ---------------------------------------------------------------------------
export const NEGOTIATION_BLOCKED_VERTICALS = Object.freeze([
  'pharmacy_chain',
  'food_vendor',
  'bakery',
  'petrol_station',
  'internet_cafe',
  'govt_school',
  'orphanage',
  'okada_keke',
  'laundry',
  'laundry_service',
  'beauty_salon',
  'optician',
] as const);

export type BlockedListingType = (typeof NEGOTIATION_BLOCKED_VERTICALS)[number];

export function isNegotiationBlocked(listingType: string): boolean {
  return (NEGOTIATION_BLOCKED_VERTICALS as readonly string[]).includes(listingType);
}

// ---------------------------------------------------------------------------
// Single-item listing types: listing is reserved on accept; released on expiry.
// ---------------------------------------------------------------------------
export const SINGLE_ITEM_LISTING_TYPES = Object.freeze([
  'used_car',
  'real_estate_property',
] as const);

export function isSingleItemListing(listingType: string): boolean {
  return (SINGLE_ITEM_LISTING_TYPES as readonly string[]).includes(listingType);
}

// ---------------------------------------------------------------------------
// Listing types that only allow bulk_rfq or service_quote (not simple offer).
// ---------------------------------------------------------------------------
const BULK_ONLY_LISTING_TYPES = Object.freeze(['logistics_route'] as const);

function requiresBulkOrServiceQuote(listingType: string): boolean {
  return (BULK_ONLY_LISTING_TYPES as readonly string[]).includes(listingType);
}

// ---------------------------------------------------------------------------
// NegotiationEngine
// ---------------------------------------------------------------------------

export class NegotiationEngine {
  constructor(private readonly repo: NegotiationRepository) {}

  async openSession(
    input: CreateSessionInput,
    buyerKycTier: number,
    sellerWorkspaceId: string,
  ): Promise<NegotiationSession> {
    if (isNegotiationBlocked(input.listing_type)) {
      throw new NegotiationBlockedError(input.listing_type);
    }

    if (requiresBulkOrServiceQuote(input.listing_type) && input.session_type === 'offer') {
      throw new InvalidSessionTypeForListingError(input.listing_type, input.session_type);
    }

    if (!Number.isInteger(input.initial_offer_kobo) || input.initial_offer_kobo <= 0) {
      throw new RangeError('initial_offer_kobo must be a positive integer');
    }

    const policy = await this.repo.getVendorPolicy(sellerWorkspaceId, input.tenant_id);
    if (!policy) {
      throw new NegotiationNotEnabledError();
    }

    const override = await this.repo.getListingOverride(
      input.listing_type,
      input.listing_id,
      input.tenant_id,
    );

    const mode = effectivePricingMode(policy, override);
    if (mode === 'fixed') {
      throw new NegotiationNotEnabledError();
    }

    const guardrails = resolveGuardrails(policy, override);

    if (buyerKycTier < guardrails.eligible_buyer_kyc_tier) {
      throw new InsufficientKycError(guardrails.eligible_buyer_kyc_tier);
    }

    if (
      guardrails.wholesale_min_qty !== null &&
      input.session_type === 'bulk_rfq' &&
      (input.quantity ?? 1) < guardrails.wholesale_min_qty
    ) {
      throw new BelowWholesaleMinQtyError(guardrails.wholesale_min_qty);
    }

    const openSessions = await this.repo.listSessionsForBuyer(
      input.buyer_ref_id,
      input.tenant_id,
      'open',
    );
    const hasDuplicate = openSessions.some(
      (s) => s.listing_id === input.listing_id && s.listing_type === input.listing_type,
    );
    if (hasDuplicate) {
      throw new DuplicateSessionError();
    }

    if (isOfferBelowFloor(input.initial_offer_kobo, guardrails)) {
      throw new OfferBelowFloorError();
    }

    const listedPrice =
      override?.listed_price_kobo ?? input.initial_offer_kobo;

    if (isOfferExceedsMaxDiscount(input.initial_offer_kobo, listedPrice, guardrails)) {
      throw new OfferExceedsDiscountError();
    }

    const isAutoAccept = shouldAutoAccept(
      input.initial_offer_kobo,
      listedPrice,
      guardrails.auto_accept_threshold_bps,
    );

    const session = await this.repo.createSession(
      { ...input, seller_workspace_id: sellerWorkspaceId, listed_price_kobo: listedPrice },
      guardrails.max_offer_rounds,
      guardrails.offer_expiry_hours,
    );

    await this.repo.createOffer(
      session.id,
      input.tenant_id,
      1,
      'buyer',
      input.initial_offer_kobo,
      input.notes,
    );
    await this.repo.incrementRoundsUsed(session.id, input.tenant_id);

    if (isAutoAccept) {
      await this.repo.updateSessionStatus(
        session.id,
        input.tenant_id,
        'accepted',
        input.initial_offer_kobo,
      );
      await this.repo.writeAuditEntry({
        tenant_id: input.tenant_id,
        session_id: session.id,
        event_type: 'auto_accepted',
        actor_type: 'system',
        actor_ref_id: 'system',
        amount_kobo: input.initial_offer_kobo,
      });
      return (await this.repo.getSession(session.id, input.tenant_id))!;
    }

    await this.repo.writeAuditEntry({
      tenant_id: input.tenant_id,
      session_id: session.id,
      event_type: 'session_opened',
      actor_type: 'buyer',
      actor_ref_id: input.buyer_ref_id,
      amount_kobo: input.initial_offer_kobo,
    });

    return (await this.repo.getSession(session.id, input.tenant_id))!;
  }

  async submitOffer(input: SubmitOfferInput): Promise<NegotiationOffer> {
    const session = await this.repo.getSession(input.session_id, input.tenant_id);
    if (!session) throw new SessionNotFoundError(input.session_id);
    if (session.status !== 'open') throw new SessionClosedError(session.status);

    if (input.offered_by === 'seller' && input.actor_workspace_id !== session.seller_workspace_id) {
      throw new UnauthorizedNegotiationError();
    }
    if (input.offered_by === 'buyer' && input.actor_workspace_id !== session.buyer_ref_id) {
      throw new UnauthorizedNegotiationError();
    }

    if (!Number.isInteger(input.amount_kobo) || input.amount_kobo <= 0) {
      throw new RangeError('amount_kobo must be a positive integer');
    }

    if (session.rounds_used >= session.max_rounds) {
      await this.repo.updateSessionStatus(session.id, input.tenant_id, 'declined');
      await this.repo.writeAuditEntry({
        tenant_id: input.tenant_id,
        session_id: session.id,
        event_type: 'declined',
        actor_type: 'system',
        actor_ref_id: 'system',
      });
      throw new MaxRoundsExceededError();
    }

    const policy = await this.repo.getVendorPolicy(session.seller_workspace_id, input.tenant_id);
    const override = await this.repo.getListingOverride(
      session.listing_type,
      session.listing_id,
      input.tenant_id,
    );
    const guardrails = resolveGuardrails(policy!, override);

    if (input.offered_by === 'buyer') {
      if (isOfferBelowFloor(input.amount_kobo, guardrails)) {
        throw new OfferBelowFloorError();
      }
      if (isOfferExceedsMaxDiscount(input.amount_kobo, session.listed_price_kobo, guardrails)) {
        throw new OfferExceedsDiscountError();
      }
    }

    const prevOffer = await this.repo.getLatestOffer(session.id, input.tenant_id);
    if (prevOffer && prevOffer.status === 'pending') {
      await this.repo.updateOfferStatus(prevOffer.id, input.tenant_id, 'countered', Math.floor(Date.now() / 1000));
    }

    const newRound = await this.repo.incrementRoundsUsed(session.id, input.tenant_id);
    const offer = await this.repo.createOffer(
      session.id,
      input.tenant_id,
      newRound,
      input.offered_by,
      input.amount_kobo,
      input.message,
    );

    const eventType = prevOffer ? 'countered' : 'offer_submitted';
    await this.repo.writeAuditEntry({
      tenant_id: input.tenant_id,
      session_id: session.id,
      event_type: eventType,
      actor_type: input.offered_by,
      actor_ref_id: input.actor_workspace_id,
      amount_kobo: input.amount_kobo,
    });

    if (input.offered_by === 'buyer') {
      const autoAccept = shouldAutoAccept(
        input.amount_kobo,
        session.listed_price_kobo,
        guardrails.auto_accept_threshold_bps,
      );
      if (autoAccept) {
        await this.repo.updateOfferStatus(offer.id, input.tenant_id, 'accepted', Math.floor(Date.now() / 1000));
        await this.repo.updateSessionStatus(session.id, input.tenant_id, 'accepted', input.amount_kobo);
        await this.repo.writeAuditEntry({
          tenant_id: input.tenant_id,
          session_id: session.id,
          event_type: 'auto_accepted',
          actor_type: 'system',
          actor_ref_id: 'system',
          amount_kobo: input.amount_kobo,
        });
      }
    }

    return (await this.repo.getOfferById(offer.id, input.tenant_id))!;
  }

  async acceptOffer(
    sessionId: string,
    tenantId: string,
    actorWorkspaceId: string,
  ): Promise<NegotiationSession> {
    const session = await this.repo.getSession(sessionId, tenantId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.status !== 'open') throw new SessionClosedError(session.status);

    const latestOffer = await this.repo.getLatestOffer(sessionId, tenantId);
    if (!latestOffer || latestOffer.status !== 'pending') {
      throw new NoOpenOfferError();
    }

    const latestIsFromBuyer = latestOffer.offered_by === 'buyer';
    const latestIsFromSeller = latestOffer.offered_by === 'seller';

    if (latestIsFromBuyer && actorWorkspaceId !== session.seller_workspace_id) {
      throw new UnauthorizedNegotiationError();
    }
    if (latestIsFromSeller && actorWorkspaceId !== session.buyer_ref_id) {
      throw new UnauthorizedNegotiationError();
    }

    const now = Math.floor(Date.now() / 1000);
    await this.repo.updateOfferStatus(latestOffer.id, tenantId, 'accepted', now);
    await this.repo.updateSessionStatus(sessionId, tenantId, 'accepted', latestOffer.amount_kobo);
    await this.repo.writeAuditEntry({
      tenant_id: tenantId,
      session_id: sessionId,
      event_type: 'accepted',
      actor_type: latestIsFromBuyer ? 'seller' : 'buyer',
      actor_ref_id: actorWorkspaceId,
      amount_kobo: latestOffer.amount_kobo,
    });

    return (await this.repo.getSession(sessionId, tenantId))!;
  }

  async declineSession(
    sessionId: string,
    tenantId: string,
    actorWorkspaceId: string,
  ): Promise<void> {
    const session = await this.repo.getSession(sessionId, tenantId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.status !== 'open') throw new SessionClosedError(session.status);

    const isSeller = actorWorkspaceId === session.seller_workspace_id;
    const isBuyer = actorWorkspaceId === session.buyer_ref_id;
    if (!isSeller && !isBuyer) throw new UnauthorizedNegotiationError();

    const latestOffer = await this.repo.getLatestOffer(sessionId, tenantId);
    if (latestOffer && latestOffer.status === 'pending') {
      await this.repo.updateOfferStatus(
        latestOffer.id,
        tenantId,
        'declined',
        Math.floor(Date.now() / 1000),
      );
    }

    await this.repo.updateSessionStatus(sessionId, tenantId, 'declined');
    await this.repo.writeAuditEntry({
      tenant_id: tenantId,
      session_id: sessionId,
      event_type: 'declined',
      actor_type: isSeller ? 'seller' : 'buyer',
      actor_ref_id: actorWorkspaceId,
    });
  }

  async cancelSession(sessionId: string, tenantId: string, buyerRefId: string): Promise<void> {
    const session = await this.repo.getSession(sessionId, tenantId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.status !== 'open') throw new SessionClosedError(session.status);

    if (buyerRefId !== session.buyer_ref_id) throw new UnauthorizedNegotiationError();

    await this.repo.updateSessionStatus(sessionId, tenantId, 'cancelled');
    await this.repo.writeAuditEntry({
      tenant_id: tenantId,
      session_id: sessionId,
      event_type: 'cancelled',
      actor_type: 'buyer',
      actor_ref_id: buyerRefId,
    });
  }
}
