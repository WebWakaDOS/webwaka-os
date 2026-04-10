/**
 * @webwaka/verticals-mobile-money-agent — public API
 * registerMobileMoneyAgentVertical() wires this vertical into the WebWaka FSM registry
 * CBN sub-agent daily cap: 30,000,000 kobo (₦300,000) default; float management
 * AI: L2 advisory cap — daily float utilisation aggregate only
 */

export * from './types.js';
export { MobileMoneyAgentRepository } from './mobile-money-agent.js';

export function registerMobileMoneyAgentVertical() {
  return {
    slug: 'mobile-money-agent',
    name: 'Mobile Money Agent',
    milestone: 'M12',
    primary_pillars: ['ops', 'marketplace'] as const,
    regulatory_gate: 'cbn_agent_verified',
    fsm_states: ['seeded', 'claimed', 'cbn_agent_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    kyc_tier_required: 3,
    p13_fields: ['customer_bvn_ref'],
    ussd_excluded: false,
    cbn_daily_cap_kobo: 30_000_000,
  };
}
