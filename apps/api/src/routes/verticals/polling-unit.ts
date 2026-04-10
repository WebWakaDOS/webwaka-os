/**
 * Polling Unit routes — M12
 * FSM: seeded → claimed → inec_accredited → active → suspended
 * AI: L3 HITL MANDATORY on ALL AI — electoral data most sensitive
 * ABSOLUTE RULE: NO voter PII stored or forwarded; only aggregate INTEGER counts
 * T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  PollingUnitRepository,
  guardClaimedToInecAccredited, guardL3HitlRequired, guardNoVoterPiiInAi,
  guardIntegerVoteCount, isValidPollingUnitTransition,
} from '@webwaka/verticals-polling-unit';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new PollingUnitRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; orgName: string; inecAccreditation?: string; state: string; lga: string }>();
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
  const body = await c.req.json<{ to: string; inecAccreditation?: string }>();
  const to = body.to as Parameters<typeof isValidPollingUnitTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidPollingUnitTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'inec_accredited') {
    const g = guardClaimedToInecAccredited({ inecAccreditation: body.inecAccreditation ?? current.inecAccreditation });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/units', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ unitCode: string; wardName: string; lga: string; state: string; registeredVoters: number }>();
  const cntG = guardIntegerVoteCount(body.registeredVoters);
  if (!cntG.allowed) return c.json({ error: cntG.reason }, 422);
  return c.json(await repo(c).createPollingUnit({ profileId: c.req.param('id'), tenantId, ...body }), 201);
});

app.post('/units/:unitId/election-events', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ profileId: string; electionName: string; electionDate: number; accreditedCount: number; votesCast: number; formRef: string }>();
  const accG = guardIntegerVoteCount(body.accreditedCount);
  if (!accG.allowed) return c.json({ error: accG.reason }, 422);
  const vcG = guardIntegerVoteCount(body.votesCast);
  if (!vcG.allowed) return c.json({ error: vcG.reason }, 422);
  return c.json(await repo(c).createElectionEvent({ unitId: c.req.param('unitId'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/ai/turnout-analysis', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ hitlApproved?: boolean; [k: string]: unknown }>();
  const hitlG = guardL3HitlRequired({ hitlApproved: body.hitlApproved });
  if (!hitlG.allowed) return c.json({ error: hitlG.reason }, 403);
  const piiG = guardNoVoterPiiInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'Turnout analysis AI request queued — L3 HITL approval confirmed', tenantId });
});

export default app;
