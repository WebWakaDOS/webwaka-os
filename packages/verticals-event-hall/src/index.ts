/**
 * @webwaka/verticals-event-hall — public API
 * registerEventHallVertical() wires this vertical into the WebWaka FSM registry
 * Double-booking prevention; capacity_guests INTEGER
 * AI: L2 advisory cap — venue utilisation aggregate by event type
 */

export * from './types.js';
export { EventHallRepository } from './event-hall.js';

export function registerEventHallVertical() {
  return {
    slug: 'event-hall',
    name: 'Event Hall / Venue',
    milestone: 'M10',
    primary_pillars: ['ops', 'marketplace', 'branding'] as const,
    regulatory_gate: 'licence_verified',
    fsm_states: ['seeded', 'claimed', 'licence_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    kyc_tier_required: 2,
    p13_fields: ['client_phone'],
    ussd_excluded: true,
  };
}
