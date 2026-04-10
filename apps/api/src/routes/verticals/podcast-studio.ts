/**
 * Podcast Studio routes — M12
 * FSM: seeded → claimed → cac_verified → active → suspended
 * AI: L3 HITL required for BROADCAST_SCHEDULING_ASSIST; L2 for sponsorship revenue
 * P13: guest_ref_id and sponsor_ref_id opaque; P9: kobo integers; T3: tenantId scoped
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  PodcastStudioRepository,
  guardClaimedToCacVerified, guardL3HitlRequired, guardL2AiCapSponsorship,
  guardNoGuestSponsorInAi, guardFractionalKobo, isValidPodcastStudioTransition,
} from '@webwaka/verticals-podcast-studio';

type Auth = { userId: string; tenantId: string };
const app = new Hono<{ Bindings: Env }>();
function repo(c: { env: Env }) { return new PodcastStudioRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; studioName: string; nbcLicence?: string; nccRegistration?: string; apconForAds?: string; cacRc?: string }>();
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
  const body = await c.req.json<{ to: string; cacRc?: string }>();
  const to = body.to as Parameters<typeof isValidPodcastStudioTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidPodcastStudioTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'cac_verified') {
    const g = guardClaimedToCacVerified({ cacRc: body.cacRc ?? current.cacRc });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  await repo(c).updateStatus(c.req.param('id'), tenantId, to);
  return c.json(await repo(c).findProfileById(c.req.param('id'), tenantId));
});

app.post('/shows/:showId/episodes', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ episodeNumber: number; recordingDate: number; durationMinutes: number; releaseDate: number }>();
  return c.json(await repo(c).createEpisode({ showId: c.req.param('showId'), tenantId, ...body }), 201);
});

app.post('/shows/:showId/sessions', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ guestRefId: string; sessionDate: number; sessionFeeKobo: number }>();
  const feeG = guardFractionalKobo(body.sessionFeeKobo);
  if (!feeG.allowed) return c.json({ error: feeG.reason }, 422);
  return c.json(await repo(c).createSession({ showId: c.req.param('showId'), tenantId, ...body }), 201);
});

app.post('/profiles/:id/ai/broadcast-schedule', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ hitlApproved?: boolean; [k: string]: unknown }>();
  const hitlG = guardL3HitlRequired({ hitlApproved: body.hitlApproved });
  if (!hitlG.allowed) return c.json({ error: hitlG.reason }, 403);
  const piiG = guardNoGuestSponsorInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'Broadcast schedule AI request queued — L3 HITL approval confirmed', tenantId });
});

app.post('/profiles/:id/ai/sponsorship-revenue', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const capG = guardL2AiCapSponsorship({ autonomyLevel: body.autonomyLevel as never });
  if (!capG.allowed) return c.json({ error: capG.reason }, 403);
  const piiG = guardNoGuestSponsorInAi(body);
  if (!piiG.allowed) return c.json({ error: piiG.reason }, 403);
  return c.json({ status: 'queued', message: 'Sponsorship revenue AI request queued for L2 advisory review', tenantId });
});

export default app;
