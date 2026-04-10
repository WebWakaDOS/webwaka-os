/**
 * Negotiable Pricing Routes — Platform-wide pricing capability
 *
 * All routes prefixed /api/v1/negotiation (mounted in index.ts)
 * All routes require auth (authMiddleware guard set in index.ts)
 *
 * Endpoints:
 *   GET    /policy                         — Seller's vendor pricing policy
 *   PUT    /policy                         — Upsert vendor pricing policy (seller)
 *   POST   /listings/:type/:id/mode        — Set pricing mode on listing (seller)
 *   GET    /listings/:type/:id/mode        — Get effective pricing mode (any authed caller)
 *   DELETE /listings/:type/:id/mode        — Remove listing override (seller only)
 *   POST   /sessions                       — Buyer opens negotiation session
 *   GET    /sessions                       — List sessions for caller
 *   GET    /sessions/:id                   — Get session detail
 *   POST   /sessions/:id/offer             — Submit offer or counteroffer
 *   POST   /sessions/:id/accept            — Accept current best offer
 *   POST   /sessions/:id/decline           — Decline and close session
 *   POST   /sessions/:id/cancel            — Buyer cancels open session
 *   GET    /sessions/:id/history           — Full offer history for session
 *   GET    /analytics                      — Seller negotiation analytics
 *
 * P9: All monetary values INTEGER kobo in request/response — no floats.
 * T3: tenant_id from auth context only — never from request body.
 * SECURITY: min_price_kobo is NEVER serialised into any response body.
 */

import { Hono } from 'hono';
import {
  NegotiationRepository,
  NegotiationEngine,
  isNegotiationBlocked,
  generatePriceLockToken,
  verifyPriceLockToken,
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
  InvalidPriceLockError,
} from '@webwaka/negotiation';
import type {
  PricingMode,
  SessionType,
  OfferedBy,
  NegotiationSession,
} from '@webwaka/negotiation';
import type { Env } from '../env.js';

export const negotiationRouter = new Hono<{ Bindings: Env }>();

type Auth = { userId: string; tenantId: string; workspaceId?: string; kycTier?: number };

function getAuth(c: { get: (key: string) => unknown }): Auth {
  return c.get('auth') as Auth;
}

function stripMinPrice(obj: unknown): unknown {
  const record = obj as Record<string, unknown>;
  const { min_price_kobo: _removed, ...rest } = record;
  return rest;
}

function handleEngineError(c: { json: (body: unknown, status?: number) => Response }, err: unknown): Response {
  if (err instanceof NegotiationBlockedError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof NegotiationNotEnabledError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof InsufficientKycError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof DuplicateSessionError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof OfferBelowFloorError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof OfferExceedsDiscountError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof SessionNotFoundError) return c.json({ error: err.message, code: err.code }, 404);
  if (err instanceof SessionClosedError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof MaxRoundsExceededError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof NoOpenOfferError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof UnauthorizedNegotiationError) return c.json({ error: err.message, code: err.code }, 403);
  if (err instanceof BelowWholesaleMinQtyError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof InvalidSessionTypeForListingError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof InvalidPriceLockError) return c.json({ error: err.message, code: err.code }, 422);
  if (err instanceof RangeError) return c.json({ error: err.message, code: 'invalid_value' }, 422);
  console.error('[negotiation] Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
}

const VALID_PRICING_MODES: PricingMode[] = ['fixed', 'negotiable', 'hybrid'];
const VALID_SESSION_TYPES: SessionType[] = ['offer', 'bulk_rfq', 'service_quote'];
const VALID_OFFERED_BY: OfferedBy[] = ['buyer', 'seller'];

// ---------------------------------------------------------------------------
// GET /policy
// ---------------------------------------------------------------------------
negotiationRouter.get('/policy', async (c) => {
  const auth = getAuth(c);
  const workspaceId = auth.workspaceId;
  if (!workspaceId) return c.json({ error: 'workspace_id required in auth context' }, 400);

  const repo = new NegotiationRepository(c.env.DB);
  const policy = await repo.getVendorPolicy(workspaceId, auth.tenantId);
  if (!policy) return c.json({ error: 'No pricing policy configured' }, 404);

  return c.json({ policy: stripMinPrice(policy) });
});

// ---------------------------------------------------------------------------
// PUT /policy
// ---------------------------------------------------------------------------
negotiationRouter.put('/policy', async (c) => {
  const auth = getAuth(c);
  const workspaceId = auth.workspaceId;
  if (!workspaceId) return c.json({ error: 'workspace_id required in auth context' }, 400);

  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }

  const mode = body.default_pricing_mode as string;
  if (!VALID_PRICING_MODES.includes(mode as PricingMode)) {
    return c.json({ error: 'default_pricing_mode must be fixed, negotiable, or hybrid', code: 'invalid_value' }, 422);
  }

  const maxDiscountBps = body.max_discount_bps !== undefined ? Number(body.max_discount_bps) : 1500;
  if (!Number.isInteger(maxDiscountBps) || maxDiscountBps < 0 || maxDiscountBps > 10000) {
    return c.json({ error: 'max_discount_bps must be an integer 0–10000', code: 'invalid_value' }, 422);
  }

  const maxRounds = body.max_offer_rounds !== undefined ? Number(body.max_offer_rounds) : 3;
  if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 10) {
    return c.json({ error: 'max_offer_rounds must be an integer 1–10', code: 'invalid_value' }, 422);
  }

  const expiryHours = body.offer_expiry_hours !== undefined ? Number(body.offer_expiry_hours) : 48;
  if (!Number.isInteger(expiryHours) || expiryHours < 1 || expiryHours > 720) {
    return c.json({ error: 'offer_expiry_hours must be an integer 1–720', code: 'invalid_value' }, 422);
  }

  const kycTier = body.eligible_buyer_kyc_tier !== undefined ? Number(body.eligible_buyer_kyc_tier) : 1;
  if (!Number.isInteger(kycTier) || kycTier < 1 || kycTier > 3) {
    return c.json({ error: 'eligible_buyer_kyc_tier must be 1, 2, or 3', code: 'invalid_value' }, 422);
  }

  let autoAcceptBps: number | null = null;
  if (body.auto_accept_threshold_bps !== null && body.auto_accept_threshold_bps !== undefined) {
    autoAcceptBps = Number(body.auto_accept_threshold_bps);
    if (!Number.isInteger(autoAcceptBps) || autoAcceptBps < 0 || autoAcceptBps > 10000) {
      return c.json({ error: 'auto_accept_threshold_bps must be an integer 0–10000', code: 'invalid_value' }, 422);
    }
  }

  let minPriceKobo: number | null = null;
  if (body.min_price_kobo !== null && body.min_price_kobo !== undefined) {
    minPriceKobo = Number(body.min_price_kobo);
    if (!Number.isInteger(minPriceKobo) || minPriceKobo < 0) {
      return c.json({ error: 'min_price_kobo must be a non-negative integer', code: 'invalid_value' }, 422);
    }
  }

  let wholesaleMinQty: number | null = null;
  if (body.wholesale_min_qty !== null && body.wholesale_min_qty !== undefined) {
    wholesaleMinQty = Number(body.wholesale_min_qty);
    if (!Number.isInteger(wholesaleMinQty) || wholesaleMinQty < 1) {
      return c.json({ error: 'wholesale_min_qty must be a positive integer', code: 'invalid_value' }, 422);
    }
  }

  const repo = new NegotiationRepository(c.env.DB);
  const policy = await repo.upsertVendorPolicy({
    workspace_id: workspaceId,
    tenant_id: auth.tenantId,
    default_pricing_mode: mode as PricingMode,
    min_price_kobo: minPriceKobo,
    max_discount_bps: maxDiscountBps,
    max_offer_rounds: maxRounds,
    offer_expiry_hours: expiryHours,
    auto_accept_threshold_bps: autoAcceptBps,
    eligible_buyer_kyc_tier: kycTier,
    wholesale_min_qty: wholesaleMinQty,
  });

  return c.json({ policy: stripMinPrice(policy) });
});

// ---------------------------------------------------------------------------
// POST /listings/:type/:id/mode
// ---------------------------------------------------------------------------
negotiationRouter.post('/listings/:type/:id/mode', async (c) => {
  const auth = getAuth(c);
  const workspaceId = auth.workspaceId;
  if (!workspaceId) return c.json({ error: 'workspace_id required' }, 400);

  const { type: listingType, id: listingId } = c.req.param();

  if (isNegotiationBlocked(listingType)) {
    return c.json({ error: `Negotiation is not available for listing type: ${listingType}`, code: 'negotiation_blocked' }, 422);
  }

  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }

  const mode = body.pricing_mode as string;
  if (!VALID_PRICING_MODES.includes(mode as PricingMode)) {
    return c.json({ error: 'pricing_mode must be fixed, negotiable, or hybrid', code: 'invalid_value' }, 422);
  }

  const listedPrice = Number(body.listed_price_kobo);
  if (!Number.isInteger(listedPrice) || listedPrice <= 0) {
    return c.json({ error: 'listed_price_kobo must be a positive integer', code: 'invalid_value' }, 422);
  }

  const repo = new NegotiationRepository(c.env.DB);
  const override = await repo.upsertListingOverride({
    workspace_id: workspaceId,
    tenant_id: auth.tenantId,
    listing_type: listingType,
    listing_id: listingId,
    pricing_mode: mode as PricingMode,
    listed_price_kobo: listedPrice,
    min_price_kobo: (body.min_price_kobo as number | null) ?? null,
    max_discount_bps: (body.max_discount_bps as number | null) ?? null,
    max_offer_rounds: (body.max_offer_rounds as number | null) ?? null,
    offer_expiry_hours: (body.offer_expiry_hours as number | null) ?? null,
    auto_accept_threshold_bps: (body.auto_accept_threshold_bps as number | null) ?? null,
    valid_until: (body.valid_until as number | null) ?? null,
  });

  return c.json({ listing_price_override: stripMinPrice(override) });
});

// ---------------------------------------------------------------------------
// GET /listings/:type/:id/mode
// ---------------------------------------------------------------------------
negotiationRouter.get('/listings/:type/:id/mode', async (c) => {
  const auth = getAuth(c);
  const { type: listingType, id: listingId } = c.req.param();

  const repo = new NegotiationRepository(c.env.DB);
  const override = await repo.getListingOverride(listingType, listingId, auth.tenantId);

  if (override) {
    return c.json({
      listing_type: listingType,
      listing_id: listingId,
      pricing_mode: override.pricing_mode,
      listed_price_kobo: override.listed_price_kobo,
      valid_until: override.valid_until,
      source: 'listing_override',
    });
  }

  const policy = await repo.getVendorPolicy(auth.workspaceId ?? '', auth.tenantId);
  if (policy) {
    return c.json({
      listing_type: listingType,
      listing_id: listingId,
      pricing_mode: policy.default_pricing_mode,
      listed_price_kobo: null,
      valid_until: null,
      source: 'vendor_policy',
    });
  }

  return c.json({
    listing_type: listingType,
    listing_id: listingId,
    pricing_mode: 'fixed' as PricingMode,
    listed_price_kobo: null,
    valid_until: null,
    source: 'default',
  });
});

// ---------------------------------------------------------------------------
// DELETE /listings/:type/:id/mode
// ---------------------------------------------------------------------------
negotiationRouter.delete('/listings/:type/:id/mode', async (c) => {
  const auth = getAuth(c);
  const workspaceId = auth.workspaceId;
  if (!workspaceId) return c.json({ error: 'workspace_id required' }, 400);

  const { type: listingType, id: listingId } = c.req.param();

  const repo = new NegotiationRepository(c.env.DB);
  const existing = await repo.getListingOverride(listingType, listingId, auth.tenantId);
  if (!existing) return c.json({ error: 'No listing override found' }, 404);
  if (existing.workspace_id !== workspaceId) return c.json({ error: 'Forbidden' }, 403);

  await repo.deleteListingOverride(listingType, listingId, auth.tenantId, workspaceId);
  return c.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// POST /sessions  — Buyer opens negotiation session
// ---------------------------------------------------------------------------
negotiationRouter.post('/sessions', async (c) => {
  const auth = getAuth(c);

  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }

  const listingType = String(body.listing_type ?? '');
  const listingId = String(body.listing_id ?? '');
  const sellerWorkspaceId = String(body.seller_workspace_id ?? '');
  const sessionType = String(body.session_type ?? 'offer');

  if (!listingType || !listingId || !sellerWorkspaceId) {
    return c.json({ error: 'listing_type, listing_id, seller_workspace_id are required', code: 'invalid_value' }, 422);
  }
  if (!VALID_SESSION_TYPES.includes(sessionType as SessionType)) {
    return c.json({ error: 'session_type must be offer, bulk_rfq, or service_quote', code: 'invalid_value' }, 422);
  }

  const initialOffer = Number(body.initial_offer_kobo);
  if (!Number.isInteger(initialOffer) || initialOffer <= 0) {
    return c.json({ error: 'initial_offer_kobo must be a positive integer', code: 'invalid_value' }, 422);
  }

  const buyerRefId = auth.userId;
  const kycTier = auth.kycTier ?? 1;

  const repo = new NegotiationRepository(c.env.DB);
  const engine = new NegotiationEngine(repo);

  try {
    const session = await engine.openSession(
      {
        tenant_id: auth.tenantId,
        listing_type: listingType,
        listing_id: listingId,
        seller_workspace_id: sellerWorkspaceId,
        buyer_ref_id: buyerRefId,
        session_type: sessionType as SessionType,
        initial_offer_kobo: initialOffer,
        quantity: body.quantity ? Number(body.quantity) : 1,
        ...(body.notes ? { notes: String(body.notes) } : {}),
      },
      kycTier,
      sellerWorkspaceId,
    );
    return c.json({ session }, 201);
  } catch (err) {
    return handleEngineError(c, err);
  }
});

// ---------------------------------------------------------------------------
// GET /sessions  — List sessions for caller
// ---------------------------------------------------------------------------
negotiationRouter.get('/sessions', async (c) => {
  const auth = getAuth(c);
  const workspaceId = auth.workspaceId;
  const statusFilter = c.req.query('status') ?? undefined;

  const repo = new NegotiationRepository(c.env.DB);

  const asSeller = workspaceId
    ? await repo.listSessionsForSeller(workspaceId, auth.tenantId, statusFilter)
    : [];
  const asBuyer = await repo.listSessionsForBuyer(auth.userId, auth.tenantId, statusFilter);

  const allIds = new Set<string>();
  const sessions: NegotiationSession[] = [];
  for (const s of [...asSeller, ...asBuyer]) {
    if (!allIds.has(s.id)) { allIds.add(s.id); sessions.push(s); }
  }

  return c.json({ sessions });
});

// ---------------------------------------------------------------------------
// GET /sessions/:id
// ---------------------------------------------------------------------------
negotiationRouter.get('/sessions/:id', async (c) => {
  const auth = getAuth(c);
  const { id } = c.req.param();

  const repo = new NegotiationRepository(c.env.DB);
  const session = await repo.getSession(id, auth.tenantId);
  if (!session) return c.json({ error: 'Session not found', code: 'session_not_found' }, 404);

  const isSeller = auth.workspaceId === session.seller_workspace_id;
  const isBuyer = auth.userId === session.buyer_ref_id;
  if (!isSeller && !isBuyer) return c.json({ error: 'Forbidden', code: 'unauthorized' }, 403);

  return c.json({ session });
});

// ---------------------------------------------------------------------------
// POST /sessions/:id/offer  — Submit offer or counteroffer
// ---------------------------------------------------------------------------
negotiationRouter.post('/sessions/:id/offer', async (c) => {
  const auth = getAuth(c);
  const { id } = c.req.param();

  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }

  const offeredBy = String(body.offered_by ?? '');
  if (!VALID_OFFERED_BY.includes(offeredBy as OfferedBy)) {
    return c.json({ error: 'offered_by must be buyer or seller', code: 'invalid_value' }, 422);
  }

  const amountKobo = Number(body.amount_kobo);
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    return c.json({ error: 'amount_kobo must be a positive integer', code: 'invalid_value' }, 422);
  }

  const actorWorkspaceId = offeredBy === 'seller'
    ? (auth.workspaceId ?? auth.userId)
    : auth.userId;

  const repo = new NegotiationRepository(c.env.DB);
  const engine = new NegotiationEngine(repo);

  try {
    const offer = await engine.submitOffer({
      session_id: id,
      tenant_id: auth.tenantId,
      offered_by: offeredBy as OfferedBy,
      amount_kobo: amountKobo,
      actor_workspace_id: actorWorkspaceId,
      ...(body.message ? { message: String(body.message) } : {}),
    });
    return c.json({ offer });
  } catch (err) {
    return handleEngineError(c, err);
  }
});

// ---------------------------------------------------------------------------
// POST /sessions/:id/accept
// ---------------------------------------------------------------------------
negotiationRouter.post('/sessions/:id/accept', async (c) => {
  const auth = getAuth(c);
  const { id } = c.req.param();

  const actorWorkspaceId = auth.workspaceId ?? auth.userId;

  const repo = new NegotiationRepository(c.env.DB);
  const engine = new NegotiationEngine(repo);

  try {
    const session = await engine.acceptOffer(id, auth.tenantId, actorWorkspaceId);

    let price_lock_token: string | null = null;
    try {
      price_lock_token = generatePriceLockToken(session);
    } catch {
      price_lock_token = null;
    }

    return c.json({ session, price_lock_token });
  } catch (err) {
    return handleEngineError(c, err);
  }
});

// ---------------------------------------------------------------------------
// POST /sessions/:id/decline
// ---------------------------------------------------------------------------
negotiationRouter.post('/sessions/:id/decline', async (c) => {
  const auth = getAuth(c);
  const { id } = c.req.param();

  const actorWorkspaceId = auth.workspaceId ?? auth.userId;

  const repo = new NegotiationRepository(c.env.DB);
  const engine = new NegotiationEngine(repo);

  try {
    await engine.declineSession(id, auth.tenantId, actorWorkspaceId);
    return c.json({ declined: true });
  } catch (err) {
    return handleEngineError(c, err);
  }
});

// ---------------------------------------------------------------------------
// POST /sessions/:id/cancel  — Buyer cancels
// ---------------------------------------------------------------------------
negotiationRouter.post('/sessions/:id/cancel', async (c) => {
  const auth = getAuth(c);
  const { id } = c.req.param();

  const repo = new NegotiationRepository(c.env.DB);
  const engine = new NegotiationEngine(repo);

  try {
    await engine.cancelSession(id, auth.tenantId, auth.userId);
    return c.json({ cancelled: true });
  } catch (err) {
    return handleEngineError(c, err);
  }
});

// ---------------------------------------------------------------------------
// GET /sessions/:id/history
// ---------------------------------------------------------------------------
negotiationRouter.get('/sessions/:id/history', async (c) => {
  const auth = getAuth(c);
  const { id } = c.req.param();

  const repo = new NegotiationRepository(c.env.DB);
  const session = await repo.getSession(id, auth.tenantId);
  if (!session) return c.json({ error: 'Session not found', code: 'session_not_found' }, 404);

  const isSeller = auth.workspaceId === session.seller_workspace_id;
  const isBuyer = auth.userId === session.buyer_ref_id;
  if (!isSeller && !isBuyer) return c.json({ error: 'Forbidden', code: 'unauthorized' }, 403);

  const offers = await repo.listOffersForSession(id, auth.tenantId);
  return c.json({ session_id: id, offers });
});

// ---------------------------------------------------------------------------
// GET /analytics  — Seller analytics (seller role required)
// ---------------------------------------------------------------------------
negotiationRouter.get('/analytics', async (c) => {
  const auth = getAuth(c);
  const workspaceId = auth.workspaceId;
  if (!workspaceId) return c.json({ error: 'Seller workspace required', code: 'unauthorized' }, 403);

  const fromUnix = c.req.query('from_unix') ? Number(c.req.query('from_unix')) : undefined;
  const toUnix = c.req.query('to_unix') ? Number(c.req.query('to_unix')) : undefined;

  const repo = new NegotiationRepository(c.env.DB);
  const analytics = await repo.getSellerAnalytics(workspaceId, auth.tenantId, fromUnix, toUnix);

  return c.json({ analytics });
});

// ---------------------------------------------------------------------------
// POST /checkout/verify-price-lock  — Verify price lock token for checkout
// ---------------------------------------------------------------------------
negotiationRouter.post('/checkout/verify-price-lock', async (c) => {
  const auth = getAuth(c);

  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }

  const token = String(body.price_lock_token ?? '');
  if (!token) return c.json({ error: 'price_lock_token is required', code: 'invalid_value' }, 422);

  try {
    const result = verifyPriceLockToken(token, auth.tenantId);
    return c.json({ valid: true, session_id: result.session_id, final_price_kobo: result.final_price_kobo });
  } catch (err) {
    return handleEngineError(c, err);
  }
});
