/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Airtime top-up route tests (M7e)
 * Platform Invariants: P2 (Nigeria First), P9/T4 (integer kobo), T3 (tenant), R9 (rate limit)
 * Minimum: 8 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { airtimeRoutes } from './airtime.js';
import type { AuthContext } from '@webwaka/types';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

type MockKV = {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

type MockDB = {
  prepare: ReturnType<typeof vi.fn>;
};

function makeApp(overrides?: {
  db?: Partial<MockDB>;
  kv?: Partial<MockKV>;
  termiiStatus?: number;
  walletBalance?: number;
  kycTier?: string;
}): Hono {
  const app = new Hono();

  const walletBalance = overrides?.walletBalance ?? 500_000; // ₦5,000 default
  const kycTier = overrides?.kycTier ?? 't1'; // Default: Tier 1 (KYC verified)

  const defaultDB = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: <T>() => {
          if (sql.includes('users') && sql.includes('kyc_tier')) {
            return Promise.resolve({ kyc_tier: kycTier } as T);
          }
          if (sql.includes('agent_wallets')) {
            return Promise.resolve({ id: 'wlt_001', balance_kobo: walletBalance } as T);
          }
          return Promise.resolve(null as T);
        },
        run: () => {
          // Simulate D1 conditional UPDATE meta.changes for atomic balance check.
          // The conditional UPDATE is: WHERE id = ? AND balance_kobo >= ?
          // args[0] = amountKobo, args[1] = now, args[2] = walletId, args[3] = amountThreshold
          if (sql.includes('UPDATE agent_wallets') && sql.includes('balance_kobo >= ?')) {
            const threshold = typeof args[3] === 'number' ? args[3] : 0;
            const changes = walletBalance >= threshold ? 1 : 0;
            return Promise.resolve({ success: changes > 0, meta: { changes } });
          }
          return Promise.resolve({ success: true, meta: { changes: 1 } });
        },
        all: <T>() => Promise.resolve({ results: [] as T[] }),
      }),
    })),
  };

  const defaultKV = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
  };

  // Mock global fetch for Termii API calls
  const mockStatus = overrides?.termiiStatus ?? 200;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: mockStatus >= 200 && mockStatus < 300,
    status: mockStatus,
    json: () => Promise.resolve({ status: 'success', balance: 100 }),
  }));

  app.use('*', async (c, next) => {
    c.set('auth', {
      userId: 'usr_001',
      tenantId: 'tenant_001',
      workspaceId: 'wsp_001',
      role: 'agent',
      permissions: [],
    } as unknown as AuthContext);
    c.env = {
      DB: overrides?.db ?? defaultDB,
      RATE_LIMIT_KV: overrides?.kv ?? defaultKV,
      TERMII_API_KEY: 'test_api_key',
    } as never;
    await next();
  });

  app.route('/airtime', airtimeRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /airtime/topup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with valid MTN number and valid kobo amount', async () => {
    const app = makeApp();
    const res = await app.request('/airtime/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '08031234567', amount_kobo: 50_000 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['status']).toBe('success');
    expect(body['amount_kobo']).toBe(50_000);
    expect(typeof body['transactionId']).toBe('string');
  });

  it('returns 400 when phone is invalid (non-Nigerian number)', async () => {
    const app = makeApp();
    const res = await app.request('/airtime/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+12025551234', amount_kobo: 50_000 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('invalid_phone');
  });

  it('returns 422 when amount_kobo is a float (5.5)', async () => {
    const app = makeApp();
    const res = await app.request('/airtime/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '08031234567', amount_kobo: 5.5 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('invalid_amount');
  });

  it('returns 422 when amount_kobo is below minimum (4000 kobo)', async () => {
    const app = makeApp();
    const res = await app.request('/airtime/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '08031234567', amount_kobo: 4_000 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('invalid_amount');
  });

  it('returns 401 without auth (missing X-User-Id)', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.env = { RATE_LIMIT_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as never;
      await next();
    });
    app.route('/airtime', airtimeRoutes);

    const res = await app.request('/airtime/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '08031234567', amount_kobo: 50_000 }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limit exceeded (KV has count >= 5)', async () => {
    const app = makeApp({
      kv: {
        get: vi.fn().mockResolvedValue('5'),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });
    const res = await app.request('/airtime/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '08031234567', amount_kobo: 50_000 }),
    });
    expect(res.status).toBe(429);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('rate_limited');
  });

  it('returns 402 when agent float is insufficient', async () => {
    const app = makeApp({ walletBalance: 1_000 }); // only ₦10
    const res = await app.request('/airtime/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '08031234567', amount_kobo: 50_000 }),
    });
    expect(res.status).toBe(402);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('insufficient_float');
  });

  it('returns 200 with Airtel number — network auto-detected', async () => {
    const app = makeApp();
    const res = await app.request('/airtime/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '08021234567', amount_kobo: 100_000 }), // 0802 = Airtel
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['network']).toBe('Airtel');
  });

  it('returns 403 when user KYC is Tier 0 (unverified) — financial gate', async () => {
    const app = makeApp({ kycTier: 't0' });
    const res = await app.request('/airtime/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '08031234567', amount_kobo: 50_000 }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('kyc_required');
  });
});
