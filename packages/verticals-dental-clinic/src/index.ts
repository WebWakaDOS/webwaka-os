/**
 * @webwaka/verticals-dental-clinic
 * M9 — Dental Clinic / Orthodontist vertical
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { DentalClinicRepository } from './dental-clinic.js';

export const VERTICAL_SLUG = 'dental-clinic' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerDentalClinicVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Dental Clinic / Orthodontist',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'mdcn_verified', 'active', 'suspended'] as const,
    regulatory_gate: 'mdcn_verified' as const,
    ai_capabilities: ['APPOINTMENT_OPTIMIZATION', 'PATIENT_FLOW_REPORT'] as const,
    ai_autonomy_level: 2 as const,
    hitl_required: false,
    hitl_required_for_clinical: true,
    kyc_tier_default: 2 as const,
    kyc_tier_insurance: 3 as const,
    p13_enforced: true,
    p12_ussd_ai_blocked: true,
    milestone: 'M9' as const,
  };
}
