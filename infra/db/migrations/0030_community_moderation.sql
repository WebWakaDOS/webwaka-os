-- Migration: 0030_community_moderation
-- Milestone 7c: Community Platform
-- Tables: community_moderation_log

-- P15 — classifyContent called unconditionally before every post insert.
-- This table records all moderation decisions for audit purposes.

CREATE TABLE IF NOT EXISTS community_moderation_log (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  content_type      TEXT NOT NULL,
  content_id        TEXT NOT NULL,
  author_id         TEXT NOT NULL,
  moderation_status TEXT NOT NULL,
  reason            TEXT,
  confidence        REAL NOT NULL DEFAULT 0.0,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_content
  ON community_moderation_log(content_id, content_type, tenant_id);

CREATE INDEX IF NOT EXISTS idx_moderation_log_tenant
  ON community_moderation_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_log_status
  ON community_moderation_log(tenant_id, moderation_status, created_at DESC);
