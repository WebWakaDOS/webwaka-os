/**
 * @webwaka/verticals-elderly-care
 * M12 — Elderly Care Facility vertical
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { ElderlyCareRepository } from './elderly-care.js';

export const VERTICAL_SLUG = 'elderly-care' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerElderlyCareVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Elderly Care Facility',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'fmhsw_verified', 'active', 'suspended'] as const,
    regulatory_gate: 'fmhsw_verified' as const,
    ai_capabilities: ['HEALTH_FACILITY_BENCHMARK'] as const,
    ai_autonomy_level: 2 as const,
    hitl_required: false,
    hitl_required_for_resident_metrics: true,
    kyc_tier_default: 2 as const,
    kyc_tier_diaspora: 3 as const,
    kyc_tier_diaspora_threshold_kobo: 500_000_000,
    p13_enforced: true,
    p12_ussd_ai_blocked: true,
    milestone: 'M12' as const,
  };
}
