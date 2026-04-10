/**
 * Advertising Agency routes — M9
 * FSM: seeded → claimed → apcon_verified → active → suspended
 * AI: L2 cap; impressions INTEGER; CPM INTEGER; P13 no client brief to AI
 * P9: kobo integers; T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  AdvertisingAgencyRepository,
  guardClaimedToApconVerified, guardL2AiCap, guardNoClientBriefInAi,
  guardFractionalKobo, guardIntegerImpressions, isValidAdvertisingAgencyTransition,
} from '@webwaka/verticals-advertising-agency';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new AdvertisingAgencyRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; agencyName: string; apconRegistration?: string; oaanMembership?: string; cacRc?: string }>();
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
  const body = await c.req.json<{ to: string; apconRegistration?: string }>();
  const to = body.to as Parameters<typeof isValidAdvertisingAgencyTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidAdvertisingAgencyTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'apcon_verified') {
    const g = guardClaimedToApconVerified({ apconRegistration: body.apconRegistration ?? current.apconRegistration });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/campaigns', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ clientRefId: string; campaignName: string; campaignType: string; budgetKobo: number; startDate: number; endDate: number }>();
  const feeG = guardFractionalKobo(body.budgetKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createCampaign({ profileId: c.req.param('id'), tenantId, ...body, campaignType: body.campaignType as never }), 201);
});

app.post('/campaigns/:campaignId/media-buys', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ channel: string; spendKobo: number; impressions: number; cpmKobo: number }>();
  const impG = guardIntegerImpressions(body.impressions);
  if (!impG.allowed) return c.json({ error: impG.reason }, 422);
  const feeG = guardFractionalKobo(body.spendKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createMediaBuy({ campaignId: c.req.param('campaignId'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/ai/campaign-performance', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  const piiG = guardNoClientBriefInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'Campaign performance AI request queued for L2 advisory review', tenantId });
});

export default app;
