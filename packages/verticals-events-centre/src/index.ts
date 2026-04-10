/**
 * @webwaka/verticals-events-centre — public API
 * registerEventsCentreVertical() wires this vertical into the WebWaka FSM registry
 * Multi-section section conflict check; total_nights INTEGER
 * AI: L2 advisory cap — section utilisation aggregate only
 */

export * from './types.js';
export { EventsCentreRepository } from './events-centre.js';

export function registerEventsCentreVertical() {
  return {
    slug: 'events-centre',
    name: 'Events Centre / Hall Rental',
    milestone: 'M12',
    primary_pillars: ['ops', 'marketplace', 'branding'] as const,
    regulatory_gate: 'licence_verified',
    fsm_states: ['seeded', 'claimed', 'licence_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    kyc_tier_required: 2,
    p13_fields: ['client_phone'],
    ussd_excluded: true,
  };
}
