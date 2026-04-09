/**
 * Rehab Centre routes — M12
 * P13 CRITICAL: resident_ref_id opaque — NO name, condition, substance, diagnosis EVER
 * L3 HITL MANDATORY for ALL SuperAgent calls — every AI route enforces this
 * P9: total_fee_kobo / deposit_kobo / balance_kobo must be integers
 * T3: all queries scoped to tenantId
 * KYC: Tier 3 mandatory for all operations
 * P12: AI blocked on USSD
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  RehabCentreRepository,
  guardClaimedToNdleaVerified,
  guardAiHitl,
  guardKycTier3,
  guardP13ResidentData,
  guardFractionalKobo,
  guardPositiveInteger,
  isValidRehabCentreTransition,
} from '@webwaka/verticals-rehab-centre';

type Auth = { userId: string; tenantId: string };

const app = new Hono<{ Bindings: Env }>();

function repo(c: { env: Env }) { return new RehabCentreRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; centreName: string; bedCount?: number; cacRc?: string; kycTier?: number }>();
  const kycG = guardKycTier3({ kycTier: body.kycTier ?? 0 });
  if (!kycG.allowed) return c.json({ error: kycG.reason }, 403);
  const profile = await repo(c).createProfile({ workspaceId: body.workspaceId, tenantId, centreName: body.centreName, bedCount: body.bedCount, cacRc: body.cacRc });
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
  const body = await c.req.json<{ to: string; ndleaLicence?: string; kycTier?: number }>();
  const to = body.to as Parameters<typeof isValidRehabCentreTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidRehabCentreTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'ndlea_verified') {
    const g = guardClaimedToNdleaVerified({ ndleaLicence: body.ndleaLicence ?? current.ndleaLicence, kycTier: body.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
    await repo(c).updateProfile(c.req.param('id'), tenantId, { ndleaLicence: body.ndleaLicence });
  }
  const updated = await repo(c).transition(c.req.param('id'), tenantId, to);
  return c.json(updated);
});

app.post('/profiles/:id/programmes', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ programmeName: string; durationDays: number; totalFeeKobo: number; programmeType?: string }>();
  const kgDays = guardPositiveInteger(body.durationDays, 'durationDays');
  if (!kgDays.allowed) return c.json({ error: kgDays.reason }, 422);
  const g = guardFractionalKobo(body.totalFeeKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const prog = await repo(c).createProgramme({ profileId: c.req.param('id'), tenantId, programmeName: body.programmeName, durationDays: body.durationDays, totalFeeKobo: body.totalFeeKobo, programmeType: body.programmeType as never });
  return c.json(prog, 201);
});

app.get('/profiles/:id/programmes', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listProgrammes(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/enrolments', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ programmeId: string; depositKobo: number; balanceKobo: number; enrolmentDate?: number }>();
  const gDep = guardFractionalKobo(body.depositKobo);
  if (!gDep.allowed) return c.json({ error: gDep.reason }, 422);
  if (!Number.isInteger(body.balanceKobo)) return c.json({ error: 'P9: balanceKobo must be an integer' }, 422);
  const enrolment = await repo(c).createEnrolment({ profileId: c.req.param('id'), tenantId, programmeId: body.programmeId, depositKobo: body.depositKobo, balanceKobo: body.balanceKobo, enrolmentDate: body.enrolmentDate });
  return c.json(enrolment, 201);
});

app.get('/profiles/:id/enrolments', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listEnrolments(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/sessions', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ residentRefId: string; facilitatorId: string; sessionType?: string; sessionDate?: number }>();
  const session = await repo(c).createSession({ profileId: c.req.param('id'), tenantId, residentRefId: body.residentRefId, facilitatorId: body.facilitatorId, sessionType: body.sessionType as never, sessionDate: body.sessionDate });
  return c.json(session, 201);
});

app.get('/profiles/:id/sessions', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listSessions(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/ai/occupancy-report', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ aiRights?: boolean; ndprConsent?: boolean; isUssdSession?: boolean; autonomyLevel?: string; payload?: Record<string, unknown> }>();
  if (body.isUssdSession) return c.json({ error: 'P12: AI blocked on USSD sessions' }, 403);
  const hitlG = guardAiHitl({ autonomyLevel: body.autonomyLevel ?? '' });
  if (!hitlG.allowed) return c.json({ error: hitlG.reason }, 403);
  if (!body.aiRights) return c.json({ error: 'AI rights not enabled' }, 403);
  if (!body.ndprConsent) return c.json({ error: 'P10: NDPR consent required — mandatory for rehab vertical' }, 403);
  if (body.payload) {
    const p13 = guardP13ResidentData({ payloadKeys: Object.keys(body.payload) });
    if (!p13.allowed) return c.json({ error: p13.reason }, 403);
  }
  const stats = await repo(c).aggregateStats(c.req.param('id'), tenantId);
  return c.json({ report: 'HEALTH_FACILITY_BENCHMARK', stats, autonomyLevel: 'L3_HITL' });
});

export default app;
