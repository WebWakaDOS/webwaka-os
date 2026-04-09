/**
 * @webwaka/verticals-vet-clinic
 * M10 — Veterinary Clinic / Pet Shop vertical
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { VetClinicRepository } from './vet-clinic.js';

export const VERTICAL_SLUG = 'vet-clinic' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerVetClinicVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Veterinary Clinic / Pet Shop',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'vcnb_verified', 'active', 'suspended'] as const,
    regulatory_gate: 'vcnb_verified' as const,
    ai_capabilities: ['APPOINTMENT_OPTIMIZATION', 'DEMAND_PLANNING'] as const,
    ai_autonomy_level: 2 as const,
    hitl_required: false,
    kyc_tier_default: 1 as const,
    kyc_tier_surgery: 2 as const,
    kyc_tier_surgery_threshold_kobo: 10_000_000,
    p13_enforced: true,
    p12_ussd_ai_blocked: true,
    milestone: 'M10' as const,
  };
}
