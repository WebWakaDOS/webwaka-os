/**
 * Tests for agent wallet management.
 * (Platform Invariants P9 + T3 + T4)
 */

import { describe, it, expect, vi } from 'vitest';
import { createAgentWallet, getWalletBalance } from './wallet.js';

type MockBind = {
  first: <T>() => Promise<T | null>;
  run: () => Promise<{ success: boolean }>;
  all: <T>() => Promise<{ results: T[] }>;
};

function makeDB(existingWallet?: { id: string; agent_id: string; balance_kobo: number; credit_limit_kobo: number } | null): {
  prepare: ReturnType<typeof vi.fn>;
} {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: (..._args: unknown[]): MockBind => ({
        first: <T>() => {
          if (sql.includes('agent_wallets') && existingWallet !== undefined) {
            return Promise.resolve(existingWallet as T);
          }
          return Promise.resolve(null);
        },
        run: () => Promise.resolve({ success: true }),
        all: <T>() => Promise.resolve({ results: [] as T[] }),
      }),
    })),
  };
}

describe('createAgentWallet', () => {
  it('returns existing walletId when wallet already exists', async () => {
    const db = makeDB({ id: 'wlt_existing', agent_id: 'agt_001', balance_kobo: 5_000, credit_limit_kobo: 0 });
    const result = await createAgentWallet(db, 'agt_001', 'tenant_01');
    expect(result.walletId).toBe('wlt_existing');
    // Should not INSERT since wallet already exists
    const insertCalls = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => String(c[0]).trim().toUpperCase().startsWith('INSERT'),
    );
    expect(insertCalls).toHaveLength(0);
  });

  it('creates a new wallet when none exists', async () => {
    const db = makeDB(null);
    const result = await createAgentWallet(db, 'agt_002', 'tenant_01');
    expect(result.walletId).toMatch(/^wlt_/);
    const insertCalls = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => String(c[0]).trim().toUpperCase().startsWith('INSERT'),
    );
    expect(insertCalls.length).toBeGreaterThan(0);
  });
});

describe('getWalletBalance', () => {
  it('returns balance in kobo (integer, P9/T4)', async () => {
    const db = makeDB({ id: 'wlt_001', agent_id: 'agt_001', balance_kobo: 50_000, credit_limit_kobo: 0 });
    const balance = await getWalletBalance(db, 'agt_001', 'tenant_01');
    expect(balance).not.toBeNull();
    expect(balance!.balanceKobo).toBe(50_000);
    expect(Number.isInteger(balance!.balanceKobo)).toBe(true);
    expect(Number.isInteger(balance!.creditLimitKobo)).toBe(true);
  });

  it('returns null when agent has no wallet', async () => {
    const db = makeDB(undefined);
    const balance = await getWalletBalance(db, 'agt_notfound', 'tenant_01');
    expect(balance).toBeNull();
  });

  it('scopes query to tenantId (T3)', async () => {
    const db = makeDB({ id: 'wlt_001', agent_id: 'agt_001', balance_kobo: 0, credit_limit_kobo: 0 });
    await getWalletBalance(db, 'agt_001', 'tenant_CORRECT');
    const calls = (db.prepare as ReturnType<typeof vi.fn>).mock.calls;
    const bindArgs = calls.flatMap((c: unknown[]) => {
      // Get all bind args by inspecting the mock chain
      return c;
    });
    // The SQL query should include tenant_id filter
    const sqlCalls: string[] = calls.map((c: unknown[]) => String(c[0]));
    expect(sqlCalls.some((sql) => sql.includes('tenant_id'))).toBe(true);
  });
});
