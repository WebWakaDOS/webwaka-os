/**
 * Clearing & Forwarding Agent vertical routes — M9 Transport Extended
 *
 * POST   /clearing-agent                         — Create profile
 * GET    /clearing-agent/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /clearing-agent/:id                     — Get profile (T3)
 * PATCH  /clearing-agent/:id                     — Update profile
 * POST   /clearing-agent/:id/transition          — FSM transition
 * POST   /clearing-agent/:id/shipments           — Create shipment (P9)
 * GET    /clearing-agent/:id/shipments           — List shipments (T3)
 * PATCH  /clearing-agent/:id/shipments/:sid      — Update shipment status
 * GET    /clearing-agent/:id/ai-efficiency       — AI fleet efficiency (P13: no PII)
 *
 * Platform Invariants: T3, P9, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  ClearingAgentRepository,
  guardSeedToClaimed,
  guardClaimedToNcsVerified,
  isValidClearingAgentTransition,
} from '@webwaka/verticals-clearing-agent';
import type { ClearingAgentFSMState } from '@webwaka/verticals-clearing-agent';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const clearingAgentRoutes = new Hono<{ Bindings: Env }>();

clearingAgentRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; ncs_licence?: string; nagaff_number?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new ClearingAgentRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, ncsLicence: body.ncs_licence, nagaffNumber: body.nagaff_number, cacRc: body.cac_rc });
  return c.json({ clearing_agent: profile }, 201);
});

clearingAgentRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new ClearingAgentRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ clearing_agent: profile });
});

clearingAgentRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new ClearingAgentRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Clearing agent profile not found' }, 404);
  return c.json({ clearing_agent: profile });
});

clearingAgentRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; ncs_licence?: string; nagaff_number?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new ClearingAgentRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, ncsLicence: body.ncs_licence, nagaffNumber: body.nagaff_number, cacRc: body.cac_rc });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ clearing_agent: updated });
});

clearingAgentRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new ClearingAgentRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const to = body.to_status as ClearingAgentFSMState;
  if (!isValidClearingAgentTransition(profile.status, to)) return c.json({ error: `Invalid transition: ${profile.status} → ${to}` }, 422);
  const kycTier = auth.kycTier ?? 0;
  if (profile.status === 'seeded' && to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (profile.status === 'claimed' && to === 'ncs_verified') {
    const g = guardClaimedToNcsVerified({ ncsLicence: profile.ncsLicence, nagaffNumber: profile.nagaffNumber, kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionStatus(id, auth.tenantId, to);
  return c.json({ clearing_agent: updated });
});

clearingAgentRoutes.post('/:id/shipments', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { declared_value_kobo?: number; duty_amount_kobo?: number; professional_fee_kobo?: number; vat_kobo?: number; port_charges_kobo?: number; vessel_name?: string; bill_of_lading?: string; container_number?: string; cargo_description?: string; form_m_number?: string; nafdac_permit_ref?: string; port?: string; client_phone?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (body.declared_value_kobo === undefined || body.duty_amount_kobo === undefined || body.professional_fee_kobo === undefined) return c.json({ error: 'declared_value_kobo, duty_amount_kobo, professional_fee_kobo are required' }, 400);
  const repo = new ClearingAgentRepository(c.env.DB);
  try {
    const shipment = await repo.createShipment({ profileId: id, tenantId: auth.tenantId, declaredValueKobo: body.declared_value_kobo, dutyAmountKobo: body.duty_amount_kobo, professionalFeeKobo: body.professional_fee_kobo, vatKobo: body.vat_kobo, portChargesKobo: body.port_charges_kobo, vesselName: body.vessel_name, billOfLading: body.bill_of_lading, containerNumber: body.container_number, cargoDescription: body.cargo_description, formMNumber: body.form_m_number, nafdacPermitRef: body.nafdac_permit_ref, port: body.port as ClearingShipmentPort, clientPhone: body.client_phone });
    return c.json({ shipment }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

clearingAgentRoutes.get('/:id/shipments', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new ClearingAgentRepository(c.env.DB);
  const shipments = await repo.listShipments(id, auth.tenantId);
  return c.json({ shipments, count: shipments.length });
});

clearingAgentRoutes.patch('/:id/shipments/:sid', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { sid } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new ClearingAgentRepository(c.env.DB);
  const updated = await repo.updateShipmentStatus(sid, auth.tenantId, body.status as import('@webwaka/verticals-clearing-agent').ShipmentStatus);
  if (!updated) return c.json({ error: 'Shipment not found' }, 404);
  return c.json({ shipment: updated });
});

// AI fleet efficiency — P13: no client PII, no bill_of_lading, no container numbers
clearingAgentRoutes.get(
  '/:id/ai-efficiency',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new ClearingAgentRepository(c.env.DB);
    const shipments = await repo.listShipments(id, auth.tenantId);
    const data = shipments.map(s => ({ port: s.port, status: s.status, duty_kobo: s.dutyAmountKobo, professional_fee_kobo: s.professionalFeeKobo }));
    return c.json({ capability: 'FLEET_EFFICIENCY_REPORT', data, count: data.length });
  },
);

type ClearingShipmentPort = import('@webwaka/verticals-clearing-agent').ShipmentPort;
