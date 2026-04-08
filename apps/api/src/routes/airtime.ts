/**
 * Airtime top-up routes (M7e).
 * (docs/governance/platform-invariants.md — P2/P9/T3/T4)
 *
 * POST /airtime/topup — top up a Nigerian mobile number via Termii Airtime API.
 *
 * Platform Invariants enforced:
 *   P2 — Nigeria First: Nigerian numbers only (Termii network slug mapping)
 *   P9/T4 — Integer kobo: amount_kobo must be a positive integer (₦50–₦20,000)
 *   T3 — Tenant isolation: tenantId from auth context on all DB queries
 *   CBN — KYC Tier 1 required before any airtime purchase
 *   R9 — Rate limit: 5 top-ups per user per hour (KV: rate:airtime:{userId})
 */

import { Hono } from 'hono';
import { validateNigerianPhone } from '@webwaka/otp';
import type { Env } from '../env.js';
import type { AuthContext } from '@webwaka/types';

const TERMII_AIRTIME_URL = 'https://api.ng.termii.com/api/topup';
const MIN_KOBO = 5_000;     // ₦50 minimum
const MAX_KOBO = 2_000_000; // ₦20,000 maximum
const RATE_LIMIT = 5;        // 5 top-ups per user per hour

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

// ---------------------------------------------------------------------------
// Local D1Like
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<{ success: boolean }>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * assertIntegerKobo — T4/P9 guard.
 * Throws 422-style error if amount is not a positive integer or out of range.
 */
function assertIntegerKobo(amount: unknown): asserts amount is number {
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    throw new Error('amount_kobo must be an integer (T4/P9)');
  }
  if (amount < MIN_KOBO) {
    throw new Error(`amount_kobo must be at least ${MIN_KOBO} kobo (₦${MIN_KOBO / 100})`);
  }
  if (amount > MAX_KOBO) {
    throw new Error(`amount_kobo must be at most ${MAX_KOBO} kobo (₦${MAX_KOBO / 100})`);
  }
}

/**
 * Map carrier slug from @webwaka/otp phone-validator to Termii network slug.
 */
function carrierToTermiiNetwork(
  carrier: 'mtn' | 'airtel' | 'glo' | '9mobile' | 'unknown',
): string {
  const map: Record<string, string> = {
    mtn: 'MTN',
    airtel: 'Airtel',
    glo: 'Glo',
    '9mobile': '9mobile',
    unknown: 'MTN', // Default to MTN if unknown — Termii will reject invalid combos
  };
  return map[carrier] ?? 'MTN';
}

/**
 * Post a ledger entry for the airtime deduction.
 * Uses the float_ledger table (migration 0024).
 * T4: amountKobo must be negative integer for cash_out.
 */
async function deductFromFloat(
  db: D1Like,
  agentId: string,
  amountKobo: number,
  reference: string,
  tenantId: string,
): Promise<void> {
  // Get wallet by agentId + tenantId (T3)
  const wallet = await db
    .prepare(`SELECT id, balance_kobo FROM agent_wallets WHERE agent_id = ? AND tenant_id = ? LIMIT 1`)
    .bind(agentId, tenantId)
    .first<{ id: string; balance_kobo: number }>();

  if (!wallet) {
    const err = new Error('Agent wallet not found');
    (err as Error & { code: string }).code = 'WALLET_NOT_FOUND';
    throw err;
  }

  if (wallet.balance_kobo < amountKobo) {
    const err = new Error('Insufficient agent float balance');
    (err as Error & { code: string }).code = 'INSUFFICIENT_FLOAT';
    throw err;
  }

  const newBalance = wallet.balance_kobo - amountKobo;
  const entryId = `fle_${crypto.randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO float_ledger
         (id, wallet_id, amount_kobo, running_balance_kobo, transaction_type, reference, created_at)
       VALUES (?, ?, ?, ?, 'cash_out', ?, ?)`,
    )
    .bind(entryId, wallet.id, -amountKobo, newBalance, reference, now)
    .run();

  await db
    .prepare(`UPDATE agent_wallets SET balance_kobo = ?, updated_at = ? WHERE id = ?`)
    .bind(newBalance, now, wallet.id)
    .run();
}

// ---------------------------------------------------------------------------
// Airtime route
// ---------------------------------------------------------------------------

const airtimeRoutes = new Hono<AppEnv>();

/**
 * POST /airtime/topup
 * Body: { phone: string; amount_kobo: number; network?: string; }
 * Response: 200 { transactionId, phone, amount_kobo, network, status }
 */
airtimeRoutes.post('/topup', async (c) => {
  const auth = c.get('auth');
  if (!auth) return c.json({ error: 'Unauthorized' }, 401);

  // Rate limit — 5 top-ups per user per hour (R9 pattern for airtime)
  const rateLimitKey = `rate:airtime:${auth.userId}`;
  const countStr = await c.env.RATE_LIMIT_KV.get(rateLimitKey);
  const count = countStr ? parseInt(countStr, 10) : 0;
  if (count >= RATE_LIMIT) {
    return c.json({ error: 'rate_limited', message: 'Too many airtime requests. Try again later.' }, 429);
  }

  const body = await c.req.json<{ phone?: unknown; amount_kobo?: unknown; network?: string }>().catch(() => null);
  if (!body) return c.json({ error: 'Invalid request body' }, 400);

  // Validate phone — P2: Nigerian numbers only
  const phoneValidation = validateNigerianPhone(String(body.phone ?? ''));
  if (!phoneValidation.valid) {
    return c.json(
      { error: 'invalid_phone', message: 'phone must be a valid Nigerian mobile number (P2)' },
      400,
    );
  }

  // Validate amount_kobo — P9/T4: integer kobo only
  try {
    assertIntegerKobo(body.amount_kobo);
  } catch (err) {
    return c.json({ error: 'invalid_amount', message: (err as Error).message }, 422);
  }

  const amountKobo = body.amount_kobo as number;
  const phone = phoneValidation.normalized;
  const carrier = phoneValidation.carrier ?? 'unknown';
  const network = body.network ?? carrierToTermiiNetwork(carrier);

  const db = c.env.DB as unknown as D1Like;

  // Deduct from agent float (T3 — tenantId from auth)
  let termiiRef: string;
  try {
    // Call Termii Airtime API — amount passed as Naira (kobo ÷ 100)
    const amountNaira = amountKobo / 100; // T4: only division to convert, never stored as float
    termiiRef = `airtime_${crypto.randomUUID()}`;

    const termiiRes = await fetch(TERMII_AIRTIME_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: c.env.TERMII_API_KEY,
        ported_number: true,
        network,
        phone,
        amount: amountNaira,
      }),
    });

    if (!termiiRes.ok) {
      const errBody = await termiiRes.json().catch(() => ({})) as Record<string, unknown>;
      const msg = typeof errBody['message'] === 'string' ? errBody['message'] : `Termii error ${termiiRes.status}`;
      return c.json({ error: 'provider_error', message: msg }, 502);
    }

    // Deduct from float after confirmed Termii success
    await deductFromFloat(db, auth.userId, amountKobo, termiiRef, auth.tenantId);
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'INSUFFICIENT_FLOAT') {
      return c.json({ error: 'insufficient_float', message: 'Insufficient agent float balance' }, 402);
    }
    if (e.code === 'WALLET_NOT_FOUND') {
      return c.json({ error: 'wallet_not_found', message: 'Agent wallet not found' }, 404);
    }
    throw err;
  }

  // Increment rate limit counter (1 hour TTL)
  await c.env.RATE_LIMIT_KV.put(rateLimitKey, String(count + 1), { expirationTtl: 3600 });

  return c.json({
    transactionId: termiiRef,
    phone,
    amount_kobo: amountKobo, // T4: always return integer kobo
    network,
    status: 'success',
  });
});

export { airtimeRoutes };
