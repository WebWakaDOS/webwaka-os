/**
 * @webwaka/verticals-government-agency — public API
 * registerGovernmentAgencyVertical() wires this vertical into the WebWaka FSM registry
 * L3 HITL MANDATORY on ALL AI — government privilege; vendor_ref opaque (P13)
 * Tier 3 KYC mandatory
 */

export * from './types.js';
export { GovernmentAgencyRepository } from './government-agency.js';

export function registerGovernmentAgencyVertical() {
  return {
    slug: 'government-agency',
    name: 'Government Agency / MDA',
    milestone: 'M11',
    primary_pillars: ['ops', 'compliance', 'civic'] as const,
    regulatory_gate: 'bpp_registered',
    fsm_states: ['seeded', 'claimed', 'bpp_registered', 'active', 'suspended'],
    ai_autonomy_max: 'L3_HITL',
    kyc_tier_required: 3,
    p13_fields: ['vendor_ref', 'procurement_ref', 'budget_line_item'],
    ussd_excluded: true,
  };
}
