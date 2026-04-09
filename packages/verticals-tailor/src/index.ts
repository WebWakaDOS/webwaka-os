/**
 * @webwaka/verticals-tailor
 * M10 Commerce P2 Batch 2 — Task V-COMM-EXT-B10
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { TailorRepository } from './tailor.js';

export const VERTICAL_SLUG = 'tailor' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerTailorVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Tailoring / Fashion Designer',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'active', 'suspended'] as const,
    ai_capabilities: ['DEMAND_PLANNING', 'CUSTOMER_SEGMENTATION'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M10' as const,
  };
}
