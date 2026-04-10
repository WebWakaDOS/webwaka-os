/**
 * Government Agency / MDA routes — M11
 * FSM: seeded → claimed → bpp_registered → active → suspended
 * AI: L3 HITL MANDATORY on ALL AI — no exceptions
 * P13: vendor_ref, procurement_ref, budget_line_item all opaque; P9: kobo integers; T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  GovernmentAgencyRepository,
  guardClaimedToBppRegistered, guardL3HitlRequired, guardNoVendorOrProcurementInAi,
  guardFractionalKobo, isValidGovernmentAgencyTransition,
} from '@webwaka/verticals-government-agency';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new GovernmentAgencyRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; agencyName: string; mdaCode?: string; bppRegistration?: string; tsaCompliance?: boolean; state: string; ministry?: string }>();
  return c.json(await repo(c).createProfile({ ...body, tenantId }), 201);
});

app.get('/profiles/:id', async (c) => {
  const { tenantId } = auth(c);
  const p = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!p) return c.json({ error: 'not found' }, 404);
  return c.json(p);
});

app.patch('/profiles/:id/transition', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ to: string; bppRegistration?: string }>();
  const to = body.to as Parameters<typeof isValidGovernmentAgencyTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidGovernmentAgencyTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'bpp_registered') {
    const g = guardClaimedToBppRegistered({ bppRegistration: body.bppRegistration ?? current.bppRegistration });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/appropriations', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ fiscalYear: string; budgetLineItem: string; allocatedKobo: number; releasedKobo?: number; spentKobo?: number }>();
  const feeG = guardFractionalKobo(body.allocatedKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createAppropriation({ profileId: c.req.param('id'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/procurements', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ procurementRef: string; bppApprovalRef?: string; vendorRef: string; amountKobo: number; category: string }>();
  const feeG = guardFractionalKobo(body.amountKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createProcurement({ profileId: c.req.param('id'), tenantId, category: body.category as never, ...body }), 201);
});

app.post('/profiles/:id/igr', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ revenueType: string; collectionDate: number; amountKobo: number; receiptRef: string }>();
  const feeG = guardFractionalKobo(body.amountKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createIgrCollection({ profileId: c.req.param('id'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/ai/budget-analysis', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ hitlApproved?: boolean; [k: string]: unknown }>();
  const hitlG = guardL3HitlRequired({ hitlApproved: body.hitlApproved });
  if (!hitlG.allowed) return c.json({ error: hitlG.reason }, 403);
  const piiG = guardNoVendorOrProcurementInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'Budget analysis AI request queued — L3 HITL approval confirmed', tenantId });
});

export default app;
