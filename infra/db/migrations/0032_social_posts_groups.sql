-- Migration: 0032_social_posts_groups
-- Milestone 7c: Social Network
-- Tables: social_posts, social_reactions, social_groups, social_group_members

-- like_count required by USSD Branch 3 trending query (ORDER BY like_count DESC)
-- post_type and is_deleted required by same query filters

CREATE TABLE IF NOT EXISTS social_posts (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  author_id         TEXT NOT NULL,
  content           TEXT NOT NULL,
  post_type         TEXT NOT NULL DEFAULT 'post',
  media_urls        TEXT NOT NULL DEFAULT '[]',
  moderation_status TEXT NOT NULL DEFAULT 'published',
  like_count        INTEGER NOT NULL DEFAULT 0,
  comment_count     INTEGER NOT NULL DEFAULT 0,
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  expires_at        INTEGER,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_social_posts_author
  ON social_posts(author_id, tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_tenant
  ON social_posts(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_trending
  ON social_posts(tenant_id, like_count DESC);

-- ---------------------------------------------------------------------------
-- Reactions (T3 — tenant_id on all queries)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS social_reactions (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  post_id          TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  reaction_type    TEXT NOT NULL DEFAULT 'like',
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_reactions_user_post
  ON social_reactions(user_id, post_id, reaction_type, tenant_id);

CREATE INDEX IF NOT EXISTS idx_social_reactions_post
  ON social_reactions(post_id, tenant_id);

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS social_groups (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_social_groups_tenant
  ON social_groups(tenant_id);

CREATE TABLE IF NOT EXISTS social_group_members (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  group_id         TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'member',
  joined_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_group_members_pair
  ON social_group_members(user_id, group_id, tenant_id);
