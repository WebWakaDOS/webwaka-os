/**
 * @webwaka/contact — Multi-channel contact management (M7a + M7f)
 * (docs/contact/multi-channel-model.md, docs/contact/contact-verification.md)
 *
 * Manages: phone (SMS), WhatsApp, Telegram, email — each verified independently (R10).
 * Provides: channel normalization, OTP routing preference, verification state.
 * M7f: ContactService D1 persistence, P12/P13 guards, routeOTPByPurpose R8 enforcement.
 *
 * Usage:
 *   import { normalizeContactChannels, getPreferredOTPChannel, isChannelVerified } from '@webwaka/contact';
 */

export { normalizeContactChannels, buildContactChannelUpdate } from './normalize.js';
export { getPreferredOTPChannel, resolveContactForOTP, routeOTPByPurpose, OTPRoutingError } from './channel-resolver.js';
export type { OTPPurpose } from './channel-resolver.js';
export { isChannelVerified, getVerifiedChannels } from './verification-state.js';

export {
  upsertContactChannels,
  getContactChannels,
  markChannelVerified,
  updateTelegramChatId,
  removeContactChannel,
  assertChannelConsent,
  assertPrimaryPhoneVerified,
  ContactError,
} from './contact-service.js';

export type {
  OTPPreference,
  NotificationPreference,
  ContactChannelRecord,
  ContactChannelInput,
  OTPContactTarget,
} from './types.js';
