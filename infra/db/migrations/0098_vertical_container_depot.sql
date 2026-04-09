-- Migration: 0098_vertical_container_depot.sql
-- Vertical: Container Depot / Logistics Hub (M12, P3)
-- Invariants: P9 (kobo), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS container_depot_profiles (
  id              TEXT    PRIMARY KEY,
  workspace_id    TEXT    NOT NULL,
  tenant_id       TEXT    NOT NULL,
  company_name    TEXT    NOT NULL,
  ncs_licence     TEXT,
  npa_licence     TEXT,
  cac_rc          TEXT,
  depot_location  TEXT,
  status          TEXT    NOT NULL DEFAULT 'seeded',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_container_depot_profiles_tenant    ON container_depot_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_container_depot_profiles_status    ON container_depot_profiles(status);
CREATE INDEX IF NOT EXISTS idx_container_depot_profiles_workspace ON container_depot_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS container_records (
  id                       TEXT    PRIMARY KEY,
  profile_id               TEXT    NOT NULL,
  tenant_id                TEXT    NOT NULL,
  container_number         TEXT    NOT NULL,
  container_type           TEXT    NOT NULL DEFAULT '20ft',
  weight_kg                INTEGER NOT NULL DEFAULT 0,
  client_phone             TEXT,
  operation_type           TEXT    NOT NULL DEFAULT 'storage',
  daily_storage_rate_kobo  INTEGER NOT NULL DEFAULT 0,
  days_in_depot            INTEGER NOT NULL DEFAULT 0,
  storage_charge_kobo      INTEGER NOT NULL DEFAULT 0,
  ncs_release_number       TEXT,
  status                   TEXT    NOT NULL DEFAULT 'received',
  created_at               INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at               INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_container_records_tenant  ON container_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_container_records_status  ON container_records(status);
CREATE INDEX IF NOT EXISTS idx_container_records_profile ON container_records(profile_id, tenant_id);
