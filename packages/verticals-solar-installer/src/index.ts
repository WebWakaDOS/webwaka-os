/**
 * @webwaka/verticals-solar-installer
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B8
 * Primary pillars: Ops, Branding, Marketplace
 */

export * from './types.js';
export { SolarInstallerRepository } from './solar-installer.js';

export const VERTICAL_SLUG = 'solar-installer' as const;
export const PRIMARY_PILLARS = ['ops', 'branding', 'marketplace'] as const;

export function registerSolarInstallerVertical() {
  return {
    slug: VERTICAL_SLUG,
    display_name: 'Solar / Renewable Energy Installer',
    primary_pillars: PRIMARY_PILLARS,
    fsm_states: ['seeded', 'claimed', 'nerc_verified', 'active', 'suspended'] as const,
    ai_capabilities: ['ENERGY_AUDIT', 'SALES_FORECAST'] as const,
    ai_autonomy_level: 2 as const,
    milestone: 'M9' as const,
  };
}
