/**
 * @webwaka/verticals-podcast-studio — public API
 * registerPodcastStudioVertical() wires this vertical into the WebWaka FSM registry
 * L3 HITL required for BROADCAST_SCHEDULING_ASSIST (NBC compliance)
 * L2 for sponsorship revenue aggregate
 */

export * from './types.js';
export { PodcastStudioRepository } from './podcast-studio.js';

export function registerPodcastStudioVertical() {
  return {
    slug: 'podcast-studio',
    name: 'Podcast Studio / Digital Media',
    milestone: 'M12',
    primary_pillars: ['ops', 'media', 'branding'] as const,
    regulatory_gate: 'cac_verified',
    fsm_states: ['seeded', 'claimed', 'cac_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    ai_l3_operations: ['BROADCAST_SCHEDULING_ASSIST'],
    kyc_tier_required: 2,
    p13_fields: ['guest_ref_id', 'sponsor_ref_id'],
    ussd_excluded: true,
  };
}
