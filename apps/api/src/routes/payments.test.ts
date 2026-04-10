/**
 * Payment routes tests.
 *
 * Covers:
 *   - Auth enforcement (401 without JWT)
 *   - T1: Workspace ownership enforcement (403 on mismatch)
 *   - W1: Webhook signature validation (401 on bad/missing signature)
 *   - T3: Billing history scoped to caller's workspace
 *   - Input validation (422, 400)
 *   - PAYSTACK_SECRET_KEY absent (503)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../index.js';
import type { Env } from '../env.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-jwt-secret-minimum-32-characters!';

/** Build a HS256 JWT via Web Crypto (no external deps — matches production jwt.ts). */
async function makeJwt(workspaceId: string, tenantId = 'tnt_001'): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = btoa(JSON.stringify({
    sub: 'usr_001',
    workspace_id: workspaceId,
    tenant_id: tenantId,
    role: 'owner',
    iat: now - 10,
    exp: now + 3600,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${signingInput}.${signature}`;
}

/** Compute the HMAC-SHA512 signature Paystack would send. */
async function paystackSig(body: string, secretKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Test DB factory
// ---------------------------------------------------------------------------

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        run: async () => ({ success: true }),
        first: async <T>(): Promise<T | null> => {
          if (sql.includes('billing_history') && overrides['billing']) {
            return overrides['billing'] as T;
          }
          if (sql.includes('subscriptions') && overrides['subscription']) {
            return overrides['subscription'] as T;
          }
          return null;
        },
        all: async <T>() => {
          if (sql.includes('billing_history') && overrides['billingList']) {
            return { results: overrides['billingList'] as T[] };
          }
          return { results: [] as T[] };
        },
      }),
      run: async () => ({ success: true }),
      first: async <T>(): Promise<T | null> => null,
      all: async <T>() => ({ results: [] as T[] }),
    }),
  };
}

const stubKV = {
  get: async (_key: string) => null,
  put: async (_key: string, _value: string, _opts?: unknown) => undefined,
} as unknown as KVNamespace;

function makeEnv(extras: Partial<Env> = {}): Env {
  return {
    DB: makeDb() as unknown as D1Database,
    GEOGRAPHY_CACHE: stubKV,
    RATE_LIMIT_KV: stubKV,
    JWT_SECRET,
    ENVIRONMENT: 'development',
    PAYSTACK_SECRET_KEY: 'sk_test_fake_key',
    PREMBLY_API_KEY: 'prembly_test_key',
    TERMII_API_KEY: 'termii_test_key',
    WHATSAPP_ACCESS_TOKEN: 'wa_test_token',
    WHATSAPP_PHONE_NUMBER_ID: 'wa_phone_id',
    TELEGRAM_BOT_TOKEN: 'tg_test_token',
    LOG_PII_SALT: 'test-pii-salt-32-chars-minimum!!',
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// POST /workspaces/:id/upgrade
// ---------------------------------------------------------------------------

describe('POST /workspaces/:id/upgrade', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns 401 without auth header', async () => {
    const req = new Request('http://localhost/workspaces/wsp_001/upgrade', {
      method: 'POST',
      body: JSON.stringify({ plan: 'starter', email: 'user@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated workspace does not match URL param (T1)', async () => {
    const token = await makeJwt('wsp_OTHER'); // JWT is for wsp_OTHER, not wsp_001
    const res = await app.fetch(
      new Request('http://localhost/workspaces/wsp_001/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan: 'starter', email: 'u@e.com' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/workspace mismatch/i);
  });

  it('returns 503 when PAYSTACK_SECRET_KEY is absent', async () => {
    const token = await makeJwt('wsp_001');
    const res = await app.fetch(
      new Request('http://localhost/workspaces/wsp_001/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan: 'starter', email: 'u@e.com' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }),
      makeEnv({ PAYSTACK_SECRET_KEY: '' as unknown as string }),
    );
    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// POST /payments/verify
// ---------------------------------------------------------------------------

describe('POST /payments/verify', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns 401 without auth header', async () => {
    const req = new Request('http://localhost/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ reference: 'ref_abc', workspaceId: 'wsp_001' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 401 when x-paystack-signature is missing (W1)', async () => {
    const token = await makeJwt('wsp_001');
    const res = await app.fetch(
      new Request('http://localhost/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ reference: 'ref_abc', workspaceId: 'wsp_001' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          // x-paystack-signature intentionally omitted
        },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/signature/i);
  });

  it('returns 401 when x-paystack-signature is invalid (W1)', async () => {
    const token = await makeJwt('wsp_001');
    const res = await app.fetch(
      new Request('http://localhost/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ reference: 'ref_abc', workspaceId: 'wsp_001' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-paystack-signature': 'totally_wrong_signature',
        },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when workspaceId in body does not match JWT workspace (T1)', async () => {
    const secretKey = 'sk_test_fake_key';
    const payload = JSON.stringify({ reference: 'ref_abc', workspaceId: 'wsp_DIFFERENT' });
    const signature = await paystackSig(payload, secretKey);

    const token = await makeJwt('wsp_001'); // JWT is for wsp_001, body says wsp_DIFFERENT
    const res = await app.fetch(
      new Request('http://localhost/payments/verify', {
        method: 'POST',
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-paystack-signature': signature,
        },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/workspace mismatch/i);
  });

  it('returns 422 when reference or workspaceId missing (after valid signature)', async () => {
    const secretKey = 'sk_test_fake_key';
    const payload = JSON.stringify({});
    const signature = await paystackSig(payload, secretKey);

    const token = await makeJwt('wsp_001');
    const res = await app.fetch(
      new Request('http://localhost/payments/verify', {
        method: 'POST',
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-paystack-signature': signature,
        },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// GET /workspaces/:id/billing
// ---------------------------------------------------------------------------

describe('GET /workspaces/:id/billing', () => {
  it('returns 401 without auth', async () => {
    const req = new Request('http://localhost/workspaces/wsp_001/billing');
    const res = await app.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated workspace does not match URL param (T3)', async () => {
    const token = await makeJwt('wsp_OTHER');
    const res = await app.fetch(
      new Request('http://localhost/workspaces/wsp_001/billing', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/workspace mismatch/i);
  });

  it('returns 200 with billing records for matching workspace', async () => {
    const token = await makeJwt('wsp_001');
    const billingList = [
      {
        id: 'bil_001',
        workspace_id: 'wsp_001',
        paystack_ref: 'ref_abc',
        amount_kobo: 500000,
        status: 'success',
        metadata: '{"plan":"starter"}',
        created_at: '2026-04-07 12:00:00',
      },
    ];
    const res = await app.fetch(
      new Request('http://localhost/workspaces/wsp_001/billing', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      makeEnv({ DB: makeDb({ billingList }) as unknown as D1Database }),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { workspaceId: string; records: unknown[]; total: number };
    expect(body.workspaceId).toBe('wsp_001');
    expect(body.total).toBe(1);
  });
});
