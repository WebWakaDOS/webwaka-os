/**
 * @webwaka/verticals-airtime-reseller — public API
 * registerAirtimeResellerVertical() wires this vertical into the WebWaka FSM registry
 * CBN sub-agent daily cap: 30,000,000 kobo (₦300,000)
 * AI: L2 advisory cap — daily revenue trend aggregate only
 */

export * from './types.js';
export { AirtimeResellerRepository } from './airtime-reseller.js';

export function registerAirtimeResellerVertical() {
  return {
    slug: 'airtime-reseller',
    name: 'Airtime / VTU Reseller',
    milestone: 'M12',
    primary_pillars: ['ops', 'marketplace'] as const,
    regulatory_gate: 'ncc_verified',
    fsm_states: ['seeded', 'claimed', 'ncc_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    kyc_tier_required: 2,
    p13_fields: ['recipient_phone'],
    ussd_excluded: false,
    cbn_daily_cap_kobo: 30_000_000,
  };
}
