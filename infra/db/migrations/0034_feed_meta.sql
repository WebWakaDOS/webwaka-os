-- Migration: 0034_feed_meta
-- Milestone 7c: Social Network
-- Tables: feed_impressions

CREATE TABLE IF NOT EXISTS feed_impressions (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  post_id          TEXT NOT NULL,
  impressed_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_feed_impressions_user
  ON feed_impressions(user_id, tenant_id, impressed_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_impressions_post
  ON feed_impressions(post_id, tenant_id);
