/**
 * Community Health routes — M12
 * P13: household_ref_id opaque; no names or addresses
 * P12: AI blocked on USSD sessions; USSD data-entry routes work without AI
 * T3: all queries scoped to tenantId
 * No monetary transactions at this vertical
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  CommunityHealthRepository,
  guardClaimedToNphcdaRegistered,
  guardUssdAiBlock,
  guardP13HouseholdData,
  guardIntegerCount,
  isValidCommunityHealthTransition,
} from '@webwaka/verticals-community-health';

type Auth = { userId: string; tenantId: string };

const app = new Hono<{ Bindings: Env }>();

function repo(c: { env: Env }) { return new CommunityHealthRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; orgName: string; lga?: string }>();
  const profile = await repo(c).createProfile({ workspaceId: body.workspaceId, tenantId, orgName: body.orgName, lga: body.lga });
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
  const body = await c.req.json<{ to: string; nphcdaAffiliation?: string; stateMohRegistration?: string }>();
  const to = body.to as Parameters<typeof isValidCommunityHealthTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidCommunityHealthTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'nphcda_registered') {
    const g = guardClaimedToNphcdaRegistered({ nphcdaAffiliation: body.nphcdaAffiliation ?? current.nphcdaAffiliation, stateMohRegistration: body.stateMohRegistration ?? current.stateMohRegistration });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
    await repo(c).updateProfile(c.req.param('id'), tenantId, { nphcdaAffiliation: body.nphcdaAffiliation, stateMohRegistration: body.stateMohRegistration });
  }
  const updated = await repo(c).transition(c.req.param('id'), tenantId, to);
  return c.json(updated);
});

app.post('/profiles/:id/workers', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ trainingLevel?: string; lga?: string; ward?: string }>();
  const worker = await repo(c).createWorker({ profileId: c.req.param('id'), tenantId, trainingLevel: body.trainingLevel as never, lga: body.lga, ward: body.ward });
  return c.json(worker, 201);
});

app.get('/profiles/:id/workers', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listWorkers(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/visits', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ chwRefId: string; servicesProvided?: string; referralFlag?: boolean; visitDate?: number }>();
  const visit = await repo(c).createVisit({ profileId: c.req.param('id'), tenantId, chwRefId: body.chwRefId, servicesProvided: body.servicesProvided, referralFlag: body.referralFlag, visitDate: body.visitDate });
  return c.json(visit, 201);
});

app.get('/profiles/:id/visits', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listVisits(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/immunisation', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ chwRefId: string; vaccineName: string; dosesAdministered: number; tallyDate?: number; lga?: string; ward?: string }>();
  const g = guardIntegerCount(body.dosesAdministered, 'dosesAdministered');
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const imm = await repo(c).createImmunisation({ profileId: c.req.param('id'), tenantId, chwRefId: body.chwRefId, vaccineName: body.vaccineName, dosesAdministered: body.dosesAdministered, tallyDate: body.tallyDate, lga: body.lga, ward: body.ward });
  return c.json(imm, 201);
});

app.post('/profiles/:id/stock', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ itemName: string; unitCount?: number; dispensedCount?: number }>();
  if (body.unitCount !== undefined) { const g = guardIntegerCount(body.unitCount, 'unitCount'); if (!g.allowed) return c.json({ error: g.reason }, 422); }
  const stock = await repo(c).createStock({ profileId: c.req.param('id'), tenantId, itemName: body.itemName, unitCount: body.unitCount, dispensedCount: body.dispensedCount });
  return c.json(stock, 201);
});

app.get('/profiles/:id/stock', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listStock(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/ai/coverage-report', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ aiRights?: boolean; ndprConsent?: boolean; isUssdSession?: boolean; payload?: Record<string, unknown> }>();
  const ussdG = guardUssdAiBlock({ isUssdSession: body.isUssdSession ?? false });
  if (!ussdG.allowed) return c.json({ error: ussdG.reason }, 403);
  if (!body.aiRights) return c.json({ error: 'AI rights not enabled' }, 403);
  if (!body.ndprConsent) return c.json({ error: 'P10: NDPR consent required' }, 403);
  if (body.payload) {
    const p13 = guardP13HouseholdData({ payloadKeys: Object.keys(body.payload) });
    if (!p13.allowed) return c.json({ error: p13.reason }, 403);
  }
  const stats = await repo(c).aggregateStats(c.req.param('id'), tenantId);
  return c.json({ report: 'HEALTH_FACILITY_BENCHMARK', stats, autonomyLevel: 'L2' });
});

export default app;
