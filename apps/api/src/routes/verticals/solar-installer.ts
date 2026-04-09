/**
 * Solar Installer vertical routes — M9 Commerce P2 Batch 2
 *
 * POST   /solar-installer                            — Create profile
 * GET    /solar-installer/workspace/:workspaceId     — Get by workspace (T3)
 * GET    /solar-installer/:id                        — Get profile (T3)
 * PATCH  /solar-installer/:id                        — Update profile
 * POST   /solar-installer/:id/transition             — FSM transition
 * POST   /solar-installer/:id/projects               — Create project (P9)
 * GET    /solar-installer/:id/projects               — List projects
 * PATCH  /solar-installer/:id/projects/:projectId    — Update project status
 * POST   /solar-installer/:id/projects/:projectId/components  — Add component (P9)
 * GET    /solar-installer/:id/projects/:projectId/components  — List components
 * GET    /solar-installer/:id/ai-advisory            — AI energy audit (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  SolarInstallerRepository,
  guardSeedToClaimed,
  guardClaimedToNercVerified,
  isValidSolarInstallerTransition,
} from '@webwaka/verticals-solar-installer';
import type { SolarInstallerFSMState, SolarProjectStatus } from '@webwaka/verticals-solar-installer';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const solarInstallerRoutes = new Hono<{ Bindings: Env }>();

solarInstallerRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; nerc_registration?: string; nemsa_cert?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new SolarInstallerRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, nercRegistration: body.nerc_registration, nemsaCert: body.nemsa_cert, cacRc: body.cac_rc });
  return c.json({ solar_installer: profile }, 201);
});

solarInstallerRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new SolarInstallerRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ solar_installer: profile });
});

solarInstallerRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new SolarInstallerRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Solar installer profile not found' }, 404);
  return c.json({ solar_installer: profile });
});

solarInstallerRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; nerc_registration?: string; nemsa_cert?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new SolarInstallerRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, nercRegistration: body.nerc_registration, nemsaCert: body.nemsa_cert, cacRc: body.cac_rc });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ solar_installer: updated });
});

solarInstallerRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new SolarInstallerRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as SolarInstallerFSMState;
  if (!isValidSolarInstallerTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'nerc_verified') {
    const g = guardClaimedToNercVerified({ nercRegistration: profile.nercRegistration ?? null, nemsaCert: profile.nemsaCert ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ solar_installer: updated });
});

solarInstallerRoutes.post('/:id/projects', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { client_phone?: string; address?: string; system_size_watts?: number; panel_count?: number; battery_capacity_wh?: number; inverter_kva?: number; total_cost_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_phone || body.system_size_watts === undefined || body.total_cost_kobo === undefined) return c.json({ error: 'client_phone, system_size_watts, total_cost_kobo are required' }, 400);
  const repo = new SolarInstallerRepository(c.env.DB);
  try {
    const project = await repo.createProject({ workspaceId: id, tenantId: auth.tenantId, clientPhone: body.client_phone, address: body.address, systemSizeWatts: body.system_size_watts, panelCount: body.panel_count, batteryCapacityWh: body.battery_capacity_wh, inverterKva: body.inverter_kva, totalCostKobo: body.total_cost_kobo });
    return c.json({ project }, 201);
  } catch (err) {
    if (err instanceof Error && (err.message.includes('P9') || err.message.includes('integer'))) return c.json({ error: err.message }, 422);
    throw err;
  }
});

solarInstallerRoutes.get('/:id/projects', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new SolarInstallerRepository(c.env.DB);
  const projects = await repo.listProjects(id, auth.tenantId);
  return c.json({ projects, count: projects.length });
});

solarInstallerRoutes.patch('/:id/projects/:projectId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { projectId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new SolarInstallerRepository(c.env.DB);
  const updated = await repo.updateProjectStatus(projectId, auth.tenantId, body.status as SolarProjectStatus);
  if (!updated) return c.json({ error: 'Project not found' }, 404);
  return c.json({ project: updated });
});

solarInstallerRoutes.post('/:id/projects/:projectId/components', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id, projectId } = c.req.param();
  let body: { component_type?: string; brand?: string; quantity?: number; unit_cost_kobo?: number; supplier?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.component_type || body.unit_cost_kobo === undefined) return c.json({ error: 'component_type, unit_cost_kobo are required' }, 400);
  const repo = new SolarInstallerRepository(c.env.DB);
  try {
    const component = await repo.createComponent({ projectId, workspaceId: id, tenantId: auth.tenantId, componentType: body.component_type as never, brand: body.brand, quantity: body.quantity, unitCostKobo: body.unit_cost_kobo, supplier: body.supplier });
    return c.json({ component }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

solarInstallerRoutes.get('/:id/projects/:projectId/components', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { projectId } = c.req.param();
  const repo = new SolarInstallerRepository(c.env.DB);
  const components = await repo.listComponents(projectId, auth.tenantId);
  return c.json({ components, count: components.length });
});

// AI advisory — project aggregate; no client phone (P13)
solarInstallerRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new SolarInstallerRepository(c.env.DB);
    const projects = await repo.listProjects(id, auth.tenantId);
    // P13: strip clientPhone; aggregate energy/cost stats
    const advisory = projects.map(p => ({ system_size_watts: p.systemSizeWatts, total_cost_kobo: p.totalCostKobo, status: p.status, panel_count: p.panelCount }));
    return c.json({ capability: 'ENERGY_AUDIT', advisory_data: advisory, count: advisory.length });
  },
);
