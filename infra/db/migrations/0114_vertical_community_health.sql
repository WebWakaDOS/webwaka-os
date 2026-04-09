-- Migration 0114 — Community Health Worker (CHW) Network vertical (M12)
-- Platform Invariants: T3 (tenant_id NOT NULL)
-- P13: household_ref_id opaque — no patient names or addresses
-- P12: USSD-safe — all data routes designed for low-data USSD entry

CREATE TABLE IF NOT EXISTS community_health_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  org_name TEXT NOT NULL,
  nphcda_affiliation TEXT,
  state_moh_registration TEXT,
  lga TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chw_profiles_tenant ON community_health_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chw_profiles_workspace ON community_health_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS chw_workers (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  chw_ref_id TEXT NOT NULL,
  training_level TEXT NOT NULL DEFAULT 'CHW',
  lga TEXT,
  ward TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chw_workers_tenant ON chw_workers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chw_workers_profile ON chw_workers(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS chw_visits (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  chw_ref_id TEXT NOT NULL,
  household_ref_id TEXT NOT NULL,
  visit_date INTEGER NOT NULL,
  services_provided TEXT,
  referral_flag INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chw_visits_tenant ON chw_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chw_visits_profile ON chw_visits(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS chw_immunisation (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  chw_ref_id TEXT NOT NULL,
  vaccine_name TEXT NOT NULL,
  doses_administered INTEGER NOT NULL CHECK(doses_administered >= 0),
  tally_date INTEGER NOT NULL,
  lga TEXT,
  ward TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chw_immunisation_tenant ON chw_immunisation(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chw_immunisation_profile ON chw_immunisation(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS chw_stock (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit_count INTEGER NOT NULL DEFAULT 0 CHECK(unit_count >= 0),
  dispensed_count INTEGER NOT NULL DEFAULT 0,
  last_restocked INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chw_stock_tenant ON chw_stock(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chw_stock_profile ON chw_stock(profile_id, tenant_id);
