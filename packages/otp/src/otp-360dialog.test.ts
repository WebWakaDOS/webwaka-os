/**
 * 360dialog WhatsApp OTP provider tests (M7f)
 * Minimum: 3 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendWhatsAppOTP360dialog } from './whatsapp-meta.js';
import type { OTPPurpose } from './types.js';

describe('sendWhatsAppOTP360dialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends message via 360dialog API and returns success result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'gBEGkFokpuCIAgkZEjFNKM8KWIA' }] }),
    }));

    const result = await sendWhatsAppOTP360dialog(
      '+2348011111111',
      '123456',
      'verification' as OTPPurpose,
      'dialog360_api_key_test',
      Math.floor(Date.now() / 1000) + 300,
    );

    expect(result.channel).toBe('whatsapp');
    expect(result.sent).toBe(true);
    expect(typeof result.message_id).toBe('string');
  });

  it('throws OTPError when 360dialog API returns non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Unauthorized', type: 'OAuthException' } }),
    }));

    const { OTPError } = await import('./types.js');
    await expect(
      sendWhatsAppOTP360dialog(
        '+2348011111111',
        '123456',
        'verification' as OTPPurpose,
        'bad_key',
        Math.floor(Date.now() / 1000) + 300,
      ),
    ).rejects.toThrow(OTPError);
  });

  it('blocks transaction purpose OTPs via 360dialog (R8)', async () => {
    const { OTPError } = await import('./types.js');
    await expect(
      sendWhatsAppOTP360dialog(
        '+2348011111111',
        '654321',
        'transaction' as OTPPurpose,
        'any_key',
        Math.floor(Date.now() / 1000) + 300,
      ),
    ).rejects.toThrow(OTPError);
  });
});
