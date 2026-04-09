/**
 * @webwaka/verticals-property-developer
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B4
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { PropertyDeveloperRepository } from './property-developer.js';

export const VERTICAL_SLUG = 'property-developer' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerPropertyDeveloperVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Property Developer',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'surcon_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['PROPERTY_VALUATION_ASSIST'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
