-- Migration: 0099_vertical_ferry.sql
-- Vertical: Ferry / Water Transport Operator (M12, P3)
-- Invariants: P9 (kobo), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS ferry_operator_profiles (
  id              TEXT    PRIMARY KEY,
  workspace_id    TEXT    NOT NULL,
  tenant_id       TEXT    NOT NULL,
  company_name    TEXT    NOT NULL,
  nimasa_licence  TEXT,
  nrc_compliance  INTEGER NOT NULL DEFAULT 0,
  cac_rc          TEXT,
  status          TEXT    NOT NULL DEFAULT 'seeded',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ferry_operator_profiles_tenant    ON ferry_operator_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ferry_operator_profiles_status    ON ferry_operator_profiles(status);
CREATE INDEX IF NOT EXISTS idx_ferry_operator_profiles_workspace ON ferry_operator_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS ferry_vessels (
  id                  TEXT    PRIMARY KEY,
  profile_id          TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  vessel_name         TEXT    NOT NULL,
  type                TEXT    NOT NULL DEFAULT 'ferry',
  capacity_passengers INTEGER NOT NULL DEFAULT 0,
  nimasa_reg          TEXT,
  route_description   TEXT,
  status              TEXT    NOT NULL DEFAULT 'operational',
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ferry_vessels_tenant  ON ferry_vessels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ferry_vessels_profile ON ferry_vessels(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS ferry_trips (
  id                TEXT    PRIMARY KEY,
  vessel_id         TEXT    NOT NULL,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  route             TEXT,
  departure_time    INTEGER,
  arrival_time      INTEGER,
  passenger_count   INTEGER NOT NULL DEFAULT 0,
  ticket_price_kobo INTEGER NOT NULL DEFAULT 0,
  total_revenue_kobo INTEGER NOT NULL DEFAULT 0,
  status            TEXT    NOT NULL DEFAULT 'scheduled',
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ferry_trips_tenant  ON ferry_trips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ferry_trips_status  ON ferry_trips(status);
CREATE INDEX IF NOT EXISTS idx_ferry_trips_profile ON ferry_trips(profile_id, tenant_id);
