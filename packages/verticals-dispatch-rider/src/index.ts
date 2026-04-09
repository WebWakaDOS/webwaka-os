/**
 * @webwaka/verticals-dispatch-rider
 * M9 Transport Extended — Task V-TRN-EXT-3
 * Primary pillars: Ops, Marketplace
 */

export * from './types.js';
export { DispatchRiderRepository } from './dispatch-rider.js';

export const VERTICAL_SLUG = 'dispatch-rider' as const;
export const PRIMARY_PILLARS = ['ops', 'marketplace'] as const;

export function registerDispatchRiderVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Dispatch Rider Network',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'frsc_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['FLEET_EFFICIENCY_REPORT'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
