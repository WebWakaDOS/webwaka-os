/**
 * WhatsApp OTP delivery — Meta Cloud API v18.0 + 360dialog (M7a + M7f)
 * Secondary OTP channel — used when SMS fails or user prefers WhatsApp.
 * (docs/identity/otp-channels.md — Secondary: WhatsApp)
 * R8: WhatsApp is NOT permitted for transaction-purpose OTPs as primary.
 *
 * M7f: Adds sendWhatsAppOTP360dialog() for 360dialog Business API support.
 * Provider selection handled by multi-channel.ts via WHATSAPP_PROVIDER env var.
 */

import { type OTPSendResult, type OTPPurpose, OTPError } from './types.js';

const META_API_VERSION = 'v18.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaSendResponse {
  messaging_product: string;
  messages: Array<{ id: string }>;
}

/**
 * Send an OTP via WhatsApp Business API (Meta Cloud).
 *
 * @param phone - E.164 phone number (same as WhatsApp number)
 * @param otp - 6-digit OTP string
 * @param purpose - OTP purpose (transaction OTPs MUST NOT use WhatsApp as primary — R8)
 * @param accessToken - Meta access token
 * @param phoneNumberId - WhatsApp Business phone number ID
 * @param expiresAt - Unix timestamp when OTP expires
 */
export async function sendWhatsAppOTP(
  phone: string,
  otp: string,
  purpose: OTPPurpose,
  accessToken: string,
  phoneNumberId: string,
  expiresAt: number,
): Promise<OTPSendResult> {
  if (purpose === 'transaction') {
    throw new OTPError(
      'invalid_channel_for_purpose',
      'Transaction OTPs must use SMS as the primary channel (R8). WhatsApp may only be used as a fallback.',
    );
  }

  const res = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'template',
      template: {
        name: 'webwaka_otp',
        language: { code: 'en_NG' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: otp }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: otp }],
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json() as { error?: { message: string } };
    throw new Error(`WhatsApp OTP failed: ${err.error?.message ?? res.status}`);
  }

  const body = await res.json() as MetaSendResponse;

  const messageId = body.messages[0]?.id;

  return {
    sent: true,
    channel: 'whatsapp',
    ...(messageId ? { message_id: messageId } : {}),
    expires_at: expiresAt,
    fallback_used: false,
  };
}

// ---------------------------------------------------------------------------
// 360dialog provider (M7f)
// ---------------------------------------------------------------------------

interface Dialog360Response {
  messages?: Array<{ id: string }>;
}

/**
 * Send an OTP via 360dialog WhatsApp Business API.
 * (M7f — alternate WhatsApp provider for markets where Meta Cloud is unavailable)
 *
 * API: POST https://waba.360dialog.io/v1/messages
 * Auth: D360-API-KEY header
 *
 * @param phone     - E.164 phone number
 * @param otp       - 6-digit OTP string
 * @param purpose   - OTP purpose (transaction OTPs MUST NOT use WA as primary — R8)
 * @param apiKey    - 360dialog API key
 * @param expiresAt - Unix timestamp when OTP expires
 */
export async function sendWhatsAppOTP360dialog(
  phone: string,
  otp: string,
  purpose: OTPPurpose,
  apiKey: string,
  expiresAt: number,
): Promise<OTPSendResult> {
  if (purpose === 'transaction') {
    throw new OTPError(
      'invalid_channel_for_purpose',
      'Transaction OTPs must use SMS as the primary channel (R8). WhatsApp (360dialog) may only be used as a fallback.',
    );
  }

  const res = await fetch('https://waba.360dialog.io/v1/messages', {
    method: 'POST',
    headers: {
      'D360-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: phone.replace('+', ''),
      type: 'template',
      template: {
        name: 'webwaka_otp',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: otp }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: otp }],
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    throw new OTPError('delivery_failed', `360dialog WhatsApp OTP failed: ${res.status}`);
  }

  const body = await res.json() as Dialog360Response;
  const messageId = body.messages?.[0]?.id;

  return {
    sent: true,
    channel: 'whatsapp',
    ...(messageId ? { message_id: messageId } : {}),
    expires_at: expiresAt,
    fallback_used: false,
  };
}
