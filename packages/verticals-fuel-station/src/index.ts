/**
 * @webwaka/verticals-fuel-station
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B2
 * Primary pillars: Ops, Marketplace
 */

export * from './types.js';
export { FuelStationRepository } from './fuel-station.js';

export const VERTICAL_SLUG = 'fuel-station' as const;
export const PRIMARY_PILLARS = ['ops', 'marketplace'] as const;

export function registerFuelStationVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Fuel / Filling Station',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'nuprc_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['SALES_FORECAST', 'DEMAND_PLANNING'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
