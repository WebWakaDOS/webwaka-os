/**
 * Construction vertical routes — M9 Commerce P2 Batch 2
 *
 * POST   /construction                             — Create profile
 * GET    /construction/workspace/:workspaceId      — Get by workspace (T3)
 * GET    /construction/:id                         — Get profile (T3)
 * PATCH  /construction/:id                         — Update profile
 * POST   /construction/:id/transition              — FSM transition
 * POST   /construction/:id/projects                — Create project (P9)
 * GET    /construction/:id/projects                — List projects (T3)
 * PATCH  /construction/:id/projects/:projectId     — Update project status
 * POST   /construction/:id/projects/:projectId/milestones   — Create milestone (P9)
 * GET    /construction/:id/projects/:projectId/milestones   — List milestones
 * POST   /construction/:id/projects/:projectId/materials    — Create material (P9)
 * GET    /construction/:id/projects/:projectId/materials    — List materials
 * GET    /construction/:id/ai-advisory             — AI advisory (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  ConstructionRepository,
  guardSeedToClaimed,
  guardClaimedToCorenVerified,
  isValidConstructionTransition,
} from '@webwaka/verticals-construction';
import type { ConstructionFSMState } from '@webwaka/verticals-construction';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const constructionRoutes = new Hono<{ Bindings: Env }>();

constructionRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; coren_number?: string; corbon_number?: string; bpp_registration?: string; bpp_category?: string; cac_number?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new ConstructionRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, corenNumber: body.coren_number, corbonNumber: body.corbon_number, bppRegistration: body.bpp_registration, bppCategory: body.bpp_category as never, cacNumber: body.cac_number });
  return c.json({ construction: profile }, 201);
});

constructionRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new ConstructionRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ construction: profile });
});

constructionRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new ConstructionRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Construction profile not found' }, 404);
  return c.json({ construction: profile });
});

constructionRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; coren_number?: string; corbon_number?: string; bpp_registration?: string; bpp_category?: string; cac_number?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new ConstructionRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, corenNumber: body.coren_number, corbonNumber: body.corbon_number, bppRegistration: body.bpp_registration, bppCategory: body.bpp_category as never, cacNumber: body.cac_number });
  if (!updated) return c.json({ error: 'Construction profile not found' }, 404);
  return c.json({ construction: updated });
});

constructionRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new ConstructionRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as ConstructionFSMState;
  if (!isValidConstructionTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'coren_verified') {
    const g = guardClaimedToCorenVerified({ corenNumber: profile.corenNumber ?? null, corbonNumber: profile.corbonNumber ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ construction: updated });
});

constructionRoutes.post('/:id/projects', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { project_name?: string; client_name?: string; client_phone?: string; location?: string; contract_value_kobo?: number; start_date?: number; expected_end_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.project_name || !body.client_name || !body.client_phone || !body.location || body.contract_value_kobo === undefined) return c.json({ error: 'project_name, client_name, client_phone, location, contract_value_kobo are required' }, 400);
  const repo = new ConstructionRepository(c.env.DB);
  try {
    const project = await repo.createProject({ workspaceId: id, tenantId: auth.tenantId, projectName: body.project_name, clientName: body.client_name, clientPhone: body.client_phone, location: body.location, contractValueKobo: body.contract_value_kobo, startDate: body.start_date, expectedEndDate: body.expected_end_date });
    return c.json({ project }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

constructionRoutes.get('/:id/projects', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new ConstructionRepository(c.env.DB);
  const projects = await repo.listProjects(id, auth.tenantId);
  return c.json({ projects, count: projects.length });
});

constructionRoutes.patch('/:id/projects/:projectId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { projectId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new ConstructionRepository(c.env.DB);
  const updated = await repo.updateProjectStatus(projectId, auth.tenantId, body.status as never);
  if (!updated) return c.json({ error: 'Project not found' }, 404);
  return c.json({ project: updated });
});

constructionRoutes.post('/:id/projects/:projectId/milestones', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id, projectId } = c.req.param();
  let body: { milestone_name?: string; amount_kobo?: number; due_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.milestone_name || body.amount_kobo === undefined) return c.json({ error: 'milestone_name, amount_kobo are required' }, 400);
  const repo = new ConstructionRepository(c.env.DB);
  try {
    const milestone = await repo.createMilestone({ projectId, workspaceId: id, tenantId: auth.tenantId, milestoneName: body.milestone_name, amountKobo: body.amount_kobo, dueDate: body.due_date });
    return c.json({ milestone }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

constructionRoutes.get('/:id/projects/:projectId/milestones', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { projectId } = c.req.param();
  const repo = new ConstructionRepository(c.env.DB);
  const milestones = await repo.listMilestones(projectId, auth.tenantId);
  return c.json({ milestones, count: milestones.length });
});

constructionRoutes.post('/:id/projects/:projectId/materials', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id, projectId } = c.req.param();
  let body: { material_name?: string; quantity?: number; unit_cost_kobo?: number; supplier?: string; procurement_date?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.material_name || body.unit_cost_kobo === undefined) return c.json({ error: 'material_name, unit_cost_kobo are required' }, 400);
  const repo = new ConstructionRepository(c.env.DB);
  try {
    const material = await repo.createMaterial({ projectId, workspaceId: id, tenantId: auth.tenantId, materialName: body.material_name, quantity: body.quantity, unitCostKobo: body.unit_cost_kobo, supplier: body.supplier, procurementDate: body.procurement_date });
    return c.json({ material }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

constructionRoutes.get('/:id/projects/:projectId/materials', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { projectId } = c.req.param();
  const repo = new ConstructionRepository(c.env.DB);
  const materials = await repo.listMaterials(projectId, auth.tenantId);
  return c.json({ materials, count: materials.length });
});

// AI advisory — aggregate project stats only; no client PII (P13)
constructionRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new ConstructionRepository(c.env.DB);
    const projects = await repo.listProjects(id, auth.tenantId);
    // P13: strip client PII — only expose aggregate/financial stats
    const advisory = projects.map(p => ({ status: p.status, contract_value_kobo: p.contractValueKobo, location: p.location }));
    return c.json({ capability: 'PROJECT_COST_ESTIMATION', advisory_data: advisory, count: advisory.length });
  },
);
