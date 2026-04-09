/**
 * Sports Academy routes — M10
 * P13: member_ref_id opaque; health metrics never passed to AI
 * P9: plan_fee_kobo / class_fee_kobo / purchase_cost_kobo must be integers
 * T3: all queries scoped to tenantId
 * P12: AI blocked on USSD
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  SportsAcademyRepository,
  guardClaimedToPermitVerified,
  guardHighValueMembership,
  guardP13HealthMetrics,
  guardFractionalKobo,
  isValidSportsAcademyTransition,
} from '@webwaka/verticals-sports-academy';

type Auth = { userId: string; tenantId: string };

const app = new Hono<{ Bindings: Env }>();

function repo(c: { env: Env }) { return new SportsAcademyRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; academyName: string; type?: string; cacRc?: string }>();
  const profile = await repo(c).createProfile({ workspaceId: body.workspaceId, tenantId, academyName: body.academyName, type: body.type as never, cacRc: body.cacRc });
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
  const body = await c.req.json<{ to: string; stateSportsPermit?: string }>();
  const to = body.to as Parameters<typeof isValidSportsAcademyTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidSportsAcademyTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'permit_verified') {
    const g = guardClaimedToPermitVerified({ stateSportsPermit: body.stateSportsPermit ?? current.stateSportsPermit });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
    await repo(c).updateProfile(c.req.param('id'), tenantId, { stateSportsPermit: body.stateSportsPermit });
  }
  const updated = await repo(c).transition(c.req.param('id'), tenantId, to);
  return c.json(updated);
});

app.post('/profiles/:id/members', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ membershipPlan?: string; planFeeKobo: number; validUntil?: number; kycTier?: number }>();
  const kycG = guardHighValueMembership({ planFeeKobo: body.planFeeKobo, membershipPlan: body.membershipPlan ?? 'monthly', kycTier: body.kycTier ?? 1 });
  if (!kycG.allowed) return c.json({ error: kycG.reason }, 403);
  const g = guardFractionalKobo(body.planFeeKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const member = await repo(c).createMember({ profileId: c.req.param('id'), tenantId, membershipPlan: body.membershipPlan as never, planFeeKobo: body.planFeeKobo, validUntil: body.validUntil });
  return c.json(member, 201);
});

app.get('/profiles/:id/members', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listMembers(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/classes', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ className: string; trainerId?: string; scheduleDay?: string; scheduleTime?: string; capacity?: number; classFeeKobo?: number }>();
  const g = guardFractionalKobo(body.classFeeKobo ?? 0);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const cls = await repo(c).createClass({ profileId: c.req.param('id'), tenantId, ...body });
  return c.json(cls, 201);
});

app.get('/profiles/:id/classes', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listClasses(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/checkins', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ memberRefId: string; classId?: string; checkDate?: number }>();
  const checkin = await repo(c).createCheckin({ profileId: c.req.param('id'), tenantId, memberRefId: body.memberRefId, classId: body.classId, checkDate: body.checkDate });
  return c.json(checkin, 201);
});

app.post('/profiles/:id/equipment', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ equipmentName: string; quantity?: number; purchaseCostKobo: number; lastServiceDate?: number }>();
  const g = guardFractionalKobo(body.purchaseCostKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const equip = await repo(c).createEquipment({ profileId: c.req.param('id'), tenantId, ...body });
  return c.json(equip, 201);
});

app.get('/profiles/:id/equipment', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listEquipment(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/ai/utilisation-report', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ aiRights?: boolean; ndprConsent?: boolean; isUssdSession?: boolean; payload?: Record<string, unknown> }>();
  if (body.isUssdSession) return c.json({ error: 'P12: AI blocked on USSD sessions' }, 403);
  if (!body.aiRights) return c.json({ error: 'AI rights not enabled' }, 403);
  if (!body.ndprConsent) return c.json({ error: 'P10: NDPR consent required' }, 403);
  if (body.payload) {
    const p13 = guardP13HealthMetrics({ payloadKeys: Object.keys(body.payload) });
    if (!p13.allowed) return c.json({ error: p13.reason }, 403);
  }
  const stats = await repo(c).aggregateStats(c.req.param('id'), tenantId);
  return c.json({ report: 'MEMBER_FLOW_REPORT', stats, autonomyLevel: 'L2' });
});

export default app;
