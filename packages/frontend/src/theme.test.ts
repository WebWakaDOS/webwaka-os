import { describe, it, expect } from 'vitest';
import { brandingToCssVars, validateBranding } from './theme.js';
import type { TenantBranding } from './tenant-manifest.js';

const BRANDING: TenantBranding = {
  primaryColour: '#1a1a2e',
  secondaryColour: '#e94560',
  fontFamily: 'Inter, sans-serif',
  logoUrl: 'https://example.com/logo.png',
};

describe('brandingToCssVars', () => {
  it('converts branding to CSS custom properties', () => {
    const vars = brandingToCssVars(BRANDING);

    expect(vars['--colour-primary']).toBe('#1a1a2e');
    expect(vars['--colour-secondary']).toBe('#e94560');
    expect(vars['--font-family']).toBe('Inter, sans-serif');
    expect(vars['--logo-url']).toContain('https://example.com/logo.png');
  });

  it('uses default font-family when none provided', () => {
    const vars = brandingToCssVars({ primaryColour: '#fff', secondaryColour: '#000' });
    expect(vars['--font-family']).toBe('Inter, sans-serif');
  });

  it('sets --logo-url to none when logoUrl is absent', () => {
    const vars = brandingToCssVars({ primaryColour: '#fff', secondaryColour: '#000' });
    expect(vars['--logo-url']).toBe('none');
  });
});

describe('validateBranding', () => {
  it('returns valid for a correct branding object', () => {
    const result = validateBranding({
      primaryColour: '#ff0000',
      secondaryColour: '#00ff00',
      logoUrl: 'https://cdn.example.com/logo.png',
      fontFamily: 'Roboto, sans-serif',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.branding?.primaryColour).toBe('#ff0000');
  });

  it('accepts 3-character hex colours', () => {
    const result = validateBranding({ primaryColour: '#fff' });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid hex colours', () => {
    const result = validateBranding({ primaryColour: 'red' });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('primaryColour');
  });

  it('rejects non-https logoUrl', () => {
    const result = validateBranding({ logoUrl: 'http://insecure.example.com/logo.png' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('logoUrl');
  });

  it('rejects fontFamily longer than 100 characters', () => {
    const result = validateBranding({ fontFamily: 'A'.repeat(101) });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('fontFamily');
  });

  it('returns valid for empty object (no fields = no errors)', () => {
    const result = validateBranding({});
    expect(result.valid).toBe(true);
    expect(result.branding).toEqual({});
  });

  it('accumulates multiple errors', () => {
    const result = validateBranding({
      primaryColour: 'notahex',
      secondaryColour: 'alsowrong',
      logoUrl: 'ftp://wrong.com/logo.png',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
