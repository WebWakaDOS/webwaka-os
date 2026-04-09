/**
 * AI capability types and evaluation logic for WebWaka OS SuperAgent.
 * (SA-1.1 — TDR-0009, Platform Invariants P7, P10, P12)
 *
 * AICapabilityType enumerates every distinct AI feature surface.
 * evaluateAICapability checks context before any routing attempt.
 *
 * 3-in-1: capabilities are served across all three pillars.
 * P10: NDPR consent required before any capability executes.
 * P12: No AI on USSD sessions.
 * P13: No raw PII passed to AI providers.
 */

import type { AIRoutingContext, AIRoutingErrorCode } from './types.js';

// ---------------------------------------------------------------------------
// Capability taxonomy
// ---------------------------------------------------------------------------

/**
 * Every distinct AI feature surface in WebWaka OS.
 *
 * Pillar groupings (3-in-1 platform):
 *   Pillar 1 (Ops):          inventory_ai, pos_receipt_ai, shift_summary_ai, fraud_flag_ai
 *   Pillar 2 (Branding):     bio_generator, brand_copywriter, brand_image_alt, seo_meta_ai
 *   Pillar 3 (Marketplace):  listing_enhancer, review_summary, search_rerank, price_suggest
 *   Cross-pillar (chat/AI):  superagent_chat, function_call, embedding, content_moderation
 */
export type AICapabilityType =
  // Pillar 1 — Operations
  | 'inventory_ai'            // smart reorder suggestions, stock anomaly detection
  | 'pos_receipt_ai'          // receipt summary / item description enrichment
  | 'shift_summary_ai'        // end-of-shift sales narrative
  | 'fraud_flag_ai'           // transaction anomaly flagging
  | 'scheduling_assistant'    // intelligent scheduling (POS, transport, events)
  | 'demand_forecasting'      // demand/volume prediction from historical data
  | 'route_optimizer'         // logistics / last-mile route optimisation
  // Pillar 2 — Branding / Website
  | 'bio_generator'           // tenant bio from profile fields (P13: no raw PII to AI)
  | 'brand_copywriter'        // headline/tagline generation
  | 'brand_image_alt'         // alt-text generation for uploaded images
  | 'seo_meta_ai'             // page title + meta description generation
  | 'policy_summarizer'       // summarise policy / legal / government documents
  // Pillar 3 — Marketplace / Discovery
  | 'listing_enhancer'        // improve listing text quality
  | 'review_summary'          // aggregate review sentiment summary
  | 'search_rerank'           // semantic reranking of search results
  | 'price_suggest'           // price recommendation based on market signals
  | 'product_description_writer' // generate product descriptions for marketplace listings
  // Cross-pillar / general
  | 'superagent_chat'         // conversational assistant (tenant-configured persona)
  | 'function_call'           // structured output / tool call routing
  | 'embedding'               // text embedding for semantic search
  | 'content_moderation'      // text safety check before publish
  | 'sentiment_analysis'      // sentiment classification for reviews / feedback
  | 'translation'             // translate content to local Nigerian languages + Pidgin
  | 'document_extractor';     // extract structured data from PDFs / images (CAC, INEC, etc.)

// ---------------------------------------------------------------------------
// Capability → minimum plan required
// ---------------------------------------------------------------------------

const CAPABILITY_PLAN_TIER: Record<AICapabilityType, 'growth' | 'pro' | 'enterprise'> = {
  // Pillar 1 — Operations
  inventory_ai:              'growth',
  pos_receipt_ai:            'growth',
  shift_summary_ai:          'growth',
  fraud_flag_ai:             'pro',
  scheduling_assistant:      'growth',
  demand_forecasting:        'pro',
  route_optimizer:           'pro',
  // Pillar 2 — Branding
  bio_generator:             'growth',
  brand_copywriter:          'growth',
  brand_image_alt:           'growth',
  seo_meta_ai:               'growth',
  policy_summarizer:         'growth',
  // Pillar 3 — Marketplace
  listing_enhancer:          'growth',
  review_summary:            'growth',
  search_rerank:             'pro',
  price_suggest:             'pro',
  product_description_writer:'growth',
  // Cross-pillar
  superagent_chat:           'growth',
  function_call:             'pro',
  embedding:                 'growth',
  content_moderation:        'growth',
  sentiment_analysis:        'growth',
  translation:               'growth',
  document_extractor:        'pro',
};
export { CAPABILITY_PLAN_TIER };

// ---------------------------------------------------------------------------
// Capability evaluation result
// ---------------------------------------------------------------------------

export type CapabilityCheckResult =
  | { allowed: true }
  | { allowed: false; code: AIRoutingErrorCode; reason: string };

// ---------------------------------------------------------------------------
// evaluateAICapability
// ---------------------------------------------------------------------------

/**
 * Pre-routing capability gate.
 *
 * Runs ALL platform invariant checks in order before the routing engine
 * attempts key resolution. Fail-fast — returns the first violation found.
 *
 * Order of checks (matches SuperAgent ADL spec):
 *   1. P12 — block USSD sessions
 *   2. P10 — require NDPR consent
 *   3. aiRights — plan entitlement check
 *   4. Spend cap — monthly WakaCU budget
 */
export function evaluateAICapability(ctx: AIRoutingContext): CapabilityCheckResult {
  // P12 — absolutely no AI on USSD sessions
  if (ctx.isUssd) {
    return {
      allowed: false,
      code: 'USSD_EXCLUDED',
      reason: 'AI features are not available on USSD sessions (Platform Invariant P12).',
    };
  }

  // P10 — NDPR consent required before any AI processing
  if (!ctx.ndprConsentGranted) {
    return {
      allowed: false,
      code: 'CONSENT_REQUIRED',
      reason: 'NDPR AI-processing consent has not been granted by this user (Platform Invariant P10).',
    };
  }

  // Plan entitlement check
  if (!ctx.aiRights) {
    return {
      allowed: false,
      code: 'ENTITLEMENT_DENIED',
      reason: 'This workspace plan does not include AI features. Upgrade to Growth or above.',
    };
  }

  // Spend cap check (0 = unlimited for partner/enterprise plans)
  if (ctx.spendCapWakaCu > 0 && ctx.currentSpendWakaCu >= ctx.spendCapWakaCu) {
    return {
      allowed: false,
      code: 'SPEND_CAP_EXCEEDED',
      reason: `Monthly WakaCU spend cap of ${ctx.spendCapWakaCu} has been reached for this workspace.`,
    };
  }

  return { allowed: true };
}
