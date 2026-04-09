/**
 * @webwaka/superagent — Cross-cutting AI layer for WebWaka OS.
 * (SA-1.4 through SA-2.3 — TDR-0009)
 *
 * SuperAgent is NOT a fourth pillar. It is the AI infrastructure that serves
 * all three pillars:
 *   Pillar 1 (Ops):        inventory_ai, pos_receipt_ai, shift_summary_ai, fraud_flag_ai
 *   Pillar 2 (Branding):   bio_generator, brand_copywriter, seo_meta_ai
 *   Pillar 3 (Marketplace): listing_enhancer, review_summary, search_rerank
 *
 * See docs/governance/3in1-platform-architecture.md
 *
 * Exports (SA-1.x):
 *   KeyService         — SA-1.4: BYOK key encryption + D1 storage
 *   WalletService      — SA-1.5: WakaCU balance + double-entry ledger
 *   PartnerPoolService — SA-1.6: Partner credit allocation
 *   CreditBurnEngine   — SA-1.7: AI spend accounting (pool → wallet → BYOK)
 *   UsageMeter         — SA-1.9: Audit log + pillar analytics
 *
 * Exports (SA-2.x):
 *   grantAiConsent     — SA-2.1: Record NDPR AI consent
 *   revokeAiConsent    — SA-2.1: Revoke NDPR AI consent
 *   getAiConsentStatus — SA-2.1: Check consent status
 *   listAiConsents     — SA-2.1: Audit history for DSAR
 *   aiConsentGate      — SA-2.2: Hono middleware (P10/P12/AI-rights guard)
 *   VERTICAL_AI_CONFIGS — SA-2.3: Per-vertical AI capability declarations
 *   getVerticalAiConfig — SA-2.3: Look up config by slug
 *   isCapabilityAllowed — SA-2.3: Check capability permission for a vertical
 */

export { KeyService } from './key-service.js';
export type { KeyServiceDeps, UpsertKeyInput, ResolveKeyResult } from './key-service.js';

export { WalletService } from './wallet-service.js';
export type { WalletServiceDeps } from './wallet-service.js';

export { PartnerPoolService } from './partner-pool-service.js';
export type { PartnerPoolServiceDeps } from './partner-pool-service.js';

export { CreditBurnEngine } from './credit-burn.js';
export type { CreditBurnInput, CreditBurnResult } from './credit-burn.js';

export { UsageMeter } from './usage-meter.js';
export type { UsageMeterDeps, RecordUsageInput } from './usage-meter.js';

export {
  grantAiConsent,
  revokeAiConsent,
  getAiConsentStatus,
  listAiConsents,
} from './consent-service.js';
export type {
  AiConsentPurpose,
  AiConsentLocale,
  AiConsentRecord,
  GrantConsentInput,
  ConsentStatus,
} from './consent-service.js';

export { aiConsentGate } from './middleware.js';

export {
  VERTICAL_AI_CONFIGS,
  getVerticalAiConfig,
  isCapabilityAllowed,
} from './vertical-ai-config.js';
export type { VerticalAiConfig } from './vertical-ai-config.js';

export type {
  SuperAgentKey,
  SuperAgentKeyScope,
  SuperAgentKeyProvider,
  WakaCuWallet,
  WakaCuTransaction,
  PartnerCreditPool,
  AiUsageEvent,
} from './types.js';
