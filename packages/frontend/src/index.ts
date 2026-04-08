/**
 * @webwaka/frontend — Frontend composition utilities (tenant manifest, profile renderer,
 * admin layout, discovery page model, theme utilities, i18n, USSD shortcode).
 *
 * Milestone 6 — Frontend Composition Layer
 * M7e — Naija Pidgin locale, USSD shortcode utilities
 */

export type {
  TenantBranding,
  TenantFeatureFlags,
  TenantManifest,
} from './tenant-manifest.js';

export {
  buildTenantManifest,
  getTenantManifestBySlug,
  getTenantManifestById,
} from './tenant-manifest.js';

export type { ProfileRow, RenderedProfile } from './profile-renderer.js';
export { renderProfile, renderProfileList } from './profile-renderer.js';

export type { NavItem, AdminLayout } from './admin-layout.js';
export { buildAdminLayout } from './admin-layout.js';

export type {
  DiscoveryQuery,
  DiscoveryFacet,
  DiscoveryPage,
} from './discovery-page.js';
export { buildDiscoveryPage, normaliseDiscoveryQuery } from './discovery-page.js';

export type { ThemeCSSVars, ThemeValidationResult } from './theme.js';
export { brandingToCssVars, validateBranding } from './theme.js';

// M7e — i18n locale strings (Naija Pidgin + English)
export { pcmLocale, enLocale } from './i18n/index.js';
export type { LocaleKey } from './i18n/index.js';

// M7e — USSD shortcode display utilities
export {
  USSD_SHORTCODE,
  USSD_SHORTCODE_DISPLAY,
  formatUSSDPrompt,
  getUSSDDialLink,
} from './ussd-shortcode.js';
