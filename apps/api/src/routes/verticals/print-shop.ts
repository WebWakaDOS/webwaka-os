/**
 * Print Shop vertical routes — M9 Commerce P2 Batch 2
 *
 * POST   /print-shop                            — Create profile
 * GET    /print-shop/workspace/:workspaceId     — Get by workspace (T3)
 * GET    /print-shop/:id                        — Get profile (T3)
 * PATCH  /print-shop/:id                        — Update profile
 * POST   /print-shop/:id/transition             — FSM transition
 * POST   /print-shop/:id/jobs                   — Create print job (P9)
 * GET    /print-shop/:id/jobs                   — List jobs
 * PATCH  /print-shop/:id/jobs/:jobId            — Update job status
 * POST   /print-shop/:id/stock                  — Add paper stock (P9)
 * GET    /print-shop/:id/stock                  — List stock
 * GET    /print-shop/:id/ai-advisory            — AI demand planning (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  PrintShopRepository,
  guardSeedToClaimed,
  guardClaimedToCacVerified,
  isValidPrintShopTransition,
} from '@webwaka/verticals-print-shop';
import type { PrintShopFSMState, PrintJobStatus } from '@webwaka/verticals-print-shop';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const printShopRoutes = new Hono<{ Bindings: Env }>();

printShopRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; shop_name?: string; cac_number?: string; son_registered?: boolean; speciality?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.shop_name) return c.json({ error: 'workspace_id, shop_name are required' }, 400);
  const repo = new PrintShopRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, shopName: body.shop_name, cacNumber: body.cac_number, sonRegistered: body.son_registered, speciality: body.speciality as never });
  return c.json({ print_shop: profile }, 201);
});

printShopRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new PrintShopRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ print_shop: profile });
});

printShopRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new PrintShopRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Print shop profile not found' }, 404);
  return c.json({ print_shop: profile });
});

printShopRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { shop_name?: string; cac_number?: string; son_registered?: boolean; speciality?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new PrintShopRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { shopName: body.shop_name, cacNumber: body.cac_number, sonRegistered: body.son_registered, speciality: body.speciality as never });
  if (!updated) return c.json({ error: 'Print shop profile not found' }, 404);
  return c.json({ print_shop: updated });
});

printShopRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new PrintShopRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as PrintShopFSMState;
  if (!isValidPrintShopTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'cac_verified') {
    const g = guardClaimedToCacVerified({ cacNumber: profile.cacNumber ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ print_shop: updated });
});

printShopRoutes.post('/:id/jobs', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { client_phone?: string; job_type?: string; quantity?: number; size?: string; paper_type?: string; colour_mode?: string; unit_price_kobo?: number; total_kobo?: number; design_ref?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_phone || !body.job_type || body.unit_price_kobo === undefined || body.total_kobo === undefined) return c.json({ error: 'client_phone, job_type, unit_price_kobo, total_kobo are required' }, 400);
  const repo = new PrintShopRepository(c.env.DB);
  try {
    const job = await repo.createJob({ workspaceId: id, tenantId: auth.tenantId, clientPhone: body.client_phone, jobType: body.job_type as never, quantity: body.quantity, size: body.size, paperType: body.paper_type, colourMode: body.colour_mode as never, unitPriceKobo: body.unit_price_kobo, totalKobo: body.total_kobo, designRef: body.design_ref });
    return c.json({ job }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

printShopRoutes.get('/:id/jobs', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new PrintShopRepository(c.env.DB);
  const jobs = await repo.listJobs(id, auth.tenantId);
  return c.json({ jobs, count: jobs.length });
});

printShopRoutes.patch('/:id/jobs/:jobId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { jobId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new PrintShopRepository(c.env.DB);
  const updated = await repo.updateJobStatus(jobId, auth.tenantId, body.status as PrintJobStatus);
  if (!updated) return c.json({ error: 'Job not found' }, 404);
  return c.json({ job: updated });
});

printShopRoutes.post('/:id/stock', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { paper_type?: string; gsm?: number; sheet_size?: string; quantity_in_stock?: number; unit_cost_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.paper_type || body.unit_cost_kobo === undefined) return c.json({ error: 'paper_type, unit_cost_kobo are required' }, 400);
  const repo = new PrintShopRepository(c.env.DB);
  try {
    const stock = await repo.createStock({ workspaceId: id, tenantId: auth.tenantId, paperType: body.paper_type, gsm: body.gsm, sheetSize: body.sheet_size, quantityInStock: body.quantity_in_stock, unitCostKobo: body.unit_cost_kobo });
    return c.json({ stock }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

printShopRoutes.get('/:id/stock', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new PrintShopRepository(c.env.DB);
  const stock = await repo.listStock(id, auth.tenantId);
  return c.json({ stock, count: stock.length });
});

// AI advisory — aggregate job types and volumes; no client phone (P13)
printShopRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new PrintShopRepository(c.env.DB);
    const jobs = await repo.listJobs(id, auth.tenantId);
    // P13: no clientPhone in advisory payload
    const advisory = jobs.map(j => ({ job_type: j.jobType, quantity: j.quantity, total_kobo: j.totalKobo, status: j.status }));
    return c.json({ capability: 'DEMAND_PLANNING', advisory_data: advisory, count: advisory.length });
  },
);
