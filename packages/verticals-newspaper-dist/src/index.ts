/**
 * @webwaka/verticals-newspaper-dist — public API
 * registerNewspaperDistVertical() wires this vertical into the WebWaka FSM registry
 * print_run INTEGER copies; advertiser_ref_id opaque
 * AI: L2 advisory cap — circulation and ad revenue aggregate only
 */

export * from './types.js';
export { NewspaperDistRepository } from './newspaper-dist.js';

export function registerNewspaperDistVertical() {
  return {
    slug: 'newspaper-dist',
    name: 'Newspaper Distribution / Media House',
    milestone: 'M12',
    primary_pillars: ['ops', 'media', 'marketplace'] as const,
    regulatory_gate: 'npc_verified',
    fsm_states: ['seeded', 'claimed', 'npc_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    kyc_tier_required: 2,
    p13_fields: ['advertiser_ref_id'],
    ussd_excluded: false,
  };
}
