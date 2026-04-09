/**
 * @webwaka/verticals-print-shop
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B3
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { PrintShopRepository } from './print-shop.js';

export const VERTICAL_SLUG = 'print-shop' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerPrintShopVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Printing & Branding Shop',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'cac_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['SALES_FORECAST', 'DEMAND_PLANNING'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
