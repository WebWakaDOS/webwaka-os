-- Migration: 0027_community_channels
-- Milestone 7c: Community Platform
-- Tables: community_channels, channel_posts

CREATE TABLE IF NOT EXISTS community_channels (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  community_id     TEXT NOT NULL,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'discussion',
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_community_channels_community
  ON community_channels(community_id, tenant_id);

-- ---------------------------------------------------------------------------
-- Channel posts (P15 — moderation_status set before insert)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS channel_posts (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  channel_id        TEXT NOT NULL,
  author_id         TEXT NOT NULL,
  content           TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'published',
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_channel_posts_channel
  ON channel_posts(channel_id, tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_posts_author
  ON channel_posts(author_id, tenant_id);
