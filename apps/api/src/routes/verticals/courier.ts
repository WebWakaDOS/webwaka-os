/**
 * Courier Service vertical routes — M9 Transport Extended
 *
 * POST   /courier                         — Create profile
 * GET    /courier/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /courier/:id                     — Get profile (T3)
 * PATCH  /courier/:id                     — Update profile
 * POST   /courier/:id/transition          — FSM transition
 * POST   /courier/:id/riders              — Add rider
 * GET    /courier/:id/riders              — List riders (T3)
 * POST   /courier/:id/parcels             — Create parcel (P9; P13: phones stripped)
 * GET    /courier/:id/parcels             — List parcels (T3)
 * PATCH  /courier/:id/parcels/:pid        — Update parcel status
 * POST   /courier/:id/parcels/:pid/cod    — Record COD remittance (P9)
 * GET    /courier/:id/ai-eta              — AI delivery ETA prediction (P13)
 *
 * Platform Invariants: T3, P9, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  CourierRepository,
  guardSeedToClaimed,
  guardClaimedToCacVerified,
  isValidCourierTransition,
} from '@webwaka/verticals-courier';
import type { CourierFSMState, ParcelStatus } from '@webwaka/verticals-courier';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const courierRoutes = new Hono<{ Bindings: Env }>();

courierRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; ncc_registered?: boolean; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new CourierRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, nccRegistered: body.ncc_registered, cacRc: body.cac_rc });
  return c.json({ courier: profile }, 201);
});

courierRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new CourierRepository(c.env.DB);
  return c.json({ courier: await repo.findProfileByWorkspace(workspaceId, auth.tenantId) });
});

courierRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new CourierRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Courier profile not found' }, 404);
  return c.json({ courier: profile });
});

courierRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; ncc_registered?: boolean; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new CourierRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, nccRegistered: body.ncc_registered, cacRc: body.cac_rc });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ courier: updated });
});

courierRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new CourierRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const to = body.to_status as CourierFSMState;
  if (!isValidCourierTransition(profile.status, to)) return c.json({ error: `Invalid transition: ${profile.status} → ${to}` }, 422);
  const kycTier = auth.kycTier ?? 0;
  if (profile.status === 'seeded' && to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (profile.status === 'claimed' && to === 'cac_verified') {
    const g = guardClaimedToCacVerified({ cacRc: profile.cacRc, kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionStatus(id, auth.tenantId, to);
  return c.json({ courier: updated });
});

courierRoutes.post('/:id/riders', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { rider_name?: string; phone?: string; vehicle_type?: string; license_number?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.rider_name) return c.json({ error: 'rider_name is required' }, 400);
  const repo = new CourierRepository(c.env.DB);
  const rider = await repo.createRider({ profileId: id, tenantId: auth.tenantId, riderName: body.rider_name, phone: body.phone, vehicleType: body.vehicle_type as import('@webwaka/verticals-courier').VehicleType, licenseNumber: body.license_number });
  return c.json({ rider }, 201);
});

courierRoutes.get('/:id/riders', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new CourierRepository(c.env.DB);
  const riders = await repo.listRiders(id, auth.tenantId);
  return c.json({ riders, count: riders.length });
});

courierRoutes.post('/:id/parcels', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { tracking_code?: string; sender_phone?: string; receiver_phone?: string; weight_grams?: number; description?: string; pickup_address?: string; delivery_address?: string; delivery_fee_kobo?: number; cod_amount_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.tracking_code || body.weight_grams === undefined || body.delivery_fee_kobo === undefined) return c.json({ error: 'tracking_code, weight_grams, delivery_fee_kobo are required' }, 400);
  const repo = new CourierRepository(c.env.DB);
  try {
    const parcel = await repo.createParcel({ profileId: id, tenantId: auth.tenantId, trackingCode: body.tracking_code, senderPhone: body.sender_phone, receiverPhone: body.receiver_phone, weightGrams: body.weight_grams, description: body.description, pickupAddress: body.pickup_address, deliveryAddress: body.delivery_address, deliveryFeeKobo: body.delivery_fee_kobo, codAmountKobo: body.cod_amount_kobo });
    return c.json({ parcel }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

courierRoutes.get('/:id/parcels', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new CourierRepository(c.env.DB);
  const parcels = await repo.listParcels(id, auth.tenantId);
  return c.json({ parcels, count: parcels.length });
});

courierRoutes.patch('/:id/parcels/:pid', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { pid } = c.req.param();
  let body: { status?: string; rider_id?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new CourierRepository(c.env.DB);
  const updated = await repo.updateParcelStatus(pid, auth.tenantId, body.status as ParcelStatus, body.rider_id);
  if (!updated) return c.json({ error: 'Parcel not found' }, 404);
  return c.json({ parcel: updated });
});

courierRoutes.post('/:id/parcels/:pid/cod', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { pid } = c.req.param();
  let body: { collected_kobo?: number; remitted_kobo?: number; remittance_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (body.collected_kobo === undefined || body.remitted_kobo === undefined) return c.json({ error: 'collected_kobo, remitted_kobo are required' }, 400);
  const repo = new CourierRepository(c.env.DB);
  try {
    const cod = await repo.createCodRemittance({ parcelId: pid, tenantId: auth.tenantId, collectedKobo: body.collected_kobo, remittedKobo: body.remitted_kobo, remittanceDate: body.remittance_date });
    return c.json({ cod_remittance: cod }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

// AI delivery ETA prediction — P13: sender_phone, receiver_phone stripped
courierRoutes.get(
  '/:id/ai-eta',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new CourierRepository(c.env.DB);
    const parcels = await repo.listParcels(id, auth.tenantId);
    const data = parcels.map(p => ({ status: p.status, weight_grams: p.weightGrams, delivery_fee_kobo: p.deliveryFeeKobo }));
    return c.json({ capability: 'DELIVERY_ETA_PREDICTION', data, count: data.length });
  },
);
