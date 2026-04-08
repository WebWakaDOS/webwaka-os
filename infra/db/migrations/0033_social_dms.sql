-- Migration: 0033_social_dms
-- Milestone 7c: Social Network
-- Tables: dm_threads, dm_thread_participants, dm_messages

-- P14 — DM content stored encrypted (AES-GCM).
-- NO plaintext 'content' column — only encrypted_content + iv.

CREATE TABLE IF NOT EXISTS dm_threads (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_dm_threads_tenant
  ON dm_threads(tenant_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Participants
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dm_thread_participants (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  thread_id        TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  joined_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_participants_pair
  ON dm_thread_participants(thread_id, user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_dm_participants_user
  ON dm_thread_participants(user_id, tenant_id);

-- ---------------------------------------------------------------------------
-- Messages — encrypted_content + iv (AES-GCM per P14)
-- NO plaintext 'content' column
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dm_messages (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  thread_id         TEXT NOT NULL,
  sender_id         TEXT NOT NULL,
  encrypted_content TEXT NOT NULL,
  iv                TEXT NOT NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_thread
  ON dm_messages(thread_id, tenant_id, created_at);
