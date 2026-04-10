/**
 * Cleaning Service vertical routes — M9 Commerce P2 A6
 *
 * POST   /cleaning-service                              — Create profile
 * GET    /cleaning-service/workspace/:workspaceId       — List (T3)
 * GET    /cleaning-service/:id                          — Get profile
 * PATCH  /cleaning-service/:id                          — Update
 * POST   /cleaning-service/:id/transition               — FSM transition
 * POST   /cleaning-service/:id/jobs                     — Create job (P9)
 * GET    /cleaning-service/:id/jobs                     — List jobs
 * POST   /cleaning-service/:id/supplies                 — Add supply (P9)
 * GET    /cleaning-service/:id/supplies                 — List supplies
 * GET    /cleaning-service/:id/ai-advisory              — AI demand forecast (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { CleaningServiceRepository, guardSeedToClaimed, guardClaimedToCacVerified, isValidCleaningTransition } from '@webwaka/verticals-cleaning-service';
import type { CleaningServiceFSMState, CleaningJobStatus, JobType, JobFrequency } from '@webwaka/verticals-cleaning-service';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const cleaningServiceRoutes = new Hono<{ Bindings: Env }>();

cleaningServiceRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; cac_number?: string; env_agency_permit?: string; service_types?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new CleaningServiceRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, cacNumber: body.cac_number, envAgencyPermit: body.env_agency_permit, serviceTypes: body.service_types });
  return c.json({ cleaning_service: profile }, 201);
});

cleaningServiceRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new CleaningServiceRepository(c.env.DB);
  const profile = await repo.findProfileById(workspaceId, auth.tenantId);
  return c.json({ cleaning_service: profile });
});

cleaningServiceRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new CleaningServiceRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Cleaning service profile not found' }, 404);
  return c.json({ cleaning_service: profile });
});

cleaningServiceRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; cac_number?: string; env_agency_permit?: string; service_types?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new CleaningServiceRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, cacNumber: body.cac_number, envAgencyPermit: body.env_agency_permit, serviceTypes: body.service_types });
  if (!updated) return c.json({ error: 'Cleaning service profile not found' }, 404);
  return c.json({ cleaning_service: updated });
});

cleaningServiceRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new CleaningServiceRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as CleaningServiceFSMState;
  if (!isValidCleaningTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'cac_verified') {
    const g = guardClaimedToCacVerified({ cacNumber: profile.cacNumber });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ cleaning_service: updated });
});

cleaningServiceRoutes.post('/:id/jobs', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { client_phone?: string; address?: string; job_type?: string; price_kobo?: number; frequency?: string; scheduled_at?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_phone || !body.address || !body.job_type || body.price_kobo === undefined) {
    return c.json({ error: 'client_phone, address, job_type, price_kobo are required' }, 400);
  }
  const repo = new CleaningServiceRepository(c.env.DB);
  try {
    const job = await repo.createJob({ workspaceId: id, tenantId: auth.tenantId, clientPhone: body.client_phone, address: body.address, jobType: body.job_type as JobType, priceKobo: body.price_kobo, frequency: body.frequency as JobFrequency | undefined, scheduledAt: body.scheduled_at });
    return c.json({ job }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('[P9]')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

cleaningServiceRoutes.get('/:id/jobs', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const status = c.req.query('status') as CleaningJobStatus | undefined;
  const repo = new CleaningServiceRepository(c.env.DB);
  const jobs = await repo.listJobs(id, auth.tenantId, status);
  return c.json({ jobs, count: jobs.length });
});

cleaningServiceRoutes.post('/:id/supplies', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { supply_name?: string; unit?: string; quantity_in_stock?: number; unit_cost_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.supply_name || !body.unit || body.quantity_in_stock === undefined || body.unit_cost_kobo === undefined) {
    return c.json({ error: 'supply_name, unit, quantity_in_stock, unit_cost_kobo are required' }, 400);
  }
  const repo = new CleaningServiceRepository(c.env.DB);
  try {
    const supply = await repo.createSupply({ workspaceId: id, tenantId: auth.tenantId, supplyName: body.supply_name, unit: body.unit, quantityInStockX1000: body.quantity_in_stock, unitCostKobo: body.unit_cost_kobo });
    return c.json({ supply }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('[P9]')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

cleaningServiceRoutes.get('/:id/supplies', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new CleaningServiceRepository(c.env.DB);
  const supplies = await repo.listSupplies(id, auth.tenantId);
  return c.json({ supplies, count: supplies.length });
});

// P10/P12/P13 gated AI advisory — aggregate job stats, no client PII
cleaningServiceRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new CleaningServiceRepository(c.env.DB);
    const jobs = await repo.listJobs(id, auth.tenantId);
    // P13: job_type aggregate only — no clientPhone or address
    const byType = jobs.reduce<Record<string, number>>((acc, j) => { acc[j.jobType] = (acc[j.jobType] ?? 0) + 1; return acc; }, {});
    return c.json({ capability: 'DEMAND_PLANNING', advisory_data: byType });
  },
);
