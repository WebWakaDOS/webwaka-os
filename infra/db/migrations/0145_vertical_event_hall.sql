-- Migration 0145: Event Hall / Venue vertical (M10)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- capacity_guests INTEGER (no floats)
-- Double-booking prevention enforced at route level

CREATE TABLE IF NOT EXISTS event_hall_profiles (
  id                    TEXT    PRIMARY KEY,
  workspace_id          TEXT    NOT NULL,
  tenant_id             TEXT    NOT NULL,
  hall_name             TEXT    NOT NULL,
  state_event_licence   TEXT,
  fire_safety_cert      TEXT,
  cac_rc                TEXT,
  capacity_guests       INTEGER NOT NULL DEFAULT 0,
  status                TEXT    NOT NULL DEFAULT 'seeded',
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_hall_profiles_tenant ON event_hall_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS hall_bookings (
  id                   TEXT    PRIMARY KEY,
  profile_id           TEXT    NOT NULL,
  tenant_id            TEXT    NOT NULL,
  client_phone         TEXT    NOT NULL,
  event_date           INTEGER NOT NULL,
  event_type           TEXT    NOT NULL,
  capacity_required    INTEGER NOT NULL,
  hire_rate_kobo       INTEGER NOT NULL,
  deposit_kobo         INTEGER NOT NULL,
  balance_kobo         INTEGER NOT NULL,
  add_ons              TEXT,           -- JSON
  status               TEXT    NOT NULL DEFAULT 'enquiry', -- enquiry/confirmed/completed/cancelled
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hall_bookings_tenant ON hall_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hall_bookings_profile ON hall_bookings(profile_id);
CREATE INDEX IF NOT EXISTS idx_hall_bookings_event_date ON hall_bookings(profile_id, event_date);

CREATE TABLE IF NOT EXISTS hall_blocked_dates (
  id           TEXT    PRIMARY KEY,
  profile_id   TEXT    NOT NULL,
  tenant_id    TEXT    NOT NULL,
  blocked_date INTEGER NOT NULL,
  reason       TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hall_blocked_dates_tenant ON hall_blocked_dates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hall_blocked_dates_profile ON hall_blocked_dates(profile_id);
