/**
 * @webwaka/verticals-spa
 * M10 Commerce P2 Batch 2 — Task V-COMM-EXT-B9
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { SpaRepository } from './spa.js';

export const VERTICAL_SLUG = 'spa' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerSpaVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Spa / Massage Parlour',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'permit_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['APPOINTMENT_OPTIMIZATION', 'CUSTOMER_SEGMENTATION'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M10' as const,
  };
}
