/**
 * Contact channel routes — /contact/* (M7a + M7f)
 * (docs/contact/multi-channel-model.md, docs/contact/contact-verification.md)
 *
 * Routes:
 *   GET    /contact/channels          — get user's contact channels
 *   PUT    /contact/channels          — upsert channel data (normalizes + stores)
 *   POST   /contact/verify/:channel   — request OTP for channel verification
 *   POST   /contact/confirm/:channel  — submit OTP to confirm channel
 *   DELETE /contact/channels/:channel — remove a channel (whatsapp/telegram/email)
 *   GET    /contact/preferences       — get OTP/notification preferences
 *   PUT    /contact/preferences       — update OTP/notification preferences
 *
 * Security:
 *   - All routes require auth (applied at app level in index.ts)
 *   - R9: OTP send rate limiting (5/hr SMS/WA, 3/hr TG) — via RATE_LIMIT_KV
 *   - R10: Each channel verified independently
 *   - R8: SMS required for transaction/kyc_uplift OTPs
 *   - P12: assertChannelConsent() called before every OTP dispatch (M7f)
 *   - P13: primary phone must be verified before KYC/financial ops (M7f)
 *
 * M7f: Routes delegate D1 persistence to ContactService (packages/contact).
 */

import { Hono } from 'hono';
import { normalizeContactChannels } from '@webwaka/contact';
import {
  getContactChannels,
  upsertContactChannels,
  markChannelVerified,
  removeContactChannel,
  assertChannelConsent,
  ContactError,
} from '@webwaka/contact';
import { sendMultiChannelOTP, verifyOTPHash, validateNigerianPhone, OTPError } from '@webwaka/otp';
import type { Env } from '../env.js';
import type { OTPPreference, NotificationPreference } from '@webwaka/contact';

// ---------------------------------------------------------------------------
// Local D1Like — defined inline per brief
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<{ success: boolean }>;
    };
  };
}

const contactRoutes = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /contact/channels
// ---------------------------------------------------------------------------

/**
 * GET /contact/channels
 * Returns all contact channels for the authenticated user.
 * M7f: Delegates to ContactService.getContactChannels()
 */
contactRoutes.get('/channels', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const tenantId = c.req.header('X-Tenant-Id') ?? 'default';
  const db = c.env.DB as unknown as Parameters<typeof getContactChannels>[0];

  const channels = await getContactChannels(db, userId, tenantId);
  return c.json({ channels });
});

// ---------------------------------------------------------------------------
// PUT /contact/channels
// ---------------------------------------------------------------------------

/**
 * PUT /contact/channels
 * Body: { primary_phone, whatsapp_same_as_primary, whatsapp_phone?, telegram_handle?, otp_preference? }
 * Normalizes and upserts contact channels.
 * M7f: Delegates to ContactService.upsertContactChannels()
 */
contactRoutes.put('/channels', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const tenantId = c.req.header('X-Tenant-Id') ?? 'default';

  const body = await c.req.json<{
    primary_phone: string;
    whatsapp_same_as_primary?: boolean;
    whatsapp_phone?: string;
    telegram_handle?: string;
    otp_preference?: OTPPreference;
  }>().catch(() => null);

  if (!body?.primary_phone) {
    return c.json({ error: 'primary_phone is required.' }, 400);
  }

  const phoneValidation = validateNigerianPhone(body.primary_phone);
  if (!phoneValidation.valid) {
    return c.json({ error: 'invalid_phone', message: 'primary_phone must be a valid Nigerian number.' }, 422);
  }

  const channels = normalizeContactChannels({
    primary_phone: phoneValidation.normalized,
    whatsapp_same_as_primary: body.whatsapp_same_as_primary ?? false,
    ...(body.whatsapp_phone !== undefined ? { whatsapp_phone: body.whatsapp_phone } : {}),
    ...(body.telegram_handle !== undefined ? { telegram_handle: body.telegram_handle } : {}),
    otp_preference: body.otp_preference ?? 'sms',
  });

  const db = c.env.DB as unknown as Parameters<typeof upsertContactChannels>[0];
  await upsertContactChannels(db, userId, channels, tenantId);

  return c.json({ success: true, channels_saved: channels.length });
});

// ---------------------------------------------------------------------------
// POST /contact/verify/:channel
// ---------------------------------------------------------------------------

/**
 * POST /contact/verify/:channel
 * Sends an OTP to the specified channel for verification.
 * M7f: assertChannelConsent (P12) checked before OTP dispatch.
 */
contactRoutes.post('/verify/:channel', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const tenantId = c.req.header('X-Tenant-Id') ?? 'default';
  const channel = c.req.param('channel') as 'sms' | 'whatsapp' | 'telegram';
  if (!['sms', 'whatsapp', 'telegram'].includes(channel)) {
    return c.json({ error: 'Invalid channel. Must be sms, whatsapp, or telegram.' }, 400);
  }

  const parsed = await c.req.json<{ purpose?: string }>().catch(() => null);
  const purpose = (parsed?.purpose as 'verification' | 'login' | 'transaction' | 'kyc_uplift' | 'password_reset') ?? 'verification';

  const db = c.env.DB as unknown as D1Like;

  // P12 — NDPR consent check before OTP dispatch
  try {
    const consentDb = c.env.DB as unknown as Parameters<typeof assertChannelConsent>[0];
    await assertChannelConsent(consentDb, userId, channel, tenantId);
  } catch (err) {
    if (err instanceof ContactError && err.code === 'CONSENT_REQUIRED') {
      return c.json({ error: 'CONSENT_REQUIRED', message: err.message }, 403);
    }
    throw err;
  }

  // Fetch the channel row to get the identifier
  interface ContactRow {
    id: string;
    user_id: string;
    channel_type: string;
    value: string;
    is_primary: number;
    verified: boolean;
    verified_at: number | null;
    created_at: number;
    updated_at: number;
  }

  // T3 isolation note: contact_channels has no tenant_id column (see migration 0018).
  // Tenant isolation is enforced via globally unique UUID user_id — each user_id belongs
  // to exactly one tenant and is never reused. The auth JWT (tenantId from auth context)
  // was already validated by the auth middleware before this handler executes.
  const channelRow = await db.prepare(
    `SELECT id, user_id, channel_type, value, is_primary, verified, verified_at, created_at, updated_at
     FROM contact_channels WHERE user_id = ? AND channel_type = ? LIMIT 1`,
  ).bind(userId, channel).first<ContactRow>();

  if (!channelRow) {
    return c.json({ error: 'channel_not_found', message: `No ${channel} contact on record. Please add it first.` }, 404);
  }

  try {
    const result = await sendMultiChannelOTP({
      contact: {
        ...(channel === 'sms' ? { phone: channelRow.value } : {}),
        ...(channel === 'whatsapp' ? { whatsapp: channelRow.value } : {}),
        ...(channel === 'telegram' ? { telegram: channelRow.value } : {}),
        otp_preference: channel,
      },
      purpose,
      env: {
        TERMII_API_KEY: c.env.TERMII_API_KEY,
        WHATSAPP_ACCESS_TOKEN: c.env.WHATSAPP_ACCESS_TOKEN,
        WHATSAPP_PHONE_NUMBER_ID: c.env.WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_PROVIDER: c.env.WHATSAPP_PROVIDER,
        DIALOG360_API_KEY: c.env.DIALOG360_API_KEY,
        TELEGRAM_BOT_TOKEN: c.env.TELEGRAM_BOT_TOKEN,
        LOG_PII_SALT: c.env.LOG_PII_SALT,
        RATE_LIMIT_KV: c.env.RATE_LIMIT_KV,
      } as Parameters<typeof sendMultiChannelOTP>[0]['env'] & { WHATSAPP_PROVIDER?: string; DIALOG360_API_KEY?: string },
    });

    const now = Math.floor(Date.now() / 1000);
    await db.prepare(
      `INSERT INTO otp_log (user_id, phone, otp_hash, purpose, channel, status, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).bind(userId, channelRow.value, result.otp_hash, purpose, result.channel, result.expires_at, now).run();

    return c.json({ success: true, channel: result.channel, expires_at: result.expires_at });
  } catch (err) {
    if (err instanceof OTPError) {
      const status = err.code === 'rate_limited' || err.code === 'channel_locked' ? 429 : 422;
      return c.json({ error: err.code, message: err.message }, status);
    }
    console.error('[contact/verify]', err instanceof Error ? err.message : err);
    return c.json({ error: 'delivery_failed', message: 'OTP delivery temporarily unavailable.' }, 502);
  }
});

// ---------------------------------------------------------------------------
// POST /contact/confirm/:channel
// ---------------------------------------------------------------------------

/**
 * POST /contact/confirm/:channel
 * Body: { code: string }
 * Confirms an OTP and marks the channel as verified.
 * M7f: Uses ContactService.markChannelVerified()
 */
contactRoutes.post('/confirm/:channel', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const tenantId = c.req.header('X-Tenant-Id') ?? 'default';
  const channel = c.req.param('channel') as 'sms' | 'whatsapp' | 'telegram';
  const body = await c.req.json<{ code: string }>().catch(() => null);

  if (!body?.code) {
    return c.json({ error: 'code is required.' }, 400);
  }

  const db = c.env.DB as unknown as D1Like;

  interface OTPLogRow {
    id: string;
    otp_hash: string;
    expires_at: number;
    status: string;
  }

  const logRow = await db.prepare(
    `SELECT id, otp_hash, expires_at, status FROM otp_log
     WHERE user_id = ? AND channel = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
  ).bind(userId, channel).first<OTPLogRow>();

  if (!logRow) {
    return c.json({ error: 'otp_not_found', message: 'No pending OTP for this channel.' }, 404);
  }

  const valid = await verifyOTPHash(body.code, logRow.otp_hash, logRow.expires_at, c.env.LOG_PII_SALT);
  if (!valid) {
    return c.json({ error: 'otp_invalid', message: 'Invalid or expired OTP code.' }, 422);
  }

  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`UPDATE otp_log SET status = 'used', used_at = ? WHERE id = ?`).bind(now, logRow.id).run();

  // M7f: Use ContactService.markChannelVerified (R10)
  const markDb = c.env.DB as unknown as Parameters<typeof markChannelVerified>[0];
  await markChannelVerified(markDb, userId, channel, tenantId);

  return c.json({ success: true, channel, verified: true });
});

// ---------------------------------------------------------------------------
// DELETE /contact/channels/:channel
// ---------------------------------------------------------------------------

/**
 * DELETE /contact/channels/:channel
 * Removes a non-primary channel (whatsapp | telegram | email).
 * M7f: Uses ContactService.removeContactChannel()
 */
contactRoutes.delete('/channels/:channel', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const tenantId = c.req.header('X-Tenant-Id') ?? 'default';
  const channel = c.req.param('channel') as 'whatsapp' | 'telegram' | 'email';
  if (!['whatsapp', 'telegram', 'email'].includes(channel)) {
    return c.json({ error: 'Cannot remove primary SMS channel. Only whatsapp, telegram, or email.' }, 400);
  }

  const db = c.env.DB as unknown as Parameters<typeof removeContactChannel>[0];

  try {
    await removeContactChannel(db, userId, channel, tenantId);
    return c.json({ success: true, removed: channel });
  } catch (err) {
    if (err instanceof ContactError && err.code === 'CANNOT_REMOVE_PRIMARY') {
      return c.json({ error: err.code, message: err.message }, 400);
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------
// GET /contact/preferences
// ---------------------------------------------------------------------------

/**
 * GET /contact/preferences
 * Returns the user's OTP and notification preferences.
 */
contactRoutes.get('/preferences', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const db = c.env.DB as unknown as D1Like;

  interface PrefRow {
    otp_preference: OTPPreference;
    notification_preference: NotificationPreference;
  }

  const prefs = await db.prepare(
    `SELECT otp_preference, notification_preference FROM contact_preferences WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first<PrefRow>();

  return c.json({
    otp_preference: prefs?.otp_preference ?? 'sms',
    notification_preference: prefs?.notification_preference ?? 'sms',
  });
});

// ---------------------------------------------------------------------------
// PUT /contact/preferences
// ---------------------------------------------------------------------------

/**
 * PUT /contact/preferences
 * Body: { otp_preference?, notification_preference? }
 */
contactRoutes.put('/preferences', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<{ otp_preference?: OTPPreference; notification_preference?: NotificationPreference }>().catch(() => null);
  if (!body) return c.json({ error: 'Invalid request body.' }, 400);

  const db = c.env.DB as unknown as D1Like;
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(
    `INSERT INTO contact_preferences (user_id, otp_preference, notification_preference, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       otp_preference = COALESCE(excluded.otp_preference, otp_preference),
       notification_preference = COALESCE(excluded.notification_preference, notification_preference),
       updated_at = excluded.updated_at`,
  ).bind(
    userId,
    body.otp_preference ?? 'sms',
    body.notification_preference ?? 'sms',
    now,
  ).run();

  return c.json({ success: true });
});

export { contactRoutes };
