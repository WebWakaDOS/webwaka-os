/**
 * Water Treatment routes — M11
 * FSM: seeded → claimed → nafdac_verified → active → suspended
 * AI: L2 cap; scaled integers enforced; no client details to AI
 * P9: kobo/litres integers; SCALED: ph_x100, chlorine_ppm10, turbidity_ntu10 (NO FLOATS)
 * T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  WaterTreatmentRepository,
  guardClaimedToNafdacVerified, guardL2AiCap, guardFractionalKobo,
  guardScaledIntegerPh, guardScaledIntegerChlorine, isValidWaterTreatmentTransition,
} from '@webwaka/verticals-water-treatment';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new WaterTreatmentRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; companyName: string; nafdacWaterLicence?: string; stateWaterBoardCert?: string; cacRc?: string; capacityLitresPerDay: number }>();
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
  const body = await c.req.json<{ to: string; nafdacWaterLicence?: string }>();
  const to = body.to as Parameters<typeof isValidWaterTreatmentTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidWaterTreatmentTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'nafdac_verified') {
    const g = guardClaimedToNafdacVerified({ nafdacWaterLicence: body.nafdacWaterLicence ?? current.nafdacWaterLicence });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/quality-logs', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ testDate: number; phX100: number; chlorinePpm10: number; turbidityNtu10: number }>();
  const phG = guardScaledIntegerPh(body.phX100);
  if (!phG.allowed) return c.json({ error: phG.reason }, 422);
  const clG = guardScaledIntegerChlorine(body.chlorinePpm10);
  if (!clG.allowed) return c.json({ error: clG.reason }, 422);
  return c.json(await repo(c).createQualityLog({ profileId: c.req.param('id'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/subscriptions', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ clientPhone: string; propertyType: string; monthlyRateKobo: number; dailyLitresAllocation: number }>();
  const feeG = guardFractionalKobo(body.monthlyRateKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createSubscription({ profileId: c.req.param('id'), tenantId, propertyType: body.propertyType as never, ...body }), 201);
});

app.post('/profiles/:id/ai/quality-alert', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  return c.json({ status: 'queued', message: 'Water quality alert AI request queued for L2 advisory review', tenantId });
});

export default app;
