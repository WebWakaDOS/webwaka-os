/**
 * Social routes (M7c)
 *
 *   GET  /social/profile/:handle        — get profile (no auth)
 *   POST /social/profile/setup          — setup profile (auth required)
 *   POST /social/follow/:id             — follow profile (auth required)
 *   GET  /social/feed                   — home feed (auth required)
 *   POST /social/posts                  — create post (auth required, P15)
 *   POST /social/posts/:id/react        — react to post (auth required)
 *   GET  /social/dm/threads             — list DM threads (auth required)
 *   POST /social/dm/threads             — create DM thread (auth required)
 *   POST /social/dm/threads/:id/messages — send DM (auth required, P14)
 *   GET  /social/stories                — get active stories (auth required)
 *   POST /social/stories                — create story (auth required)
 *
 * T3 — tenant_id from JWT claim (c.get('auth').tenantId) on all auth routes.
 *      Header-based tenant resolution only for public (no-auth) routes.
 * P14 — assertDMMasterKey called before DM send.
 * P15 — moderation runs before post insert.
 *
 * SEC-001 fix: removed tenant impersonation via X-Tenant-Id on auth routes.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env.js';
import type { AuthContext } from '@webwaka/types';
import {
  setupSocialProfile,
  getSocialProfileByHandle,
  followProfile,
  getUserFeed,
  createPost,
  reactToPost,
  createDMThread,
  sendDM,
  getDMThreads,
  getActiveStories,
  assertDMMasterKey,
} from '@webwaka/social';

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

export const socialRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// GET /social/profile/:handle — no auth (public, header-sourced tenant OK)
// ---------------------------------------------------------------------------

socialRoutes.get('/profile/:handle', async (c) => {
  const tenantId = getTenantIdFromHeader(c);
  if (!tenantId) return c.json({ error: 'X-Tenant-Id header required' }, 400);

  const { handle } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  const profile = await getSocialProfileByHandle(db, handle, tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  return c.json({ profile });
});

// ---------------------------------------------------------------------------
// POST /social/profile/setup — auth required (T3: tenant from JWT)
// ---------------------------------------------------------------------------

socialRoutes.post('/profile/setup', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    handle: z.string().regex(/^[a-z0-9_]{2,30}$/, 'Invalid handle format'),
    displayName: z.string().optional(),
    bio: z.string().optional(),
    phoneNumber: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }

  const db = c.env.DB as unknown as D1Like;

  try {
    const { handle, displayName, bio, phoneNumber } = parsed.data;
    const profileArgs: Parameters<typeof setupSocialProfile>[1] = {
      profileId: auth.userId,
      handle,
      tenantId,
      ...(displayName !== undefined ? { displayName } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(phoneNumber !== undefined ? { phoneNumber } : {}),
    };
    const profile = await setupSocialProfile(db, profileArgs);
    return c.json({ profile }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('HANDLE_TAKEN')) return c.json({ error: msg }, 409);
    return c.json({ error: msg }, 400);
  }
});

// ---------------------------------------------------------------------------
// POST /social/follow/:id — auth required (T3: tenant from JWT)
// ---------------------------------------------------------------------------

socialRoutes.post('/follow/:id', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const { id: followeeId } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  try {
    const follow = await followProfile(db, {
      followerId: auth.userId,
      followeeId,
      tenantId,
    });
    return c.json({ follow }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('SELF_FOLLOW')) return c.json({ error: msg }, 400);
    return c.json({ error: msg }, 400);
  }
});

// ---------------------------------------------------------------------------
// GET /social/feed — auth required (T3: tenant from JWT)
// ---------------------------------------------------------------------------

socialRoutes.get('/feed', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const limit = parseInt(c.req.query('limit') ?? '20', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const db = c.env.DB as unknown as D1Like;

  const posts = await getUserFeed(db, auth.userId, { tenantId, limit, offset });
  return c.json({ posts });
});

// ---------------------------------------------------------------------------
// POST /social/posts — auth required (T3: tenant from JWT)
// ---------------------------------------------------------------------------

socialRoutes.post('/posts', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    content: z.string().min(1, 'content must not be empty'),
    mediaUrls: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }

  const db = c.env.DB as unknown as D1Like;

  const post = await createPost(db, {
    authorId: auth.userId,
    content: parsed.data.content,
    ...(parsed.data.mediaUrls !== undefined ? { mediaUrls: parsed.data.mediaUrls } : {}),
    tenantId,
  });
  return c.json({ post }, 201);
});

// ---------------------------------------------------------------------------
// POST /social/posts/:id/react — auth required (T3: tenant from JWT)
// ---------------------------------------------------------------------------

socialRoutes.post('/posts/:id/react', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    type: z.enum(['like', 'love', 'laugh', 'wow', 'sad', 'angry']),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }

  const { id: postId } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  const reaction = await reactToPost(db, {
    postId,
    userId: auth.userId,
    reactionType: parsed.data.type,
    tenantId,
  });
  return c.json({ reaction }, 201);
});

// ---------------------------------------------------------------------------
// GET /social/dm/threads — auth required (T3: tenant from JWT)
// ---------------------------------------------------------------------------

socialRoutes.get('/dm/threads', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const db = c.env.DB as unknown as D1Like;

  const threads = await getDMThreads(db, auth.userId, tenantId);
  return c.json({ threads });
});

// ---------------------------------------------------------------------------
// POST /social/dm/threads — auth required (T3: tenant from JWT)
// ---------------------------------------------------------------------------

socialRoutes.post('/dm/threads', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    participantIds: z.array(z.string()).min(1, 'At least 1 other participant required'),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }

  const allParticipants = Array.from(
    new Set([auth.userId, ...parsed.data.participantIds]),
  );

  const db = c.env.DB as unknown as D1Like;

  try {
    const thread = await createDMThread(db, { participantIds: allParticipants, tenantId });
    return c.json({ thread }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: msg }, 400);
  }
});

// ---------------------------------------------------------------------------
// POST /social/dm/threads/:id/messages — auth required (P14, T3: tenant from JWT)
// ---------------------------------------------------------------------------

socialRoutes.post('/dm/threads/:id/messages', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const masterKey = c.env.DM_MASTER_KEY;
  assertDMMasterKey(masterKey);

  const body = await c.req.json().catch(() => null);
  const schema = z.object({ content: z.string().min(1) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }

  const { id: threadId } = c.req.param();
  const db = c.env.DB as unknown as D1Like;

  const message = await sendDM(db, {
    threadId,
    senderId: auth.userId,
    content: parsed.data.content,
    masterKey,
    tenantId,
  });
  return c.json({ message }, 201);
});

// ---------------------------------------------------------------------------
// GET /social/stories — auth required (T3: tenant from JWT)
// ---------------------------------------------------------------------------

socialRoutes.get('/stories', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const tenantId = auth.tenantId;

  const db = c.env.DB as unknown as D1Like;
  const stories = await getActiveStories(db, tenantId);
  return c.json({ stories });
});
