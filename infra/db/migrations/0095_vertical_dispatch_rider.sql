-- Migration: 0095_vertical_dispatch_rider.sql
-- Vertical: Dispatch Rider Network (M9, P2)
-- Invariants: P9 (kobo), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS dispatch_rider_profiles (
  id            TEXT    PRIMARY KEY,
  workspace_id  TEXT    NOT NULL,
  tenant_id     TEXT    NOT NULL,
  company_name  TEXT    NOT NULL,
  cac_rc        TEXT,
  status        TEXT    NOT NULL DEFAULT 'seeded',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_dispatch_rider_profiles_tenant    ON dispatch_rider_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_rider_profiles_status    ON dispatch_rider_profiles(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_rider_profiles_workspace ON dispatch_rider_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS dispatch_riders (
  id              TEXT    PRIMARY KEY,
  profile_id      TEXT    NOT NULL,
  tenant_id       TEXT    NOT NULL,
  rider_name      TEXT    NOT NULL,
  phone           TEXT,
  frsc_licence    TEXT,
  vio_cert        TEXT,
  vehicle_plate   TEXT,
  commission_pct  INTEGER NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'active',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_dispatch_riders_tenant  ON dispatch_riders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_riders_profile ON dispatch_riders(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS dispatch_jobs (
  id                  TEXT    PRIMARY KEY,
  profile_id          TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  pickup_address      TEXT,
  dropoff_address     TEXT,
  package_description TEXT,
  fee_kobo            INTEGER NOT NULL DEFAULT 0,
  cod_amount_kobo     INTEGER NOT NULL DEFAULT 0,
  rider_id            TEXT,
  customer_phone      TEXT,
  status              TEXT    NOT NULL DEFAULT 'created',
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_dispatch_jobs_tenant  ON dispatch_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_jobs_status  ON dispatch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_jobs_profile ON dispatch_jobs(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS rider_earnings (
  id              TEXT    PRIMARY KEY,
  rider_id        TEXT    NOT NULL,
  job_id          TEXT    NOT NULL,
  tenant_id       TEXT    NOT NULL,
  gross_fee_kobo  INTEGER NOT NULL DEFAULT 0,
  commission_kobo INTEGER NOT NULL DEFAULT 0,
  net_payout_kobo INTEGER NOT NULL DEFAULT 0,
  payout_date     INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_rider_earnings_tenant ON rider_earnings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rider_earnings_rider  ON rider_earnings(rider_id, tenant_id);
