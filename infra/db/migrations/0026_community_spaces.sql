-- Migration: 0026_community_spaces
-- Milestone 7c: Community Platform
-- Tables: community_spaces, community_membership_tiers, community_memberships

CREATE TABLE IF NOT EXISTS community_spaces (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  description      TEXT,
  visibility       TEXT NOT NULL DEFAULT 'public',
  member_count     INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_spaces_slug_tenant
  ON community_spaces(slug, tenant_id);

CREATE INDEX IF NOT EXISTS idx_community_spaces_tenant
  ON community_spaces(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Membership tiers (T4 — price_kobo is INTEGER, never REAL)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS community_membership_tiers (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  community_id     TEXT NOT NULL,
  name             TEXT NOT NULL,
  price_kobo       INTEGER NOT NULL DEFAULT 0,
  billing_interval TEXT NOT NULL DEFAULT 'free',
  max_members      INTEGER NOT NULL DEFAULT -1,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_membership_tiers_community
  ON community_membership_tiers(community_id, tenant_id);

-- ---------------------------------------------------------------------------
-- Memberships (USSD Branch 5 reads this: status = 'active', joined_at)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS community_memberships (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  community_id     TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  tier_id          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active',
  kyc_tier         INTEGER NOT NULL DEFAULT 0,
  joined_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at       INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_memberships_user_community
  ON community_memberships(user_id, community_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_community_memberships_community
  ON community_memberships(community_id, tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_community_memberships_user
  ON community_memberships(user_id, tenant_id, status);
