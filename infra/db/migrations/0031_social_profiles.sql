-- Migration: 0031_social_profiles
-- Milestone 7c: Social Network
-- Tables: social_profiles, social_follows

-- phone_number required by USSD Branch 5 lookup:
--   SELECT id FROM social_profiles WHERE phone_number = ? AND tenant_id = ?

CREATE TABLE IF NOT EXISTS social_profiles (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  profile_id       TEXT NOT NULL,
  handle           TEXT NOT NULL,
  display_name     TEXT,
  bio              TEXT,
  phone_number     TEXT,
  avatar_url       TEXT,
  is_verified      INTEGER NOT NULL DEFAULT 0,
  follower_count   INTEGER NOT NULL DEFAULT 0,
  following_count  INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_profiles_handle_tenant
  ON social_profiles(handle, tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_profiles_profile_tenant
  ON social_profiles(profile_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_social_profiles_phone
  ON social_profiles(phone_number, tenant_id);

CREATE INDEX IF NOT EXISTS idx_social_profiles_tenant
  ON social_profiles(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS social_follows (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  follower_id      TEXT NOT NULL,
  followee_id      TEXT NOT NULL,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_follows_pair
  ON social_follows(follower_id, followee_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_social_follows_follower
  ON social_follows(follower_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_social_follows_followee
  ON social_follows(followee_id, tenant_id);
