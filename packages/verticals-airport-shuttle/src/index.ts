/**
 * @webwaka/verticals-airport-shuttle
 * M12 Transport Extended — Task V-TRN-EXT-4
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { AirportShuttleRepository } from './airport-shuttle.js';

export const VERTICAL_SLUG = 'airport-shuttle' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerAirportShuttleVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Airport Shuttle Service',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'faan_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['ROUTE_OPTIMIZATION', 'FLEET_EFFICIENCY_REPORT'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M12' as const,
  };
}
