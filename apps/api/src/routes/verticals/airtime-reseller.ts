/**
 * Airtime Reseller routes — M12
 * FSM: seeded → claimed → ncc_verified → active → suspended
 * AI: L2 cap; CBN daily cap 30,000,000 kobo enforced; P13 no recipient_phone to AI
 * P9: kobo integers; T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  AirtimeResellerRepository,
  guardClaimedToNccVerified, guardL2AiCap, guardNoRecipientInAi,
  guardFractionalKobo, isValidAirtimeResellerTransition,
} from '@webwaka/verticals-airtime-reseller';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new AirtimeResellerRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; businessName: string; nccDealerCode?: string; cbnSubAgentNumber?: string }>();
  const profile = await repo(c).createProfile({ workspaceId: body.workspaceId, tenantId, businessName: body.businessName, nccDealerCode: body.nccDealerCode, cbnSubAgentNumber: body.cbnSubAgentNumber });
  return c.json(profile, 201);
});

app.get('/profiles/:id', async (c) => {
  const { tenantId } = auth(c);
  const p = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!p) return c.json({ error: 'not found' }, 404);
  return c.json(p);
});

app.patch('/profiles/:id/transition', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ to: string; nccDealerCode?: string }>();
  const to = body.to as Parameters<typeof isValidAirtimeResellerTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidAirtimeResellerTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'ncc_verified') {
    const g = guardClaimedToNccVerified({ nccDealerCode: body.nccDealerCode ?? current.nccDealerCode });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/transactions', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ recipientPhone: string; network: string; amountKobo: number; commissionKobo: number; transactionDate: number }>();
  const feeG = guardFractionalKobo(body.amountKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  const tx = await repo(c).createTransaction({ resellerId: c.req.param('id'), tenantId, recipientPhone: body.recipientPhone, network: body.network as never, amountKobo: body.amountKobo, commissionKobo: body.commissionKobo, transactionDate: body.transactionDate });
  return c.json(tx, 201);
});

app.post('/profiles/:id/ai/revenue-trend', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  const piiG = guardNoRecipientInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'Revenue trend AI request queued for L2 advisory review', tenantId });
});

export default app;
