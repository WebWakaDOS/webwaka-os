/**
 * @webwaka/verticals-restaurant-chain
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B6
 * Primary pillars: Ops, Branding, Marketplace
 * Note: distinct from P1 'restaurant' vertical (single-outlet basic)
 */

export * from './types.js';
export { RestaurantChainRepository } from './restaurant-chain.js';

export const VERTICAL_SLUG = 'restaurant-chain' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerRestaurantChainVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Restaurant / Food Chain Outlet',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'nafdac_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['MENU_OPTIMIZATION', 'SALES_FORECAST'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
