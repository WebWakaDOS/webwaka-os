/**
 * @webwaka/negotiation — Public API
 *
 * Negotiable pricing engine: vendor policy, listing overrides,
 * offer/counteroffer FSM, guardrail evaluation, price-lock tokens.
 *
 * Negotiation is a PRICING CAPABILITY — not a marketplace type.
 * Fixed pricing is always the default and is never modified by this package.
 */

export * from './types.js';
export * from './guardrails.js';
export { NegotiationRepository } from './repository.js';
export {
  NegotiationEngine,
  NEGOTIATION_BLOCKED_VERTICALS,
  SINGLE_ITEM_LISTING_TYPES,
  isNegotiationBlocked,
  isSingleItemListing,
} from './engine.js';
export { generatePriceLockToken, verifyPriceLockToken } from './price-lock.js';
