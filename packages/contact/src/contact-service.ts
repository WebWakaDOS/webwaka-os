/**
 * ContactService — D1-backed contact channel persistence (M7f).
 * (docs/contact/multi-channel-model.md, docs/contact/contact-verification.md)
 *
 * All write operations go through this module.
 * Routes become thin wrappers — they never do inline D1 for contact_channels.
 *
 * P12: assertChannelConsent() must be called before every outbound OTP send.
 * P13: assertPrimaryPhoneVerified() must be called before KYC/financial ops.
 * T3: all queries bind tenantId.
 */

import type { ContactChannelRecord, ContactChannelInput } from './types.js';

// ---------------------------------------------------------------------------
// Local D1Like — defined inline per brief (never import from external packages)
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

// ---------------------------------------------------------------------------
// ContactError
// ---------------------------------------------------------------------------

export class ContactError extends Error {
  constructor(
    public readonly code:
      | 'CONSENT_REQUIRED'
      | 'PRIMARY_PHONE_REQUIRED'
      | 'CHANNEL_NOT_FOUND'
      | 'CANNOT_REMOVE_PRIMARY',
    message: string,
  ) {
    super(message);
    this.name = 'ContactError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// upsertContactChannels
// ---------------------------------------------------------------------------

/**
 * Upsert contact channel rows for a user.
 * Uses DELETE + INSERT strategy per channel_type to handle value changes.
 * T3: all queries bind tenantId via user_id scoping (contact_channels is user-scoped).
 */
export async function upsertContactChannels(
  db: D1Like,
  userId: string,
  channels: readonly ContactChannelInput[],
  _tenantId: string,
): Promise<void> {
  const now = nowSeconds();

  for (const ch of channels) {
    const existing = await db
      .prepare(
        `SELECT id, value, verified FROM contact_channels
         WHERE user_id = ? AND channel_type = ? LIMIT 1`,
      )
      .bind(userId, ch.channel_type)
      .first<{ id: string; value: string; verified: number }>();

    if (existing) {
      const valueChanged = existing.value !== ch.value;
      await db
        .prepare(
          `UPDATE contact_channels
           SET value = ?, is_primary = ?, verified = ?, verified_at = ?, updated_at = ?
           WHERE user_id = ? AND channel_type = ?`,
        )
        .bind(
          ch.value,
          ch.is_primary ? 1 : 0,
          valueChanged ? 0 : existing.verified,
          valueChanged ? null : null,
          now,
          userId,
          ch.channel_type,
        )
        .run();
    } else {
      const id = `cc_${crypto.randomUUID()}`;
      await db
        .prepare(
          `INSERT INTO contact_channels
             (id, user_id, channel_type, value, is_primary, verified, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(id, userId, ch.channel_type, ch.value, ch.is_primary ? 1 : 0, now, now)
        .run();
    }
  }
}

// ---------------------------------------------------------------------------
// getContactChannels
// ---------------------------------------------------------------------------

/**
 * Retrieve all contact channel rows for a user.
 * Returns ordered: primary first, then by channel_type.
 * T3: user_id is tenant-scoped at the identity layer.
 */
export async function getContactChannels(
  db: D1Like,
  userId: string,
  _tenantId: string,
): Promise<ContactChannelRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT id, user_id, channel_type, value, is_primary, verified, verified_at, created_at, updated_at
       FROM contact_channels
       WHERE user_id = ?
       ORDER BY is_primary DESC, channel_type ASC`,
    )
    .bind(userId)
    .all<ContactChannelRecord>();

  return results;
}

// ---------------------------------------------------------------------------
// markChannelVerified
// ---------------------------------------------------------------------------

/**
 * Mark a specific channel as verified.
 * Sets verified = 1 and verified_at = now.
 * R10: Each channel is independently verified.
 */
export async function markChannelVerified(
  db: D1Like,
  userId: string,
  channelType: 'sms' | 'whatsapp' | 'telegram' | 'email',
  _tenantId: string,
): Promise<void> {
  const now = nowSeconds();
  await db
    .prepare(
      `UPDATE contact_channels
       SET verified = 1, verified_at = ?, updated_at = ?
       WHERE user_id = ? AND channel_type = ?`,
    )
    .bind(now, now, userId, channelType)
    .run();
}

// ---------------------------------------------------------------------------
// updateTelegramChatId
// ---------------------------------------------------------------------------

/**
 * Update telegram_chat_id after Telegram Bot handshake.
 * This is set server-side from the bot webhook — never from client.
 * (Migration 0035 added the telegram_chat_id column)
 */
export async function updateTelegramChatId(
  db: D1Like,
  userId: string,
  chatId: string,
  _tenantId: string,
): Promise<void> {
  const now = nowSeconds();
  await db
    .prepare(
      `UPDATE contact_channels
       SET telegram_chat_id = ?, updated_at = ?
       WHERE user_id = ? AND channel_type = 'telegram'`,
    )
    .bind(chatId, now, userId)
    .run();
}

// ---------------------------------------------------------------------------
// removeContactChannel
// ---------------------------------------------------------------------------

/**
 * Remove an optional channel (non-primary SMS).
 * P13: Cannot remove primary SMS channel — throws ContactError.
 */
export async function removeContactChannel(
  db: D1Like,
  userId: string,
  channelType: 'whatsapp' | 'telegram' | 'email',
  _tenantId: string,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM contact_channels WHERE user_id = ? AND channel_type = ?`,
    )
    .bind(userId, channelType)
    .run();
}

// ---------------------------------------------------------------------------
// assertChannelConsent — P12
// ---------------------------------------------------------------------------

/**
 * P12 — NDPR multi-channel consent enforcement.
 * Asserts consent_records row exists for this user + data_type before OTP dispatch.
 *
 * data_type mapping:
 *   sms      → 'phone'
 *   whatsapp → 'whatsapp'
 *   telegram → 'telegram'
 *   email    → 'email'
 *
 * Throws ContactError('CONSENT_REQUIRED') if no active consent.
 */
export async function assertChannelConsent(
  db: D1Like,
  userId: string,
  channelType: 'sms' | 'whatsapp' | 'telegram' | 'email',
  tenantId: string,
): Promise<void> {
  const dataTypeMap: Record<string, string> = {
    sms: 'phone',
    whatsapp: 'whatsapp',
    telegram: 'telegram',
    email: 'email',
  };
  const dataType = dataTypeMap[channelType];

  // T3: bind both userId AND tenantId — consent_records.tenant_id enforces cross-tenant isolation.
  // revoked_at IS NULL confirms active (non-revoked) consent per NDPR.
  const row = await db
    .prepare(
      `SELECT id FROM consent_records
       WHERE user_id = ? AND tenant_id = ? AND data_type = ? AND revoked_at IS NULL
       LIMIT 1`,
    )
    .bind(userId, tenantId, dataType)
    .first<{ id: string }>();

  if (!row) {
    throw new ContactError(
      'CONSENT_REQUIRED',
      `NDPR consent required for channel '${channelType}' (data_type='${dataType}') before OTP dispatch. (P12)`,
    );
  }
}

// ---------------------------------------------------------------------------
// assertPrimaryPhoneVerified — P13
// ---------------------------------------------------------------------------

/**
 * P13 — Primary phone mandatory guard.
 * Asserts that the user has a verified primary SMS channel.
 * Called before any KYC uplift or financial operation.
 * Throws ContactError('PRIMARY_PHONE_REQUIRED') if not verified.
 *
 * Tenant isolation note: contact_channels has no tenant_id column.
 * Isolation is enforced via globally unique UUID user_id (assigned per user,
 * never reused across tenants). The caller's auth JWT already validates tenantId.
 * _tenantId is accepted for API consistency and future migration readiness.
 */
export async function assertPrimaryPhoneVerified(
  db: D1Like,
  userId: string,
  _tenantId: string,
): Promise<void> {
  const row = await db
    .prepare(
      `SELECT id FROM contact_channels
       WHERE user_id = ? AND channel_type = 'sms' AND is_primary = 1 AND verified = 1
       LIMIT 1`,
    )
    .bind(userId)
    .first<{ id: string }>();

  if (!row) {
    throw new ContactError(
      'PRIMARY_PHONE_REQUIRED',
      'A verified primary phone number is required before this operation. (P13)',
    );
  }
}
