/**
 * @webwaka/verticals-cargo-truck
 * M12 Transport Extended — Task V-TRN-EXT-5
 * Primary pillars: Ops, Marketplace
 */

export * from './types.js';
export { CargoTruckRepository } from './cargo-truck.js';

export const VERTICAL_SLUG = 'cargo-truck' as const;
export const PRIMARY_PILLARS = ['ops', 'marketplace'] as const;

export function registerCargoTruckVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Cargo Truck Fleet Operator',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'frsc_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['FLEET_EFFICIENCY_REPORT', 'ROUTE_OPTIMIZATION'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M12' as const,
  };
}
