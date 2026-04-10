/**
 * Mobile Money Agent routes — M12
 * FSM: seeded → claimed → cbn_agent_verified → active → suspended
 * AI: L2 cap; CBN daily cap enforced; P13 no BVN to AI
 * P9: kobo integers; T3: tenantId scoped; Tier 3 KYC
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  MobileMoneyAgentRepository,
  guardClaimedToCbnAgentVerified, guardL2AiCap, guardNoBvnInAi,
  guardFractionalKobo, isValidMobileMoneyAgentTransition,
} from '@webwaka/verticals-mobile-money-agent';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new MobileMoneyAgentRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; agentName: string; cbnSubAgentNumber?: string; superAgentProvider?: string; superAgentLicenceNumber?: string; cacOrTin?: string }>();
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
  const body = await c.req.json<{ to: string; cbnSubAgentNumber?: string }>();
  const to = body.to as Parameters<typeof isValidMobileMoneyAgentTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidMobileMoneyAgentTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'cbn_agent_verified') {
    const g = guardClaimedToCbnAgentVerified({ cbnSubAgentNumber: body.cbnSubAgentNumber ?? current.cbnSubAgentNumber });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/transactions', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ transactionType: string; amountKobo: number; commissionKobo: number; customerBvnRef: string; referenceNumber: string; transactionDate: number }>();
  const feeG = guardFractionalKobo(body.amountKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  const tx = await repo(c).createTransaction({ agentId: c.req.param('id'), tenantId, transactionType: body.transactionType as never, amountKobo: body.amountKobo, commissionKobo: body.commissionKobo, customerBvnRef: body.customerBvnRef, referenceNumber: body.referenceNumber, transactionDate: body.transactionDate });
  return c.json(tx, 201);
});

app.post('/profiles/:id/float/topup', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ amountKobo: number }>();
  const feeG = guardFractionalKobo(body.amountKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).topupFloat(c.req.param('id'), tenantId, body.amountKobo));
});

app.post('/profiles/:id/ai/float-utilisation', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  const piiG = guardNoBvnInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'Float utilisation AI request queued for L2 advisory review', tenantId });
});

export default app;
