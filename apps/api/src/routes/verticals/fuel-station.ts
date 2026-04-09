/**
 * Fuel / Filling Station vertical routes — M9 Commerce P2 Batch 2
 *
 * POST   /fuel-station                              — Create profile
 * GET    /fuel-station/workspace/:workspaceId       — Get by workspace (T3)
 * GET    /fuel-station/:id                          — Get profile (T3)
 * PATCH  /fuel-station/:id                          — Update profile
 * POST   /fuel-station/:id/transition               — FSM transition
 * POST   /fuel-station/:id/pumps                    — Add pump (P9)
 * GET    /fuel-station/:id/pumps                    — List pumps
 * POST   /fuel-station/:id/pumps/:pumpId/readings   — Create daily reading (P9)
 * GET    /fuel-station/:id/pumps/:pumpId/readings   — List readings
 * POST   /fuel-station/:id/tanks                    — Create tank stock
 * GET    /fuel-station/:id/tanks                    — List tanks
 * GET    /fuel-station/:id/ai-advisory              — AI sales forecast (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  FuelStationRepository,
  guardSeedToClaimed,
  guardClaimedToNuprcVerified,
  isValidFuelStationTransition,
} from '@webwaka/verticals-fuel-station';
import type { FuelStationFSMState } from '@webwaka/verticals-fuel-station';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const fuelStationRoutes = new Hono<{ Bindings: Env }>();

fuelStationRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; station_name?: string; nuprc_licence?: string; nuprc_expiry?: number; dealer_type?: string; cac_number?: string; state?: string; lga?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.station_name) return c.json({ error: 'workspace_id, station_name are required' }, 400);
  const repo = new FuelStationRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, stationName: body.station_name, nuprcLicence: body.nuprc_licence, nuprcExpiry: body.nuprc_expiry, dealerType: body.dealer_type as never, cacNumber: body.cac_number, state: body.state, lga: body.lga });
  return c.json({ fuel_station: profile }, 201);
});

fuelStationRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new FuelStationRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ fuel_station: profile });
});

fuelStationRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new FuelStationRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Fuel station profile not found' }, 404);
  return c.json({ fuel_station: profile });
});

fuelStationRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { station_name?: string; nuprc_licence?: string; nuprc_expiry?: number; dealer_type?: string; cac_number?: string; state?: string; lga?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new FuelStationRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { stationName: body.station_name, nuprcLicence: body.nuprc_licence, nuprcExpiry: body.nuprc_expiry, dealerType: body.dealer_type as never, cacNumber: body.cac_number, state: body.state, lga: body.lga });
  if (!updated) return c.json({ error: 'Fuel station profile not found' }, 404);
  return c.json({ fuel_station: updated });
});

fuelStationRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new FuelStationRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as FuelStationFSMState;
  if (!isValidFuelStationTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'nuprc_verified') {
    const g = guardClaimedToNuprcVerified({ nuprcLicence: profile.nuprcLicence ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ fuel_station: updated });
});

fuelStationRoutes.post('/:id/pumps', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { pump_number?: string; product?: string; current_price_kobo_per_litre?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.pump_number || !body.product || body.current_price_kobo_per_litre === undefined) return c.json({ error: 'pump_number, product, current_price_kobo_per_litre are required' }, 400);
  const repo = new FuelStationRepository(c.env.DB);
  try {
    const pump = await repo.createPump({ stationId: id, workspaceId: id, tenantId: auth.tenantId, pumpNumber: body.pump_number, product: body.product as never, currentPriceKoboPerLitre: body.current_price_kobo_per_litre });
    return c.json({ pump }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

fuelStationRoutes.get('/:id/pumps', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new FuelStationRepository(c.env.DB);
  const pumps = await repo.listPumps(id, auth.tenantId);
  return c.json({ pumps, count: pumps.length });
});

fuelStationRoutes.post('/:id/pumps/:pumpId/readings', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id, pumpId } = c.req.param();
  let body: { shift_date?: number; opening_meter?: number; closing_meter?: number; litres_sold_ml?: number; cash_received_kobo?: number; attendant_name?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (body.shift_date === undefined || body.opening_meter === undefined || body.closing_meter === undefined || body.litres_sold_ml === undefined || body.cash_received_kobo === undefined) return c.json({ error: 'shift_date, opening_meter, closing_meter, litres_sold_ml, cash_received_kobo are required' }, 400);
  const repo = new FuelStationRepository(c.env.DB);
  try {
    const reading = await repo.createDailyReading({ pumpId, workspaceId: id, tenantId: auth.tenantId, shiftDate: body.shift_date, openingMeter: body.opening_meter, closingMeter: body.closing_meter, litresSoldMl: body.litres_sold_ml, cashReceivedKobo: body.cash_received_kobo, attendantName: body.attendant_name });
    return c.json({ reading }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('integer')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

fuelStationRoutes.get('/:id/pumps/:pumpId/readings', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { pumpId } = c.req.param();
  const repo = new FuelStationRepository(c.env.DB);
  const readings = await repo.listReadings(pumpId, auth.tenantId);
  return c.json({ readings, count: readings.length });
});

fuelStationRoutes.post('/:id/tanks', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { product?: string; capacity_ml?: number; current_level_ml?: number; last_delivery_ml?: number; last_delivery_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.product || body.capacity_ml === undefined) return c.json({ error: 'product, capacity_ml are required' }, 400);
  const repo = new FuelStationRepository(c.env.DB);
  try {
    const tank = await repo.createTankStock({ stationId: id, workspaceId: id, tenantId: auth.tenantId, product: body.product as never, capacityMl: body.capacity_ml, currentLevelMl: body.current_level_ml, lastDeliveryMl: body.last_delivery_ml, lastDeliveryDate: body.last_delivery_date });
    return c.json({ tank }, 201);
  } catch (err) {
    if (err instanceof Error) return c.json({ error: err.message }, 422);
    throw err;
  }
});

fuelStationRoutes.get('/:id/tanks', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new FuelStationRepository(c.env.DB);
  const tanks = await repo.listTanks(id, auth.tenantId);
  return c.json({ tanks, count: tanks.length });
});

// AI advisory — aggregate sales stats; no attendant PII (P13)
fuelStationRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new FuelStationRepository(c.env.DB);
    const pumps = await repo.listPumps(id, auth.tenantId);
    // P13: no attendant names; aggregate pricing
    const advisory = pumps.map(p => ({ product: p.product, current_price_kobo_per_litre: p.currentPriceKoboPerLitre }));
    return c.json({ capability: 'SALES_FORECAST', advisory_data: advisory, count: advisory.length });
  },
);
