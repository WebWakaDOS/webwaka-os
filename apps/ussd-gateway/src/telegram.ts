/**
 * Telegram Bot webhook handler (M7f).
 * (docs/contact/contact-verification.md — Telegram Verification Flow)
 *
 * Handles: /start command → register telegram_chat_id for user
 * Handles: message with text → gracefully ignored (200)
 *
 * Env: TELEGRAM_BOT_TOKEN (Cloudflare Worker secret)
 *      TELEGRAM_WEBHOOK_SECRET (Cloudflare Worker secret — validates X-Telegram-Bot-Api-Secret-Token)
 *      DB (D1Database)
 *
 * Flow for /start:
 *   1. User messages @WebWakaBot with /start
 *   2. Bot extracts chat_id and username from update
 *   3. Look up contact_channels WHERE channel_type='telegram' AND value='@username'
 *   4. If found: UPDATE telegram_chat_id = chat_id, send welcome message
 *   5. If not found: send "Please verify your Telegram handle in the WebWaka app first"
 *
 * Uses Telegram Bot API directly (fetch). No third-party Telegram SDK (T1/T2 compliance).
 */

const TELEGRAM_BASE = 'https://api.telegram.org';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string; first_name: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

interface TelegramWebhookEnv {
  DB: {
    prepare(sql: string): {
      bind(...args: unknown[]): {
        first<T>(): Promise<T | null>;
        run(): Promise<{ success: boolean }>;
      };
    };
  };
  TELEGRAM_BOT_TOKEN: string;
}

// ---------------------------------------------------------------------------
// sendTelegramMessage
// ---------------------------------------------------------------------------

/**
 * Send a text message to a Telegram chat via Bot API.
 * Silently discards errors so webhook always returns 200 (Telegram requirement).
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  botToken: string,
): Promise<void> {
  try {
    await fetch(`${TELEGRAM_BASE}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // Silently discard — Telegram webhook must always return 200
  }
}

// ---------------------------------------------------------------------------
// handleTelegramWebhook
// ---------------------------------------------------------------------------

/**
 * Process a Telegram Bot update.
 * Called from POST /telegram/webhook after secret token validation.
 */
export async function handleTelegramWebhook(
  update: TelegramUpdate,
  env: TelegramWebhookEnv,
): Promise<void> {
  const msg = update.message;

  // Gracefully ignore updates without a message
  if (!msg) return;

  const chatId = msg.chat.id;
  const username = msg.from.username;
  const text = msg.text ?? '';

  // Only handle /start command — all other messages ignored
  if (!text.startsWith('/start')) return;

  if (!username) {
    // No Telegram username — cannot match to a contact_channels row
    await sendTelegramMessage(
      chatId,
      'To use WebWaka on Telegram, please set a Telegram username in your profile settings first.',
      env.TELEGRAM_BOT_TOKEN,
    );
    return;
  }

  const handle = username.startsWith('@') ? username : `@${username}`;

  // Look up contact_channels row for this Telegram handle
  const row = await env.DB.prepare(
    `SELECT user_id FROM contact_channels
     WHERE channel_type = 'telegram' AND value = ?
     LIMIT 1`,
  )
    .bind(handle)
    .first<{ user_id: string }>();

  if (!row) {
    await sendTelegramMessage(
      chatId,
      `Hi! Your Telegram handle ${handle} is not linked to a WebWaka account yet. Please add your Telegram handle in the WebWaka app first.`,
      env.TELEGRAM_BOT_TOKEN,
    );
    return;
  }

  // Update telegram_chat_id for this user's telegram channel
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE contact_channels
     SET telegram_chat_id = ?, updated_at = ?
     WHERE user_id = ? AND channel_type = 'telegram'`,
  )
    .bind(String(chatId), now, row.user_id)
    .run();

  await sendTelegramMessage(
    chatId,
    `Welcome to WebWaka! Your Telegram is now linked to your account. You can receive OTPs and notifications here.`,
    env.TELEGRAM_BOT_TOKEN,
  );
}
