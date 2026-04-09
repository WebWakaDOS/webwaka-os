/**
 * Container Depot / Logistics Hub vertical routes — M12 Transport Extended
 *
 * POST   /container-depot                         — Create profile
 * GET    /container-depot/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /container-depot/:id                     — Get profile (T3)
 * PATCH  /container-depot/:id                     — Update profile
 * POST   /container-depot/:id/transition          — FSM transition
 * POST   /container-depot/:id/containers          — Add container record (P9)
 * GET    /container-depot/:id/containers          — List containers (T3)
 * PATCH  /container-depot/:id/containers/:cid     — Update container status
 * GET    /container-depot/:id/ai-efficiency       — AI fleet efficiency (P13)
 *
 * Platform Invariants: T3, P9, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  ContainerDepotRepository,
  guardSeedToClaimed,
  guardClaimedToNcsVerified,
  isValidContainerDepotTransition,
} from '@webwaka/verticals-container-depot';
import type { ContainerDepotFSMState, ContainerStatus, ContainerType, OperationType } from '@webwaka/verticals-container-depot';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const containerDepotRoutes = new Hono<{ Bindings: Env }>();

containerDepotRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; ncs_licence?: string; npa_licence?: string; cac_rc?: string; depot_location?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new ContainerDepotRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, ncsLicence: body.ncs_licence, npaLicence: body.npa_licence, cacRc: body.cac_rc, depotLocation: body.depot_location });
  return c.json({ container_depot: profile }, 201);
});

containerDepotRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new ContainerDepotRepository(c.env.DB);
  return c.json({ container_depot: await repo.findProfileByWorkspace(workspaceId, auth.tenantId) });
});

containerDepotRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new ContainerDepotRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Container depot profile not found' }, 404);
  return c.json({ container_depot: profile });
});

containerDepotRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; ncs_licence?: string; npa_licence?: string; cac_rc?: string; depot_location?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new ContainerDepotRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, ncsLicence: body.ncs_licence, npaLicence: body.npa_licence, cacRc: body.cac_rc, depotLocation: body.depot_location });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ container_depot: updated });
});

containerDepotRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new ContainerDepotRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const to = body.to_status as ContainerDepotFSMState;
  if (!isValidContainerDepotTransition(profile.status, to)) return c.json({ error: `Invalid transition: ${profile.status} → ${to}` }, 422);
  const kycTier = auth.kycTier ?? 0;
  if (profile.status === 'seeded' && to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (profile.status === 'claimed' && to === 'ncs_verified') {
    const g = guardClaimedToNcsVerified({ ncsLicence: profile.ncsLicence, npaLicence: profile.npaLicence, kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionStatus(id, auth.tenantId, to);
  return c.json({ container_depot: updated });
});

containerDepotRoutes.post('/:id/containers', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { container_number?: string; container_type?: string; weight_kg?: number; client_phone?: string; operation_type?: string; daily_storage_rate_kobo?: number; days_in_depot?: number; ncs_release_number?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.container_number || body.weight_kg === undefined || body.daily_storage_rate_kobo === undefined) return c.json({ error: 'container_number, weight_kg, daily_storage_rate_kobo are required' }, 400);
  const repo = new ContainerDepotRepository(c.env.DB);
  try {
    const container = await repo.createContainerRecord({ profileId: id, tenantId: auth.tenantId, containerNumber: body.container_number, containerType: body.container_type as ContainerType, weightKg: body.weight_kg, clientPhone: body.client_phone, operationType: body.operation_type as OperationType, dailyStorageRateKobo: body.daily_storage_rate_kobo, daysInDepot: body.days_in_depot, ncsReleaseNumber: body.ncs_release_number });
    return c.json({ container }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

containerDepotRoutes.get('/:id/containers', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new ContainerDepotRepository(c.env.DB);
  const containers = await repo.listContainerRecords(id, auth.tenantId);
  return c.json({ containers, count: containers.length });
});

containerDepotRoutes.patch('/:id/containers/:cid', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { cid } = c.req.param();
  let body: { status?: string; ncs_release_number?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new ContainerDepotRepository(c.env.DB);
  const updated = await repo.updateContainerStatus(cid, auth.tenantId, body.status as ContainerStatus, body.ncs_release_number);
  if (!updated) return c.json({ error: 'Container record not found' }, 404);
  return c.json({ container: updated });
});

// AI fleet efficiency — P13: container_number, client_phone NOT passed to AI
containerDepotRoutes.get(
  '/:id/ai-efficiency',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new ContainerDepotRepository(c.env.DB);
    const containers = await repo.listContainerRecords(id, auth.tenantId);
    const data = containers.map(c => ({ container_type: c.containerType, operation_type: c.operationType, days_in_depot: c.daysInDepot, storage_charge_kobo: c.storageChargeKobo, status: c.status }));
    return c.json({ capability: 'FLEET_EFFICIENCY_REPORT', data, count: data.length });
  },
);
