import { describe, it, expect } from 'vitest';
import { syncPaymentToSubscription, recordFailedPayment } from './subscription-sync.js';

function makeDb(rows: Record<string, unknown[]> = {}) {
  return {
    prepare(sql: string) {
      return {
        bind: (..._args: unknown[]) => ({
          run: async () => ({ success: true }),
          first: async <T>(): Promise<T | null> => {
            for (const [key, resultRows] of Object.entries(rows)) {
              if (sql.includes(key)) return (resultRows[0] ?? null) as T;
            }
            return null;
          },
          all: async <T>() => {
            for (const [key, resultRows] of Object.entries(rows)) {
              if (sql.includes(key)) return { results: resultRows as T[] };
            }
            return { results: [] as T[] };
          },
        }),
        run: async () => ({ success: true }),
        first: async <T>(): Promise<T | null> => null,
        all: async <T>() => ({ results: [] as T[] }),
      };
    },
  };
}

describe('syncPaymentToSubscription', () => {
  it('returns a billingId and plan on success', async () => {
    const db = makeDb({});
    const result = await syncPaymentToSubscription(db, {
      workspaceId: 'wsp_test',
      paystackRef: 'ref_test001',
      amountKobo: 5000_00,
      metadata: { plan: 'starter' },
    });

    expect(result.plan).toBe('starter');
    expect(result.billingId).toMatch(/^bil_/);
  });

  it('infers plan from amount when no plan in metadata', async () => {
    const db = makeDb({});
    const result = await syncPaymentToSubscription(db, {
      workspaceId: 'wsp_infer',
      paystackRef: 'ref_infer',
      amountKobo: 20_000_00,
      metadata: {},
    });

    expect(result.plan).toBe('growth');
  });

  it('infers enterprise for large amounts', async () => {
    const db = makeDb({});
    const result = await syncPaymentToSubscription(db, {
      workspaceId: 'wsp_ent',
      paystackRef: 'ref_ent',
      amountKobo: 100_000_00,
      metadata: {},
    });

    expect(result.plan).toBe('enterprise');
  });

  it('falls back to free for tiny amounts', async () => {
    const db = makeDb({});
    const result = await syncPaymentToSubscription(db, {
      workspaceId: 'wsp_free',
      paystackRef: 'ref_free',
      amountKobo: 100,
      metadata: {},
    });

    expect(result.plan).toBe('free');
  });

  it('metadata plan overrides amount-derived plan', async () => {
    const db = makeDb({});
    const result = await syncPaymentToSubscription(db, {
      workspaceId: 'wsp_override',
      paystackRef: 'ref_override',
      amountKobo: 100,
      metadata: { plan: 'enterprise' },
    });

    expect(result.plan).toBe('enterprise');
  });
});

describe('recordFailedPayment', () => {
  it('runs without throwing', async () => {
    const db = makeDb({});
    await expect(
      recordFailedPayment(db, 'wsp_fail', 'ref_fail', 1000),
    ).resolves.toBeUndefined();
  });
});
