/**
 * Contact channel OTP preference resolver (M7a + M7f)
 * (docs/contact/otp-routing.md, docs/governance/security-baseline.md R8/R10)
 *
 * Determines the preferred OTP channel from a user's verified contact channels.
 * M7f: adds routeOTPByPurpose for purpose-specific R8 enforcement.
 */

import { type ContactChannelRecord, type OTPPreference, type OTPContactTarget } from './types.js';

// ---------------------------------------------------------------------------
// OTPPurpose and OTPRoutingError — R8 enforcement types (M7f)
// ---------------------------------------------------------------------------

/** OTP purpose — governs which channels are allowed (R8) */
export type OTPPurpose =
  | 'verification'
  | 'login'
  | 'transaction'
  | 'kyc_uplift'
  | 'password_reset';

export class OTPRoutingError extends Error {
  constructor(
    public readonly code: 'NO_ELIGIBLE_CHANNEL' | 'CHANNEL_BLOCKED_FOR_PURPOSE',
    message: string,
  ) {
    super(message);
    this.name = 'OTPRoutingError';
  }
}

// ---------------------------------------------------------------------------
// routeOTPByPurpose — M7f R8 purpose-specific channel enforcement
// ---------------------------------------------------------------------------

/**
 * Route OTP delivery channel by purpose.
 * Enforces R8: transaction + kyc_uplift OTPs MUST use SMS (or WhatsApp fallback).
 * Telegram is NOT allowed for transaction or KYC OTPs.
 *
 * R8 rules:
 *   'verification'     → user preference, full waterfall (SMS/WA/TG)
 *   'login'            → user preference, full waterfall (SMS/WA/TG)
 *   'transaction'      → SMS primary → WhatsApp fallback (NO Telegram)
 *   'kyc_uplift'       → SMS primary → WhatsApp fallback (NO Telegram)
 *   'password_reset'   → user preference, SMS/WA/TG allowed
 *
 * Returns ordered array of channels to attempt (try index 0 first).
 * Throws OTPRoutingError if no eligible channel is available.
 */
export function routeOTPByPurpose(
  channels: readonly ContactChannelRecord[],
  purpose: OTPPurpose,
  preference: OTPPreference,
): OTPContactTarget[] {
  const verified = channels.filter((c) => c.verified);

  const isTransactionLike = purpose === 'transaction' || purpose === 'kyc_uplift';

  if (isTransactionLike) {
    // R8: SMS primary, WhatsApp fallback only — Telegram BLOCKED
    const targets: OTPContactTarget[] = [];
    const sms = verified.find((c) => c.channel_type === 'sms');
    const wa = verified.find((c) => c.channel_type === 'whatsapp');
    if (sms) targets.push({ channel: 'sms', identifier: sms.value, is_verified: true });
    if (wa) targets.push({ channel: 'whatsapp', identifier: wa.value, is_verified: true });
    if (targets.length === 0) {
      throw new OTPRoutingError(
        'NO_ELIGIBLE_CHANNEL',
        `No SMS or WhatsApp channel available for '${purpose}' OTP (R8). Telegram is not permitted.`,
      );
    }
    return targets;
  }

  // Non-transaction purposes: respect user preference, full waterfall
  const orderedTypes: Array<'sms' | 'whatsapp' | 'telegram'> =
    preference === 'whatsapp'
      ? ['whatsapp', 'sms', 'telegram']
      : preference === 'telegram'
        ? ['telegram', 'sms', 'whatsapp']
        : ['sms', 'whatsapp', 'telegram'];

  const targets: OTPContactTarget[] = [];
  for (const type of orderedTypes) {
    const ch = verified.find((c) => c.channel_type === type);
    if (ch) {
      targets.push({ channel: type as 'sms' | 'whatsapp' | 'telegram', identifier: ch.value, is_verified: true });
    }
  }

  if (targets.length === 0) {
    throw new OTPRoutingError(
      'NO_ELIGIBLE_CHANNEL',
      `No verified channel available for '${purpose}' OTP.`,
    );
  }

  return targets;
}

/**
 * Get the preferred OTP channel identifier from a list of contact channel records.
 * Returns the user's preference if that channel is verified; falls back to SMS.
 *
 * R10: Only verified channels are returned.
 */
export function getPreferredOTPChannel(
  channels: readonly ContactChannelRecord[],
  preference: OTPPreference = 'sms',
): OTPContactTarget | null {
  const verified = channels.filter((c) => c.verified && c.channel_type !== 'email');

  const preferred = verified.find((c) => c.channel_type === preference);
  if (preferred) {
    return { channel: preferred.channel_type as 'sms' | 'whatsapp' | 'telegram', identifier: preferred.value, is_verified: true };
  }

  const sms = verified.find((c) => c.channel_type === 'sms');
  if (sms) {
    return { channel: 'sms', identifier: sms.value, is_verified: true };
  }

  const whatsapp = verified.find((c) => c.channel_type === 'whatsapp');
  if (whatsapp) {
    return { channel: 'whatsapp', identifier: whatsapp.value, is_verified: true };
  }

  return null;
}

/**
 * Resolve all contact channels for OTP delivery (ordered by preference).
 * Returns unverified channels too (for initial verification flow).
 */
export function resolveContactForOTP(
  channels: readonly ContactChannelRecord[],
  preference: OTPPreference = 'sms',
): OTPContactTarget[] {
  const targets: OTPContactTarget[] = [];
  const seen = new Set<string>();

  const orderedTypes: Array<'sms' | 'whatsapp' | 'telegram'> =
    preference === 'whatsapp' ? ['whatsapp', 'sms', 'telegram']
    : preference === 'telegram' ? ['telegram', 'sms', 'whatsapp']
    : ['sms', 'whatsapp', 'telegram'];

  for (const type of orderedTypes) {
    const ch = channels.find((c) => c.channel_type === type);
    if (ch && !seen.has(ch.value)) {
      seen.add(ch.value);
      targets.push({ channel: type, identifier: ch.value, is_verified: ch.verified });
    }
  }

  return targets;
}
