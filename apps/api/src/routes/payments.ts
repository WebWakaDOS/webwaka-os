/**
 * Payment routes — Paystack checkout + verification + billing history.
 *
 *   POST /workspaces/:id/upgrade          — initialise a Paystack checkout
 *   POST /payments/verify                 — verify + sync a completed payment
 *   GET  /workspaces/:id/billing          — list billing history for workspace
 *
 * All routes require auth (applied at app level in index.ts).
 *
 * Milestone 6 — Payments Layer
 */

import { Hono } from 'hono';
import type { Env } from '../env.js';
import type { AuthContext } from '@webwaka/types';
import { initializePayment, verifyPayment } from '@webwaka/payments';
import { syncPaymentToSubscription, recordFailedPayment } from '@webwaka/payments';

interface D1Like {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    run(): Promise<{ success: boolean }>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

interface BillingRow {
  id: string;
  workspace_id: string;
  paystack_ref: string | null;
  amount_naira: number;
  status: string;
  metadata: string;
  created_at: string;
}

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

// ---------------------------------------------------------------------------
// Workspace upgrade — POST /workspaces/:id/upgrade
// ---------------------------------------------------------------------------

export const workspaceUpgradeRoute = new Hono<AppEnv>();

workspaceUpgradeRoute.post('/:id/upgrade', async (c) => {
  const workspaceId = c.req.param('id');

  let body: { plan?: string; email?: string } = {};
  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const email = body.email;
  if (!email) {
    return c.json({ error: 'email is required' }, 400);
  }

  const PLAN_AMOUNTS: Record<string, number> = {
    starter:    5_000_00,
    growth:    20_000_00,
    enterprise: 100_000_00,
  };

  const plan = body.plan ?? 'starter';
  const amountKobo = PLAN_AMOUNTS[plan] ?? PLAN_AMOUNTS['starter']!;

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return c.json({ error: 'Payment provider not configured' }, 503);
  }

  try {
    const payment = await initializePayment(
      { secretKey },
      {
        workspaceId,
        amountKobo,
        email,
        callbackUrl: `https://app.webwaka.com/billing/verify?ref={PAYSTACK_REFERENCE}`,
        metadata: { plan, workspace_id: workspaceId },
      },
    );

    return c.json(
      {
        reference: payment.reference,
        authorizationUrl: payment.authorizationUrl,
        accessCode: payment.accessCode,
        amountKobo: payment.amountKobo,
        plan,
      },
      201,
    );
  } catch (err) {
    console.error('[payments] initializePayment error:', err);
    return c.json({ error: 'Payment initialization failed' }, 502);
  }
});

// ---------------------------------------------------------------------------
// Payment verification — POST /payments/verify
// ---------------------------------------------------------------------------

export const paymentsVerifyRoute = new Hono<AppEnv>();

paymentsVerifyRoute.post('/verify', async (c) => {
  let body: { reference?: string; workspaceId?: string } = {};
  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { reference, workspaceId } = body;
  if (!reference || !workspaceId) {
    return c.json({ error: 'reference and workspaceId are required' }, 422);
  }

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return c.json({ error: 'Payment provider not configured' }, 503);
  }

  try {
    const verified = await verifyPayment({ secretKey }, reference);

    const db = c.env.DB as unknown as D1Like;

    if (verified.status === 'success') {
      const result = await syncPaymentToSubscription(db, {
        workspaceId,
        paystackRef: reference,
        amountKobo: verified.amountKobo,
        metadata: { ...(verified.metadata as Record<string, unknown>) },
      });

      return c.json({
        status: 'success',
        plan: result.plan,
        billingId: result.billingId,
        amountKobo: verified.amountKobo,
      });
    } else {
      await recordFailedPayment(db, workspaceId, reference, verified.amountKobo);

      return c.json({ status: verified.status, error: 'Payment was not successful' }, 402);
    }
  } catch (err) {
    console.error('[payments] verifyPayment error:', err);
    return c.json({ error: 'Payment verification failed' }, 502);
  }
});

// ---------------------------------------------------------------------------
// Billing history — GET /workspaces/:id/billing
// ---------------------------------------------------------------------------

export const workspaceBillingRoute = new Hono<AppEnv>();

workspaceBillingRoute.get('/:id/billing', async (c) => {
  const workspaceId = c.req.param('id');
  const db = c.env.DB as unknown as D1Like;

  const rows = await db
    .prepare(
      `SELECT id, workspace_id, paystack_ref, amount_naira, status, metadata,
              datetime(created_at,'unixepoch') AS created_at
       FROM billing_history
       WHERE workspace_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .bind(workspaceId)
    .all<BillingRow>();

  const records = rows.results.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    paystackRef: r.paystack_ref,
    amountKobo: r.amount_naira,
    status: r.status,
    metadata: (() => { try { return JSON.parse(r.metadata) as Record<string, unknown>; } catch { return {}; } })(),
    createdAt: r.created_at,
  }));

  return c.json({ workspaceId, records, total: records.length });
});
