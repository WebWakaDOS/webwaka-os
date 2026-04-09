-- Migration: 0096_vertical_airport_shuttle.sql
-- Vertical: Airport Shuttle Service (M12, P3)
-- Invariants: P9 (kobo), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS airport_shuttle_profiles (
  id                      TEXT    PRIMARY KEY,
  workspace_id            TEXT    NOT NULL,
  tenant_id               TEXT    NOT NULL,
  company_name            TEXT    NOT NULL,
  faan_permit             TEXT,
  frsc_commercial_licence TEXT,
  cac_rc                  TEXT,
  status                  TEXT    NOT NULL DEFAULT 'seeded',
  created_at              INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at              INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_airport_shuttle_profiles_tenant    ON airport_shuttle_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_airport_shuttle_profiles_status    ON airport_shuttle_profiles(status);
CREATE INDEX IF NOT EXISTS idx_airport_shuttle_profiles_workspace ON airport_shuttle_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS shuttle_vehicles (
  id           TEXT    PRIMARY KEY,
  profile_id   TEXT    NOT NULL,
  tenant_id    TEXT    NOT NULL,
  vehicle_plate TEXT   NOT NULL,
  type         TEXT    NOT NULL DEFAULT 'sedan',
  capacity     INTEGER NOT NULL DEFAULT 4,
  driver_id    TEXT,
  frsc_cert    TEXT,
  status       TEXT    NOT NULL DEFAULT 'available',
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_shuttle_vehicles_tenant  ON shuttle_vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shuttle_vehicles_profile ON shuttle_vehicles(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS shuttle_bookings (
  id               TEXT    PRIMARY KEY,
  profile_id       TEXT    NOT NULL,
  tenant_id        TEXT    NOT NULL,
  passenger_phone  TEXT,
  flight_number    TEXT,
  pickup_airport   TEXT,
  destination      TEXT,
  pickup_time      INTEGER,
  driver_id        TEXT,
  vehicle_id       TEXT,
  fare_kobo        INTEGER NOT NULL DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'booked',
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_shuttle_bookings_tenant  ON shuttle_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shuttle_bookings_status  ON shuttle_bookings(status);
CREATE INDEX IF NOT EXISTS idx_shuttle_bookings_profile ON shuttle_bookings(profile_id, tenant_id);
