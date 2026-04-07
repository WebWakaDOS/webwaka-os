/**
 * Claim routes tests — Milestone 5
 * 15 tests covering all 4 claim routes.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { claimRoutes } from './claim.js';

// ---------------------------------------------------------------------------
// D1 mock infrastructure
// ---------------------------------------------------------------------------

interface D1Stmt {
  bind(...args: unknown[]): D1Stmt;
  run(): Promise<{ success: boolean }>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

type SqlHandler = (sql: string, ...args: unknown[]) => Promise<unknown>;

/**
 * Build a D1 mock that matches queries by SQL substring.
 * Provide handlers keyed by a substring that appears in the SQL to match.
 */
function makeDb(handlers: Record<string, SqlHandler> = {}): { prepare: (q: string) => D1Stmt } {
  const resolve = (sql: string): SqlHandler | null => {
    for (const [key, fn] of Object.entries(handlers)) {
      if (sql.includes(key)) return fn;
    }
    return null;
  };

  const stmtFor = (sql: string): D1Stmt => {
    const args: unknown[] = [];
    const stmt: D1Stmt = {
      bind: (...a: unknown[]) => { args.push(...a); return stmt; },
      // eslint-disable-next-line @typescript-eslint/require-await
      run: async () => ({ success: true }),
      first: async <T>() => {
        const fn = resolve(sql);
        return fn ? (await fn(sql, ...args)) as T : null;
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      all: async <T>() => ({ results: [] as T[] }),
    };
    return stmt;
  };

  return { prepare: (q: string) => stmtFor(q) };
}

// ---------------------------------------------------------------------------
// Test app factory — bypasses authMiddleware by injecting auth via middleware
// ---------------------------------------------------------------------------

function makeApp(db: ReturnType<typeof makeDb>, role = 'admin') {
  const app = new Hono<{ Bindings: { DB: unknown; JWT_SECRET: string; ENVIRONMENT: string } }>();

  app.use('*', async (c, next) => {
    c.set('auth' as never, {
      userId: 'usr_test',
      tenantId: 'tnt_test',
      role,
      workspaceId: 'wsp_test',
    } as never);
    c.env = { DB: db, JWT_SECRET: 'test', ENVIRONMENT: 'development' } as never;
    await next();
  });

  app.route('/claim', claimRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// GET /claim/status/:profileId — Public
// ---------------------------------------------------------------------------

describe('GET /claim/status/:profileId', () => {
  it('returns 404 for unknown profile', async () => {
    const app = makeApp(makeDb());
    const res = await app.request('/claim/status/prof_unknown');
    expect(res.status).toBe(404);
  });

  it('returns claim state and null pendingRequest for unclaimed profile', async () => {
    const db = makeDb({
      'FROM profiles WHERE id': () => ({ id: 'prof_abc', claim_state: 'seeded' }),
    });
    const app = makeApp(db);
    const res = await app.request('/claim/status/prof_abc');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.claimState).toBe('seeded');
    expect(json.pendingRequest).toBeNull();
  });

  it('returns checklist in response', async () => {
    const db = makeDb({
      'FROM profiles WHERE id': () => ({ id: 'prof_abc', claim_state: 'claimable' }),
    });
    const app = makeApp(db);
    const res = await app.request('/claim/status/prof_abc');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.checklist).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(Array.isArray((json as Record<string, unknown> & { checklist?: { items: unknown[] } }).checklist?.items)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /claim/intent — Auth required (bypassed in test via middleware)
// ---------------------------------------------------------------------------

describe('POST /claim/intent', () => {
  it('returns 400 if profileId is missing', async () => {
    const app = makeApp(makeDb());
    const res = await app.request('/claim/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown profile', async () => {
    const app = makeApp(makeDb());
    const res = await app.request('/claim/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: 'prof_none' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 when profile is already managed', async () => {
    const db = makeDb({
      'FROM profiles WHERE id': () => ({ id: 'prof_m', claim_state: 'managed' }),
    });
    const app = makeApp(db);
    const res = await app.request('/claim/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: 'prof_m' }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 409 when pending claim request exists', async () => {
    let callCount = 0;
    const db = makeDb({
      'FROM profiles WHERE id': () => {
        callCount++;
        if (callCount === 1) return { id: 'prof_c', claim_state: 'claimable' };
        return null;
      },
      "status = 'pending'": () => ({ id: 'clm_existing' }),
    });
    const app = makeApp(db);
    const res = await app.request('/claim/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: 'prof_c' }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid verificationMethod', async () => {
    const db = makeDb({
      'FROM profiles WHERE id': () => ({ id: 'prof_s', claim_state: 'seeded' }),
    });
    const app = makeApp(db);
    const res = await app.request('/claim/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: 'prof_s', verificationMethod: 'carrier_pigeon' }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /claim/advance — Admin only
// ---------------------------------------------------------------------------

describe('POST /claim/advance', () => {
  it('returns 403 for non-admin role', async () => {
    const app = makeApp(makeDb(), 'member');
    const res = await app.request('/claim/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimRequestId: 'clm_1', action: 'approve' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 if claimRequestId or action is missing', async () => {
    const app = makeApp(makeDb());
    const res = await app.request('/claim/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimRequestId: 'clm_1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action', async () => {
    const app = makeApp(makeDb());
    const res = await app.request('/claim/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimRequestId: 'clm_1', action: 'maybe' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown claim request', async () => {
    const app = makeApp(makeDb());
    const res = await app.request('/claim/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimRequestId: 'clm_none', action: 'approve' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 when claim is already approved', async () => {
    const db = makeDb({
      'claim_requests cr': () => ({
        id: 'clm_done',
        profile_id: 'prof_1',
        status: 'approved',
        claim_state: 'verified',
      }),
    });
    const app = makeApp(db);
    const res = await app.request('/claim/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimRequestId: 'clm_done', action: 'approve' }),
    });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// POST /claim/verify
// ---------------------------------------------------------------------------

describe('POST /claim/verify', () => {
  it('returns 400 if claimRequestId or token missing', async () => {
    const app = makeApp(makeDb());
    const res = await app.request('/claim/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimRequestId: 'clm_1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown claim request', async () => {
    const app = makeApp(makeDb());
    const res = await app.request('/claim/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimRequestId: 'clm_none', token: 'tok123' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 422 for invalid token', async () => {
    const validUntil = Math.floor(Date.now() / 1000) + 3600;
    const db = makeDb({
      'FROM claim_requests WHERE id': () => ({
        id: 'clm_1',
        profile_id: 'prof_1',
        status: 'pending',
        verification_method: 'email',
        verification_data: JSON.stringify({ token: 'correct-token', expiresAt: validUntil }),
        expires_at: validUntil + 100,
      }),
    });
    const app = makeApp(db);
    const res = await app.request('/claim/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimRequestId: 'clm_1', token: 'wrong-token' }),
    });
    expect(res.status).toBe(422);
  });
});
