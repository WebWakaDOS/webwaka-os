/**
 * @webwaka/verticals-construction
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B1
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { ConstructionRepository } from './construction.js';

export const VERTICAL_SLUG = 'construction' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerConstructionVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Construction Firm / Contractor',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'coren_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['PROJECT_COST_ESTIMATION'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
