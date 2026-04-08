/**
 * Tests for /community routes (M7c).
 *
 * Invariants under test:
 *   T3 — X-Tenant-Id required on all requests
 *   T4 — integer kobo validation on event ticketPrice
 *   P10 — NDPR consent required for POST /join (403)
 *   P15 — moderation applies before post insert
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { communityRoutes } from './community.js';
import type { AuthContext } from '@webwaka/types';

function makeApp(dbOverride?: object): Hono {
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
      DB: dbOverride ?? defaultDB,
      DM_MASTER_KEY: 'test-master-key-32-chars-long!!',
    } as never;
    await next();
  });

  app.route('/community', communityRoutes);
  return app;
}

function makeDBWithSpace(space: object) {
  return {
    prepare: vi.fn().mockImplementation((_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: <T>() => Promise.resolve(space as T),
        run: () => Promise.resolve({ success: true }),
        all: <T>() => Promise.resolve({ results: [] as T[] }),
      }),
    })),
  };
}

// ============================================================================
// GET /community/:slug — T3
// ============================================================================

describe('GET /community/:slug', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/lagos-devs');
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toContain('X-Tenant-Id');
  });

  it('returns 404 when community not found', async () => {
    const app = makeApp();
    const res = await app.request('/community/nonexistent', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 with space data when found', async () => {
    const space = {
      id: 'cs_1', tenant_id: 'tenant-a', name: 'Lagos Devs', slug: 'lagos-devs',
      description: null, visibility: 'public', member_count: 0, created_at: 1000,
    };
    const app = makeApp(makeDBWithSpace(space));
    const res = await app.request('/community/lagos-devs', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body['space'] as Record<string, unknown>)['slug']).toBe('lagos-devs');
  });
});

// ============================================================================
// GET /community/:id/channels — T3
// ============================================================================

describe('GET /community/:id/channels', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/cs_1/channels');
    expect(res.status).toBe(400);
  });

  it('returns 200 with empty channels array', async () => {
    const app = makeApp();
    const res = await app.request('/community/cs_1/channels', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['channels'])).toBe(true);
  });
});

// ============================================================================
// GET /community/channels/:id/posts — T3
// ============================================================================

describe('GET /community/channels/:id/posts', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/channels/ch_1/posts');
    expect(res.status).toBe(400);
  });

  it('returns 200 with empty posts array', async () => {
    const app = makeApp();
    const res = await app.request('/community/channels/ch_1/posts', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['posts'])).toBe(true);
  });
});

// ============================================================================
// POST /community/channels/:id/posts — P15
// ============================================================================

describe('POST /community/channels/:id/posts (P15)', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/channels/ch_1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello world' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is empty', async () => {
    const app = makeApp();
    const res = await app.request('/community/channels/ch_1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ content: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 with post for valid content', async () => {
    const app = makeApp();
    const res = await app.request('/community/channels/ch_1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ content: 'Great discussion today!' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body['post']).toBeTruthy();
  });

  it('returns 201 with moderationStatus=auto_hide for spam content (P15)', async () => {
    const app = makeApp();
    const res = await app.request('/community/channels/ch_1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ content: 'buy cheap watches click now' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect((body['post'] as Record<string, unknown>)['moderationStatus']).toBe('auto_hide');
  });
});

// ============================================================================
// POST /community/join — P10
// ============================================================================

describe('POST /community/join (P10 — NDPR consent)', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communityId: 'cs_1', tierId: 'free' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 403 when NDPR consent is missing (P10)', async () => {
    const app = makeApp();
    const res = await app.request('/community/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ communityId: 'cs_1', tierId: 'free' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toContain('NDPR_CONSENT_REQUIRED');
  });

  it('returns 400 when communityId is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ tierId: 'free' }),
    });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// GET /community/lessons/:id — P6 (offline-cacheable)
// ============================================================================

describe('GET /community/lessons/:id (P6)', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/lessons/ls_1');
    expect(res.status).toBe(400);
  });

  it('returns 404 when lesson not found', async () => {
    const app = makeApp();
    const res = await app.request('/community/lessons/ls_999', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(404);
  });

  it('returns Cache-Control header for offline caching (P6)', async () => {
    const lessonRow = {
      id: 'ls_1', tenant_id: 'tenant-a', module_id: 'mod_1', title: 'Lesson 1',
      body: 'Content here', content_type: 'text', sort_order: 0, created_at: 1000,
    };
    const app = makeApp(makeDBWithSpace(lessonRow));
    const res = await app.request('/community/lessons/ls_1', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
  });
});

// ============================================================================
// POST /community/lessons/:id/progress
// ============================================================================

describe('POST /community/lessons/:id/progress', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/lessons/ls_1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressPct: 50 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when progressPct is a float', async () => {
    const app = makeApp();
    const res = await app.request('/community/lessons/ls_1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ progressPct: 50.5 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 with progress record for valid progressPct', async () => {
    const app = makeApp();
    const res = await app.request('/community/lessons/ls_1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ progressPct: 75 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['progress']).toBeTruthy();
  });
});

// ============================================================================
// GET /community/:id/events — T3
// ============================================================================

describe('GET /community/:id/events', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/cs_1/events');
    expect(res.status).toBe(400);
  });

  it('returns 200 with empty events array', async () => {
    const app = makeApp();
    const res = await app.request('/community/cs_1/events', {
      headers: { 'X-Tenant-Id': 'tenant-a' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['events'])).toBe(true);
  });
});

// ============================================================================
// POST /community/events/:id/rsvp
// ============================================================================

describe('POST /community/events/:id/rsvp', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    const app = makeApp();
    const res = await app.request('/community/events/ev_1/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    const app = makeApp();
    const res = await app.request('/community/events/ev_999/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: '{}',
    });
    expect(res.status).toBe(404);
  });

  it('returns 402 when event is paid (T4 + PAYMENT_REQUIRED)', async () => {
    const db = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: <T>() => Promise.resolve({ rsvp_count: 0, max_attendees: -1, ticket_price_kobo: 5000 } as T),
          run: () => Promise.resolve({ success: true }),
          all: <T>() => Promise.resolve({ results: [] as T[] }),
        }),
      })),
    };
    const app = makeApp(db);
    const res = await app.request('/community/events/ev_1/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: '{}',
    });
    expect(res.status).toBe(402);
  });

  it('returns 409 when event is full', async () => {
    const db = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: <T>() => Promise.resolve({ rsvp_count: 100, max_attendees: 100, ticket_price_kobo: 0 } as T),
          run: () => Promise.resolve({ success: true }),
          all: <T>() => Promise.resolve({ results: [] as T[] }),
        }),
      })),
    };
    const app = makeApp(db);
    const res = await app.request('/community/events/ev_1/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: '{}',
    });
    expect(res.status).toBe(409);
  });
});
