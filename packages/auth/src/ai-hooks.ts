/**
 * Auth hooks for AI-enabled requests.
 * (SA-1.8 — TDR-0009, Platform Invariants P10, P12, P13)
 *
 * Extracts the AIRoutingContext from an authenticated request.
 * The routing context is passed to the SuperAgent routing engine
 * (resolveAdapter in @webwaka/ai) for every AI feature call.
 *
 * P10: NDPR consent must be checked — never pass a request to AI adapters
 *      without verifying ndprConsentGranted.
 * P12: USSD sessions must NEVER receive AI features.
 * P13: The calling layer must strip PII from AIRequest.messages before
 *      passing to any adapter. This file does not enforce P13 (it's at
 *      the call site) but documents the obligation.
 */

import type { AuthContext } from '@webwaka/types';
import type { AIRoutingContext, AICapabilityType } from '@webwaka/ai';

// ---------------------------------------------------------------------------
// NDPR consent check
// ---------------------------------------------------------------------------

/**
 * Check whether the user has granted AI-processing consent.
 * Called by the AI auth middleware before any AI feature call.
 *
 * Consent is stored in the `consent_records` table:
 *   SELECT granted FROM consent_records
 *   WHERE user_id = ? AND purpose = 'ai_processing'
 *   ORDER BY created_at DESC LIMIT 1
 *
 * This function accepts a pre-resolved boolean for performance
 * (callers fetch and cache consent status once per request).
 */
export function assertNdprConsent(ndprConsentGranted: boolean): void {
  if (!ndprConsentGranted) {
    throw new AIAuthError(
      'NDPR_CONSENT_REQUIRED',
      'AI processing requires explicit user consent (NDPR Article 2.1). ' +
      'User must accept AI data processing terms before this feature is enabled.',
    );
  }
}

// ---------------------------------------------------------------------------
// USSD guard
// ---------------------------------------------------------------------------

/**
 * Throws if the current request originates from a USSD session.
 * Must be called before any AI feature is invoked.
 *
 * USSD context is detected via the X-Waka-Channel: ussd header
 * (set by the USSD Gateway Worker, verified via INTER_SERVICE_SECRET).
 */
export function assertNotUssd(channel: string | null | undefined): void {
  if (channel === 'ussd') {
    throw new AIAuthError(
      'USSD_AI_BLOCKED',
      'AI features are not available on USSD sessions (Platform Invariant P12). ' +
      'Guide the user to the WebWaka mobile app or web portal for AI-enabled features.',
    );
  }
}

// ---------------------------------------------------------------------------
// AIRoutingContext builder
// ---------------------------------------------------------------------------

export interface BuildAIRoutingContextInput {
  auth: AuthContext;
  capability: AICapabilityType;
  /** Originating pillar: 1=Ops, 2=Branding, 3=Marketplace */
  pillar: 1 | 2 | 3;
  /** Whether the request comes from a USSD session (P12) */
  isUssd: boolean;
  /** Whether NDPR AI-processing consent has been granted (P10) */
  ndprConsentGranted: boolean;
  /**
   * Whether this workspace plan includes AI rights.
   * Resolved from PLAN_CONFIGS[plan].aiRights in @webwaka/entitlements.
   */
  aiRights: boolean;
  /** Current month WakaCU spend from the wallet service */
  currentSpendWakaCu: number;
  /** Monthly spend cap from the wallet (0 = unlimited) */
  spendCapWakaCu: number;
}

/**
 * Build an AIRoutingContext from a verified AuthContext.
 *
 * This is the bridge between the auth layer and the SuperAgent routing engine.
 * Call this in every Hono route or middleware that gates an AI feature.
 *
 * Example usage in a Hono route:
 * ```ts
 * const ctx = buildAIRoutingContext({
 *   auth: c.get('auth'),
 *   capability: 'bio_generator',
 *   pillar: 2,
 *   isUssd: c.req.header('x-waka-channel') === 'ussd',
 *   ndprConsentGranted: await getConsentStatus(auth.userId, env.DB),
 *   currentSpendWakaCu: wallet.currentMonthSpentWakaCu,
 *   spendCapWakaCu: wallet.spendCapMonthlyWakaCu,
 * });
 * const resolved = await resolveAdapter(ctx, Object.fromEntries(c.env));
 * ```
 */
export function buildAIRoutingContext(
  input: BuildAIRoutingContextInput,
): AIRoutingContext {
  const {
    auth,
    capability,
    pillar,
    isUssd,
    ndprConsentGranted,
    aiRights,
    currentSpendWakaCu,
    spendCapWakaCu,
  } = input;

  return {
    pillar,
    tenantId: auth.tenantId,
    isUssd,
    ndprConsentGranted,
    aiRights,
    spendCapWakaCu,
    currentSpendWakaCu,
    capability,
  };
}

// ---------------------------------------------------------------------------
// NDPR consent helper (for D1-backed consent lookup)
// ---------------------------------------------------------------------------

/**
 * Fetch NDPR AI-processing consent status for a user from D1.
 * Returns true if the user has an active consent record for purpose 'ai_processing'.
 * Returns false (not throws) if consent is absent — callers decide how to handle.
 */
export async function getNdprConsentStatus(
  userId: string,
  tenantId: string,
  db: D1Database,
): Promise<boolean> {
  // Queries superagent_consents (migration 0046 — dedicated AI consent table).
  // superagent_consents uses revoked_at IS NULL to indicate active consent.
  const row = await db
    .prepare(
      `SELECT granted FROM superagent_consents
       WHERE user_id = ? AND tenant_id = ? AND purpose = 'ai_processing'
         AND revoked_at IS NULL
       ORDER BY granted_at DESC
       LIMIT 1`,
    )
    .bind(userId, tenantId)
    .first<{ granted: number }>();

  return row !== null && row.granted === 1;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export type AIAuthErrorCode =
  | 'NDPR_CONSENT_REQUIRED'
  | 'USSD_AI_BLOCKED'
  | 'AI_RIGHTS_DENIED';

export class AIAuthError extends Error {
  readonly code: AIAuthErrorCode;
  constructor(code: AIAuthErrorCode, message: string) {
    super(message);
    this.name = 'AIAuthError';
    this.code = code;
  }
}
