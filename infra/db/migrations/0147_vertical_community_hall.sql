-- Migration 0147: Community Hall / Town Hall vertical (M12)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- 3-state FSM: seeded → claimed → active
-- capacity_seats INTEGER

CREATE TABLE IF NOT EXISTS community_hall_profiles (
  id                  TEXT    PRIMARY KEY,
  workspace_id        TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  hall_name           TEXT    NOT NULL,
  cda_registration    TEXT,
  lga                 TEXT    NOT NULL,
  state               TEXT    NOT NULL,
  capacity_seats      INTEGER NOT NULL DEFAULT 0,
  status              TEXT    NOT NULL DEFAULT 'seeded',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_community_hall_profiles_tenant ON community_hall_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS community_hall_bookings (
  id            TEXT    PRIMARY KEY,
  profile_id    TEXT    NOT NULL,
  tenant_id     TEXT    NOT NULL,
  group_name    TEXT    NOT NULL,
  event_type    TEXT    NOT NULL,
  booking_date  INTEGER NOT NULL,
  hire_fee_kobo INTEGER NOT NULL,
  deposit_kobo  INTEGER NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'booked', -- booked/confirmed/completed/cancelled
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_community_hall_bookings_tenant ON community_hall_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_hall_bookings_profile ON community_hall_bookings(profile_id);
CREATE INDEX IF NOT EXISTS idx_community_hall_bookings_date ON community_hall_bookings(profile_id, booking_date);

CREATE TABLE IF NOT EXISTS community_hall_maintenance (
  id                TEXT    PRIMARY KEY,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  contribution_date INTEGER NOT NULL,
  contributor_ref   TEXT    NOT NULL,
  amount_kobo       INTEGER NOT NULL,
  purpose           TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_community_hall_maintenance_tenant ON community_hall_maintenance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_hall_maintenance_profile ON community_hall_maintenance(profile_id);
