/**
 * Newspaper Distribution routes — M12
 * FSM: seeded → claimed → npc_verified → active → suspended
 * AI: L2 cap; print_run INTEGER copies; P13 advertiser_ref_id opaque
 * P9: kobo integers; T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  NewspaperDistRepository,
  guardClaimedToNpcVerified, guardIntegerPrintRun, guardL2AiCap,
  guardFractionalKobo, isValidNewspaperDistTransition,
} from '@webwaka/verticals-newspaper-dist';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new NewspaperDistRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; publicationName: string; npcRegistration?: string; npanMembership?: string; nujAffiliation?: string; frequency: string }>();
  return c.json(await repo(c).createProfile({ ...body, tenantId, frequency: body.frequency as never }), 201);
});

app.get('/profiles/:id', async (c) => {
  const { tenantId } = auth(c);
  const p = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!p) return c.json({ error: 'not found' }, 404);
  return c.json(p);
});

app.patch('/profiles/:id/transition', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ to: string; npcRegistration?: string }>();
  const to = body.to as Parameters<typeof isValidNewspaperDistTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidNewspaperDistTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'npc_verified') {
    const g = guardClaimedToNpcVerified({ npcRegistration: body.npcRegistration ?? current.npcRegistration });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/print-runs', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ editionDate: number; printRun: number; distributionCount: number; copiesReturned: number; costPerCopyKobo: number }>();
  const printG = guardIntegerPrintRun(body.printRun);
  if (!printG.allowed) return c.json({ error: printG.reason }, 422);
  const feeG = guardFractionalKobo(body.costPerCopyKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createPrintRun({ profileId: c.req.param('id'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/ads', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ advertiserRefId: string; editionDate: number; adType: string; adFeeKobo: number }>();
  const feeG = guardFractionalKobo(body.adFeeKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createAd({ profileId: c.req.param('id'), tenantId, adType: body.adType as never, ...body }), 201);
});

app.post('/profiles/:id/ai/circulation-trend', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  return c.json({ status: 'queued', message: 'Circulation trend AI request queued for L2 advisory review', tenantId });
});

export default app;
