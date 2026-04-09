/**
 * Dispatch Rider Network vertical routes — M9 Transport Extended
 *
 * POST   /dispatch-rider                         — Create profile
 * GET    /dispatch-rider/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /dispatch-rider/:id                     — Get profile (T3)
 * PATCH  /dispatch-rider/:id                     — Update profile
 * POST   /dispatch-rider/:id/transition          — FSM transition
 * POST   /dispatch-rider/:id/riders              — Add rider
 * GET    /dispatch-rider/:id/riders              — List riders (T3)
 * POST   /dispatch-rider/:id/jobs                — Create job (P9)
 * GET    /dispatch-rider/:id/jobs                — List jobs (T3)
 * PATCH  /dispatch-rider/:id/jobs/:jid           — Update job status
 * POST   /dispatch-rider/:id/riders/:rid/earnings — Record rider earning (P9)
 * GET    /dispatch-rider/:id/ai-efficiency       — AI fleet efficiency (P13)
 *
 * Platform Invariants: T3, P9, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  DispatchRiderRepository,
  guardSeedToClaimed,
  guardClaimedToFrscVerified,
  isValidDispatchRiderTransition,
} from '@webwaka/verticals-dispatch-rider';
import type { DispatchRiderFSMState, JobStatus } from '@webwaka/verticals-dispatch-rider';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const dispatchRiderRoutes = new Hono<{ Bindings: Env }>();

dispatchRiderRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new DispatchRiderRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, cacRc: body.cac_rc });
  return c.json({ dispatch_rider: profile }, 201);
});

dispatchRiderRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new DispatchRiderRepository(c.env.DB);
  return c.json({ dispatch_rider: await repo.findProfileByWorkspace(workspaceId, auth.tenantId) });
});

dispatchRiderRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new DispatchRiderRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Dispatch rider profile not found' }, 404);
  return c.json({ dispatch_rider: profile });
});

dispatchRiderRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new DispatchRiderRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, cacRc: body.cac_rc });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ dispatch_rider: updated });
});

dispatchRiderRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new DispatchRiderRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const to = body.to_status as DispatchRiderFSMState;
  if (!isValidDispatchRiderTransition(profile.status, to)) return c.json({ error: `Invalid transition: ${profile.status} → ${to}` }, 422);
  const kycTier = auth.kycTier ?? 0;
  if (profile.status === 'seeded' && to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (profile.status === 'claimed' && to === 'frsc_verified') {
    const g = guardClaimedToFrscVerified({ frscLicenceOnFile: profile.cacRc !== null, kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionStatus(id, auth.tenantId, to);
  return c.json({ dispatch_rider: updated });
});

dispatchRiderRoutes.post('/:id/riders', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { rider_name?: string; phone?: string; frsc_licence?: string; vio_cert?: string; vehicle_plate?: string; commission_pct?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.rider_name) return c.json({ error: 'rider_name is required' }, 400);
  const repo = new DispatchRiderRepository(c.env.DB);
  const rider = await repo.createRider({ profileId: id, tenantId: auth.tenantId, riderName: body.rider_name, phone: body.phone, frscLicence: body.frsc_licence, vioCert: body.vio_cert, vehiclePlate: body.vehicle_plate, commissionPct: body.commission_pct });
  return c.json({ rider }, 201);
});

dispatchRiderRoutes.get('/:id/riders', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new DispatchRiderRepository(c.env.DB);
  const riders = await repo.listRiders(id, auth.tenantId);
  return c.json({ riders, count: riders.length });
});

dispatchRiderRoutes.post('/:id/jobs', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { pickup_address?: string; dropoff_address?: string; package_description?: string; fee_kobo?: number; cod_amount_kobo?: number; customer_phone?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (body.fee_kobo === undefined) return c.json({ error: 'fee_kobo is required' }, 400);
  const repo = new DispatchRiderRepository(c.env.DB);
  try {
    const job = await repo.createJob({ profileId: id, tenantId: auth.tenantId, pickupAddress: body.pickup_address, dropoffAddress: body.dropoff_address, packageDescription: body.package_description, feeKobo: body.fee_kobo, codAmountKobo: body.cod_amount_kobo, customerPhone: body.customer_phone });
    return c.json({ job }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

dispatchRiderRoutes.get('/:id/jobs', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new DispatchRiderRepository(c.env.DB);
  const jobs = await repo.listJobs(id, auth.tenantId);
  return c.json({ jobs, count: jobs.length });
});

dispatchRiderRoutes.patch('/:id/jobs/:jid', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { jid } = c.req.param();
  let body: { status?: string; rider_id?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new DispatchRiderRepository(c.env.DB);
  const updated = await repo.updateJobStatus(jid, auth.tenantId, body.status as JobStatus, body.rider_id);
  if (!updated) return c.json({ error: 'Job not found' }, 404);
  return c.json({ job: updated });
});

dispatchRiderRoutes.post('/:id/riders/:rid/earnings', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { rid } = c.req.param();
  let body: { job_id?: string; gross_fee_kobo?: number; commission_kobo?: number; net_payout_kobo?: number; payout_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.job_id || body.gross_fee_kobo === undefined || body.commission_kobo === undefined || body.net_payout_kobo === undefined) return c.json({ error: 'job_id, gross_fee_kobo, commission_kobo, net_payout_kobo are required' }, 400);
  const repo = new DispatchRiderRepository(c.env.DB);
  try {
    const earning = await repo.createRiderEarning({ riderId: rid, jobId: body.job_id, tenantId: auth.tenantId, grossFeeKobo: body.gross_fee_kobo, commissionKobo: body.commission_kobo, netPayoutKobo: body.net_payout_kobo, payoutDate: body.payout_date });
    return c.json({ earning }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

// AI fleet efficiency — P13: rider names, vehicles NOT passed to AI
dispatchRiderRoutes.get(
  '/:id/ai-efficiency',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new DispatchRiderRepository(c.env.DB);
    const jobs = await repo.listJobs(id, auth.tenantId);
    const data = jobs.map(j => ({ status: j.status, fee_kobo: j.feeKobo }));
    return c.json({ capability: 'FLEET_EFFICIENCY_REPORT', data, count: data.length });
  },
);
