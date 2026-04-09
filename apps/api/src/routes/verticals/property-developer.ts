/**
 * Property Developer vertical routes — M9 Commerce P2 Batch 2
 *
 * POST   /property-developer                         — Create profile
 * GET    /property-developer/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /property-developer/:id                     — Get profile (T3)
 * PATCH  /property-developer/:id                     — Update profile
 * POST   /property-developer/:id/transition          — FSM transition
 * POST   /property-developer/:id/estates             — Create estate
 * GET    /property-developer/:id/estates             — List estates
 * POST   /property-developer/:id/estates/:estateId/units   — Create unit (P9)
 * GET    /property-developer/:id/estates/:estateId/units   — List units
 * PATCH  /property-developer/:id/units/:unitId/status      — Update unit status
 * POST   /property-developer/:id/allocations               — Create allocation (P9)
 * GET    /property-developer/:id/allocations               — List allocations
 * GET    /property-developer/:id/ai-advisory               — AI valuation assist (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 * P13: Buyer PII (phone, name) NEVER passed to AI advisory
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  PropertyDeveloperRepository,
  guardSeedToClaimed,
  guardClaimedToSurconVerified,
  guardPropertyOperation,
  isValidPropertyDeveloperTransition,
} from '@webwaka/verticals-property-developer';
import type { PropertyDeveloperFSMState } from '@webwaka/verticals-property-developer';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const propertyDeveloperRoutes = new Hono<{ Bindings: Env }>();

propertyDeveloperRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; company_name?: string; surcon_number?: string; toprec_number?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.company_name) return c.json({ error: 'workspace_id, company_name are required' }, 400);
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, companyName: body.company_name, surconNumber: body.surcon_number, toprecNumber: body.toprec_number, cacRc: body.cac_rc });
  return c.json({ property_developer: profile }, 201);
});

propertyDeveloperRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ property_developer: profile });
});

propertyDeveloperRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Property developer profile not found' }, 404);
  return c.json({ property_developer: profile });
});

propertyDeveloperRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { company_name?: string; surcon_number?: string; toprec_number?: string; cac_rc?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { companyName: body.company_name, surconNumber: body.surcon_number, toprecNumber: body.toprec_number, cacRc: body.cac_rc });
  if (!updated) return c.json({ error: 'Property developer profile not found' }, 404);
  return c.json({ property_developer: updated });
});

propertyDeveloperRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as PropertyDeveloperFSMState;
  if (!isValidPropertyDeveloperTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'surcon_verified') {
    const g = guardClaimedToSurconVerified({ surconNumber: profile.surconNumber ?? null, toprecNumber: profile.toprecNumber ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ property_developer: updated });
});

propertyDeveloperRoutes.post('/:id/estates', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { estate_name?: string; location?: string; state?: string; lga?: string; land_title_type?: string; permit_number?: string; total_units?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.estate_name) return c.json({ error: 'estate_name is required' }, 400);
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const estate = await repo.createEstate({ workspaceId: id, tenantId: auth.tenantId, estateName: body.estate_name, location: body.location, state: body.state, lga: body.lga, landTitleType: body.land_title_type as never, permitNumber: body.permit_number, totalUnits: body.total_units });
  return c.json({ estate }, 201);
});

propertyDeveloperRoutes.get('/:id/estates', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const estates = await repo.listEstates(id, auth.tenantId);
  return c.json({ estates, count: estates.length });
});

propertyDeveloperRoutes.post('/:id/estates/:estateId/units', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id, estateId } = c.req.param();
  const guard = guardPropertyOperation({ kycTier: auth.kycTier ?? 0 });
  if (!guard.allowed) return c.json({ error: guard.reason }, 403);
  let body: { unit_type?: string; unit_number?: string; floor_area_sqm?: number; price_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.unit_type || !body.unit_number || body.floor_area_sqm === undefined || body.price_kobo === undefined) return c.json({ error: 'unit_type, unit_number, floor_area_sqm, price_kobo are required' }, 400);
  const repo = new PropertyDeveloperRepository(c.env.DB);
  try {
    const unit = await repo.createUnit({ estateId, workspaceId: id, tenantId: auth.tenantId, unitType: body.unit_type as never, unitNumber: body.unit_number, floorAreaSqm: body.floor_area_sqm, priceKobo: body.price_kobo });
    return c.json({ unit }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

propertyDeveloperRoutes.get('/:id/estates/:estateId/units', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { estateId } = c.req.param();
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const units = await repo.listUnits(estateId, auth.tenantId);
  return c.json({ units, count: units.length });
});

propertyDeveloperRoutes.patch('/:id/units/:unitId/status', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { unitId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const updated = await repo.updateUnitStatus(unitId, auth.tenantId, body.status as never);
  if (!updated) return c.json({ error: 'Unit not found' }, 404);
  return c.json({ unit: updated });
});

propertyDeveloperRoutes.post('/:id/allocations', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  const guard = guardPropertyOperation({ kycTier: auth.kycTier ?? 0 });
  if (!guard.allowed) return c.json({ error: guard.reason }, 403);
  let body: { unit_id?: string; buyer_phone?: string; buyer_name?: string; total_price_kobo?: number; deposit_kobo?: number; instalment_plan?: unknown[] };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.unit_id || !body.buyer_phone || !body.buyer_name || body.total_price_kobo === undefined || body.deposit_kobo === undefined) return c.json({ error: 'unit_id, buyer_phone, buyer_name, total_price_kobo, deposit_kobo are required' }, 400);
  const repo = new PropertyDeveloperRepository(c.env.DB);
  try {
    const allocation = await repo.createAllocation({ unitId: body.unit_id, workspaceId: id, tenantId: auth.tenantId, buyerPhone: body.buyer_phone, buyerName: body.buyer_name, totalPriceKobo: body.total_price_kobo, depositKobo: body.deposit_kobo, instalmentPlan: body.instalment_plan as never });
    return c.json({ allocation }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

propertyDeveloperRoutes.get('/:id/allocations', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new PropertyDeveloperRepository(c.env.DB);
  const allocations = await repo.listAllocations(id, auth.tenantId);
  // P13: strip buyer PII from listing response
  const safe = allocations.map(a => ({ id: a.id, unitId: a.unitId, totalPriceKobo: a.totalPriceKobo, depositKobo: a.depositKobo, status: a.status }));
  return c.json({ allocations: safe, count: safe.length });
});

// AI advisory — aggregate unit stats only; NEVER buyer PII (P13)
propertyDeveloperRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new PropertyDeveloperRepository(c.env.DB);
    const estates = await repo.listEstates(id, auth.tenantId);
    // P13: no buyer PII; only estate/unit aggregate stats
    const advisory = estates.map(e => ({ estate_name: e.estateName, total_units: e.totalUnits, status: e.status, state: e.state }));
    return c.json({ capability: 'PROPERTY_VALUATION_ASSIST', advisory_data: advisory, count: advisory.length });
  },
);
