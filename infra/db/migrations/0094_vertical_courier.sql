-- Migration: 0094_vertical_courier.sql
-- Vertical: Courier Service (M9, P2/P3)
-- Invariants: P9 (kobo), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS courier_profiles (
  id              TEXT    PRIMARY KEY,
  workspace_id    TEXT    NOT NULL,
  tenant_id       TEXT    NOT NULL,
  company_name    TEXT    NOT NULL,
  ncc_registered  INTEGER NOT NULL DEFAULT 0,
  cac_rc          TEXT,
  status          TEXT    NOT NULL DEFAULT 'seeded',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_courier_profiles_tenant    ON courier_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courier_profiles_status    ON courier_profiles(status);
CREATE INDEX IF NOT EXISTS idx_courier_profiles_workspace ON courier_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS courier_riders (
  id            TEXT    PRIMARY KEY,
  profile_id    TEXT    NOT NULL,
  tenant_id     TEXT    NOT NULL,
  rider_name    TEXT    NOT NULL,
  phone         TEXT,
  vehicle_type  TEXT    NOT NULL DEFAULT 'motorcycle',
  license_number TEXT,
  status        TEXT    NOT NULL DEFAULT 'available',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_courier_riders_tenant  ON courier_riders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courier_riders_profile ON courier_riders(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS courier_parcels (
  id                TEXT    PRIMARY KEY,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  tracking_code     TEXT    NOT NULL,
  sender_phone      TEXT,
  receiver_phone    TEXT,
  weight_grams      INTEGER NOT NULL DEFAULT 0,
  description       TEXT,
  pickup_address    TEXT,
  delivery_address  TEXT,
  delivery_fee_kobo INTEGER NOT NULL DEFAULT 0,
  cod_amount_kobo   INTEGER NOT NULL DEFAULT 0,
  rider_id          TEXT,
  status            TEXT    NOT NULL DEFAULT 'intake',
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_courier_parcels_tenant   ON courier_parcels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courier_parcels_status   ON courier_parcels(status);
CREATE INDEX IF NOT EXISTS idx_courier_parcels_profile  ON courier_parcels(profile_id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_parcels_tracking ON courier_parcels(tracking_code);

CREATE TABLE IF NOT EXISTS courier_cod_remittances (
  id              TEXT    PRIMARY KEY,
  parcel_id       TEXT    NOT NULL,
  tenant_id       TEXT    NOT NULL,
  collected_kobo  INTEGER NOT NULL DEFAULT 0,
  remitted_kobo   INTEGER NOT NULL DEFAULT 0,
  remittance_date INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_courier_cod_tenant  ON courier_cod_remittances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courier_cod_parcel  ON courier_cod_remittances(parcel_id, tenant_id);
