/**
 * @webwaka/verticals-welding-fabrication
 * M10 Commerce P2 Batch 2 — Task V-COMM-EXT-B12
 * Primary pillars: Ops, Marketplace
 */

export * from './types.js';
export { WeldingFabricationRepository } from './welding-fabrication.js';

export const VERTICAL_SLUG = 'welding-fabrication' as const;
export const PRIMARY_PILLARS = ['ops', 'marketplace'] as const;

export function registerWeldingFabricationVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Welding / Fabrication Shop',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'active', 'suspended'] as const,
    ai_capabilities: ['SALES_FORECAST', 'DEMAND_PLANNING'] as const,
    ai_autonomy_level: 1 as const,
    milestone: 'M10' as const,
  };
}
