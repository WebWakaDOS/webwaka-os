/**
 * @webwaka/verticals-community-health
 * M12 — Community Health Worker (CHW) Network vertical
 * Primary pillars: Ops, Marketplace (no Branding)
 */

export * from './types.js';
export { CommunityHealthRepository } from './community-health.js';

export const VERTICAL_SLUG = 'community-health' as const;
export const PRIMARY_PILLARS = ['ops', 'marketplace'] as const;

export function registerCommunityHealthVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Community Health Worker Network',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'nphcda_registered', 'active', 'suspended'] as const,
    regulatory_gate: 'nphcda_registered' as const,
    ai_capabilities: ['HEALTH_FACILITY_BENCHMARK'] as const,
    ai_autonomy_level: 2 as const,
    hitl_required: false,
    hitl_required_for_household: true,
    kyc_tier_default: 1 as const,
    p13_enforced: true,
    p12_ussd_ai_blocked: true,
    ussd_data_routes_supported: true,
    milestone: 'M12' as const,
  };
}
