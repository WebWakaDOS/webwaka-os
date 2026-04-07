/**
 * Theme utilities — generate CSS custom properties from TenantBranding,
 * or validate a submitted theme update.
 *
 * Milestone 6 — Frontend Composition Layer
 */

import type { TenantBranding } from './tenant-manifest.js';

// ---------------------------------------------------------------------------
// CSS custom property map
// ---------------------------------------------------------------------------

export interface ThemeCSSVars {
  '--colour-primary': string;
  '--colour-secondary': string;
  '--font-family': string;
  '--logo-url': string;
}

// ---------------------------------------------------------------------------
// brandingToCssVars — convert a TenantBranding to CSS custom property map
// ---------------------------------------------------------------------------

export function brandingToCssVars(branding: TenantBranding): ThemeCSSVars {
  return {
    '--colour-primary': branding.primaryColour,
    '--colour-secondary': branding.secondaryColour,
    '--font-family': branding.fontFamily ?? 'Inter, sans-serif',
    '--logo-url': branding.logoUrl ? `url('${branding.logoUrl}')` : 'none',
  };
}

// ---------------------------------------------------------------------------
// validateBranding — validate a raw theme submission
// ---------------------------------------------------------------------------

export interface ThemeValidationResult {
  valid: boolean;
  errors: string[];
  branding?: Partial<TenantBranding>;
}

const HEX_RE = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const URL_RE = /^https:\/\/.+/;

export function validateBranding(
  raw: Record<string, unknown>,
): ThemeValidationResult {
  const errors: string[] = [];

  const primaryColour = typeof raw['primaryColour'] === 'string' ? raw['primaryColour'] : undefined;
  const secondaryColour = typeof raw['secondaryColour'] === 'string' ? raw['secondaryColour'] : undefined;
  const logoUrl = typeof raw['logoUrl'] === 'string' ? raw['logoUrl'] : undefined;
  const fontFamily = typeof raw['fontFamily'] === 'string' ? raw['fontFamily'] : undefined;

  if (primaryColour !== undefined && !HEX_RE.test(primaryColour)) {
    errors.push('primaryColour must be a valid hex colour (e.g. #1a1a2e)');
  }
  if (secondaryColour !== undefined && !HEX_RE.test(secondaryColour)) {
    errors.push('secondaryColour must be a valid hex colour');
  }
  if (logoUrl !== undefined && !URL_RE.test(logoUrl)) {
    errors.push('logoUrl must be an absolute https:// URL');
  }
  if (fontFamily !== undefined && fontFamily.length > 100) {
    errors.push('fontFamily must be ≤ 100 characters');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const branding: Partial<TenantBranding> = {};
  if (primaryColour !== undefined) branding.primaryColour = primaryColour;
  if (secondaryColour !== undefined) branding.secondaryColour = secondaryColour;
  if (logoUrl !== undefined) branding.logoUrl = logoUrl;
  if (fontFamily !== undefined) branding.fontFamily = fontFamily;

  return { valid: true, errors: [], branding };
}
