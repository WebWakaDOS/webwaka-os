-- Migration: 0100_vertical_nurtw.sql
-- Vertical: Road Transport Workers Union (NURTW) (M12, P3)
-- Invariants: P9 (kobo), T3 (tenant_id NOT NULL)
-- AI: L3 HITL for membership/leadership content (politically sensitive)

CREATE TABLE IF NOT EXISTS nurtw_profiles (
  id                  TEXT    PRIMARY KEY,
  workspace_id        TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  union_name          TEXT    NOT NULL,
  chapter_level       TEXT    NOT NULL DEFAULT 'park',
  nurtw_registration  TEXT,
  state               TEXT,
  status              TEXT    NOT NULL DEFAULT 'seeded',
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_nurtw_profiles_tenant    ON nurtw_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nurtw_profiles_status    ON nurtw_profiles(status);
CREATE INDEX IF NOT EXISTS idx_nurtw_profiles_workspace ON nurtw_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS union_members (
  id                TEXT    PRIMARY KEY,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  member_name       TEXT    NOT NULL,
  vehicle_plate     TEXT,
  vehicle_type      TEXT,
  member_since      INTEGER,
  monthly_dues_kobo INTEGER NOT NULL DEFAULT 0,
  dues_status       TEXT    NOT NULL DEFAULT 'current',
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_union_members_tenant  ON union_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_union_members_profile ON union_members(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS union_dues_log (
  id               TEXT    PRIMARY KEY,
  member_id        TEXT    NOT NULL,
  profile_id       TEXT    NOT NULL,
  tenant_id        TEXT    NOT NULL,
  collection_date  INTEGER,
  amount_kobo      INTEGER NOT NULL DEFAULT 0,
  collector_id     TEXT,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_union_dues_log_tenant  ON union_dues_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_union_dues_log_member  ON union_dues_log(member_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_union_dues_log_profile ON union_dues_log(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS union_welfare_claims (
  id          TEXT    PRIMARY KEY,
  member_id   TEXT    NOT NULL,
  profile_id  TEXT    NOT NULL,
  tenant_id   TEXT    NOT NULL,
  claim_type  TEXT    NOT NULL DEFAULT 'medical',
  amount_kobo INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'submitted',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_union_welfare_claims_tenant  ON union_welfare_claims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_union_welfare_claims_member  ON union_welfare_claims(member_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_union_welfare_claims_profile ON union_welfare_claims(profile_id, tenant_id);
