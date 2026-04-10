-- Migration 0148: Events Centre / Hall Rental vertical (M12)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- capacity_guests INTEGER; total_nights INTEGER
-- Section conflict check (overlapping dates) enforced at route level

CREATE TABLE IF NOT EXISTS events_centre_profiles (
  id                    TEXT    PRIMARY KEY,
  workspace_id          TEXT    NOT NULL,
  tenant_id             TEXT    NOT NULL,
  centre_name           TEXT    NOT NULL,
  state_event_licence   TEXT,
  fire_safety_cert      TEXT,
  lawma_compliance      TEXT,
  cac_rc                TEXT,
  status                TEXT    NOT NULL DEFAULT 'seeded',
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_centre_profiles_tenant ON events_centre_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS events_centre_sections (
  id               TEXT    PRIMARY KEY,
  profile_id       TEXT    NOT NULL,
  tenant_id        TEXT    NOT NULL,
  section_name     TEXT    NOT NULL,
  capacity_guests  INTEGER NOT NULL,
  daily_rate_kobo  INTEGER NOT NULL,
  amenities        TEXT,  -- JSON
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_centre_sections_tenant ON events_centre_sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_centre_sections_profile ON events_centre_sections(profile_id);

CREATE TABLE IF NOT EXISTS events_centre_bookings (
  id             TEXT    PRIMARY KEY,
  profile_id     TEXT    NOT NULL,
  tenant_id      TEXT    NOT NULL,
  client_phone   TEXT    NOT NULL,
  section_ids    TEXT    NOT NULL, -- JSON array
  event_type     TEXT    NOT NULL,
  start_date     INTEGER NOT NULL,
  end_date       INTEGER NOT NULL,
  total_nights   INTEGER NOT NULL,
  package_kobo   INTEGER NOT NULL,
  deposit_kobo   INTEGER NOT NULL,
  balance_kobo   INTEGER NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'enquiry', -- enquiry/confirmed/completed/cancelled
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_centre_bookings_tenant ON events_centre_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_centre_bookings_profile ON events_centre_bookings(profile_id);
CREATE INDEX IF NOT EXISTS idx_events_centre_bookings_dates ON events_centre_bookings(profile_id, start_date, end_date);
