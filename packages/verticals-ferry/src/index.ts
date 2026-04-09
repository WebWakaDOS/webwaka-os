/**
 * @webwaka/verticals-ferry
 * M12 Transport Extended — Task V-TRN-EXT-7
 * Primary pillars: Ops, Marketplace
 */

export * from './types.js';
export { FerryRepository } from './ferry.js';

export const VERTICAL_SLUG = 'ferry' as const;
export const PRIMARY_PILLARS = ['ops', 'marketplace'] as const;

export function registerFerryVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Ferry / Water Transport Operator',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'nimasa_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['ROUTE_OPTIMIZATION', 'FLEET_EFFICIENCY_REPORT'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M12' as const,
  };
}
