-- Migration 0151: Podcast Studio / Digital Media vertical (M12)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- duration_minutes INTEGER; episode_number INTEGER; streams_count INTEGER
-- L3 HITL for broadcast content scheduling AI (NBC compliance)
-- P13: guest_ref_id and sponsor_ref_id opaque

CREATE TABLE IF NOT EXISTS podcast_studio_profiles (
  id                  TEXT    PRIMARY KEY,
  workspace_id        TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  studio_name         TEXT    NOT NULL,
  nbc_licence         TEXT,    -- nullable for digital-only studios
  ncc_registration    TEXT,
  apcon_for_ads       TEXT,
  cac_rc              TEXT,
  status              TEXT    NOT NULL DEFAULT 'seeded',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_podcast_studio_profiles_tenant ON podcast_studio_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS podcast_shows (
  id                TEXT    PRIMARY KEY,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  show_name         TEXT    NOT NULL,
  category          TEXT    NOT NULL,
  nbc_reg           TEXT,
  distribution      TEXT,   -- JSON platforms list
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_podcast_shows_tenant ON podcast_shows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_podcast_shows_profile ON podcast_shows(profile_id);

CREATE TABLE IF NOT EXISTS podcast_episodes (
  id               TEXT    PRIMARY KEY,
  show_id          TEXT    NOT NULL,
  tenant_id        TEXT    NOT NULL,
  episode_number   INTEGER NOT NULL,
  recording_date   INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  release_date     INTEGER NOT NULL,
  streams_count    INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_tenant ON podcast_episodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_show ON podcast_episodes(show_id);

CREATE TABLE IF NOT EXISTS podcast_sessions (
  id             TEXT    PRIMARY KEY,
  show_id        TEXT    NOT NULL,
  tenant_id      TEXT    NOT NULL,
  guest_ref_id   TEXT    NOT NULL, -- opaque (P13)
  session_date   INTEGER NOT NULL,
  session_fee_kobo INTEGER NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'booked', -- booked/recorded/aired
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_podcast_sessions_tenant ON podcast_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_podcast_sessions_show ON podcast_sessions(show_id);

CREATE TABLE IF NOT EXISTS podcast_sponsorships (
  id               TEXT    PRIMARY KEY,
  show_id          TEXT    NOT NULL,
  tenant_id        TEXT    NOT NULL,
  episode_id       TEXT    NOT NULL,
  sponsor_ref_id   TEXT    NOT NULL, -- opaque (P13)
  deal_fee_kobo    INTEGER NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'pending', -- pending/active/completed
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_podcast_sponsorships_tenant ON podcast_sponsorships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_podcast_sponsorships_show ON podcast_sponsorships(show_id);
