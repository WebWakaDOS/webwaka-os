/**
 * Tests for /social routes (M7c).
 *
 * Invariants under test:
 *   T3 — X-Tenant-Id required on all requests
 *   P14 — DM_MASTER_KEY required before DM send
 *   P15 — moderation applies before post insert
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { socialRoutes } from './social.js';
import type { AuthContext } from '@webwaka/types';

function makeApp(opts: { dbOverride?: object; dmKey?: string } = {}): Hono {
  const app = new Hono();

  const defaultDB = {
    prepare: vi.fn().mockImplementation((_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: <T>() => Promise.resolve(null as T),
        run: () => Promise.resolve({ success: true }),
        all: <T>() => Promise.resolve({ results: [] as T[] }),
      }),
    })),
  };

  app.use('*', async (c, next) => {
    c.set('auth', {
      userId: 'usr_test',
      tenantId: 'tenant-a',
      workspaceId: 'wsp_001',
      role: 'member',
      permissions: [],
    } as unknown as AuthContext);
    c.env = {
      DB: opts.dbOverride ?? defaultDB,
      DM_MASTER_KEY: opts.dmKey !== undefined ? opts.dmKey : 'valid-secret-master-key-32chars!!',
    } as never;
    await next();
  });

  app.route('/social', socialRoutes);
  return app;
}

function makeDBWithProfile(profile: object) {
  return {
    prepare: vi.fn().mockImplementation((_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: <T>() => Promise.resolve(profile as T),
        run: () => Promise.resolve({ success: true }),
        all: <T>() => Promise.resolve({ results: [] as T[] }),
      }),
    })),
  };
}

// ============================================================================
// GET /social/profile/:handle — T3
// ============================================================================

describe('GET /social/profile/:handle', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/profile/amaka');
    expect(res.status).toBe(400);
  });

  it('returns 404 when profile not found', async () => {
    const app = makeApp();
    const res = await app.request('/social/profile/nobody', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 with profile data when found (T3)', async () => {
    const profileRow = {
      id: 'sp_1', tenant_id: 'tenant-a', profile_id: 'u1', handle: 'amaka',
      display_name: 'Amaka', bio: null, phone_number: null, avatar_url: null,
      is_verified: 0, follower_count: 5, following_count: 3, created_at: 1000,
    };
    const app = makeApp({ dbOverride: makeDBWithProfile(profileRow) });
    const res = await app.request('/social/profile/amaka', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body['profile'] as Record<string, unknown>)['handle']).toBe('amaka');
  });
});

// ============================================================================
// POST /social/profile/setup
// ============================================================================

describe('POST /social/profile/setup', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/profile/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'newuser' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid handle format', async () => {
    const app = makeApp();
    const res = await app.request('/social/profile/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ handle: 'UPPERCASE_HANDLE' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 with profile for valid handle', async () => {
    const app = makeApp();
    const res = await app.request('/social/profile/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ handle: 'amaka_ng' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body['profile']).toBeTruthy();
  });
});

// ============================================================================
// POST /social/follow/:id
// ============================================================================

describe('POST /social/follow/:id', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/follow/user-2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for SELF_FOLLOW (follower === followee)', async () => {
    const app = makeApp();
    const res = await app.request('/social/follow/usr_test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toContain('SELF_FOLLOW');
  });

  it('returns 201 for successful follow', async () => {
    const app = makeApp();
    const res = await app.request('/social/follow/other-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(201);
  });
});

// ============================================================================
// GET /social/feed — T3
// ============================================================================

describe('GET /social/feed', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/feed');
    expect(res.status).toBe(400);
  });

  it('returns 200 with empty posts array', async () => {
    const app = makeApp();
    const res = await app.request('/social/feed', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['posts'])).toBe(true);
  });
});

// ============================================================================
// POST /social/posts — P15
// ============================================================================

describe('POST /social/posts (P15)', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello!' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is empty', async () => {
    const app = makeApp();
    const res = await app.request('/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ content: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 with post for valid content', async () => {
    const app = makeApp();
    const res = await app.request('/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ content: 'Building WebWaka OS for Nigeria!' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body['post']).toBeTruthy();
  });

  it('returns auto_hide for spam content (P15)', async () => {
    const app = makeApp();
    const res = await app.request('/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ content: 'buy cheap watches click now follow me' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect((body['post'] as Record<string, unknown>)['moderationStatus']).toBe('auto_hide');
  });
});

// ============================================================================
// POST /social/posts/:id/react
// ============================================================================

describe('POST /social/posts/:id/react', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/posts/post_1/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'like' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid reaction type', async () => {
    const app = makeApp();
    const res = await app.request('/social/posts/post_1/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ type: 'dislike' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 for valid reaction type', async () => {
    const app = makeApp();
    const res = await app.request('/social/posts/post_1/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ type: 'love' }),
    });
    expect(res.status).toBe(201);
  });
});

// ============================================================================
// GET /social/dm/threads — T3
// ============================================================================

describe('GET /social/dm/threads', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/dm/threads');
    expect(res.status).toBe(400);
  });

  it('returns 200 with empty threads array', async () => {
    const app = makeApp();
    const res = await app.request('/social/dm/threads', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['threads'])).toBe(true);
  });
});

// ============================================================================
// POST /social/dm/threads
// ============================================================================

describe('POST /social/dm/threads', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/dm/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantIds: ['usr_test', 'user-2'] }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 with thread for valid participants', async () => {
    const app = makeApp();
    const res = await app.request('/social/dm/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ participantIds: ['user-2'] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body['thread']).toBeTruthy();
  });
});

// ============================================================================
// POST /social/dm/threads/:id/messages — P14
// ============================================================================

describe('POST /social/dm/threads/:id/messages (P14)', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/dm/threads/dmt_1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello!' }),
    });
    expect(res.status).toBe(400);
  });

  it('throws P14_VIOLATION when DM_MASTER_KEY is empty (P14)', async () => {
    const app = makeApp({ dmKey: '' });
    const res = await app.request('/social/dm/threads/dmt_1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ content: 'Secret message' }),
    });
    expect(res.status).toBe(500);
  });

  it('returns 201 with encrypted message for valid key (P14)', async () => {
    const app = makeApp({ dmKey: 'valid-secret-master-key-32chars!!' });
    const res = await app.request('/social/dm/threads/dmt_1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ content: 'Hello there!' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    const message = body['message'] as Record<string, unknown>;
    expect(message['encryptedContent']).not.toBe('Hello there!');
    expect(message['iv']).toBeTruthy();
  });
});

// ============================================================================
// GET /social/stories — T3
// ============================================================================

describe('GET /social/stories', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/social/stories');
    expect(res.status).toBe(400);
  });

  it('returns 200 with empty stories array', async () => {
    const app = makeApp();
    const res = await app.request('/social/stories', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['stories'])).toBe(true);
  });
});
