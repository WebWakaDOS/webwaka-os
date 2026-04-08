/**
 * Tests for POS + float ledger routes (M7b)
 * Platform Invariants P9 + T3 + T4 — integer kobo, tenant isolation.
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { posRoutes } from './pos.js';
import type { AuthContext } from '@webwaka/types';

function makeApp(dbOverride?: object): Hono {
  const app = new Hono();

  const walletRow = { id: 'wlt_001' };
  const defaultDB = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: <T>() => {
          if (sql.includes('agent_wallets') && !sql.includes('float_ledger')) {
            if (sql.includes('balance_kobo')) {
              return Promise.resolve({
                id: 'wlt_001',
                agent_id: 'agt_001',
                balance_kobo: 50_000,
                credit_limit_kobo: 0,
              } as T);
            }
            return Promise.resolve(walletRow as T);
          }
          if (sql.includes('float_ledger')) {
            return Promise.resolve({ wallet_id: 'wlt_001', amount_kobo: 5_000 } as T);
          }
          return Promise.resolve(null as T);
        },
        run: () => Promise.resolve({ success: true }),
        all: <T>() => Promise.resolve({ results: [] as T[] }),
      }),
    })),
    batch: vi.fn().mockResolvedValue([{ success: true }, { success: true }]),
  };

  app.use('*', async (c, next) => {
    c.set('auth', {
      userId: 'usr_test_001',
      tenantId: 'tenant_001',
      workspaceId: 'wsp_001',
      role: 'agent',
      permissions: [],
    } as unknown as AuthContext);
    c.env = { DB: dbOverride ?? defaultDB } as never;
    await next();
  });

  app.route('/pos', posRoutes);
  return app;
}

describe('POST /pos/terminals', () => {
  it('registers a terminal and returns 201 with terminalId', async () => {
    const app = makeApp();
    const res = await app.request('/pos/terminals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agt_001',
        workspaceId: 'wsp_001',
        terminalRef: 'VX520-ABC123',
        model: 'Verifone VX520',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body['terminalRef']).toBe('VX520-ABC123');
  });

  it('returns 400 for missing terminalRef', async () => {
    const app = makeApp();
    const res = await app.request('/pos/terminals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'agt_001', workspaceId: 'wsp_001' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /pos/float/balance', () => {
  it('returns balance in kobo (integer, P9/T4)', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/balance?agentId=agt_001');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Number.isInteger(body['balanceKobo'])).toBe(true);
    expect(body['balanceKobo']).toBe(50_000);
  });

  it('returns 400 when agentId is missing', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/balance');
    expect(res.status).toBe(400);
  });

  it('returns 404 when wallet not found', async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: (..._args: unknown[]) => ({
          first: <T>() => Promise.resolve(null as T),
          run: () => Promise.resolve({ success: true }),
          all: <T>() => Promise.resolve({ results: [] as T[] }),
        }),
      }),
      batch: vi.fn(),
    };
    const app = makeApp(db);
    const res = await app.request('/pos/float/balance?agentId=agt_notfound');
    expect(res.status).toBe(404);
  });
});

describe('POST /pos/float/credit', () => {
  it('credits the wallet and returns 201 with ledgerId', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agt_001',
        amountKobo: 10_000,
        reference: 'topup_ref_001',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(Number.isInteger(body['runningBalanceKobo'])).toBe(true);
  });

  it('returns 400 for float amountKobo (P9 — must be integer)', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agt_001',
        amountKobo: 500.50, // NOT an integer — violates P9
        reference: 'ref_float',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative amountKobo (credit requires positive)', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agt_001',
        amountKobo: -5_000,
        reference: 'ref_neg',
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /pos/float/debit', () => {
  it('debits the wallet and returns 201', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/debit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agt_001',
        amountKobo: 5_000,
        reference: 'debit_ref_001',
      }),
    });
    expect(res.status).toBe(201);
  });

  it('returns 400 for non-integer amountKobo (P9)', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/debit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agt_001',
        amountKobo: 1000.01,
        reference: 'ref_float_debit',
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /pos/float/reverse', () => {
  it('reverses a ledger entry and returns 201', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/reverse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalReference: 'topup_ref_001',
        reversalReference: 'reversal_ref_001',
        reason: 'duplicate charge',
      }),
    });
    expect(res.status).toBe(201);
  });

  it('returns 400 for missing required fields', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/reverse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalReference: 'ref_001' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /pos/float/history', () => {
  it('returns ledger entries array', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/history?walletId=wlt_001');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['entries'])).toBe(true);
  });

  it('returns 400 when walletId is missing', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/history');
    expect(res.status).toBe(400);
  });

  it('returns 404 when wallet not found or wrong tenant', async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: (..._args: unknown[]) => ({
          first: <T>() => Promise.resolve(null as T),
          run: () => Promise.resolve({ success: true }),
          all: <T>() => Promise.resolve({ results: [] as T[] }),
        }),
      }),
      batch: vi.fn(),
    };
    const app = makeApp(db);
    const res = await app.request('/pos/float/history?walletId=wlt_wrong');
    expect(res.status).toBe(404);
  });
});
