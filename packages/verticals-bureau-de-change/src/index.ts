/**
 * @webwaka/verticals-bureau-de-change — public API
 * registerBureauDeChangeVertical() wires this vertical into the WebWaka FSM registry
 * FX rates: integer kobo per USD cent — NO floats; USD amounts: integer cents
 * AI: L2 advisory cap — FX position aggregate only; no rate automation
 */

export * from './types.js';
export { BureauDeChangeRepository } from './bureau-de-change.js';

export function registerBureauDeChangeVertical() {
  return {
    slug: 'bureau-de-change',
    name: 'Bureau de Change / FX Dealer',
    milestone: 'M12',
    primary_pillars: ['ops', 'compliance'] as const,
    regulatory_gate: 'cbn_verified',
    fsm_states: ['seeded', 'claimed', 'cbn_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    kyc_tier_required: 3,
    p13_fields: ['customer_bvn_ref'],
    ussd_excluded: true,
    fx_rate_unit: 'kobo_per_usd_cent',
  };
}
