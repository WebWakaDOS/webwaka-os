/**
 * @webwaka/verticals-security-company
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B7
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { SecurityCompanyRepository } from './security-company.js';

export const VERTICAL_SLUG = 'security-company' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerSecurityCompanyVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Security Company / Guard Service',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'psc_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['SALES_FORECAST', 'CUSTOMER_SEGMENTATION'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
