/**
 * Elderly Care routes — M12
 * P13: resident_ref_id opaque; no clinical data in D1 or AI
 * P9: monthly_rate_kobo / monthly_charge_kobo must be integers
 * T3: all queries scoped to tenantId
 * KYC: Tier 2 for billing; Tier 3 for diaspora > ₦5M/year
 * P12: AI blocked on USSD
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  ElderlyCareRepository,
  guardClaimedToFmhswVerified,
  guardDiasporaBilling,
  guardP13ClinicalData,
  guardFractionalKobo,
  isValidElderlyCareTransition,
} from '@webwaka/verticals-elderly-care';

type Auth = { userId: string; tenantId: string };

const app = new Hono<{ Bindings: Env }>();

function repo(c: { env: Env }) { return new ElderlyCareRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; facilityName: string; bedCount?: number; cacRc?: string }>();
  const profile = await repo(c).createProfile({ workspaceId: body.workspaceId, tenantId, facilityName: body.facilityName, bedCount: body.bedCount, cacRc: body.cacRc });
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
  const body = await c.req.json<{ to: string; fmhswRegistration?: string; kycTier?: number }>();
  const to = body.to as Parameters<typeof isValidElderlyCareTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidElderlyCareTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'fmhsw_verified') {
    const g = guardClaimedToFmhswVerified({ fmhswRegistration: body.fmhswRegistration ?? current.fmhswRegistration, kycTier: body.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
    await repo(c).updateProfile(c.req.param('id'), tenantId, { fmhswRegistration: body.fmhswRegistration });
  }
  const updated = await repo(c).transition(c.req.param('id'), tenantId, to);
  return c.json(updated);
});

app.post('/profiles/:id/residents', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ monthlyRateKobo: number; roomNumber?: string; payerType?: string; payerRefId?: string; kycTier?: number; annualTotalKobo?: number }>();
  const g = guardFractionalKobo(body.monthlyRateKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  if (body.payerType === 'diaspora' && body.annualTotalKobo !== undefined) {
    const diasporaG = guardDiasporaBilling({ annualTotalKobo: body.annualTotalKobo, payerType: 'diaspora', kycTier: body.kycTier ?? 0 });
    if (!diasporaG.allowed) return c.json({ error: diasporaG.reason }, 403);
  }
  const resident = await repo(c).createResident({ profileId: c.req.param('id'), tenantId, monthlyRateKobo: body.monthlyRateKobo, roomNumber: body.roomNumber, payerType: body.payerType as never, payerRefId: body.payerRefId });
  return c.json(resident, 201);
});

app.get('/profiles/:id/residents', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listResidents(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/billing', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ residentRefId: string; billingPeriod: string; monthlyChargeKobo: number; paidKobo?: number; paymentDate?: number }>();
  const g = guardFractionalKobo(body.monthlyChargeKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const billing = await repo(c).createBilling({ profileId: c.req.param('id'), tenantId, residentRefId: body.residentRefId, billingPeriod: body.billingPeriod, monthlyChargeKobo: body.monthlyChargeKobo, paidKobo: body.paidKobo, paymentDate: body.paymentDate });
  return c.json(billing, 201);
});

app.post('/profiles/:id/rota', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ staffName: string; role: string; shiftStart: number; shiftEnd: number }>();
  const rota = await repo(c).createStaffRota({ profileId: c.req.param('id'), tenantId, staffName: body.staffName, role: body.role, shiftStart: body.shiftStart, shiftEnd: body.shiftEnd });
  return c.json(rota, 201);
});

app.get('/profiles/:id/rota', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listStaffRota(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/ai/occupancy-report', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ aiRights?: boolean; ndprConsent?: boolean; isUssdSession?: boolean; kycTier?: number; payload?: Record<string, unknown> }>();
  if (body.isUssdSession) return c.json({ error: 'P12: AI blocked on USSD sessions' }, 403);
  if (!body.aiRights) return c.json({ error: 'AI rights not enabled' }, 403);
  if (!body.ndprConsent) return c.json({ error: 'P10: NDPR consent required' }, 403);
  if ((body.kycTier ?? 0) < 2) return c.json({ error: 'KYC Tier 2 required' }, 403);
  if (body.payload) {
    const p13 = guardP13ClinicalData({ payloadKeys: Object.keys(body.payload) });
    if (!p13.allowed) return c.json({ error: p13.reason }, 403);
  }
  const stats = await repo(c).aggregateStats(c.req.param('id'), tenantId);
  return c.json({ report: 'HEALTH_FACILITY_BENCHMARK', stats, autonomyLevel: 'L2' });
});

export default app;
