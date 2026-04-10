/**
 * Event Hall routes — M10
 * FSM: seeded → claimed → licence_verified → active → suspended
 * AI: L2 cap; double-booking prevented; P13 no client details to AI
 * P9: kobo integers; T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  EventHallRepository,
  guardClaimedToLicenceVerified, guardL2AiCap, guardNoClientDetailsInAi,
  guardFractionalKobo, isValidEventHallTransition,
} from '@webwaka/verticals-event-hall';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new EventHallRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; hallName: string; stateEventLicence?: string; fireSafetyCert?: string; cacRc?: string; capacityGuests: number }>();
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
  const to = body.to as Parameters<typeof isValidEventHallTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidEventHallTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'licence_verified') {
    const g = guardClaimedToLicenceVerified({ stateEventLicence: body.stateEventLicence ?? current.stateEventLicence });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/bookings', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ clientPhone: string; eventDate: number; eventType: string; capacityRequired: number; hireRateKobo: number; depositKobo: number; balanceKobo: number; addOns?: string }>();
  const feeG = guardFractionalKobo(body.hireRateKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  try {
    return c.json(await repo(c).createBooking({ profileId: c.req.param('id'), tenantId, ...body }), 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'booking error';
    return c.json({ error: msg }, 409);
  }
});

app.post('/profiles/:id/ai/venue-utilisation', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  const piiG = guardNoClientDetailsInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'Venue utilisation AI request queued for L2 advisory review', tenantId });
});

export default app;
