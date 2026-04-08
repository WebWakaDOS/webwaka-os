/**
 * @webwaka/otp
 *
 * OTP delivery abstraction for Nigerian phone verification.
 * Implements OTPProvider abstraction from TDR-0009 (M7 extension).
 *
 * Channel priority: SMS (Termii) → WhatsApp → USSD → Voice
 * See docs/identity/otp-channels.md for full specification.
 *
 * Rate limiting: R5 — 3 OTP sends / 10 min per phone number.
 * Phone validation: Nigerian carriers (MTN, Airtel, Glo, 9mobile).
 */

// TODO M7a — Implement:
// - packages/otp/src/providers/termii.ts
// - packages/otp/src/providers/africas-talking.ts
// - packages/otp/src/channel-selector.ts
// - packages/otp/src/phone-validator.ts
// - packages/otp/src/rate-limiter.ts
// - packages/otp/src/otp-generator.ts (crypto.getRandomValues)
// - packages/otp/src/otp-store.ts (hashed storage in D1)

export type { OTPProvider, OTPChannel, OTPConfig, OTPSendResult, PhoneValidationResult } from './types';
export { OTP_STUB_VERSION } from './stub';
