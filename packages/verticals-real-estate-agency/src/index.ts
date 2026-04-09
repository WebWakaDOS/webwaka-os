/**
 * @webwaka/verticals-real-estate-agency
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B5
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { RealEstateAgencyRepository } from './real-estate-agency.js';

export const VERTICAL_SLUG = 'real-estate-agency' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerRealEstateAgencyVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Real Estate Agency',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'niesv_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['PROPERTY_VALUATION_ASSIST', 'SALES_FORECAST'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
