/**
 * @webwaka/verticals-courier
 * M9 Transport Extended — Task V-TRN-EXT-2
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { CourierRepository } from './courier.js';

export const VERTICAL_SLUG = 'courier' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerCourierVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Courier Service',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'cac_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['DELIVERY_ETA_PREDICTION', 'FLEET_EFFICIENCY_REPORT'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
