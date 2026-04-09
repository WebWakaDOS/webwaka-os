-- Migration: 0097_vertical_cargo_truck.sql
-- Vertical: Cargo Truck Owner / Fleet Operator (M12, P3)
-- Invariants: P9 (kobo), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS cargo_truck_profiles (
  id                      TEXT    PRIMARY KEY,
  workspace_id            TEXT    NOT NULL,
  tenant_id               TEXT    NOT NULL,
  company_name            TEXT    NOT NULL,
  cac_or_coop_number      TEXT,
  frsc_operator_licence   TEXT,
  status                  TEXT    NOT NULL DEFAULT 'seeded',
  created_at              INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at              INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cargo_truck_profiles_tenant    ON cargo_truck_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cargo_truck_profiles_status    ON cargo_truck_profiles(status);
CREATE INDEX IF NOT EXISTS idx_cargo_truck_profiles_workspace ON cargo_truck_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS cargo_trucks (
  id                TEXT    PRIMARY KEY,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  plate             TEXT    NOT NULL,
  make              TEXT,
  model             TEXT,
  tonnage_kg        INTEGER NOT NULL DEFAULT 0,
  frsc_cert_expiry  INTEGER,
  status            TEXT    NOT NULL DEFAULT 'available',
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cargo_trucks_tenant  ON cargo_trucks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cargo_trucks_profile ON cargo_trucks(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS cargo_trips (
  id                  TEXT    PRIMARY KEY,
  truck_id            TEXT    NOT NULL,
  profile_id          TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  origin              TEXT,
  destination         TEXT,
  cargo_description   TEXT,
  cargo_weight_kg     INTEGER NOT NULL DEFAULT 0,
  hire_rate_kobo      INTEGER NOT NULL DEFAULT 0,
  client_phone        TEXT,
  departure_date      INTEGER,
  arrival_date        INTEGER,
  status              TEXT    NOT NULL DEFAULT 'loading',
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cargo_trips_tenant  ON cargo_trips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cargo_trips_status  ON cargo_trips(status);
CREATE INDEX IF NOT EXISTS idx_cargo_trips_profile ON cargo_trips(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS truck_expenses (
  id            TEXT    PRIMARY KEY,
  truck_id      TEXT    NOT NULL,
  tenant_id     TEXT    NOT NULL,
  expense_type  TEXT    NOT NULL DEFAULT 'fuel',
  amount_kobo   INTEGER NOT NULL DEFAULT 0,
  expense_date  INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_truck_expenses_tenant ON truck_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_truck_expenses_truck  ON truck_expenses(truck_id, tenant_id);
