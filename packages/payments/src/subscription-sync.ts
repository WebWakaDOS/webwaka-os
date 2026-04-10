/**
 * Payment → entitlement sync.
 * After a successful Paystack payment, update the workspace subscription.
 *
 * Milestone 6 — Payments Layer
 */

export interface SyncPaymentToSubscriptionParams {
  workspaceId: string;
  paystackRef: string;
  amountKobo: number;
  metadata: Record<string, unknown>;
}

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

// Plan thresholds in kobo (NGN × 100)
const PLAN_THRESHOLDS: Record<string, number> = {
  starter:    5_000_00,   // ₦5,000
  growth:    20_000_00,   // ₦20,000
  enterprise: 100_000_00, // ₦100,000
};

function planFromAmount(amountKobo: number): string {
  if (amountKobo >= PLAN_THRESHOLDS['enterprise']!) return 'enterprise';
  if (amountKobo >= PLAN_THRESHOLDS['growth']!) return 'growth';
  if (amountKobo >= PLAN_THRESHOLDS['starter']!) return 'starter';
  return 'free';
}

/**
 * After a verified Paystack success, update the subscription + create billing record.
 * Returns the new subscription plan name.
 */
export async function syncPaymentToSubscription(
  db: D1Like,
  params: SyncPaymentToSubscriptionParams,
): Promise<{ plan: string; billingId: string }> {
  const plan = (params.metadata['plan'] as string | undefined) ?? planFromAmount(params.amountKobo);
  const billingId = `bil_${crypto.randomUUID().replace(/-/g, '')}`;

  // Insert billing_history record
  await db
    .prepare(
      `INSERT OR IGNORE INTO billing_history
         (id, workspace_id, paystack_ref, amount_kobo, status, metadata, created_at)
       VALUES (?, ?, ?, ?, 'success', ?, unixepoch())`,
    )
    .bind(
      billingId,
      params.workspaceId,
      params.paystackRef,
      params.amountKobo,
      JSON.stringify(params.metadata),
    )
    .run();

  // Upgrade subscription plan + status
  await db
    .prepare(
      `UPDATE subscriptions
       SET plan = ?, status = 'active', updated_at = unixepoch()
       WHERE workspace_id = ?`,
    )
    .bind(plan, params.workspaceId)
    .run();

  return { plan, billingId };
}

/**
 * Record a failed payment in billing_history.
 */
export async function recordFailedPayment(
  db: D1Like,
  workspaceId: string,
  paystackRef: string,
  amountKobo: number,
): Promise<void> {
  const billingId = `bil_${crypto.randomUUID().replace(/-/g, '')}`;

  await db
    .prepare(
      `INSERT OR IGNORE INTO billing_history
         (id, workspace_id, paystack_ref, amount_kobo, status, metadata, created_at)
       VALUES (?, ?, ?, ?, 'failed', '{}', unixepoch())`,
    )
    .bind(billingId, workspaceId, paystackRef, amountKobo)
    .run();
}
