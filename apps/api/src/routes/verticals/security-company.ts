/**
 * Security Company vertical routes — M9 Commerce P2 Batch 2
 *
 * POST   /security-company                          — Create profile
 * GET    /security-company/workspace/:workspaceId   — Get by workspace (T3)
 * GET    /security-company/:id                      — Get profile (T3)
 * PATCH  /security-company/:id                      — Update profile
 * POST   /security-company/:id/transition           — FSM transition
 * POST   /security-company/:id/guards               — Add guard (P9)
 * GET    /security-company/:id/guards               — List guards
 * PATCH  /security-company/:id/guards/:guardId      — Update guard status
 * POST   /security-company/:id/sites                — Create site (P9)
 * GET    /security-company/:id/sites                — List sites
 * POST   /security-company/:id/sites/:siteId/incidents  — Log incident
 * GET    /security-company/:id/sites/:siteId/incidents  — List incidents
 * GET    /security-company/:id/ai-advisory          — AI advisory (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 * P13: Guard names, ID numbers — NEVER passed to AI advisory
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  SecurityCompanyRepository,
  guardSeedToClaimed,
  guardClaimedToPscVerified,
  isValidSecurityCompanyTransition,
} from '@webwaka/verticals-security-company';
import type { SecurityCompanyFSMState, GuardStatus } from '@webwaka/verticals-security-company';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const securityCompanyRoutes = new Hono<{ Bindings: Env }>();

securityCompanyRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; psc_licence?: string; pscai_number?: string; cac_rc?: string; guard_count?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new SecurityCompanyRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, pscLicence: body.psc_licence, pscaiNumber: body.pscai_number, cacRc: body.cac_rc, guardCount: body.guard_count });
  return c.json({ security_company: profile }, 201);
});

securityCompanyRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new SecurityCompanyRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ security_company: profile });
});

securityCompanyRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new SecurityCompanyRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Security company profile not found' }, 404);
  return c.json({ security_company: profile });
});

securityCompanyRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; psc_licence?: string; pscai_number?: string; cac_rc?: string; guard_count?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new SecurityCompanyRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, pscLicence: body.psc_licence, pscaiNumber: body.pscai_number, cacRc: body.cac_rc, guardCount: body.guard_count });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ security_company: updated });
});

securityCompanyRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new SecurityCompanyRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as SecurityCompanyFSMState;
  if (!isValidSecurityCompanyTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'psc_verified') {
    const g = guardClaimedToPscVerified({ pscLicence: profile.pscLicence ?? null, pscaiNumber: profile.pscaiNumber ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ security_company: updated });
});

securityCompanyRoutes.post('/:id/guards', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { guard_name?: string; id_number?: string; training_cert?: string; deployment_site_id?: string; monthly_salary_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.guard_name || body.monthly_salary_kobo === undefined) return c.json({ error: 'guard_name, monthly_salary_kobo are required' }, 400);
  const repo = new SecurityCompanyRepository(c.env.DB);
  try {
    const guard = await repo.createGuard({ workspaceId: id, tenantId: auth.tenantId, guardName: body.guard_name, idNumber: body.id_number, trainingCert: body.training_cert, deploymentSiteId: body.deployment_site_id, monthlySalaryKobo: body.monthly_salary_kobo });
    // P13: return guard but omit idNumber from response if desired
    return c.json({ guard }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

securityCompanyRoutes.get('/:id/guards', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new SecurityCompanyRepository(c.env.DB);
  const guards = await repo.listGuards(id, auth.tenantId);
  return c.json({ guards, count: guards.length });
});

securityCompanyRoutes.patch('/:id/guards/:guardId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { guardId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new SecurityCompanyRepository(c.env.DB);
  const updated = await repo.updateGuardStatus(guardId, auth.tenantId, body.status as GuardStatus);
  if (!updated) return c.json({ error: 'Guard not found' }, 404);
  return c.json({ guard: updated });
});

securityCompanyRoutes.post('/:id/sites', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { site_name?: string; client_phone?: string; address?: string; state?: string; guard_count_required?: number; monthly_fee_kobo?: number; contract_start?: number; contract_end?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.site_name || body.monthly_fee_kobo === undefined) return c.json({ error: 'site_name, monthly_fee_kobo are required' }, 400);
  const repo = new SecurityCompanyRepository(c.env.DB);
  try {
    const site = await repo.createSite({ workspaceId: id, tenantId: auth.tenantId, siteName: body.site_name, clientPhone: body.client_phone, address: body.address, state: body.state, guardCountRequired: body.guard_count_required, monthlyFeeKobo: body.monthly_fee_kobo, contractStart: body.contract_start, contractEnd: body.contract_end });
    return c.json({ site }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

securityCompanyRoutes.get('/:id/sites', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new SecurityCompanyRepository(c.env.DB);
  const sites = await repo.listSites(id, auth.tenantId);
  return c.json({ sites, count: sites.length });
});

securityCompanyRoutes.post('/:id/sites/:siteId/incidents', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id, siteId } = c.req.param();
  let body: { report_date?: number; incident_type?: string; description?: string; guard_id?: string; action_taken?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.incident_type) return c.json({ error: 'incident_type is required' }, 400);
  const repo = new SecurityCompanyRepository(c.env.DB);
  const incident = await repo.createIncident({ siteId, workspaceId: id, tenantId: auth.tenantId, reportDate: body.report_date ?? Math.floor(Date.now() / 1000), incidentType: body.incident_type, description: body.description, guardId: body.guard_id, actionTaken: body.action_taken });
  return c.json({ incident }, 201);
});

securityCompanyRoutes.get('/:id/sites/:siteId/incidents', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { siteId } = c.req.param();
  const repo = new SecurityCompanyRepository(c.env.DB);
  const incidents = await repo.listIncidents(siteId, auth.tenantId);
  return c.json({ incidents, count: incidents.length });
});

// AI advisory — site aggregate stats ONLY; NEVER guard names/ID numbers (P13)
securityCompanyRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new SecurityCompanyRepository(c.env.DB);
    const sites = await repo.listSites(id, auth.tenantId);
    // P13: no guard names, no ID numbers, no client phones
    const advisory = sites.map(s => ({ site_name: s.siteName, guard_count_required: s.guardCountRequired, monthly_fee_kobo: s.monthlyFeeKobo, state: s.state }));
    return c.json({ capability: 'SALES_FORECAST', advisory_data: advisory, count: advisory.length });
  },
);
