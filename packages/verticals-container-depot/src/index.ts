/**
 * @webwaka/verticals-container-depot
 * M12 Transport Extended — Task V-TRN-EXT-6
 * Primary pillars: Ops, Marketplace
 */

export * from './types.js';
export { ContainerDepotRepository } from './container-depot.js';

export const VERTICAL_SLUG = 'container-depot' as const;
export const PRIMARY_PILLARS = ['ops', 'marketplace'] as const;

export function registerContainerDepotVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Container Depot / Logistics Hub',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'ncs_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['FLEET_EFFICIENCY_REPORT'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M12' as const,
  };
}
