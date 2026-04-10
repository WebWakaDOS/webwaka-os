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
 *   R9 — Rate limit: 5 top-ups per user per hour (KV: rate:airtime:{tenantId}:{userId})
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

interface D1PreparedStatement {
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes: number } }>;
  all<T>(): Promise<{ results: T[] }>;
}

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): D1PreparedStatement;
  };
  batch(statements: D1PreparedStatement[]): Promise<{ success: boolean; meta?: { changes: number } }[]>;
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
  // Step A: Verify wallet exists and get its id — T3: bind agentId + tenantId.
  const wallet = await db
    .prepare(`SELECT id, balance_kobo FROM agent_wallets WHERE agent_id = ? AND tenant_id = ? LIMIT 1`)
    .bind(agentId, tenantId)
    .first<{ id: string; balance_kobo: number }>();

  if (!wallet) {
    const err = new Error('Agent wallet not found');
    (err as Error & { code: string }).code = 'WALLET_NOT_FOUND';
    throw err;
  }

  // Step B: Single atomic CTE — conditional debit + ledger insert in one D1 statement.
  // The CTE deducts ONLY when balance is sufficient (WHERE balance_kobo >= amount).
  // If the CTE returns 0 rows (balance insufficient), the INSERT also inserts 0 rows
  // (FROM deduction is empty) → meta.changes = 0 → INSUFFICIENT_FLOAT.
  // Both debit and ledger entry are committed atomically; no gap between the two operations.
  const now = Math.floor(Date.now() / 1000);
  const entryId = `fle_${crypto.randomUUID()}`;
  const result = await db
    .prepare(
      `WITH deduction AS (
         UPDATE agent_wallets
         SET balance_kobo = balance_kobo - ?, updated_at = ?
         WHERE id = ? AND balance_kobo >= ?
         RETURNING id, balance_kobo
       )
       INSERT INTO float_ledger
         (id, wallet_id, amount_kobo, running_balance_kobo, transaction_type, reference, created_at)
       SELECT ?, d.id, ?, d.balance_kobo, 'cash_out', ?, ?
       FROM deduction d`,
    )
    .bind(
      amountKobo, now, wallet.id, amountKobo, // UPDATE args
      entryId, -amountKobo, reference, now,   // INSERT args
    )
    .run();

  // meta.changes = 0 → CTE returned no rows → balance was insufficient at write time.
  if ((result.meta?.changes ?? 1) === 0) {
    const err = new Error('Insufficient agent float balance');
    (err as Error & { code: string }).code = 'INSUFFICIENT_FLOAT';
    throw err;
  }
}

// ---------------------------------------------------------------------------
// refundFloat — compensating transaction on Termii failure
// ---------------------------------------------------------------------------

/**
 * Refund a previously deducted float amount.
 * Called as a compensating transaction when the Termii provider call fails
 * after deductFromFloat has already succeeded.
 * Records a 'cash_in' ledger entry to restore the balance.
 */
async function refundFloat(
  db: D1Like,
  agentId: string,
  amountKobo: number,
  reference: string,
  tenantId: string,
): Promise<void> {
  const wallet = await db
    .prepare(`SELECT id, balance_kobo FROM agent_wallets WHERE agent_id = ? AND tenant_id = ? LIMIT 1`)
    .bind(agentId, tenantId)
    .first<{ id: string; balance_kobo: number }>();

  if (!wallet) return; // Wallet missing — nothing to refund

  const now = Math.floor(Date.now() / 1000);
  const newBalance = wallet.balance_kobo + amountKobo;

  await db
    .prepare(`UPDATE agent_wallets SET balance_kobo = balance_kobo + ?, updated_at = ? WHERE id = ?`)
    .bind(amountKobo, now, wallet.id)
    .run();

  const entryId = `fle_${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO float_ledger
         (id, wallet_id, amount_kobo, running_balance_kobo, transaction_type, reference, created_at)
       VALUES (?, ?, ?, ?, 'cash_in', ?, ?)`,
    )
    .bind(entryId, wallet.id, amountKobo, newBalance, reference, now)
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

  // KYC Tier-1 gate — airtime top-up is a financial operation requiring at minimum Tier 1.
  // Tier 0 (unverified) users are blocked per Nigeria CBN KYC compliance (BVN linkage = T1).
  const kycDb = c.env.DB as unknown as D1Like;
  const kycRow = await kycDb
    .prepare(`SELECT kyc_tier FROM users WHERE id = ? LIMIT 1`)
    .bind(auth.userId)
    .first<{ kyc_tier: string }>();

  if (!kycRow || kycRow.kyc_tier === 't0') {
    return c.json(
      { error: 'kyc_required', message: 'Airtime top-up requires KYC Tier 1 or above. Please complete BVN verification first.' },
      403,
    );
  }

  // Rate limit — 5 top-ups per user per hour (R9 pattern; T3: tenant-scoped KV key)
  const rateLimitKey = `rate:airtime:${auth.tenantId}:${auth.userId}`;
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

  const amountKobo = body.amount_kobo;
  const phone = phoneValidation.normalized;
  const carrier = phoneValidation.carrier ?? 'unknown';
  const network = body.network ?? carrierToTermiiNetwork(carrier);

  const db = c.env.DB as unknown as D1Like;
  const termiiRef = `airtime_${crypto.randomUUID()}`;

  // Step 1: Atomically deduct from float BEFORE calling Termii.
  // This ensures we can NEVER deliver airtime without a successful ledger deduction.
  // deductFromFloat uses a conditional UPDATE (WHERE balance_kobo >= amount) — concurrent
  // races are handled atomically by D1/SQLite. Throws INSUFFICIENT_FLOAT or WALLET_NOT_FOUND.
  try {
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

  // Step 2: Call Termii Airtime API. If this fails, we refund the deduction.
  // T4: division is presentation-only; kobo remains the stored unit.
  const termiiAmountNaira = amountKobo / 100; // T4: display conversion only — Termii API requires naira units
  const termiiRes = await fetch(TERMII_AIRTIME_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: c.env.TERMII_API_KEY,
      ported_number: true,
      network,
      phone,
      amount: termiiAmountNaira,
    }),
  });

  if (!termiiRes.ok) {
    // Step 2a: Provider failed — refund the deduction as a compensating transaction.
    const refundRef = `refund_${termiiRef}`;
    await refundFloat(db, auth.userId, amountKobo, refundRef, auth.tenantId).catch(() => {
      // Refund failure is logged server-side but not surfaced to the caller —
      // the 502 response is still correct; a background reconciliation job handles recovery.
      console.error(`[airtime] REFUND FAILED for ${termiiRef} — manual reconciliation needed`);
    });
    const errBody = await termiiRes.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof errBody['message'] === 'string' ? errBody['message'] : `Termii error ${termiiRes.status}`;
    return c.json({ error: 'provider_error', message: msg }, 502);
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
