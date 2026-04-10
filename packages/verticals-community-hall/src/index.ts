/**
 * @webwaka/verticals-community-hall — public API
 * registerCommunityHallVertical() wires this vertical into the WebWaka FSM registry
 * 3-state FSM: seeded → claimed → active
 * AI: L1 advisory cap — aggregate booking frequency by event type only
 */

export * from './types.js';
export { CommunityHallRepository } from './community-hall.js';

export function registerCommunityHallVertical() {
  return {
    slug: 'community-hall',
    name: 'Community Hall / Town Hall',
    milestone: 'M12',
    primary_pillars: ['ops', 'civics'] as const,
    regulatory_gate: null,
    fsm_states: ['seeded', 'claimed', 'active'],
    ai_autonomy_max: 'L1',
    kyc_tier_required: 1,
    p13_fields: [],
    ussd_excluded: false,
  };
}
