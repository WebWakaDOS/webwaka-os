/**
 * Ferry / Water Transport Operator vertical routes — M12 Transport Extended
 *
 * POST   /ferry                         — Create profile
 * GET    /ferry/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /ferry/:id                     — Get profile (T3)
 * PATCH  /ferry/:id                     — Update profile
 * POST   /ferry/:id/transition          — FSM transition
 * POST   /ferry/:id/vessels             — Add vessel
 * GET    /ferry/:id/vessels             — List vessels (T3)
 * POST   /ferry/:id/trips               — Create trip (P9)
 * GET    /ferry/:id/trips               — List trips (T3)
 * PATCH  /ferry/:id/trips/:tid          — Update trip status
 * GET    /ferry/:id/ai-route            — AI route optimization (P13)
 *
 * Platform Invariants: T3, P9, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  FerryRepository,
  guardSeedToClaimed,
  guardClaimedToNimasaVerified,
  isValidFerryTransition,
} from '@webwaka/verticals-ferry';
import type { FerryFSMState, TripStatus, VesselType } from '@webwaka/verticals-ferry';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const ferryRoutes = new Hono<{ Bindings: Env }>();

ferryRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; nimasa_licence?: string; nrc_compliance?: boolean; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new FerryRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, nimasaLicence: body.nimasa_licence, nrcCompliance: body.nrc_compliance, cacRc: body.cac_rc });
  return c.json({ ferry: profile }, 201);
});

ferryRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new FerryRepository(c.env.DB);
  return c.json({ ferry: await repo.findProfileByWorkspace(workspaceId, auth.tenantId) });
});

ferryRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new FerryRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Ferry profile not found' }, 404);
  return c.json({ ferry: profile });
});

ferryRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; nimasa_licence?: string; nrc_compliance?: boolean; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new FerryRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, nimasaLicence: body.nimasa_licence, nrcCompliance: body.nrc_compliance, cacRc: body.cac_rc });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ ferry: updated });
});

ferryRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new FerryRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const to = body.to_status as FerryFSMState;
  if (!isValidFerryTransition(profile.status, to)) return c.json({ error: `Invalid transition: ${profile.status} → ${to}` }, 422);
  const kycTier = auth.kycTier ?? 0;
  if (profile.status === 'seeded' && to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (profile.status === 'claimed' && to === 'nimasa_verified') {
    const g = guardClaimedToNimasaVerified({ nimasaLicence: profile.nimasaLicence, kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionStatus(id, auth.tenantId, to);
  return c.json({ ferry: updated });
});

ferryRoutes.post('/:id/vessels', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { vessel_name?: string; type?: string; capacity_passengers?: number; nimasa_reg?: string; route_description?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.vessel_name || body.capacity_passengers === undefined) return c.json({ error: 'vessel_name, capacity_passengers are required' }, 400);
  const repo = new FerryRepository(c.env.DB);
  try {
    const vessel = await repo.createVessel({ profileId: id, tenantId: auth.tenantId, vesselName: body.vessel_name, type: body.type as VesselType, capacityPassengers: body.capacity_passengers, nimasaReg: body.nimasa_reg, routeDescription: body.route_description });
    return c.json({ vessel }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

ferryRoutes.get('/:id/vessels', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new FerryRepository(c.env.DB);
  const vessels = await repo.listVessels(id, auth.tenantId);
  return c.json({ vessels, count: vessels.length });
});

ferryRoutes.post('/:id/trips', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { vessel_id?: string; route?: string; departure_time?: number; passenger_count?: number; ticket_price_kobo?: number; total_revenue_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.vessel_id || body.passenger_count === undefined || body.ticket_price_kobo === undefined || body.total_revenue_kobo === undefined) return c.json({ error: 'vessel_id, passenger_count, ticket_price_kobo, total_revenue_kobo are required' }, 400);
  const repo = new FerryRepository(c.env.DB);
  try {
    const trip = await repo.createTrip({ vesselId: body.vessel_id, profileId: id, tenantId: auth.tenantId, route: body.route, departureTime: body.departure_time, passengerCount: body.passenger_count, ticketPriceKobo: body.ticket_price_kobo, totalRevenueKobo: body.total_revenue_kobo });
    return c.json({ trip }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

ferryRoutes.get('/:id/trips', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new FerryRepository(c.env.DB);
  const trips = await repo.listTrips(id, auth.tenantId);
  return c.json({ trips, count: trips.length });
});

ferryRoutes.patch('/:id/trips/:tid', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { tid } = c.req.param();
  let body: { status?: string; arrival_time?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new FerryRepository(c.env.DB);
  const updated = await repo.updateTripStatus(tid, auth.tenantId, body.status as TripStatus, body.arrival_time);
  if (!updated) return c.json({ error: 'Trip not found' }, 404);
  return c.json({ trip: updated });
});

// AI route optimization — P13: no passenger-level PII passed to AI
ferryRoutes.get(
  '/:id/ai-route',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new FerryRepository(c.env.DB);
    const trips = await repo.listTrips(id, auth.tenantId);
    const data = trips.map(t => ({ route: t.route, passenger_count: t.passengerCount, ticket_price_kobo: t.ticketPriceKobo, total_revenue_kobo: t.totalRevenueKobo, status: t.status }));
    return c.json({ capability: 'ROUTE_OPTIMIZATION', data, count: data.length });
  },
);
