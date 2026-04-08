/**
 * Multi-channel OTP delivery orchestrator (M7a)
 * (docs/governance/otp-delivery-channels.md, docs/governance/security-baseline.md R8/R9)
 *
 * Executes channel waterfall: SMS → WhatsApp → Telegram
 * Handles rate limiting, fallback, and delivery logging.
 */

import { type OTPChannel, type OTPPurpose, type OTPSendResult, type OTPEnv, OTPError } from './types.js';
import { sendSMSOTP } from './termii-sms.js';
import { sendWhatsAppOTP, sendWhatsAppOTP360dialog } from './whatsapp-meta.js';
import { sendTelegramOTP } from './telegram-bot.js';
import { resolveOTPChannels, rateLimitKey, lockKey, CHANNEL_RATE_LIMITS, lockDurationSeconds } from './channel-router.js';
import { generateOTP, hashOTP, otpExpiresAt } from './otp-generator.js';

interface ContactInfo {
  readonly phone?: string;
  readonly whatsapp?: string;
  readonly telegram?: string;
  readonly email?: string;
  readonly otp_preference?: OTPChannel;
}

interface SendOTPOptions {
  readonly contact: ContactInfo;
  readonly purpose: OTPPurpose;
  readonly env: OTPEnv;
}

interface SendOTPResult extends OTPSendResult {
  readonly otp_hash: string;
}

/**
 * Send an OTP via the best available channel with automatic fallback.
 *
 * Returns the OTPSendResult plus otp_hash for storage in otp_log.
 * The raw OTP is never returned — callers only receive the hash.
 */
export async function sendMultiChannelOTP(opts: SendOTPOptions): Promise<SendOTPResult> {
  const { contact, purpose, env } = opts;
  const channels = resolveOTPChannels(contact, purpose);

  if (channels.length === 0) {
    throw new OTPError('delivery_failed', 'No contact channel available for OTP delivery.');
  }

  const otp = generateOTP();
  const expiresAt = otpExpiresAt();
  const otp_hash = await hashOTP(env.LOG_PII_SALT, otp);

  let lastError: Error | undefined;

  for (const { channel, identifier } of channels) {
    await assertNotRateLimited(channel, identifier, env);

    try {
      let result: OTPSendResult;

      if (channel === 'sms') {
        result = await sendSMSOTP(identifier, otp, env.TERMII_API_KEY, expiresAt);
      } else if (channel === 'whatsapp') {
        // M7f: Route to 360dialog or Meta Cloud based on WHATSAPP_PROVIDER env var
        if ((env as OTPEnv & { WHATSAPP_PROVIDER?: string }).WHATSAPP_PROVIDER === '360dialog') {
          const apiKey = (env as OTPEnv & { DIALOG360_API_KEY?: string }).DIALOG360_API_KEY ?? '';
          result = await sendWhatsAppOTP360dialog(identifier, otp, purpose, apiKey, expiresAt);
        } else {
          result = await sendWhatsAppOTP(
            identifier, otp, purpose,
            env.WHATSAPP_ACCESS_TOKEN, env.WHATSAPP_PHONE_NUMBER_ID, expiresAt,
          );
        }
      } else if (channel === 'telegram') {
        result = await sendTelegramOTP(identifier, otp, purpose, env.TELEGRAM_BOT_TOKEN, expiresAt);
      } else {
        continue;
      }

      await incrementRateLimit(channel, identifier, env);

      return {
        ...result,
        fallback_used: channel !== channels[0]?.channel,
        otp_hash,
      };
    } catch (err) {
      if (err instanceof OTPError && err.code === 'invalid_channel_for_purpose') {
        continue;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new OTPError(
    'delivery_failed',
    `OTP delivery failed on all channels: ${lastError?.message ?? 'unknown error'}`,
  );
}

/**
 * Verify a submitted OTP code against the stored hash.
 * Returns true if the hash matches and the OTP has not expired.
 */
export async function verifyOTPHash(
  submittedCode: string,
  storedHash: string,
  expiresAt: number,
  salt: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  if (now >= expiresAt) return false;
  const hash = await hashOTP(salt, submittedCode);
  return hash === storedHash;
}

async function assertNotRateLimited(
  channel: OTPChannel,
  identifier: string,
  env: OTPEnv,
): Promise<void> {
  const lockK = lockKey(channel, identifier);
  const locked = await env.RATE_LIMIT_KV.get(lockK);
  if (locked) {
    throw new OTPError('channel_locked', `Channel ${channel} is temporarily locked.`);
  }

  const rateK = rateLimitKey(channel, identifier);
  const countStr = await env.RATE_LIMIT_KV.get(rateK);
  const count = countStr ? parseInt(countStr, 10) : 0;
  const max = CHANNEL_RATE_LIMITS[channel];

  if (count >= max) {
    throw new OTPError('rate_limited', `OTP rate limit exceeded for channel ${channel}.`);
  }
}

async function incrementRateLimit(
  channel: OTPChannel,
  identifier: string,
  env: OTPEnv,
): Promise<void> {
  const rateK = rateLimitKey(channel, identifier);
  const countStr = await env.RATE_LIMIT_KV.get(rateK);
  const count = countStr ? parseInt(countStr, 10) : 0;
  await env.RATE_LIMIT_KV.put(rateK, String(count + 1), { expirationTtl: 3600 });
}

/**
 * Lock a channel after too many failed OTP attempts.
 */
export async function lockChannelAfterFailures(
  channel: OTPChannel,
  identifier: string,
  purpose: OTPPurpose,
  env: OTPEnv,
): Promise<void> {
  const lockK = lockKey(channel, identifier);
  const ttl = lockDurationSeconds(purpose);
  await env.RATE_LIMIT_KV.put(lockK, '1', { expirationTtl: ttl });
}
