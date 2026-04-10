/**
 * @webwaka/verticals-hire-purchase — public API
 * registerHirePurchaseVertical() wires this vertical into the WebWaka FSM registry
 * installments INTEGER; tenor_months INTEGER; outstanding_kobo tracked per repayment
 * AI: L2 advisory cap — repayment collection aggregate only
 */

export * from './types.js';
export { HirePurchaseRepository } from './hire-purchase.js';

export function registerHirePurchaseVertical() {
  return {
    slug: 'hire-purchase',
    name: 'Hire Purchase / Asset Finance',
    milestone: 'M12',
    primary_pillars: ['ops', 'marketplace'] as const,
    regulatory_gate: 'cbn_verified',
    fsm_states: ['seeded', 'claimed', 'cbn_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    kyc_tier_required: 3,
    p13_fields: ['customer_bvn_ref'],
    ussd_excluded: true,
  };
}
