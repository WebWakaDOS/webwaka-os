/**
 * @webwaka/verticals-rehab-centre
 * M12 — Rehabilitation / Recovery Centre vertical
 * Primary pillars: Ops, Branding, Marketplace
 * L3 HITL MANDATORY for ALL SuperAgent calls — no exceptions
 */

export * from './types.js';
export { RehabCentreRepository } from './rehab-centre.js';

export const VERTICAL_SLUG = 'rehab-centre' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerRehabCentreVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Rehabilitation / Recovery Centre',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'ndlea_verified', 'active', 'suspended'] as const,
    regulatory_gate: 'ndlea_verified' as const,
    ai_capabilities: ['HEALTH_FACILITY_BENCHMARK'] as const,
    ai_autonomy_level: 3 as const,
    hitl_required: true,
    hitl_required_for_all_ai: true,
    kyc_tier_default: 3 as const,
    kyc_tier_mandatory: true,
    p13_enforced: true,
    p13_most_sensitive: true,
    p12_ussd_ai_blocked: true,
    milestone: 'M12' as const,
  };
}
