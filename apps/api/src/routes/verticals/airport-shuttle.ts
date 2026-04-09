/**
 * Airport Shuttle Service vertical routes — M12 Transport Extended
 *
 * POST   /airport-shuttle                         — Create profile
 * GET    /airport-shuttle/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /airport-shuttle/:id                     — Get profile (T3)
 * PATCH  /airport-shuttle/:id                     — Update profile
 * POST   /airport-shuttle/:id/transition          — FSM transition
 * POST   /airport-shuttle/:id/vehicles            — Add vehicle
 * GET    /airport-shuttle/:id/vehicles            — List vehicles (T3)
 * POST   /airport-shuttle/:id/bookings            — Create booking (P9; P13: passenger_phone stripped)
 * GET    /airport-shuttle/:id/bookings            — List bookings (T3)
 * PATCH  /airport-shuttle/:id/bookings/:bid       — Update booking status
 * GET    /airport-shuttle/:id/ai-route            — AI route optimization (P13)
 *
 * Platform Invariants: T3, P9, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  AirportShuttleRepository,
  guardSeedToClaimed,
  guardClaimedToFaanVerified,
  isValidAirportShuttleTransition,
} from '@webwaka/verticals-airport-shuttle';
import type { AirportShuttleFSMState, BookingStatus } from '@webwaka/verticals-airport-shuttle';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const airportShuttleRoutes = new Hono<{ Bindings: Env }>();

airportShuttleRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; faan_permit?: string; frsc_commercial_licence?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new AirportShuttleRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, faanPermit: body.faan_permit, frscCommercialLicence: body.frsc_commercial_licence, cacRc: body.cac_rc });
  return c.json({ airport_shuttle: profile }, 201);
});

airportShuttleRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new AirportShuttleRepository(c.env.DB);
  return c.json({ airport_shuttle: await repo.findProfileByWorkspace(workspaceId, auth.tenantId) });
});

airportShuttleRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new AirportShuttleRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Airport shuttle profile not found' }, 404);
  return c.json({ airport_shuttle: profile });
});

airportShuttleRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; faan_permit?: string; frsc_commercial_licence?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new AirportShuttleRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, faanPermit: body.faan_permit, frscCommercialLicence: body.frsc_commercial_licence, cacRc: body.cac_rc });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ airport_shuttle: updated });
});

airportShuttleRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new AirportShuttleRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const to = body.to_status as AirportShuttleFSMState;
  if (!isValidAirportShuttleTransition(profile.status, to)) return c.json({ error: `Invalid transition: ${profile.status} → ${to}` }, 422);
  const kycTier = auth.kycTier ?? 0;
  if (profile.status === 'seeded' && to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (profile.status === 'claimed' && to === 'faan_verified') {
    const g = guardClaimedToFaanVerified({ faanPermit: profile.faanPermit, kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionStatus(id, auth.tenantId, to);
  return c.json({ airport_shuttle: updated });
});

airportShuttleRoutes.post('/:id/vehicles', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { vehicle_plate?: string; type?: string; capacity?: number; driver_id?: string; frsc_cert?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.vehicle_plate) return c.json({ error: 'vehicle_plate is required' }, 400);
  const repo = new AirportShuttleRepository(c.env.DB);
  const vehicle = await repo.createVehicle({ profileId: id, tenantId: auth.tenantId, vehiclePlate: body.vehicle_plate, type: body.type as import('@webwaka/verticals-airport-shuttle').VehicleType, capacity: body.capacity, driverId: body.driver_id, frscCert: body.frsc_cert });
  return c.json({ vehicle }, 201);
});

airportShuttleRoutes.get('/:id/vehicles', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new AirportShuttleRepository(c.env.DB);
  const vehicles = await repo.listVehicles(id, auth.tenantId);
  return c.json({ vehicles, count: vehicles.length });
});

airportShuttleRoutes.post('/:id/bookings', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { passenger_phone?: string; flight_number?: string; pickup_airport?: string; destination?: string; pickup_time?: number; fare_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (body.fare_kobo === undefined) return c.json({ error: 'fare_kobo is required' }, 400);
  const repo = new AirportShuttleRepository(c.env.DB);
  try {
    const booking = await repo.createBooking({ profileId: id, tenantId: auth.tenantId, passengerPhone: body.passenger_phone, flightNumber: body.flight_number, pickupAirport: body.pickup_airport, destination: body.destination, pickupTime: body.pickup_time, fareKobo: body.fare_kobo });
    return c.json({ booking }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

airportShuttleRoutes.get('/:id/bookings', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new AirportShuttleRepository(c.env.DB);
  const bookings = await repo.listBookings(id, auth.tenantId);
  return c.json({ bookings, count: bookings.length });
});

airportShuttleRoutes.patch('/:id/bookings/:bid', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { bid } = c.req.param();
  let body: { status?: string; driver_id?: string; vehicle_id?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new AirportShuttleRepository(c.env.DB);
  const updated = await repo.updateBookingStatus(bid, auth.tenantId, body.status as BookingStatus, body.driver_id, body.vehicle_id);
  if (!updated) return c.json({ error: 'Booking not found' }, 404);
  return c.json({ booking: updated });
});

// AI route optimization — P13: passenger_phone, flight_number NOT passed to AI
airportShuttleRoutes.get(
  '/:id/ai-route',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new AirportShuttleRepository(c.env.DB);
    const bookings = await repo.listBookings(id, auth.tenantId);
    const data = bookings.map(b => ({ pickup_airport: b.pickupAirport, destination: b.destination, status: b.status, fare_kobo: b.fareKobo }));
    return c.json({ capability: 'ROUTE_OPTIMIZATION', data, count: data.length });
  },
);
