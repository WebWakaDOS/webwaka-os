/**
 * Real Estate Agency vertical routes — M9 Commerce P2 Batch 2
 *
 * POST   /real-estate-agency                         — Create profile
 * GET    /real-estate-agency/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /real-estate-agency/:id                     — Get profile (T3)
 * PATCH  /real-estate-agency/:id                     — Update profile
 * POST   /real-estate-agency/:id/transition          — FSM transition
 * POST   /real-estate-agency/:id/listings            — Create listing (P9)
 * GET    /real-estate-agency/:id/listings            — List listings
 * PATCH  /real-estate-agency/:id/listings/:listingId — Update listing status
 * POST   /real-estate-agency/:id/listings/:listingId/enquiries  — Create enquiry (P13)
 * GET    /real-estate-agency/:id/listings/:listingId/enquiries  — List enquiries
 * POST   /real-estate-agency/:id/commissions         — Create commission (P9)
 * GET    /real-estate-agency/:id/commissions         — List commissions
 * GET    /real-estate-agency/:id/ai-advisory         — AI advisory (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 * P13: Client phone/name NEVER passed to AI advisory
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  RealEstateAgencyRepository,
  guardSeedToClaimed,
  guardClaimedToNiesvVerified,
  isValidRealEstateAgencyTransition,
} from '@webwaka/verticals-real-estate-agency';
import type { RealEstateAgencyFSMState, ListingStatus, EnquiryStatus } from '@webwaka/verticals-real-estate-agency';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const realEstateAgencyRoutes = new Hono<{ Bindings: Env }>();

realEstateAgencyRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; agency_name?: string; niesv_number?: string; esvarbon_number?: string; cac_number?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.agency_name) return c.json({ error: 'workspace_id, agency_name are required' }, 400);
  const repo = new RealEstateAgencyRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, agencyName: body.agency_name, niesvNumber: body.niesv_number, esvarbonNumber: body.esvarbon_number, cacNumber: body.cac_number });
  return c.json({ real_estate_agency: profile }, 201);
});

realEstateAgencyRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new RealEstateAgencyRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ real_estate_agency: profile });
});

realEstateAgencyRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new RealEstateAgencyRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Real estate agency profile not found' }, 404);
  return c.json({ real_estate_agency: profile });
});

realEstateAgencyRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { agency_name?: string; niesv_number?: string; esvarbon_number?: string; cac_number?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new RealEstateAgencyRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { agencyName: body.agency_name, niesvNumber: body.niesv_number, esvarbonNumber: body.esvarbon_number, cacNumber: body.cac_number });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ real_estate_agency: updated });
});

realEstateAgencyRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new RealEstateAgencyRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as RealEstateAgencyFSMState;
  if (!isValidRealEstateAgencyTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'niesv_verified') {
    const g = guardClaimedToNiesvVerified({ niesvNumber: profile.niesvNumber ?? null, esvarbonNumber: profile.esvarbonNumber ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ real_estate_agency: updated });
});

realEstateAgencyRoutes.post('/:id/listings', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { title?: string; type?: string; transaction_type?: string; state?: string; lga?: string; address?: string; price_kobo?: number; bedrooms?: number; bathrooms?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.title || !body.type || !body.transaction_type || body.price_kobo === undefined) return c.json({ error: 'title, type, transaction_type, price_kobo are required' }, 400);
  const repo = new RealEstateAgencyRepository(c.env.DB);
  try {
    const listing = await repo.createListing({ workspaceId: id, tenantId: auth.tenantId, title: body.title, type: body.type as never, transactionType: body.transaction_type as never, state: body.state, lga: body.lga, address: body.address, priceKobo: body.price_kobo, bedrooms: body.bedrooms, bathrooms: body.bathrooms });
    return c.json({ listing }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

realEstateAgencyRoutes.get('/:id/listings', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new RealEstateAgencyRepository(c.env.DB);
  const listings = await repo.listListings(id, auth.tenantId);
  return c.json({ listings, count: listings.length });
});

realEstateAgencyRoutes.patch('/:id/listings/:listingId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { listingId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new RealEstateAgencyRepository(c.env.DB);
  const updated = await repo.updateListingStatus(listingId, auth.tenantId, body.status as ListingStatus);
  if (!updated) return c.json({ error: 'Listing not found' }, 404);
  return c.json({ listing: updated });
});

realEstateAgencyRoutes.post('/:id/listings/:listingId/enquiries', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id, listingId } = c.req.param();
  let body: { client_phone?: string; client_name?: string; enquiry_type?: string; offer_price_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_phone || !body.client_name || !body.enquiry_type) return c.json({ error: 'client_phone, client_name, enquiry_type are required' }, 400);
  const repo = new RealEstateAgencyRepository(c.env.DB);
  const enquiry = await repo.createEnquiry({ listingId, workspaceId: id, tenantId: auth.tenantId, clientPhone: body.client_phone, clientName: body.client_name, enquiryType: body.enquiry_type as never, offerPriceKobo: body.offer_price_kobo });
  return c.json({ enquiry }, 201);
});

realEstateAgencyRoutes.get('/:id/listings/:listingId/enquiries', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { listingId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { body = {}; }
  const repo = new RealEstateAgencyRepository(c.env.DB);
  let enquiries = await repo.listEnquiries(listingId, auth.tenantId);
  if (body.status) enquiries = enquiries.filter(e => e.status === body.status as EnquiryStatus);
  return c.json({ enquiries, count: enquiries.length });
});

realEstateAgencyRoutes.post('/:id/commissions', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { listing_id?: string; transaction_type?: string; gross_value_kobo?: number; commission_rate_pct?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.listing_id || !body.transaction_type || body.gross_value_kobo === undefined || body.commission_rate_pct === undefined) return c.json({ error: 'listing_id, transaction_type, gross_value_kobo, commission_rate_pct are required' }, 400);
  const repo = new RealEstateAgencyRepository(c.env.DB);
  try {
    const commission = await repo.createCommission({ listingId: body.listing_id, workspaceId: id, tenantId: auth.tenantId, transactionType: body.transaction_type as never, grossValueKobo: body.gross_value_kobo, commissionRatePct: body.commission_rate_pct });
    return c.json({ commission }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

realEstateAgencyRoutes.get('/:id/commissions', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new RealEstateAgencyRepository(c.env.DB);
  const commissions = await repo.listCommissions(id, auth.tenantId);
  return c.json({ commissions, count: commissions.length });
});

// AI advisory — aggregate listing stats only; NEVER client PII (P13)
realEstateAgencyRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new RealEstateAgencyRepository(c.env.DB);
    const listings = await repo.listListings(id, auth.tenantId);
    // P13: no client phone/name; aggregate property stats only
    const advisory = listings.map(l => ({ type: l.type, transaction_type: l.transactionType, price_kobo: l.priceKobo, status: l.status, state: l.state }));
    return c.json({ capability: 'PROPERTY_VALUATION_ASSIST', advisory_data: advisory, count: advisory.length });
  },
);
