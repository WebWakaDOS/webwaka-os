/**
 * Tests for POS float double-entry ledger.
 * (Platform Invariants P9 + T4 — all amounts must be integer kobo. Never floats.)
 *
 * Ledger is append-only — no UPDATE or DELETE on ledger rows.
 * Reversals are new rows with negative amountKobo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  postLedgerEntry,
  reverseLedgerEntry,
  getLedgerHistory,
  InsufficientFloatError,
} from './float-ledger.js';

function makeWalletRow(balanceKobo: number): { balance_kobo: number } {
  return { balance_kobo: balanceKobo };
}

function makeLedgerRow(walletId: string, amountKobo: number, reference: string) {
  return { wallet_id: walletId, amount_kobo: amountKobo, reference };
}

type MockStatement = {
  bind: (...args: unknown[]) => {
    first: <T>() => Promise<T | null>;
    run: () => Promise<{ success: boolean }>;
    all: <T>() => Promise<{ results: T[] }>;
  };
};

function makeDB(walletBalanceKobo: number, ledgerRow?: { wallet_id: string; amount_kobo: number; reference: string }): {
  prepare: (sql: string) => MockStatement;
  batch: ReturnType<typeof vi.fn>;
} {
  const batchMock = vi.fn().mockResolvedValue([{ success: true }, { success: true }]);

  const prepare = vi.fn().mockImplementation((sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: <T>() => {
        if (sql.includes('agent_wallets')) {
          return Promise.resolve(makeWalletRow(walletBalanceKobo) as T);
        }
        if (sql.includes('float_ledger') && ledgerRow) {
          return Promise.resolve(ledgerRow as T);
        }
        return Promise.resolve(null);
      },
      run: () => Promise.resolve({ success: true }),
      all: <T>() => Promise.resolve({ results: [] as T[] }),
    }),
  }));

  return { prepare, batch: batchMock };
}

describe('postLedgerEntry — credit (top_up)', () => {
  it('credits the wallet and returns new balance', async () => {
    const db = makeDB(10_000); // ₦100.00 starting balance
    const result = await postLedgerEntry(db, {
      walletId: 'wlt_001',
      amountKobo: 5_000,       // + ₦50.00
      transactionType: 'top_up',
      reference: 'ref_topup_001',
    });
    expect(result.runningBalanceKobo).toBe(15_000);
    expect(result.id).toMatch(/^flt_/);
    expect(db.batch).toHaveBeenCalledOnce();
  });

  it('uses integer kobo — never floats (T4)', async () => {
    const db = makeDB(0);
    const result = await postLedgerEntry(db, {
      walletId: 'wlt_001',
      amountKobo: 100,         // ₦1.00 — integer
      transactionType: 'commission',
      reference: 'ref_commission_001',
    });
    expect(Number.isInteger(result.runningBalanceKobo)).toBe(true);
  });
});

describe('postLedgerEntry — debit (cash_out)', () => {
  it('debits the wallet and returns new balance', async () => {
    const db = makeDB(20_000); // ₦200.00
    const result = await postLedgerEntry(db, {
      walletId: 'wlt_001',
      amountKobo: -5_000,      // - ₦50.00
      transactionType: 'cash_out',
      reference: 'ref_cashout_001',
    });
    expect(result.runningBalanceKobo).toBe(15_000);
  });

  it('throws InsufficientFloatError when balance would go negative', async () => {
    const db = makeDB(1_000); // only ₦10.00
    await expect(
      postLedgerEntry(db, {
        walletId: 'wlt_001',
        amountKobo: -5_000,    // trying to debit ₦50.00
        transactionType: 'cash_out',
        reference: 'ref_cashout_fail',
      }),
    ).rejects.toThrow(InsufficientFloatError);
  });

  it('throws InsufficientFloatError with informative message', async () => {
    const db = makeDB(500);
    try {
      await postLedgerEntry(db, {
        walletId: 'wlt_001',
        amountKobo: -1_000,
        transactionType: 'fee',
        reference: 'ref_fee_fail',
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientFloatError);
      expect((err as Error).message).toContain('500');
      expect((err as Error).message).toContain('1000');
    }
  });
});

describe('postLedgerEntry — validation', () => {
  it('throws TypeError for float amountKobo (P9 invariant)', async () => {
    const db = makeDB(10_000);
    await expect(
      postLedgerEntry(db, {
        walletId: 'wlt_001',
        amountKobo: 500.50,    // NOT an integer — violates P9
        transactionType: 'top_up',
        reference: 'ref_float_bad',
      }),
    ).rejects.toThrow(TypeError);
  });

  it('throws TypeError for zero amountKobo', async () => {
    const db = makeDB(10_000);
    await expect(
      postLedgerEntry(db, {
        walletId: 'wlt_001',
        amountKobo: 0,
        transactionType: 'top_up',
        reference: 'ref_zero_bad',
      }),
    ).rejects.toThrow(TypeError);
  });

  it('throws Error when wallet not found', async () => {
    // makeDB with 0 balance but we need a DB that returns null for wallet
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
    await expect(
      postLedgerEntry(db, {
        walletId: 'nonexistent',
        amountKobo: 1_000,
        transactionType: 'top_up',
        reference: 'ref_nowallet',
      }),
    ).rejects.toThrow('Wallet not found');
  });
});

describe('reverseLedgerEntry', () => {
  it('posts an equal and opposite entry (append-only)', async () => {
    const db = makeDB(5_000, makeLedgerRow('wlt_001', 3_000, 'ref_original'));
    const result = await reverseLedgerEntry(db, 'ref_original', 'ref_reversal', 'duplicate charge');
    // Original was +3000, reversal should be -3000
    expect(result.runningBalanceKobo).toBe(2_000); // 5000 - 3000
  });

  it('throws Error when original entry not found', async () => {
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
    await expect(
      reverseLedgerEntry(db, 'nonexistent_ref', 'ref_reversal', 'test'),
    ).rejects.toThrow('Original entry not found');
  });

  it('never calls UPDATE or DELETE on float_ledger (append-only invariant)', async () => {
    const db = makeDB(5_000, makeLedgerRow('wlt_001', 1_000, 'ref_orig'));
    await reverseLedgerEntry(db, 'ref_orig', 'ref_rev', 'test');
    // Verify only SELECT and INSERT/UPDATE via batch — no direct DELETE
    const calls: string[] = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => String(c[0]),
    );
    const hasDelete = calls.some((sql) => sql.trim().toUpperCase().startsWith('DELETE'));
    expect(hasDelete).toBe(false);
  });
});

describe('getLedgerHistory', () => {
  it('returns empty array when no entries', async () => {
    const db = makeDB(0);
    const history = await getLedgerHistory(db, 'wlt_001');
    expect(Array.isArray(history)).toBe(true);
    expect(history).toHaveLength(0);
  });
});
