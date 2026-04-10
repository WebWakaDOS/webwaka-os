/**
 * Community routes (M7c)
 *
 *   GET  /community/:slug               — get community space (no auth)
 *   POST /community/join                — join community (auth required, P10)
 *   GET  /community/:id/channels        — list channels (no auth)
 *   GET  /community/channels/:id/posts  — list posts (no auth)
 *   POST /community/channels/:id/posts  — create post (auth required, P15)
 *   GET  /community/:id/courses         — get course modules (no auth)
 *   GET  /community/lessons/:id         — get lesson (no auth, P6 offline-cacheable)
 *   POST /community/lessons/:id/progress — record progress (auth required)
 *   GET  /community/:id/events          — list events (no auth)
 *   POST /community/events/:id/rsvp     — rsvp to event (auth required)
 *
 * T3 — tenant_id from JWT claim (c.get('auth').tenantId) on all auth routes.
 *      Header-based tenant resolution only for public (no-auth) routes.
 * P10 — 403 if no NDPR consent for join.
 * P15 — moderation runs before post insert.
 *
 * SEC-001 fix: removed tenant impersonation via X-Tenant-Id on auth routes.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env.js';
import type { AuthContext } from '@webwaka/types';
import {
  getCommunitySpace,
  joinCommunity,
  listChannels,
  listChannelPosts,
  createChannelPost,
  getCourseModules,
  getLessonById,
  recordLessonProgress,
  listEvents,
  rsvpToEvent,
} from '@webwaka/community';

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

// Public routes only — sourcing tenant from a forgeable header is safe here
// because no authenticated user data is written or scoped.
function getTenantIdFromHeader(c: { req: { header(name: string): string | undefined } }): string | null {
  return c.req.header('X-Tenant-Id') ?? null;
}

export const communityRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// IMPORTANT: Specific paths must be registered BEFORE /:slug catch-all
// to prevent Hono matching /channels/... as slug="channels"
// ---------------------------------------------------------------------------

// GET /community/channels/:id/posts — no auth (public, header-sourced tenant OK)
communityRoutes.get('/channels/:id/posts', async (c) => {
  const tenantId = getTenantIdFromHeader(c);
  if (!tenantId) return c.json({ error: 'X-Tenant-Id header required' }, 400);

  const { id } = c.req.param();
  const db = c.env.DB as unknown as D1Like;
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const posts = await listChannelPosts(db, id, tenantId, limit, offset);
  return c.json({ posts });
});

// POST /community/channels/:id/posts — auth required (T3: tenant from JWT)
communityRoutes.post('/channels/:id/posts', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const body = await c.req.json().catch(() => null);
  const schema = z.object({ content: z.string().min(1, 'content must not be empty') });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }

  const { id } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  try {
    const post = await createChannelPost(db, {
      channelId: id,
      authorId: auth.userId,
      content: parsed.data.content,
      tenantId,
    });
    return c.json({ post }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: msg }, 400);
  }
});

// GET /community/lessons/:id — no auth (public, P6 offline-cacheable)
communityRoutes.get('/lessons/:id', async (c) => {
  const tenantId = getTenantIdFromHeader(c);
  if (!tenantId) return c.json({ error: 'X-Tenant-Id header required' }, 400);

  const { id } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  const lesson = await getLessonById(db, id, tenantId);
  if (!lesson) return c.json({ error: 'Lesson not found' }, 404);

  // P6 — offline-cacheable
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ lesson });
});

// POST /community/lessons/:id/progress — auth required (T3: tenant from JWT)
communityRoutes.post('/lessons/:id/progress', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const body = await c.req.json().catch(() => null);
  const schema = z.object({ progressPct: z.number().int().min(0).max(100) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }

  const { id } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  const progress = await recordLessonProgress(db, {
    lessonId: id,
    userId: auth.userId,
    progressPct: parsed.data.progressPct,
    tenantId,
  });
  return c.json({ progress });
});

// POST /community/events/:id/rsvp — auth required (T3: tenant from JWT)
communityRoutes.post('/events/:id/rsvp', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const { id } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  try {
    const rsvp = await rsvpToEvent(db, { eventId: id, userId: auth.userId, tenantId });
    return c.json({ rsvp }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('EVENT_FULL')) return c.json({ error: msg }, 409);
    if (msg.includes('PAYMENT_REQUIRED')) return c.json({ error: msg }, 402);
    if (msg.includes('NOT_FOUND')) return c.json({ error: msg }, 404);
    return c.json({ error: msg }, 400);
  }
});

// GET /community/:id/channels — no auth (public, header-sourced tenant OK)
communityRoutes.get('/:id/channels', async (c) => {
  const tenantId = getTenantIdFromHeader(c);
  if (!tenantId) return c.json({ error: 'X-Tenant-Id header required' }, 400);

  const { id } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  const channels = await listChannels(db, id, tenantId);
  return c.json({ channels });
});

// GET /community/:id/courses — no auth (public, header-sourced tenant OK)
communityRoutes.get('/:id/courses', async (c) => {
  const tenantId = getTenantIdFromHeader(c);
  if (!tenantId) return c.json({ error: 'X-Tenant-Id header required' }, 400);

  const { id } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  const modules = await getCourseModules(db, id, tenantId);
  return c.json({ modules });
});

// GET /community/:id/events — no auth (public, header-sourced tenant OK)
communityRoutes.get('/:id/events', async (c) => {
  const tenantId = getTenantIdFromHeader(c);
  if (!tenantId) return c.json({ error: 'X-Tenant-Id header required' }, 400);

  const { id } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  const events = await listEvents(db, id, tenantId);
  return c.json({ events });
});

// POST /community/join — auth required (T3: tenant from JWT)
communityRoutes.post('/join', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    communityId: z.string().min(1),
    tierId: z.string().min(1),
    kycTier: z.number().int().min(0).optional().default(0),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }

  const db = c.env.DB as unknown as D1Like;

  try {
    const membership = await joinCommunity(db, {
      communityId: parsed.data.communityId,
      userId: auth.userId,
      tierId: parsed.data.tierId,
      kycTier: parsed.data.kycTier,
      tenantId,
    });
    return c.json({ membership }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('NDPR_CONSENT_REQUIRED')) return c.json({ error: msg }, 403);
    return c.json({ error: msg }, 400);
  }
});

// GET /community/:slug — MUST be last (catch-all, no auth, header-sourced tenant OK)
communityRoutes.get('/:slug', async (c) => {
  const tenantId = getTenantIdFromHeader(c);
  if (!tenantId) return c.json({ error: 'X-Tenant-Id header required' }, 400);

  const { slug } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  const space = await getCommunitySpace(db, slug, tenantId);
  if (!space) return c.json({ error: 'Community not found' }, 404);

  return c.json({ space });
});
