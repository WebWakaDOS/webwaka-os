/**
 * USSD shortcode utility tests (M7e)
 * Minimum: 4 tests
 */

import { describe, it, expect } from 'vitest';
import { USSD_SHORTCODE, formatUSSDPrompt, getUSSDDialLink } from './ussd-shortcode.js';

describe('USSD shortcode utilities', () => {
  it('USSD_SHORTCODE equals *384#', () => {
    expect(USSD_SHORTCODE).toBe('*384#');
  });

  it('formatUSSDPrompt("en") contains *384#', () => {
    const text = formatUSSDPrompt('en');
    expect(text).toContain('*384#');
    expect(text).toContain('data');
  });

  it('formatUSSDPrompt("pcm") contains *384# and Pidgin text', () => {
    const text = formatUSSDPrompt('pcm');
    expect(text).toContain('*384#');
    expect(text.toLowerCase()).toMatch(/dial|phone|data/);
  });

  it('getUSSDDialLink() returns a tel: URI', () => {
    const link = getUSSDDialLink();
    expect(link.startsWith('tel:')).toBe(true);
    expect(link).toContain('384');
  });
});
