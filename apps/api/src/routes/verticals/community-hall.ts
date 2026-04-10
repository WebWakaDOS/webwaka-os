/**
 * Community Hall routes — M12
 * FSM: seeded → claimed → active (3-state)
 * AI: L1 cap — aggregate booking frequency only
 * P9: kobo integers; T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  CommunityHallRepository,
  guardL1AiCap, guardFractionalKobo, isValidCommunityHallTransition,
} from '@webwaka/verticals-community-hall';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new CommunityHallRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; hallName: string; cdaRegistration?: string; lga: string; state: string; capacitySeats: number }>();
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
  const body = await c.req.json<{ to: string }>();
  const to = body.to as Parameters<typeof isValidCommunityHallTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidCommunityHallTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/bookings', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ groupName: string; eventType: string; bookingDate: number; hireFeeKobo: number; depositKobo: number }>();
  const feeG = guardFractionalKobo(body.hireFeeKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  try {
    return c.json(await repo(c).createBooking({ profileId: c.req.param('id'), tenantId, ...body }), 201);
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : 'booking error' }, 409);
  }
});

app.post('/profiles/:id/maintenance', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ contributionDate: number; contributorRef: string; amountKobo: number; purpose?: string }>();
  const feeG = guardFractionalKobo(body.amountKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createMaintenance({ profileId: c.req.param('id'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/ai/booking-frequency', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL1AiCap({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  return c.json({ status: 'queued', message: 'Booking frequency AI request queued for L1 advisory review', tenantId });
});

export default app;
