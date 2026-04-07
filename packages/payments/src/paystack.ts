/**
 * Paystack payment provider integration.
 * (No live keys used in source — secrets via env.PAYSTACK_SECRET_KEY)
 *
 * initializePayment() — create a Paystack checkout session
 * verifyPayment()     — verify a completed payment by reference
 *
 * Milestone 6 — Payments Layer
 */

import type { ProviderConfig, PaymentIntent, InitializedPayment, VerifiedPayment } from './types.js';

const PAYSTACK_BASE = 'https://api.paystack.co';

// ---------------------------------------------------------------------------
// Paystack API response shapes
// ---------------------------------------------------------------------------

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    metadata?: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// initializePayment — creates a Paystack checkout and returns the URL
// ---------------------------------------------------------------------------

export async function initializePayment(
  config: ProviderConfig,
  intent: PaymentIntent,
): Promise<InitializedPayment> {
  const base = config.baseUrl ?? PAYSTACK_BASE;

  const payload = {
    email: intent.email,
    amount: intent.amountKobo,
    currency: intent.currency ?? 'NGN',
    callback_url: intent.callbackUrl,
    metadata: {
      workspace_id: intent.workspaceId,
      subscription_id: intent.subscriptionId ?? null,
      ...intent.metadata,
    },
  };

  const res = await fetch(`${base}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new PaystackError(`HTTP ${res.status} from Paystack /transaction/initialize`);
  }

  const json = await res.json() as PaystackInitResponse;

  if (!json.status || !json.data) {
    throw new PaystackError(`Paystack init failed: ${json.message}`);
  }

  return {
    reference: json.data.reference,
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    amountKobo: intent.amountKobo,
  };
}

// ---------------------------------------------------------------------------
// verifyPayment — verify a Paystack transaction by its reference
// ---------------------------------------------------------------------------

export async function verifyPayment(
  config: ProviderConfig,
  reference: string,
): Promise<VerifiedPayment> {
  const base = config.baseUrl ?? PAYSTACK_BASE;

  const res = await fetch(`${base}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new PaystackError(`HTTP ${res.status} from Paystack /transaction/verify`);
  }

  const json = await res.json() as PaystackVerifyResponse;

  if (!json.status || !json.data) {
    throw new PaystackError(`Paystack verify failed: ${json.message}`);
  }

  const status = json.data.status === 'success'
    ? 'success'
    : json.data.status === 'failed'
      ? 'failed'
      : 'abandoned';

  return {
    reference: json.data.reference,
    status,
    amountKobo: json.data.amount,
    currency: json.data.currency,
    paidAt: json.data.paid_at,
    metadata: json.data.metadata ?? {},
  };
}

// ---------------------------------------------------------------------------
// Paystack-specific error
// ---------------------------------------------------------------------------

export class PaystackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaystackError';
  }
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify an incoming Paystack webhook using HMAC-SHA512.
 * Returns true if the signature matches.
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string,
  secretKey: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secretKey),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign'],
    );

    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return computed === signature;
  } catch {
    return false;
  }
}
