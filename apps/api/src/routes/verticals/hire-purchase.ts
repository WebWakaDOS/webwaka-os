/**
 * Hire Purchase routes — M12
 * FSM: seeded → claimed → cbn_verified → active → suspended
 * AI: L2 cap; outstanding_kobo decrements on repayment; P13 no BVN to AI
 * P9: kobo/installments integers; T3: tenantId scoped; Tier 3 KYC
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  HirePurchaseRepository,
  guardClaimedToCbnVerified, guardL2AiCap, guardNoBvnInAi,
  guardFractionalKobo, guardIntegerInstallments, isValidHirePurchaseTransition,
} from '@webwaka/verticals-hire-purchase';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new HirePurchaseRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; companyName: string; cbnConsumerCreditReg?: string; cacRc?: string }>();
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
  const body = await c.req.json<{ to: string; cbnConsumerCreditReg?: string }>();
  const to = body.to as Parameters<typeof isValidHirePurchaseTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidHirePurchaseTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'cbn_verified') {
    const g = guardClaimedToCbnVerified({ cbnConsumerCreditReg: body.cbnConsumerCreditReg ?? current.cbnConsumerCreditReg });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/assets', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ assetType: string; serialNumber: string; assetValueKobo: number }>();
  const feeG = guardFractionalKobo(body.assetValueKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createAsset({ profileId: c.req.param('id'), tenantId, assetType: body.assetType as never, serialNumber: body.serialNumber, assetValueKobo: body.assetValueKobo }), 201);
});

app.post('/profiles/:id/agreements', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ customerBvnRef: string; assetId: string; totalHpValueKobo: number; depositKobo: number; installments: number; installmentAmountKobo: number; tenorMonths: number; startDate: number }>();
  const instG = guardIntegerInstallments(body.installments);
  if (!instG.allowed) return c.json({ error: instG.reason }, 422);
  const feeG = guardFractionalKobo(body.totalHpValueKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createAgreement({ profileId: c.req.param('id'), tenantId, ...body }), 201);
});

app.post('/agreements/:agreementId/repayments', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ paymentDate: number; amountKobo: number }>();
  const feeG = guardFractionalKobo(body.amountKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createRepayment({ agreementId: c.req.param('agreementId'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/ai/repayment-forecast', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  const piiG = guardNoBvnInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'Repayment forecast AI request queued for L2 advisory review', tenantId });
});

export default app;
