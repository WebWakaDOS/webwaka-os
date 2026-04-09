/**
 * Travel Agent / Tour Operator vertical routes — M9 Commerce P2 Batch 2
 *
 * POST   /travel-agent                             — Create profile
 * GET    /travel-agent/workspace/:workspaceId      — Get by workspace (T3)
 * GET    /travel-agent/:id                         — Get profile (T3)
 * PATCH  /travel-agent/:id                         — Update profile
 * POST   /travel-agent/:id/transition              — FSM transition
 * POST   /travel-agent/:id/packages                — Create travel package (P9)
 * GET    /travel-agent/:id/packages                — List packages
 * POST   /travel-agent/:id/bookings                — Create booking (P9)
 * GET    /travel-agent/:id/bookings                — List bookings
 * PATCH  /travel-agent/:id/bookings/:bookingId     — Update booking status
 * PATCH  /travel-agent/:id/bookings/:bookingId/visa — Update visa status
 * GET    /travel-agent/:id/ai-advisory             — AI demand planning (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  TravelAgentRepository,
  guardSeedToClaimed,
  guardClaimedToNantaVerified,
  isValidTravelAgentTransition,
} from '@webwaka/verticals-travel-agent';
import type { TravelAgentFSMState, BookingStatus, VisaStatus } from '@webwaka/verticals-travel-agent';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const travelAgentRoutes = new Hono<{ Bindings: Env }>();

travelAgentRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; agency_name?: string; nanta_number?: string; iata_code?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.agency_name) return c.json({ error: 'workspace_id, agency_name are required' }, 400);
  const repo = new TravelAgentRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, agencyName: body.agency_name, nantaNumber: body.nanta_number, iataCode: body.iata_code, cacRc: body.cac_rc });
  return c.json({ travel_agent: profile }, 201);
});

travelAgentRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new TravelAgentRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ travel_agent: profile });
});

travelAgentRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new TravelAgentRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Travel agent profile not found' }, 404);
  return c.json({ travel_agent: profile });
});

travelAgentRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { agency_name?: string; nanta_number?: string; iata_code?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new TravelAgentRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { agencyName: body.agency_name, nantaNumber: body.nanta_number, iataCode: body.iata_code, cacRc: body.cac_rc });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ travel_agent: updated });
});

travelAgentRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new TravelAgentRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as TravelAgentFSMState;
  if (!isValidTravelAgentTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'nanta_verified') {
    const g = guardClaimedToNantaVerified({ nantaNumber: profile.nantaNumber ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ travel_agent: updated });
});

travelAgentRoutes.post('/:id/packages', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { package_name?: string; destination?: string; type?: string; duration_days?: number; price_per_pax_kobo?: number; inclusions?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.package_name || !body.destination || !body.type || body.price_per_pax_kobo === undefined) return c.json({ error: 'package_name, destination, type, price_per_pax_kobo are required' }, 400);
  const repo = new TravelAgentRepository(c.env.DB);
  try {
    const pkg = await repo.createPackage({ workspaceId: id, tenantId: auth.tenantId, packageName: body.package_name, destination: body.destination, type: body.type as never, durationDays: body.duration_days, pricePerPaxKobo: body.price_per_pax_kobo, inclusions: body.inclusions });
    return c.json({ package: pkg }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

travelAgentRoutes.get('/:id/packages', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new TravelAgentRepository(c.env.DB);
  const packages = await repo.listPackages(id, auth.tenantId);
  return c.json({ packages, count: packages.length });
});

travelAgentRoutes.post('/:id/bookings', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { client_phone?: string; package_id?: string; travel_date?: number; pax_count?: number; total_kobo?: number; deposit_kobo?: number; balance_kobo?: number; visa_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_phone || !body.package_id || body.travel_date === undefined || body.total_kobo === undefined || body.deposit_kobo === undefined || body.balance_kobo === undefined) return c.json({ error: 'client_phone, package_id, travel_date, total_kobo, deposit_kobo, balance_kobo are required' }, 400);
  const repo = new TravelAgentRepository(c.env.DB);
  try {
    const booking = await repo.createBooking({ workspaceId: id, tenantId: auth.tenantId, clientPhone: body.client_phone, packageId: body.package_id, travelDate: body.travel_date, paxCount: body.pax_count, totalKobo: body.total_kobo, depositKobo: body.deposit_kobo, balanceKobo: body.balance_kobo, visaStatus: body.visa_status as never });
    return c.json({ booking }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

travelAgentRoutes.get('/:id/bookings', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new TravelAgentRepository(c.env.DB);
  const bookings = await repo.listBookings(id, auth.tenantId);
  return c.json({ bookings, count: bookings.length });
});

travelAgentRoutes.patch('/:id/bookings/:bookingId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { bookingId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new TravelAgentRepository(c.env.DB);
  const updated = await repo.updateBookingStatus(bookingId, auth.tenantId, body.status as BookingStatus);
  if (!updated) return c.json({ error: 'Booking not found' }, 404);
  return c.json({ booking: updated });
});

travelAgentRoutes.patch('/:id/bookings/:bookingId/visa', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { bookingId } = c.req.param();
  let body: { visa_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.visa_status) return c.json({ error: 'visa_status is required' }, 400);
  const repo = new TravelAgentRepository(c.env.DB);
  const updated = await repo.updateVisaStatus(bookingId, auth.tenantId, body.visa_status as VisaStatus);
  if (!updated) return c.json({ error: 'Booking not found' }, 404);
  return c.json({ booking: updated });
});

// AI advisory — package aggregate; no client phone (P13)
travelAgentRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new TravelAgentRepository(c.env.DB);
    const packages = await repo.listPackages(id, auth.tenantId);
    // P13: no client phone in advisory
    const advisory = packages.map(p => ({ package_name: p.packageName, destination: p.destination, type: p.type, duration_days: p.durationDays, price_per_pax_kobo: p.pricePerPaxKobo }));
    return c.json({ capability: 'DEMAND_PLANNING', advisory_data: advisory, count: advisory.length });
  },
);
