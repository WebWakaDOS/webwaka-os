/**
 * Events Centre routes — M12
 * FSM: seeded → claimed → licence_verified → active → suspended
 * AI: L2 cap; section conflict check; P13 no client details to AI
 * P9: kobo/total_nights integers; T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  EventsCentreRepository,
  guardClaimedToLicenceVerified, guardL2AiCap, guardFractionalKobo,
  isValidEventsCentreTransition,
} from '@webwaka/verticals-events-centre';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new EventsCentreRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; centreName: string; stateEventLicence?: string; fireSafetyCert?: string; lawmaCompliance?: string; cacRc?: string }>();
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
  const body = await c.req.json<{ to: string; stateEventLicence?: string }>();
  const to = body.to as Parameters<typeof isValidEventsCentreTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidEventsCentreTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'licence_verified') {
    const g = guardClaimedToLicenceVerified({ stateEventLicence: body.stateEventLicence ?? current.stateEventLicence });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/sections', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ sectionName: string; capacityGuests: number; dailyRateKobo: number; amenities?: string }>();
  const rateG = guardFractionalKobo(body.dailyRateKobo);
  if (!rateG.allowed) return c.json({ error: rateG.reason }, 422);
  return c.json(await repo(c).createSection({ profileId: c.req.param('id'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/bookings', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ clientPhone: string; sectionIds: string[]; eventType: string; startDate: number; endDate: number; totalNights: number; packageKobo: number; depositKobo: number; balanceKobo: number }>();
  const feeG = guardFractionalKobo(body.packageKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  try {
    return c.json(await repo(c).createBooking({ profileId: c.req.param('id'), tenantId, ...body }), 201);
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : 'booking error' }, 409);
  }
});

app.post('/profiles/:id/ai/section-utilisation', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  return c.json({ status: 'queued', message: 'Section utilisation AI request queued for L2 advisory review', tenantId });
});

export default app;
