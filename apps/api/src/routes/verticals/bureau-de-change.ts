/**
 * Bureau de Change routes — M12
 * FSM: seeded → claimed → cbn_verified → active → suspended
 * AI: L2 cap; FX rates as kobo/cent integers; P13 no BVN to AI
 * P9: kobo/cents integers (NO FLOATS); T3: tenantId scoped; Tier 3 KYC
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  BureauDeChangeRepository,
  guardClaimedToCbnVerified, guardIntegerFxRate, guardIntegerCents,
  guardL2AiCap, guardNoBvnInAi, guardFractionalKobo, isValidBdcTransition,
} from '@webwaka/verticals-bureau-de-change';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new BureauDeChangeRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; companyName: string; cbnBdcLicence?: string; abconMembership?: string; cbnTier?: number; cacRc?: string }>();
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
  const body = await c.req.json<{ to: string; cbnBdcLicence?: string }>();
  const to = body.to as Parameters<typeof isValidBdcTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidBdcTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'cbn_verified') {
    const g = guardClaimedToCbnVerified({ cbnBdcLicence: body.cbnBdcLicence ?? current.cbnBdcLicence });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/rates', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ rateDate: number; currency: string; buyRateKoboPerCent: number; sellRateKoboPerCent: number }>();
  const buyG = guardIntegerFxRate(body.buyRateKoboPerCent);
  if (!buyG.allowed) return c.json({ error: buyG.reason }, 422);
  const sellG = guardIntegerFxRate(body.sellRateKoboPerCent);
  if (!sellG.allowed) return c.json({ error: sellG.reason }, 422);
  return c.json(await repo(c).createRate({ profileId: c.req.param('id'), tenantId, rateDate: body.rateDate, currency: body.currency as never, buyRateKoboPerCent: body.buyRateKoboPerCent, sellRateKoboPerCent: body.sellRateKoboPerCent }), 201);
});

app.post('/profiles/:id/transactions', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ customerBvnRef: string; currency: string; usdAmountCents: number; nairaAmountKobo: number; direction: string; transactionDate: number }>();
  const centsG = guardIntegerCents(body.usdAmountCents);
  if (!centsG.allowed) return c.json({ error: centsG.reason }, 422);
  const koboG = guardFractionalKobo(body.nairaAmountKobo);
  if (!koboG.allowed) return c.json({ error: koboG.reason }, 422);
  return c.json(await repo(c).createTransaction({ profileId: c.req.param('id'), tenantId, customerBvnRef: body.customerBvnRef, currency: body.currency as never, usdAmountCents: body.usdAmountCents, nairaAmountKobo: body.nairaAmountKobo, direction: body.direction as never, transactionDate: body.transactionDate }), 201);
});

app.post('/profiles/:id/ai/fx-position', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  const piiG = guardNoBvnInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'FX position AI request queued for L2 advisory review', tenantId });
});

export default app;
