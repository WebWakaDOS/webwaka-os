/**
 * @webwaka/verticals-advertising-agency — public API
 * registerAdvertisingAgencyVertical() wires this vertical into the WebWaka FSM registry
 * impressions INTEGER; CPM in kobo INTEGER; client_ref_id opaque
 * AI: L2 advisory cap — campaign performance aggregate only
 */

export * from './types.js';
export { AdvertisingAgencyRepository } from './advertising-agency.js';

export function registerAdvertisingAgencyVertical() {
  return {
    slug: 'advertising-agency',
    name: 'Advertising Agency',
    milestone: 'M9',
    primary_pillars: ['ops', 'branding', 'media'] as const,
    regulatory_gate: 'apcon_verified',
    fsm_states: ['seeded', 'claimed', 'apcon_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    kyc_tier_required: 2,
    p13_fields: ['client_ref_id', 'creative_brief'],
    ussd_excluded: true,
  };
}
