/**
 * Cargo Truck Fleet Operator vertical routes — M12 Transport Extended
 *
 * POST   /cargo-truck                         — Create profile
 * GET    /cargo-truck/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /cargo-truck/:id                     — Get profile (T3)
 * PATCH  /cargo-truck/:id                     — Update profile
 * POST   /cargo-truck/:id/transition          — FSM transition
 * POST   /cargo-truck/:id/trucks              — Add truck
 * GET    /cargo-truck/:id/trucks              — List trucks (T3)
 * POST   /cargo-truck/:id/trips               — Create trip (P9; P13: client_phone stripped)
 * GET    /cargo-truck/:id/trips               — List trips (T3)
 * PATCH  /cargo-truck/:id/trips/:tid          — Update trip status
 * POST   /cargo-truck/:id/trucks/:trid/expenses — Record expense (P9)
 * GET    /cargo-truck/:id/ai-efficiency       — AI fleet efficiency (P13)
 *
 * Platform Invariants: T3, P9, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  CargoTruckRepository,
  guardSeedToClaimed,
  guardClaimedToFrscVerified,
  isValidCargoTruckTransition,
} from '@webwaka/verticals-cargo-truck';
import type { CargoTruckFSMState, TripStatus, ExpenseType } from '@webwaka/verticals-cargo-truck';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const cargoTruckRoutes = new Hono<{ Bindings: Env }>();

cargoTruckRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; cac_or_coop_number?: string; frsc_operator_licence?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new CargoTruckRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, cacOrCoopNumber: body.cac_or_coop_number, frscOperatorLicence: body.frsc_operator_licence });
  return c.json({ cargo_truck: profile }, 201);
});

cargoTruckRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new CargoTruckRepository(c.env.DB);
  return c.json({ cargo_truck: await repo.findProfileByWorkspace(workspaceId, auth.tenantId) });
});

cargoTruckRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new CargoTruckRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Cargo truck profile not found' }, 404);
  return c.json({ cargo_truck: profile });
});

cargoTruckRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; cac_or_coop_number?: string; frsc_operator_licence?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new CargoTruckRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, cacOrCoopNumber: body.cac_or_coop_number, frscOperatorLicence: body.frsc_operator_licence });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ cargo_truck: updated });
});

cargoTruckRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new CargoTruckRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const to = body.to_status as CargoTruckFSMState;
  if (!isValidCargoTruckTransition(profile.status, to)) return c.json({ error: `Invalid transition: ${profile.status} → ${to}` }, 422);
  const kycTier = auth.kycTier ?? 0;
  if (profile.status === 'seeded' && to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (profile.status === 'claimed' && to === 'frsc_verified') {
    const g = guardClaimedToFrscVerified({ frscOperatorLicence: profile.frscOperatorLicence, kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionStatus(id, auth.tenantId, to);
  return c.json({ cargo_truck: updated });
});

cargoTruckRoutes.post('/:id/trucks', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { plate?: string; make?: string; model?: string; tonnage_kg?: number; frsc_cert_expiry?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.plate || body.tonnage_kg === undefined) return c.json({ error: 'plate, tonnage_kg are required' }, 400);
  const repo = new CargoTruckRepository(c.env.DB);
  try {
    const truck = await repo.createTruck({ profileId: id, tenantId: auth.tenantId, plate: body.plate, make: body.make, model: body.model, tonnageKg: body.tonnage_kg, frscCertExpiry: body.frsc_cert_expiry });
    return c.json({ truck }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

cargoTruckRoutes.get('/:id/trucks', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new CargoTruckRepository(c.env.DB);
  const trucks = await repo.listTrucks(id, auth.tenantId);
  return c.json({ trucks, count: trucks.length });
});

cargoTruckRoutes.post('/:id/trips', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { truck_id?: string; origin?: string; destination?: string; cargo_description?: string; cargo_weight_kg?: number; hire_rate_kobo?: number; client_phone?: string; departure_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.truck_id || body.cargo_weight_kg === undefined || body.hire_rate_kobo === undefined) return c.json({ error: 'truck_id, cargo_weight_kg, hire_rate_kobo are required' }, 400);
  const repo = new CargoTruckRepository(c.env.DB);
  try {
    const trip = await repo.createTrip({ truckId: body.truck_id, profileId: id, tenantId: auth.tenantId, origin: body.origin, destination: body.destination, cargoDescription: body.cargo_description, cargoWeightKg: body.cargo_weight_kg, hireRateKobo: body.hire_rate_kobo, clientPhone: body.client_phone, departureDate: body.departure_date });
    return c.json({ trip }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

cargoTruckRoutes.get('/:id/trips', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new CargoTruckRepository(c.env.DB);
  const trips = await repo.listTrips(id, auth.tenantId);
  return c.json({ trips, count: trips.length });
});

cargoTruckRoutes.patch('/:id/trips/:tid', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { tid } = c.req.param();
  let body: { status?: string; arrival_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new CargoTruckRepository(c.env.DB);
  const updated = await repo.updateTripStatus(tid, auth.tenantId, body.status as TripStatus, body.arrival_date);
  if (!updated) return c.json({ error: 'Trip not found' }, 404);
  return c.json({ trip: updated });
});

cargoTruckRoutes.post('/:id/trucks/:trid/expenses', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { trid } = c.req.param();
  let body: { expense_type?: string; amount_kobo?: number; expense_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (body.amount_kobo === undefined) return c.json({ error: 'amount_kobo is required' }, 400);
  const repo = new CargoTruckRepository(c.env.DB);
  try {
    const expense = await repo.createExpense({ truckId: trid, tenantId: auth.tenantId, expenseType: body.expense_type as ExpenseType, amountKobo: body.amount_kobo, expenseDate: body.expense_date });
    return c.json({ expense }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

// AI fleet efficiency — P13: client_phone NOT passed to AI
cargoTruckRoutes.get(
  '/:id/ai-efficiency',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new CargoTruckRepository(c.env.DB);
    const trips = await repo.listTrips(id, auth.tenantId);
    const data = trips.map(t => ({ origin: t.origin, destination: t.destination, cargo_weight_kg: t.cargoWeightKg, hire_rate_kobo: t.hireRateKobo, status: t.status }));
    return c.json({ capability: 'FLEET_EFFICIENCY_REPORT', data, count: data.length });
  },
);
