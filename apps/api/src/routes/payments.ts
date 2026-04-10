/**
 * Payment routes — Paystack checkout + verification + billing history.
 *
 *   POST /workspaces/:id/upgrade          — initialise a Paystack checkout
 *   POST /payments/verify                 — verify + sync a completed payment
 *   GET  /workspaces/:id/billing          — list billing history for workspace
 *
 * All routes require auth (applied at app level in index.ts).
 *
 * Security invariants (security-baseline.md, TDR-0008):
 *   T1 — Every workspace operation is validated against the caller's workspaceId
 *         from the verified JWT (c.get('auth')).
 *   T3 — Billing history queries are scoped to the authenticated workspace only.
 *   W1 — POST /payments/verify validates the x-paystack-signature HMAC before
 *         processing any payment state change.
 *
 * Milestone 6 — Payments Layer
 */

import { Hono } from 'hono';
import type { Env } from '../env.js';
import type { AuthContext } from '@webwaka/types';
import { initializePayment, verifyPayment, verifyWebhookSignature } from '@webwaka/payments';
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
  amount_kobo: number;
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

  // T1: Verify the caller owns (or is operating in) the requested workspace.
  const auth = c.get('auth');
  if (auth.workspaceId !== workspaceId) {
    return c.json({ error: 'Forbidden — workspace mismatch' }, 403);
  }

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
        callbackUrl: `${c.env.APP_BASE_URL ?? 'https://app.webwaka.com'}/billing/verify`,
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
//
// W1: Paystack sends a x-paystack-signature HMAC-SHA512 header with every
// webhook call. We MUST validate it before acting on the payload, otherwise
// any caller could forge a payment success event.
//
// Flow:
//   1. Read raw body text (before JSON parse — signature covers the raw bytes).
//   2. Validate x-paystack-signature against HMAC-SHA512(body, secretKey).
//   3. Only then parse JSON + run payment sync.
// ---------------------------------------------------------------------------

export const paymentsVerifyRoute = new Hono<AppEnv>();

paymentsVerifyRoute.post('/verify', async (c) => {
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return c.json({ error: 'Payment provider not configured' }, 503);
  }

  // W1: Read raw body FIRST so we can verify the signature over the original bytes.
  const rawBody = await c.req.text();

  // W1: Validate Paystack webhook signature.
  const signature = c.req.header('x-paystack-signature') ?? '';
  const signatureValid = await verifyWebhookSignature(rawBody, signature, secretKey);
  if (!signatureValid) {
    return c.json({ error: 'Invalid webhook signature' }, 401);
  }

  // Parse body after signature validation.
  let body: { reference?: string; workspaceId?: string } = {};
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { reference, workspaceId } = body;
  if (!reference || !workspaceId) {
    return c.json({ error: 'reference and workspaceId are required' }, 422);
  }

  // T1: Verify caller is operating in the workspace they are syncing payment for.
  const auth = c.get('auth');
  if (auth.workspaceId !== workspaceId) {
    return c.json({ error: 'Forbidden — workspace mismatch' }, 403);
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

  // T3: Scope billing history to the authenticated caller's workspace only.
  const auth = c.get('auth');
  if (auth.workspaceId !== workspaceId) {
    return c.json({ error: 'Forbidden — workspace mismatch' }, 403);
  }

  const db = c.env.DB as unknown as D1Like;

  const rows = await db
    .prepare(
      `SELECT id, workspace_id, paystack_ref, amount_kobo, status, metadata,
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
    amountKobo: r.amount_kobo,
    status: r.status,
    metadata: (() => { try { return JSON.parse(r.metadata) as Record<string, unknown>; } catch { return {}; } })(),
    createdAt: r.created_at,
  }));

  return c.json({ workspaceId, records, total: records.length });
});
