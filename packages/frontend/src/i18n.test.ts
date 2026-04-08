/**
 * i18n locale tests (M7e)
 * Minimum: 4 tests
 * Validates: Naija Pidgin + English locale completeness and key content
 */

import { describe, it, expect } from 'vitest';
import { pcmLocale } from './i18n/pcm.js';
import { enLocale } from './i18n/en.js';

describe('pcmLocale', () => {
  it('contains all keys from enLocale (no missing keys)', () => {
    const enKeys = Object.keys(enLocale);
    const pcmKeys = new Set(Object.keys(pcmLocale));
    const missing = enKeys.filter((k) => !pcmKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('pcmLocale["auth.login"] returns Pidgin string "Enter"', () => {
    expect(pcmLocale['auth.login']).toBe('Enter');
  });

  it('pcmLocale["wallet.balance"] contains ₦{{amount}} template token', () => {
    expect(pcmLocale['wallet.balance']).toContain('₦{{amount}}');
  });
});

describe('enLocale', () => {
  it('enLocale["wallet.balance"] contains ₦{{amount}} matching pcm structure', () => {
    expect(enLocale['wallet.balance']).toContain('₦{{amount}}');
  });

  it('enLocale["auth.login"] is "Sign In" (English baseline)', () => {
    expect(enLocale['auth.login']).toBe('Sign In');
  });

  it('enLocale has at least 30 keys', () => {
    expect(Object.keys(enLocale).length).toBeGreaterThanOrEqual(30);
  });
});
