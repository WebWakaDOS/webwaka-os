/**
 * Payment type contracts for WebWaka OS.
 * (T4: monetary values stored as kobo — NGN × 100)
 *
 * Milestone 6 — Payments Layer
 */

// ---------------------------------------------------------------------------
// Paystack provider config
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  secretKey: string;
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Payment intent (checkout initialisation)
// ---------------------------------------------------------------------------

export interface PaymentIntent {
  workspaceId: string;
  subscriptionId?: string;
  amountKobo: number;
  email: string;
  currency?: 'NGN';
  callbackUrl?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface InitializedPayment {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amountKobo: number;
}

// ---------------------------------------------------------------------------
// Billing record (persisted to billing_history)
// ---------------------------------------------------------------------------

export interface BillingRecord {
  id: string;
  workspaceId: string;
  subscriptionId?: string;
  paystackRef: string;
  amountKobo: number;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Payment verification result
// ---------------------------------------------------------------------------

export interface VerifiedPayment {
  reference: string;
  status: 'success' | 'failed' | 'abandoned';
  amountKobo: number;
  currency: string;
  paidAt: string | null;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Paystack webhook payload (trimmed to what we use)
// ---------------------------------------------------------------------------

export interface PaystackWebhookEvent {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    metadata?: Record<string, unknown>;
    customer?: { email?: string };
  };
}
