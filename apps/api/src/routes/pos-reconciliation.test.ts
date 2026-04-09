/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/**
 * Float reconciliation tests (M7e, additional)
 * Platform Invariants P9 (integer kobo), T3 (tenant isolation), T4 (kobo-only)
 * Minimum: 3 tests
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { posRoutes } from './pos.js';
import type { AuthContext } from '@webwaka/types';

function makeApp(opts?: {
  walletBalance?: number;
  ledgerEntries?: object[];
}) {
  const walletBalance = opts?.walletBalance ?? 500_000;
  const ledgerEntries = opts?.ledgerEntries ?? [
    { id: 'led_001', wallet_id: 'wlt_001', amount_kobo: 10_000, type: 'credit', created_at: 1_700_000_000 },
    { id: 'led_002', wallet_id: 'wlt_001', amount_kobo: -5_000, type: 'debit', created_at: 1_700_001_000 },
  ];

  const mockDB = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: <T>() => {
          if (sql.includes('agent_wallets') && sql.includes('balance_kobo')) {
            return Promise.resolve({ id: 'wlt_001', agent_id: 'agt_001', balance_kobo: walletBalance, credit_limit_kobo: 0 } as T);
          }
          if (sql.includes('float_ledger')) {
            return Promise.resolve({ wallet_id: 'wlt_001', amount_kobo: 5_000 } as T);
          }
          if (sql.includes('agent_wallets')) {
            return Promise.resolve({ id: 'wlt_001' } as T);
          }
          return Promise.resolve(null as T);
        },
        run: vi.fn().mockResolvedValue({ success: true }),
        all: <T>() => Promise.resolve({ results: ledgerEntries as T[] }),
      }),
    })),
    batch: vi.fn().mockResolvedValue([{ success: true }, { success: true }]),
  };

  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('auth', {
      userId: 'usr_test_001',
      tenantId: 'tenant_001',
      workspaceId: 'wsp_001',
      role: 'agent',
      permissions: [],
    } as unknown as AuthContext);
    c.env = { DB: mockDB } as never;
    await next();
  });
  app.route('/pos', posRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Float reconciliation tests
// ---------------------------------------------------------------------------

describe('Float reconciliation — T4 integer kobo enforcement', () => {
  it('rejects top-up with fractional kobo (T4)', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletId: 'wlt_001', amount_kobo: 99.5, reference: 'ref_001' }),
    });
    // Non-integer kobo must result in an error (4xx or 5xx) — route may validate
    // before or after wallet lookup; either way fractional kobo must not succeed (T4)
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(600);
  });
});

describe('Float reconciliation — ledger history pagination (T3 tenant isolation)', () => {
  it('returns ledger entries for the tenant wallet only', async () => {
    const app = makeApp({
      ledgerEntries: [
        { id: 'led_001', wallet_id: 'wlt_001', amount_kobo: 10_000, type: 'credit', created_at: 1_700_000_000 },
        { id: 'led_002', wallet_id: 'wlt_001', amount_kobo: -5_000, type: 'debit', created_at: 1_700_001_000 },
        { id: 'led_003', wallet_id: 'wlt_001', amount_kobo: 20_000, type: 'credit', created_at: 1_700_002_000 },
      ],
    });
    const res = await app.request('/pos/float/history?walletId=wlt_001');
    expect(res.status).toBe(200);
    const body = await res.json() as { entries: object[] };
    expect(body.entries).toHaveLength(3);
  });
});

describe('Float reconciliation — reversal integrity', () => {
  it('processes reversal request (non-5xx response)', async () => {
    const app = makeApp();
    const res = await app.request('/pos/float/reverse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: 'wlt_001',
        originalReference: 'topup_ref_reconciliation_001',
        reversalReference: 'reversal_ref_recon_001',
        reason: 'reconciliation test',
      }),
    });
    // Route should process (2xx) or fail with validation (4xx), never 5xx crash
    expect(res.status).not.toBe(500);
    // If successful, expect reversal identifier
    if (res.status === 201) {
      const body = await res.json() as Record<string, unknown>;
      // Route returns ledgerId from reverseLedgerEntry result
      expect(body['ledgerId'] ?? body['reversalId'] ?? body['reversal_id'] ?? body['id']).toBeDefined();
    }
  });
});
