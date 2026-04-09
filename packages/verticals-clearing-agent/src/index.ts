/**
 * @webwaka/verticals-clearing-agent
 * M9 Transport Extended — Task V-TRN-EXT-1
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { ClearingAgentRepository } from './clearing-agent.js';

export const VERTICAL_SLUG = 'clearing-agent' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerClearingAgentVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Clearing & Forwarding Agent',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'ncs_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['FLEET_EFFICIENCY_REPORT'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
