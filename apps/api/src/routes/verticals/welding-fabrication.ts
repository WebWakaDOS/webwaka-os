/**
 * Welding / Fabrication Shop vertical routes — M10 Commerce P2 Batch 2
 *
 * POST   /welding-fabrication                         — Create profile
 * GET    /welding-fabrication/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /welding-fabrication/:id                     — Get profile (T3)
 * PATCH  /welding-fabrication/:id                     — Update profile
 * POST   /welding-fabrication/:id/transition          — FSM transition (3-state)
 * POST   /welding-fabrication/:id/jobs                — Create job (P9)
 * GET    /welding-fabrication/:id/jobs                — List jobs
 * PATCH  /welding-fabrication/:id/jobs/:jobId         — Update job status
 * POST   /welding-fabrication/:id/materials           — Add material (P9)
 * GET    /welding-fabrication/:id/materials           — List materials
 * GET    /welding-fabrication/:id/ai-advisory         — AI demand planning (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  WeldingFabricationRepository,
  guardSeedToClaimed,
  isValidWeldingTransition,
} from '@webwaka/verticals-welding-fabrication';
import type { WeldingFSMState, WeldingJobStatus } from '@webwaka/verticals-welding-fabrication';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const weldingFabricationRoutes = new Hono<{ Bindings: Env }>();

weldingFabricationRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; shop_name?: string; speciality?: string; cac_or_trade_number?: string; state?: string; lga?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.shop_name) return c.json({ error: 'workspace_id, shop_name are required' }, 400);
  const repo = new WeldingFabricationRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, shopName: body.shop_name, speciality: body.speciality as never, cacOrTradeNumber: body.cac_or_trade_number, state: body.state, lga: body.lga });
  return c.json({ welding_fabrication: profile }, 201);
});

weldingFabricationRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new WeldingFabricationRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ welding_fabrication: profile });
});

weldingFabricationRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new WeldingFabricationRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Welding fabrication profile not found' }, 404);
  return c.json({ welding_fabrication: profile });
});

weldingFabricationRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { shop_name?: string; speciality?: string; cac_or_trade_number?: string; state?: string; lga?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new WeldingFabricationRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { shopName: body.shop_name, speciality: body.speciality as never, cacOrTradeNumber: body.cac_or_trade_number, state: body.state, lga: body.lga });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ welding_fabrication: updated });
});

weldingFabricationRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new WeldingFabricationRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as WeldingFSMState;
  if (!isValidWeldingTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ welding_fabrication: updated });
});

weldingFabricationRoutes.post('/:id/jobs', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { client_phone?: string; description?: string; material_cost_kobo?: number; labour_cost_kobo?: number; total_kobo?: number; delivery_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_phone || !body.description || body.material_cost_kobo === undefined || body.labour_cost_kobo === undefined || body.total_kobo === undefined) return c.json({ error: 'client_phone, description, material_cost_kobo, labour_cost_kobo, total_kobo are required' }, 400);
  const repo = new WeldingFabricationRepository(c.env.DB);
  try {
    const job = await repo.createJob({ workspaceId: id, tenantId: auth.tenantId, clientPhone: body.client_phone, description: body.description, materialCostKobo: body.material_cost_kobo, labourCostKobo: body.labour_cost_kobo, totalKobo: body.total_kobo, deliveryDate: body.delivery_date });
    return c.json({ job }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

weldingFabricationRoutes.get('/:id/jobs', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new WeldingFabricationRepository(c.env.DB);
  const jobs = await repo.listJobs(id, auth.tenantId);
  return c.json({ jobs, count: jobs.length });
});

weldingFabricationRoutes.patch('/:id/jobs/:jobId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { jobId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new WeldingFabricationRepository(c.env.DB);
  const updated = await repo.updateJobStatus(jobId, auth.tenantId, body.status as WeldingJobStatus);
  if (!updated) return c.json({ error: 'Job not found' }, 404);
  return c.json({ job: updated });
});

weldingFabricationRoutes.post('/:id/materials', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { material_name?: string; unit?: string; quantity_in_stock?: number; unit_cost_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.material_name || !body.unit || body.unit_cost_kobo === undefined) return c.json({ error: 'material_name, unit, unit_cost_kobo are required' }, 400);
  const repo = new WeldingFabricationRepository(c.env.DB);
  try {
    const material = await repo.createMaterial({ workspaceId: id, tenantId: auth.tenantId, materialName: body.material_name, unit: body.unit as never, quantityInStock: body.quantity_in_stock, unitCostKobo: body.unit_cost_kobo });
    return c.json({ material }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

weldingFabricationRoutes.get('/:id/materials', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new WeldingFabricationRepository(c.env.DB);
  const materials = await repo.listMaterials(id, auth.tenantId);
  return c.json({ materials, count: materials.length });
});

// AI advisory — job aggregate; no client phone (P13)
weldingFabricationRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new WeldingFabricationRepository(c.env.DB);
    const jobs = await repo.listJobs(id, auth.tenantId);
    // P13: no client phone in advisory payload
    const advisory = jobs.map(j => ({ status: j.status, material_cost_kobo: j.materialCostKobo, labour_cost_kobo: j.labourCostKobo, total_kobo: j.totalKobo }));
    return c.json({ capability: 'SALES_FORECAST', advisory_data: advisory, count: advisory.length });
  },
);
