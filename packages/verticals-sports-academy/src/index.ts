/**
 * @webwaka/verticals-sports-academy
 * M10 — Sports Academy / Fitness Centre vertical
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { SportsAcademyRepository } from './sports-academy.js';

export const VERTICAL_SLUG = 'sports-academy' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerSportsAcademyVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Sports Academy / Fitness Centre',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'permit_verified', 'active', 'suspended'] as const,
    regulatory_gate: 'permit_verified' as const,
    ai_capabilities: ['APPOINTMENT_OPTIMIZATION', 'MEMBER_FLOW_REPORT'] as const,
    ai_autonomy_level: 2 as const,
    hitl_required: false,
    kyc_tier_default: 1 as const,
    kyc_tier_high_value: 2 as const,
    kyc_tier_high_value_threshold_kobo: 20_000_000,
    p13_enforced: true,
    p12_ussd_ai_blocked: true,
    milestone: 'M10' as const,
  };
}
