-- Migration: 0035_contact_telegram_chat_id
-- Description: Add telegram_chat_id column to contact_channels for Telegram Bot handshake (M7f).
-- The chat_id is populated server-side when user starts @WebWakaBot — never client-supplied.
-- (docs/contact/contact-verification.md — Telegram Verification Flow)

ALTER TABLE contact_channels ADD COLUMN telegram_chat_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contact_telegram_chat_id
  ON contact_channels(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;
