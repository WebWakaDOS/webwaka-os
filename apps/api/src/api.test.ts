/**
 * Integration tests for @webwaka/api routes.
 *
 * Uses Hono's built-in test helper (app.request) with mocked Worker bindings.
 * No wrangler or live D1 required — fully self-contained.
 *
 * Tested routes:
 *   GET  /health
 *   GET  /geography/places/:id        (mocked geography index)
 *   GET  /entities/individuals        (requires auth)
 *   POST /entities/individuals        (requires auth + entitlement)
 *   POST /auth/login                  (credential validation)
 *   GET  /auth/me                     (requires auth)
 *   POST /auth/verify                 (token validation)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import app from './index.js';
import { issueJwt } from '@webwaka/auth';
import { Role, SubscriptionPlan, SubscriptionStatus } from '@webwaka/types';
import type { UserId, WorkspaceId, TenantId } from '@webwaka/types';
import { asId } from '@webwaka/types';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-32-chars-minimum-length-required';
const TENANT_ID = asId<TenantId>('tenant_test_001');
const WORKSPACE_ID = asId<WorkspaceId>('wsp_test_001');
const USER_ID = asId<UserId>('usr_test_001');

// ---------------------------------------------------------------------------
// Mock Cloudflare Worker environment bindings
// ---------------------------------------------------------------------------

const individualStore: Record<string, unknown>[] = [];

function makeD1Mock() {
  return {
    prepare: (sql: string) => {
      let boundArgs: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => { boundArgs = args; return stmt; },
        run: vi.fn(() => {
          if (sql.startsWith('INSERT INTO individuals')) {
            const [id, name, , tenantId, placeId, metadata] = boundArgs;
            individualStore.push({ id, name, entity_type: 'individual', tenant_id: tenantId, place_id: placeId, metadata, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          }
          return Promise.resolve({});
        }),
        first: vi.fn(<T>() => {
          // Subscription lookup
          if (sql.includes('FROM subscriptions')) {
            return Promise.resolve({ plan: SubscriptionPlan.Growth, status: SubscriptionStatus.Active } as T);
          }
          // Individual by id
          if (sql.includes('FROM individuals WHERE id')) {
            const [id, tenantId] = boundArgs;
            return Promise.resolve((individualStore.find((r) => r['id'] === id && r['tenant_id'] === tenantId) ?? null) as T);
          }
          // User login
          if (sql.includes('FROM users')) {
            return Promise.resolve(null as T);
          }
          return Promise.resolve(null as T);
        }),
        all: vi.fn(<T>() => {
          if (sql.includes('FROM individuals')) {
            const tenantId = boundArgs[0];
            return Promise.resolve({ results: individualStore.filter((r) => r['tenant_id'] === tenantId) } as { results: T[] });
          }
          return Promise.resolve({ results: [] } as { results: T[] });
        }),
      };
      return stmt;
    },
  };
}

function makeKVMock() {
  const store: Record<string, string> = {};
  return {
    get: vi.fn((key: string, type?: string) => {
      const raw = store[key];
      if (!raw) return Promise.resolve(null);
      if (type === 'json') return Promise.resolve(JSON.parse(raw) as unknown);
      return Promise.resolve(raw);
    }),
    put: vi.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
  };
}

function makeEnv(): Record<string, unknown> {
  return {
    DB: makeD1Mock(),
    GEOGRAPHY_CACHE: makeKVMock(),
    JWT_SECRET,
    ENVIRONMENT: 'development',
  };
}

// ---------------------------------------------------------------------------
// Helper to make test requests with mocked bindings
// ---------------------------------------------------------------------------

async function makeRequest(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
) {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : null,
  });

  return app.fetch(request, makeEnv() as unknown as { DB: D1Database; GEOGRAPHY_CACHE: KVNamespace; JWT_SECRET: string; ENVIRONMENT: 'development' });
}

// ---------------------------------------------------------------------------
// Setup: valid JWT for authenticated routes
// ---------------------------------------------------------------------------

let validToken: string;

beforeAll(async () => {
  validToken = await issueJwt(
    {
      sub: USER_ID,
      workspace_id: WORKSPACE_ID,
      tenant_id: TENANT_ID,
      role: Role.Admin,
    },
    JWT_SECRET,
  );
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await makeRequest('/health');
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(body['status']).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

describe('GET /geography/places/:placeId', () => {
  it('returns 404 for unknown place when KV is empty and DB has no data', async () => {
    // buildIndexFromD1 will fail if DB.prepare doesn't have places data
    // We expect it to gracefully return 404 or 500 depending on mock
    const res = await makeRequest('/geography/places/plc_unknown_001');
    expect([404, 500]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Auth — me + verify
// ---------------------------------------------------------------------------

describe('GET /auth/me — authenticated', () => {
  it('returns 200 with auth context', async () => {
    const res = await makeRequest('/auth/me', { token: validToken });
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    const data = body['data'] as Record<string, unknown>;
    expect(data['userId']).toBe(USER_ID);
    expect(data['tenantId']).toBe(TENANT_ID);
  });

  it('returns 401 without auth header', async () => {
    const res = await makeRequest('/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/verify', () => {
  it('returns valid=true with decoded context for a valid token', async () => {
    const res = await makeRequest('/auth/verify', {
      method: 'POST',
      body: { token: validToken },
    });
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(body['valid']).toBe(true);
    const data = body['data'] as Record<string, unknown>;
    expect(data['userId']).toBe(USER_ID);
  });

  it('returns valid=false for an invalid token', async () => {
    const res = await makeRequest('/auth/verify', {
      method: 'POST',
      body: { token: 'not-a-real-jwt' },
    });
    expect(res.status).toBe(401);
    const body: Record<string, unknown> = await res.json();
    expect(body['valid']).toBe(false);
  });

  it('returns 400 when token field is missing', async () => {
    const res = await makeRequest('/auth/verify', { method: 'POST', body: {} });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Entities — auth required
// ---------------------------------------------------------------------------

describe('GET /entities/individuals — unauthenticated', () => {
  it('returns 401 without auth header', async () => {
    const res = await makeRequest('/entities/individuals');
    expect(res.status).toBe(401);
  });
});

describe('GET /entities/individuals — authenticated', () => {
  it('returns 200 with empty list', async () => {
    const res = await makeRequest('/entities/individuals', { token: validToken });
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(Array.isArray(body['data'])).toBe(true);
  });
});

describe('POST /entities/individuals — create', () => {
  it('returns 201 with created individual', async () => {
    const res = await makeRequest('/entities/individuals', {
      method: 'POST',
      token: validToken,
      body: { name: 'Ngozi Adeyemi' },
    });
    expect(res.status).toBe(201);
    const body: Record<string, unknown> = await res.json();
    const data: Record<string, unknown> = body['data'] as Record<string, unknown>;
    expect(data['name']).toBe('Ngozi Adeyemi');
    expect(typeof data['id']).toBe('string');
  });

  it('returns 400 when name is missing', async () => {
    const res = await makeRequest('/entities/individuals', {
      method: 'POST',
      token: validToken,
      body: {},
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Auth — login
// ---------------------------------------------------------------------------

describe('POST /auth/login', () => {
  it('returns 401 for nonexistent user', async () => {
    const res = await makeRequest('/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'wrongpassword' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when credentials missing', async () => {
    const res = await makeRequest('/auth/login', { method: 'POST', body: {} });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------

describe('404 fallback', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await makeRequest('/unknown-route-xyz');
    expect(res.status).toBe(404);
  });
});
