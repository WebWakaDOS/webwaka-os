/**
 * @webwaka/verticals-nurtw
 * M12 Transport Extended — Task V-TRN-EXT-8
 * Primary pillars: Ops, Marketplace
 * AI: L3 HITL — all AI output on membership/leadership requires human review
 */

export * from './types.js';
export { NurtwRepository } from './nurtw.js';

export const VERTICAL_SLUG = 'nurtw' as const;
export const PRIMARY_PILLARS = ['ops', 'marketplace'] as const;

export function registerNurtwVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Road Transport Workers Union (NURTW)',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'nurtw_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['FLEET_EFFICIENCY_REPORT'] as const,
    ai_autonomy_level: 3 as const,
    ai_hitl: true as const,
    milestone: 'M12' as const,
  };
}
